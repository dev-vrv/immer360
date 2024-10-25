from celery.app import shared_task
from .parser import Parser360
from .models import StoneLog, Stone
import logging
import asyncio
from celery.exceptions import Ignore, SoftTimeLimitExceeded
from django.db import connection

logger = logging.getLogger(__name__)

@shared_task(bind=True, time_limit=1200, soft_time_limit=1140)  # 20 минут жесткий лимит, 19 минут мягкий лимит
def parse_v360_data(self, source, certificate, vendor):
    if source and certificate:
        try:
            logger.warning(f"Starting parsing for {certificate}")
            log = StoneLog.objects.get_or_create(stone=certificate)[0]
            log.log = log.log + f"\nStarting parsing\n----\n"
            log.save()
        except Exception as e:
            logger.error(f"Error while creating log for {certificate}: {e}")
            # Пропускаем задачу и не повторяем
            raise Ignore()

        try:
            parser = Parser360(source, certificate, vendor)
            asyncio.run(parser.use_parser())
            log.log = log.log + f"\nParsing completed successfully\n----\n"
            log.save()
        except SoftTimeLimitExceeded:
            logger.error(f"Soft time limit exceeded while parsing {certificate}")
            log.log = log.log + f"\nSoft time limit exceeded while parsing\n----\n"
            log.save()
            # Удаляем камень по сертификату
            Stone.objects.filter(certificate=certificate).delete()
            raise Ignore()  # Пропускаем задачу
        except Exception as e:
            if 'Server has gone away' in str(e):
                logger.error(f"Database connection lost while parsing {certificate}: {e}")
                try:
                    # Закрываем текущее соединение
                    connection.close()
                    # Пытаемся переподключиться
                    connection.connect()
                    logger.warning(f"Reconnected to the database for {certificate}")
                    # После успешного переподключения повторяем попытку выполнения парсинга
                    parser = Parser360(source, certificate, vendor)
                    asyncio.run(parser.use_parser())
                    log.log = log.log + f"\nParsing completed successfully after reconnect\n----\n"
                    log.save()
                except Exception as reconnect_error:
                    logger.error(f"Failed to reconnect to the database for {certificate}: {reconnect_error}")
                    log.log = log.log + f"\nFailed to reconnect: {reconnect_error}\n----\n"
                    log.save()
                    Stone.objects.filter(certificate=certificate).delete()
                    raise Ignore()  # Пропускаем задачу
            else:
                logger.error(f"Error while parsing {certificate}: {e}")
                log.log = log.log + f"\nError while parsing {e}\n----\n"
                log.save()
                # Удаляем объект с ошибкой, чтобы не оставлять некорректные данные
                Stone.objects.filter(certificate=certificate).delete()
                # Пропускаем задачу, не повторяем её
                raise Ignore()
    else:
        logger.warning(f"Invalid data for parsing: source={source}, certificate={certificate}")
        raise Ignore()


@shared_task(bind=True)
def make_queue(self, diamonds):
    logger.info("Starting to create queue of tasks for parsing")
    for diamond in diamonds:
        parse_v360_data.delay(diamond['source'], diamond['certificate'], diamond['vendor'])
    return True
