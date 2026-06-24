import tempfile

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from chpr.models import Project, Resource, ResourceFile


def _rows(payload):
    """Resource endpoint may be paginated ({results: [...]}) or a bare list."""
    if isinstance(payload, dict) and "results" in payload:
        return payload["results"]
    return payload


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
