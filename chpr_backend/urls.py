"""
Root URL configuration.

  /admin/                     -> Django admin
  /api/csrf/                  -> CSRF cookie handshake (called once by the React frontend)
  /api/schema/ + swagger-ui/ + redoc/  -> OpenAPI schema & docs (drf-spectacular)
  /api/                       -> chpr REST API (DRF router)
  /media/                     -> uploaded files (served by Django in DEBUG)
  /static/, /images/          -> React build assets, from the build/ folder in the project root
  everything else             -> the React SPA's index.html (client-side routing)
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
import os


@require_GET
def csrf_cookie(request):
    """
    GET /api/csrf/
    Forces Django to set the csrftoken cookie and returns the token as JSON.
    The React frontend calls this once before its first POST (login) so that
    SessionAuthentication's CSRF check has a token to compare against.
    """
    token = get_token(request)
    return JsonResponse({"csrfToken": token})


urlpatterns = [
    path('admin/', admin.site.urls),

    # CSRF handshake — must be declared before the api/ include
    path('api/csrf/', csrf_cookie, name='csrf-cookie'),

    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/', include('chpr.urls')),
]

# Serve uploaded media (in DEBUG).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Serve the React build's static files and images from the build folder in the
# project root, before the React catch-all.
urlpatterns += static(settings.STATIC_URL, document_root=os.path.join(settings.BASE_DIR, 'build', 'static'))
urlpatterns += static('/images/', document_root=os.path.join(settings.BASE_DIR, 'build', 'images'))

# React catch-all route (MUST BE LAST).
urlpatterns += [
    re_path(r'^(?!api/|media/|static/|images/).*$', TemplateView.as_view(template_name="index.html")),
]