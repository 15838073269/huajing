# 音效合成插件 (Synth SFX) 设计文档

## 一、概述

在画境 v66 中开发一个 **数学波形音效合成器** 插件，用正弦/方波/锯齿/三角/脉冲(PWM)等基础波形 + ADSR 包络 + 滤波 + 噪声层，实时合成并导出游戏音效。

### 核心能力

- 多波形振荡器（Sin / Square / Sawtooth / Triangle / Pulse PWM / Noise）
- ADSHR 包络控制（起音/衰减/维持/释音）
- 滤波器（Low-pass / High-pass / Band-pass / Notch）
- 脉冲波 PWM：通过 PeriodicWave 傅里叶级数合成，占空比 5%-95% 可调
- 双图层混合（振荡器 + 白噪声层）
- 预设系统（92 种游戏音效预设，10 个类别）
- 实时预览播放（共享 AudioContext）
- WAV 导出下载（独立 OfflineAudioContext）

## 二、技术方案

### 音频引擎

使用 **Web Audio API**，全在浏览器端运行，无外部依赖：

- `OscillatorNode` — 基础波形生成（含 `PeriodicWave` 脉冲波）
- `GainNode` — 音量/包络控制
- `BiquadFilterNode` — 滤波
- `AudioBuffer` + `OfflineAudioContext` — 离线渲染导出 WAV
- `setValueAtTime` / `linearRampToValueAtTime` / `exponentialRampToValueAtTime` — 自动化参数
- `AudioBufferSourceNode` — 白噪声层

### 插件架构

```
SynthSFX (id: 'synth-sfx')
├── UI: Type A 独立窗口（固定覆盖层，可拖拽）
│   ├── 波形参数区（波形类型/起始频率/终止频率/曲线/时长/占空比）
│   ├── ADSR 包络区（Attack/Decay/Sustain/Release + 音量）
│   ├── 滤镜区（类型/截止频率/Q值/噪声混合比）
│   ├── 波形预览 Canvas
│   └── 预设下拉框 + 试听/导出按钮
├── 引擎: 合成核心
│   ├── _getOsc(type, duty) → 支持5种波形 + PeriodicWave 脉冲波
│   ├── _applyFreq(osc, params) → 线性/指数频率扫描
│   ├── _applyEnvelope(gainNode, params) → ADSHR 包络
│   ├── _applyFilter(source, gain, params) → 4种滤波器
│   ├── _createNoise(ctx, dur) → 白噪声层
│   └── _synthOne(ctx, params) → 完整合成管道（振荡器+噪声双图层）
├── 预设库: 92 种游戏音效预设（10 个类别）
└── 导出: WAV 下载（OfflineAudioContext 离线渲染）
```

### 音效设计原理

每种游戏音效 = 基础波形 + 频率变化曲线 + 包络 + 可选滤波 + 可选噪声混合，例如：

```
跳跃:    Sin 波, 频率 200→600Hz (线性上升), 短衰减 0.12s
金币:    Triangle 波, 频率 800→1600Hz (线性上升), 衰减 0.1s
爆炸:    Noise 主导, 频率 150→30Hz (指数下降), 长衰减 0.5s
射击:    Square 波, 频率 800→100Hz (线性骤降), 极短 0.05s
升级:    Sin 波, 频率 400→1200Hz (线性上升), 衰减 0.6s
```

### 合成引擎流程图

```
                    ┌──────────────┐
                    │ Oscillator   │
                    │ (Sin/Square/ │
                    │ Saw/Tri/PWM) │
                    └──────┬───────┘
                           │ frequency ramp
                    ┌──────▼───────┐
                    │ GainNode     │ ← ADSR envelope
                    └──────┬───────┘
                           │
               ┌───────────┬───────────┐
               │                       │
        ┌──────▼──────┐        ┌──────▼──────┐
        │ BiquadFilter│        │ AudioBuffer │
        │ (LPF/HPF/   │        │ SourceNode  │
        │  BP/Notch)  │        │ (WhiteNoise)│
        └──────┬──────┘        └──────┬──────┘
               │                      │
               └──────────┬───────────┘
                          │
                  ┌───────▼───────┐
                  │ ctx.destination │
                  └───────────────┘
```

