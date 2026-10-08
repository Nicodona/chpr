from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0019_seed_sitetext_chrome"),
    ]

    operations = [
        migrations.AddField(
            model_name="resource",
            name="embed_url",
            field=models.URLField(
                blank=True,
                default="",
                help_text="Optional: paste a YouTube link to embed the video on "
                          "the site instead of uploading a file.",
            ),
        ),
    ]
