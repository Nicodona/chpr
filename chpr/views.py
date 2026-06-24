"""DRF viewsets and auth views for the CHPR Resources Hub API."""
import secrets
import string
from collections import defaultdict
from datetime import timedelta

from django.conf import settings as django_settings
from django.contrib.auth import login, logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import FAQ, ContactMessage, Project, QuizAttempt, QuizQuestion, ReadingProgress, Resource, ResourceComment, ResourceInteraction, SiteVisit, StaffProfile
from .serializers import (
    ChangePasswordSerializer,
    ContactMessageSerializer,
    CreateUserSerializer,
    FAQSerializer,
    LoginSerializer,
    ProjectSerializer,
    QuizQuestionAdminSerializer,
    QuizQuestionPublicSerializer,
    ResourceCommentSerializer,
    ResourceSerializer,
    UserSerializer,
)

# Shared authentication backends used on all views that need auth.
AUTH_BACKENDS = [SessionAuthentication, TokenAuthentication]


def _is_admin(user):
    """Return True if the user has admin privileges.

    Django superusers are treated as admins even when they have no StaffProfile
    (e.g. accounts created via createsuperuser).
    """
    if getattr(user, "is_superuser", False):
        return True
    try:
        return user.staff_profile.is_admin
    except Exception:
        return False


def _user_department(user):
    """Return the user's StaffProfile department key, or '' if none."""
    try:
        return user.staff_profile.department or ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# Auth views
# ---------------------------------------------------------------------------

