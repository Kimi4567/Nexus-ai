import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Locale = 'ar' | 'en';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => any;
  isRTL: boolean;
  dir: 'rtl' | 'ltr';
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ar');

  useEffect(() => {
    const saved = localStorage.getItem('nexus_locale') as Locale | null;
    if (saved === 'ar' || saved === 'en') {
      setLocaleState(saved);
    } else {
      // Default to Arabic for Middle East
      setLocaleState('ar');
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('nexus_locale', newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr';
  }, []);

  // Simple dot-notation translator
  const t = useCallback((key: string) => {
    const keys = key.split('.');
    let value: any = translations[locale];
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        // Fallback to English
        let fallback: any = translations['en'];
        for (const fk of keys) {
          if (fallback && typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk];
          } else {
            return key; // Return key as last resort
          }
        }
        return fallback;
      }
    }
    return typeof value === 'string' ? value : key;
  }, [locale]);

  const isRTL = locale === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, isRTL, dir }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}

// ── Translation dictionaries ──
// Formal Modern Standard Arabic (فصحى) — suitable for all Middle East
const translations: Record<Locale, Record<string, any>> = {
  ar: {
    nav: {
      home: 'الرئيسية',
      pricing: 'الأسعار',
      faq: 'الأسئلة الشائعة',
      dashboard: 'لوحة التحكم',
      logout: 'خروج',
      login: 'تسجيل الدخول',
      register: 'إنشاء حساب',
      startNow: 'ابدأ الآن',
    },
    hero: {
      statusOnline: 'النظام يعمل',
      agentsReady: '٤ وكلاء جاهزون للإطلاق',
      version: 'v3.0.1',
      headline1: 'فريق ذكاء',
      headline2: 'اصطناعي يعمل لك',
      subheadline: 'مركبة NEXUS AI مجهزة بـ ٤ وكلاء متخصصين. NEX ينتج. VEX يُعلن. PULSE يُحلل. Sentinel يُراقب.',
      tagline: 'كل ذلك وأنت نائم. الموافقات تكون منك. النتائج تكون فعلية.',
      ctaPrimary: 'شغّل مركبتك',
      ctaDemo: 'شاهد العرض التوضيحي',
      connectedNow: 'متصل الآن:',
      comingSoon: '+٣ قريباً',
    },
    agents: {
      sectionLabel: 'طاقم المركبة',
      title: '٤ وكلاء. مهمة واحدة.',
      subtitle: 'كل وكيل متخصص في مجاله. يعملون معاً كفريق واحد — كما يحدث في أفضل الشركات، لكن بالذكاء الاصطناعي.',
      nex: {
        name: 'NEX',
        fullName: 'NEX — Neural Explorer',
        role: 'منتج الفيديو',
        desc: 'يولد فيديوهات تسويقية احترافية بالكامل باستخدام أحدث نماذج الذكاء الاصطناعي. يكتب السكريبت، ويختار الصوت، ويركّب المشاهد.',
      },
      vex: {
        name: 'VEX',
        fullName: 'VEX — Virtual Executor',
        role: 'مدير الإعلانات',
        desc: 'يُنشئ ويدير حملاتك الإعلانية على Meta، وTikTok، وGoogle، وSnapchat. يُحسّن الميزانية يومياً ويُعيد استهداف الجمهور تلقائياً.',
      },
      pulse: {
        name: 'PULSE',
        fullName: 'PULSE — Predictive Learning Unit',
        role: 'المحلل الاستراتيجي',
        desc: 'يحلل بيانات حملاتك في الوقت الفعلي ويقدم توصيات مبنية على أنماط يصعب على الإنسان العادي رؤيتها. يتنبأ بالاتجاهات قبل حدوثها.',
      },
      sentinel: {
        name: 'Sentinel',
        fullName: 'Sentinel — Strategic Guardian',
        role: 'الحارس الذكي',
        desc: 'يراقب كل شيء: الميزانية، والأداء، والمنافسين، والمشاكل التقنية. يحذرك قبل حدوث المشكلة، ويُقترح حلولاً فورية.',
      },
    },
    howItWorks: {
      sectionLabel: 'تسلسل الإطلاق',
      title: '٣ خطوات. وانطلق.',
      subtitle: 'لا يوجد تعقيد. لا يوجد إعداد طويل. في ٣ دقائق فقط، مركبتك تكون جاهزة للإقلاع.',
      step1: {
        num: '٠١',
        title: 'سجّل واشترك',
        desc: 'اختر خطتك — Starter مجاني أو Pro للأعمال الجادة. لا توجد بطاقة مطلوبة للتجربة.',
      },
      step2: {
        num: '٠٢',
        title: 'ربط المنصات',
        desc: 'اربط Meta، أو TikTok، أو Google، أو أي منصة أخرى. VEX يبدأ بتحليل أدائك فوراً.',
      },
      step3: {
        num: '٠٣',
        title: 'الوكلاء يعملون',
        desc: 'NEX يولد فيديوهات. VEX يُدير الإعلانات. PULSE يُحلل. Sentinel يُراقب. كل ذلك وأنت نائم.',
      },
    },
    clients: {
      sectionLabel: 'شهادات القادة',
      title: 'عملاء غيّروا شركاتهم',
      ahmed: { name: 'أحمد', role: 'صاحب متجر إلكتروني', result: 'زادت المبيعات ٣٠٠٪' },
      sara: { name: 'سارة', role: 'مديرة تسويق', result: 'وفّرت ٤٠ ساعة شهرياً' },
      mohamed: { name: 'محمد', role: 'مؤسس شركة ناشئة', result: '١٠ آلاف متابع جديد' },
    },
    pricing: {
      sectionLabel: 'وحدات القيادة',
      title: 'اختر قدرات مركبتك',
      subtitle: 'كل خطة تزوّد مركبتك بقدرات إضافية. ابدأ مجاناً وطوّر عند الحاجة.',
      starter: {
        name: 'Starter',
        price: '٠',
        period: 'مجاناً',
        features: ['٥ فيديوهات/شهر', '٣ حملات إعلانية', 'تحليلات أساسية', 'دعم عبر البريد الإلكتروني'],
        cta: 'ابدأ مجاناً',
      },
      pro: {
        name: 'Pro',
        price: '٩٩',
        period: 'دولار/شهر',
        features: ['فيديوهات غير محدودة', 'حملات غير محدودة', 'تحليلات متقدمة + ذكاء اصطناعي', 'دعم أولوية', 'ربط ٥ منصات', 'وصول API'],
        cta: 'اشترك الآن',
        popular: 'الأكثر شيوعاً',
      },
      enterprise: {
        name: 'Enterprise',
        price: '٢٤٩',
        period: 'دولار/شهر',
        features: ['كل مميزات Pro', 'وكلاء مخصصون', 'تحليلات فورية', 'دعم ٢٤/٧ مباشر', 'خيار On-premise', 'مدير حساب مخصص'],
        cta: 'تواصل معنا',
      },
    },
    security: {
      title: 'أمان وموثوقية على أعلى مستوى',
      encrypted: { title: 'بيانات مشفرة', desc: 'تشفير AES-256 لكل البيانات' },
      consent: { title: 'موافقة العميل', desc: 'لا يتم اتخاذ أي قرار بدون موافقتك' },
      gdpr: { title: 'GDPR جاهز', desc: 'متوافق مع جميع معايير الخصوصية' },
    },
    faq: {
      sectionLabel: 'قاعدة المعرفة',
      title: 'الأسئلة المتكررة',
      q1: { q: 'كيف يختلف NEXUS AI عن ChatGPT أو الأدوات الأخرى؟', a: 'NEXUS AI ليس أداة واحدة — بل فريق كامل من ٤ وكلاء متخصصين (NEX, VEX, PULSE, Sentinel) يعملون معاً كوحدة متكاملة. NEX للفيديو، VEX للإعلانات، PULSE للتحليلات، وSentinel للمراقبة. كل ذلك في منصة واحدة موحدة.' },
      q2: { q: 'هل أحتاج خبرة تقنية لاستخدام المنصة؟', a: 'لا على الإطلاق! NEXUS AI مصمم خصيصاً للمسوقين وأصحاب الشركات وليس للمطورين. كل شيء سحب وإفلات أو كتابة وصف بسيط بالعربية أو الإنجليزية. الـ ٤ وكلاء يفهمون العربية والإنجليزية.' },
      q3: { q: 'كيف أربط حساباتي على Meta و TikTok؟', a: 'من لوحة التحكم، اضغط "ربط منصة" واختر المنصة. سيتم توجيهك للتأكيد — وبعدها يبدأ VEX بإدارة الإعلانات مباشرة. جميع الموافقات تكون منك أولاً.' },
      q4: { q: 'هل الذكاء الاصطناعي يتخذ قرارات بدون علمي؟', a: 'أبداً! NEXUS AI يُقترح وينفذ فقط بعد موافقتك. كل حملة، كل فيديو، كل تعديل — يصلك إشعار للموافقة. أنت المتحكم دائماً.' },
      q5: { q: 'هل هناك فترة تجربة مجانية؟', a: 'نعم! خطة Starter مجانية ١٠٠٪ وتكفيك لتجربة كل المميزات الأساسية. لا توجد بطاقة ائتمان مطلوبة.' },
    },
    cta: {
      title1: 'جاهز لل',
      title2: 'الإقلاع',
      subtitle: 'انضم لآلاف القادة الذين يستخدمون NEXUS AI لتوفير الوقت، وزيادة العائد، والنمو بسرعة.',
      button: 'شغّل مركبتك الآن',
      note: 'مجاني تماماً — لا توجد بطاقة مطلوبة',
    },
    footer: {
      description: 'فريق ذكاء اصطناعي متكامل لنمو علامتك التجارية. ٤ وكلاء. هدف واحد: نجاحك.',
      agents: 'الوكلاء',
      platforms: 'المنصات',
      legal: 'القانونية',
      terms: 'شروط الخدمة',
      privacy: 'سياسة الخصوصية',
      cookies: 'سياسة الكوكيز',
      refund: 'سياسة الاسترداد',
      copyright: '© ٢٠٢٦ NEXUS AI. جميع الحقوق محفوظة. مصمم للمستقبل.',
      location: 'دبي، الإمارات العربية المتحدة',
      legalEmail: 'legal@nexus-grow.com',
      supportEmail: 'support@nexus-grow.com',
    },
    auth: {
      register: {
        title: 'إنشاء حساب جديد',
        subtitle: 'ابدأ مجاناً — لا توجد بطاقة ائتمان مطلوبة',
        nameLabel: 'الاسم الكامل',
        namePlaceholder: 'محمد أحمد',
        emailLabel: 'البريد الإلكتروني',
        passwordLabel: 'كلمة المرور',
        passwordPlaceholder: '٨ أحرف على الأقل',
        confirmLabel: 'تأكيد كلمة المرور',
        confirmPlaceholder: '••••••••',
        termsConsent: 'أوافق على',
        termsLink: 'شروط الخدمة',
        privacyLink: 'سياسة الخصوصية',
        refundLink: 'سياسة الاسترداد',
        cookieConsent: 'أوافق على استخدام الكوكيز والتقنيات المشابهة',
        cookieLink: 'الكوكيز والتقنيات المشابهة',
        submit: 'إنشاء حساب',
        loading: 'جاري إنشاء الحساب...',
        hasAccount: 'لديك حساب بالفعل؟',
        loginLink: 'سجّل دخولك',
        verifyTitle: 'تحقق من بريدك الإلكتروني',
        verifySent: 'أرسلنا رابط تأكيد إلى',
        verifyCheck: 'انقر على الرابط في البريد لتفعيل حسابك. تحقق من مجلد Spam إذا لم تجده خلال دقيقة.',
        verifyCta: 'الانتقال لتسجيل الدخول',
        errors: {
          allFields: 'جميع الحقول مطلوبة',
          passwordLength: 'يجب أن تكون كلمة المرور ٨ أحرف على الأقل',
          passwordMatch: 'كلمتا المرور غير متطابقتين',
          termsRequired: 'يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة',
          cookiesRequired: 'يجب الموافقة على استخدام الكوكيز للمتابعة',
          emailUsed: 'هذا البريد مستخدم بالفعل. جرب تسجيل الدخول.',
          generic: 'فشل إنشاء الحساب. حاول مرة أخرى.',
        },
      },
      login: {
        title: 'تسجيل الدخول',
        subtitle: 'رحّب بعودتك إلى مركبتك',
        emailLabel: 'البريد الإلكتروني',
        passwordLabel: 'كلمة المرور',
        forgotPassword: 'نسيت كلمة المرور؟',
        submit: 'تسجيل الدخول',
        loading: 'جاري تسجيل الدخول...',
        noAccount: 'ليس لديك حساب؟',
        registerLink: 'أنشئ حساباً',
      },
    },
    legal: {
      lastUpdated: 'آخر تحديث',
      termsTitle: 'شروط الخدمة',
      privacyTitle: 'سياسة الخصوصية',
      cookiesTitle: 'سياسة الكوكيز',
      refundTitle: 'سياسة الاسترداد',
      backHome: 'الرئيسية',
    },
    chat: {
      assistantName: 'مساعد NEXUS AI',
      online: 'متصل الآن',
      placeholder: 'اكتب سؤالك هنا...',
      quickReplies: {
        howToStart: 'كيف أبدأ؟',
        nexVexDiff: 'ما الفرق بين NEX و VEX؟',
        addApiKey: 'كيف أضيف مفتاح API؟',
        pricing: 'ما هي الخطط والأسعار؟',
      },
      greetings: {
        default: 'أهلاً! أنا مساعد NEXUS AI 🤖\n\nاسألني عن أي شيء — كيف تنشئ فيديو، حملة إعلانية، أو تحليلات. أو اختر سؤالاً سريعاً من الأسفل 👇',
        studio: 'أهلاً في الاستوديو! 🎬\n\nهل تحتاج مساعدة في إنشاء سكريبت فيديو؟ اكتب لي وصف المنتج وسأساعدك.',
        vex: 'أهلاً في مدير الإعلانات! 📢\n\nهل تحتاج مساعدة في حملة إعلانية أو كتابة Ad Copy؟ اسألني.',
        analytics: 'أهلاً في التحليلات! 📊\n\nهل تريد فهم أي رسم بياني أو تحتاج توصية؟ أنا تحت أمرك.',
        sentinel: 'أهلاً في Sentinel! 🛡️\n\nهل تريد معرفة كيف تراقب منافسيك أو تفهم أي تنبيه؟ اسألني.',
        settings: 'أهلاً في الإعدادات! ⚙️\n\nهل تحتاج مساعدة في مفاتيح API أو تفضيلات الحساب؟',
      },
    },
    language: {
      ar: 'العربية',
      en: 'English',
      switchTo: 'Switch to English',
    },
  },
  en: {
    nav: {
      home: 'Home',
      pricing: 'Pricing',
      faq: 'FAQ',
      dashboard: 'Dashboard',
      logout: 'Logout',
      login: 'Login',
      register: 'Sign Up',
      startNow: 'Get Started',
    },
    hero: {
      statusOnline: 'System Online',
      agentsReady: '4 Agents Ready',
      version: 'v3.0.1',
      headline1: 'AI Team',
      headline2: 'Working For You',
      subheadline: 'NEXUS AI vessel equipped with 4 specialized agents. NEX creates. VEX advertises. PULSE analyzes. Sentinel monitors.',
      tagline: 'All while you sleep. Approvals come from you. Results are real.',
      ctaPrimary: 'Launch Your Vessel',
      ctaDemo: 'Watch Demo',
      connectedNow: 'Connected:',
      comingSoon: '+3 Coming Soon',
    },
    agents: {
      sectionLabel: 'The Crew',
      title: '4 Agents. One Mission.',
      subtitle: 'Each agent specializes in their domain. They work together as one team — like the best companies, but powered by AI.',
      nex: {
        name: 'NEX',
        fullName: 'NEX — Neural Explorer',
        role: 'Video Producer',
        desc: 'Generates professional marketing videos end-to-end using the latest AI models. Writes scripts, selects voice, and assembles scenes.',
      },
      vex: {
        name: 'VEX',
        fullName: 'VEX — Virtual Executor',
        role: 'Ad Manager',
        desc: 'Creates and manages your ad campaigns on Meta, TikTok, Google, and Snapchat. Optimizes budget daily and retargets audiences automatically.',
      },
      pulse: {
        name: 'PULSE',
        fullName: 'PULSE — Predictive Learning Unit',
        role: 'Strategic Analyst',
        desc: 'Analyzes your campaign data in real-time and provides recommendations based on patterns humans can\'t easily see. Predicts trends before they happen.',
      },
      sentinel: {
        name: 'Sentinel',
        fullName: 'Sentinel — Strategic Guardian',
        role: 'Smart Guardian',
        desc: 'Monitors everything: budget, performance, competitors, and technical issues. Warns you before problems occur and suggests immediate solutions.',
      },
    },
    howItWorks: {
      sectionLabel: 'Launch Sequence',
      title: '3 Steps. And Launch.',
      subtitle: 'No complexity. No long setup. In just 3 minutes, your vessel is ready for takeoff.',
      step1: {
        num: '01',
        title: 'Sign Up',
        desc: 'Choose your plan — Starter is free or Pro for serious businesses. No card required for trial.',
      },
      step2: {
        num: '02',
        title: 'Connect Platforms',
        desc: 'Connect Meta, TikTok, Google, or any other platform. VEX starts analyzing your performance immediately.',
      },
      step3: {
        num: '03',
        title: 'Agents Work',
        desc: 'NEX generates videos. VEX manages ads. PULSE analyzes. Sentinel monitors. All while you sleep.',
      },
    },
    clients: {
      sectionLabel: 'Leader Testimonials',
      title: 'Clients Who Transformed Their Businesses',
      ahmed: { name: 'Ahmed', role: 'E-commerce Owner', result: 'Sales increased 300%' },
      sara: { name: 'Sara', role: 'Marketing Director', result: 'Saved 40 hours/month' },
      mohamed: { name: 'Mohamed', role: 'Startup Founder', result: '10K new followers' },
    },
    pricing: {
      sectionLabel: 'Command Modules',
      title: 'Choose Your Vessel\'s Capabilities',
      subtitle: 'Each plan adds more capabilities to your vessel. Start free and upgrade when needed.',
      starter: {
        name: 'Starter',
        price: '0',
        period: 'Free',
        features: ['5 videos/month', '3 ad campaigns', 'Basic analytics', 'Email support'],
        cta: 'Start Free',
      },
      pro: {
        name: 'Pro',
        price: '99',
        period: 'USD/month',
        features: ['Unlimited videos', 'Unlimited campaigns', 'Advanced analytics + AI', 'Priority support', 'Connect 5 platforms', 'API access'],
        cta: 'Subscribe Now',
        popular: 'Most Popular',
      },
      enterprise: {
        name: 'Enterprise',
        price: '249',
        period: 'USD/month',
        features: ['All Pro features', 'Dedicated agents', 'Real-time analytics', '24/7 live support', 'On-premise option', 'Dedicated account manager'],
        cta: 'Contact Us',
      },
    },
    security: {
      title: 'Security & Trust at the Highest Level',
      encrypted: { title: 'Encrypted Data', desc: 'AES-256 encryption for all data' },
      consent: { title: 'Client Consent', desc: 'No decision made without your approval' },
      gdpr: { title: 'GDPR Ready', desc: 'Compliant with all privacy standards' },
    },
    faq: {
      sectionLabel: 'Knowledge Base',
      title: 'Frequently Asked Questions',
      q1: { q: 'How is NEXUS AI different from ChatGPT or other tools?', a: 'NEXUS AI isn\'t one tool — it\'s a full team of 4 specialized agents (NEX, VEX, PULSE, Sentinel) working together as an integrated unit. NEX for video, VEX for ads, PULSE for analytics, and Sentinel for monitoring. All in one unified platform.' },
      q2: { q: 'Do I need technical expertise to use the platform?', a: 'Not at all! NEXUS AI is designed for marketers and business owners, not developers. Everything is drag-and-drop or writing a simple description in Arabic or English. All 4 agents understand both languages.' },
      q3: { q: 'How do I connect my Meta and TikTok accounts?', a: 'From the dashboard, click "Connect Platform" and choose your platform. You\'ll be redirected for confirmation — then VEX starts managing ads immediately. All approvals come from you first.' },
      q4: { q: 'Does the AI make decisions without my knowledge?', a: 'Never! NEXUS AI suggests and executes only after your approval. Every campaign, every video, every adjustment — you get a notification for approval. You are always in control.' },
      q5: { q: 'Is there a free trial period?', a: 'Yes! The Starter plan is 100% free and sufficient to try all basic features. No credit card required.' },
    },
    cta: {
      title1: 'Ready For',
      title2: 'Takeoff',
      subtitle: 'Join thousands of leaders using NEXUS AI to save time, increase returns, and grow fast.',
      button: 'Launch Your Vessel Now',
      note: 'Completely free — no card required',
    },
    footer: {
      description: 'A complete AI team to grow your brand. 4 agents. One goal: your success.',
      agents: 'Agents',
      platforms: 'Platforms',
      legal: 'Legal',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      cookies: 'Cookie Policy',
      refund: 'Refund Policy',
      copyright: '© 2026 NEXUS AI. All rights reserved. Built for the future.',
      location: 'Dubai, UAE',
      legalEmail: 'legal@nexus-grow.com',
      supportEmail: 'support@nexus-grow.com',
    },
    auth: {
      register: {
        title: 'Create New Account',
        subtitle: 'Start free — no credit card required',
        nameLabel: 'Full Name',
        namePlaceholder: 'John Doe',
        emailLabel: 'Email Address',
        passwordLabel: 'Password',
        passwordPlaceholder: 'At least 8 characters',
        confirmLabel: 'Confirm Password',
        confirmPlaceholder: '••••••••',
        termsConsent: 'I agree to the',
        termsLink: 'Terms of Service',
        privacyLink: 'Privacy Policy',
        refundLink: 'Refund Policy',
        cookieConsent: 'I agree to the use of cookies and similar technologies',
        cookieLink: 'cookies and similar technologies',
        submit: 'Create Account',
        loading: 'Creating account...',
        hasAccount: 'Already have an account?',
        loginLink: 'Sign in',
        verifyTitle: 'Check Your Email',
        verifySent: 'We sent a confirmation link to',
        verifyCheck: 'Click the link in the email to activate your account. Check your Spam folder if you don\'t see it within a minute.',
        verifyCta: 'Go to Login',
        errors: {
          allFields: 'All fields are required',
          passwordLength: 'Password must be at least 8 characters',
          passwordMatch: 'Passwords do not match',
          termsRequired: 'You must agree to Terms and Privacy Policy to continue',
          cookiesRequired: 'You must agree to cookie usage to continue',
          emailUsed: 'This email is already registered. Try logging in.',
          generic: 'Failed to create account. Please try again.',
        },
      },
      login: {
        title: 'Sign In',
        subtitle: 'Welcome back to your vessel',
        emailLabel: 'Email Address',
        passwordLabel: 'Password',
        forgotPassword: 'Forgot password?',
        submit: 'Sign In',
        loading: 'Signing in...',
        noAccount: 'Don\'t have an account?',
        registerLink: 'Create one',
      },
    },
    legal: {
      lastUpdated: 'Last updated',
      termsTitle: 'Terms of Service',
      privacyTitle: 'Privacy Policy',
      cookiesTitle: 'Cookie Policy',
      refundTitle: 'Refund Policy',
      backHome: 'Home',
    },
    chat: {
      assistantName: 'NEXUS AI Assistant',
      online: 'Online',
      placeholder: 'Type your question...',
      quickReplies: {
        howToStart: 'How do I start?',
        nexVexDiff: 'What is NEX vs VEX?',
        addApiKey: 'How do I add API key?',
        pricing: 'What are the plans?',
      },
      greetings: {
        default: 'Hello! I am NEXUS AI Assistant 🤖\n\nAsk me anything — how to create a video, ad campaign, or analytics. Or pick a quick question below 👇',
        studio: 'Welcome to the studio! 🎬\n\nNeed help creating a video script? Describe your product and I\'ll help.',
        vex: 'Welcome to the Ad Manager! 📢\n\nNeed help with an ad campaign or writing Ad Copy? Ask me.',
        analytics: 'Welcome to Analytics! 📊\n\nWant to understand any chart or need a recommendation? I\'m here.',
        sentinel: 'Welcome to Sentinel! 🛡️\n\nWant to know how to monitor competitors or understand an alert? Ask me.',
        settings: 'Welcome to Settings! ⚙️\n\nNeed help with API keys or account preferences?',
      },
    },
    language: {
      ar: 'العربية',
      en: 'English',
      switchTo: 'التحويل للعربية',
    },
  },
};
