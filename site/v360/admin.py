from django.contrib import admin
from .models import Stone, StoneImages, LinkPatterns, StoneLog
from django.utils.html import format_html
from django.utils.html import mark_safe
from django.conf import settings
from django.db import models

class StoneNotInFilter(admin.SimpleListFilter):
    title = 'stone not in Stones'
    parameter_name = 'stone_not_in'

    def lookups(self, request, model_admin):
        return (
            ('yes', 'Not in Stone'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            stone_certificates = Stone.objects.values_list('certificate', flat=True)
            return queryset.exclude(stone__in=stone_certificates)
        return queryset

class StoneNoneImagesFilter(admin.SimpleListFilter):
    title = 'stone images count'
    parameter_name = 'stone_images_count'

    def lookups(self, request, model_admin):
        return (
            ('256_plus', '256 or more images saved'),
            ('less_than_256', 'Less than 256 images saved'),
        )

    def queryset(self, request, queryset):
        if self.value() == '256_plus':
            return queryset.annotate(image_count=models.Count('images')).filter(image_count__gte=256)
        if self.value() == 'less_than_256':
            return queryset.annotate(image_count=models.Count('images')).filter(image_count__lt=256)
        return queryset

@admin.register(Stone)
class StoneAdmin(admin.ModelAdmin):
    list_display = ('certificate', 'vendor', 'created_at', 'images_count', 'view_source', 'view_stone', 'generate_video')
    search_fields = ('certificate', 'base_url',)
    ordering = ('-created_at',)
    
    list_filter = ('vendor', 'created_at', StoneNoneImagesFilter)
    
    def view_source(self, obj):
        return format_html(
            '<a href="{0}">View Source</a>', 
            self.request.build_absolute_uri(f'{obj.base_url}')
        )
    
    def view_stone(self, obj):
        return format_html(
            '<a href="{0}">View 360</a>', 
            self.request.build_absolute_uri(f'/v360/get/{obj.certificate}/')
        )
        
    def generate_video(self, obj):
        return format_html(
            '<a href="{0}">Get mp4</a>', 
            self.request.build_absolute_uri(f'/v360/get-video/{obj.certificate}/')
        )


    def get_queryset(self, request):
        self.request = request
        return super().get_queryset(request)
    
    def images_count(self, obj):
        return StoneImages.objects.filter(stone=obj).count()
    
    
@admin.register(StoneImages)
class StoneImagesAdmin(admin.ModelAdmin):
    list_display = ('pk', 'stone', 'created_at', 'image_tag')
    search_fields = ('stone',)
    list_filter = ('stone', 'created_at')
    ordering = ('-created_at',)
    list_per_page = 256

    def image_tag(self, obj):
        return mark_safe(f'<a href="{obj.image.url}"><img src="{obj.image.url}" width="75" height="75" style="border-radius: 3px;" /></a>')
    image_tag.allow_tags = True
    image_tag.short_description = 'Image Preview'
    


@admin.register(LinkPatterns)
class LinkPatternsAdmin(admin.ModelAdmin):
    list_display = ('vendor', 'pattern', 'pattern_type', 'created_at', 'updated_at')
    search_fields = ('vendor', 'pattern', 'pattern_type')
    list_filter = ('pattern_type', 'created_at', 'updated_at')
    ordering = ('-created_at',)
    
@admin.register(StoneLog)
class StoneLogAdmin(admin.ModelAdmin):
    list_display = ('stone', 'created_at', 'updated_at', 'log')
    search_fields = ('stone', 'log')
    list_filter = ('created_at', 'updated_at', StoneNotInFilter)
    ordering = ('-created_at',)