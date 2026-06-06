"""Django admin registrations for the CHPR Resources Hub."""
from django.contrib import admin

from .models import ContactMessage, Project, Resource, ResourceComment


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
    list_display = ("name", "project", "type_key", "activity", "is_pool_test", "created_at")
    list_filter = ("type_key", "activity", "project")
    search_fields = ("name", "description", "posted_by")
    autocomplete_fields = ("project",)
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("project", "name", "type_key", "activity", "description", "file")}),
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
