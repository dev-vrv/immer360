from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.conf import settings
import shutil
import os

def get_stone_image_upload_path(instance, filename):
    return os.path.join('stones', instance.stone.certificate, filename)


def get_stone_folder_path(certificate: str):
    return os.path.join('stones', certificate)


class Stone(models.Model):
    certificate = models.CharField(max_length=255, verbose_name="Certificate", unique=True, db_index=True)
    base_url = models.URLField(unique=True, verbose_name="Base URL")
    base_folder = models.CharField(max_length=255, verbose_name="Base Folder", blank=True, null=True)
    vendor = models.CharField(max_length=255, verbose_name="Vendor", blank=True, null=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")
    
    class Meta:
        ordering = ('-created_at',)
    
    def __str__(self):
        return self.certificate
    
    def delete(self, using, keep_parents) -> tuple[int, dict[str, int]]:
        folder_path = get_stone_folder_path(self.certificate)
        if os.path.isdir(folder_path):
            shutil.rmtree(folder_path)
        return super().delete(using, keep_parents)


class StoneImages(models.Model):
    stone = models.ForeignKey(Stone, related_name='images', on_delete=models.CASCADE, db_index=True)
    image = models.ImageField(upload_to=get_stone_image_upload_path, verbose_name="Image URL", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")

    def __str__(self):
        return f"Photo for {self.stone.base_url}"


class LinkPatterns(models.Model):
    
    PATTERNS_TYPES = (
        ('v360', 'V360'),
        ('gem360', 'Gem360'),
        ('jaykar', 'Jaykar'),
        ('diacam', 'Diacam'),
    )
    
    vendor = models.CharField(max_length=255, verbose_name="Vendor")
    pattern = models.CharField(max_length=255, verbose_name="Pattern")
    pattern_type = models.CharField(max_length=255, verbose_name="Pattern Type", choices=PATTERNS_TYPES)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")
    
    
class StoneLog(models.Model):
    stone = models.CharField(max_length=255, verbose_name="Certificate", db_index=True)
    log = models.TextField(verbose_name="Log")
    
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Created At")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Updated At")
    
    def clean_old_logs(self):
        if StoneLog.objects.count() > 5000:
            excess_logs = StoneLog.objects.order_by('created_at')[:StoneLog.objects.count() - 5000]
            excess_logs.delete()

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        self.clean_old_logs()
    
    def __str__(self):
        return f"Log for {self.stone}"
    
    class Meta:
        ordering = ('-created_at',)