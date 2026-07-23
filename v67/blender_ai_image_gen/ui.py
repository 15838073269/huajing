"""
Blender AI插件UI界面
定义图像编辑器中的面板
"""

import bpy
from bpy.types import Panel, UIList, Operator
from bpy.props import StringProperty

from . import operators


class AI_PT_ImageGeneration(Panel):
    """AI图像生成主面板"""
    
    bl_label = "AI Image Generation"
    bl_idname = "AI_PT_image_generation"
    bl_space_type = 'IMAGE_EDITOR'
    bl_region_type = 'UI'
    bl_category = 'AI Gen'
    
    def draw(self, context):
        """绘制面板"""
        layout = self.layout
        scene = context.scene
        settings = scene.ai_img_gen.settings
        prefs = context.preferences.addons[__package__].preferences
        
        # 配置状态提示
        if not prefs.api_key:
            box = layout.box()
            box.alert = True
            box.label(text="API Key Required", icon='ERROR')
            box.label(text="Please configure in Preferences")
            box.operator("preferences.addon_show", text="Open Preferences").module = __package__
            layout.separator()
        
        # 生成模式
        layout.prop(settings, "mode", expand=True)
        layout.separator()
        
        # 提示词输入
        layout.label(text="Prompt:")
        row = layout.row()
        row.scale_y = 3.0
        row.prop(settings, "prompt", text="")
        layout.separator()
        
        # 分辨率设置
        box = layout.box()
        box.label(text="Resolution:")
        box.prop(settings, "resolution_mode", expand=True)
        
        if settings.resolution_mode == 'preset':
            box.prop(settings, "preset_resolution")
        else:
            row = box.row(align=True)
            row.prop(settings, "custom_width", text="W")
            row.prop(settings, "custom_height", text="H")
        
        layout.separator()
        
        # 生成参数
        box = layout.box()
        box.label(text="Generation Settings:")
        box.prop(settings, "model")
        box.prop(settings, "quality")
        box.prop(settings, "format")
        box.prop(settings, "num_images")
        
        if settings.mode == 'img2img':
            box.prop(settings, "use_active_image")
        
        layout.separator()
        
        # 生成状态
        if settings.is_generating:
            box = layout.box()
            box.label(text="Status: " + settings.generation_status, icon='RENDER_STILL')
            box.prop(settings, "generation_progress", text="Progress")
        
        # 生成按钮
        row = layout.row()
        if settings.is_generating:
            row.enabled = False
            row.operator("ai_img_gen.generate", text="Generating...", icon='RENDER_STILL')
        else:
            row.scale_y = 2.0
            row.operator("ai_img_gen.generate", text="Generate", icon='RENDER_STILL')


class AI_PT_History(Panel):
    """历史记录面板"""
    
    bl_label = "Generation History"
    bl_idname = "AI_PT_history"
    bl_space_type = 'IMAGE_EDITOR'
    bl_region_type = 'UI'
    bl_category = 'AI Gen'
    bl_parent_id = "AI_PT_image_generation"
    
    def draw(self, context):
        """绘制历史记录面板"""
        layout = self.layout
        scene = context.scene
        history = scene.ai_img_gen.history
        
        # 历史记录控制
        row = layout.row()
        row.operator("ai_img_gen.clear_history", text="Clear", icon='TRASH')
        layout.separator()
        
        # 历史记录列表
        if len(history) == 0:
            layout.label(text="No generation history", icon='INFO')
        else:
            for i, item in enumerate(history):
                box = layout.box()
                
                # 时间戳和持续时间
                row = box.row()
                row.label(text=item.timestamp, icon='TIME')
                row.label(text=f"({item.duration:.1f}s)", icon='NONE')
                
                # 参数信息
                box.label(text=f"Model: {item.model}")
                box.label(text=f"Resolution: {item.resolution}")
                box.label(text=f"Quality: {item.quality}")
                
                # 提示词（截断显示）
                prompt_preview = item.prompt[:100]
                if len(item.prompt) > 100:
                    prompt_preview += "..."
                box.label(text=f"Prompt: {prompt_preview}")
                
                # 操作按钮
                row = box.row()
                row.operator("ai_img_gen.insert_prompt", text="Use Prompt", icon='PASTEDOWN', history_index=i)


class AI_UL_HistoryList(UIList):
    """历史记录UI列表"""
    
    def draw_item(self, context, layout, data, item, icon, active_data, active_propname):
        """绘制列表项"""
        if self.layout_type in {'DEFAULT', 'COMPACT'}:
            row = layout.row(align=True)
            
            # 时间戳
            row.label(text=item.timestamp, icon='TIME')
            
            # 提示词预览
            prompt_preview = item.prompt[:30]
            if len(item.prompt) > 30:
                prompt_preview += "..."
            row.label(text=prompt_preview)
            
            # 参数
            row.label(text=f"{item.resolution}")
            
        elif self.layout_type in {'GRID'}:
            layout.alignment = 'CENTER'
            layout.label(text=item.timestamp, icon='TIME')


class AI_PT_Templates(Panel):
    """提示词模板面板"""
    
    bl_label = "Prompt Templates"
    bl_idname = "AI_PT_templates"
    bl_space_type = 'IMAGE_EDITOR'
    bl_region_type = 'UI'
    bl_category = 'AI Gen'
    bl_parent_id = "AI_PT_image_generation"
    
    def draw(self, context):
        """绘制模板面板"""
        layout = self.layout
        
        layout.label(text="Quick Templates:")
        
        # 常用模板 - 分别创建操作符
        row = layout.row()
        row.operator("ai_img_gen.template_landscape", text="", icon='PASTEDOWN')
        row.label(text="A beautiful landscape...")
        
        row = layout.row()
        row.operator("ai_img_gen.template_city", text="", icon='PASTEDOWN')
        row.label(text="A futuristic city...")
        
        row = layout.row()
        row.operator("ai_img_gen.template_fantasy", text="", icon='PASTEDOWN')
        row.label(text="A fantasy creature...")
        
        row = layout.row()
        row.operator("ai_img_gen.template_abstract", text="", icon='PASTEDOWN')
        row.label(text="An abstract pattern...")


class AI_OT_InsertTemplate(Operator):
    """插入模板操作符"""
    
    bl_idname = "ai_img_gen.insert_template"
    bl_label = "Insert Template"
    bl_description = "Insert prompt template"
    
    template: StringProperty()
    
    def execute(self, context):
        """执行模板插入"""
        context.scene.ai_img_gen.settings.prompt = self.template
        return {'FINISHED'}


def register():
    bpy.utils.register_class(AI_PT_ImageGeneration)
    bpy.utils.register_class(AI_PT_History)
    bpy.utils.register_class(AI_UL_HistoryList)
    bpy.utils.register_class(AI_PT_Templates)
    bpy.utils.register_class(AI_OT_InsertTemplate)


def unregister():
    bpy.utils.unregister_class(AI_OT_InsertTemplate)
    bpy.utils.unregister_class(AI_PT_Templates)
    bpy.utils.unregister_class(AI_UL_HistoryList)
    bpy.utils.unregister_class(AI_PT_History)
    bpy.utils.unregister_class(AI_PT_ImageGeneration)