## 三、UI 设计

### 主布局（530×530 固定窗口）

```
┌──────────────────────────────────────────────────────┐
│ [≈] 音效合成    92                    [▼ 预设] [▶] [⬇] [关] │  ← 标题栏（可拖拽）
├──────────────────────────────────────────────────────┤
│ ┌─ 波形 / 曲线 ────────────────────────────────────┐ │
│ │  波形 [Sin ▼]  起始 [●══] 200  终止 [●══] 600   │ │
│ │  曲线 [线性 ▼]  时长 [●══] 0.12s  占空比 [●══] 50%│ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ A/D/S/R ────────────────────────────────────────┐ │
│ │  A [●══] D [●══] S [●══] R [●══]                  │ │
│ │  音量 [●══════════════════════]                    │ │
│ └──────────────────────────────────────────────────┘ │
│ ┌─ 滤镜 / 噪声 ────────────────────────────────────┐ │
│ │  滤镜 [无 ▼]  截止 [●══] 200  Q [●══] 0.5        │ │
│ │  噪声 [●══════════════════] 0%                    │ │
│ └──────────────────────────────────────────────────┘ │
│ [~~~~~~~~~~~~~~~~~ 波形预览 ~~~~~~~~~~~~~~~~]          │
│  调整参数后试听或导出                                  │
└──────────────────────────────────────────────────────┘
```

### 控件规范

- 所有 slider 使用 `<input type="range">`
- 波形预览使用 Canvas 2D 绘制频率曲线
- 遵循深色主题配色（背景 #0f3460，标题 #16213e，强调 #e94560，文字 #38bdf8）
- preset 下拉框即时切换所有参数
- 占空比控件仅在 pulse 波形下生效

## 四、预设列表（92 种游戏音效，10 个类别）

### 预设数据字段
```
id:     唯一标识
cat:    类别（移动/武器/道具/强化/伤害/UI/环境/生物/卡通）
name:   显示名称
type:   波形类型（sine/square/sawtooth/triangle/pulse）
fS:     起始频率 (Hz)
fE:     终止频率 (Hz)
curve:  频率变化曲线（linear/exponential）
dur:    持续时间 (s)
att:    起音时间 (s)
dec:    衰减时间 (s)
sus:    维持电平 (0-1)
rel:    释音时间 (s)
vol:    音量 (0-1)
filt:   滤镜类型（none/lowpass/highpass/bandpass/notch）
fF:     滤镜截止频率 (Hz)
fQ:     滤镜 Q 值
noise:  噪声混合比 (0-1)
duty:   脉冲波占空比 % (5-95)，仅 pulse 波形有效
```

### 移动/动作 (10)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 1 | jump | 跳跃 Jump | Sin | 200→600 | 0.12s | 轻快上升 |
| 2 | dbljump | 二段跳 D-Jump | Triangle | 300→1200 | 0.18s | 两级上升 |
| 3 | land | 落地 Land | Sin+Noise | 200→80 | 0.08s | 短促撞击 |
| 4 | dash | 冲刺 Dash | Pulse(30%) | 500→200 | 0.1s | 快速下滑 |
| 5 | slide | 滑铲 Slide | Sin+Noise | 300→100 | 0.2s | 摩擦感 |
| 6 | crouch | 蹲下 Crouch | Sin+Noise | 180→80 | 0.1s | 低沉 |
| 7 | roll | 翻滚 Roll | Saw+Noise | 250→150 | 0.15s | 滚动感 |
| 8 | walljump | 蹬墙跳 | Square | 300→900 | 0.1s | 反弹上升 |
| 9 | bounce | 弹跳 Bounce | Pulse(35%) | 400→200 | 0.06s | 弹性 |
| 10 | stomp | 踩踏 Stomp | Square+Noise | 150→40 | 0.12s | 沉重撞击 |

