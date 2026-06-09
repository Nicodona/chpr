from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('chpr', '0005_add_project_is_active'),
    ]

    operations = [
        migrations.CreateModel(
            name='FAQ',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('question', models.CharField(max_length=500)),
                ('answer', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'FAQ',
                'verbose_name_plural': 'FAQs',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='SiteVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('user_type', models.CharField(
                    choices=[('visitor', 'Visitor'), ('staff', 'Staff'), ('admin', 'Admin')],
                    default='visitor',
                    max_length=10,
                )),
                ('page', models.CharField(blank=True, max_length=500)),
                ('ip_address', models.GenericIPAddressField(blank=True, null=True)),
                ('session_key', models.CharField(blank=True, max_length=64)),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
        migrations.CreateModel(
            name='ResourceInteraction',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('interaction_type', models.CharField(
                    choices=[('view', 'View'), ('share', 'Share')],
                    default='view',
                    max_length=10,
                )),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('user_type', models.CharField(default='visitor', max_length=10)),
                ('session_key', models.CharField(blank=True, max_length=64)),
                ('resource', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='interactions',
                    to='chpr.resource',
                )),
            ],
            options={
                'ordering': ['-timestamp'],
            },
        ),
    ]
