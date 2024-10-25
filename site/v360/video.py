import os
import logging
from moviepy.editor import ImageSequenceClip
from .models import Stone, StoneImages
from PIL import Image
from django.conf import settings  # Импортируем настройки для доступа к MEDIA_ROOT

logger = logging.getLogger(__name__)

def generate_video(certificate: str) -> str:
    try:
        logger.info(f"Start generating video for certificate: {certificate}")
        
        stone = Stone.objects.get(certificate=certificate)
        logger.info(f"Stone object found: {stone.id}")

        images = StoneImages.objects.filter(stone=stone).order_by('id')
        logger.info(f"Found {images.count()} images for stone: {stone.id}")

        temp_dir = os.path.join(settings.MEDIA_ROOT, 'tmp', certificate)  # Используем MEDIA_ROOT
        os.makedirs(temp_dir, exist_ok=True)
        logger.info(f"Temporary directory created: {temp_dir}")

        # Получаем список путей к изображениям на сервере
        image_paths = [os.path.join(settings.MEDIA_ROOT, image.image.name) for image in images]

        if not image_paths:
            logger.error(f"No images found for stone: {certificate}")
            raise ValueError("No images found for this stone.")

        # Проверяем существование файлов и обрабатываем изображения
        for path in image_paths:
            if not os.path.exists(path):
                logger.error(f"File not found: {path}")
                raise FileNotFoundError(f"No such file: '{path}'")

            img = Image.open(path)
            width, height = img.size
            logger.info(f"Processing image {path}, size: {width}x{height}")

            if height % 2 != 0:
                new_height = (height // 2) * 2
                img = img.resize((width, new_height), Image.Resampling.LANCZOS)
                img.save(path)
                logger.info(f"Image resized and saved: {path}, new height: {new_height}")

        # Генерируем путь для видеофайла
        video_path = os.path.join(temp_dir, f'{certificate}.mp4')
        fps = 24
        logger.info(f"Video will be saved to: {video_path}")

        clip = ImageSequenceClip(image_paths, fps=fps)
        logger.info(f"Video clip created with {fps} FPS")

        width, height = clip.size
        if height % 2 != 0:
            clip = clip.resize(height=(height // 2) * 2)
            logger.info(f"Clip resized, new size: {clip.size}")

        clip.write_videofile(
            video_path,
            codec='libx264',
            audio=False,
            threads=4,
            preset='slow',
            ffmpeg_params=['-pix_fmt', 'yuv420p']
        )
        logger.info(f"Video successfully written to {video_path}")

        return video_path

    except Exception as e:
        logger.error(f"Error while generating video for certificate {certificate}: {str(e)}", exc_info=True)
        raise