### 武器 (16)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 11 | shoot | 射击 Shoot | Square+Noise | 800→100 | 0.05s | 极短爆裂 |
| 12 | rifle | 步枪 Rifle | Pulse(25%)+Noise | 900→80 | 0.07s | 点射感 |
| 13 | shotgun | 霰弹 Shotgun | Noise | 500→50 | 0.12s | 扩散轰鸣 |
| 14 | machinegun | 机枪 MG | Square+Noise | 600→120 | 0.04s | 快速连射 |
| 15 | laser | 激光 Laser | Saw+Noise | 1200→200 | 0.3s | sci-fi sweep |
| 16 | bow | 弓箭 Bow | Sin | 300→600 | 0.08s | 弦音 |
| 17 | magic-missile | 魔法弹 | Triangle | 400→800 | 0.15s | 魔法飞弹 |
| 18 | fireball | 火球 Fireball | Saw+Noise | 250→600 | 0.25s | 火焰呼啸 |
| 19 | iceshard | 冰锥 Ice | Triangle+Noise | 800→1500 | 0.12s | 清脆尖利 |
| 20 | lightning | 闪电 Lightning | Saw+Noise | 200→1200 | 0.2s | 劈啪爆裂 |
| 21 | thunder-spell | 雷击 | Square+Noise | 100→40 | 0.4s | 低频轰鸣 |
| 22 | slash | 挥砍 Slash | Noise | 500→200 | 0.06s | 切割声 |
| 23 | punch | 拳头 Punch | Square+Noise | 200→50 | 0.05s | 短促撞击 |
| 24 | sword-clash | 剑碰撞 | Pulse(20%)+Noise | 1200→600 | 0.08s | 金属碰撞 |
| 25 | shield-block | 格挡 Block | Sin+Noise | 600→400 | 0.06s | 钝器挡击 |
| 26 | grenade | 手雷 Grenade | Sin+Noise | 500→200 | 0.3s | 引信声 |

### 道具/收集 (8)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 27 | coin | 金币 Coin | Triangle | 800→1600 | 0.1s | 清脆上升 |
| 28 | diamond | 钻石 Diamond | Sin | 1000→2000 | 0.15s | 更高更亮 |
| 29 | gem-ruby | 红宝石 Ruby | Pulse(40%) | 700→1800 | 0.12s | 温暖闪光 |
| 30 | gem-sapphire | 蓝宝石 | Triangle | 900→2200 | 0.14s | 冷冽闪烁 |
| 31 | heart | 红心 Heart | Sin | 300→700 | 0.18s | 柔和上扬 |
| 32 | key | 钥匙 Key | Sin | 400→800 | 0.2s | 阶梯上升 |
| 33 | star | 星星 Star | Triangle | 600→2400 | 0.25s | 璀璨上升 |
| 34 | mushroom | 蘑菇 | Pulse(30%) | 200→400 | 0.15s | 低沉可爱 |

### 强化 (10)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 35 | powerup | 升级 PowerUp | Sin | 400→1200 | 0.6s | 经典升级 |
| 36 | speedboost | 加速 Speed | Pulse(25%) | 500→1500 | 0.3s | 急速上升 |
| 37 | shield | 护盾 Shield | Sin+Noise | 300→800 | 0.4s | 能量护罩 |
| 38 | invisible | 隐身 | Triangle+Noise | 800→400 | 0.5s | 神秘闪烁 |
| 39 | multiball | 多重球 Multi | Triangle | 500→1500 | 0.3s | 弹跳感 |
| 40 | extralife | 加命 Extra Life | Sin | 300→900 | 0.8s | 宏大上升 |
| 41 | buff-str | 力量强化 STR | Square+Noise | 150→400 | 0.35s | 厚重充能 |
| 42 | buff-spd | 速度强化 SPD | Pulse(30%) | 600→1800 | 0.25s | 轻快上升 |
| 43 | buff-jump | 跳跃强化 JMP | Triangle | 300→1500 | 0.2s | 弹性上升 |
| 44 | megamorph | 巨大化 Mega | Saw+Noise | 100→300 | 0.5s | 沉重膨胀 |

