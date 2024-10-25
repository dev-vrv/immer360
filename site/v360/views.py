from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponse
from asgiref.sync import async_to_sync
from django.shortcuts import render
from .parser import Parser360
from .models import Stone, StoneImages
import os
import json
from .video import generate_video
from .tasks import make_queue, parse_v360_data
from django.conf import settings
import logging
from .chunk_process import chunk_maker
from django.http import HttpResponse

logger = logging.getLogger(__name__)


class ParseStoneHandle(APIView):
    def get(self, request):
        return render(request, 'parse-handle.html', {
            'site_url': request.build_absolute_uri('/')[:-1]
        })
    
    def post(self, request):
        certificate = request.data['certificate']
        url = request.data['url']
        vendor = 'handle'
        try:
            parse_v360_data.delay(url, certificate, vendor)
            return Response({'status': 'success'}, content_type='application/json', status=200)
        except Exception as e:
            logger.error(f'{e}')
            return Response({'status': 'error'}, content_type='application/json', status=500)    

        
class ParseStone(APIView):
    def post(self, request):
        diamonds = request.data
        try:
            logger.warning(f"Starting queue for {len(diamonds)} diamonds")
            make_queue.delay(diamonds)
            return Response({'status': 'success'}, content_type='application/json', status=200)
        except Exception as e:
            logger.error(f'{e}')
            return Response({'status': 'error'}, content_type='application/json', status=500)    
        
            
class ParseStoneView(APIView):
    def get(self, request, certificate):
        first_image = StoneImages.objects.filter(stone__certificate=certificate).first()

        try:
            Stone.objects.get(certificate=certificate)
        except:
            return render(request, '404.html', status=404)
        
        try:
            return render(request, '360.html', {'certificate': certificate, 'first_image': first_image.image.url})
        except Exception as e:
            logger.error(f'{e}')
            return render(request, '404.html', status=404)
    
    def post(self, request, certificate):
        try:
            stone = Stone.objects.get(certificate=certificate)
        except:
            return Response({'error': 'error'}, content_type='application/json', status=500)

        images = list(StoneImages.objects.filter(stone=stone).values_list('image', flat=True))

        image_paths = [os.path.join(settings.MEDIA_ROOT, image) for image in images]

        request_index = json.loads(request.data)['chunk_index']

        chunk = chunk_maker(image_paths, request_index)
        return Response(chunk, content_type='application/json')

class GetVideoView(APIView):
    def get(self, request, certificate):
        try:
            video_path = generate_video(certificate)
            with open(video_path, 'rb') as video_file:
                video = video_file.read()
            response = HttpResponse(video, content_type='video/mp4')
            response['Content-Disposition'] = f'attachment; filename="{certificate}.mp4"'
            if os.path.exists(video_path):
                os.remove(video_path)
            return response
        except Exception as e:
            logger.error(f'Video Creation Error{certificate} - {str(e)}')
            return HttpResponse(status=500)


class ParseStatusView(APIView):
    def post(self, request):
        try:
            diamonds = request.data

            logger.warning(f"Checking status for {len(diamonds)}")

            stones = Stone.objects.filter(certificate__in=diamonds)

            parsed = list(stones.values_list('certificate', flat=True))

            logger.warning(f"Already parsed: {parsed}")

            return Response(parsed, status=200)

        except Exception as e:
            logger.error(f'{e}')
            return Response({'status': 'error', 'message': str(e)}, status=500)
