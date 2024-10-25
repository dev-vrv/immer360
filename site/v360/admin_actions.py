from .models import LinkPatterns
from django.shortcuts import redirect

DEFAULT_PATTERNS = {
    'v360': [
        "clientmedia.s3.amazonaws.com",
        "ksmedia.blob.core.windows.net",
        "ksvideo.blob.core.windows.net",
        "api.360view.link",
        "diamond360view.com",
        "diamonds.kiradiam.com",
        "v360.s3.us-east-2.wasabisys.com",
        "videos.gem360.in",
        "diamond360.co.in",
        "3dv.in",
        "api1.v360.in",
        "cvdhvideo.s3.ap-south-1.amazonaws.com",
        "d.360view.link",
        "d360.tech",
        "diamlab.s3.eu-north-1.amazonaws.com",
        "diamond.blissvideos.com",
        "dimdna.azureedge.net",
        "ellat.s3.us-west-1.amazonaws.com",
        "hd360video.com",
        "images.gemfacts.com",
        "inventory.nyc3.cdn.digitaloceanspaces.com",
        "labgrownforever.com",
        "lgpol.s3.us-east-1.amazonaws.com",
        "media.diamondweb.net",
        "mediassests.s3.amazonaws.com",
        "pkonline.blob.core.windows.net",
        "pkstone.co.in",
        "pv360.s3.amazonaws.com",
        "regular.s3.ap-south-1.amazonaws.com",
        "shivagems.co.in",
        "ssdweb.co",
        "v360.diamonds",
        "v360.in",
        "www.diamond360.co.in",
        "lgdvideo.com",
        "www.filesonsky.com"
    ],
    'gem360': [
        "video360.in",
        "view.gem360.in",
        "videos.gem360.in"
    ],
    'jaykar': [
        "ds-360.jaykar.co.in",
        "www.jaykar.co.in",
        "loupe360.com",
    ],
    'diacam': [
        'diacam360'
    ]
}

def add_default_patterns(request):
    for pattern_type, patterns in DEFAULT_PATTERNS.items():
        for pattern in patterns:
            LinkPatterns.objects.get_or_create(
                pattern_type=pattern_type,
                pattern=pattern,
                vendor='N/A'
            )
    return redirect(request.META.get('HTTP_REFERER', '/'))