class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: { "username": "…", "password": "…" }
    Returns the user object and a DRF token.
    Also sets a session so browser clients can use cookie-based auth.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]

        # Log into the Django session (sets the session cookie).
        login(request, user)

        # Also issue / retrieve a DRF token so API clients can use Authorization: Token <key>.
        token, _ = Token.objects.get_or_create(user=user)

        return Response(
            {
                "token": token.key,
                "user": UserSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Invalidates the current session and deletes the DRF token.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Delete the token so it can't be reused.
        try:
            request.user.auth_token.delete()
        except Exception:
            pass
        logout(request)
        return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the currently authenticated user's info.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Resource viewsets
# ---------------------------------------------------------------------------

class ProjectViewSet(viewsets.ModelViewSet):
    """
    CRUD for projects. Looked up by slug, e.g. /api/projects/breathe/.
    Read operations are public (inactive projects hidden from non-admins).
    Writes (create/update/delete) require admin privileges.
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    lookup_field = "slug"
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        if not (self.request.user.is_authenticated and _is_admin(self.request.user)):
            qs = qs.filter(is_active=True)
        return qs

    def perform_create(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        serializer.save()

    def perform_update(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        instance.delete()


class ResourceViewSet(viewsets.ModelViewSet):
    """
    CRUD for resources (supports multipart file upload on create/update).
    Read operations are public; writes require login.

    Query params:
      ?project=<slug>     filter by project slug
      ?type=<type_key>    filter by a single type (alg, job, vid, pos, expert, trunat, hiv)
      ?type=pool          filter to all pool-testing types at once
      ?activity=<hf|hc>   filter by setting
      ?search=<text>      match name / description / project name
    """
    queryset = Resource.objects.select_related("project").prefetch_related("files").all()
    serializer_class = ResourceSerializer
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        # ---- Audience visibility ----
        # Admins/superusers see everything (so they can manage). Other users
        # see public resources, all-staff resources, and resources targeted at
        # their own department. Anonymous visitors see only public resources.
        user = self.request.user
        if not (user.is_authenticated and _is_admin(user)):
            visible = Q(audience=Resource.Audience.ALL)
            if user.is_authenticated:
                visible |= Q(audience=Resource.Audience.ALL_STAFF)
                dept = _user_department(user)
                if dept:
                    visible |= Q(audience=dept)
            qs = qs.filter(visible)

        project = params.get("project")
        if project:
            qs = qs.filter(project__slug=project) if not project.isdigit() else qs.filter(project_id=project)

        type_key = params.get("type")
        if type_key == "pool":
            qs = qs.filter(type_key__in=Resource.POOL_TYPES)
        elif type_key:
            qs = qs.filter(type_key=type_key)

        activity = params.get("activity")
        if activity:
            qs = qs.filter(activity=activity)

        search = params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(description__icontains=search)
                | Q(project__name__icontains=search)
            )
        return qs

    @action(
        detail=True,
        methods=["post"],
        url_path="submit-quiz",
        permission_classes=[IsAuthenticated],
        authentication_classes=AUTH_BACKENDS,
    )
    def submit_quiz(self, request, pk=None):
        """
        POST /api/resources/<id>/submit-quiz/
        Body: { "answers": { "<question_id>": "a"/"b"/"c"/"d", ... } }
        Returns: { score, total, percent, results: [...] }
        """
        resource = self.get_object()
        questions = list(resource.quiz_questions.all())

        if not questions:
            return Response({"score": 0, "total": 0, "percent": 0, "results": []})

        answers = request.data.get("answers", {})
        score = 0
        results = []

        for q in questions:
            q_id = str(q.id)
            your_answer = answers.get(q_id, None)
            is_correct = your_answer == q.correct
            if is_correct:
                score += 1
            results.append({
                "id": q.id,
                "question": q.question,
                "options": {
                    "a": q.option_a,
                    "b": q.option_b,
                    "c": q.option_c,
                    "d": q.option_d,
                },
                "your_answer": your_answer,
                "correct": q.correct,
                "is_correct": is_correct,
                "explanation": q.explanation,
            })

        total = len(questions)
        percent = round((score / total) * 100) if total else 0

        if request.user.is_authenticated:
            QuizAttempt.objects.create(
                user=request.user,
                resource=resource,
                score=score,
                total=total,
                percent=percent,
                passed=(percent >= 70),
            )

        return Response({"score": score, "total": total, "percent": percent, "results": results})

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="my-progress",
        authentication_classes=AUTH_BACKENDS,
        permission_classes=[IsAuthenticated],
    )
    def my_progress(self, request, pk=None):
        """GET or upsert reading progress for the current user."""
        resource = self.get_object()
        if request.method == "GET":
            try:
                p = ReadingProgress.objects.get(user=request.user, resource=resource)
                return Response({"progress": p.progress, "seen_pages": p.seen_pages, "completed": p.completed})
            except ReadingProgress.DoesNotExist:
                return Response({"progress": 0, "seen_pages": [], "completed": False})

        obj, _ = ReadingProgress.objects.get_or_create(user=request.user, resource=resource)
        obj.progress   = int(request.data.get("progress",   obj.progress))
        obj.seen_pages = request.data.get("seen_pages",     obj.seen_pages)
        obj.completed  = bool(request.data.get("completed", obj.completed))
        obj.save()
        return Response({"progress": obj.progress, "seen_pages": obj.seen_pages, "completed": obj.completed})

    @action(
        detail=True,
        methods=["get"],
        url_path="my-attempts",
        authentication_classes=AUTH_BACKENDS,
        permission_classes=[IsAuthenticated],
    )
    def my_attempts(self, request, pk=None):
        """Return all quiz attempts by the current user for this resource."""
        resource = self.get_object()
        attempts = QuizAttempt.objects.filter(user=request.user, resource=resource)
        data = [
            {
                "score": a.score,
                "total": a.total,
                "percent": a.percent,
                "passed": a.passed,
                "attempted_at": a.attempted_at.isoformat(),
            }
            for a in attempts
        ]
        return Response(data)


class ResourceCommentViewSet(viewsets.ModelViewSet):
    """
    Comments. Filter by ?resource=<id>.
    Read operations are public; writes require login.
    """
    queryset = ResourceComment.objects.all()
    serializer_class = ResourceCommentSerializer
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        resource = self.request.query_params.get("resource")
        if resource:
            qs = qs.filter(resource_id=resource)
        return qs


class CreateUserView(APIView):
    """
    POST /api/auth/create-user/
    Admin-only. Creates a staff account, generates a random password,
    and emails the credentials to the new user.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _is_admin(request.user):
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        # Generate a random 12-character password.
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = "".join(secrets.choice(alphabet) for _ in range(12))

        user = User.objects.create_user(
            username=d["username"],
            email=d["email"],
            password=password,
            first_name=d.get("first_name", ""),
            last_name=d.get("last_name", ""),
        )
        StaffProfile.objects.create(
            user=user, role=d["role"], department=d.get("department", ""),
        )

        site_url = getattr(django_settings, "SITE_URL", "")
        full_name = user.get_full_name() or user.username
        send_mail(
            subject="Your CHPR Resources Hub account",
            message=(
                f"Hello {full_name},\n\n"
                "An account has been created for you on the CHPR Resources Hub.\n\n"
                f"Login URL: {site_url}/login\n"
                f"Username:  {user.username}\n"
                f"Password:  {password}\n\n"
                "Please log in and change your password as soon as possible.\n"
                f"Change password: {site_url}/account/change-password\n\n"
                "CHPR Resources Hub"
            ),
            from_email=django_settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )

        return Response(
            UserSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Authenticated users change their own password.
    Body: { current_password, new_password, confirm_password }
    The session remains valid after the change.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        request.user.set_password(serializer.validated_data["new_password"])
        request.user.save()

        # Keep the Django session alive so the user isn't logged out.
        update_session_auth_hash(request, request.user)

        return Response({"detail": "Password changed successfully."})


class ListUsersView(APIView):
    """
    GET /api/auth/users/
    Admin-only. Returns all staff user accounts.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            return Response(
                {"detail": "Admin access required."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Include superusers (no StaffProfile) AND staff-profile accounts.
        users = (
            User.objects.filter(
                Q(staff_profile__isnull=False) | Q(is_superuser=True)
            )
            .select_related("staff_profile")
            .order_by("username")
            .distinct()
        )
        return Response(UserSerializer(users, many=True, context={"request": request}).data)


class QuizQuestionViewSet(viewsets.ModelViewSet):
    """
    CRUD for quiz questions.
    Filter by ?resource=<id>.
    Read operations are public; writes are admin-only.
    """
    queryset = QuizQuestion.objects.all()
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        resource = self.request.query_params.get("resource")
        if resource:
            qs = qs.filter(resource_id=resource)
        return qs

    def get_serializer_class(self):
        if _is_admin(self.request.user):
            return QuizQuestionAdminSerializer
        return QuizQuestionPublicSerializer

    def _check_admin(self):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")

    def perform_create(self, serializer):
        self._check_admin()
        serializer.save()

    def perform_update(self, serializer):
        self._check_admin()
        serializer.save()

    def perform_destroy(self, instance):
        self._check_admin()
        instance.delete()


class ContactMessageViewSet(viewsets.ModelViewSet):
    """
    Contact-us enquiries.
    - Anyone can POST (submit an enquiry).
    - Only authenticated staff can list/retrieve/update/delete.
    """
    queryset = ContactMessage.objects.all()
    serializer_class = ContactMessageSerializer
    authentication_classes = AUTH_BACKENDS

    def get_permissions(self):
        if self.action == "create":
            return [AllowAny()]
        return [IsAuthenticated()]


# ---------------------------------------------------------------------------
# FAQ
# ---------------------------------------------------------------------------

class FAQViewSet(viewsets.ModelViewSet):
    """
    FAQs. Public reads; admin-only writes.
    Non-admins only see active FAQs.
    """
    serializer_class = FAQSerializer
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        if self.request.user.is_authenticated and _is_admin(self.request.user):
            return FAQ.objects.all()
        return FAQ.objects.filter(is_active=True)

    def perform_create(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        serializer.save()

    def perform_update(self, serializer):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_admin(self.request.user):
            raise PermissionDenied("Admin access required.")
        instance.delete()


# ---------------------------------------------------------------------------
# Analytics – tracking + reporting
# ---------------------------------------------------------------------------

def _get_client_ip(request):
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _get_date_range(period):
    now = timezone.now()
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "this_week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_7_days":
        start = now - timedelta(days=7)
    elif period == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif period == "last_30_days":
        start = now - timedelta(days=30)
    elif period == "three_months":
        start = now - timedelta(days=90)
    else:
        start = now - timedelta(days=7)
    return start, now


class TrackVisitView(APIView):
    """
    POST /api/analytics/track/
    Public. Records a page visit.
    Body: { page, user_type, session_key }
    """
    permission_classes = [AllowAny]
    # No authentication: this is a public, fire-and-forget beacon that takes
    # user_type from the body and never reads request.user. Using
    # SessionAuthentication here would enforce CSRF and silently reject every
    # POST that carries a logged-in session cookie (dropping staff/admin events).
    authentication_classes = []

    def post(self, request):
        SiteVisit.objects.create(
            user_type=request.data.get("user_type", "visitor"),
            page=request.data.get("page", "")[:500],
            ip_address=_get_client_ip(request),
            session_key=request.data.get("session_key", "")[:64],
        )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class TrackInteractionView(APIView):
    """
    POST /api/analytics/interaction/
    Public. Records a resource view or share.
    Body: { resource, interaction_type, user_type, session_key }
    """
    permission_classes = [AllowAny]
    # No authentication — see TrackVisitView: avoids CSRF rejecting logged-in
    # users' beacons. user_type is supplied by the client.
    authentication_classes = []

    def post(self, request):
        resource_id = request.data.get("resource")
        interaction_type = request.data.get("interaction_type", "view")
        if not resource_id:
            return Response({"error": "resource required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            resource = Resource.objects.get(pk=resource_id)
        except Resource.DoesNotExist:
            return Response({"error": "not found"}, status=status.HTTP_404_NOT_FOUND)
        ResourceInteraction.objects.create(
            resource=resource,
            interaction_type=interaction_type,
            user_type=request.data.get("user_type", "visitor"),
            session_key=request.data.get("session_key", "")[:64],
        )
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


class AnalyticsView(APIView):
    """
    GET /api/analytics/?period=last_7_days
    Admin-only. Returns traffic and resource interaction data.
    """
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_admin(request.user):
            return Response({"detail": "Admin access required."}, status=status.HTTP_403_FORBIDDEN)

        period = request.query_params.get("period", "last_7_days")
        start, end = _get_date_range(period)

        visits_qs = SiteVisit.objects.filter(timestamp__gte=start, timestamp__lte=end)

        # Summary counts
        summary_raw = visits_qs.values("user_type").annotate(count=Count("id"))
        summary = {"total": 0, "visitor": 0, "staff": 0, "admin": 0, "unique_sessions": 0}
        for row in summary_raw:
            summary[row["user_type"]] = row["count"]
            summary["total"] += row["count"]
        summary["unique_sessions"] = visits_qs.exclude(session_key="").values("session_key").distinct().count()

        # Daily breakdown
        daily_raw = (
            visits_qs
            .annotate(date=TruncDate("timestamp"))
            .values("date", "user_type")
            .annotate(count=Count("id"))
            .order_by("date")
        )
        daily_dict = defaultdict(lambda: {"visitor": 0, "staff": 0, "admin": 0, "total": 0})
        for row in daily_raw:
            date_str = row["date"].isoformat()
            ut = row["user_type"]
            cnt = row["count"]
            daily_dict[date_str][ut] += cnt
            daily_dict[date_str]["total"] += cnt
        daily = sorted(
            [{"date": k, **v} for k, v in daily_dict.items()],
            key=lambda x: x["date"],
        )

        # Top resources by interactions
        interactions_qs = ResourceInteraction.objects.filter(timestamp__gte=start, timestamp__lte=end)
        top_raw = (
            interactions_qs
            .values("resource__id", "resource__name", "resource__project__name")
            .annotate(
                views=Count("id", filter=Q(interaction_type="view")),
                shares=Count("id", filter=Q(interaction_type="share")),
            )
            .order_by("-views")[:10]
        )
        top_resources = [
            {
                "id": r["resource__id"],
                "name": r["resource__name"],
                "project_name": r["resource__project__name"],
                "views": r["views"],
                "shares": r["shares"],
            }
            for r in top_raw
        ]

        return Response({
            "period": period,
            "summary": summary,
            "daily": daily,
            "top_resources": top_resources,
        })