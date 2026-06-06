"""DRF serializers for the CHPR Resources Hub API."""
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import ContactMessage, Project, Resource, ResourceComment, StaffProfile


class ProjectSerializer(serializers.ModelSerializer):
    resource_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "slug", "name", "short_name", "description",
            "color", "light_color", "status", "status_display",
            "order", "resource_count", "created_at", "updated_at",
        ]


class ResourceSerializer(serializers.ModelSerializer):
    project_slug = serializers.SlugField(source="project.slug", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    type_label = serializers.CharField(source="get_type_key_display", read_only=True)
    activity_label = serializers.CharField(source="get_activity_display", read_only=True)
    is_pool_test = serializers.BooleanField(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Resource
        fields = [
            "id", "project", "project_slug", "project_name",
            "name", "type_key", "type_label", "activity", "activity_label",
            "description", "file", "file_url",
            "test_platform", "sample_type", "pool_size", "is_pool_test",
            "posted_by", "created_at", "updated_at",
        ]
        extra_kwargs = {
            "file": {"write_only": True, "required": False},
        }

    def get_file_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class ResourceCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResourceComment
        fields = ["id", "resource", "author_name", "author_role", "body", "created_at"]


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "team", "message", "resource", "handled", "created_at"]
        read_only_fields = ["handled", "created_at"]


# ---------------------------------------------------------------------------
# Auth serializers
# ---------------------------------------------------------------------------

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"],
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError("Invalid credentials.", code="authorization")
        if not user.is_active:
            raise serializers.ValidationError("This account is disabled.", code="authorization")
        attrs["user"] = user
        return attrs


class UserSerializer(serializers.ModelSerializer):
    """Read-only user info returned after login."""
    role = serializers.SerializerMethodField()

    class Meta:
        from django.contrib.auth.models import User
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff", "role"]

    def get_role(self, user):
        try:
            return user.staff_profile.role
        except Exception:
            return None