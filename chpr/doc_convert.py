"""PDF / DOCX → sanitized HTML conversion for the resource web reader.

When a resource file is uploaded (or first requested), the document is
converted to clean semantic HTML and stored in ``ResourceHTML`` so the
frontend can render a styled, scrollable web page instead of a PDF viewer.

  - PDF  : pymupdf4llm extracts structured Markdown (headings inferred from
           font sizes, lists, tables, images embedded as base64 data URIs),
           which is rendered to HTML with python-markdown.
  - DOCX : mammoth produces semantic HTML directly (images inlined).

All output is sanitized with nh3 (ammonia) before storage. Conversion is
best-effort: failures are recorded on the ResourceHTML row and the frontend
falls back to the original-file viewer.
"""
from __future__ import annotations

import logging
import re

log = logging.getLogger(__name__)

#: Extensions we know how to turn into HTML.
CONVERTIBLE_EXTS = (".pdf", ".docx")

# "data" is required because converted documents embed their images as
# base64 data URIs, keeping the stored HTML fully self-contained.
_URL_SCHEMES = {"http", "https", "mailto", "tel", "data"}

# Some Word-exported PDFs map custom ligature glyphs to U+FFFD, making the
# text unrecoverable. Above this ratio the page would read as garbage, so we
# fail the conversion and let the frontend show the original PDF instead.
_REPLACEMENT_RATIO_LIMIT = 0.005
_MIN_TEXT_CHARS = 40

_IMG_MD_RE = re.compile(r"!\[[^\]]*\]\([^)]*\)")
_TAG_RE = re.compile(r"<[^>]+>")
_WORD_RE = re.compile(r"\w+", re.UNICODE)


def file_extension(name):
    name = (name or "").split("?")[0]
    return "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""


def is_convertible(name):
    return file_extension(name) in CONVERTIBLE_EXTS


def convert_to_html(fileobj, filename):
    """Convert an open binary file to HTML.

    Returns ``{"status": "ready"|"failed", "html", "error", "page_count",
    "word_count"}`` and never raises: any exception is captured as a failed
    result so an upload can't be broken by a corrupt document.
    """
    ext = file_extension(filename)
    try:
        if ext == ".pdf":
            return _convert_pdf(fileobj)
        if ext == ".docx":
            return _convert_docx(fileobj)
        return _failed("Unsupported file type for web view.")
    except Exception as exc:  # noqa: BLE001 — see docstring
        log.warning("Document conversion failed for %s: %s", filename, exc)
        return _failed(f"Conversion error: {exc}")


def _failed(message):
    return {"status": "failed", "html": "", "error": str(message)[:500],
            "page_count": 0, "word_count": 0}


def _convert_pdf(fileobj):
    import markdown
    import pymupdf
    import pymupdf4llm

    doc = pymupdf.open(stream=fileobj.read(), filetype="pdf")
    page_count = doc.page_count
    md_text = pymupdf4llm.to_markdown(doc, embed_images=True)
    md_text = _repair_word_ligatures(md_text)

    plain = _IMG_MD_RE.sub("", md_text).strip()
    if len(plain) < _MIN_TEXT_CHARS:
        return _failed("No extractable text — this looks like a scanned document.")
    if plain.count("�") / len(plain) > _REPLACEMENT_RATIO_LIMIT:
        return _failed("The PDF's fonts don't map to readable text.")

    html = markdown.markdown(md_text, extensions=["tables", "sane_lists"])
    return {
        "status": "ready",
        "html": _sanitize(html),
        "error": "",
        "page_count": page_count,
        "word_count": len(_WORD_RE.findall(plain)),
    }


def _repair_word_ligatures(text):
    """Fix the classic Word/Calibri PDF export bug where the 'ti' ligature
    glyph carries no Unicode mapping and extracts as U+FFFD (e.g.
    'ac�vi�es' for 'activities'). Only touches replacement chars
    sandwiched between letters of the same case, where 'ti' is by far the
    dominant original."""
    text = re.sub(r"(?<=[a-z])�(?=[a-z])", "ti", text)
    return re.sub(r"(?<=[A-Z])�(?=[A-Z])", "TI", text)


def _convert_docx(fileobj):
    import mammoth

    result = mammoth.convert_to_html(fileobj)  # images become data URIs
    for msg in result.messages:
        log.info("mammoth: %s", msg)
    html = _sanitize(result.value)

    plain = _TAG_RE.sub(" ", html)
    word_count = len(_WORD_RE.findall(plain))
    if word_count == 0 and "<img" not in html:
        return _failed("The document appears to be empty.")
    return {"status": "ready", "html": html, "error": "",
            "page_count": 0, "word_count": word_count}


def _sanitize(html):
    import nh3

    return nh3.clean(html, url_schemes=_URL_SCHEMES, link_rel="noopener noreferrer")


# ---------------------------------------------------------------------------
# Orchestration — keep ResourceHTML rows in sync with uploaded files
# ---------------------------------------------------------------------------

def refresh_for_resource_file(resource_file, force=False):
    """Ensure the stored HTML for a language file matches its current upload.
    Returns the ResourceHTML row, or None when the file isn't convertible."""
    from .models import ResourceHTML

    if not resource_file.file or not is_convertible(resource_file.file.name):
        ResourceHTML.objects.filter(resource_file=resource_file).delete()
        return None

    row, _ = ResourceHTML.objects.get_or_create(
        resource_file=resource_file,
        defaults={"resource": resource_file.resource, "language": resource_file.language},
    )
    if _is_fresh(row, resource_file.file, force):
        return row
    return _convert_into(row, resource_file.file, language=resource_file.language)


def refresh_for_legacy_file(resource, force=False):
    """Same as above for the legacy single ``Resource.file`` upload."""
    from .models import ResourceHTML

    qs = ResourceHTML.objects.filter(resource=resource, resource_file__isnull=True)
    if not resource.file or not is_convertible(resource.file.name):
        qs.delete()
        return None

    row = qs.first() or ResourceHTML(resource=resource, resource_file=None)
    if row.pk and _is_fresh(row, resource.file, force):
        return row
    return _convert_into(row, resource.file)


def _is_fresh(row, filefield, force):
    from .models import ResourceHTML

    return (
        not force
        and row.source_name == filefield.name
        and row.status != ResourceHTML.Status.PENDING
    )


def _convert_into(row, filefield, language=""):
    from .models import ResourceHTML

    row.language = language or row.language or ""
    row.source_name = filefield.name
    try:
        with filefield.open("rb") as fh:
            result = convert_to_html(fh, filefield.name)
    except Exception as exc:  # noqa: BLE001 — storage errors must not propagate
        log.warning("Could not read %s for conversion: %s", filefield.name, exc)
        result = _failed(f"Could not read source file: {exc}")

    row.status = (
        ResourceHTML.Status.READY if result["status"] == "ready"
        else ResourceHTML.Status.FAILED
    )
    row.html = result["html"]
    row.error = result["error"]
    row.page_count = result["page_count"]
    row.word_count = result["word_count"]
    row.save()
    return row


def get_or_convert(resource, language=None):
    """Return the ResourceHTML matching ``language`` (converting lazily so
    resources uploaded before this feature gain HTML on first request).

    Falls back to English, then the first language file, then the legacy
    ``Resource.file`` — mirroring the frontend's active-file selection.
    """
    files = list(resource.files.all())
    if files:
        chosen = None
        if language:
            chosen = next((f for f in files if f.language == language), None)
        if chosen is None:
            chosen = next((f for f in files if f.language == "en"), files[0])
        return refresh_for_resource_file(chosen)
    return refresh_for_legacy_file(resource)
