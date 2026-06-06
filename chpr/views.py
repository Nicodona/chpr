"""DRF viewsets and auth views for the CHPR Resources Hub API."""
from django.contrib.auth import login, logout
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication, TokenAuthentication
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ContactMessage, Project, Resource, ResourceComment
from .serializers import (
    ContactMessageSerializer,
    LoginSerializer,
    ProjectSerializer,
    ResourceCommentSerializer,
    ResourceSerializer,
    UserSerializer,
)

# Shared authentication backends used on all views that need auth.
AUTH_BACKENDS = [SessionAuthentication, TokenAuthentication]


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
    Read operations are public; writes require login.
    """
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    lookup_field = "slug"
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]


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
    queryset = Resource.objects.select_related("project").all()
    serializer_class = ResourceSerializer
    authentication_classes = AUTH_BACKENDS
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

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