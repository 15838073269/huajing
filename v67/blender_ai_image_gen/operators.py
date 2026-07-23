"""
Blender AI插件操作符
定义主要的功能操作
"""

import bpy
import requests
import threading
import time
from bpy.props import StringProperty, BoolProperty, EnumProperty, IntProperty
from bpy.types import Operator

from . import utils


class AI_OT_GenerateImage(Operator):
    """AI图像生成操作符"""
    
    bl_idname = "ai_img_gen.generate"
    bl_label = "Generate Image"
    bl_description = "Generate image using AI"
    
    # 用于后台线程的属性
    _prompt: StringProperty(default="")
    _resolution: StringProperty(default="1024x1024")
    _model: StringProperty(default="gpt-image-2")
    _quality: StringProperty(default="medium")
    _format: StringProperty(default="png")
    _num_images: IntProperty(default=1)
    _use_active_image: BoolProperty(default=False)
    
    # 定时器相关
    _timer = None
    _thread = None
    _generating = False
    
    def modal(self, context, event):
        """模态操作处理"""
        if event.type == 'TIMER':
            # 更新进度
            if context.scene.ai_img_gen.settings.is_generating:
                # 检查线程状态
                if self._thread and not self._thread.is_alive():
                    # 生成完成
                    self._generating = False
                    context.scene.ai_img_gen.settings.is_generating = False
                    context.scene.ai_img_gen.settings.generation_status = "Completed"
                    
                    if self._timer:
                        context.window_manager.event_timer_remove(self._timer)
                        self._timer = None
                    
                    return {'FINISHED'}
                    
            return {'RUNNING_MODAL'}
        
        return {'PASS_THROUGH'}
    
    def execute(self, context):
        """执行生成"""
        scene = context.scene
        settings = scene.ai_img_gen.settings
        prefs = utils.AIImageGenUtils.get_addon_preferences()
        
        # 验证API密钥
        if not prefs.api_key:
            utils.AIImageGenUtils.show_message(
                "Please configure your API key in addon preferences",
                "Configuration Required",
                'ERROR'
            )
            return {'CANCELLED'}
        
        # 验证提示词
        if not settings.prompt.strip():
            utils.AIImageGenUtils.show_message(
                "Please enter a prompt",
                "Input Required",
                'ERROR'
            )
            return {'CANCELLED'}
        
        # 设置生成状态
        settings.is_generating = True
        settings.generation_status = "Preparing..."
        
        # 获取分辨率
        if settings.resolution_mode == 'preset':
            resolution = settings.preset_resolution
        else:
            resolution = f"{settings.custom_width}x{settings.custom_height}"
        
        # 准备生成参数
        self._prompt = settings.prompt
        self._resolution = resolution
        self._model = settings.model
        self._quality = settings.quality
        self._format = settings.format
        self._num_images = settings.num_images
        self._use_active_image = settings.use_active_image and settings.mode == 'img2img'
        
        # 启动后台线程
        self._thread = threading.Thread(target=self._generate_thread)
        self._thread.daemon = True
        self._thread.start()
        
        # 添加定时器
        self._timer = context.window_manager.event_timer_add(0.1, window=context.window)
        context.window_manager.modal_handler_add(self)
        
        return {'RUNNING_MODAL'}
    
    def _generate_thread(self):
        """后台生成线程"""
        try:
            # 获取API配置
            prefs = utils.AIImageGenUtils.get_addon_preferences()
            api_base = prefs.api_base.rstrip('/')
            api_key = prefs.api_key
            
            # 准备请求数据
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Accept': 'application/json'
            }
            
            start_time = time.time()
            
            if self._use_active_image:
                # 图生图
                self._generate_img2img(api_base, headers, start_time)
            else:
                # 文生图
                self._generate_text2img(api_base, headers, start_time)
            
        except Exception as e:
            print(f"Generation error: {e}")
            bpy.app.timers.register(
                lambda: self._update_status(f"Error: {str(e)}")
            )
    
    def _generate_text2img(self, api_base: str, headers: dict, start_time: float):
        """文生图生成"""
        # 准备请求体
        payload = {
            'model': self._model,
            'prompt': self._prompt,
            'n': self._num_images,
            'size': self._resolution
        }
        
        if self._quality != 'auto':
            payload['quality'] = self._quality
        
        # 更新状态
        bpy.app.timers.register(
            lambda: self._update_status("Generating from text...")
        )
        
        # 发送请求
        response = requests.post(
            f"{api_base}/v1/images/generations",
            headers={**headers, 'Content-Type': 'application/json'},
            json=payload,
            timeout=300
        )
        
        if response.status_code == 200:
            data = response.json()
            self._process_response(data, start_time)
        else:
            error_msg = response.json().get('error', {}).get('message', str(response.text))
            raise Exception(f"API Error {response.status_code}: {error_msg}")
    
    def _generate_img2img(self, api_base: str, headers: dict, start_time: float):
        """图生图生成"""
        # 获取活动图像
        active_image = utils.AIImageGenUtils.get_active_image()
        if not active_image:
            raise Exception("No active image selected")
        
        # 转换为base64
        image_b64 = utils.AIImageGenUtils.image_to_base64(active_image)
        if not image_b64:
            raise Exception("Failed to process reference image")
        
        # 准备FormData
        files = {'image': ('reference.png', base64.b64decode(image_b64), 'image/png')}
        data = {
            'prompt': self._prompt,
            'model': self._model,
            'n': str(self._num_images),
            'size': self._resolution
        }
        
        if self._quality != 'auto':
            data['quality'] = self._quality
        
        # 更新状态
        bpy.app.timers.register(
            lambda: self._update_status("Generating from image...")
        )
        
        # 发送请求
        response = requests.post(
            f"{api_base}/v1/images/edits",
            headers=headers,
            files=files,
            data=data,
            timeout=300
        )
        
        if response.status_code == 200:
            data = response.json()
            self._process_response(data, start_time)
        else:
            error_msg = response.json().get('error', {}).get('message', str(response.text))
            raise Exception(f"API Error {response.status_code}: {error_msg}")
    
    def _process_response(self, data: dict, start_time: float):
        """处理API响应"""
        if not data.get('data') or len(data['data']) == 0:
            raise Exception("No image data in response")
        
        duration = time.time() - start_time
        
        # 处理生成的图像
        for i, item in enumerate(data['data']):
            image_name = f"AI_Gen_{int(time.time())}_{i}"
            
            if item.get('b64_json'):
                # Base64格式
                image_data = item['b64_json']
                width, height = utils.AIImageGenUtils.parse_resolution(self._resolution)
                
                # 创建Blender图像
                new_image = utils.AIImageGenUtils.create_image_from_data(
                    f"data:image/png;base64,{image_data}",
                    image_name,
                    width,
                    height
                )
                
                if new_image:
                    # 在Blender主线程中更新
                    def create_image():
                        # 切换到图像编辑器并显示新图像
                        for area in bpy.context.screen.areas:
                            if area.type == 'IMAGE_EDITOR':
                                area.spaces.active.image = new_image
                                break
                        return None
                    
                    bpy.app.timers.register(create_image)
            
        # 保存历史记录
        history_data = {
            'prompt': self._prompt,
            'model': self._model,
            'resolution': self._resolution,
            'quality': self._quality,
            'duration': duration
        }
        
        def save_history():
            utils.AIImageGenUtils.save_history_item(bpy.context.scene, history_data)
            return None
        
        bpy.app.timers.register(save_history)
        
        # 更新状态
        def update_complete():
            status = f"✅ {utils.AIImageGenUtils.format_duration(duration)} ({len(data['data'])} images)"
            self._update_status(status)
            return None
        
        bpy.app.timers.register(update_complete)
    
    def _update_status(self, status: str):
        """更新生成状态"""
        if bpy.context and bpy.context.scene:
            bpy.context.scene.ai_img_gen.settings.generation_status = status


