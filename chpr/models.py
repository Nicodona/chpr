"""
Data models for the CHPR Resources Hub.

Mirrors the static mockup's domain:
  - Project        : a programme (BREATHE, PROMPT TB) that is "active" or "completed".
  - Resource       : an uploadable document/video/poster/pool-test belonging to a project.
  - ResourceComment: staff comments on a resource.
  - ContactMessage : a "Contact us" enquiry from a site visitor.

The Resource model carries the file upload plus pool-testing fields (Expert Pool,
Trunat, HIV Pool) so the lab/testing resources can be captured and filtered.
"""
from django.db import models

# models.py  (add at the bottom — all existing code stays)
from django.contrib.auth.models import User

class StaffProfile(models.Model):
    """
    Extends Django's built-in User with a role field.
    Create via Django admin: Admin > Staff profiles > Add.
    Every User that should access write endpoints needs one of these.
    """

    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"       # full CRUD + Django admin access
        STAFF = "staff", "Staff"       # CRUD on resources only

    class Department(models.TextChoices):
        LAB = "lab", "Lab"
        DATA = "data", "Data Team"
        ADMIN = "admin", "Admin"
        VOLUNTEER = "volunteer", "Volunteer"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="staff_profile")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.STAFF)
    department = models.CharField(
        max_length=20, choices=Department.choices, blank=True, default="",
        help_text="Which team the user belongs to. Controls which targeted resources they see.",
    )

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN
class Project(models.Model):
    """A CHPR programme. Status is managed from the Django admin (active/completed)."""

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        COMPLETED = "completed", "Completed"

    slug = models.SlugField(max_length=60, unique=True, help_text="e.g. 'breathe', 'prompttb'")
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=9, default="#0054A6", help_text="Accent colour (hex)")
    light_color = models.CharField(max_length=9, default="#e6f1fb", help_text="Light accent (hex)")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    order = models.PositiveIntegerField(default=0, help_text="Display order on the hub")
    is_active = models.BooleanField(default=True, help_text="Inactive projects are hidden from the public site.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name

    @property
    def resource_count(self):
        return self.resources.count()


class Resource(models.Model):
    """
    A resource attached to a project. Supports a file upload (PDF, video, image)
    and classifies the resource by type — including the three pool-testing
    categories used for lab testing resources.
    """

    class Type(models.TextChoices):
        ALGORITHM = "alg", "Algorithm"
        JOB_AID = "job", "Job Aid"
        VIDEO = "vid", "Video"
        POSTER = "pos", "Poster"
        EXPERT_POOL = "expert", "Expert Pool"
        TRUNAT = "trunat", "Trunat"
        HIV_POOL = "hiv", "HIV Pool"

    class Activity(models.TextChoices):
        HEALTH_FACILITY = "hf", "Health Facilities"
        HEALTH_CAMP = "hc", "Health Camps"
        CROSS = "cr", "All"

    class Audience(models.TextChoices):
        ALL = "all", "Everyone (public)"
        ALL_STAFF = "staff", "All Staff"
        LAB = "lab", "Lab only"
        DATA = "data", "Data Team only"
        ADMIN = "admin", "Admin only"
        VOLUNTEER = "volunteer", "Volunteer only"

    # Pool-testing type keys, used for filtering "Pool Tests" together.
    POOL_TYPES = (Type.EXPERT_POOL, Type.TRUNAT, Type.HIV_POOL)

    project = models.ForeignKey(Project, related_name="resources", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    type_key = models.CharField(max_length=20, choices=Type.choices, default=Type.JOB_AID)
    activity = models.CharField(max_length=2, choices=Activity.choices, default=Activity.HEALTH_FACILITY)
    audience = models.CharField(
        max_length=20, choices=Audience.choices, default=Audience.ALL,
        help_text="Who this resource is shown to. 'Everyone' is public; the rest require a matching department.",
    )
    description = models.TextField(blank=True)

    # ---- Upload ----
    file = models.FileField(upload_to="resources/%Y/%m/", blank=True, null=True)

    # ---- Pool-testing fields (only meaningful for pool-test types) ----
    test_platform = models.CharField(
        max_length=100, blank=True,
        help_text="Testing platform, e.g. GeneXpert, Truenat, Abbott m2000",
    )
    sample_type = models.CharField(
        max_length=100, blank=True,
        help_text="Specimen type, e.g. sputum, plasma, whole blood",
    )
    pool_size = models.PositiveIntegerField(
        null=True, blank=True,
        help_text="Number of specimens combined per pooled run",
    )

    # ---- Attribution ----
    posted_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def is_pool_test(self):
        return self.type_key in self.POOL_TYPES

    @property
    def type_label(self):
        return self.get_type_key_display()


class ResourceFile(models.Model):
    """A language-specific file for a Resource (EN / FR / Pidgin / Fulfulde).

    A resource can offer the same material in several languages; the frontend
    shows a language switcher and serves the matching file. Resources with a
    single language simply have one ResourceFile. The legacy ``Resource.file``
    is kept for backward compatibility; new uploads go here.
    """

    class Language(models.TextChoices):
        ENGLISH = "en", "English"
        FRENCH = "fr", "French"
        PIDGIN = "pcm", "Pidgin"
        FULFULDE = "ful", "Fulfulde"

    resource = models.ForeignKey(Resource, related_name="files", on_delete=models.CASCADE)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    file = models.FileField(upload_to="resources/%Y/%m/")
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        unique_together = [("resource", "language")]

    def __str__(self):
        return f"{self.resource_id} [{self.language}]"


class ResourceComment(models.Model):
    """A staff comment on a resource (open thread in the mockup)."""

    resource = models.ForeignKey(Resource, related_name="comments", on_delete=models.CASCADE)
    author_name = models.CharField(max_length=150)
    author_role = models.CharField(max_length=50, blank=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.author_name} on {self.resource_id}"


class ContactMessage(models.Model):
    """A 'Contact us' enquiry submitted from the public site."""

    name = models.CharField(max_length=150)
    email = models.EmailField()
    team = models.CharField(max_length=100, blank=True)
    message = models.TextField()
    resource = models.ForeignKey(
        Resource, related_name="contact_messages", on_delete=models.SET_NULL,
        null=True, blank=True,
    )
    handled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} <{self.email}>"


class QuizQuestion(models.Model):
    """MCQ question for a resource's 'Test your understanding' quiz."""

    OPTION_CHOICES = [("a", "A"), ("b", "B"), ("c", "C"), ("d", "D")]

    resource = models.ForeignKey(
        Resource, on_delete=models.CASCADE, related_name="quiz_questions"
    )
    question = models.TextField()
    option_a = models.CharField(max_length=500)
    option_b = models.CharField(max_length=500)
    option_c = models.CharField(max_length=500)
    option_d = models.CharField(max_length=500)
    correct = models.CharField(max_length=1, choices=OPTION_CHOICES)
    explanation = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"Q{self.order}: {self.question[:60]}"


class ReadingProgress(models.Model):
    """Tracks how far an authenticated user has read a resource."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="reading_progress")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="reading_progress")
    progress = models.PositiveSmallIntegerField(default=0)
    seen_pages = models.JSONField(default=list, blank=True)
    completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [("user", "resource")]
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.user.username} – {self.resource_id} – {self.progress}%"


class QuizAttempt(models.Model):
    """Records a completed quiz attempt for an authenticated user."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="quiz_attempts")
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="quiz_attempts")
    score = models.PositiveSmallIntegerField(default=0)
    total = models.PositiveSmallIntegerField(default=0)
    percent = models.PositiveSmallIntegerField(default=0)
    passed = models.BooleanField(default=False)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-attempted_at"]

    def __str__(self):
        return f"{self.user.username} – {self.resource_id} – {self.percent}%"


