from django.utils.deprecation import MiddlewareMixin

class AllowIframeFromMiddleware(MiddlewareMixin):
    def process_response(self, request, response):
        response['Content-Security-Policy'] = (
            "frame-ancestors 'self' b2b.labrilliante.com 68.178.206.189 "
            "127.0.0.1:8000 127.0.0.1:8001;"
        )
        return response
