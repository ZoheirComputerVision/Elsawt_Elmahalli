const db = require('../database');

const FOOTER_AI = '\n\n—\n🖋 تم إنتاج هذا المحتوى بمساعدة تقنيات الذكاء الاصطناعي. يخضع هذا المحتوى للمراجعة الآلية والبشرية قبل وبعد النشر.';
const FOOTER_OFFICIAL = '\n\n—\n📝 محتوى رسمي معتمد من مصادر رسمية.';
const COPYRIGHT = `\n© ${new Date().getFullYear()} الصوت المحلي - نشرية جهوية للإعلام العام. جميع الحقوق محفوظة.`;

class NewsWriter {
  _buildLead(data) {
    const date = data.event_date ? `في ${data.event_date}، ` : '';
    const source = data.source_name ? `حسب ما ورد عن ${data.source_name}، ` : '';
    const school = 'بولاية تيارت';

    if (data.category === 'news') return `${date}${source}علمت نشرية الصوت المحلي أن ${school} ${data.body.slice(0, 60)}...`;
    if (data.category === 'announcement') return `${source}صدر الإعلان التالي:`;
    return `${date}في إطار النشاطات الجهوية، ${school} `;
  }

  generateArticle(content) {
    const templates = {
      news: this.newsTemplate.bind(this),
      activity: this.activityTemplate.bind(this),
      announcement: this.announcementTemplate.bind(this),
    };
    const generator = templates[content.category] || this.newsTemplate.bind(this);
    return generator(content);
  }

  newsTemplate(data) {
    const title = `📰 ${data.title}`;
    const meta = `🗓 ${data.event_date || 'تاريخ غير محدد'} | 📡 المصدر: ${data.source_name || 'غير محدد'}`;

    // بناء الخبر وفق هرم مقلوب (الأهم فالمهم)
    const body = data.body || '';
    const sentences = body.split(/[.\n]/).filter(s => s.trim());
    const lead = sentences.slice(0, 2).join('. ') + '.';
    const details = sentences.slice(2).join('. ');

    return `${title}

${meta}

${lead}

${details ? `تفاصيل إضافية:\n${details}` : ''}

يُشار إلى أن هذه المعلومات وردت من المصادر المتاحة وتمت معالجتها آليًا لنشرها في نشرية الصوت المحلي.${FOOTER_AI}${COPYRIGHT}`;
  }

  activityTemplate(data) {
    const title = `📸 نشاط تربوي: ${data.title}`;
    const meta = `📆 ${data.event_date || 'تاريخ غير محدد'}`;

    return `${title}

${meta}

في إطار النشاطات الجهوية والبرامج المسطرة من طرف مصالح ولاية تيارت، وتجسيدًا للبرنامج المسطر، ${data.body || ''}

تهدف هذه النشاطات إلى تنشيط الحركة الثقافية والاجتماعية والاقتصادية بالمنطقة، وتعزيز التنمية المحلية وخدمة مواطني الولاية.${FOOTER_AI}${COPYRIGHT}`;
  }

  announcementTemplate(data) {
    const title = `📢 إعلان رسمي | ${data.title}`;
    const meta = `📅 ${data.event_date || 'تاريخ غير محدد'}`;

    return `${title}

${meta}

المصدر: ${data.source_name || 'مصدر رسمي'}

${data.body || ''}

🔹 على جميع المعنيين التقيد بالشروط والآجال المحددة.
🔹 للمزيد من المعلومات، يرجى التوجه إلى المصدر المختص أو الاتصال به خلال أوقات العمل الرسمية.${FOOTER_OFFICIAL}${COPYRIGHT}`;
  }

  async generateForContent(contentId) {
    const content = db.get('processed_content', contentId);
    if (!content) return null;

    const article = this.generateArticle({
      title: content.title,
      body: content.body,
      category: content.category,
      event_date: content.event_date,
      source_name: content.source_name,
    });

    db.update('processed_content', contentId, {
      body: article,
      writer_version: 'writer-v2',
      is_ai_generated: 1,
    });

    db.insert('ai_decision_log', {
      content_id: contentId,
      decision_type: 'content_generation',
      input_data: JSON.stringify({ title: content.title, category: content.category, length: content.body?.length }),
      output_data: JSON.stringify({ article_length: article.length, paragraphs: article.split('\n\n').length }),
      model_version: 'writer-v2',
      confidence: 0.92,
      human_reviewed: 0,
    });

    return article;
  }
}

module.exports = new NewsWriter();
