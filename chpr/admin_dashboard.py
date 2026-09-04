"""Context for the Unfold admin dashboard (templates/admin/index.html)."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from .models import FAQ, ContactMessage, Project, Resource, SiteText, SiteVisit


def dashboard_callback(request, context):
    """Inject the stat cards and recent-activity lists shown on /admin/."""
    User = get_user_model()
    week_ago = timezone.now() - timedelta(days=7)

    context["chpr_stats"] = [
        {"title": "Resources", "value": Resource.objects.count(), "icon": "description",
         "link": reverse("admin:chpr_resource_changelist")},
        {"title": "Projects", "value": Project.objects.count(), "icon": "workspaces",
         "link": reverse("admin:chpr_project_changelist")},
        {"title": "Users", "value": User.objects.count(), "icon": "person",
         "link": reverse("admin:auth_user_changelist")},
        {"title": "Unread messages", "value": ContactMessage.objects.filter(handled=False).count(),
         "icon": "mail", "link": reverse("admin:chpr_contactmessage_changelist")},
        {"title": "FAQs", "value": FAQ.objects.count(), "icon": "help",
         "link": reverse("admin:chpr_faq_changelist")},
        {"title": "Editable texts", "value": SiteText.objects.count(), "icon": "translate",
         "link": reverse("admin:chpr_sitetext_changelist")},
        {"title": "Visits (7 days)", "value": SiteVisit.objects.filter(timestamp__gte=week_ago).count(),
         "icon": "visibility", "link": reverse("admin:chpr_sitevisit_changelist")},
    ]
    context["chpr_recent_resources"] = list(Resource.objects.order_by("-created_at")[:6])
    context["chpr_recent_messages"] = list(ContactMessage.objects.order_by("-created_at")[:6])
    return context
