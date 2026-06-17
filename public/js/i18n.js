var __LANG = localStorage.getItem('sout_lang') || 'ar';
var __TL = {
  ar: {
    'Français': 'Français', 'عربي': 'عربي',
    'الرئيسية': 'الرئيسية', 'Accueil': 'الرئيسية',
    'خدمات وإعلانات': 'خدمات وإعلانات', 'Services & Publicité': 'خدمات وإعلانات',
    'الأخبار': 'الأخبار', 'Actualités': 'الأخبار',
    'النشاطات': 'النشاطات', 'Activités': 'النشاطات',
    'الإعلانات': 'الإعلانات', 'Annonces': 'الإعلانات',
    'الأرشفة الزمنية': 'الأرشفة الزمنية', 'Chronologie': 'الأرشفة الزمنية',
    'الأرشيف': 'الأرشيف', 'Archives': 'الأرشيف',
    'المكتبة': 'المكتبة', 'Média': 'المكتبة',
    'اشتراك': 'اشتراك', "S'abonner": 'اشتراك',
    'الأحكام والشروط': 'الأحكام والشروط', 'Termes et Conditions': 'الأحكام والشروط',
    'سياسة الخصوصية': 'سياسة الخصوصية', 'Confidentialité': 'سياسة الخصوصية',
    'الإشهار': 'الإشهار', 'Publicité': 'الإشهار',
    'اتصل بنا': 'اتصل بنا', 'Contactez-nous': 'اتصل بنا',
    'من نحن': 'من نحن', 'Qui sommes-nous': 'من نحن',
    'تابعونا على :': 'تابعونا على :', 'Suivez-nous :': 'تابعونا على :',
    'فيسبوك': 'فيسبوك', 'Facebook': 'فيسبوك',
    'تويتر': 'تويتر', 'Twitter': 'تويتر',
    'يوتيوب': 'يوتيوب', 'YouTube': 'يوتيوب',
    'تلغرام': 'تلغرام', 'Telegram': 'تلغرام',
    'إنستغرام': 'إنستغرام', 'Instagram': 'إنستغرام',
    'نشرية جزائرية مستقلة - صدرت عام 2026': 'نشرية جزائرية مستقلة - صدرت عام 2026',
    'Publication algérienne indépendante - Fondée en 2026': 'نشرية جزائرية مستقلة - صدرت عام 2026',
    'البريد الإلكتروني': 'البريد الإلكتروني', 'Email': 'البريد الإلكتروني',
    'بإشتراكك معنا ستتمكن من الحصول على آخر الأخبار التي سيتم نشرها في الموقع': 'بإشتراكك معنا ستتمكن من الحصول على آخر الأخبار التي سيتم نشرها في الموقع',
    'Abonnez-vous pour recevoir les dernières actualités': 'بإشتراكك معنا ستتمكن من الحصول على آخر الأخبار التي سيتم نشرها في الموقع',
    'جميع الحقوق محفوظة © 2026 الصوت المحلي': 'جميع الحقوق محفوظة © 2026 الصوت المحلي',
    'Tous droits réservés © 2026 صوت المحلي': 'جميع الحقوق محفوظة © 2026 الصوت المحلي',
    'تصميم وتطوير Zoheir IT Solutions - Ain kermes/Tiaret': 'تصميم وتطوير Zoheir IT Solutions - Ain kermes/Tiaret',
    'Conçu par Zoheir IT Solutions - Ain kermes/Tiaret': 'تصميم وتطوير Zoheir IT Solutions - Ain kermes/Tiaret',
    'مساحة إشهارية': 'مساحة إشهارية', 'Espace publicitaire': 'مساحة إشهارية',
    'بحث': 'بحث', 'Rechercher': 'بحث',
    'بحث في الأخبار...': 'بحث في الأخبار...', 'Rechercher dans les actualités...': 'بحث في الأخبار...',
    'العودة': 'العودة', 'Retour': 'العودة',
    'إرسال': 'إرسال', 'Envoyer': 'إرسال',
    'الاسم الكامل': 'الاسم الكامل', 'Nom complet': 'الاسم الكامل',
    'رسالتك...': 'رسالتك...', 'Votre message...': 'رسالتك...',
    'حالة الطقس': 'حالة الطقس', 'Météo': 'حالة الطقس',
    'أرشيف': 'أرشيف', 'Archive': 'أرشيف',
    'نظام النشرية الذكي AI': 'نظام النشرية الذكي AI', "Système IA d'actualités": 'نظام النشرية الذكي AI',
    'مكتبة الصور': 'مكتبة الصور', 'Galerie': 'مكتبة الصور',
    'الصوت': 'الصوت', 'Sout': 'الصوت',
    'المحلي': 'المحلي', 'Mahalli': 'المحلي'
  },
  fr: {
    'Français': 'عربي', 'عربي': 'Français',
    'الرئيسية': 'Accueil', 'Accueil': 'Accueil',
    'خدمات وإعلانات': 'Services & Publicité', 'Services & Publicité': 'Services & Publicité',
    'الأخبار': 'Actualités', 'Actualités': 'Actualités',
    'النشاطات': 'Activités', 'Activités': 'Activités',
    'الإعلانات': 'Annonces', 'Annonces': 'Annonces',
    'الأرشفة الزمنية': 'Chronologie', 'Chronologie': 'Chronologie',
    'الأرشيف': 'Archives', 'Archives': 'Archives',
    'المكتبة': 'Média', 'Média': 'Média',
    'اشتراك': "S'abonner", "S'abonner": "S'abonner",
    'الأحكام والشروط': 'Termes et Conditions', 'Termes et Conditions': 'Termes et Conditions',
    'سياسة الخصوصية': 'Confidentialité', 'Confidentialité': 'Confidentialité',
    'الإشهار': 'Publicité', 'Publicité': 'Publicité',
    'اتصل بنا': 'Contactez-nous', 'Contactez-nous': 'Contactez-nous',
    'من نحن': 'Qui sommes-nous', 'Qui sommes-nous': 'Qui sommes-nous',
    'تابعونا على :': 'Suivez-nous :', 'Suivez-nous :': 'Suivez-nous :',
    'فيسبوك': 'Facebook', 'Facebook': 'Facebook',
    'تويتر': 'Twitter', 'Twitter': 'Twitter',
    'يوتيوب': 'YouTube', 'YouTube': 'YouTube',
    'تلغرام': 'Telegram', 'Telegram': 'Telegram',
    'إنستغرام': 'Instagram', 'Instagram': 'Instagram',
    'نشرية جزائرية مستقلة - صدرت عام 2026': 'Publication algérienne indépendante - Fondée en 2026',
    'Publication algérienne indépendante - Fondée en 2026': 'Publication algérienne indépendante - Fondée en 2026',
    'البريد الإلكتروني': 'Email', 'Email': 'Email',
    'بإشتراكك معنا ستتمكن من الحصول على آخر الأخبار التي سيتم نشرها في الموقع': 'Abonnez-vous pour recevoir les dernières actualités',
    'Abonnez-vous pour recevoir les dernières actualités': 'Abonnez-vous pour recevoir les dernières actualités',
    'جميع الحقوق محفوظة © 2026 الصوت المحلي': 'Tous droits réservés © 2026 صوت المحلي',
    'Tous droits réservés © 2026 صوت المحلي': 'Tous droits réservés © 2026 صوت المحلي',
    'تصميم وتطوير Zoheir IT Solutions - Ain kermes/Tiaret': 'Conçu par Zoheir IT Solutions - Ain kermes/Tiaret',
    'Conçu par Zoheir IT Solutions - Ain kermes/Tiaret': 'Conçu par Zoheir IT Solutions - Ain kermes/Tiaret',
    'مساحة إشهارية': 'Espace publicitaire', 'Espace publicitaire': 'Espace publicitaire',
    'بحث': 'Rechercher', 'Rechercher': 'Rechercher',
    'بحث في الأخبار...': 'Rechercher dans les actualités...', 'Rechercher dans les actualités...': 'Rechercher dans les actualités...',
    'العودة': 'Retour', 'Retour': 'Retour',
    'إرسال': 'Envoyer', 'Envoyer': 'Envoyer',
    'الاسم الكامل': 'Nom complet', 'Nom complet': 'Nom complet',
    'رسالتك...': 'Votre message...', 'Votre message...': 'Votre message...',
    'حالة الطقس': 'Météo', 'Météo': 'Météo',
    'مكتبة الصور': 'Galerie', 'Galerie': 'Galerie',
    'الصوت': 'Sout', 'Sout': 'Sout',
    'المحلي': 'Mahalli', 'Mahalli': 'Mahalli',
    'الموافق ل': 'du', 'du': 'du'
  }
};

