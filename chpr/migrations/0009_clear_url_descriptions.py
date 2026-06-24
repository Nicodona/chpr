from django.db import migrations


def clear_url_descriptions(apps, schema_editor):
    """Imported palcameroon resources stored the source file URL as the
    description, which surfaced as an ugly link under (mostly) video titles.
    Clear any description that is really just a URL / bare file reference."""
    Resource = apps.get_model("chpr", "Resource")
    for r in Resource.objects.all():
        d = (r.description or "").strip()
        if not d:
            continue
        low = d.lower()
        if "http://" in low or "https://" in low or low.endswith((".mp4", ".pdf")):
            r.description = ""
            r.save(update_fields=["description"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0008_resourcefile"),
    ]

    operations = [
        migrations.RunPython(clear_url_descriptions, noop),
    ]
