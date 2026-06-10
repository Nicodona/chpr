"""Django admin registrations for the CHPR Resources Hub."""
from django.contrib import admin

from .models import FAQ, ContactMessage, Project, Resource, ResourceComment, ResourceInteraction, SiteVisit, StaffProfile


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
    list_display = ("name", "slug", "status", "resource_count", "order")
    list_editable = ("status", "order")
    list_filter = ("status",)
    search_fields = ("name", "slug", "description")
    prepopulated_fields = {"slug": ("short_name",)}
    inlines = [ResourceInline]


@admin.register(Resource)
class ResourceAdmin(admin.ModelAdmin):
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
