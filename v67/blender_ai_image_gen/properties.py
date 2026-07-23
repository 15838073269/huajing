"""
Blender AI插件属性定义
定义场景和图像的属性
"""

import bpy
from bpy.props import (
    StringProperty,
    BoolProperty,
    EnumProperty,
    IntProperty,
    FloatProperty,
    CollectionProperty,
    PointerProperty
)
from bpy.types import PropertyGroup


class AIImageGenHistoryItem(PropertyGroup):
    """历史记录项"""
    
    prompt: StringProperty(
        name="Prompt",
        description="Generation prompt",
        default=""
    )
    
    model: StringProperty(
        name="Model",
        description="AI model used",
        default="gpt-image-2"
    )
    
    resolution: StringProperty(
        name="Resolution",
        description="Image resolution",
        default="1024x1024"
    )
    
    quality: StringProperty(
        name="Quality",
        description="Generation quality",
        default="medium"
    )
    
    timestamp: StringProperty(
        name="Timestamp",
        description="Generation timestamp",
        default=""
    )
    
    duration: FloatProperty(
        name="Duration",
        description="Generation duration in seconds",
        default=0.0
    )


class AIImageGenSettings(PropertyGroup):
    """AI生成设置"""
    
    # Generation mode
    mode: EnumProperty(
        name="Mode",
        description="Generation mode",
        items=[
            ('text2img', 'Text to Image', 'Generate image from text prompt'),
            ('img2img', 'Image to Image', 'Generate image based on reference image'),
        ],
        default='text2img'
    )
    
    # Prompt
    prompt: StringProperty(
        name="Prompt",
        description="Text prompt for image generation",
        default="",
        multiline=True
    )
    
    # Resolution settings
    resolution_mode: EnumProperty(
        name="Resolution Mode",
        description="Resolution selection mode",
        items=[
            ('preset', 'Preset', 'Use preset resolutions'),
            ('custom', 'Custom', 'Use custom resolution'),
        ],
        default='preset'
    )
    
    preset_resolution: EnumProperty(
        name="Preset Resolution",
        description="Preset resolution options",
        items=[
            ('1024x1024', '1K Square', '1024x1024'),
            ('1536x1024', '1K Landscape', '1536x1024'),
            ('1024x1536', '1K Portrait', '1024x1536'),
            ('2048x2048', '2K Square', '2048x2048'),
            ('2048x1152', '2K Landscape', '2048x1152'),
            ('1152x2048', '2K Portrait', '1152x2048'),
            ('3840x3840', '4K Square', '3840x3840'),
            ('3840x2160', '4K Landscape', '3840x2160'),
            ('2160x3840', '4K Portrait', '2160x3840'),
        ],
        default='1024x1024'
    )
    
    custom_width: IntProperty(
        name="Width",
        description="Custom width",
        default=1024,
        min=256,
        max=4096,
        step=16
    )
    
    custom_height: IntProperty(
        name="Height",
        description="Custom height",
        default=1024,
        min=256,
        max=4096,
        step=16
    )
    
    # Generation parameters
    model: EnumProperty(
        name="Model",
        description="AI model to use",
        items=[
            ('gpt-image-2', 'GPT-Image-2', 'Latest GPT Image model'),
        ],
        default='gpt-image-2'
    )
    
    quality: EnumProperty(
        name="Quality",
        description="Image quality",
        items=[
            ('auto', 'Auto', 'Automatic quality selection'),
            ('low', 'Low', 'Lower quality, faster generation'),
            ('medium', 'Medium', 'Balanced quality and speed'),
            ('high', 'High', 'High quality, slower generation'),
        ],
        default='medium'
    )
    
    format: EnumProperty(
        name="Format",
        description="Output format",
        items=[
            ('png', 'PNG', 'PNG format with transparency'),
            ('jpeg', 'JPEG', 'JPEG format, smaller file size'),
            ('webp', 'WebP', 'WebP format, modern compression'),
        ],
        default='png'
    )
    
    num_images: IntProperty(
        name="Number of Images",
        description="Number of images to generate",
        default=1,
        min=1,
        max=4
    )
    
    # Reference image for img2img
    use_active_image: BoolProperty(
        name="Use Active Image",
        description="Use the active image as reference",
        default=True
    )
    
    # Generation status
    is_generating: BoolProperty(
        name="Is Generating",
        description="Whether generation is in progress",
        default=False
    )
    
    generation_progress: FloatProperty(
        name="Generation Progress",
        description="Generation progress (0-100)",
        default=0.0,
        min=0.0,
        max=100.0,
        subtype='PERCENTAGE'
    )
    
    generation_status: StringProperty(
        name="Generation Status",
        description="Current generation status message",
        default="Ready"
    )


class AIImageGenProperties(PropertyGroup):
    """主属性组"""
    
    settings: PointerProperty(type=AIImageGenSettings)
    
    history: CollectionProperty(type=AIImageGenHistoryItem)
    
    history_index: IntProperty(
        name="History Index",
        description="Active history item index",
        default=-1
    )


def register():
    bpy.utils.register_class(AIImageGenHistoryItem)
    bpy.utils.register_class(AIImageGenSettings)
    bpy.utils.register_class(AIImageGenProperties)
    
    # 添加到场景
    bpy.types.Scene.ai_img_gen = PointerProperty(type=AIImageGenProperties)


def unregister():
    # 从场景移除
    del bpy.types.Scene.ai_img_gen
    
    bpy.utils.unregister_class(AIImageGenProperties)
    bpy.utils.unregister_class(AIImageGenSettings)
    bpy.utils.unregister_class(AIImageGenHistoryItem)