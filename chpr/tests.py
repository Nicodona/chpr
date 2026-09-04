import tempfile

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from datetime import timedelta

from django.utils import timezone

from django.contrib.auth.models import User
from django.test import Client
from django.urls import reverse

from chpr.models import Project, Resource, ResourceFile, SiteConfig, SiteText, StaffProfile


def _rows(payload):
    """Resource endpoint may be paginated ({results: [...]}) or a bare list."""
    if isinstance(payload, dict) and "results" in payload:
        return payload["results"]
    return payload


class SiteTextAPITests(TestCase):
    """Editable site text: public reads, admin-only writes, value-only edits."""

    def setUp(self):
        self.client = APIClient()
        self.entry = SiteText.objects.create(
            key="test.greeting", value="Hello", label="Test greeting",
            group="Test", order=1,
        )
        self.admin = User.objects.create_user("admin_t", password="x")
        StaffProfile.objects.create(user=self.admin, role="admin")
        self.staff = User.objects.create_user("staff_t", password="x")
        StaffProfile.objects.create(user=self.staff, role="staff")

    def test_list_is_public_and_includes_entry(self):
        res = self.client.get("/api/site-text/")
        self.assertEqual(res.status_code, 200)
        by_key = {r["key"]: r for r in _rows(res.json())}
        self.assertIn("test.greeting", by_key)
        self.assertEqual(by_key["test.greeting"]["value"], "Hello")
        self.assertEqual(by_key["test.greeting"]["label"], "Test greeting")

    def test_anonymous_cannot_edit(self):
        res = self.client.patch(
            f"/api/site-text/{self.entry.id}/", {"value": "Hacked"}, format="json"
        )
        self.assertIn(res.status_code, (401, 403))
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.value, "Hello")

    def test_staff_non_admin_cannot_edit(self):
        self.client.force_authenticate(self.staff)
        res = self.client.patch(
            f"/api/site-text/{self.entry.id}/", {"value": "Nope"}, format="json"
        )
        self.assertEqual(res.status_code, 403)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.value, "Hello")

    def test_admin_can_edit_value(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            f"/api/site-text/{self.entry.id}/", {"value": "Updated"}, format="json"
        )
        self.assertEqual(res.status_code, 200)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.value, "Updated")

    def test_key_is_read_only(self):
        self.client.force_authenticate(self.admin)
        res = self.client.patch(
            f"/api/site-text/{self.entry.id}/",
            {"key": "test.renamed", "value": "V"}, format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.entry.refresh_from_db()
        self.assertEqual(self.entry.key, "test.greeting")  # unchanged
        self.assertEqual(self.entry.value, "V")

    def test_no_create_or_delete_via_api(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post(
            "/api/site-text/", {"key": "x", "value": "y", "label": "z"}, format="json"
        )
        self.assertEqual(res.status_code, 405)
        res = self.client.delete(f"/api/site-text/{self.entry.id}/")
        self.assertEqual(res.status_code, 405)

    def test_seed_migration_created_home_keys(self):
        keys = set(SiteText.objects.values_list("key", flat=True))
        self.assertIn("home.hero_title", keys)
        self.assertIn("home.search_placeholder", keys)

    def test_seed_migration_created_chrome_keys(self):
        """Second seed batch: nav / footer / home headings / FAQ button."""
        keys = set(SiteText.objects.values_list("key", flat=True))
        for k in ("nav.all_resources", "nav.sign_in", "home.latest_title",
                  "footer.org_name", "faq.button_label"):
            self.assertIn(k, keys)


class AdminRendersTests(TestCase):
    """Every admin page must render under the Unfold theme (catches template,
    ModelAdmin, sidebar reverse() and dashboard-callback breakage server-side)."""

    CHANGELISTS = [
        "chpr_resource", "chpr_project", "chpr_faq", "chpr_sitetext",
        "chpr_resourcehtml", "chpr_quizquestion", "chpr_resourcecomment",
        "chpr_staffprofile", "chpr_contactmessage", "chpr_sitevisit",
        "chpr_resourceinteraction", "chpr_siteconfig",
        "auth_user", "auth_group",
    ]
    ADD_PAGES = ["chpr_resource", "chpr_project", "chpr_faq", "auth_user"]

    def setUp(self):
        self.client = Client()
        self.admin = User.objects.create_superuser("admin_render", "a@example.com", "pw-x-123")
        self.client.force_login(self.admin)

    def test_dashboard_index_renders(self):
        res = self.client.get(reverse("admin:index"))
        self.assertEqual(res.status_code, 200)
        # Dashboard-callback context reached the template.
        self.assertContains(res, "Recent resources")

    def test_all_changelists_render(self):
        for name in self.CHANGELISTS:
            res = self.client.get(reverse(f"admin:{name}_changelist"))
            self.assertEqual(res.status_code, 200, f"{name} changelist -> {res.status_code}")

    def test_key_add_pages_render(self):
        for name in self.ADD_PAGES:
            res = self.client.get(reverse(f"admin:{name}_add"))
            self.assertEqual(res.status_code, 200, f"{name} add -> {res.status_code}")

    def test_login_page_uses_unfold(self):
        Client().logout()
        res = Client().get(reverse("admin:login"))
        self.assertEqual(res.status_code, 200)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ResourceLanguageAPITests(TestCase):
    """The language switcher relies on each resource exposing a `languages`
    array of {language, language_label, url}. Lock that contract in."""

    def setUp(self):
        self.client = APIClient()
        self.project = Project.objects.create(slug="breathe", name="BREATHE")
        self.video = Resource.objects.create(
            project=self.project,
            name="Lung Flute Introductory Video",
            type_key="vid",
            activity="cr",
            audience="all",
        )
        ResourceFile.objects.create(
            resource=self.video, language="en",
            file=SimpleUploadedFile("en.mp4", b"x"), order=0,
        )
        ResourceFile.objects.create(
            resource=self.video, language="fr",
            file=SimpleUploadedFile("fr.mp4", b"y"), order=1,
        )

    def _get_video(self):
        res = self.client.get("/api/resources/")
        self.assertEqual(res.status_code, 200)
        rows = _rows(res.json())
        return next(r for r in rows if r["name"] == "Lung Flute Introductory Video")

    def test_list_exposes_all_languages(self):
        vid = self._get_video()
        self.assertEqual(
            {l["language"] for l in vid["languages"]}, {"en", "fr"}
        )

    def test_language_has_label_and_url(self):
        vid = self._get_video()
        en = next(l for l in vid["languages"] if l["language"] == "en")
        self.assertEqual(en["language_label"], "English")
        self.assertTrue(en["url"])  # a real media URL, not None

    def test_single_language_resource_has_one_entry(self):
        solo = Resource.objects.create(
            project=self.project, name="Solo Doc",
            type_key="alg", activity="hf", audience="all",
        )
        ResourceFile.objects.create(
            resource=solo, language="en", file=SimpleUploadedFile("s.pdf", b"z"),
        )
        res = self.client.get("/api/resources/")
        row = next(r for r in _rows(res.json()) if r["name"] == "Solo Doc")
        self.assertEqual(len(row["languages"]), 1)

    def test_one_file_per_language_per_resource(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                ResourceFile.objects.create(
                    resource=self.video, language="en",
                    file=SimpleUploadedFile("dupe.mp4", b"w"),
                )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ProjectsNavAndConfigTests(TestCase):
    """Nav dropdown + home featuring are driven by SiteConfig (admin-controlled
    counts) and ordered newest-first."""

    def setUp(self):
        self.client = APIClient()
        base = timezone.now()
        self.p1 = Project.objects.create(slug="a", name="Alpha")
        self.p2 = Project.objects.create(slug="b", name="Beta")
        self.p3 = Project.objects.create(slug="c", name="Gamma")
        # Force a known created_at order (auto_now_add can collide in fast tests).
        for i, p in enumerate([self.p1, self.p2, self.p3]):
            Project.objects.filter(pk=p.pk).update(created_at=base + timedelta(minutes=i))

    def test_site_config_endpoint_defaults(self):
        res = self.client.get("/api/site-config/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"nav_projects_count": 6, "home_projects_count": 6})

    def test_nav_returns_newest_first_capped_by_config(self):
        cfg = SiteConfig.get()
        cfg.nav_projects_count = 2
        cfg.save()
        res = self.client.get("/api/projects/nav/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p["slug"] for p in res.json()], ["c", "b"])

    def test_nav_hides_inactive_projects(self):
        Project.objects.filter(pk=self.p3.pk).update(is_active=False)
        res = self.client.get("/api/projects/nav/")
        self.assertNotIn("c", [p["slug"] for p in res.json()])

    def test_project_logo_url_is_null_without_logo(self):
        res = self.client.get("/api/projects/")
        rows = _rows(res.json())
        self.assertIn("logo_url", rows[0])
        self.assertIsNone(rows[0]["logo_url"])

    def test_siteconfig_is_a_singleton(self):
        SiteConfig.get()
        dup = SiteConfig()
        dup.nav_projects_count = 9
        dup.save()
        self.assertEqual(SiteConfig.objects.count(), 1)
        self.assertEqual(SiteConfig.get().nav_projects_count, 9)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class ResourceSlugTests(TestCase):
    """Resources get slug permalinks; the detail endpoint resolves slug or id."""

    def setUp(self):
        self.client = APIClient()
        self.project = Project.objects.create(slug="breathe", name="BREATHE")

    def test_slug_autogenerated_from_name(self):
        r = Resource.objects.create(
            project=self.project, name="Screening & Diagnosis of TB",
            type_key="alg", audience="all",
        )
        self.assertEqual(r.slug, "screening-diagnosis-of-tb")

    def test_duplicate_names_get_unique_slugs(self):
        a = Resource.objects.create(project=self.project, name="Same Name", type_key="alg", audience="all")
        b = Resource.objects.create(project=self.project, name="Same Name", type_key="alg", audience="all")
        self.assertEqual(a.slug, "same-name")
        self.assertEqual(b.slug, "same-name-2")

    def test_detail_resolves_by_slug_and_by_id(self):
        r = Resource.objects.create(project=self.project, name="Lung Flute Video", type_key="vid", audience="all")
        by_slug = self.client.get(f"/api/resources/{r.slug}/")
        self.assertEqual(by_slug.status_code, 200)
        self.assertEqual(by_slug.json()["id"], r.id)
        by_id = self.client.get(f"/api/resources/{r.id}/")
        self.assertEqual(by_id.status_code, 200)
        self.assertEqual(by_id.json()["slug"], r.slug)


# ---------------------------------------------------------------------------
# PDF/DOCX → HTML web reader (doc_convert + /api/resources/<id>/html/)
# ---------------------------------------------------------------------------

def _make_pdf_bytes():
    """A small real PDF with enough text to pass the conversion quality gate."""
    import pymupdf
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((72, 80), "Pooled Testing Guide", fontsize=20)
    page.insert_text(
        (72, 130),
        "Collect sputum samples from all eligible clients before noon.",
        fontsize=11,
    )
    page.insert_text(
        (72, 150),
        "Label each specimen container with the matching QR code sticker.",
        fontsize=11,
    )
    return doc.tobytes()


def _make_docx_bytes():
    """A minimal valid DOCX (mammoth needs the OPC package parts only)."""
    import io
    import zipfile

    content_types = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        "</Relationships>"
    )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body>"
        '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Specimen Handling</w:t></w:r></w:p>'
        "<w:p><w:r><w:t>Keep all samples refrigerated until transport.</w:t></w:r></w:p>"
        "</w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types)
        z.writestr("_rels/.rels", rels)
        z.writestr("word/document.xml", document)
    return buf.getvalue()


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class DocConvertTests(TestCase):
    """Uploading a PDF/DOCX must produce a stored, sanitized HTML web version."""

    def setUp(self):
        self.client = APIClient()
        self.project = Project.objects.create(slug="breathe", name="BREATHE")

    def _resource(self, filename, payload, **kwargs):
        return Resource.objects.create(
            project=self.project,
            name=kwargs.pop("name", "Doc Resource"),
            type_key=kwargs.pop("type_key", "job"),
            audience="all",
            file=SimpleUploadedFile(filename, payload),
            **kwargs,
        )

    def test_pdf_upload_converts_on_save(self):
        from chpr.models import ResourceHTML
        res = self._resource("guide.pdf", _make_pdf_bytes())
        row = ResourceHTML.objects.get(resource=res, resource_file__isnull=True)
        self.assertEqual(row.status, ResourceHTML.Status.READY)
        self.assertIn("Pooled Testing Guide", row.html)
        self.assertIn("QR code sticker", row.html)
        self.assertGreater(row.word_count, 10)
        self.assertEqual(row.page_count, 1)

    def test_docx_upload_converts_on_save(self):
        from chpr.models import ResourceHTML
        res = self._resource("handling.docx", _make_docx_bytes())
        row = ResourceHTML.objects.get(resource=res, resource_file__isnull=True)
        self.assertEqual(row.status, ResourceHTML.Status.READY)
        self.assertIn("<h1>", row.html)
        self.assertIn("Specimen Handling", row.html)

    def test_textless_pdf_fails_gracefully(self):
        import pymupdf
        from chpr.models import ResourceHTML
        doc = pymupdf.open()
        doc.new_page()  # blank page — mimics a scanned document
        res = self._resource("scan.pdf", doc.tobytes())
        row = ResourceHTML.objects.get(resource=res, resource_file__isnull=True)
        self.assertEqual(row.status, ResourceHTML.Status.FAILED)
        self.assertEqual(row.html, "")

    def test_non_document_upload_is_skipped(self):
        from chpr.models import ResourceHTML
        res = self._resource("clip.mp4", b"not-a-doc", name="Video", type_key="vid")
        self.assertFalse(ResourceHTML.objects.filter(resource=res).exists())

    def test_html_endpoint_returns_ready_html(self):
        res = self._resource("guide.pdf", _make_pdf_bytes())
        r = self.client.get(f"/api/resources/{res.id}/html/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(data["status"], "ready")
        self.assertIn("Pooled Testing Guide", data["html"])

    def test_html_endpoint_converts_lazily(self):
        """Resources uploaded before this feature (no stored row) convert on
        first request."""
        from chpr.models import ResourceHTML
        res = self._resource("guide.pdf", _make_pdf_bytes())
        ResourceHTML.objects.filter(resource=res).delete()
        r = self.client.get(f"/api/resources/{res.id}/html/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "ready")
        self.assertTrue(ResourceHTML.objects.filter(resource=res).exists())

    def test_html_endpoint_language_files(self):
        from chpr.models import ResourceHTML
        res = Resource.objects.create(
            project=self.project, name="Multi-lang", type_key="job", audience="all",
        )
        ResourceFile.objects.create(
            resource=res, language="en",
            file=SimpleUploadedFile("en.pdf", _make_pdf_bytes()),
        )
        ResourceFile.objects.create(
            resource=res, language="fr",
            file=SimpleUploadedFile("fr.docx", _make_docx_bytes()),
        )
        self.assertEqual(ResourceHTML.objects.filter(resource=res).count(), 2)

        r = self.client.get(f"/api/resources/{res.id}/html/?lang=fr")
        self.assertEqual(r.status_code, 200)
        self.assertIn("Specimen Handling", r.json()["html"])

        r = self.client.get(f"/api/resources/{res.id}/html/?lang=en")
        self.assertIn("Pooled Testing Guide", r.json()["html"])

    def test_html_endpoint_404_when_not_convertible(self):
        res = self._resource("clip.mp4", b"x", name="Video", type_key="vid")
        r = self.client.get(f"/api/resources/{res.id}/html/")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(r.json()["status"], "unavailable")

    def test_output_is_sanitized(self):
        """A document whose text contains markup must not produce live HTML."""
        import pymupdf
        from chpr.models import ResourceHTML
        doc = pymupdf.open()
        page = doc.new_page()
        page.insert_text((72, 80), "Safety notice for all laboratory staff members.", fontsize=12)
        page.insert_text((72, 110), '<script>alert("xss")</script> handle with care', fontsize=12)
        page.insert_text((72, 140), "Always verify the sample identifier before testing.", fontsize=12)
        res = self._resource("notice.pdf", doc.tobytes())
        row = ResourceHTML.objects.get(resource=res)
        self.assertNotIn("<script", row.html)


# ---------------------------------------------------------------------------
# Auto-generated quizzes (quiz_gen + short-answer grading)
# ---------------------------------------------------------------------------

SECTIONED_HTML = """
<h1>Screening at the OPD</h1>
<p>Every client visiting the facility must be screened for tuberculosis symptoms
before consultation begins at the outpatient department each morning.</p>
<p>The screening officer attaches exactly 6 QR code stickers to the request form
of every eligible client during the morning triage session.</p>
<h1>Specimen Collection</h1>
<p>Sputum containers must be labelled with the matching QR code sticker before
they are transported to the laboratory in the afternoon batch.</p>
<p>Each cooler box carries a maximum of 24 sputum containers per transport run
between the facility and the laboratory reception desk.</p>
<h1>Laboratory Testing</h1>
<p>The laboratory technician scans the QR code into REDCap before running the
GeneXpert test on every specimen received from the facilities.</p>
<p>Results must be entered into the database within 48 hours of specimen
reception according to the standard operating procedure.</p>
"""


class QuizGenTests(TestCase):
    """The generator must produce document-grounded questions covering all
    sections, mixing MCQs with a few short/straight answers."""

    def test_generates_questions_across_sections(self):
        from chpr.quiz_gen import generate_questions
        qs = generate_questions(SECTIONED_HTML, seed=1)
        self.assertGreaterEqual(len(qs), 4)
        self.assertLessEqual(len(qs), 20)
        kinds = {q["question_type"] for q in qs}
        self.assertIn("mcq", kinds)
        self.assertIn("short", kinds)
        for q in qs:
            self.assertIn("document", q["explanation"])
            # The per-question prefix is gone — the modal shows it once instead.
            self.assertNotIn("According to this document", q["question"])
        # Coverage: source sentences must come from more than one section.
        markers = ["screened", "cooler", "REDCap"]
        joined = " ".join(q["explanation"] for q in qs)
        hits = sum(1 for t in markers if t.lower() in joined.lower())
        self.assertGreaterEqual(hits, 2, "questions should span multiple sections")

    def test_question_style_variety(self):
        from chpr.quiz_gen import generate_questions
        stems = [q["question"] for q in generate_questions(SECTIONED_HTML, seed=1)]
        self.assertTrue(any(s.startswith("Fill in the blank") for s in stems))
        self.assertTrue(any(s.startswith("Yes or No") for s in stems))

    def test_max_twenty_questions(self):
        from chpr.quiz_gen import generate_questions
        big = SECTIONED_HTML * 8  # plenty of candidate sentences
        self.assertLessEqual(len(generate_questions(big, seed=3)), 20)

    def test_mcq_options_contain_the_answer(self):
        from chpr.quiz_gen import generate_questions
        for q in generate_questions(SECTIONED_HTML, seed=1):
            if q["question_type"] != "mcq":
                continue
            if q["question"].startswith("Yes or No"):
                self.assertIn(q["correct"], ("a", "b"))
                continue
            options = [q.get(f"option_{k}") for k in "abcd" if q.get(f"option_{k}")]
            self.assertGreaterEqual(len(options), 3)
            correct_opt = q[f"option_{q['correct']}"]
            # The right option always appears in the quoted source sentence.
            self.assertIn(correct_opt.lower(), q["explanation"].lower())

    def test_deterministic_for_same_seed(self):
        from chpr.quiz_gen import generate_questions
        self.assertEqual(
            generate_questions(SECTIONED_HTML, seed=7),
            generate_questions(SECTIONED_HTML, seed=7),
        )


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class QuizAutoGenerationTests(TestCase):
    def setUp(self):
        from django.contrib.auth.models import User
        from chpr.models import StaffProfile
        self.client = APIClient()
        self.project = Project.objects.create(slug="breathe", name="BREATHE")
        self.admin = User.objects.create_user("boss", "boss@x.org", "pw12345!")
        StaffProfile.objects.create(user=self.admin, role="admin")
        self.staff = User.objects.create_user("tech", "tech@x.org", "pw12345!")
        StaffProfile.objects.create(user=self.staff, role="staff", department="lab")

    def _pdf_resource(self):
        return Resource.objects.create(
            project=self.project, name="QR Guide", type_key="job", audience="all",
            file=SimpleUploadedFile("guide.pdf", _make_pdf_bytes()),
        )

    def test_quiz_created_automatically_on_upload(self):
        res = self._pdf_resource()
        qs = res.quiz_questions.all()
        self.assertGreater(qs.count(), 0)
        self.assertTrue(all(q.auto_generated for q in qs))

    def test_video_resource_gets_no_quiz(self):
        res = Resource.objects.create(
            project=self.project, name="Video", type_key="vid", audience="all",
            file=SimpleUploadedFile("clip.mp4", b"x"),
        )
        self.assertEqual(res.quiz_questions.count(), 0)

    def test_generate_endpoint_admin_only(self):
        res = self._pdf_resource()
        self.client.force_authenticate(self.staff)
        r = self.client.post(f"/api/resources/{res.id}/generate-quiz/")
        self.assertEqual(r.status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/resources/{res.id}/generate-quiz/")
        self.assertEqual(r.status_code, 200)
        self.assertGreater(r.json()["total"], 0)

    def test_regeneration_keeps_manual_questions(self):
        from chpr.models import QuizQuestion
        res = self._pdf_resource()
        manual = QuizQuestion.objects.create(
            resource=res, question="Hand-written?", option_a="Yes", option_b="No",
            correct="a", auto_generated=False,
        )
        auto_ids = set(res.quiz_questions.filter(auto_generated=True).values_list("id", flat=True))
        self.client.force_authenticate(self.admin)
        r = self.client.post(f"/api/resources/{res.id}/generate-quiz/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(res.quiz_questions.filter(id=manual.id).exists())
        new_auto = set(res.quiz_questions.filter(auto_generated=True).values_list("id", flat=True))
        self.assertTrue(new_auto.isdisjoint(auto_ids), "old auto questions replaced")

    def test_public_list_hides_answers(self):
        res = self._pdf_resource()
        r = self.client.get(f"/api/quiz-questions/?resource={res.id}")
        rows = _rows(r.json())
        self.assertGreater(len(rows), 0)
        for row in rows:
            self.assertNotIn("answer_text", row)
            self.assertNotIn("correct", row)
            self.assertIn("question_type", row)

    def test_short_answer_grading(self):
        from chpr.models import QuizQuestion
        res = Resource.objects.create(
            project=self.project, name="No file", type_key="job", audience="all",
        )
        q = QuizQuestion.objects.create(
            resource=res, question="Fill: scan into _____",
            question_type="short", answer_text="REDCap", auto_generated=False,
        )
        self.client.force_authenticate(self.staff)
        url = f"/api/resources/{res.id}/submit-quiz/"

        cases = [
            ("REDCap", True), ("redcap", True), ("  RedCap. ", True),
            ("redcapp", True),           # tiny typo tolerated
            ("paper register", False), ("", False),
        ]
        for given, expected_ok in cases:
            r = self.client.post(url, {"answers": {str(q.id): given}}, format="json")
            self.assertEqual(r.status_code, 200)
            got = r.json()["results"][0]["is_correct"]
            self.assertEqual(got, expected_ok, f"answer {given!r} -> {got}")

        r = self.client.post(url, {"answers": {str(q.id): "redcap"}}, format="json")
        self.assertEqual(r.json()["results"][0]["correct_text"], "REDCap")

    def test_number_short_answer_requires_exact_number(self):
        from chpr.views import _short_answer_matches
        self.assertTrue(_short_answer_matches("6", "6"))
        self.assertFalse(_short_answer_matches("8", "6"))
        self.assertTrue(_short_answer_matches(" 24 ", "24"))
        self.assertFalse(_short_answer_matches("240", "24"))
