#!/bin/bash

# Применение миграций базы данных
echo "Применение миграций базы данных..."
python manage.py collectstatic --noinput
python manage.py makemigrations --noinput
python manage.py migrate --noinput

# Создание суперпользователя, если его еще нет
echo "Создание суперпользователя..."
DJANGO_SUPERUSER_EMAIL=${DJANGO_SUPERUSER_EMAIL:-"labrilliante@gmail.com"}
DJANGO_SUPERUSER_USERNAME=${DJANGO_SUPERUSER_USERNAME:-"labrilliante"}
DJANGO_SUPERUSER_PASSWORD=${DJANGO_SUPERUSER_PASSWORD:-"PopAzaQ1@3"}

python manage.py shell <<EOF
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists():
    User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME', '$DJANGO_SUPERUSER_EMAIL', '$DJANGO_SUPERUSER_PASSWORD')
EOF

# Запуск сервера Gunicorn
echo "Запуск Gunicorn..."
exec gunicorn --workers=3 --bind=0.0.0.0:8000 core.wsgi:application --timeout 400
# exec python manage.py runserver 0.0.0.0:8000

 