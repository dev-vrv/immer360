# Generated by Django 5.1 on 2024-10-04 03:14

import v360.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('v360', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='stone',
            options={'ordering': ('-created_at',)},
        ),
        migrations.RemoveField(
            model_name='stone',
            name='is_parsing',
        ),
        migrations.RemoveField(
            model_name='stone',
            name='mark_as_broken',
        ),
        migrations.AlterField(
            model_name='stone',
            name='certificate',
            field=models.CharField(db_index=True, max_length=255, unique=True, verbose_name='Certificate'),
        ),
        migrations.AlterField(
            model_name='stone',
            name='vendor',
            field=models.CharField(blank=True, db_index=True, max_length=255, null=True, verbose_name='Vendor'),
        ),
        migrations.AlterField(
            model_name='stoneimages',
            name='image',
            field=models.ImageField(db_index=True, upload_to=v360.models.get_stone_image_upload_path, verbose_name='Image URL'),
        ),
        migrations.AlterField(
            model_name='stonelog',
            name='stone',
            field=models.CharField(db_index=True, max_length=255, verbose_name='Certificate'),
        ),
    ]
