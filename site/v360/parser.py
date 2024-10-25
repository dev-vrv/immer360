import logging
import os
import base64
import re
import io
import gc
import asyncio
import psutil
import signal
from asgiref.sync import sync_to_async
from PIL import Image
from pyppeteer import launch
from .models import Stone, StoneImages, LinkPatterns, StoneLog, get_stone_folder_path
from django.conf import settings

logger = logging.getLogger(__name__)

def close_existing_browsers():
    browser_process_names = ['chromium', 'chrome']  # Или другие имена процессов, если они отличаются
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.info['name'] in browser_process_names:
            try:
                logger.info(f"Terminating browser process: {proc.info['name']} (PID: {proc.info['pid']})")
                proc.send_signal(signal.SIGTERM)  # Отправляем сигнал завершения процесса
            except psutil.NoSuchProcess:
                logger.warning(f"Process {proc.info['pid']} already terminated.")
            except Exception as e:
                logger.error(f"Error while terminating process {proc.info['pid']}: {e}")


async def decode_and_save_images(data: list[str], stone):
    save_dir = get_stone_folder_path(stone.certificate)
    media_dir = os.path.join(settings.MEDIA_ROOT, save_dir)

    if not os.path.exists(media_dir):
        os.makedirs(media_dir)

    images = []
    for i, img_data in enumerate(data):
        try:
            img_bytes = base64.b64decode(img_data.split(',')[1])
            image = Image.open(io.BytesIO(img_bytes))
            format = image.format if image.format else "JPEG"
            image.save(os.path.join(media_dir, f'image_{i+1}.{format.lower()}'), format)
            
            images.append(StoneImages(stone=stone, image=save_dir + f'/image_{i+1}.{format.lower()}'))

        finally:
            image.close()
            gc.collect()
    
    await sync_to_async(StoneImages.objects.bulk_create)(images)

async def browser_launch(retries=3):
    close_existing_browsers()
    try:
        for attempt in range(retries):
            try:
                browser = await launch({
                    'handleSIGINT': False,
                    'handleSIGTERM': False,
                    'handleSIGHUP': False,
                    'headless': True,
                    'executablePath': '/usr/bin/chromium',
                    'args': [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--disable-popup-blocking',
                        '--no-zygote'
                    ],
                    'defaultViewport': None,
                })
                logger.warning(f"Browser launched: {browser.wsEndpoint}")
                return browser
            except Exception as e:
                logger.error(f"Error while launching browser (attempt {attempt+1}/{retries}): {e}")
                if attempt + 1 == retries:
                    raise
                await asyncio.sleep(5)
    except Exception as final_error:
        logger.error(f"Failed to launch browser after {retries} attempts: {final_error}")
        return None


