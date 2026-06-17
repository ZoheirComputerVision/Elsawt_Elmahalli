const db = require('../database');

const MAX_PUBLISH_PER_DAY = 15;

class PublishingEngine {
  getSetting(key) {
    const s = db.findOne('settings', s => s.key === key);
    return s ? s.value : 'false';
  }

  _getDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = this.getSetting('publish_date');
    if (savedDate !== today) return 0;
    return parseInt(this.getSetting('total_published_today') || '0');
  }

  _checkDailyQuota() {
    const count = this._getDailyCount();
    if (count >= MAX_PUBLISH_PER_DAY) {
      return { allowed: false, reason: `تجاوز الحد اليومي للنشر (${MAX_PUBLISH_PER_DAY})` };
    }
    return { allowed: true };
  }

  _contentQualityCheck(content) {
    const checks = [];

    // فحص العنوان
    if (!content.title || content.title.length < 5) checks.push('عنوان قصير جدًا');
    if (content.title && content.title.length > 200) checks.push('عنوان طويل جدًا');

    // فحص المحتوى
    if (!content.body || content.body.length < 30) checks.push('محتوى قصير جدًا');
    if (content.body && content.body.length > 10000) checks.push('محتوى طويل جدًا');

    // فحص المصادر
    if (!content.source_name || content.source_name === 'غير معروف') checks.push('مصدر غير معروف');

    // فحص النص المكرر (أكثر من 80% تشابه مع منشور)
    const existing = db.query('processed_content', c =>
      c.status === 'published' && c.id !== content.id
    );
    for (const item of existing) {
      const sim = this._simpleSimilarity(
        (content.body || '').slice(0, 100),
        (item.body || '').slice(0, 100)
      );
      if (sim > 0.8) {
        checks.push(`تشابه قوي (${Math.round(sim * 100)}%) مع منشور #${item.id}`);
        break;
      }
    }

    return {
      passed: checks.length === 0,
      issues: checks,
      score: Math.max(0, 1 - (checks.length * 0.15)),
    };
  }

  _simpleSimilarity(a, b) {
    if (!a || !b) return 0;
    const bigrams = (s) => {
      const set = new Set();
      for (let i = 0; i < s.length - 1; i++) set.add(s.substring(i, i + 2));
      return set;
    };
    const ba = bigrams(a);
    const bb = bigrams(b);
    if (ba.size === 0 || bb.size === 0) return 0;
    const intersection = new Set([...ba].filter(x => bb.has(x)));
    return intersection.size / Math.max(ba.size, bb.size);
  }

  canAutoPublish(content) {
    // 1. إيقاف الطوارئ
    if (this.getSetting('stop_auto_publish') === 'true') {
      return { allowed: false, reason: '🔴 إيقاف الطوارئ مفعل', level: 'critical' };
    }

    // 2. مراجعة بشرية إلزامية
    if (this.getSetting('require_human_review') === 'true') {
      return { allowed: false, reason: 'المراجعة البشرية إلزامية', level: 'warning' };
    }

    // 3. محتوى غير مصنف
    if (content.category === 'uncategorized') {
      return { allowed: false, reason: 'محتوى غير مصنف - يتطلب مراجعة', level: 'warning' };
    }

    // 4. محتوى منخفض الأهمية
    if (content.importance === 'low') {
      return { allowed: false, reason: 'محتوى منخفض الأهمية', level: 'info' };
    }

    // 5. الحصة اليومية
    const quota = this._checkDailyQuota();
    if (!quota.allowed) {
      return { allowed: false, reason: quota.reason, level: 'warning' };
    }

    // 6. نقاط الثقة
    if (content.overall_score >= 0.8 && content.fact_check_score >= 0.7) {
      return { allowed: true, reason: `✓ ثقة عالية (${Math.round(content.overall_score * 100)}%)`, level: 'success' };
    }

    if (content.overall_score >= 0.65 && content.source_trust >= 0.85) {
      return { allowed: true, reason: `✓ مصدر موثوق + ثقة متوسطة`, level: 'success' };
    }

    return { allowed: false, reason: `نقاط الثقة ${Math.round(content.overall_score * 100)}% - دون العتبة`, level: 'info' };
  }

  async publish(contentId) {
    const content = db.get('processed_content', contentId);
    if (!content) return { success: false, error: 'المحتوى غير موجود' };
    if (content.status === 'published') return { success: false, error: 'منشور مسبقًا', duplicate: true };

    // فحص الجودة
    const qualityCheck = this._contentQualityCheck(content);
    if (!qualityCheck.passed) {
      db.update('processed_content', contentId, { status: 'review' });
      this.logDecision(contentId, 'quality_check_failed', qualityCheck);
      return { success: false, method: 'quality_blocked', reason: qualityCheck.issues.join('، '), message: 'فحص الجودة: لم يجتز' };
    }

    const check = this.canAutoPublish(content);

    if (check.allowed) {
      db.update('processed_content', contentId, {
        status: 'published',
        published_at: new Date().toISOString(),
        visibility_status: 'active',
      });
      db.saveNow('processed_content');
      this._updateDailyCount();
      this.logDecision(contentId, 'auto_publish', check);
      this._archive(contentId, 'auto_published');
      return { success: true, method: 'auto', message: 'نشر تلقائي ✓' };
    }

    // إحالة للمراجعة مع تحديد المستوى
    const reviewPriority = check.level === 'critical' ? 'urgent' : check.level === 'warning' ? 'normal' : 'low';
    db.update('processed_content', contentId, {
      status: 'review',
      review_priority: reviewPriority,
    });
    this.logDecision(contentId, 'pending_review', { ...check, reviewPriority });
    return { success: false, method: 'pending', reason: check.reason, message: `أحيل للمراجعة (${reviewPriority})` };
  }

  async approveManual(contentId, reviewer = 'admin') {
    const content = db.get('processed_content', contentId);
    if (!content) return { success: false, error: 'غير موجود' };

    const qualityCheck = this._contentQualityCheck(content);
    if (!qualityCheck.passed) {
      return { success: false, error: 'المحتوى لا يجتاز فحص الجودة', issues: qualityCheck.issues };
    }

    db.update('processed_content', contentId, {
      status: 'published',
      published_at: new Date().toISOString(),
      visibility_status: 'active',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
    });

    db.saveNow('processed_content');
    this._updateDailyCount();
    this.logDecision(contentId, 'manual_approve', { reviewer });
    this._archive(contentId, 'manual_approved');
    return { success: true, method: 'manual', message: 'تم النشر بعد المراجعة البشرية ✓' };
  }

  async reject(contentId, reason = 'مرفوض من المشرف', reviewer = 'admin') {
    db.update('processed_content', contentId, {
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewer,
      rejection_reason: reason,
    });
    db.saveNow('processed_content');
    this.logDecision(contentId, 'rejected', { reason, reviewer });
    this._archive(contentId, 'rejected');
    return { success: true, message: 'تم الرفض والأرشفة' };
  }

  _archive(contentId, reason) {
    const content = db.get('processed_content', contentId);
    if (!content) return;
    const existing = db.findOne('archive', a => a.content_id === contentId);
    if (!existing) {
      db.insert('archive', {
        content_id: contentId,
        original_data: JSON.stringify(content),
        archive_reason: reason,
        decisions_log: JSON.stringify({ archived_at: new Date().toISOString(), by: 'publisher-v2' }),
      });
    }
  }

  _updateDailyCount() {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = this.getSetting('publish_date');
    if (savedDate !== today) {
      db.upsert('settings', { key: 'publish_date', value: today, updated_at: new Date().toISOString() }, s => s.key === 'publish_date');
      db.upsert('settings', { key: 'total_published_today', value: '1', updated_at: new Date().toISOString() }, s => s.key === 'total_published_today');
    } else {
      const current = parseInt(this.getSetting('total_published_today') || '0');
      db.upsert('settings', { key: 'total_published_today', value: String(current + 1), updated_at: new Date().toISOString() }, s => s.key === 'total_published_today');
    }
  }

  logDecision(contentId, type, data) {
    db.insert('ai_decision_log', {
      content_id: contentId,
      decision_type: type,
      input_data: JSON.stringify(data || {}),
      output_data: JSON.stringify({ timestamp: new Date().toISOString(), publisher: 'v2' }),
      model_version: 'publisher-v2',
      confidence: type.includes('approve') || type === 'auto_publish' ? 0.95 : 1.0,
      human_reviewed: type === 'manual_approve' || type === 'rejected' ? 1 : 0,
    });
  }
}

module.exports = new PublishingEngine();
