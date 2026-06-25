from django.db import migrations
from django.utils.text import slugify


def backfill(apps, schema_editor):
    Resource = apps.get_model("chpr", "Resource")
    seen = set(Resource.objects.exclude(slug__isnull=True).values_list("slug", flat=True))
    for r in Resource.objects.filter(slug__isnull=True).order_by("id"):
        base = slugify(r.name)[:240] or "resource"
        slug = base
        n = 2
        while slug in seen or Resource.objects.filter(slug=slug).exclude(pk=r.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        r.slug = slug
        seen.add(slug)
        r.save(update_fields=["slug"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0013_resource_slug"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
