"""DRF serializers for the CHPR Resources Hub API."""
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from .models import FAQ, ContactMessage, Project, QuizQuestion, Resource, ResourceComment, StaffProfile


class ProjectSerializer(serializers.ModelSerializer):
    resource_count = serializers.IntegerField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "slug", "name", "short_name", "description",
            "color", "light_color", "status", "status_display",
            "order", "is_active", "resource_count", "created_at", "updated_at",
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
        read_only_fields = ["created_at"]


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
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_staff", "role"]

    def get_role(self, user):
        try:
            return user.staff_profile.role
        except Exception:
            pass
        # Django superusers created via createsuperuser have no StaffProfile —
        # treat them as admins so the frontend shows the correct UI.
        if user.is_superuser:
            return StaffProfile.Role.ADMIN
        return None


class CreateUserSerializer(serializers.Serializer):
    """Validated input for admin-created accounts."""
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    role = serializers.ChoiceField(choices=StaffProfile.Role.choices, default=StaffProfile.Role.STAFF)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    """Validated input for changing a user's own password."""
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        try:
            validate_password(attrs["new_password"], self.context["request"].user)
        except Exception as exc:
            raise serializers.ValidationError({"new_password": list(exc.messages)})
        return attrs


# ---------------------------------------------------------------------------
# Quiz serializers
# ---------------------------------------------------------------------------

class QuizQuestionAdminSerializer(serializers.ModelSerializer):
    """Full serializer for admins — includes correct answer and explanation."""

    class Meta:
        model = QuizQuestion
        fields = [
            "id", "resource", "question",
            "option_a", "option_b", "option_c", "option_d",
            "correct", "explanation", "order",
        ]


class QuizQuestionPublicSerializer(serializers.ModelSerializer):
    """Public serializer — omits correct answer and explanation."""

    class Meta:
        model = QuizQuestion
        fields = [
            "id", "resource", "question",
            "option_a", "option_b", "option_c", "option_d",
            "order",
        ]


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQ
        fields = ["id", "question", "answer", "order", "is_active", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]