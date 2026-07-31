"""Keep ResourceHTML in sync with file uploads.

Conversion runs synchronously in the upload request (a few seconds for large
PDFs) — acceptable for this app's document sizes and avoids a task queue.
``refresh_*`` no-ops when the stored HTML already matches the current file,
so re-saving a resource without changing its file costs nothing.
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from . import doc_convert, quiz_gen
from .models import Resource, ResourceFile

log = logging.getLogger(__name__)


@receiver(post_save, sender=ResourceFile, dispatch_uid="chpr_convert_resource_file")
def convert_resource_file_on_save(sender, instance, **kwargs):
    try:
        doc_convert.refresh_for_resource_file(instance)
    except Exception:  # noqa: BLE001 — conversion must never break an upload
        log.exception("HTML conversion failed for ResourceFile %s", instance.pk)
    quiz_gen.maybe_autogenerate(instance.resource)


@receiver(post_save, sender=Resource, dispatch_uid="chpr_convert_resource_legacy")
def convert_legacy_file_on_save(sender, instance, **kwargs):
    try:
        doc_convert.refresh_for_legacy_file(instance)
    except Exception:  # noqa: BLE001
        log.exception("HTML conversion failed for Resource %s", instance.pk)
    quiz_gen.maybe_autogenerate(instance)
