/* =========================================================================
   曾文卓 · 视觉传达设计作品集 — 中英双语文本
   -------------------------------------------------------------------------
   仅用于「导航 / 个人介绍 / 项目标题与说明 / 少量界面标签」的切换。
   作品图片、图注与版式不随语言改变；这里的英文缺失时会自动回退到中文，
   因此在后台清空某一项不会导致空白。

   数据结构：
     ui       界面标签（导航、灯箱、按钮）
     site     首页 / 总览 / 关于页的英文文案
     projects 项目英文标题、标语、简介、设计说明与元信息
   ========================================================================= */

window.PORTFOLIO_I18N = {
  ui: {
    navHome: 'HOME',
    navWorks: 'WORKS',
    navAbout: 'ABOUT',
    menuOpen: 'Open menu',
    menuClose: 'Close menu',
    langGroup: 'Language',
    zoomHint: 'CLICK TO ENLARGE · HD ORIGINAL PAGE',
    lightbox: 'High-resolution artwork',
    lightboxClose: 'Close',
    lightboxPrev: 'Previous',
    lightboxNext: 'Next',
    notFoundTitle: 'This project does not exist or has been removed',
    backToWorks: 'Back to all works ↗',
    projectUnit: 'PROJECTS',
    showing: 'SHOWING',
    overviewLabel: 'PROJECT OVERVIEW',
    nextLabel: 'NEXT PROJECT',
    embeddedNote: 'Standalone image embedded in the source PDF',
    footerExtracted: 'All images extracted from the original portfolio',
    footerAllWorks: 'ALL WORKS ↑',
    sourceLabel: 'SOURCE'
  },

  site: {
    docTitle: 'ZENG WENZHUO · Visual Communication Design Portfolio 2023—2026',
    heroLedeHtml: 'Hello, I am <strong>Zeng Wenzhuo</strong>. This is a visual communication design portfolio covering 2023—2026, with <strong>nine</strong> projects across brand identity, mobile interfaces, IP characters, logos and type. Every image here is taken directly from the original portfolio PDF — uncropped and unretouched.',
    indexLabel: 'INDEX / CATEGORIES',
    selectedNote: 'Representative images from five projects, taken from the pictures embedded in the PDF. Click any image to open its project.',
    featuredNote: 'Ordered as they appear in the portfolio. Each project has its own page with the full set of high-resolution images and source page numbers.',
    allWorksLabel: 'VIEW ALL 09 PROJECTS ↗',
    divider1Title: 'Haiyu Low-Altitude',
    divider1Note: '01 / 09 · BRAND VI DESIGN · PDF P03—P18',
    divider2Title: 'South Pearl<br>× Bin Xiaoxun',
    divider2Note: '04 — 05 / 09 · IP DESIGN',
    aboutTitle: 'Design as a way<br>of looking.',
    aboutText1: 'From the order of a brand system and the hierarchy of an interface to the character of an IP and the graphic nature of Chinese type, this portfolio records one question: how to find a visual form that is apt and usable for a specific subject.',
    aboutText2: 'This site is a web reconstruction of a 39-page landscape portfolio. It reorganises the cover, categories, project pages and visual transitions in an editorial layout rather than embedding the PDF page by page.',
    worksLead: 'Nine projects in five categories, ordered by page sequence in the original 《曾文卓作品集2.pdf》. Every cover is an image embedded in the PDF; click through for the full high-resolution set.',
    worksCount: '09 PROJECTS · 39 PAGES IN SOURCE PDF',
    contentsNote: 'The table lists each project by its original PDF page range, for checking and future asset replacement. P15 duplicates P09 in the original PDF and has been removed.',
    aboutPageLead: 'A responsive web version of a 39-page landscape PDF portfolio. All artwork images are extracted directly from the PDF’s embedded images, keeping original proportions and pixels — no cropping, redrawing or AI generation.',
    contactName: 'ZENG WENZHUO / 曾文卓',
    contactSource: '《ZENG WENZHUO PORTFOLIO 2.pdf》· 39 pages'
  },

  categories: {
    'all': 'ALL WORKS',
    'brand-vi': 'BRAND VI DESIGN',
    'ui': 'UI / UX DESIGN',
    'ip': 'IP DESIGN',
    'logo': 'LOGO DESIGN',
    'font': 'FONT DESIGN'
  },

  categoryLabels: {
    'brand-vi': 'Brand VI Design',
    'ui': 'UI / UX Design',
    'ip': 'IP Character Design',
    'logo': 'Logo Design',
    'font': 'Type Design'
  },

  projects: {
    'haiyu-low-altitude': {
      title: 'Haiyu Low-Altitude',
      tagline: 'Explore the low sky · Connect with nature',
      summary: 'Visual identity for a 6S low-altitude camp on the islands of Guangxi, built on a green foundation that runs from the mark and graphic system through a full range of applications.',
      description: [
        'Haiyu Low-Altitude is the first island low-altitude 6S service brand in Guangxi, a key part of the Beihai–Weizhou Island low-altitude travel network, and a one-stop provider that combines professional service with travel experience.',
        'Guided by the idea of “exploring the low sky and connecting with nature”, the brand centres on how people travel and grounds itself in coastal life, bringing nature, technology and warm service together — so every take-off and landing becomes a new way of feeling life.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Brand VI Design' },
        { k: 'SCOPE', v: 'Logo / Construction / Applications / Posters' },
        { k: 'SOURCE PAGES', v: 'PDF P03 — P18' },
        { k: 'PALETTE', v: 'Brand Green · Vital Orange' }
      ]
    },

    'petora': {
      title: 'PETORA',
      tagline: 'AI-powered pet lifestyle platform',
      summary: 'An AI pet lifestyle platform for future pet-care scenarios, covering health monitoring, smart devices, AI companionship and pet social features.',
      description: [
        'PETORA is an AI-powered pet lifestyle platform built for future pet-care scenarios. Health data, smart-device integration, AI companionship, pet social features and care services are organised into a single interface system.',
        'The interface is grounded in deep blue and a saturated blue-violet gradient, paired with large rounded cards and a clear data hierarchy — technological in feel, yet dense and readable.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Mobile UI Design' },
        { k: 'SCOPE', v: 'Key visual / Overview / Screens' },
        { k: 'SOURCE PAGES', v: 'PDF P20 — P21' },
        { k: 'PALETTE', v: 'Deep Space Blue · Electric Blue' }
      ]
    },

    'zhenban': {
      title: 'Zhenban',
      tagline: 'A companion for older patients',
      summary: 'A one-stop smart healthcare platform for older users, following the visit journey from splash and onboarding screens to prototype and home page.',
      description: [
        'Zhenban positions itself as “a companion for older patients”, offering convenient, efficient and considerate healthcare services so that seeing a doctor becomes simpler and calmer.',
        'The portfolio presents the work along the line of “technology guards health, service warms the home”, using a clear teal interface and an age-friendly information hierarchy across splash, onboarding, prototype and home screens.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Mobile UI Design' },
        { k: 'SCOPE', v: 'Key visual / Design process / Prototype' },
        { k: 'SOURCE PAGES', v: 'PDF P22 — P23' },
        { k: 'PALETTE', v: 'Medical Teal' }
      ]
    },

    'south-pearl': {
      title: 'South Pearl',
      tagline: 'Beihai intangible heritage pearl IP',
      summary: 'An IP character based on the South Pearl, a piece of Beihai intangible cultural heritage, including logo, main character, three-view sheet, emoji set, scenes and posters.',
      description: [
        'South Pearl takes the Beihai heritage pearl as its motif, translating shell, lustre and ocean imagery into a soft, approachable pink character.',
        'The system extends across logo and wordmark, main character, three-view sheet, emoji, scene illustrations and poster applications, forming an IP identity that can be used directly.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'IP Character Design' },
        { k: 'SCOPE', v: 'Logo / Character / Three-view / Emoji / Posters' },
        { k: 'SOURCE PAGES', v: 'PDF P25 — P27' },
        { k: 'PALETTE', v: 'Pearl Pink' }
      ]
    },

    'binxiaoxun': {
      title: 'Bin Xiaoxun',
      tagline: 'A guide to open government information',
      summary: 'A blue-and-white government service IP built around openness, connection and smart service, with a three-view sheet, expressions and action extensions.',
      description: [
        'Bin Xiaoxun is the IP character for an open-government information assistant. Its form combines government service, information delivery and a sense of future technology, in blue and white: blue for transparency, efficiency and public trust; white for clarity, friendliness and warmth.',
        'Extensions include the design concept, character three-view sheet, emoji set and action poses, forming an anthropomorphic identity that works across online and offline scenarios.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'IP Character Design' },
        { k: 'SCOPE', v: 'Concept / Three-view / Emoji / Actions' },
        { k: 'SOURCE PAGES', v: 'PDF P28 — P29' },
        { k: 'PALETTE', v: 'Government Blue · White' }
      ]
    },

    'logo': {
      title: 'Logo Design',
      tagline: 'Marks and graphic symbols',
      summary: 'A selection of logo work: a Duolingo mark redesign, CHICKEN WAVE street-food branding, and the Huahai–Chixi brand mark.',
      description: [
        'Three sets of marks: a green-led Duolingo redesign; CHICKEN WAVE, where orange-red and a handwritten feel shape a spicy street-food character; and the bright Huahai–Chixi brand graphic.',
        'Each mark is shown on its original page, including the mark itself, its graphic derivation and applied atmosphere, with no partial cropping.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Logo Design' },
        { k: 'SCOPE', v: 'Duolingo / CHICKEN WAVE / Huahai–Chixi' },
        { k: 'SOURCE PAGES', v: 'PDF P31, P32, P34' },
        { k: 'NOTE', v: 'The China–Bolivia 40th anniversary mark on P33 is a separate project' }
      ]
    },

    'china-bolivia-40': {
      title: 'China–Bolivia 40th Anniversary',
      tagline: 'Peace · Friendship · Cooperation · Win-win',
      summary: 'A commemorative mark for the 40th anniversary of diplomatic relations between China and Bolivia, using red and gold and the number 40 to carry the theme of friendship.',
      description: [
        'The mark is built around the anniversary number 40, gathering cultural references from both countries and celebratory colour into a symmetrical, formal graphic structure.',
        'The theme “Peace · Friendship · Cooperation · Win-win” appears alongside its Spanish counterpart; the original is dated 2025.7.9.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Commemorative Mark' },
        { k: 'SCOPE', v: 'Mark / Lockup / Application' },
        { k: 'SOURCE PAGES', v: 'PDF P33' },
        { k: 'PALETTE', v: 'China Red · Gold' }
      ]
    },

    'font-design': {
      title: 'Original Type Design',
      tagline: 'Future design · Everything renewed',
      summary: 'Chinese type and type-poster collection, including three-dimensional letterform experiments, “FUTURE CYBER” and a series of original wordmarks.',
      description: [
        'The type chapter treats Chinese strokes graphically: wordmarks such as “万物向新”, “心电”, “织梦”, “少年派” and “啤酒”, alongside poster sets for “未来设计 FUTURE CYBER” and “青年力量”.',
        'Fluorescent green against deep ink green sets a high-contrast, technological tone; letterforms become the subject in grids, in three dimensions and through repetition, foregrounding the expressiveness of Chinese characters.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Type / Wordmark Design' },
        { k: 'SCOPE', v: 'Letterform experiments / Wordmarks / Type posters' },
        { k: 'SOURCE PAGES', v: 'PDF P35, P37 — P38' },
        { k: 'PALETTE', v: 'Fluorescent Green · Ink Green' }
      ]
    },

    'type-poster': {
      title: 'Experimental Chinese Type Posters',
      tagline: 'The beauty of Chinese characters',
      summary: 'A diptych of experimental typographic posters on the theme “大美汉字”, pushing Chinese character structure toward pure graphic expression in high-contrast black and white.',
      description: [
        'Two posters form a pair: black, white and grey are the entire palette; radicals, strokes and blocks are enlarged to an almost architectural scale, so that readability and graphic quality pull against each other on the same sheet.',
        'The most restrained set in the type chapter, it contrasts sharply with the fluorescent green of “Future Design” and echoes the warm white and deep black that ground the whole portfolio.'
      ],
      meta: [
        { k: 'CATEGORY', v: 'Experimental Type Posters' },
        { k: 'SCOPE', v: 'Diptych' },
        { k: 'SOURCE PAGES', v: 'PDF P36' },
        { k: 'PALETTE', v: 'Black · White · Grey' }
      ]
    }
  }
};
