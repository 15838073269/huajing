# Blender AI插件架构设计文档

## 🎯 项目概述

本项目将原有的Web AI生图插件（基于JavaScript/HTML）转换为Blender Python插件，保持核心功能的同时适配Blender的架构和用户界面。

## 🏗️ 整体架构

### 文件结构
```
blender_ai_image_gen/
├── __init__.py          # 插件主入口和注册
├── preferences.py      # 偏好设置类
├── properties.py       # Blender属性定义
├── operators.py        # 操作符实现
├── ui.py              # UI面板定义
├── utils.py           # 工具函数
├── README.md          # 使用说明
└── requirements.txt   # 依赖说明
```

### 架构层次

1. **UI层** (`ui.py`)
   - Blender面板和控件
   - 用户交互界面
   - 参数输入和显示

2. **业务逻辑层** (`operators.py`)
   - 核心功能实现
   - API调用处理
   - 数据处理和转换

3. **数据层** (`properties.py`)
   - Blender数据属性
   - 状态管理和持久化
   - 历史记录存储

4. **配置层** (`preferences.py`)
   - 全局配置管理
   - API设置
   - 默认参数

5. **工具层** (`utils.py`)
   - 通用功能函数
   - 图像处理工具
   - API通信辅助

## 🔄 数据流设计

### 生成流程

```
用户输入
    ↓
UI层收集参数
    ↓
业务层验证和处理
    ↓
API调用（后台线程）
    ↓
结果处理和转换
    ↓
Blender图像创建
    ↓
历史记录保存
```

### 详细流程

1. **参数收集**
   ```python
   # UI层 -> 业务层
   prompt = settings.prompt
   resolution = get_resolution(settings)
   model = settings.model
   quality = settings.quality
   ```

2. **API调用**
   ```python
   # 业务层
   if mode == 'text2img':
       response = call_text2img_api(prompt, params)
   elif mode == 'img2img':
       image_b64 = image_to_base64(active_image)
       response = call_img2img_api(prompt, image_b64, params)
   ```

3. **结果处理**
   ```python
   # 数据转换
   for image_data in response.data:
       blender_image = create_blender_image(image_data)
       save_to_history(image_params, duration)
   ```

## 🔌 与原插件的映射关系

### 功能映射

| 原插件功能 | Blender实现 | 说明 |
|-----------|------------|------|
| 窗口UI | UI面板 | 转换为Blender的Panel系统 |
| 画布集成 | 图像编辑器集成 | 使用Blender的IMAGE_EDITOR |
| 本地存储 | Blender属性 | 使用PointerProperty和CollectionProperty |
| API管理 | 偏好设置 | 在AddonPreferences中配置 |
| 历史记录 | 集合属性 | 使用CollectionProperty存储 |
| 提示词模板 | 快速模板面板 | 预设模板和自定义模板 |

### API映射

| 原插件API | Blender实现 |
|----------|------------|
| CanvasImages.place() | bpy.data.images.new() |
| localStorage | bpy.types.PropertyGroup |
| DOM操作 | bpy.types.UIList |
| fetch API | requests库 |
| FormData | Python字典/dict |

## 🎨 UI设计

### 面板布局

```
+─────────────────────────────────+
│ Image Editor > AI Gen           │
+─────────────────────────────────+
│ [Text2Img] [Img2Img]           │ ← 模式选择
+─────────────────────────────────+
│ Prompt:                        │
│ [多行文本输入框        ]        │
+─────────────────────────────────+
│ Resolution:                    │
│ [Preset] [Custom]              │
│ 下拉选择/宽高输入              │
+─────────────────────────────────┤
│ Generation Settings:           │
│ Model: [下拉选择]              │
│ Quality: [下拉选择]            │
│ Format: [下拉选择]             │
│ Num Images: [数字输入]         │
+─────────────────────────────────┤
│ Status: Generating...          │
│ Progress: [进度条]             │
+─────────────────────────────────┤
│ [Generate Button]              │
+─────────────────────────────────+
```

### 历史记录面板

```
+─────────────────────────────────+
│ Generation History              │
│ [Clear Button]                  │
+─────────────────────────────────+
│ 2026-01-01 12:30:45 (15.2s)     │
│ Model: gpt-image-2              │
│ Resolution: 1024x1024          │
│ Prompt: A beautiful landscape..│
│ [Use Prompt]                    │
+─────────────────────────────────+
```

## ⚡ 性能考虑

### 异步处理

1. **后台线程生成**
   ```python
   class GenerationThread(threading.Thread):
       def run(self):
           # API调用在后台线程执行
           response = self.call_api()
           # 结果通过bpy.app.timers处理
           bpy.app.timers.register(self.process_result)
   ```

2. **UI响应性**
   - 使用模态操作符保持UI响应
   - 定期更新进度状态
   - 避免阻塞主线程

### 内存管理

1. **图像缓存**
   - 及时清理临时文件
   - 限制历史记录数量
   - 使用适当的数据格式

2. **资源释放**
   - 插件卸载时清理所有资源
   - 生成完成后释放临时数据
   - 正确处理异常情况

## 🔒 安全考虑

### API密钥保护

1. **存储安全**
   - 使用Blender的安全存储机制
   - 不在日志中输出密钥信息
   - 提供密钥清除功能

2. **网络传输**
   - 使用HTTPS加密传输
   - 验证API端点证书
   - 处理网络错误和超时

## 🧪 测试策略

### 单元测试

```python
class TestAIImageGen(unittest.TestCase):
    def test_resolution_parsing(self):
        w, h = utils.parse_resolution("1024x768")
        self.assertEqual(w, 1024)
        self.assertEqual(h, 768)
    
    def test_api_call_format(self):
        # 测试API调用格式
        pass
```

### 集成测试

1. **UI测试**
   - 面板显示和布局
   - 参数输入和验证
   - 按钮响应和状态

2. **功能测试**
   - 文生图流程
   - 图生图流程
   - 历史记录功能
   - 模板系统

## 📦 部署方案

### 打包发布

1. **文件打包**
   ```bash
   zip -r blender_ai_image_gen.zip blender_ai_image_gen/
   ```

2. **版本管理**
   - 更新`bl_info`中的版本号
   - 更新README中的更新日志
   - 测试Blender兼容性

### 安装验证

1. **功能验证**
   - 插件安装和启用
   - API配置和连接
   - 基本生成功能
   - 历史记录功能

2. **兼容性测试**
   - 不同Blender版本
   - 不同操作系统
   - 不同Python版本

## 🔄 未来扩展

### 计划功能

1. **高级功能**
   - 支持更多AI模型
   - 批量处理功能
   - 图像编辑工具集成
   - 自定义训练模型支持

2. **UI增强**
   - 实时预览窗口
   - 图像比较工具
   - 批量管理界面
   - 高级参数调节

3. **性能优化**
   - 本地缓存系统
   - 分布式生成
   - GPU加速处理
   - 智能队列管理

---

这个架构设计确保了插件的稳定性、可维护性和用户体验，同时保持了与原插件功能的兼容性。