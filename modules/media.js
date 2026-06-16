const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../database');
const audit = require('./audit');

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const UPLOADS_DIR = path.join(config.PUBLIC_DIR, 'uploads');

class MediaService {

  upload(file, metadata = {}) {
    if (!file) throw new Error('الملف مطلوب');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new Error(`نوع الملف غير مدعوم: ${file.mimetype}`);
    }
    const urlPath = `/uploads/${file.filename}`;
    const record = db.insert('media', {
      filename: file.originalname,
      path: urlPath,
      mime_type: file.mimetype,
      size: file.size,
      alt_text: metadata.alt_text || '',
      caption: metadata.caption || '',
      category: metadata.category || '',
      uploader: metadata.uploader || 'system',
      uploaded_at: new Date().toISOString(),
      usage_count: 0,
      used_in: [],
    });
    audit.log(metadata.uploader || 'system', 'media.upload', 'media', record.id, {
      filename: file.originalname,
      path: urlPath,
      mime_type: file.mimetype,
      size: file.size,
    });
    return record;
  }

  getById(id) {
    return db.get('media', id);
  }

  query(filters = {}) {
    let items = db.query('media');
    if (filters.category) {
      items = items.filter(i => i.category === filters.category);
    }
    if (filters.uploader) {
      items = items.filter(i => i.uploader === filters.uploader);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i =>
        (i.alt_text || '').toLowerCase().includes(q) ||
        (i.caption || '').toLowerCase().includes(q) ||
        (i.filename || '').toLowerCase().includes(q)
      );
    }
    if (filters.date_from) {
      items = items.filter(i => i.uploaded_at >= filters.date_from);
    }
    if (filters.date_to) {
      items = items.filter(i => i.uploaded_at <= filters.date_to);
    }
    if (filters.mime_type) {
      items = items.filter(i => i.mime_type === filters.mime_type);
    }
    items.sort((a, b) => (b.uploaded_at || '').localeCompare((a.uploaded_at || '')));
    const total = items.length;
    const limit = parseInt(filters.limit) || 20;
    const offset = parseInt(filters.offset) || 0;
    const paginated = items.slice(offset, offset + limit);
    return { items: paginated, total, limit, offset };
  }

  updateMetadata(id, updates) {
    const allowed = ['alt_text', 'caption', 'category'];
    const sanitized = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) sanitized[key] = updates[key];
    }
    if (Object.keys(sanitized).length === 0) {
      throw new Error('لا توجد حقول قابلة للتعديل');
    }
    const updated = db.update('media', id, sanitized);
    if (!updated) throw new Error('الوسيط غير موجود');
    audit.log(updates.uploader || 'system', 'media.update', 'media', id, sanitized);
    return updated;
  }

  addUsage(id, contentId, type) {
    const media = db.get('media', id);
    if (!media) throw new Error('الوسيط غير موجود');
    if (!media.used_in) media.used_in = [];
    const exists = media.used_in.some(u => u.content_id === contentId && u.type === type);
    if (!exists) {
      media.used_in.push({ content_id: contentId, type });
      media.usage_count = media.used_in.length;
      db.saveNow('media');
    }
    return media;
  }

  removeUsage(id, contentId, type) {
    const media = db.get('media', id);
    if (!media) throw new Error('الوسيط غير موجود');
    if (media.used_in) {
      media.used_in = media.used_in.filter(u => !(u.content_id === contentId && u.type === type));
      media.usage_count = Math.max(0, media.used_in.length);
      db.saveNow('media');
    }
    return media;
  }

  delete(id) {
    const media = db.get('media', id);
    if (!media) return { success: false, error: 'الوسيط غير موجود' };
    if (media.usage_count > 0) {
      return {
        success: false,
        error: 'لا يمكن حذف وسيط مستخدم في محتوى آخر',
        usage_count: media.usage_count,
        used_in: media.used_in,
      };
    }
    const filename = path.basename(media.path);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    db.delete('media', id);
    audit.log('system', 'media.delete', 'media', id, {
      filename: media.filename,
      path: media.path,
    });
    return { success: true, message: 'تم حذف الوسيط بنجاح' };
  }
}

module.exports = new MediaService();
