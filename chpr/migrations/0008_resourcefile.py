from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("chpr", "0007_staffprofile_department_resource_audience"),
    ]

    operations = [
        migrations.CreateModel(
            name="ResourceFile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("language", models.CharField(choices=[("en", "English"), ("fr", "French"), ("pcm", "Pidgin"), ("ful", "Fulfulde")], default="en", max_length=5)),
                ("file", models.FileField(upload_to="resources/%Y/%m/")),
                ("order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("resource", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="files", to="chpr.resource")),
            ],
            options={
                "ordering": ["order", "id"],
                "unique_together": {("resource", "language")},
            },
        ),
    ]
