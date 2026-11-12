/* =========================================================================
 * 曾文卓 · 视觉传达设计作品集  —  内容数据（唯一数据源）
 * -------------------------------------------------------------------------
 * 所有图片均直接提取自《曾文卓作品集2.pdf》，未裁切、未重绘、未二次生成。
 * src  : assets/ 下的原始提取图（保持 PDF 内嵌图片的原始字节与比例）
 * hd   : PDF 原页 200dpi 高清渲染页码，用于点击放大（assets/hd/page-XXXX.jpg）
 * pages: 该作品在原始 PDF 中的页码范围，便于核对与替换
 *
 * 维护提示：新增作品只需在 projects 数组中追加一项；
 *           替换图片只需保持同名覆盖 assets/<项目目录>/ 下的文件。
 * ========================================================================= */

(function () {
  'use strict';

  const A = (p) => p;                       // 相对 assets/ 的前缀由 site.js 补全
  const H = (n) => `assets/hd/page-${String(n).padStart(4, '0')}.jpg`;

  const categories = [
    { id: 'all',      label: '全部作品',  en: 'ALL WORKS',        desc: '09 个项目' },
    { id: 'brand-vi', label: '品牌 VI',   en: 'BRAND VI DESIGN',  desc: '01 个项目' },
    { id: 'ui',       label: '界面设计',  en: 'UI / UX DESIGN',   desc: '02 个项目' },
    { id: 'ip',       label: 'IP 设计',   en: 'IP DESIGN',        desc: '02 个项目' },
    { id: 'logo',     label: '标志设计',  en: 'LOGO DESIGN',      desc: '02 个项目' },
    { id: 'font',     label: '字体设计',  en: 'FONT DESIGN',      desc: '02 个项目' }
  ];

  const projects = [
    /* ------------------------------------------------------------------ 01 */
    {
      id: 'haiyu-low-altitude',
      index: '01',
      title: '海屿低空',
      en: 'HAIYU LOW ALTITUDE CAMP',
      category: 'brand-vi',
      categoryLabel: '品牌 VI 设计',
      pages: 'P03 — P18',
      accent: '#4B7A34',
      accentSoft: '#E7EEDF',
      ink: '#F4F2E9',
      dark: '#101A0C',
      tagline: '探索低空 · 连接自然',
      slogan: '把生活还给风',
      summary: '广西海岛低空 6S 营地品牌视觉识别系统，以绿色为基调构建从标志、辅助图形到周边应用的完整体系。',
      description: [
        '海屿低空作为广西首个海岛低空 6S 服务品牌，是北海—涠洲岛低空文旅格局中的关键载体，也是集专业服务与文旅体验于一体的一站式低空综合服务商。',
        '品牌以「探索低空、连接自然」为理念，以用户出行为核心、滨海生活为底色，把自然、科技与暖心服务融合在一起，让每一次起飞与降落，都成为重新感受生活的全新体验。'
      ],
      meta: [
        { k: '类别', v: '品牌 VI 设计' },
        { k: '范围', v: '标志 / 制图 / 应用 / 海报' },
        { k: '原作页码', v: 'PDF P03 — P18' },
        { k: '主色', v: '品牌绿 · 活力橙' }
      ],
      cover: 'assets/haiyu-low-altitude/01-cover.jpg',
      coverHd: 3,
      blocks: [
        { kind: 'text', eyebrow: 'BRAND STORY / 品牌介绍', title: '探索低空，连接自然',
          body: [
            '「把生活还给风」是海屿低空贯穿整套视觉系统的核心表达。标志以山屿、气流与飞行轨迹构成，配合克制的绿色与暖橙，把户外营地的松弛感与低空科技的秩序感并置。',
            '本套视觉识别系统覆盖标志制图、标准色、辅助图形、办公事务用品、员工识别、产品设备、周边衍生与主视觉海报。'
          ] },
        { kind: 'full', src: A('assets/haiyu-low-altitude/02-brand-story.jpg'), hd: H(4),
          caption: '品牌介绍 / BRAND INTRODUCTION', note: '原作 P04' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/03-logo-construction.jpg'), hd: H(5),
          caption: '标志标准化制图 / LOGO CONSTRUCTION', note: '原作 P05' },
        { kind: 'pair', items: [
          { src: A('assets/haiyu-low-altitude/04-business-card.jpg'), hd: H(6), caption: '名片设计' },
          { src: A('assets/haiyu-low-altitude/05-id-badge.jpg'), hd: H(7), caption: '工作证与挂绳' }
        ], caption: '办公事务系统 / STATIONERY' },
        { kind: 'pair', items: [
          { src: A('assets/haiyu-low-altitude/06-washi-tape.jpg'), hd: H(8), caption: '胶带与贴纸' },
          { src: A('assets/haiyu-low-altitude/07-vi-manual.jpg'), hd: H(9), caption: '视觉识别系统手册' }
        ], caption: '识别系统手册 / VI MANUAL' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/08-auxiliary-graphics.jpg'), hd: H(10),
          caption: '辅助图形 / AUXILIARY GRAPHICS', note: '原作 P10' },
        { kind: 'band', eyebrow: 'BRAND SLOGAN', title: '把生活还给风',
          text: 'GIVE LIFE BACK TO THE WIND', note: '海屿低空 · 品牌主张' },
        { kind: 'text', eyebrow: 'APPLICATION / 周边应用', title: '从装备到日常',
          body: [
            '把标志与辅助图形延展到手机壳、工作马甲、帽子、刀具、保温箱、地面站、货运无人机、热气球与手提袋等真实载体上，保持同一套视觉语汇在不同材质上的一致性。'
          ] },
        { kind: 'grid', cols: 4, caption: '周边应用细节 / APPLICATION DETAILS',
          items: [
            { src: A('assets/haiyu-low-altitude/applications/01-phone-cases.jpg'), caption: '手机壳' },
            { src: A('assets/haiyu-low-altitude/applications/02-vests.jpg'), caption: '工作马甲' },
            { src: A('assets/haiyu-low-altitude/applications/03-bucket-hats.jpg'), caption: '渔夫帽' },
            { src: A('assets/haiyu-low-altitude/applications/04-baseball-caps.jpg'), caption: '棒球帽' },
            { src: A('assets/haiyu-low-altitude/applications/05-multitool.jpg'), caption: '多功能工具' },
            { src: A('assets/haiyu-low-altitude/applications/06-mug.jpg'), caption: '马克杯' },
            { src: A('assets/haiyu-low-altitude/applications/07-cooler.jpg'), caption: '保温箱' },
            { src: A('assets/haiyu-low-altitude/applications/08-knife.jpg'), caption: '户外刀具' },
            { src: A('assets/haiyu-low-altitude/applications/09-ground-station.jpg'), caption: '地面站' },
            { src: A('assets/haiyu-low-altitude/applications/10-cargo-drone.jpg'), caption: '货运无人机' },
            { src: A('assets/haiyu-low-altitude/applications/11-satellite-dish.jpg'), caption: '卫星天线' },
            { src: A('assets/haiyu-low-altitude/applications/12-hot-air-balloon.jpg'), caption: '热气球' },
            { src: A('assets/haiyu-low-altitude/applications/13-tote-kraft.jpg'), caption: '牛皮纸手提袋' },
            { src: A('assets/haiyu-low-altitude/applications/14-tote-black.jpg'), caption: '黑色手提袋' },
            { src: A('assets/haiyu-low-altitude/applications/15-tote-canvas.jpg'), caption: '帆布手提袋' },
            { src: A('assets/haiyu-low-altitude/applications/16-tote-green.jpg'), caption: '绿色手提袋' }
          ] },
        { kind: 'full', src: A('assets/haiyu-low-altitude/spreads/01-merch-wearables.jpg'), hd: H(11),
          caption: '周边应用原页 · 穿戴类', note: '原作 P11' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/spreads/02-merch-gear.jpg'), hd: H(12),
          caption: '周边应用原页 · 装备类', note: '原作 P12' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/spreads/03-devices.jpg'), hd: H(13),
          caption: '产品与设备设计', note: '原作 P13' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/spreads/04-tote-bags.jpg'), hd: H(14),
          caption: '手提袋系列', note: '原作 P14' },
        { kind: 'full', src: A('assets/haiyu-low-altitude/09-key-visual.jpg'), hd: H(16),
          caption: '主视觉海报 / CAMPING LOW SKY', note: '原作 P16' },
        { kind: 'posters', caption: '系列海报 / POSTER SERIES',
          items: [
            { src: A('assets/haiyu-low-altitude/10-poster-flight.jpg'), caption: '飞行 · 山屿' },
            { src: A('assets/haiyu-low-altitude/11-poster-sunset.jpg'), caption: '落日 · 海岸' },
            { src: A('assets/haiyu-low-altitude/12-poster-forest.jpg'), caption: '营地 · 林间' },
            { src: A('assets/haiyu-low-altitude/13-poster-coast.jpg'), caption: '滨海 · 漫游' }
          ] },
        { kind: 'pair', items: [
          { src: A('assets/haiyu-low-altitude/spreads/05-poster-series-01.jpg'), hd: H(17), caption: '系列海报原页 01' },
          { src: A('assets/haiyu-low-altitude/spreads/06-poster-series-02.jpg'), hd: H(18), caption: '系列海报原页 02' }
        ], caption: '海报原页 / EDITORIAL SPREADS' }
      ]
    },

    /* ------------------------------------------------------------------ 02 */
    {
      id: 'petora',
      index: '02',
      title: 'PETORA',
      en: 'AI PET LIFESTYLE PLATFORM',
      category: 'ui',
      categoryLabel: '界面设计',
      pages: 'P20 — P21',
      accent: '#1C6EF2',
      accentSoft: '#DCE9FF',
      ink: '#0B1730',
      dark: '#0B1730',
      tagline: 'AI 智能宠物生活方式平台',
      slogan: 'AI-POWERED PET CARE',
      summary: '面向未来宠物生活场景的 AI 智能宠物生活平台，覆盖健康监测、智能设备、AI 陪伴与宠物社交等模块。',
      description: [
        'PETORA 是一款面向未来宠物生活场景打造的 AI 智能宠物生活方式平台，把健康数据、智能设备联动、AI 陪伴互动、宠物社交与养护服务整合在同一套界面体系之中。',
        '界面以深蓝与高饱和蓝紫渐变为基调，配合大圆角卡片与清晰的数据可视化层级，在保持科技感的同时维持信息密度与可读性。'
      ],
      meta: [
        { k: '类别', v: '移动端 UI 设计' },
        { k: '范围', v: '主视觉 / 项目概述 / 界面' },
        { k: '原作页码', v: 'PDF P20 — P21' },
        { k: '主色', v: '深空蓝 · 电光蓝' }
      ],
      cover: 'assets/petora/01-hero.jpg',
      coverHd: 20,
      blocks: [
        { kind: 'text', eyebrow: 'PROJECT OVERVIEW / 项目概述', title: '一套完整的宠物生活界面',
          body: [
            '从产品定位、功能模块到界面视觉，PETORA 以「数据驱动科学养宠」为线索组织信息。项目概述页并列呈现启动页、首页、健康数据、AI 陪伴与社交等多张界面，完整展示一个移动端产品的界面全貌。'
          ] },
        { kind: 'full', src: A('assets/petora/02-overview.jpg'), hd: H(21),
          caption: '项目概述与界面展示 / UI SCREENS', note: '原作 P21' },
        { kind: 'note', title: '界面完整性',
          text: '本项目详情页保留了原作中的整版界面编排，未对手机屏幕、状态栏或信息结构做任何裁切与改写，以便完整呈现界面之间的关系。' }
      ]
    },

    /* ------------------------------------------------------------------ 03 */
    {
      id: 'zhenban',
      index: '03',
      title: '诊伴',
      en: 'ONE-STOP SMART HEALTHCARE',
      category: 'ui',
      categoryLabel: '界面设计',
      pages: 'P22 — P23',
      accent: '#3FAE9C',
      accentSoft: '#DDF1EC',
      ink: '#123B37',
      dark: '#123B37',
      tagline: '老人的就诊伙伴',
      slogan: '一站式智慧医疗服务平台',
      summary: '为老年人打造的一站式智慧医疗服务平台，围绕就诊流程梳理启动页、引导页、产品原型与首页。',
      description: [
        '诊伴定位为「老人的就诊伙伴」，为老年用户提供便捷、高效、贴心的医疗健康服务，让就医更简单、更安心。',
        '作品集以「科技守护健康 · 服务温暖到家」为表达主线，用清晰的青绿色界面与适老化的信息层级呈现从启动登录页、引导页、产品原型到首页的完整设计流程。'
      ],
      meta: [
        { k: '类别', v: '移动端 UI 设计' },
        { k: '范围', v: '主视觉 / 设计流程 / 原型' },
        { k: '原作页码', v: 'PDF P22 — P23' },
        { k: '主色', v: '医疗青绿' }
      ],
      cover: 'assets/zhenban/01-hero.jpg',
      coverHd: 22,
      blocks: [
        { kind: 'text', eyebrow: 'DESIGN PROCESS / 设计流程', title: '从启动页到首页',
          body: [
            '原作以流程化版面组织四类界面：启动登录页、引导页、产品原型与首页。这一编排本身即是项目叙事的一部分，因此在本页完整保留，仅做响应式适配。'
          ] },
        { kind: 'full', src: A('assets/zhenban/02-process.jpg'), hd: H(23),
          caption: '设计流程 / 启动登录页 · 引导页 · 产品原型 · 首页', note: '原作 P23' }
      ]
    },

    /* ------------------------------------------------------------------ 04 */
    {
      id: 'south-pearl',
      index: '04',
      title: 'South Pearl 南珠',
      en: 'BEIHAI INTANGIBLE HERITAGE IP',
      category: 'ip',
      categoryLabel: 'IP 设计',
      pages: 'P25 — P27',
      accent: '#E88C93',
      accentSoft: '#FCE6E6',
      ink: '#5A2A31',
      dark: '#5A2A31',
      tagline: '北海非遗南珠 IP 形象设计',
      slogan: 'SOUTH PEARL',
      summary: '以北海非遗南珠为原型的 IP 形象设计，包含标志、主形象、三视图、表情包、场景图与海报延展。',
      description: [
        'South Pearl 以「北海非遗南珠」为创作母题，把珠贝、光泽与海洋意向转译为一个柔软、亲和的粉色角色形象。',
        '整套延展覆盖标志与标准字、主形象、三视图、表情包、场景插画及海报应用，形成可直接落地的 IP 形象系统。'
      ],
      meta: [
        { k: '类别', v: 'IP 形象设计' },
        { k: '范围', v: '标志 / 主形象 / 三视图 / 表情 / 海报' },
        { k: '原作页码', v: 'PDF P25 — P27' },
        { k: '主色', v: '珠贝粉' }
      ],
      cover: 'assets/south-pearl/01-cover.jpg',
      coverHd: 25,
      blocks: [
        { kind: 'text', eyebrow: 'IP SYSTEM / 形象系统', title: '一颗珠子，一个角色',
          body: [
            '从主形象的圆润轮廓到三视图的比例规范，再到表情包与场景插画，粉色贯穿整套系统，使角色在不同媒介上保持一致的识别度。'
          ] },
        { kind: 'full', src: A('assets/south-pearl/02-logo.png'), hd: H(26),
          caption: '标志与主形象 / LOGO & CHARACTER', note: '原作 P26' },
        { kind: 'full', src: A('assets/south-pearl/03-system.jpg'), hd: H(27),
          caption: '三视图 · 表情包 · 场景图 · 海报', note: '原作 P27' }
      ]
    },

    /* ------------------------------------------------------------------ 05 */
    {
      id: 'binxiaoxun',
      index: '05',
      title: '滨小讯',
      en: 'BIN XIAO XUN',
      category: 'ip',
      categoryLabel: 'IP 设计',
      pages: 'P28 — P29',
      accent: '#3C7BDA',
      accentSoft: '#DCE8FB',
      ink: '#123A78',
      dark: '#123A78',
      tagline: '政务公开信息助手',
      slogan: '滨州政好 · 众所周知',
      summary: '蓝白色系的政务服务 IP 形象，以「信息公开、连接群众、智慧服务」为核心理念，含三视图、表情与动作延展。',
      description: [
        '滨小讯是政务公开信息助手的 IP 形象。整体造型融合政务服务、信息传播与未来科技感，以蓝白色系为主：蓝色象征公开透明、科技高效与政务公信力，白色代表简洁、亲和与服务温度。',
        '延展部分包含设计理念、角色三视图、IP 表情包与动作延展，构成一套可用于线上线下多场景的政务拟人化形象。'
      ],
      meta: [
        { k: '类别', v: 'IP 形象设计' },
        { k: '范围', v: '理念 / 三视图 / 表情 / 动作延展' },
        { k: '原作页码', v: 'PDF P28 — P29' },
        { k: '主色', v: '政务蓝 · 白' }
      ],
      cover: 'assets/binxiaoxun/01-cover.jpg',
      coverHd: 28,
      blocks: [
        { kind: 'band', eyebrow: 'IP CONCEPT', title: '信息公开 · 连接群众 · 智慧服务',
          text: 'BIN XIAO XUN / 政务公开信息助手', note: '原作 P29 · 设计理念' },
        { kind: 'full', src: A('assets/binxiaoxun/02-system.png'), hd: H(29),
          caption: '设计理念 · 三视图 · IP 表情包 · 动作延展', note: '原作 P29' },
        { kind: 'note', title: '蓝色视觉',
          text: '本项目是作品集中蓝色体系最完整的一组，网页在章节过渡与下一项目导览处直接沿用其蓝白配色，形成品牌视觉的连续性。' }
      ]
    },

    /* ------------------------------------------------------------------ 06 */
    {
      id: 'logo',
      index: '06',
      title: 'Logo 设计',
      en: 'LOGOTYPE & MARKS',
      category: 'logo',
      categoryLabel: '标志设计',
      pages: 'P30 — P34',
      accent: '#E2663C',
      accentSoft: '#FBE7DC',
      ink: '#3A2118',
      dark: '#3A2118',
      tagline: '标志与图形符号',
      slogan: 'LOGO DESIGN',
      summary: '标志设计合集，收录 Duolingo 标志再设计、CHICKEN WAVE 街头餐饮标志与「花海—赤西」品牌标志。',
      description: [
        '本章节收录三组标志作品：以绿色为主调的 Duolingo 标志再设计、以橙红与手写感塑造街头辣味餐饮气质的 CHICKEN WAVE，以及色彩明快的「花海—赤西」品牌图形。',
        '每一组标志均按其原始页面完整呈现，包含标志本体、图形推演与应用氛围，不做局部裁切。'
      ],
      meta: [
        { k: '类别', v: '标志设计' },
        { k: '范围', v: 'Duolingo / CHICKEN WAVE / 花海—赤西' },
        { k: '原作页码', v: 'PDF P31、P32、P34' },
        { k: '说明', v: 'P33 中玻建交 40 周年标志单列为独立项目' }
      ],
      cover: 'assets/logo/01-duolingo.jpg',
      coverHd: 31,
      blocks: [
        { kind: 'text', eyebrow: 'SELECTED MARKS / 标志选辑', title: '三种气质，三套符号',
          body: [
            '从互联网产品的亲和力、街头餐饮的张力，到地域文旅品牌的明快节奏，三组标志分别对应不同的图形策略与色彩逻辑。'
          ] },
        { kind: 'full', src: A('assets/logo/02-chicken-wave.jpg'), hd: H(32),
          caption: 'CHICKEN WAVE / SPICY STREET FOOD WITH FIRE', note: '原作 P32' },
        { kind: 'full', src: A('assets/logo/03-huahai-chixi.jpg'), hd: H(34),
          caption: '花海—赤西 / HUAHAI — CHIXI', note: '原作 P34' }
      ]
    },

    /* ------------------------------------------------------------------ 07 */
    {
      id: 'china-bolivia-40',
      index: '07',
      title: '中玻建交 40 周年',
      en: 'CHINA – BOLIVIA 40 AÑOS',
      category: 'logo',
      categoryLabel: '标志设计',
      pages: 'P33',
      accent: '#8C2A24',
      accentSoft: '#F4E2D3',
      ink: '#4A1714',
      dark: '#4A1714',
      tagline: '和平 · 友谊 · 合作 · 共赢',
      slogan: 'PAZ · AMISTAD · COOPERACIÓN',
      summary: '中国与玻利维亚建交 40 周年纪念标志，以红金配色与「40」图形承载两国友好主题。',
      description: [
        '标志围绕「40」这一纪念数字展开，将两国文化意象与庆典色彩收束在一个对称、庄重的图形结构中。',
        '主题词「和平 · 友谊 · 合作 · 共赢」与西语对应表述并列呈现，原作标注日期为 2025.7.9。'
      ],
      meta: [
        { k: '类别', v: '纪念标志设计' },
        { k: '范围', v: '标志 / 标准组合 / 应用' },
        { k: '原作页码', v: 'PDF P33' },
        { k: '主色', v: '中国红 · 金' }
      ],
      cover: 'assets/china-bolivia-40/01-logo.jpg',
      coverHd: 33,
      blocks: [
        { kind: 'band', eyebrow: 'ANNIVERSARY MARK', title: '和平 · 友谊 · 合作 · 共赢',
          text: '2025.7.9 / CHINA – BOLIVIA 40 AÑOS', note: '原作 P33' },
        { kind: 'full', src: A('assets/china-bolivia-40/01-logo.jpg'), hd: H(33),
          caption: '中玻建交 40 周年标志 / 完整原页', note: '原作 P33' }
      ]
    },

    /* ------------------------------------------------------------------ 08 */
    {
      id: 'font-design',
      index: '08',
      title: '原创字体设计',
      en: 'FUTURE CYBER / TYPEFACE',
      category: 'font',
      categoryLabel: '字体设计',
      pages: 'P35、P37 — P38',
      accent: '#8FC63F',
      accentSoft: '#E9F3D6',
      ink: '#1B2B24',
      dark: '#1B2B24',
      tagline: '未来设计 · 万物向新',
      slogan: 'FUTURE CYBER',
      summary: '中文字体与字体海报合集，包含立体字形实验、「未来设计 / FUTURE CYBER」及多组原创字标。',
      description: [
        '字体章节以图形化方式处理汉字笔画：既有「万物向新」「心电」「织梦」「少年派」「啤酒」等字标实验，也有「未来设计 FUTURE CYBER」与「青年力量」等成组海报。',
        '荧光绿与深墨绿构成高对比的科技感基调，字形在网格、立体与重复构成中被当作图形主体，突出汉字本身的表现力。'
      ],
      meta: [
        { k: '类别', v: '字体 / 字标设计' },
        { k: '范围', v: '字形实验 / 字标 / 字体海报' },
        { k: '原作页码', v: 'PDF P35、P37 — P38' },
        { k: '主色', v: '荧光绿 · 墨绿' }
      ],
      cover: 'assets/font-design/02-future-cyber.jpg',
      coverHd: 38,
      blocks: [
        { kind: 'band', eyebrow: 'TYPE EXPERIMENT', title: '未来设计 FUTURE CYBER',
          text: '汉字作为图形 / CHINESE CHARACTERS AS GRAPHICS', note: '原作 P35、P38' },
        { kind: 'full', src: A('assets/font-design/01-typeface-set.png'), hd: H(37),
          caption: '立体字形与原创字标合集', note: '原作 P37' },
        { kind: 'full', src: A('assets/font-design/02-future-cyber.jpg'), hd: H(38),
          caption: '未来设计 / 青年力量 字体海报', note: '原作 P38' },
        { kind: 'note', title: '图形表现力',
          text: '本页按原作整版呈现海报与字标，未把汉字拆解成单字重排，以保留字形、字距与版面之间的原始关系。' }
      ]
    },

    /* ------------------------------------------------------------------ 09 */
    {
      id: 'type-poster',
      index: '09',
      title: '中文实验字体海报',
      en: 'DAMEI HANZI / 大美汉字',
      category: 'font',
      categoryLabel: '字体设计',
      pages: 'P36',
      accent: '#1A1A1A',
      accentSoft: '#E9E7E1',
      ink: '#111111',
      dark: '#111111',
      tagline: '大美汉字',
      slogan: 'CHINESE TYPOGRAPHY POSTERS',
      summary: '以「大美汉字」为主题的双联实验排版海报，用黑白高对比把汉字结构推向纯粹的图形表达。',
      description: [
        '两张海报并列构成一组：以黑、白、灰为全部色彩，把汉字的偏旁、笔画与体块放大到近乎建筑尺度，让阅读性与图形性在同一版面里相互拉扯。',
        '作为字体章节中最克制的一组，它与荧光绿的「未来设计」形成强烈对照，也呼应整套作品集暖白与深黑的基础色调。'
      ],
      meta: [
        { k: '类别', v: '实验字体海报' },
        { k: '范围', v: '双联海报' },
        { k: '原作页码', v: 'PDF P36' },
        { k: '主色', v: '黑 · 白 · 灰' }
      ],
      cover: 'assets/type-poster/01-damei-hanzi.png',
      coverHd: 36,
      blocks: [
        { kind: 'full', src: A('assets/type-poster/01-damei-hanzi.png'), hd: H(36),
          caption: '大美汉字 / 中文实验字体海报（双联）', note: '原作 P36' },
        { kind: 'note', title: '关于版式',
          text: '原作为横版跨页双联海报。网页保留完整画面比例，采用等比缩放与留白排布，不做主体裁切。' }
      ]
    }
  ];

  window.PORTFOLIO = {
    owner: {
      name: '曾文卓',
      en: 'ZENG WENZHUO',
      role: '视觉传达设计 / VISUAL COMMUNICATION DESIGN',
      period: '2023 — 2026',
      tel: '19870683884',
      email: '3288084831@qq.com',
      wechat: 'z3288084831y',
      source: '《曾文卓作品集2.pdf》· 39 页'
    },
    categories: categories,
    projects: projects,
    dividers: {
      'brand-vi': 'assets/site/section-brand-vi.jpg',
      'ui':       'assets/site/section-ui-ux.jpg',
      'ip':       'assets/site/section-ip.jpg',
      'logo':     'assets/site/section-logo.jpg',
      'font':     'assets/site/section-font.jpg'
    },
    cover: 'assets/site/cover-title.png',
    closing: 'assets/site/closing.jpg'
  };
})();