class FAQ(models.Model):
    """Frequently Asked Questions managed by admins, visible to all."""
    question = models.CharField(max_length=500)
    answer = models.TextField()
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "created_at"]
        verbose_name = "FAQ"
        verbose_name_plural = "FAQs"

    def __str__(self):
        return self.question[:80]


class SiteVisit(models.Model):
    """Tracks every page visit for traffic analytics."""
    USER_TYPE_CHOICES = [
        ("visitor", "Visitor"),
        ("staff", "Staff"),
        ("admin", "Admin"),
    ]
    timestamp = models.DateTimeField(auto_now_add=True)
    user_type = models.CharField(max_length=10, choices=USER_TYPE_CHOICES, default="visitor")
    page = models.CharField(max_length=500, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    session_key = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.user_type} @ {self.page} [{self.timestamp:%Y-%m-%d %H:%M}]"


class ResourceInteraction(models.Model):
    """Tracks views and shares per resource for analytics."""
    INTERACTION_CHOICES = [
        ("view", "View"),
        ("share", "Share"),
    ]
    resource = models.ForeignKey(Resource, on_delete=models.CASCADE, related_name="interactions")
    interaction_type = models.CharField(max_length=10, choices=INTERACTION_CHOICES, default="view")
    timestamp = models.DateTimeField(auto_now_add=True)
    user_type = models.CharField(max_length=10, default="visitor")
    session_key = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.interaction_type} on resource {self.resource_id}"
