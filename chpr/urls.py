"""URL configuration for the chpr app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ContactMessageViewSet,
    LoginView,
    LogoutView,
    MeView,
    ProjectViewSet,
    ResourceCommentViewSet,
    ResourceViewSet,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("resources", ResourceViewSet, basename="resource")
router.register("comments", ResourceCommentViewSet, basename="comment")
router.register("contact", ContactMessageViewSet, basename="contact")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
]