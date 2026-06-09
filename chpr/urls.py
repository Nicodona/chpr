"""URL configuration for the chpr app."""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AnalyticsView,
    ChangePasswordView,
    ContactMessageViewSet,
    CreateUserView,
    FAQViewSet,
    ListUsersView,
    LoginView,
    LogoutView,
    MeView,
    ProjectViewSet,
    QuizQuestionViewSet,
    ResourceCommentViewSet,
    ResourceViewSet,
    TrackInteractionView,
    TrackVisitView,
)

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("resources", ResourceViewSet, basename="resource")
router.register("comments", ResourceCommentViewSet, basename="comment")
router.register("contact", ContactMessageViewSet, basename="contact")
router.register("quiz-questions", QuizQuestionViewSet, basename="quiz-question")
router.register("faq", FAQViewSet, basename="faq")

urlpatterns = [
    path("", include(router.urls)),
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/create-user/", CreateUserView.as_view(), name="auth-create-user"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
    path("auth/users/", ListUsersView.as_view(), name="auth-users"),
    path("analytics/", AnalyticsView.as_view(), name="analytics"),
    path("analytics/track/", TrackVisitView.as_view(), name="analytics-track"),
    path("analytics/interaction/", TrackInteractionView.as_view(), name="analytics-interaction"),
]