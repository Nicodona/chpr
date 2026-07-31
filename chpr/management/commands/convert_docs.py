"""Backfill / refresh the stored HTML web versions of PDF and DOCX resources.

Usage:
    python manage.py convert_docs           # convert anything missing or stale
    python manage.py convert_docs --force   # re-convert everything
"""
from django.core.management.base import BaseCommand

from chpr import doc_convert
from chpr.models import Resource, ResourceFile, ResourceHTML


class Command(BaseCommand):
    help = "Convert PDF/DOCX resource files to stored HTML for the web reader."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true",
                            help="Re-convert even when the stored HTML is up to date.")

    def handle(self, *args, **options):
        force = options["force"]
        counts = {"ready": 0, "failed": 0, "skipped": 0}

        for rf in ResourceFile.objects.select_related("resource"):
            self._tally(doc_convert.refresh_for_resource_file(rf, force=force), counts)

        for resource in Resource.objects.exclude(file=""):
            self._tally(doc_convert.refresh_for_legacy_file(resource, force=force), counts)

        self.stdout.write(self.style.SUCCESS(
            f"Done — {counts['ready']} ready, {counts['failed']} failed, "
            f"{counts['skipped']} not convertible."
        ))
        for row in ResourceHTML.objects.filter(status=ResourceHTML.Status.FAILED).select_related("resource"):
            self.stdout.write(self.style.WARNING(f"  failed: {row.resource.name}: {row.error}"))

    def _tally(self, row, counts):
        if row is None:
            counts["skipped"] += 1
        elif row.status == ResourceHTML.Status.READY:
            counts["ready"] += 1
        else:
            counts["failed"] += 1
