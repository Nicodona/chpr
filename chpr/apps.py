from django.apps import AppConfig


class ChprConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "chpr"
    verbose_name = "CHPR Resources Hub"

    def ready(self):
        from . import signals  # noqa: F401 — connect upload → HTML conversion
