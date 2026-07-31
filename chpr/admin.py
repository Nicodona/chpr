"""Django admin registrations for the CHPR Resources Hub."""
from django.contrib import admin

from .models import FAQ, ContactMessage, Project, QuizQuestion, Resource, ResourceComment, ResourceFile, ResourceHTML, ResourceInteraction, SiteConfig, SiteVisit, StaffProfile


@admin.register(StaffProfile)
class StaffProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "department")
    list_filter = ("role", "department")
    list_editable = ("role", "department")
    search_fields = ("user__username", "user__email", "user__first_name", "user__last_name")
    autocomplete_fields = ("user",)


class ResourceInline(admin.TabularInline):
    model = Resource
    extra = 0
    fields = ("name", "type_key", "activity", "file")
    show_change_link = True


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "status", "resource_count", "order", "has_logo")
    list_editable = ("status", "order")
    list_filter = ("status",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("short_name",)}
    inlines = [ResourceInline]
    fields = ("slug", "name", "short_name", "description", "color", "light_color",
              "logo", "status", "order", "is_active")

    @admin.display(boolean=True, description="Logo")
    def has_logo(self, obj):
        return bool(obj.logo)


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "nav_projects_count", "home_projects_count", "updated_at")

    def has_add_permission(self, request):
        # Singleton — only the one row (created on first access).
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class ResourceFileInline(admin.TabularInline):
    model = ResourceFile
    extra = 1
    fields = ("language", "file", "order")


class QuizQuestionInline(admin.StackedInline):
    model = QuizQuestion
    extra = 0
    classes = ("collapse",)
    fields = (
        ("question_type", "order", "auto_generated"),
        "question",
        ("option_a", "option_b"),
        ("option_c", "option_d"),
        ("correct", "answer_text"),
        "explanation",
    )


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
    inlines = [ResourceFileInline, QuizQuestionInline]
    actions = ("regenerate_quiz",)

    @admin.action(description="Regenerate quiz from document (keeps hand-written questions)")
    def regenerate_quiz(self, request, queryset):
        from . import quiz_gen
        made = sum(quiz_gen.generate_for_resource(r, replace_auto=True) for r in queryset)
        self.message_user(request, f"Generated {made} question(s) across {queryset.count()} resource(s).")
    list_display = ("name", "project", "type_key", "activity", "audience", "is_pool_test", "created_at")
    list_filter = ("type_key", "activity", "audience", "project")
    search_fields = ("name", "description", "posted_by")
    autocomplete_fields = ("project",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("project", "name", "type_key", "activity", "audience", "description", "file")}),
        ("Pool testing", {
            "classes": ("collapse",),
            "fields": ("test_platform", "sample_type", "pool_size"),
            "description": "Only relevant for Expert Pool / Trunat / HIV Pool resources.",
        }),
        ("Attribution", {"fields": ("posted_by", "created_at", "updated_at")}),
    )

    @admin.display(boolean=True, description="Pool test")
    def is_pool_test(self, obj):
        return obj.is_pool_test


@admin.register(ResourceHTML)
class ResourceHTMLAdmin(admin.ModelAdmin):
    """Converted web versions of PDF/DOCX uploads (read-mostly; use the
    action to force a re-conversion after a library upgrade or fix)."""
    list_display = ("resource", "language", "status", "page_count", "word_count", "updated_at")
    list_filter = ("status", "language")
    search_fields = ("resource__name", "source_name", "error")
    readonly_fields = ("resource", "resource_file", "language", "source_name",
                       "status", "error", "page_count", "word_count",
                       "created_at", "updated_at")
    exclude = ("html",)
    actions = ("reconvert",)

    @admin.action(description="Re-convert selected documents")
    def reconvert(self, request, queryset):
        from . import doc_convert
        done = 0
        for row in queryset.select_related("resource", "resource_file"):
            if row.resource_file:
                doc_convert.refresh_for_resource_file(row.resource_file, force=True)
            else:
                doc_convert.refresh_for_legacy_file(row.resource, force=True)
            done += 1
        self.message_user(request, f"Re-converted {done} document(s).")

    def has_add_permission(self, request):
        return False  # rows are created by the conversion pipeline


@admin.register(QuizQuestion)
class QuizQuestionAdmin(admin.ModelAdmin):
    """Edit auto-generated or hand-written quiz questions.
    Un-tick 'auto generated' on a question you've rewritten so a quiz
    regeneration never deletes it."""
    list_display = ("question_short", "resource", "question_type", "correct_display",
                    "auto_generated", "order")
    list_filter = ("question_type", "auto_generated", "resource__project")
    search_fields = ("question", "resource__name", "answer_text")
    autocomplete_fields = ("resource",)
    list_editable = ("order",)
    fields = (
        "resource",
        ("question_type", "order", "auto_generated"),
        "question",
        ("option_a", "option_b"),
        ("option_c", "option_d"),
        ("correct", "answer_text"),
        "explanation",
    )

    @admin.display(description="Question")
    def question_short(self, obj):
        return obj.question[:80]

    @admin.display(description="Answer")
    def correct_display(self, obj):
        if obj.question_type == QuizQuestion.QType.SHORT:
            return obj.answer_text[:40]
        return obj.correct.upper()


@admin.register(ResourceComment)
class ResourceCommentAdmin(admin.ModelAdmin):
    list_display = ("author_name", "author_role", "resource", "created_at")
    search_fields = ("author_name", "body")
    list_filter = ("author_role",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "team", "handled", "created_at")
    list_filter = ("handled", "team")
    list_editable = ("handled",)
    search_fields = ("name", "email", "message")
    readonly_fields = ("created_at",)


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    list_display = ("question_short", "order", "is_active", "created_at")
    list_editable = ("order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("question", "answer")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Question")
    def question_short(self, obj):
        return obj.question[:80]


@admin.register(SiteVisit)
class SiteVisitAdmin(admin.ModelAdmin):
    list_display = ("user_type", "page", "ip_address", "timestamp")
    list_filter = ("user_type",)
    readonly_fields = ("timestamp",)
    date_hierarchy = "timestamp"


@admin.register(ResourceInteraction)
class ResourceInteractionAdmin(admin.ModelAdmin):
    list_display = ("interaction_type", "resource", "user_type", "timestamp")
    list_filter = ("interaction_type", "user_type")
    readonly_fields = ("timestamp",)
    date_hierarchy = "timestamp"