### 伤害/负面 (10)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 45 | hurt | 受击 Hurt | Square+Noise | 300→100 | 0.1s | 钝痛感 |
| 46 | explosion | 爆炸 Explosion | Noise | 150→30 | 0.5s | 低频轰鸣 |
| 47 | poison | 中毒 Poison | Saw+Noise | 200→100 | 0.4s | 下降嗡鸣 |
| 48 | bleed | 流血 Bleed | Sin+Noise | 400→200 | 0.15s | 持续衰减 |
| 49 | burn | 灼烧 Burn | Noise | 300→100 | 0.3s | 嘈杂燃烧 |
| 50 | freeze | 冻结 Freeze | Triangle+Noise | 800→300 | 0.35s | 冰晶凝结 |
| 51 | shock | 电击 Shock | Square+Noise | 200→800 | 0.1s | 噼啪冲击 |
| 52 | curse | 诅咒 Curse | Saw+Noise | 150→60 | 0.45s | 阴森下降 |
| 53 | petrify | 石化 Petrify | Pulse(15%) | 200→50 | 0.3s | 僵硬凝固 |
| 54 | critical | 暴击 Critical | Noise | 1000→300 | 0.06s | 强力爆裂 |

### UI/菜单 (12)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 55 | hover | 悬停 Hover | Sin | 600→650 | 0.05s | 极短提示 |
| 56 | confirm | 确认 Confirm | Sin | 500→500 | 0.2s | 稳定回旋 |
| 57 | cancel | 取消 Cancel | Square | 400→0 | 0.3s | 抖动下降 |
| 58 | notif | 通知 | Triangle | 800→1200 | 0.08s | 清脆提示 |
| 59 | error | 错误 Error | Square | 300→100 | 0.25s | 下降低沉 |
| 60 | success | 成功 Success | Sin | 500→1000 | 0.12s | 亮色上升 |
| 61 | unlock | 解锁 Unlock | Triangle | 400→1200 | 0.3s | 多级上升 |
| 62 | levelup | 升级 Level Up | Sin+Noise | 400→800 | 0.6s | 经典升级音 |
| 63 | pageflip | 翻页 Page Flip | Noise | 400→200 | 0.05s | 纸页声 |
| 64 | typewriter | 打字 | Pulse(20%)+Noise | 1000→800 | 0.03s | 点击声 |
| 65 | dropdown | 下拉 Dropdown | Sin | 400→200 | 0.05s | 短促下降 |
| 66 | checkbox | 勾选 Check | Triangle | 600→900 | 0.06s | 短促上升 |

### 环境 (8)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 67 | wind | 风声 Wind | Noise | 200→100 | 1.5s | 持续呼啸 |
| 68 | rain | 雨声 Rain | Noise | 500→300 | 1.0s | 淅沥声 |
| 69 | thunder | 雷声 Thunder | Saw+Noise | 80→20 | 0.6s | 低频轰鸣 |
| 70 | fire-crackle | 火焰 Fire | Noise | 400→200 | 0.5s | 噼啪声 |
| 71 | water-drip | 水滴 Water | Sin+Noise | 800→1200 | 0.06s | 短促滴落 |
| 72 | splash | 水花 Splash | Noise | 600→200 | 0.08s | 泼溅声 |
| 73 | breaking | 碎裂 Break | Noise | 800→300 | 0.08s | 破碎声 |
| 74 | creak | 吱嘎 Creak | Saw+Noise | 200→100 | 0.25s | 木门摩擦 |

### 生物/怪物 (10)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 75 | growl | 低吼 Growl | Saw+Noise | 100→60 | 0.4s | 低频率震动 |
| 76 | hiss | 蛇嘶 Hiss | Noise | 800→400 | 0.3s | 尖锐嘶声 |
| 77 | screech | 尖啸 Screech | Saw+Noise | 1200→400 | 0.25s | 刺耳尖叫 |
| 78 | roar | 咆哮 Roar | Saw+Noise | 120→50 | 0.5s | 宏大低沉 |
| 79 | wingflap | 振翅 Wing | Pulse(25%)+Noise | 300→500 | 0.04s | 快速拍打 |
| 80 | slime | 史莱姆 Slime | Sin+Noise | 150→80 | 0.12s | 黏糊感 |
| 81 | bat | 蝙蝠 Bat | Pulse(20%)+Noise | 600→1000 | 0.04s | 高频振翅 |
| 82 | howl | 狼嚎 Howl | Sin+Noise | 300→600 | 0.6s | 悠长嚎叫 |
| 83 | buzz | 嗡嗡 Buzz | Pulse(15%)+Noise | 200→220 | 0.3s | 持续嗡鸣 |
| 84 | footstep-heavy | 沉重脚步 | Square+Noise | 80→30 | 0.08s | 沉重脚步声 |

