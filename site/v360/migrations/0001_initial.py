# Generated by Django 5.1 on 2024-09-28 02:23

import django.db.models.deletion
import v360.models
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='LinkPatterns',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('vendor', models.CharField(max_length=255, verbose_name='Vendor')),
                ('pattern', models.CharField(max_length=255, verbose_name='Pattern')),
                ('pattern_type', models.CharField(choices=[('v360', 'V360'), ('gem360', 'Gem360'), ('jaykar', 'Jaykar'), ('diacam', 'Diacam')], max_length=255, verbose_name='Pattern Type')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated At')),
            ],
        ),
        migrations.CreateModel(
            name='Stone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('certificate', models.CharField(max_length=255, unique=True, verbose_name='Certificate')),
                ('is_parsing', models.BooleanField(default=False, verbose_name='Is Parsing')),
                ('base_url', models.URLField(unique=True, verbose_name='Base URL')),
                ('base_folder', models.CharField(blank=True, max_length=255, null=True, verbose_name='Base Folder')),
                ('mark_as_broken', models.BooleanField(default=False, verbose_name='Mark as Broken')),
                ('vendor', models.CharField(blank=True, max_length=255, null=True, verbose_name='Vendor')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated At')),
            ],
        ),
        migrations.CreateModel(
            name='StoneLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('stone', models.CharField(max_length=255, verbose_name='Certificate')),
                ('log', models.TextField(verbose_name='Log')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('updated_at', models.DateTimeField(auto_now=True, verbose_name='Updated At')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.CreateModel(
            name='StoneImages',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to=v360.models.get_stone_image_upload_path, verbose_name='Image URL')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Created At')),
                ('stone', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='v360.stone')),
            ],
        ),
    ]
