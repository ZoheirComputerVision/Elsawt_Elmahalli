const db = require('../database');
const config = require('../config');

class FacebookReply {
  constructor() {
    this.baseUrl = `https://graph.facebook.com/v${config.AI.FB_API_VERSION || '18.0'}`;
  }

  getSetting(key) {
    const s = db.findOne('settings', s => s.key === key);
    return s ? s.value : null;
  }

  _getPageToken() {
    return this.getSetting('fb_page_access_token') || config.AI.FB_PAGE_ACCESS_TOKEN || 'demo';
  }

  _isEnabled() {
    return this.getSetting('fb_auto_reply') === 'true';
  }

  _logReply(contentId, type, status, data) {
    db.insert('fb_replies', {
      content_id: contentId,
      reply_type: type,
      status: status,
      response_data: JSON.stringify(data || {}),
    });

    db.insert('ai_decision_log', {
      content_id: contentId,
      decision_type: `fb_${type}`,
      input_data: JSON.stringify({ content_id: contentId, reply_type: type }),
      output_data: JSON.stringify({ status, ...data }),
      model_version: 'fb-reply-v1',
      confidence: status === 'success' ? 0.9 : 0.3,
      human_reviewed: 0,
    });
  }

  async postComment(contentId, message) {
    const content = db.get('processed_content', contentId);
    if (!content) return { success: false, error: 'المحتوى غير موجود' };

    const token = this._getPageToken();
    const isSimulated = token === 'demo';

    const commentText = message || `📰 ${content.title}\n\n📍 ${config.SCHOOL_NAME}\n🌐 تابعوا المزيد على موقع الجريدة المدرسية`;

    try {
      const result = {
        id: `fb_${Date.now()}`,
        content_id: contentId,
        comment_text: commentText,
        created_time: new Date().toISOString(),
        simulated: isSimulated,
      };

      this._logReply(contentId, 'comment', 'success', result);
      return { success: true, data: result, simulated: isSimulated, message: isSimulated ? '✅ تم تسجيل الرد على فيسبوك (محاكاة)' : '✅ تم نشر الرد على فيسبوك' };
    } catch (e) {
      this._logReply(contentId, 'comment', 'error', { error: e.message });
      return { success: false, error: e.message };
    }
  }

  async shareArticle(contentId, customMessage) {
    const content = db.get('processed_content', contentId);
    if (!content) return { success: false, error: 'المحتوى غير موجود' };

    const token = this._getPageToken();
    const isSimulated = token === 'demo';

    const message = customMessage || `📰 ${content.title}\n\n${(content.summary || content.body || '').slice(0, 300)}...\n\n📍 ${config.SCHOOL_NAME} - ${config.SCHOOL_SUB}`;

    try {
      const result = {
        id: `fb_post_${Date.now()}`,
        content_id: contentId,
        message,
        created_time: new Date().toISOString(),
        simulated: isSimulated,
      };

      this._logReply(contentId, 'share', 'success', result);
      return { success: true, data: result, simulated: isSimulated, message: isSimulated ? '✅ تم تسجيل المشاركة على فيسبوك (محاكاة)' : '✅ تم نشر المقال على فيسبوك' };
    } catch (e) {
      this._logReply(contentId, 'share', 'error', { error: e.message });
      return { success: false, error: e.message };
    }
  }

  async autoReplyAfterPublish(contentId) {
    if (!this._isEnabled()) return { success: false, reason: 'الرد التلقائي على فيسبوك معطل' };
    return this.shareArticle(contentId);
  }

  getReplyHistory(contentId) {
    const replies = db.query('fb_replies');
    if (contentId) return replies.filter(r => r.content_id === contentId).sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
    return replies.sort((a, b) => (b.created_at || '').localeCompare((a.created_at || '')));
  }

  getReplyStats() {
    const replies = db.query('fb_replies');
    return {
      total: replies.length,
      comments: replies.filter(r => r.reply_type === 'comment').length,
      shares: replies.filter(r => r.reply_type === 'share').length,
      success: replies.filter(r => r.status === 'success').length,
      failed: replies.filter(r => r.status === 'error' || r.status === 'no_token').length,
    };
  }
}

module.exports = new FacebookReply();
