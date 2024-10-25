from django.urls import path
from .views import ParseStone, ParseStoneView, GetVideoView, ParseStoneHandle, ParseStatusView
from .admin_actions import add_default_patterns

urlpatterns = [
    path('parse/', ParseStone.as_view(), name='parse-stone'),
    path('parse/handle/', ParseStoneHandle.as_view(), name='parse-stone-handle'),
    path('get/<certificate>/', ParseStoneView.as_view(), name='get-stone'),
    path('get-video/<certificate>/', GetVideoView.as_view(), name='get-video'),
    path('patterns/', add_default_patterns, name='add-default-patterns'),
    path('status/',ParseStatusView.as_view(), name='parse-status')
]