### 卡通/特殊 (8)
| # | ID | 名称 | 波形 | 频率 | 时长 | 特点 |
|---|-----|------|------|------|------|------|
| 85 | boing | 弹簧 Boing | Sin | 300→600 | 0.2s | 弹力反弹 |
| 86 | zip | 咻 Zip | Sin | 500→2000 | 0.08s | 快速上升 |
| 87 | pop | 啵 Pop | Triangle | 400→800 | 0.04s | 气泡破灭 |
| 88 | slidewhistle | 滑哨 Whistle | Sin | 200→1200 | 0.3s | 滑稽上升 |
| 89 | splat | 啪叽 Splat | Noise | 300→80 | 0.06s | 短促压扁 |
| 90 | alarm | 警报 Alarm | Square+Noise | 400→800 | 0.5s | 反复报警 |
| 91 | bell | 铃声 Bell | Sin | 800→1200 | 0.3s | 清脆铃声 |
| 92 | whistle | 哨声 Whistle | Sin | 600→1200 | 0.15s | 口哨声 |

## 五、文件结构

```
js/skills/synth-sfx.js     ← 主插件文件（~680行，含引擎+UI+预设+导出）
js/plugins.js              ← 插件注册清单
docs/synth-sfx-design.md   ← 本文档
```

## 六、实现状态

### 已完成
- [x] 设计文档（本文档）
- [x] 插件骨架：id/name/icon/activate/deactivate
- [x] 合成引擎核心：_getOsc / _applyFreq / _applyEnvelope / _applyFilter
- [x] 脉冲波 PWM（PeriodicWave 傅里叶级数）
- [x] 白噪声层混合
- [x] 离线渲染 + WAV 导出
- [x] Type A 独立窗口（可拖拽）
- [x] 波形参数控件（波形/频率/曲线/时长/占空比）
- [x] ADSR 滑块
- [x] 滤镜控件（4种类型）
- [x] 噪声混合控件
- [x] 波形预览 Canvas（频率曲线）
- [x] 92 种预设数据（10 个类别）
- [x] 预设切换功能
- [x] 注册到 PLUGIN_LIST（编号 20）

### 未实现（设计阶段考虑，当前暂不实现）
- LFO 调制（频率/音量/滤波器 cutoff）
- 多层混合（当前仅双层：振荡器 + 噪声）
- 波形选择中的 noise 选项（纯噪声由噪声混合比 >80% 自动切换）

## 七、技术要点

### 脉冲波 PWM 合成

```javascript
// 通过 PeriodicWave 傅里叶级数合成脉冲波
function createPulseWave(ctx, duty) {
    var real = new Float32Array(32);
    var imag = new Float32Array(32);
    for (var n = 1; n < 32; n++) {
        imag[n] = Math.sin(Math.PI * n * duty) / n;
    }
    return new PeriodicWave(ctx, {real: real, imag: imag});
}
```

### 双图层合成策略

- 主层：振荡器（5种波形）+ ADSR 包络 + 频率扫描 + 滤镜
- 噪声层：白噪声 + 低通滤波 + 独立包络
- 噪声混合比 < 1% 时不创建噪声层（性能优化）
- 噪声混合比 > 80% 且非脉冲波时，自动切换为纯噪声模式

### Web Audio API 离线渲染

```javascript
var offlineCtx = new OfflineAudioContext(1, sampleRate * duration, sampleRate);
// ... 连接节点 ...
var renderedBuffer = await offlineCtx.startRendering();
```

### 包络实现

```
Attack:  gain 0 → volume  (linearRamp, t=0~attackTime)
Decay:   gain volume → sustainLevel*volume (exponentialRamp)
Sustain: gain = sustainLevel*volume (hold)
Release: gain sustainLevel*volume → 0 (exponentialRamp)
```

### 频率变化曲线

```
linear:       startFreq → endFreq 线性变化
exponential:  startFreq → endFreq 指数变化
```

## 八、插件注册

```javascript
// js/plugins.js PLUGIN_LIST
'js/skills/synth-sfx.js',

// PLUGIN_NUMBERS
'synth-sfx': 20,
```
