import tempfile

from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from datetime import timedelta

from django.utils import timezone

from chpr.models import Project, Resource, ResourceFile, SiteConfig


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
