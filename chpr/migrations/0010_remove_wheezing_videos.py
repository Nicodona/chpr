from django.db import migrations


def remove_wheezing_videos(apps, schema_editor):
    """Founder asked to drop the 'Wheezing ...' demonstration videos
    (Sleep With/Without Cough, Sudden Onset, Sports, Office)."""
    Resource = apps.get_model("chpr", "Resource")
    qs = Resource.objects.filter(type_key="vid", name__istartswith="Wheezing")
    count = qs.count()
    qs.delete()  # cascades to ResourceFile / interactions
    print(f"  removed {count} wheezing video(s)")


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0009_clear_url_descriptions"),
    ]

    operations = [
        migrations.RunPython(remove_wheezing_videos, noop),
    ]