function stripEmoji(s) {
  return s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
}

function applyLang(lang) {
  __LANG = lang;
  var dict = __TL[lang];
  var dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.lang = lang === 'ar' ? 'ar' : 'fr';
  document.documentElement.dir = dir;
  document.body.style.direction = dir;
  document.body.style.textAlign = dir === 'rtl' ? 'right' : 'left';

  var walker = document.createTreeWalker(document.body, 4, null, false);
  var nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var p = n.parentNode;
    if (!p || /^script$/i.test(p.tagName) || /^style$/i.test(p.tagName) || /^svg$/i.test(p.tagName) || /^path$/i.test(p.tagName) || /^select$/i.test(p.tagName) || /^option$/i.test(p.tagName)) continue;
    var raw = n.textContent;
    var txt = stripEmoji(raw);
    if (!txt) continue;
    var translated = dict[txt] || dict[raw.trim()];
    if (translated && translated !== txt) {
      n.textContent = raw.replace(txt, translated);
    }
  }

  document.getElementById('lang-btn').textContent = lang === 'ar' ? 'Français' : 'عربي';
  localStorage.setItem('sout_lang', lang);
}

function toggleLangUI() {
  applyLang(__LANG === 'ar' ? 'fr' : 'ar');
}

(function(){
  if (__LANG === 'fr') applyLang('fr');
})();
