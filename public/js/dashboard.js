let currentArticleId = null;

function _authHeaders() {
  return { 'x-admin-auth': localStorage.getItem('admin_token') || '' };
}

async function _fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { ..._authHeaders(), 'Content-Type': 'application/json', ...opts.headers },
  });
  if (!res.ok) {
    let msg = `خطأ ${res.status}`;
    try { const err = await res.json(); msg = err.error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── Load category fallback SVG + populate library category select ──

async function loadCategoryFallback() {
  try {
    const cats = await _fetchJSON('/api/local-categories');
    window._categoryMeta = {};
    for (const c of cats) window._categoryMeta[c.name] = c;
    // Populate library category select
    const libCat = document.getElementById('library-category');
    if (libCat) {
      libCat.innerHTML = '<option value="">جميع التصنيفات</option>' +
        cats.map(c => `<option value="${_escapeHtml(c.name)}">${_escapeHtml(c.name)}</option>`).join('');
    }
  } catch {}
}

function getCategoryFallback(category) {
  const meta = window._categoryMeta?.[category];
  const icon = meta?.icon || 'fa-newspaper';
  const color = {
    'fa-newspaper': '#1a3a5c',
    'fa-building': '#065f46',
    'fa-users': '#1e40af',
    'fa-calendar-alt': '#92400e',
    'fa-landmark': '#7c3aed',
    'fa-trophy': '#b45309',
    'fa-bullhorn': '#991b1b',
    'fa-star': '#ca8a04',
    'fa-camera': '#4f46e5',
    'fa-archive': '#6b7280',
  }[icon] || '#1a3a5c';
  return `<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;border-radius:8px;background:#f0f2f5;">
    <rect width="200" height="140" fill="#f0f2f5"/>
    <text x="100" y="70" text-anchor="middle" dominant-baseline="central" font-size="40" fill="${color}" opacity="0.4">${icon.replace('fa-', '').replace(/-/g, ' ').toUpperCase()}</text>
    <text x="100" y="115" text-anchor="middle" font-size="11" fill="${color}" opacity="0.5">${category || ''}</text>
  </svg>`;
}

// ── Open image panel in edit modal ──

function openImagePanel(articleId, currentImageData) {
  currentArticleId = articleId;
  const panel = document.getElementById('article-image-panel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.dataset.articleId = articleId;

  const preview = document.getElementById('article-image-preview');
  const actions = document.getElementById('article-image-actions');
  const noImage = document.getElementById('article-image-none');

  if (currentImageData && currentImageData !== 'null' && currentImageData !== '') {
    preview.innerHTML = `<img src="${_escapeHtml(currentImageData)}" alt="صورة المقال" onerror="this.parentElement.innerHTML=getCategoryFallback(document.getElementById('edit-category')?.value||'')">`;
    preview.style.display = 'block';
    noImage.style.display = 'none';
    actions.innerHTML = `
      <button type="button" class="btn btn-sm btn-accent" onclick="selectLibraryImage(${articleId})"><i class="fas fa-images"></i> استبدال من المكتبة</button>
      <button type="button" class="btn btn-sm btn-danger" onclick="removeArticleImage(${articleId})"><i class="fas fa-times"></i> إزالة</button>
    `;
  } else {
    preview.innerHTML = getCategoryFallback(document.getElementById('edit-category')?.value || '');
    preview.style.display = 'block';
    noImage.style.display = 'block';
    actions.innerHTML = `
      <button type="button" class="btn btn-sm btn-primary" onclick="uploadArticleImage(${articleId})"><i class="fas fa-upload"></i> رفع صورة</button>
      <button type="button" class="btn btn-sm btn-accent" onclick="selectLibraryImage(${articleId})"><i class="fas fa-images"></i> اختيار من المكتبة</button>
    `;
  }
}

function closeImagePanel() {
  const panel = document.getElementById('article-image-panel');
  if (panel) panel.style.display = 'none';
  currentArticleId = null;
}

// ── Upload image for article ──

function uploadArticleImage(articleId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('⚠️ حجم الملف كبير جداً. الحد الأقصى 10 ميغابايت');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', document.getElementById('edit-category')?.value || '');
      const uploadRes = await fetch('/api/admin/media/upload', {
        method: 'POST',
        headers: _authHeaders(),
        body: formData,
      });
      if (!uploadRes.ok) {
        let msg = 'فشل الرفع';
        try { const e = await uploadRes.json(); msg = e.error || msg; } catch {}
        throw new Error(msg);
      }
      const media = await uploadRes.json();
      const res = await API.admin.setArticleImage(articleId, media.id);
      if (res.success) openImagePanel(articleId, res.image_data);
      showActionMsg('✅ تم ربط الصورة بالمقال', 'success');
    } catch (e) {
      showActionMsg('⚠️ ' + e.message, 'danger');
    }
  };
  input.click();
}

// ── Select from Media Library ──

async function selectLibraryImage(articleId) {
  const overlay = document.getElementById('library-modal');
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.dataset.articleId = articleId;
  overlay.dataset.mode = 'select';
  loadLibraryGrid(1);
}

async function loadLibraryGrid(page) {
  const grid = document.getElementById('library-grid');
  if (!grid) return;
  const limit = 12;
  const offset = (page - 1) * limit;
  const search = document.getElementById('library-search')?.value || '';
  const category = document.getElementById('library-category')?.value || '';
  try {
    const params = new URLSearchParams({ limit, offset });
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    const res = await _fetchJSON(`/api/admin/media?${params.toString()}`);
    const items = res.items || [];
    if (items.length === 0) {
      grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);">لا توجد وسائط</div>';
    } else {
      grid.innerHTML = items.map(item => `
        <div class="library-item" onclick="selectLibraryItem(${item.id}, '${_escapeHtml(item.path)}')">
          <img src="${_escapeHtml(item.path)}" alt="${_escapeHtml(item.alt_text || '')}" loading="lazy" onerror="this.style.display='none'">
          <div class="library-item-info">
            <div class="library-item-name">${_escapeHtml(item.originalname || item.filename)}</div>
            <div class="library-item-meta">${_escapeHtml(item.category || '—')} · ${formatFileSize(item.size)}</div>
          </div>
        </div>
      `).join('');
    }
    renderLibraryPagination(page, Math.ceil((res.total || 0) / limit));
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-danger">${_escapeHtml(e.message)}</div>`;
  }
}

