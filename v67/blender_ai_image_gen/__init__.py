"""
Blender AI Image Generation Plugin
基于原有的Web AI生图插件转换而来
支持文生图、图生图功能，与Blender图像编辑器集成
"""

bl_info = {
    "name": "AI Image Generation",
    "author": "Your Name",
    "version": (1, 0),
    "blender": (3, 0, 0),
    "location": "Image Editor > Sidebar > AI Gen",
    "description": "AI-powered image generation with GPT-Image API",
    "warning": "Requires API key configuration",
    "doc_url": "",
    "category": "Image",
}

import bpy
import os
from . import operators
from . import ui
from . import properties
from . import preferences


def register():
    """注册插件"""
    # 注册属性
    properties.register()
    
    # 注册操作符
    operators.register()
    
    # 注册UI面板
    ui.register()
    
    # 注册偏好设置
    preferences.register()


def unregister():
    """注销插件"""
    # 注销偏好设置
    preferences.unregister()
    
    # 注销UI面板
    ui.unregister()
    
    # 注销操作符
    operators.unregister()
    
    # 注销属性
    properties.unregister()


if __name__ == "__main__":
    register()