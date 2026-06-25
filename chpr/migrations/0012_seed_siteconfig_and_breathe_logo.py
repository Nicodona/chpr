import os

from django.conf import settings
from django.core.files import File
from django.db import migrations


def seed(apps, schema_editor):
    SiteConfig = apps.get_model("chpr", "SiteConfig")
    Project = apps.get_model("chpr", "Project")

    # Ensure the singleton settings row exists (defaults: 6 / 6).
    SiteConfig.objects.get_or_create(pk=1)

    # Attach the BREATHE logo (bundled in the repo) to the breathe project.
    src = os.path.join(settings.BASE_DIR, "chpr", "seed_assets", "breathe-logo.png")
    if os.path.exists(src):
        try:
            p = Project.objects.get(slug="breathe")
        except Project.DoesNotExist:
            return
        if not p.logo:
            with open(src, "rb") as fh:
                p.logo.save("breathe-logo.png", File(fh), save=True)


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0011_siteconfig_project_logo"),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
