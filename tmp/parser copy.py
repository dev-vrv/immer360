import logging
import os
import base64
import hashlib
import io
import time
import psutil
import subprocess
from PIL import Image
from pyppeteer import launch
from .models import Stone, StoneImages, get_stone_folder_path
from django.conf import settings

logger = logging.getLogger(__name__)

browser_path = '/usr/bin/chromium-browser' if settings.DEBUG else '/usr/bin/chromium'

class Parser360:
    def __init__(self, url: str, cert: str, model: str):
        self._url = url
        self._cert = cert
        self._model = model
        self._sleep_time = 20
        self._max_frames = 250
        self.recent_frames = []
        self.recent_hashes = []
        self.stone = None

    async def parse(self):
        # Инициализация записи Stone
        self.stone, created = Stone.objects.get_or_create(
            certificate=self._cert,
            base_url=self._url, 
            model=self._model,
            defaults={'base_folder': get_stone_folder_path(self._cert), 'is_parsing': True}
        )

        # Проверка существования изображений для камня
        images_exist = StoneImages.objects.filter(stone=self.stone).exists()

        # Если запись уже существует и изображения есть — ничего не делаем
        if not created and images_exist:
            return self.stone

        # Устанавливаем флаг, что начался процесс парсинга
        self.stone.is_parsing = True
        self.stone.save()

        try:
            # Проверка, запущен ли Chrome
            if not self._is_chrome_running():
                self._start_chrome()

            # Запуск браузера через pyppeteer
            browser = await launch({
                'headless': True,
                'executablePath': browser_path,
                'args': ['--remote-debugging-port=9222', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
                'defaultViewport': None
            })

            page = await browser.newPage()

            # Устанавливаем пользовательский агент и блокируем ненужные ресурсы
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36"
            )

            await page.setRequestInterception(True)
            page.on('request', lambda req: req.abort() if req.resourceType in ['image', 'stylesheet', 'font'] else req.continue_())

            # Открываем страницу и ждем ее загрузки
            await page.goto(self._url, {'waitUntil': 'domcontentloaded', 'timeout': 200000})
            await page.waitForTimeout(self._sleep_time * 1000)

            canvas_selector = '#Gem360' if 'gem360' in self._url else '.V360-canvas'

            # Ожидаем появления элемента Canvas
            try:
                await page.waitForSelector(canvas_selector, {'timeout': 15000})
            except Exception as e:
                logger.warning("Canvas элемент не найден.")
                self.stone.delete()
                raise Exception("Canvas not found")

            first_hash = None
            last_hash = None
            frame_count = 0
            retry_count = 0
            max_retry_count = 5000
            second_round_started = False
            image_map = {}

            # Основной цикл сбора кадров
            while True:
                img_data_urls = await page.evaluate(f"""
                    (async () => {{
                        const canvas = document.querySelector('{canvas_selector}');
                        return canvas.toDataURL('image/png', 1.0);
                    }})()
                """)

                # Получаем изображение и хешируем его для проверки уникальности
                img_data = base64.b64decode(img_data_urls.split(',')[1])
                image = Image.open(io.BytesIO(img_data))
                img_hash = self._hash_image(image)

                # Если это первый кадр, сохраняем его хеш
                if first_hash is None:
                    first_hash = img_hash

                # Если второй круг начался и кадр совпадает с последним — выходим из цикла
                if second_round_started and img_hash == last_hash:
                    logger.info(f"Парсинг завершен: последний кадр повторен на втором круге.")
                    break

                # Если хеш уникален, сохраняем кадр
                if img_hash not in self.recent_hashes:
                    image_map[frame_count] = img_data
                    self.recent_hashes.append(img_hash)
                    frame_count += 1
                    retry_count = 0  # Сбрасываем счетчик повторов
                    last_hash = img_hash  # Обновляем последний кадр
                    logger.debug(f"Добавлено изображение {frame_count}.")
                else:
                    retry_count += 1  # Увеличиваем счетчик повторов
                    logger.debug(f"Изображение уже получено, пропускаем кадр.")

                # Если мы достигли лимита повторов, начинаем второй круг
                if retry_count >= max_retry_count and not second_round_started:
                    logger.info("Первый круг завершен. Начинаем второй для подтверждения.")
                    second_round_started = True
                    retry_count = 0
                    continue

            # Сохранение всех уникальных изображений
            logger.info(f"Общее количество кадров: {frame_count}")
            self._save_images([image_map[i] for i in sorted(image_map.keys())])

        finally:
            # Обновляем статус после завершения
            if self.stone:
                self.stone.is_parsing = False
                self.stone.save()
            await browser.close()
            logger.info(f"Завершено парсинг для {self.stone.certificate}")

        return self.stone

    def _hash_image(self, image: Image.Image) -> str:
        hasher = hashlib.md5()
        hasher.update(image.tobytes())
        return hasher.hexdigest()

    def _save_images(self, images: list[bytes]):
        save_dir = os.path.join('media', 'stones', self.stone.certificate)
        os.makedirs(save_dir, exist_ok=True)

        for i, img_data in enumerate(images):
            image_path = os.path.join(save_dir, f'image_{i+1}.png')
            image = Image.open(io.BytesIO(img_data))
            
            if image.mode in ("RGBA", "P"):
                image = image.convert("RGB")
                
            image.save(image_path, "PNG")
            StoneImages.objects.create(stone=self.stone, image=image_path)
            logger.info(f"Сохранено изображение {image_path} и добавлено в базу данных.")

    def _start_chrome(self):
        subprocess.Popen([
            browser_path,
            '--remote-debugging-port=9222',
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--headless',
            '--disable-gpu'
        ])
        logger.info("Запущен новый экземпляр Chrome с remote-debugging-port=9222.")
        time.sleep(2)

    def _is_chrome_running(self):
        for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
            if proc.info['name'] == 'chrome' or proc.info['name'] == 'chromium':
                cmdline = proc.info['cmdline']
                if '--remote-debugging-port=9222' in cmdline:
                    logger.info("Найден уже запущенный экземпляр Chrome с remote-debugging-port=9222.")
                    return True
        return False
