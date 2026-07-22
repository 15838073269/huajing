/**
 * 音效合成插件 (Synth SFX)
 * 数学波形合成器：正弦/方波/锯齿/三角/脉冲(PWM)+ADSR包络+滤波+噪声
 * 92种游戏音效预设，覆盖动作/武器/道具/魔法/UI/环境/生物/卡通
 * 试听预览+WAV导出下载
 */
var SynthSFX = {
    id: 'synth-sfx', name: '音效合成', icon: '<span style="color:#38bdf8;">波</span>', category: '音频',
    _world: null, _overlay: null, _onDocMove: null, _onDocUp: null, _ctx: null, _pulseWaves: {}, _customWaves: {},

    TEXTS: {
        TITLE: '音效合成', PRESET: '预设', PREVIEW: '试听', EXPORT: '导出', CLOSE: '关',
        LBL_WAVE: '波形', LBL_FREQ_START: '起始', LBL_FREQ_END: '终止', LBL_CURVE: '曲线',
        LBL_DURATION: '时长', LBL_ATTACK: '起音', LBL_DECAY: '衰减', LBL_SUSTAIN: '维持',
        LBL_RELEASE: '释音', LBL_VOLUME: '音量', LBL_FILTER: '滤镜', LBL_FILTER_FREQ: '截止',
        LBL_FILTER_Q: '共振', LBL_NOISE: '噪声', LBL_DUTY: '占空比',
        CURVE_LINEAR: '线性', CURVE_EXP: '指数',
        FILTER_NONE: '无', FILTER_LOWPASS: '低通', FILTER_HIGHPASS: '高通',
        FILTER_BANDPASS: '带通', FILTER_NOTCH: '带阻',
        WAVE_SINE: '正弦', WAVE_SQUARE: '方波', WAVE_SAWTOOTH: '锯齿', WAVE_TRIANGLE: '三角',
        WAVE_PULSE: '脉冲PWM', WAVE_NOISE: '白噪声', WAVE_ORGAN: '风琴', WAVE_BRIGHT: '明亮', WAVE_BELL: '钟声',
        MSG_RENDERING: '渲染中...', MSG_DONE: '导出完成', MSG_EMPTY: '调整参数后试听或导出',
    },

    PRESETS: [
        // ========== 移动/动作 (10) ==========
        {id:'jump',     cat:'移动', name:'跳跃 Jump',        type:'sine',     fS:200, fE:600,  curve:'linear',     dur:.12, att:.003,dec:.02, sus:0,  rel:.05, vol:.7,  filt:'highpass',fF:200,fQ:.5, noise:0,   duty:50},
        {id:'dbljump',  cat:'移动', name:'二段跳 D-Jump',    type:'triangle', fS:300, fE:1200, curve:'linear',     dur:.18, att:.003,dec:.03, sus:0,  rel:.06, vol:.65, filt:'highpass',fF:300,fQ:.5, noise:0,   duty:50},
        {id:'land',     cat:'移动', name:'落地 Land',        type:'sine',     fS:200, fE:80,   curve:'exponential',dur:.08, att:.001,dec:.005,sus:0,  rel:.02, vol:.5,  filt:'lowpass', fF:300,fQ:1,  noise:.3,  duty:50},
        {id:'dash',     cat:'移动', name:'冲刺 Dash',        type:'pulse',    fS:500, fE:200,  curve:'exponential',dur:.1,  att:.002,dec:.02, sus:0,  rel:.04, vol:.6,  filt:'lowpass', fF:2000,fQ:.5, noise:.1,  duty:30},
        {id:'slide',    cat:'移动', name:'滑铲 Slide',       type:'sine',     fS:300, fE:100,  curve:'exponential',dur:.2,  att:.005,dec:.02, sus:0,  rel:.08, vol:.5,  filt:'lowpass', fF:500,fQ:1.5,noise:.25, duty:50},
        {id:'crouch',   cat:'移动', name:'蹲下 Crouch',      type:'sine',     fS:180, fE:80,   curve:'exponential',dur:.1,  att:.01, dec:.02, sus:0,  rel:.04, vol:.4,  filt:'lowpass', fF:400,fQ:1,  noise:.15, duty:50},
        {id:'roll',     cat:'移动', name:'翻滚 Roll',        type:'sawtooth', fS:250, fE:150,  curve:'exponential',dur:.15, att:.003,dec:.03, sus:0,  rel:.05, vol:.55, filt:'lowpass', fF:600,fQ:1,  noise:.2,  duty:50},
        {id:'walljump', cat:'移动', name:'蹬墙跳 Wall Jump', type:'square',   fS:300, fE:900,  curve:'linear',     dur:.1,  att:.002,dec:.015,sus:0,  rel:.04, vol:.65, filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
        {id:'bounce',   cat:'移动', name:'弹跳 Bounce',      type:'pulse',    fS:400, fE:200,  curve:'exponential',dur:.06, att:.001,dec:.01, sus:0,  rel:.02, vol:.55, filt:'bandpass',fF:1200,fQ:2, noise:0,   duty:35},
        {id:'stomp',    cat:'移动', name:'踩踏 Stomp',       type:'square',   fS:150, fE:40,   curve:'exponential',dur:.12, att:.002,dec:.02, sus:0,  rel:.05, vol:.7,  filt:'lowpass', fF:300,fQ:1.5,noise:.35, duty:50},
        // ========== 武器 (16) ==========
        {id:'shoot',    cat:'武器', name:'射击 Shoot',       type:'square',   fS:800, fE:100,  curve:'linear',     dur:.05, att:.001,dec:.005,sus:0,  rel:.02, vol:.6,  filt:'lowpass', fF:3000,fQ:.5, noise:.1,  duty:50},
        {id:'rifle',    cat:'武器', name:'步枪 Rifle',       type:'pulse',    fS:900, fE:80,   curve:'linear',     dur:.07, att:.001,dec:.01, sus:0,  rel:.03, vol:.65, filt:'lowpass', fF:2500,fQ:.5, noise:.15, duty:25},
        {id:'shotgun',  cat:'武器', name:'霰弹 Shotgun',     type:'noise',    fS:500, fE:50,   curve:'exponential',dur:.12, att:.001,dec:.02, sus:0,  rel:.05, vol:.75, filt:'lowpass', fF:2000,fQ:1,  noise:.8,  duty:50},
        {id:'machinegun',cat:'武器',name:'机枪 MG',          type:'square',   fS:600, fE:120,  curve:'linear',     dur:.04, att:.001,dec:.005,sus:0,  rel:.01, vol:.55, filt:'lowpass', fF:2000,fQ:.5, noise:.2,  duty:50},
        {id:'laser',    cat:'武器', name:'激光 Laser',       type:'sawtooth', fS:1200,fE:200,  curve:'exponential',dur:.3,  att:.005,dec:.05, sus:.1, rel:.1,  vol:.55, filt:'lowpass', fF:4000,fQ:.5, noise:.2,  duty:50},
        {id:'bow',      cat:'武器', name:'弓箭 Bow',         type:'sine',     fS:300, fE:600,  curve:'linear',     dur:.08, att:.01, dec:.02, sus:0,  rel:.03, vol:.5,  filt:'highpass',fF:300,fQ:.5, noise:.05, duty:50},
        {id:'magic-missile',cat:'武器',name:'魔法弹 Magic',  type:'triangle', fS:400, fE:800,  curve:'linear',     dur:.15, att:.005,dec:.03, sus:.1, rel:.05, vol:.55, filt:'none',    fF:0,fQ:0,  noise:.05, duty:50},
        {id:'fireball', cat:'武器', name:'火球 Fireball',    type:'sawtooth', fS:250, fE:600,  curve:'linear',     dur:.25, att:.008,dec:.05, sus:.15,rel:.08, vol:.6,  filt:'lowpass', fF:800,fQ:1,  noise:.3,  duty:50},
        {id:'iceshard', cat:'武器', name:'冰锥 Ice',         type:'triangle', fS:800, fE:1500, curve:'linear',     dur:.12, att:.002,dec:.02, sus:0,  rel:.04, vol:.55, filt:'highpass',fF:500,fQ:1,  noise:.1,  duty:50},
        {id:'lightning',cat:'武器', name:'闪电 Lightning',   type:'sawtooth', fS:200, fE:1200, curve:'linear',     dur:.2,  att:.001,dec:.04, sus:.05,rel:.08, vol:.7,  filt:'bandpass',fF:2000,fQ:2, noise:.3,  duty:50},
        {id:'thunder-spell',cat:'武器',name:'雷击 Thunder',  type:'square',   fS:100, fE:40,   curve:'exponential',dur:.4,  att:.002,dec:.08, sus:0,  rel:.12, vol:.8,  filt:'lowpass', fF:300,fQ:1,  noise:.5,  duty:50},
        {id:'slash',    cat:'武器', name:'挥砍 Slash',       type:'noise',    fS:500, fE:200,  curve:'exponential',dur:.06, att:.001,dec:.015,sus:0,  rel:.02, vol:.6,  filt:'bandpass',fF:2000,fQ:3, noise:.7,  duty:50},
        {id:'punch',    cat:'武器', name:'拳头 Punch',       type:'square',   fS:200, fE:50,   curve:'exponential',dur:.05, att:.001,dec:.008,sus:0,  rel:.015,vol:.6,  filt:'lowpass', fF:400,fQ:1,  noise:.2,  duty:50},
        {id:'sword-clash',cat:'武器',name:'剑碰撞 Clash',    type:'pulse',    fS:1200,fE:600,  curve:'exponential',dur:.08, att:.001,dec:.02, sus:0,  rel:.03, vol:.65, filt:'bandpass',fF:3000,fQ:4, noise:.15, duty:20},
        {id:'shield-block',cat:'武器',name:'格挡 Block',     type:'sine',     fS:600, fE:400,  curve:'linear',     dur:.06, att:.001,dec:.005,sus:0,  rel:.02, vol:.6,  filt:'lowpass', fF:2000,fQ:2, noise:.2,  duty:50},
        {id:'grenade',  cat:'武器', name:'手雷 Grenade',     type:'sine',     fS:500, fE:200,  curve:'exponential',dur:.3,  att:.02, dec:.06, sus:0,  rel:.15, vol:.5,  filt:'bandpass',fF:800,fQ:1,  noise:.1,  duty:50},
        // ========== 道具/收集 (8) ==========
        {id:'coin',     cat:'道具', name:'金币 Coin',        type:'triangle', fS:800, fE:1600, curve:'linear',     dur:.1,  att:.002,dec:.02, sus:0,  rel:.04, vol:.6,  filt:'highpass',fF:500,fQ:.5, noise:0,   duty:50},
        {id:'diamond',  cat:'道具', name:'钻石 Diamond',    type:'sine',     fS:1000,fE:2000, curve:'linear',     dur:.15, att:.002,dec:.03, sus:0,  rel:.06, vol:.55, filt:'highpass',fF:600,fQ:.5, noise:0,   duty:50},
        {id:'gem-ruby', cat:'道具', name:'红宝石 Ruby',     type:'pulse',    fS:700, fE:1800, curve:'linear',     dur:.12, att:.002,dec:.02, sus:0,  rel:.05, vol:.58, filt:'highpass',fF:400,fQ:.5, noise:0,   duty:40},
        {id:'gem-sapphire',cat:'道具',name:'蓝宝石 Sapphire',type:'triangle', fS:900, fE:2200, curve:'linear',     dur:.14, att:.003,dec:.025,sus:0,  rel:.05, vol:.52, filt:'highpass',fF:700,fQ:.5, noise:0,   duty:50},
        {id:'heart',    cat:'道具', name:'红心 Heart',       type:'sine',     fS:300, fE:700,  curve:'linear',     dur:.18, att:.01, dec:.03, sus:.1, rel:.06, vol:.55, filt:'lowpass', fF:1200,fQ:.5, noise:0,   duty:50},
        {id:'key',      cat:'道具', name:'钥匙 Key',         type:'sine',     fS:400, fE:800,  curve:'linear',     dur:.2,  att:.003,dec:.02, sus:0,  rel:.05, vol:.6,  filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
        {id:'star',     cat:'道具', name:'星星 Star',        type:'triangle', fS:600, fE:2400, curve:'linear',     dur:.25, att:.005,dec:.04, sus:.1, rel:.08, vol:.6,  filt:'highpass',fF:500,fQ:.5, noise:0,   duty:50},
        {id:'mushroom', cat:'道具', name:'蘑菇 Mushroom',    type:'pulse',    fS:200, fE:400,  curve:'linear',     dur:.15, att:.01, dec:.03, sus:.2, rel:.06, vol:.5,  filt:'lowpass', fF:800,fQ:.5, noise:0,   duty:30},
        // ========== 强化 (10) ==========
        {id:'powerup',  cat:'强化', name:'升级 PowerUp',     type:'sine',     fS:400, fE:1200, curve:'linear',     dur:.6,  att:.01, dec:.05, sus:.3, rel:.15, vol:.7,  filt:'highpass',fF:300,fQ:.5, noise:0,   duty:50},
        {id:'speedboost',cat:'强化',name:'加速 Speed',       type:'pulse',    fS:500, fE:1500, curve:'linear',     dur:.3,  att:.005,dec:.04, sus:.2, rel:.1,  vol:.65, filt:'highpass',fF:400,fQ:.5, noise:.05, duty:25},
        {id:'shield',   cat:'强化', name:'护盾 Shield',      type:'sine',     fS:300, fE:800,  curve:'linear',     dur:.4,  att:.02, dec:.05, sus:.3, rel:.12, vol:.55, filt:'bandpass',fF:1500,fQ:2, noise:.1,  duty:50},
        {id:'invisible',cat:'强化', name:'隐身 Invisible',   type:'triangle', fS:800, fE:400,  curve:'exponential',dur:.5,  att:.03, dec:.08, sus:.1, rel:.15, vol:.4,  filt:'lowpass', fF:1000,fQ:.5, noise:.2,  duty:50},
        {id:'multiball',cat:'强化', name:'多重球 Multi',     type:'triangle', fS:500, fE:1500, curve:'exponential',dur:.3,  att:.003,dec:.03, sus:0,  rel:.08, vol:.6,  filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
        {id:'extralife',cat:'强化', name:'加命 Extra Life',  type:'sine',     fS:300, fE:900,  curve:'linear',     dur:.8,  att:.02, dec:.06, sus:.4, rel:.2,  vol:.7,  filt:'highpass',fF:200,fQ:.5, noise:0,   duty:50},
        {id:'buff-str', cat:'强化', name:'力量强化 STR',     type:'square',   fS:150, fE:400,  curve:'linear',     dur:.35, att:.008,dec:.04, sus:.2, rel:.12, vol:.65, filt:'lowpass', fF:600,fQ:1,  noise:.1,  duty:50},
        {id:'buff-spd', cat:'强化', name:'速度强化 SPD',     type:'pulse',    fS:600, fE:1800, curve:'linear',     dur:.25, att:.004,dec:.03, sus:.15,rel:.08, vol:.6,  filt:'highpass',fF:500,fQ:.5, noise:0,   duty:30},
        {id:'buff-jump',cat:'强化', name:'跳跃强化 JMP',     type:'triangle', fS:300, fE:1500, curve:'linear',     dur:.2,  att:.003,dec:.025,sus:0,  rel:.06, vol:.65, filt:'highpass',fF:300,fQ:.5, noise:0,   duty:50},
        {id:'megamorph',cat:'强化', name:'巨大化 Mega',      type:'sawtooth', fS:100, fE:300,  curve:'linear',     dur:.5,  att:.02, dec:.08, sus:.3, rel:.15, vol:.7,  filt:'lowpass', fF:500,fQ:1,  noise:.2,  duty:50},
        // ========== 伤害/负面 (10) ==========
        {id:'hurt',     cat:'伤害', name:'受击 Hurt',        type:'square',   fS:300, fE:100,  curve:'linear',     dur:.1,  att:.002,dec:.02, sus:0,  rel:.04, vol:.65, filt:'lowpass', fF:800,fQ:1,  noise:.1,  duty:50},
        {id:'explosion',cat:'伤害', name:'爆炸 Explosion',   type:'noise',    fS:150, fE:30,   curve:'exponential',dur:.5,  att:.005,dec:.1,  sus:0,  rel:.15, vol:.8,  filt:'lowpass', fF:400,fQ:1,  noise:.6,  duty:50},
        {id:'poison',   cat:'伤害', name:'中毒 Poison',      type:'sawtooth', fS:200, fE:100,  curve:'exponential',dur:.4,  att:.02, dec:.05, sus:.2, rel:.15, vol:.5,  filt:'lowpass', fF:500,fQ:1.5,noise:.3,  duty:50},
        {id:'bleed',    cat:'伤害', name:'流血 Bleed',       type:'sine',     fS:400, fE:200,  curve:'exponential',dur:.15, att:.005,dec:.02, sus:0,  rel:.06, vol:.5,  filt:'bandpass',fF:1000,fQ:2, noise:.2,  duty:50},
        {id:'burn',     cat:'伤害', name:'灼烧 Burn',        type:'noise',    fS:300, fE:100,  curve:'exponential',dur:.3,  att:.01, dec:.04, sus:.1, rel:.08, vol:.5,  filt:'lowpass', fF:800,fQ:1,  noise:.6,  duty:50},
        {id:'freeze',   cat:'伤害', name:'冻结 Freeze',      type:'triangle', fS:800, fE:300,  curve:'exponential',dur:.35, att:.01, dec:.05, sus:.15,rel:.12, vol:.5,  filt:'lowpass', fF:600,fQ:1,  noise:.2,  duty:50},
        {id:'shock',    cat:'伤害', name:'电击 Shock',       type:'square',   fS:200, fE:800,  curve:'linear',     dur:.1,  att:.001,dec:.02, sus:0,  rel:.04, vol:.65, filt:'bandpass',fF:2000,fQ:3, noise:.25, duty:50},
        {id:'curse',    cat:'伤害', name:'诅咒 Curse',       type:'sawtooth', fS:150, fE:60,   curve:'exponential',dur:.45, att:.015,dec:.06, sus:.15,rel:.15, vol:.5,  filt:'lowpass', fF:400,fQ:1.5,noise:.35, duty:50},
        {id:'petrify',  cat:'伤害', name:'石化 Petrify',     type:'pulse',    fS:200, fE:50,   curve:'exponential',dur:.3,  att:.02, dec:.05, sus:.1, rel:.12, vol:.5,  filt:'lowpass', fF:300,fQ:2,  noise:.1,  duty:15},
        {id:'critical', cat:'伤害', name:'暴击 Critical',    type:'noise',    fS:1000,fE:300,  curve:'exponential',dur:.06, att:.001,dec:.015,sus:0,  rel:.02, vol:.75, filt:'bandpass',fF:3000,fQ:3, noise:.65, duty:50},
        // ========== UI/菜单 (12) ==========
        {id:'hover',    cat:'UI',   name:'悬停 Hover',       type:'sine',     fS:600, fE:650,  curve:'linear',     dur:.05, att:.001,dec:.005,sus:0,  rel:.02, vol:.4,  filt:'highpass',fF:500,fQ:.5, noise:0,   duty:50},
        {id:'confirm',  cat:'UI',   name:'确认 Confirm',     type:'sine',     fS:500, fE:500,  curve:'linear',     dur:.2,  att:.005,dec:.03, sus:.2, rel:.08, vol:.6,  filt:'none',    fF:0,fQ:0,  noise:0,   duty:50},
        {id:'cancel',   cat:'UI',   name:'取消 Cancel',      type:'square',   fS:400, fE:0,    curve:'linear',     dur:.3,  att:.005,dec:.05, sus:0,  rel:.1,  vol:.55, filt:'lowpass', fF:800,fQ:1,  noise:0,   duty:50},
        {id:'notif',    cat:'UI',   name:'通知 Notification',type:'triangle', fS:800, fE:1200, curve:'linear',     dur:.08, att:.002,dec:.015,sus:0,  rel:.03, vol:.55, filt:'highpass',fF:600,fQ:.5, noise:0,   duty:50},
        {id:'error',    cat:'UI',   name:'错误 Error',       type:'square',   fS:300, fE:100,  curve:'linear',     dur:.25, att:.005,dec:.04, sus:0,  rel:.08, vol:.55, filt:'lowpass', fF:600,fQ:1,  noise:0,   duty:50},
        {id:'success',  cat:'UI',   name:'成功 Success',     type:'sine',     fS:500, fE:1000, curve:'linear',     dur:.12, att:.003,dec:.02, sus:0,  rel:.05, vol:.6,  filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
        {id:'unlock',   cat:'UI',   name:'解锁 Unlock',      type:'triangle', fS:400, fE:1200, curve:'linear',     dur:.3,  att:.008,dec:.04, sus:.15,rel:.1,  vol:.65, filt:'highpass',fF:300,fQ:.5, noise:0,   duty:50},
        {id:'levelup',  cat:'UI',   name:'升级 Level Up',    type:'sine',     fS:400, fE:800,  curve:'linear',     dur:.6,  att:.015,dec:.05, sus:.2, rel:.15, vol:.7,  filt:'highpass',fF:300,fQ:.5, noise:.05, duty:50},
        {id:'pageflip', cat:'UI',   name:'翻页 Page Flip',   type:'noise',    fS:400, fE:200,  curve:'exponential',dur:.05, att:.002,dec:.01, sus:0,  rel:.02, vol:.35, filt:'bandpass',fF:3000,fQ:2, noise:.5,  duty:50},
        {id:'typewriter',cat:'UI',  name:'打字 Typewriter',  type:'pulse',    fS:1000,fE:800,  curve:'exponential',dur:.03, att:.001,dec:.005,sus:0,  rel:.01, vol:.4,  filt:'bandpass',fF:4000,fQ:3, noise:.05, duty:20},
        {id:'dropdown', cat:'UI',   name:'下拉 Dropdown',    type:'sine',     fS:400, fE:200,  curve:'exponential',dur:.05, att:.003,dec:.01, sus:0,  rel:.015,vol:.4,  filt:'highpass',fF:300,fQ:.5, noise:0,   duty:50},
        {id:'checkbox', cat:'UI',   name:'勾选 Check',       type:'triangle', fS:600, fE:900,  curve:'linear',     dur:.06, att:.002,dec:.01, sus:0,  rel:.02, vol:.45, filt:'highpass',fF:500,fQ:.5, noise:0,   duty:50},
        // ========== 环境 (8) ==========
        {id:'wind',     cat:'环境', name:'风声 Wind',        type:'noise',    fS:200, fE:100,  curve:'exponential',dur:1.5, att:.1,  dec:.2,  sus:.5, rel:.3,  vol:.4,  filt:'lowpass', fF:400,fQ:1,  noise:.8,  duty:50},
        {id:'rain',     cat:'环境', name:'雨声 Rain',        type:'noise',    fS:500, fE:300,  curve:'exponential',dur:1.0, att:.05, dec:.1,  sus:.4, rel:.2,  vol:.3,  filt:'bandpass',fF:4000,fQ:1, noise:.7,  duty:50},
        {id:'thunder',  cat:'环境', name:'雷声 Thunder',     type:'sawtooth', fS:80,  fE:20,   curve:'exponential',dur:.6,  att:.002,dec:.1,  sus:0,  rel:.2,  vol:.75, filt:'lowpass', fF:200,fQ:1,  noise:.5,  duty:50},
        {id:'fire-crackle',cat:'环境',name:'火焰 Fire',      type:'noise',    fS:400, fE:200,  curve:'exponential',dur:.5,  att:.01, dec:.05, sus:.15,rel:.1,  vol:.5,  filt:'bandpass',fF:800,fQ:1,  noise:.7,  duty:50},
        {id:'water-drip',cat:'环境',name:'水滴 Water',       type:'sine',     fS:800, fE:1200, curve:'exponential',dur:.06, att:.002,dec:.015,sus:0,  rel:.02, vol:.45, filt:'bandpass',fF:3000,fQ:3, noise:.15, duty:50},
        {id:'splash',   cat:'环境', name:'水花 Splash',      type:'noise',    fS:600, fE:200,  curve:'exponential',dur:.08, att:.001,dec:.02, sus:0,  rel:.03, vol:.5,  filt:'bandpass',fF:2000,fQ:2, noise:.6,  duty:50},
        {id:'breaking', cat:'环境', name:'碎裂 Break',       type:'noise',    fS:800, fE:300,  curve:'exponential',dur:.08, att:.001,dec:.015,sus:0,  rel:.03, vol:.6,  filt:'bandpass',fF:4000,fQ:3, noise:.75, duty:50},
        {id:'creak',    cat:'环境', name:'吱嘎 Creak',       type:'sawtooth', fS:200, fE:100,  curve:'exponential',dur:.25, att:.03, dec:.05, sus:.1, rel:.08, vol:.45, filt:'lowpass', fF:500,fQ:1.5,noise:.1,  duty:50},
        // ========== 生物/怪物 (10) ==========
        {id:'growl',    cat:'生物', name:'低吼 Growl',       type:'sawtooth', fS:100, fE:60,   curve:'exponential',dur:.4,  att:.02, dec:.05, sus:.25,rel:.1,  vol:.6,  filt:'lowpass', fF:300,fQ:1.5,noise:.15, duty:50},
        {id:'hiss',     cat:'生物', name:'蛇嘶 Hiss',        type:'noise',    fS:800, fE:400,  curve:'exponential',dur:.3,  att:.01, dec:.04, sus:.15,rel:.08, vol:.5,  filt:'bandpass',fF:4000,fQ:2, noise:.7,  duty:50},
        {id:'screech',  cat:'生物', name:'尖啸 Screech',     type:'sawtooth', fS:1200,fE:400,  curve:'exponential',dur:.25, att:.002,dec:.04, sus:.05,rel:.08, vol:.6,  filt:'bandpass',fF:3000,fQ:3, noise:.2,  duty:50},
        {id:'roar',     cat:'生物', name:'咆哮 Roar',        type:'sawtooth', fS:120, fE:50,   curve:'exponential',dur:.5,  att:.005,dec:.08, sus:.2, rel:.15, vol:.7,  filt:'lowpass', fF:400,fQ:1.5,noise:.25, duty:50},
        {id:'wingflap', cat:'生物', name:'振翅 Wing',        type:'pulse',    fS:300, fE:500,  curve:'linear',     dur:.04, att:.001,dec:.008,sus:0,  rel:.015,vol:.45, filt:'bandpass',fF:2000,fQ:2, noise:.1,  duty:25},
        {id:'slime',    cat:'生物', name:'史莱姆 Slime',     type:'sine',     fS:150, fE:80,   curve:'exponential',dur:.12, att:.015,dec:.025,sus:0,  rel:.04, vol:.45, filt:'lowpass', fF:400,fQ:1,  noise:.3,  duty:50},
        {id:'bat',      cat:'生物', name:'蝙蝠 Bat',         type:'pulse',    fS:600, fE:1000, curve:'linear',     dur:.04, att:.001,dec:.005,sus:0,  rel:.01, vol:.4,  filt:'bandpass',fF:3000,fQ:3, noise:.1,  duty:20},
        {id:'howl',     cat:'生物', name:'狼嚎 Howl',        type:'sine',     fS:300, fE:600,  curve:'linear',     dur:.6,  att:.03, dec:.08, sus:.3, rel:.15, vol:.6,  filt:'bandpass',fF:800,fQ:2,  noise:.1,  duty:50},
        {id:'buzz',     cat:'生物', name:'嗡嗡 Buzz',        type:'pulse',    fS:200, fE:220,  curve:'linear',     dur:.3,  att:.01, dec:.03, sus:.2, rel:.08, vol:.35, filt:'bandpass',fF:400,fQ:1,  noise:.05, duty:15},
        {id:'footstep-heavy',cat:'生物',name:'沉重脚步 Step',type:'square',   fS:80,  fE:30,   curve:'exponential',dur:.08, att:.001,dec:.015,sus:0,  rel:.03, vol:.6,  filt:'lowpass', fF:200,fQ:1.5,noise:.25, duty:50},
        // ========== 卡通/特殊 (8) ==========
        {id:'boing',    cat:'卡通', name:'弹簧 Boing',       type:'sine',     fS:300, fE:600,  curve:'linear',     dur:.2,  att:.002,dec:.03, sus:0,  rel:.08, vol:.55, filt:'none',    fF:0,fQ:0,  noise:0,   duty:50},
        {id:'zip',      cat:'卡通', name:'咻 Zip',           type:'sine',     fS:500, fE:2000, curve:'linear',     dur:.08, att:.001,dec:.01, sus:0,  rel:.03, vol:.5,  filt:'highpass',fF:500,fQ:.5, noise:0,   duty:50},
        {id:'pop',      cat:'卡通', name:'啵 Pop',           type:'triangle', fS:400, fE:800,  curve:'linear',     dur:.04, att:.001,dec:.008,sus:0,  rel:.015,vol:.5,  filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
        {id:'slidewhistle',cat:'卡通',name:'滑哨 Whistle',   type:'sine',     fS:200, fE:1200, curve:'linear',     dur:.3,  att:.005,dec:.04, sus:.1, rel:.1,  vol:.55, filt:'none',    fF:0,fQ:0,  noise:0,   duty:50},
        {id:'splat',    cat:'卡通', name:'啪叽 Splat',       type:'noise',    fS:300, fE:80,   curve:'exponential',dur:.06, att:.001,dec:.01, sus:0,  rel:.02, vol:.5,  filt:'lowpass', fF:500,fQ:1,  noise:.7,  duty:50},
        {id:'alarm',    cat:'卡通', name:'警报 Alarm',       type:'square',   fS:400, fE:800,  curve:'linear',     dur:.5,  att:.005,dec:.025,sus:.3, rel:.1,  vol:.6,  filt:'bandpass',fF:1500,fQ:2, noise:.1,  duty:50},
        {id:'bell',     cat:'卡通', name:'铃声 Bell',        type:'sine',     fS:800, fE:1200, curve:'exponential',dur:.3,  att:.002,dec:.05, sus:.2, rel:.12, vol:.55, filt:'bandpass',fF:3000,fQ:3, noise:0,   duty:50},
        {id:'whistle',  cat:'卡通', name:'哨声 Whistle',     type:'sine',     fS:600, fE:1200, curve:'linear',     dur:.15, att:.005,dec:.02, sus:0,  rel:.06, vol:.5,  filt:'highpass',fF:400,fQ:.5, noise:0,   duty:50},
    ],

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
            SkillSystem.renderSubTools();
            return;
        }
        this._createOverlay();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {},

    getSubTools: function() {
        return [{ label: '关', action: function() { SkillSystem.deactivate(); } }];
    },

    save: function() { return {}; },
    load: function() {},

    _getCSS: function() {
        return '' +
'.ss-overlay{position:fixed;width:720px;height:580px;z-index:9999;display:flex;flex-direction:column;background:#13131a;color:#e0e0ee;font-family:"Inter","Segoe UI",system-ui,sans-serif;border-radius:12px;border:1px solid #2a2a3a;box-shadow:0 16px 64px rgba(0,0,0,.5);overflow:hidden;user-select:none;}' +
'.ss-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#1a1a24;border-bottom:1px solid #2a2a3a;flex-shrink:0;cursor:move;}' +
'.ss-header h1{font-size:14px;margin:0;color:#e0e0ee;font-weight:600;letter-spacing:.2px;display:flex;align-items:center;gap:8px;}' +
'.ss-header-right{display:flex;align-items:center;gap:8px;}' +
'.ss-body{flex:1;display:flex;overflow:hidden;}' +
'.ss-left{width:200px;background:#16161f;border-right:1px solid #2a2a3a;display:flex;flex-direction:column;overflow:hidden;flex-shrink:0;}' +
'.ss-left-title{padding:10px 12px 6px;font-size:11px;color:#7c6af0;font-weight:600;letter-spacing:.5px;text-transform:uppercase;}' +
'.ss-tree{flex:1;overflow-y:auto;padding:2px 4px;}' +
'.ss-tree-cat{padding:4px 8px;font-size:11px;color:#c0c0d0;cursor:pointer;border-radius:4px;display:flex;align-items:center;gap:4px;transition:background .1s;}' +
'.ss-tree-cat:hover{background:rgba(124,106,240,.08);}' +
'.ss-tree-cat-arrow{font-size:8px;width:12px;text-align:center;color:#55557a;transition:transform .15s;display:inline-block;}' +
'.ss-tree-cat-open .ss-tree-cat-arrow{transform:rotate(90deg);}' +
'.ss-tree-items{overflow:hidden;}' +
'.ss-tree-item{padding:3px 8px 3px 24px;font-size:11px;color:#8888aa;cursor:pointer;border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:all .1s;}' +
'.ss-tree-item:hover{background:rgba(124,106,240,.06);color:#d0d0e0;}' +
'.ss-tree-item-sel{background:rgba(124,106,240,.15);color:#e0e0ee;font-weight:500;}' +
'.ss-left-bottom{padding:8px;border-top:1px solid #2a2a3a;}' +
'.ss-save-btn{width:100%;background:rgba(124,106,240,.1);border:1px solid rgba(124,106,240,.25);border-radius:6px;padding:6px;color:#aaaacc;font-size:11px;cursor:pointer;text-align:center;transition:all .15s;}' +
'.ss-save-btn:hover{background:rgba(124,106,240,.2);color:#c0c0e0;}' +
'.ss-right{flex:1;display:flex;flex-direction:column;overflow:hidden;background:#13131a;}' +
'.ss-body-scroll{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px;}' +
'.ss-body-scroll::-webkit-scrollbar{width:4px}' +
'.ss-body-scroll::-webkit-scrollbar-track{background:transparent}' +
'.ss-body-scroll::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:2px}' +
'.ss-section{background:#181822;border:1px solid #242436;border-radius:8px;padding:10px 12px;}' +
'.ss-section-title{font-size:11px;color:#8888bb;margin-bottom:8px;font-weight:600;letter-spacing:.3px;display:flex;align-items:center;gap:6px;}' +
'.ss-section-title::before{content:"";display:inline-block;width:3px;height:11px;border-radius:2px;background:#7c6af0;flex-shrink:0;}' +
'.ss-row{display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:nowrap;}' +
'.ss-row:last-child{margin-bottom:0}' +
'.ss-label{font-size:11px;color:#8888aa;min-width:22px;flex-shrink:0;}' +
'.ss-label-wide{font-size:11px;color:#8888aa;min-width:38px;flex-shrink:0;}' +
'.ss-select{background:#0f0f16;color:#d0d0e0;border:1px solid #2a2a3a;border-radius:6px;padding:3px 6px;font-size:11px;cursor:pointer;flex-shrink:0;}' +
'.ss-select:hover{border-color:#4a4a6a;}' +
'.ss-select:focus{outline:none;border-color:#7c6af0;}' +
'.ss-range{flex:1;min-width:40px;height:4px;cursor:pointer;accent-color:#7c6af0;background:transparent;}' +
'.ss-range:hover{accent-color:#9482ff;}' +
'.ss-val{font-size:10px;color:#aaaacc;min-width:28px;text-align:right;font-family:monospace;flex-shrink:0;}' +
'.ss-val-wide{font-size:10px;color:#aaaacc;min-width:40px;text-align:right;font-family:monospace;flex-shrink:0;}' +
'.ss-canvas{width:100%;height:50px;border-radius:6px;background:#0a0a10;display:block;border:1px solid #1c1c2a;}' +
'.ss-info{font-size:11px;color:#66668a;text-align:center;min-height:16px;padding:2px 0;}' +
'.ss-btn{background:linear-gradient(135deg,#7c6af0,#6a5cd8);border:none;border-radius:6px;padding:5px 14px;color:#fff;font-size:12px;font-weight:500;cursor:pointer;letter-spacing:.2px;}' +
'.ss-btn:hover{background:linear-gradient(135deg,#8a7aff,#7c6af0);}' +
'.ss-btn:active{transform:scale(.97);}' +
'.ss-btn-sm{background:#232336;border:1px solid #33334a;border-radius:6px;padding:4px 12px;color:#c0c0d8;font-size:11px;cursor:pointer;}' +
'.ss-btn-sm:hover{background:#2d2d42;border-color:#4a4a6a;}' +
'.ss-close-btn{background:rgba(220,80,60,.15);border:1px solid rgba(220,80,60,.3);color:#f09080;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:11px;}' +
'.ss-close-btn:hover{background:rgba(220,80,60,.25);}' +
'';
    },

    _createOverlay: function() {
        (function() { var id = 'ss-style'; if (!document.getElementById(id)) { var s = document.createElement('style'); s.id = id; s.textContent = SynthSFX._getCSS(); document.head.appendChild(s); } })();
        var self = this, ov = document.createElement('div');
        ov.className = 'ss-overlay'; ov.setAttribute('data-skill-id', this.id);
        ov.style.left = Math.max(20, (window.innerWidth - 680) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 540) / 2) + 'px';
        document.body.appendChild(ov); this._overlay = ov;

        var hdr = document.createElement('div'); hdr.className = 'ss-header';
        hdr.innerHTML =
            '<h1><span style="color:#38bdf8;">≈</span> ' + this.TEXTS.TITLE + ' <span style="color:#666;font-size:11px;font-weight:400;">' + this.PRESETS.length + '</span></h1>' +
            '<div class="ss-header-right">' +
            '<button class="ss-btn" id="ss-preview">' + this.TEXTS.PREVIEW + '</button>' +
            '<button class="ss-btn-sm" id="ss-export">' + this.TEXTS.EXPORT + '</button>' +
            '<button class="ss-close-btn" id="ss-close">' + this.TEXTS.CLOSE + '</button></div>';
        ov.appendChild(hdr);

        var body = document.createElement('div'); body.className = 'ss-body';

        var left = document.createElement('div'); left.className = 'ss-left';
        left.innerHTML = '<div class="ss-left-title">' + this.TEXTS.PRESET + '</div><div class="ss-tree" id="ss-tree"></div><div class="ss-left-bottom"><button class="ss-save-btn" id="ss-save-preset">💾 ' + this.TEXTS.PRESET + '</button></div>';
        body.appendChild(left);

        var right = document.createElement('div'); right.className = 'ss-right';
        var rbody = document.createElement('div'); rbody.className = 'ss-body-scroll';
        rbody.innerHTML =
            '<div class="ss-section">' +
            '<div class="ss-section-title">' + this.TEXTS.LBL_WAVE + ' / ' + this.TEXTS.LBL_CURVE + '</div>' +
            '<div class="ss-row">' +
            '<span class="ss-label-wide">' + this.TEXTS.LBL_WAVE + '</span>' +
            '<select class="ss-select" id="ss-wave-type">' +
            '<option value="sine">' + this.TEXTS.WAVE_SINE + '</option>' +
            '<option value="square">' + this.TEXTS.WAVE_SQUARE + '</option>' +
            '<option value="sawtooth">' + this.TEXTS.WAVE_SAWTOOTH + '</option>' +
            '<option value="triangle">' + this.TEXTS.WAVE_TRIANGLE + '</option>' +
            '<option value="pulse">' + this.TEXTS.WAVE_PULSE + '</option>' +
            '<option value="noise">' + this.TEXTS.WAVE_NOISE + '</option>' +
            '<option value="organ">' + this.TEXTS.WAVE_ORGAN + '</option>' +
            '<option value="bright">' + this.TEXTS.WAVE_BRIGHT + '</option>' +
            '<option value="bell">' + this.TEXTS.WAVE_BELL + '</option>' +
            '</select>' +
            '<span class="ss-label">' + this.TEXTS.LBL_FREQ_START + '</span>' +
            '<input type="range" class="ss-range" id="ss-freq-start" min="10" max="4000" value="200">' +
            '<span class="ss-val" id="ss-freq-start-v">200</span>' +
            '<span class="ss-label">' + this.TEXTS.LBL_FREQ_END + '</span>' +
            '<input type="range" class="ss-range" id="ss-freq-end" min="0" max="4000" value="600">' +
            '<span class="ss-val" id="ss-freq-end-v">600</span>' +
            '</div><div class="ss-row">' +
            '<span class="ss-label-wide">' + this.TEXTS.LBL_CURVE + '</span>' +
            '<select class="ss-select" id="ss-curve">' +
            '<option value="linear">' + this.TEXTS.CURVE_LINEAR + '</option>' +
            '<option value="exponential">' + this.TEXTS.CURVE_EXP + '</option>' +
            '</select>' +
            '<span class="ss-label">' + this.TEXTS.LBL_DURATION + '</span>' +
            '<input type="range" class="ss-range" id="ss-duration" min="10" max="2000" value="120">' +
            '<span class="ss-val-wide" id="ss-duration-v">0.12s</span>' +
            '<span class="ss-label">' + this.TEXTS.LBL_DUTY + '</span>' +
            '<input type="range" class="ss-range" id="ss-duty" min="5" max="95" value="50">' +
            '<span class="ss-val" id="ss-duty-v">50%</span>' +
            '</div></div>' +
            '<div class="ss-section">' +
            '<div class="ss-section-title">' + this.TEXTS.LBL_ATTACK + '/' + this.TEXTS.LBL_DECAY + '/' + this.TEXTS.LBL_SUSTAIN + '/' + this.TEXTS.LBL_RELEASE + '</div>' +
            '<div class="ss-row">' +
            '<span class="ss-label">A</span>' +
            '<input type="range" class="ss-range" id="ss-attack" min="0" max="500" value="3">' +
            '<span class="ss-val" id="ss-attack-v">0.003</span>' +
            '<span class="ss-label">D</span>' +
            '<input type="range" class="ss-range" id="ss-decay" min="0" max="500" value="20">' +
            '<span class="ss-val" id="ss-decay-v">0.02</span>' +
            '<span class="ss-label">S</span>' +
            '<input type="range" class="ss-range" id="ss-sustain" min="0" max="100" value="0">' +
            '<span class="ss-val" id="ss-sustain-v">0</span>' +
            '<span class="ss-label">R</span>' +
            '<input type="range" class="ss-range" id="ss-release" min="0" max="500" value="50">' +
            '<span class="ss-val" id="ss-release-v">0.05</span>' +
            '</div><div class="ss-row">' +
            '<span class="ss-label-wide">' + this.TEXTS.LBL_VOLUME + '</span>' +
            '<input type="range" class="ss-range" id="ss-volume" min="0" max="100" value="70">' +
            '<span class="ss-val" id="ss-volume-v">0.70</span>' +
            '</div></div>' +
            '<div class="ss-section">' +
            '<div class="ss-section-title">' + this.TEXTS.LBL_FILTER + ' / ' + this.TEXTS.LBL_NOISE + '</div>' +
            '<div class="ss-row">' +
            '<span class="ss-label-wide">' + this.TEXTS.LBL_FILTER + '</span>' +
            '<select class="ss-select" id="ss-filter-type">' +
            '<option value="none">' + this.TEXTS.FILTER_NONE + '</option>' +
            '<option value="lowpass">' + this.TEXTS.FILTER_LOWPASS + '</option>' +
            '<option value="highpass">' + this.TEXTS.FILTER_HIGHPASS + '</option>' +
            '<option value="bandpass">' + this.TEXTS.FILTER_BANDPASS + '</option>' +
            '<option value="notch">' + this.TEXTS.FILTER_NOTCH + '</option>' +
            '</select>' +
            '<span class="ss-label">' + this.TEXTS.LBL_FILTER_FREQ + '</span>' +
            '<input type="range" class="ss-range" id="ss-filter-freq" min="20" max="20000" value="200">' +
            '<span class="ss-val" id="ss-filter-freq-v">200</span>' +
            '<span class="ss-label">Q</span>' +
            '<input type="range" class="ss-range" id="ss-filter-q" min="0" max="200" value="5">' +
            '<span class="ss-val" id="ss-filter-q-v">0.5</span>' +
            '</div><div class="ss-row">' +
            '<span class="ss-label-wide">' + this.TEXTS.LBL_NOISE + '</span>' +
            '<input type="range" class="ss-range" id="ss-noise" min="0" max="100" value="0">' +
            '<span class="ss-val" id="ss-noise-v">0%</span>' +
            '</div></div>' +
            '<div style="flex:1;min-height:30px;overflow:hidden;"><canvas class="ss-canvas" id="ss-canvas" width="440" height="40"></canvas></div>' +
            '<div class="ss-info" id="ss-info">' + this.TEXTS.MSG_EMPTY + '</div>';
        right.appendChild(rbody);
        body.appendChild(right);
        ov.appendChild(body);

        this._bindDrag(hdr, ov);

        ov.querySelector('#ss-close').addEventListener('click', function() { self._destroy(); });
        ov.querySelector('#ss-preview').addEventListener('click', function() { self._onPreview(); });
        ov.querySelector('#ss-export').addEventListener('click', function() { self._onExport(); });
        ov.querySelector('#ss-save-preset').addEventListener('click', function() { self._saveAsPreset(); });

        var paramIds = ['ss-wave-type','ss-freq-start','ss-freq-end','ss-curve','ss-duration','ss-duty',
            'ss-attack','ss-decay','ss-sustain','ss-release','ss-volume',
            'ss-filter-type','ss-filter-freq','ss-filter-q','ss-noise'];
        for (var pi = 0; pi < paramIds.length; pi++) {
            (function(id) {
                var el = ov.querySelector('#' + id);
                if (!el) return;
                el.addEventListener('input', function() { self._onParamChange(); });
                el.addEventListener('change', function() { self._onParamChange(); });
            })(paramIds[pi]);
        }

        this._renderTree();
        this._currentPresetIndex = 0;
        this._onPresetSelect(0);
        this._drawWaveform();
    },

    _getTreeData: function() {
        var cats = {};
        for (var i = 0; i < this.PRESETS.length; i++) {
            var p = this.PRESETS[i];
            if (!cats[p.cat]) cats[p.cat] = [];
            cats[p.cat].push(i);
        }
        return cats;
    },

    _renderTree: function() {
        var self = this, container = this._overlay.querySelector('#ss-tree');
        if (!container) return;
        var cats = this._getTreeData();
        var catOrder = ['移动','武器','道具','强化','伤害','UI','环境','生物','卡通','自定义'];
        var html = '';
        for (var ci = 0; ci < catOrder.length; ci++) {
            var c = catOrder[ci];
            var items = cats[c];
            if (!items || !items.length) continue;
            html += '<div class="ss-tree-cat-wrap" data-cat="' + c + '">' +
                '<div class="ss-tree-cat"><span class="ss-tree-cat-arrow">▶</span> ' + c + ' <span style="color:#666;font-size:10px;">(' + items.length + ')</span></div>' +
                '<div class="ss-tree-items" style="display:none">';
            for (var ii = 0; ii < items.length; ii++) {
                var idx = items[ii];
                html += '<div class="ss-tree-item" data-index="' + idx + '">' + this.PRESETS[idx].name + '</div>';
            }
            html += '</div></div>';
        }
        container.innerHTML = html;

        container.querySelectorAll('.ss-tree-cat').forEach(function(el) {
            el.addEventListener('click', function(e) {
                var wrap = el.parentNode;
                var items = wrap.querySelector('.ss-tree-items');
                var isOpen = items.style.display !== 'none';
                items.style.display = isOpen ? 'none' : '';
                wrap.classList.toggle('ss-tree-cat-open', !isOpen);
            });
        });
        container.querySelectorAll('.ss-tree-item').forEach(function(el) {
            el.addEventListener('click', function(e) {
                var idx = parseInt(this.dataset.index);
                container.querySelectorAll('.ss-tree-item').forEach(function(x) { x.classList.remove('ss-tree-item-sel'); });
                this.classList.add('ss-tree-item-sel');
                self._currentPresetIndex = idx;
                self._onPresetSelect(idx);
            });
        });
    },

    _saveAsPreset: function() {
        var name = prompt('输入预设名称:');
        if (!name || !name.trim()) return;
        var params = this._getParams();
        if (!params) return;
        var id = 'custom-' + Date.now();
        var freqTypeMap = { 'sine':'sine','square':'square','sawtooth':'sawtooth','triangle':'triangle','pulse':'pulse','noise':'noise','organ':'organ','bright':'bright','bell':'bell' };
        this.PRESETS.push({
            id: id, cat: '自定义', name: name.trim(),
            type: freqTypeMap[params.waveType] || 'sine',
            fS: params.freqStart, fE: params.freqEnd, curve: params.curve,
            dur: params.duration, att: params.attack, dec: params.decay,
            sus: params.sustain, rel: params.release, vol: params.volume,
            filt: params.filterType, fF: params.filterFreq, fQ: params.filterQ,
            noise: params.noise, duty: Math.round(params.duty * 100),
        });
        this._currentPresetIndex = this.PRESETS.length - 1;
        this._renderTree();
        var info = this._overlay.querySelector('#ss-info');
        if (info) info.textContent = '已保存: ' + name.trim();
    },

    _getParams: function() {
        var ov = this._overlay;
        if (!ov) return null;
        var g = function(id) { var el = ov.querySelector('#' + id); return el ? el.value : null; };
        var gi = function(id) { var el = ov.querySelector('#' + id); return el ? parseInt(el.value) : 0; };
        var gf = function(id) { var v = parseFloat(g(id)); return isNaN(v) ? 0 : v; };
        var typeMap = { 'sine':'sine', 'square':'square', 'sawtooth':'sawtooth', 'triangle':'triangle', 'pulse':'pulse', 'noise':'noise', 'organ':'organ', 'bright':'bright', 'bell':'bell' };
        var filterMap = { 'none':'none', 'lowpass':'lowpass', 'highpass':'highpass', 'bandpass':'bandpass', 'notch':'notch' };
        return {
            waveType: typeMap[g('ss-wave-type')] || 'sine',
            freqStart: gi('ss-freq-start'),
            freqEnd: gi('ss-freq-end'),
            curve: g('ss-curve') || 'linear',
            duration: gi('ss-duration') / 1000,
            duty: gi('ss-duty') / 100,
            attack: gi('ss-attack') / 1000,
            decay: gi('ss-decay') / 1000,
            sustain: gi('ss-sustain') / 100,
            release: gi('ss-release') / 1000,
            volume: gi('ss-volume') / 100,
            filterType: filterMap[g('ss-filter-type')] || 'none',
            filterFreq: gi('ss-filter-freq'),
            filterQ: gf('ss-filter-q') / 10,
            noise: gi('ss-noise') / 100,
        };
    },

    _setParam: function(id, val) {
        var el = this._overlay.querySelector('#' + id);
        if (!el) return;
        el.value = val;
        var evt = document.createEvent('HTMLEvents');
        evt.initEvent('input', true, false);
        el.dispatchEvent(evt);
    },

    _onPresetSelect: function(index) {
        var p = this.PRESETS[index];
        if (!p) return;
        this._setParam('ss-wave-type', p.type);
        this._setParam('ss-freq-start', p.fS);
        this._setParam('ss-freq-end', p.fE);
        this._setParam('ss-curve', p.curve);
        this._setParam('ss-duration', Math.round(p.dur * 1000));
        this._setParam('ss-duty', p.duty || 50);
        this._setParam('ss-attack', Math.round(p.att * 1000));
        this._setParam('ss-decay', Math.round(p.dec * 1000));
        this._setParam('ss-sustain', Math.round(p.sus * 100));
        this._setParam('ss-release', Math.round(p.rel * 1000));
        this._setParam('ss-volume', Math.round(p.vol * 100));
        this._setParam('ss-filter-type', p.filt);
        this._setParam('ss-filter-freq', p.fF);
        this._setParam('ss-filter-q', Math.round(p.fQ * 10));
        this._setParam('ss-noise', Math.round(p.noise * 100));
        this._onParamChange();
    },

    _onParamChange: function() {
        var ov = this._overlay;
        if (!ov) return;
        ov.querySelector('#ss-freq-start-v').textContent = parseInt(ov.querySelector('#ss-freq-start').value);
        ov.querySelector('#ss-freq-end-v').textContent = parseInt(ov.querySelector('#ss-freq-end').value);
        var durMs = parseInt(ov.querySelector('#ss-duration').value);
        ov.querySelector('#ss-duration-v').textContent = (durMs / 1000).toFixed(2) + 's';
        ov.querySelector('#ss-duty-v').textContent = parseInt(ov.querySelector('#ss-duty').value) + '%';
        ov.querySelector('#ss-attack-v').textContent = (parseInt(ov.querySelector('#ss-attack').value) / 1000).toFixed(3);
        ov.querySelector('#ss-decay-v').textContent = (parseInt(ov.querySelector('#ss-decay').value) / 1000).toFixed(2);
        ov.querySelector('#ss-sustain-v').textContent = parseInt(ov.querySelector('#ss-sustain').value) / 100;
        ov.querySelector('#ss-release-v').textContent = (parseInt(ov.querySelector('#ss-release').value) / 1000).toFixed(2);
        ov.querySelector('#ss-volume-v').textContent = (parseInt(ov.querySelector('#ss-volume').value) / 100).toFixed(2);
        ov.querySelector('#ss-filter-freq-v').textContent = parseInt(ov.querySelector('#ss-filter-freq').value);
        var qv = parseInt(ov.querySelector('#ss-filter-q').value) / 10;
        ov.querySelector('#ss-filter-q-v').textContent = qv.toFixed(1);
        ov.querySelector('#ss-noise-v').textContent = parseInt(ov.querySelector('#ss-noise').value) + '%';
        ov.querySelector('#ss-info').textContent = this.TEXTS.MSG_EMPTY;
        this._drawWaveform();
    },

    _drawWaveform: function() {
        var ov = this._overlay;
        if (!ov) return;
        var params = this._getParams();
        if (!params) return;
        var canvas = ov.querySelector('#ss-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height, cy = h / 2;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a1525';
        ctx.fillRect(0, 0, w, h);
        // 频率扫描预览
        var steps = 200;
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        var maxFreq = Math.max(params.freqStart, params.freqEnd, 100);
        for (var i = 0; i <= steps; i++) {
            var t = i / steps, freq;
            if (params.curve === 'exponential') {
                var ratio = Math.log(Math.max(10, params.freqEnd) / Math.max(10, params.freqStart));
                freq = Math.max(10, params.freqStart) * Math.exp(ratio * t);
            } else {
                freq = params.freqStart + (params.freqEnd - params.freqStart) * t;
            }
            var normFreq = (freq - 20) / (maxFreq - 20 || 1);
            var x = 10 + t * (w - 20);
            var y = cy - normFreq * (cy - 5);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // 脉冲标注
        if (params.waveType === 'pulse') {
            ctx.fillStyle = 'rgba(233,69,96,0.5)';
            ctx.font = '9px sans-serif';
            ctx.fillText('PWM ' + Math.round(params.duty * 100) + '%', 12, 12);
        }
        // 网格
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 0.5;
        for (var gi = 0; gi < 3; gi++) {
            var gy = 3 + gi * ((h - 6) / 2);
            ctx.beginPath();
            ctx.moveTo(10, gy);
            ctx.lineTo(w - 10, gy);
            ctx.stroke();
        }
        // 噪声指示
        if (params.noise > 0.01) {
            ctx.fillStyle = 'rgba(233,69,96,' + params.noise * 0.3 + ')';
            ctx.fillRect(10, h - 8, (w - 20) * params.noise, 3);
        }
    },

    // ======== 脉冲波 (PWM) + 自定义波形引擎 ========

    _getPulseWave: function(ctx, duty) {
        var key = duty.toFixed(2);
        if (this._pulseWaves[key]) return this._pulseWaves[key];
        var N = 128, real = new Float32Array(N), imag = new Float32Array(N);
        real[0] = duty - 0.5;
        for (var n = 1; n < N; n++) {
            var a = 2 * Math.PI * n * duty;
            real[n] = Math.sin(a) / (Math.PI * n);
            imag[n] = (1 - Math.cos(a)) / (Math.PI * n);
        }
        this._pulseWaves[key] = new PeriodicWave(ctx, {real: real, imag: imag, disableNormalization: false});
        return this._pulseWaves[key];
    },

    _getCustomWave: function(ctx, type) {
        if (this._customWaves[type]) return this._customWaves[type];
        var N = 128, real = new Float32Array(N), imag = new Float32Array(N);
        switch (type) {
            case 'organ':
                for (var n = 1; n < N; n++) imag[n] = (n % 2) ? 1 / n : 0;
                break;
            case 'bright':
                for (var n = 1; n < N; n++) imag[n] = 2 / Math.pow(n, 0.5);
                break;
            case 'bell':
                for (var n = 1; n < N; n++) imag[n] = 0;
                imag[1] = 1; imag[2] = 0.65; imag[3] = 0.45; imag[4] = 0.3;
                imag[5] = 0.25; imag[6] = 0.15; imag[8] = 0.12; imag[10] = 0.08; imag[13] = 0.06;
                break;
        }
        this._customWaves[type] = new PeriodicWave(ctx, {real: real, imag: imag, disableNormalization: false});
        return this._customWaves[type];
    },

    _getOsc: function(ctx, type, duty) {
        if (type === 'pulse') {
            var osc = ctx.createOscillator();
            osc.type = 'custom';
            osc.setPeriodicWave(this._getPulseWave(ctx, duty));
            return osc;
        }
        if (type === 'organ' || type === 'bright' || type === 'bell') {
            var osc = ctx.createOscillator();
            osc.type = 'custom';
            osc.setPeriodicWave(this._getCustomWave(ctx, type));
            return osc;
        }
        var osc = ctx.createOscillator();
        osc.type = type;
        return osc;
    },

    _applyFreq: function(osc, params, ctxTime, isOffline) {
        var dur = params.duration;
        if (params.curve === 'exponential') {
            var fEnd = Math.max(20, params.freqEnd);
            osc.frequency.setValueAtTime(Math.max(20, params.freqStart), ctxTime || 0);
            osc.frequency.exponentialRampToValueAtTime(fEnd, (ctxTime || 0) + dur);
        } else {
            osc.frequency.setValueAtTime(params.freqStart, ctxTime || 0);
            osc.frequency.linearRampToValueAtTime(params.freqEnd, (ctxTime || 0) + dur);
        }
    },

    _applyEnvelope: function(gainNode, params, ctxTime, duration) {
        var t = ctxTime || 0;
        var d = duration || params.duration;
        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(params.volume, t + params.attack);
        if (params.sustain > 0.01) {
            gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, params.sustain * params.volume), t + params.attack + params.decay);
            var sEnd = t + d - params.release;
            if (sEnd > t + params.attack + params.decay) gainNode.gain.setValueAtTime(params.sustain * params.volume, sEnd);
            gainNode.gain.exponentialRampToValueAtTime(0.001, t + d);
        } else {
            gainNode.gain.exponentialRampToValueAtTime(0.001, t + params.attack + params.decay);
        }
    },

    _applyFilter: function(source, gainNode, params, ctx) {
        if (params.filterType !== 'none') {
            var filter = ctx.createBiquadFilter();
            filter.type = params.filterType;
            filter.frequency.value = params.filterFreq;
            filter.Q.value = params.filterQ;
            source.connect(gainNode);
            gainNode.connect(filter);
            filter.connect(ctx.destination);
        } else {
            source.connect(gainNode);
            gainNode.connect(ctx.destination);
        }
    },

    _createNoise: function(ctx, dur, ctxTime) {
        var nSr = ctx.sampleRate;
        var nBuf = ctx.createBuffer(1, Math.ceil(nSr * dur), nSr);
        var nData = nBuf.getChannelData(0);
        for (var ni = 0; ni < nData.length; ni++) nData[ni] = (Math.random() * 2 - 1);
        var nSrc = ctx.createBufferSource();
        nSrc.buffer = nBuf;
        return nSrc;
    },

    _synthOne: function(ctx, params, ctxTime, duration) {
        var self = this;
        var t = ctxTime || 0;
        var d = duration || params.duration + params.release + 0.05;

        if (params.waveType === 'noise' || (params.noise > 0.8 && params.waveType !== 'pulse' && params.waveType !== 'square')) {
            // 纯噪声模式
            var nSrc = self._createNoise(ctx, d, t);
            var nGain = ctx.createGain();
            self._applyEnvelope(nGain, params, t);
            self._applyFilter(nSrc, nGain, params, ctx);
            nSrc.start(t);
            return nSrc;
        }

        var osc = self._getOsc(ctx, params.waveType, params.duty);
        self._applyFreq(osc, params, t);
        var gain = ctx.createGain();
        self._applyEnvelope(gain, params, t);
        self._applyFilter(osc, gain, params, ctx);
        osc.start(t);
        osc.stop(t + d);

        if (params.noise > 0.01) {
            var nSrc = self._createNoise(ctx, d, t);
            var nGain = ctx.createGain();
            nGain.gain.setValueAtTime(0, t);
            nGain.gain.linearRampToValueAtTime(params.noise * 0.4 * params.volume, t + params.attack);
            nGain.gain.exponentialRampToValueAtTime(0.001, t + params.duration);
            var nFilter = ctx.createBiquadFilter();
            nFilter.type = 'lowpass';
            nFilter.frequency.value = 4000;
            nSrc.connect(nGain);
            nGain.connect(nFilter);
            nFilter.connect(ctx.destination);
            nSrc.start(t);
        }
        return osc;
    },

    _getAudioCtx: function() {
        if (!this._ctx || this._ctx.state === 'closed') {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._pulseWaves = {};
            this._customWaves = {};
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    },

    _onPreview: function() {
        var params = this._getParams();
        if (!params) return;
        var ctx = this._getAudioCtx();
        this._synthOne(ctx, params, ctx.currentTime);
        var info = this._overlay ? this._overlay.querySelector('#ss-info') : null;
        if (info) info.textContent = '▶ ' + this.PRESETS[this._currentPresetIndex || 0].name;
    },

    _onExport: function() {
        var self = this, params = this._getParams();
        if (!params) return;
        var ov = this._overlay;
        var info = ov.querySelector('#ss-info');
        info.textContent = this.TEXTS.MSG_RENDERING;
        var btn = ov.querySelector('#ss-export');
        btn.disabled = true;

        var dur = params.duration + params.release + 0.1;
        var sr = 44100;
        var offlineCtx = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);

        if (params.waveType === 'noise' || (params.noise > 0.8 && params.waveType !== 'pulse' && params.waveType !== 'square')) {
            var nSrc = self._createNoise(offlineCtx, dur, 0);
            var nGain = offlineCtx.createGain();
            self._applyEnvelope(nGain, params, 0);
            if (params.filterType !== 'none') {
                var nFilt = offlineCtx.createBiquadFilter();
                nFilt.type = params.filterType;
                nFilt.frequency.value = params.filterFreq;
                nFilt.Q.value = params.filterQ;
                nSrc.connect(nGain);
                nGain.connect(nFilt);
                nFilt.connect(offlineCtx.destination);
            } else {
                nSrc.connect(nGain);
                nGain.connect(offlineCtx.destination);
            }
            nSrc.start(0);
        } else {
            var osc = self._getOsc(offlineCtx, params.waveType, params.duty);
            self._applyFreq(osc, params, 0);
            var gain = offlineCtx.createGain();
            self._applyEnvelope(gain, params, 0);
            self._applyFilter(osc, gain, params, offlineCtx);
            osc.start(0);

            if (params.noise > 0.01) {
                var nSrc = self._createNoise(offlineCtx, dur, 0);
                var nGain = offlineCtx.createGain();
                nGain.gain.setValueAtTime(0, 0);
                nGain.gain.linearRampToValueAtTime(params.noise * 0.4 * params.volume, params.attack);
                nGain.gain.exponentialRampToValueAtTime(0.001, params.duration);
                var nFilt = offlineCtx.createBiquadFilter();
                nFilt.type = 'lowpass';
                nFilt.frequency.value = 4000;
                nSrc.connect(nGain);
                nGain.connect(nFilt);
                nFilt.connect(offlineCtx.destination);
                nSrc.start(0);
            }
        }

        offlineCtx.startRendering().then(function(renderedBuffer) {
            var wav = self._encodeWAV(renderedBuffer);
            var a = document.createElement('a');
            a.href = URL.createObjectURL(wav);
            a.download = 'sfx-' + self.PRESETS[self._currentPresetIndex || 0].id + '.wav';
            a.click();
            info.textContent = self.TEXTS.MSG_DONE + ' (' + (wav.size / 1024 | 0) + 'KB)';
            btn.disabled = false;
        }).catch(function(err) {
            info.textContent = '导出失败: ' + err.message;
            btn.disabled = false;
        });
    },

    _encodeWAV: function(buf) {
        var nc = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length, bs = 16, ba = nc * bs / 8, ds = len * ba, sz = 44 + ds;
        var ab = new ArrayBuffer(sz), v = new DataView(ab);
        var w = function(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, sz - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true);
        v.setUint16(32, ba, true); v.setUint16(34, bs, true); w(36, 'data'); v.setUint32(40, ds, true);
        var o = 44;
        for (var i = 0; i < len; i++) {
            for (var c = 0; c < nc; c++) {
                var s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]));
                v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                o += 2;
            }
        }
        return new Blob([ab], { type: 'audio/wav' });
    },

    _bindDrag: function(hdr, ov) {
        var self = this, dragging = false, startX, startY, startLeft, startTop;
        hdr.addEventListener('mousedown', function(e) {
            if (e.target.closest('.ss-header-right,button,select')) return;
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            startLeft = ov.offsetLeft; startTop = ov.offsetTop;
        });
        self._onDocMove = function(e) {
            if (!dragging) return;
            ov.style.left = (startLeft + e.clientX - startX) + 'px';
            ov.style.top = (startTop + e.clientY - startY) + 'px';
        };
        self._onDocUp = function() { dragging = false; };
        document.addEventListener('mousemove', self._onDocMove);
        document.addEventListener('mouseup', self._onDocUp);
    },

    _destroy: function() {
        if (this._onDocMove) document.removeEventListener('mousemove', this._onDocMove);
        if (this._onDocUp) document.removeEventListener('mouseup', this._onDocUp);
        if (this._ctx && this._ctx.state !== 'closed') this._ctx.close();
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null; this._ctx = null; this._pulseWaves = {}; this._customWaves = {};
        SkillSystem.deactivate();
    }
};
