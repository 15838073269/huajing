"""
Blender AI插件偏好设置
管理API配置和全局设置
"""

import bpy
from bpy.props import StringProperty, BoolProperty, EnumProperty
from bpy.types import AddonPreferences


class AIImageGenPreferences(AddonPreferences):
    bl_idname = __package__
    
    # API Configuration
    api_base: StringProperty(
        name="API Base URL",
        description="GPT-Image API base URL",
        default="https://api3.wlai.vip",
        subtype='NONE'
    )
    
    api_key: StringProperty(
        name="API Key",
        description="Your GPT-Image API key",
        default="",
        subtype='PASSWORD'
    )
    
    # Default generation settings
    default_model: EnumProperty(
        name="Default Model",
        description="Default AI model to use",
        items=[
            ('gpt-image-2', 'GPT-Image-2', 'Latest GPT Image model'),
        ],
        default='gpt-image-2'
    )
    
    default_quality: EnumProperty(
        name="Default Quality",
        description="Default image quality",
        items=[
            ('auto', 'Auto', 'Automatic quality selection'),
            ('low', 'Low', 'Lower quality, faster generation'),
            ('medium', 'Medium', 'Balanced quality and speed'),
            ('high', 'High', 'High quality, slower generation'),
        ],
        default='medium'
    )
    
    default_format: EnumProperty(
        name="Default Format",
        description="Default image format",
        items=[
            ('png', 'PNG', 'PNG format with transparency'),
            ('jpeg', 'JPEG', 'JPEG format, smaller file size'),
            ('webp', 'WebP', 'WebP format, modern compression'),
        ],
        default='png'
    )
    
    # UI Settings
    show_advanced: BoolProperty(
        name="Show Advanced Options",
        description="Show advanced generation options",
        default=False
    )
    
    auto_save_history: BoolProperty(
        name="Auto-save History",
        description="Automatically save generation history",
        default=True
    )
    
    max_history_items: StringProperty(
        name="Max History Items",
        description="Maximum number of history items to keep",
        default="100",
        subtype='NONE'
    )
    
    def draw(self, context):
        layout = self.layout
        
        # API Configuration
        box = layout.box()
        box.label(text="API Configuration", icon='WORLD_DATA')
        box.prop(self, "api_base")
        box.prop(self, "api_key")
        
        # Default Settings
        box = layout.box()
        box.label(text="Default Generation Settings", icon='RENDER_STILL')
        box.prop(self, "default_model")
        box.prop(self, "default_quality")
        box.prop(self, "default_format")
        
        # UI Settings
        box = layout.box()
        box.label(text="UI Settings", icon='PREFERENCES')
        box.prop(self, "show_advanced")
        box.prop(self, "auto_save_history")
        box.prop(self, "max_history_items")


def register():
    bpy.utils.register_class(AIImageGenPreferences)


def unregister():
    bpy.utils.unregister_class(AIImageGenPreferences)