function renderLibraryPagination(current, total) {
  const el = document.getElementById('library-pagination');
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = '<div style="display:flex;gap:4px;justify-content:center;margin-top:10px;">';
  for (let i = 1; i <= total; i++) {
    html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : ''}" onclick="loadLibraryGrid(${i})">${i}</button>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

async function selectLibraryItem(mediaId, path) {
  const overlay = document.getElementById('library-modal');
  const articleId = parseInt(overlay?.dataset?.articleId);
  if (!articleId) return;
  try {
    const res = await API.admin.setArticleImage(articleId, mediaId);
    if (res.success) {
      openImagePanel(articleId, res.image_data);
      showActionMsg('✅ تم اختيار الصورة', 'success');
    }
    overlay.classList.remove('active');
  } catch (e) {
    showActionMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Remove image from article ──

async function removeArticleImage(articleId) {
  if (!confirm('هل أنت متأكد من إزالة الصورة من هذا المقال؟')) return;
  try {
    const res = await API.admin.removeArticleImage(articleId);
    if (res.success) {
      openImagePanel(articleId, null);
      showActionMsg('✅ تمت إزالة الصورة', 'success');
    }
  } catch (e) {
    showActionMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Helpers ──

function _escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const u = ['B', 'KB', 'MB'];
  let i = 0, s = bytes;
  while (s >= 1024 && i < u.length - 1) { s /= 1024; i++; }
  return s.toFixed(i > 0 ? 1 : 0) + ' ' + u[i];
}

function showActionMsg(msg, type) {
  const el = document.getElementById('action-result');
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  loadCategoryFallback();
});