class Parser360:
    def __init__(self, url: str, cert: str, vendor: str):
        self._url = url
        self._cert = cert
        self._vendor = vendor
        self.stone = None

        self._parse_functions = {
            'v360': self._parse_from_var,
            'gem360': self._parse_from_chunks,
            'jaykar': self._parse_from_image,
        }

    # Public function
    
    async def use_parser(self):
        self.stone = await sync_to_async(self._define_stone)(recreate=settings.DEBUG)
        images_exist = await sync_to_async(StoneImages.objects.filter(stone=self.stone).exists)()

        if not images_exist:
            await self._parse_images()
            
            try:
                log = await sync_to_async(StoneLog.objects.get)(stone=self.stone.certificate)
                log.log = log.log + f"Success\n----------------\n"
                await sync_to_async(log.save)()
            except:
                pass
                
            
        return self.stone

    # Parse functions

    async def _parse_images(self):
        browser = await browser_launch()
        if not browser:
            logger.error("Browser closed")
            return None

        pattern_type = await sync_to_async(self._define_pattern)(self._url)

        if not pattern_type:
            await self._delete_stone()
            raise Exception("Pattern not found")

        parse_function = self._parse_functions.get(pattern_type)

        images = await parse_function(browser)

        if not images:
            await self._delete_stone()
            raise Exception("Images not found")

        await decode_and_save_images(images, self.stone)

        if browser:
            await browser.close()
            logger.info("Browser closed")

    async def _parse_from_var(self, browser) -> list[str]:
        page = await browser.newPage()
        await page.goto(self._url, timeout=600000)

        try:
            await page.waitForSelector('canvas', {'timeout': 300000})
        except:
            try:
                await page.waitForSelector('.v360-canvas', {'timeout': 300000})
            except:
                await self._delete_stone()
                raise Exception("Canvas not found")
                

        await asyncio.sleep(20)

        frames_data = await page.evaluate('frames')

        await page.close()

        return frames_data[0]

    async def _parse_from_chunks(self, browser):
        self.gem360_collection = []

        page = await browser.newPage()

        page.on('response', lambda response: asyncio.ensure_future(self._log_response_gem360(response)))

        await page.goto(self._url)

        try:
            await page.waitForSelector('canvas', {'timeout': 300000})
        except:
            try:
                await page.waitForSelector('.v360-canvas', {'timeout': 300000})
            except:
                await self._delete_stone()
                raise Exception("Canvas not found")

        await asyncio.sleep(10)

        structured_data = {}
        for json in self.gem360_collection:
            for item in json:
                if isinstance(item, dict):
                    try:
                        structured_data[item['data_index']] = item['image']
                    except Exception as e:
                        raise Exception(f"Error while structuring data: {e}")

        sorted_keys = sorted(structured_data.keys())
        sorted_values = [structured_data[key] for key in sorted_keys]

        await page.close()

        return sorted_values

    async def _parse_from_image(self, browser):
        self.jaykar_collection = {}
        page = await browser.newPage()
        
        page.on('response', lambda response: asyncio.ensure_future(self._log_response_jaykar(response)))
        
        await page.goto(self._url, waitUntil='networkidle0', timeout=60000)

        total_timeout = 1000
        interval = 1
        elapsed_time = 0
        
        while elapsed_time < total_timeout:
            if len(self.jaykar_collection) >= 256:
                break
            await asyncio.sleep(interval)
            elapsed_time += interval

        self.jaykar_collection = dict(sorted(self.jaykar_collection.items()))
        images = list(self.jaykar_collection.values())

        await page.close()

        return images


    # Callback functions

    async def _log_response_gem360(self, response):
        try:
            content_type = response.headers.get('content-type', '')
            if 'application/json' in content_type:
                self.gem360_collection.append(await response.json())
        except Exception as e:
            raise Exception(f"Error while logging response gem360: {e}")

    async def _log_response_jaykar(self, response):
        try:
            content_type = response.headers.get('content-type', '')
            if 'image/jpeg' in content_type or 'image/webp' in content_type or 'image/jpg' in content_type:
                url = response.url
                filename = url.split('/')[-1]
                match = re.match(r'^(\d+).*\.(jpeg|webp|jpg)$', filename)
                if match:
                    image_index = int(match.group(1))
                    if image_index not in self.jaykar_collection:
                        self.jaykar_collection[image_index] = await response.buffer()
                    else:
                        return
        except Exception as e:
            raise Exception(f"Error while logging response jaykar: {e}")

    # Helper functions


    async def _delete_stone(self):
        await sync_to_async(self.stone.delete)(using='default', keep_parents=False)

    def _define_pattern(self, url):
        patterns = LinkPatterns.objects.all()
        for pattern_obj in patterns:
            pattern = pattern_obj.pattern
            if pattern in url:
                return pattern_obj.pattern_type
        return None

    def _define_stone(self, recreate: bool = False):
        stone = Stone.objects.filter(certificate=self._cert)
        if stone.exists() and not recreate:
            stone = stone.first()
        elif stone.exists() and recreate or not stone.exists():
            stone.delete()
            stone = Stone.objects.create(**{
                'certificate': self._cert,
                'base_url': self._url,
                'vendor': self._vendor,
                'base_folder': get_stone_folder_path(self._cert),
            })
        return stone

