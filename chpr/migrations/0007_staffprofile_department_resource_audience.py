from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chpr', '0006_faq_sitevisit_resourceinteraction'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffprofile',
            name='department',
            field=models.CharField(
                blank=True,
                choices=[('lab', 'Lab'), ('data', 'Data Team'), ('admin', 'Admin'), ('volunteer', 'Volunteer')],
                default='',
                help_text='Which team the user belongs to. Controls which targeted resources they see.',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='resource',
            name='audience',
            field=models.CharField(
                choices=[
                    ('all', 'Everyone (public)'),
                    ('staff', 'All Staff'),
                    ('lab', 'Lab only'),
                    ('data', 'Data Team only'),
                    ('admin', 'Admin only'),
                    ('volunteer', 'Volunteer only'),
                ],
                default='all',
                help_text="Who this resource is shown to. 'Everyone' is public; the rest require a matching department.",
                max_length=20,
            ),
        ),
    ]
