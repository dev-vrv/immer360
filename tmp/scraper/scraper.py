import asyncio
from pyppeteer import launch
import logging

logging.getLogger('pyppeteer').setLevel(logging.WARNING)

browser_path = '/usr/bin/chromium-browser'  # Убедись, что этот путь правильный

class Parser360:
    def __init__(self, url: str, cert: str, model: str):
        self._url = url
        self._cert = cert
        self._model = model

    async def use_parser(self):
        print("Starting parser...")
        await self._parse_images()

    async def _parse_images(self):
        browser = None
        try:
            print("Launching browser...")
            browser = await launch({
                'headless': True,
                'executablePath': browser_path,
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
            print("Browser launched!")

            page = await browser.newPage()
            print("Navigating to URL...")
            await page.goto(self._url)
            print("Page loaded successfully")

        except Exception as e:
            print(f'Error: {e}')
        finally:
            if browser:
                await browser.close()

async def use_scraper():
    url = 'https://inventory.nyc3.cdn.digitaloceanspaces.com/Vision360.html?d=M140480/b2c&sv=0&z=0&btn=0'
    certificate = 'M140480'
    model = 'white'
    parser = Parser360(url, certificate, model)
    await parser.use_parser()

if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(use_scraper())
    finally:
        loop.close()
