"""
Blender AI插件工具函数
提供通用的辅助功能
"""

import bpy
import os
import json
import base64
from datetime import datetime
from typing import Optional, Tuple, Dict, Any


class AIImageGenUtils:
    """工具类"""
    
    @staticmethod
    def get_addon_preferences():
        """获取插件偏好设置"""
        return bpy.context.preferences.addons[__package__].preferences
    
    @staticmethod
    def get_active_image() -> Optional[bpy.types.Image]:
        """获取当前活动图像"""
        if bpy.context.area and bpy.context.area.type == 'IMAGE_EDITOR':
            if bpy.context.edit_image:
                return bpy.context.edit_image
        return None
    
    @staticmethod
    def image_to_base64(image: bpy.types.Image) -> Optional[str]:
        """将Blender图像转换为base64"""
        try:
            # 临时保存图像到文件
            temp_path = bpy.app.tempdir + "temp_ai_gen.png"
            
            # 保存当前渲染设置
            scene = bpy.context.scene
            original_format = scene.render.image_settings.file_format
            original_color_mode = scene.render.image_settings.color_mode
            original_color_depth = scene.render.image_settings.color_depth
            
            # 设置PNG格式
            scene.render.image_settings.file_format = 'PNG'
            scene.render.image_settings.color_mode = 'RGBA'
            scene.render.image_settings.color_depth = '8'
            
            # 保存图像
            image.save_render(temp_path, scene=scene)
            
            # 恢复原始设置
            scene.render.image_settings.file_format = original_format
            scene.render.image_settings.color_mode = original_color_mode
            scene.render.image_settings.color_depth = original_color_depth
            
            # 读取文件并转换为base64
            with open(temp_path, 'rb') as f:
                image_data = f.read()
            
            # 清理临时文件
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return base64.b64encode(image_data).decode('utf-8')
            
        except Exception as e:
            print(f"Error converting image to base64: {e}")
            return None
    
    @staticmethod
    def create_image_from_data(image_data: str, name: str, width: int, height: int) -> Optional[bpy.types.Image]:
        """从base64数据创建Blender图像"""
        try:
            # 解码base64数据
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            
            # 创建新图像
            image = bpy.data.images.new(
                name=name,
                width=width,
                height=height,
                alpha=True
            )
            
            # 临时保存到文件然后加载像素数据
            temp_path = bpy.app.tempdir + f"ai_gen_result_{name}.png"
            with open(temp_path, 'wb') as f:
                f.write(image_bytes)
            
            # 加载图像文件
            temp_image = bpy.data.images.load(temp_path)
            
            # 复制像素数据
            image.pixels = temp_image.pixels[:]
            
            # 清理临时图像和文件
            bpy.data.images.remove(temp_image)
            if os.path.exists(temp_path):
                os.remove(temp_path)
            
            return image
            
        except Exception as e:
            print(f"Error creating image from data: {e}")
            return None
    
    @staticmethod
    def parse_resolution(resolution_str: str) -> Tuple[int, int]:
        """解析分辨率字符串"""
        try:
            if 'x' in resolution_str:
                width, height = resolution_str.split('x')
                return int(width), int(height)
        except:
            pass
        return 1024, 1024
    
    @staticmethod
    def format_duration(seconds: float) -> str:
        """格式化持续时间"""
        if seconds < 60:
            return f"{seconds:.1f}s"
        else:
            minutes = int(seconds // 60)
            remaining = seconds % 60
            return f"{minutes}m {remaining:.1f}s"
    
    @staticmethod
    def get_current_timestamp() -> str:
        """获取当前时间戳"""
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    @staticmethod
    def save_history_item(scene, item_data: Dict[str, Any]):
        """保存历史记录项"""
        prefs = AIImageGenUtils.get_addon_preferences()
        
        if not prefs.auto_save_history:
            return
        
        # 添加到历史记录
        history = scene.ai_img_gen.history
        item = history.add()
        
        item.prompt = item_data.get('prompt', '')
        item.model = item_data.get('model', 'gpt-image-2')
        item.resolution = item_data.get('resolution', '1024x1024')
        item.quality = item_data.get('quality', 'medium')
        item.timestamp = AIImageGenUtils.get_current_timestamp()
        item.duration = item_data.get('duration', 0.0)
        
        # 限制历史记录数量
        try:
            max_items = int(prefs.max_history_items)
        except:
            max_items = 100
        
        while len(history) > max_items:
            history.remove(0)
    
    @staticmethod
    def show_message(message: str, title: str = "AI Image Generation", icon: str = 'INFO'):
        """显示消息对话框"""
        def draw(self, context):
            self.layout.label(text=message)
        
        bpy.context.window_manager.popup_menu(draw, title=title, icon=icon)


def register():
    pass


def unregister():
    pass