class AI_OT_ClearHistory(Operator):
    """清除历史记录"""
    
    bl_idname = "ai_img_gen.clear_history"
    bl_label = "Clear History"
    bl_description = "Clear generation history"
    
    def execute(self, context):
        """执行清除"""
        scene = context.scene
        scene.ai_img_gen.history.clear()
        scene.ai_img_gen.history_index = -1
        
        utils.AIImageGenUtils.show_message(
            "History cleared",
            "AI Image Generation",
            'INFO'
        )
        
        return {'FINISHED'}


class AI_OT_InsertPromptFromHistory(Operator):
    """从历史记录插入提示词"""
    
    bl_idname = "ai_img_gen.insert_prompt"
    bl_label = "Insert Prompt from History"
    bl_description = "Insert prompt from history item"
    
    history_index: IntProperty()
    
    def execute(self, context):
        """执行插入"""
        scene = context.scene
        history = scene.ai_img_gen.history
        
        if 0 <= self.history_index < len(history):
            item = history[self.history_index]
            scene.ai_img_gen.settings.prompt = item.prompt
            
            utils.AIImageGenUtils.show_message(
                "Prompt inserted from history",
                "AI Image Generation",
                'INFO'
            )
        
        return {'FINISHED'}


class AI_OT_TemplateLandscape(Operator):
    """风景模板操作符"""
    bl_idname = "ai_img_gen.template_landscape"
    bl_label = "Landscape Template"
    
    def execute(self, context):
        context.scene.ai_img_gen.settings.prompt = "A beautiful landscape with mountains and lakes"
        return {'FINISHED'}


class AI_OT_TemplateCity(Operator):
    """城市模板操作符"""
    bl_idname = "ai_img_gen.template_city"
    bl_label = "City Template"
    
    def execute(self, context):
        context.scene.ai_img_gen.settings.prompt = "A futuristic city with flying cars"
        return {'FINISHED'}


class AI_OT_TemplateFantasy(Operator):
    """奇幻模板操作符"""
    bl_idname = "ai_img_gen.template_fantasy"
    bl_label = "Fantasy Template"
    
    def execute(self, context):
        context.scene.ai_img_gen.settings.prompt = "A fantasy creature in a magical forest"
        return {'FINISHED'}


class AI_OT_TemplateAbstract(Operator):
    """抽象模板操作符"""
    bl_idname = "ai_img_gen.template_abstract"
    bl_label = "Abstract Template"
    
    def execute(self, context):
        context.scene.ai_img_gen.settings.prompt = "An abstract geometric pattern"
        return {'FINISHED'}


def register():
    bpy.utils.register_class(AI_OT_GenerateImage)
    bpy.utils.register_class(AI_OT_ClearHistory)
    bpy.utils.register_class(AI_OT_InsertPromptFromHistory)
    bpy.utils.register_class(AI_OT_TemplateLandscape)
    bpy.utils.register_class(AI_OT_TemplateCity)
    bpy.utils.register_class(AI_OT_TemplateFantasy)
    bpy.utils.register_class(AI_OT_TemplateAbstract)


def unregister():
    bpy.utils.unregister_class(AI_OT_InsertPromptFromHistory)
    bpy.utils.unregister_class(AI_OT_ClearHistory)
    bpy.utils.unregister_class(AI_OT_GenerateImage)