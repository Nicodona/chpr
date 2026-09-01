from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0016_quizquestion_answer_text_quizquestion_auto_generated_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="SiteText",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(help_text="Stable identifier used in the code, e.g. 'home.hero_title'. Do not change once it is referenced.", max_length=100, unique=True)),
                ("value", models.TextField(blank=True, help_text="The text shown on the site.")),
                ("label", models.CharField(help_text="Friendly name shown in the editor.", max_length=150)),
                ("group", models.CharField(default="General", help_text="Category for grouping in the editor, e.g. 'Home', 'Navigation'.", max_length=60)),
                ("order", models.PositiveIntegerField(default=0, help_text="Sort order within a group.")),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Site text",
                "verbose_name_plural": "Site text",
                "ordering": ["group", "order", "key"],
            },
        ),
    ]
