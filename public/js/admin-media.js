const MEDIA_PAGE_SIZE = 24;
let editingId = null;
let deletingId = null;

function checkAuth() { if (!localStorage.getItem('admin_token')) window.location.href = '/admin'; }

function logout() { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); window.location.href = '/admin'; }

function _tokenHeaders() {
  return { 'x-admin-auth': localStorage.getItem('admin_token') || '' };
}

async function _adminFetch(url, options = {}) {
  const token = _tokenHeaders();
  const timeout = options.timeout || 30000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...token, ...options.headers },
    });
    clearTimeout(id);
    if (!res.ok) {
      let msg = `خطأ ${res.status}`;
      try { const err = await res.json(); if (err.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
    return res;
  } catch (e) {
    clearTimeout(id);
    if (e.name === 'AbortError') throw new Error('انتهت مهلة الطلب');
    throw e;
  }
}

function _adminGet(path) {
  return _adminFetch(path).then(r => r.json());
}

function _adminPost(path, body) {
  return _adminFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

function _adminPut(path, body) {
  return _adminFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

function _adminDelete(path) {
  return _adminFetch(path, { method: 'DELETE' });
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return size.toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('ar-DZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Categories ──

async function loadCategorySelects() {
  try {
    const cats = await API.get('/local-categories');
    const selects = ['upload-category', 'edit-category', 'filter-category'];
    for (const id of selects) {
      const sel = document.getElementById(id);
      if (!sel) continue;
      sel.innerHTML = id === 'filter-category' ? '<option value="">جميع التصنيفات</option>' : '<option value="">بدون تصنيف</option>';
      for (const cat of cats) {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        sel.appendChild(opt);
      }
    }
  } catch (e) {
    console.error('Failed to load categories:', e);
  }
}

// ── Load Media ──

async function loadMedia() {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading">جاري التحميل...</div>';

  try {
    const params = new URLSearchParams();
    const limit = MEDIA_PAGE_SIZE;

    const search = document.getElementById('search-input')?.value?.trim();
    if (search) params.set('search', search);

    const category = document.getElementById('filter-category')?.value;
    if (category) params.set('category', category);

    const uploader = document.getElementById('filter-uploader')?.value;
    if (uploader) params.set('uploader', uploader);

    const dateFrom = document.getElementById('filter-date-from')?.value;
    if (dateFrom) params.set('date_from', dateFrom);

    const dateTo = document.getElementById('filter-date-to')?.value;
    if (dateTo) params.set('date_to', dateTo);

    params.set('limit', limit);
    params.set('offset', currentOffset);

    const res = await _adminGet(`/api/admin/media?${params.toString()}`);
    renderStats(res);
    renderGrid(res.items || []);
    renderPagination(res.total || 0);

    // Populate uploader filter
    populateUploaderFilter(res.items || []);
  } catch (e) {
    grid.innerHTML = `<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(e.message)}</div>`;
  }
}

// ── Stats ──

function renderStats(res) {
  const statsEl = document.getElementById('media-stats');
  if (!statsEl) return;
  const total = res.total || 0;
  const used = (res.items || []).filter(i => (i.usage_count || 0) > 0).length;
  const unused = total - used;
  const totalSize = (res.items || []).reduce((s, i) => s + (i.size || 0), 0);
  statsEl.innerHTML = `
    <div class="admin-stat"><div class="num">${total}</div><div class="lbl"><i class="fas fa-images"></i> إجمالي الوسائط</div></div>
    <div class="admin-stat"><div class="num">${used}</div><div class="lbl"><i class="fas fa-link"></i> الصور المستخدمة</div></div>
    <div class="admin-stat"><div class="num">${unused}</div><div class="lbl"><i class="fas fa-unlink"></i> الصور غير المستخدمة</div></div>
    <div class="admin-stat"><div class="num">${formatSize(totalSize)}</div><div class="lbl"><i class="fas fa-database"></i> حجم المكتبة</div></div>
  `;
}

// ── Grid ──

let currentOffset = 0;

function renderGrid(items) {
  const grid = document.getElementById('media-grid');
  if (!grid) return;
  if (!items || items.length === 0) {
    grid.innerHTML = '<div class="media-empty"><i class="fas fa-images" style="font-size:3rem;opacity:0.3;display:block;margin-bottom:10px;"></i> لا توجد وسائط في المكتبة</div>';
    return;
  }
  grid.innerHTML = items.map(item => {
    const usedClass = (item.usage_count || 0) > 0 ? 'media-card-used' : '';
    return `
      <div class="media-card ${usedClass}" data-id="${item.id}">
        <div class="media-card-img">
          <img src="${escapeHtml(item.path)}" alt="${escapeHtml(item.alt_text || item.filename)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'media-card-placeholder\\'><i class=\\'fas fa-broken-image\\'></i></div>'">
          <div class="media-card-actions">
            <button class="media-action-btn" onclick="viewMedia(${item.id})" title="عرض">
              <i class="fas fa-eye"></i>
            </button>
            <button class="media-action-btn" onclick="openEditModal(${item.id})" title="تعديل">
              <i class="fas fa-edit"></i>
            </button>
            <button class="media-action-btn media-action-delete" onclick="openDeleteModal(${item.id})" title="حذف">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
          ${(item.usage_count || 0) > 0 ? '<span class="media-card-usage-badge"><i class="fas fa-link"></i> ' + item.usage_count + '</span>' : ''}
        </div>
        <div class="media-card-body">
          <div class="media-card-filename" title="${escapeHtml(item.filename)}">${escapeHtml(item.originalname || item.filename)}</div>
          <div class="media-card-meta">
            <span><i class="fas fa-folder"></i> ${escapeHtml(item.category || '—')}</span>
            <span><i class="fas fa-user"></i> ${escapeHtml(item.uploader || '—')}</span>
          </div>
          <div class="media-card-meta">
            <span><i class="fas fa-calendar"></i> ${formatDate(item.created_at)}</span>
          </div>
          <div class="media-card-meta">
            <span><i class="fas fa-file"></i> ${formatSize(item.size)}</span>
            <span class="${(item.usage_count || 0) > 0 ? 'used' : 'unused'}">
              <i class="fas ${(item.usage_count || 0) > 0 ? 'fa-link' : 'fa-unlink'}"></i>
              ${(item.usage_count || 0) > 0 ? 'مستخدمة' : 'غير مستخدمة'}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Pagination ──

function renderPagination(total) {
  const el = document.getElementById('media-pagination');
  if (!el) return;
  const totalPages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
  const currentPage = Math.floor(currentOffset / MEDIA_PAGE_SIZE) + 1;
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '<div class="pagination-inner">';
  html += `<button class="btn btn-sm pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 2) {
      html += `<button class="btn btn-sm pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += '<span class="pagination-dots">…</span>';
    }
  }
  html += `<button class="btn btn-sm pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
  html += '</div>';
  el.innerHTML = html;
}

function goToPage(page) {
  const totalPages = Math.ceil((document.getElementById('media-grid')?.dataset?.total || 0) / MEDIA_PAGE_SIZE);
  if (page < 1) return;
  currentOffset = (page - 1) * MEDIA_PAGE_SIZE;
  loadMedia();
  document.querySelector('.admin-content')?.scrollIntoView({ behavior: 'smooth' });
}

// ── Uploader Filter ──

function populateUploaderFilter(items) {
  const sel = document.getElementById('filter-uploader');
  if (!sel) return;
  const current = sel.value;
  const uploaders = [...new Set(items.map(i => i.uploader).filter(Boolean))];
  sel.innerHTML = '<option value="">جميع الرافعين</option>' + uploaders.map(u => `<option value="${escapeHtml(u)}" ${u === current ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('');
}

// ── Search ──

let searchTimer = null;
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    currentOffset = 0;
    loadMedia();
  }, 300);
}

// ── View (full size) ──

function viewMedia(id) {
  window.open(`/api/media/${id}`, '_blank');
}

// ── Upload ──

function openUploadModal() {
  document.getElementById('upload-modal').classList.add('active');
  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'none';
  document.getElementById('drop-zone-content').style.display = 'block';
  document.getElementById('drop-zone-preview').style.display = 'none';
  document.getElementById('file-input').value = '';
  document.getElementById('upload-alt-text').value = '';
  document.getElementById('upload-caption').value = '';
  document.getElementById('upload-submit-btn').disabled = false;
  document.getElementById('upload-submit-btn').innerHTML = '<i class="fas fa-cloud-upload-alt"></i> رفع';
}

let pendingUploadFile = null;

function onDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('dragover'); }
function onDragLeave(e) { e.currentTarget.classList.remove('dragover'); }
function onDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) setUploadFile(files[0]);
}

function onFileSelected(e) {
  if (e.target.files.length > 0) setUploadFile(e.target.files[0]);
}

function setUploadFile(file) {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 10 * 1024 * 1024;
  if (!validTypes.includes(file.type)) {
    showUploadError('النوع غير مدعوم. يُسمح فقط بـ JPEG, PNG, WebP');
    return;
  }
  if (file.size > maxSize) {
    showUploadError('حجم الملف كبير جداً. الحد الأقصى 10 ميغابايت');
    return;
  }
  pendingUploadFile = file;
  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('drop-zone-content').style.display = 'none';
  document.getElementById('drop-zone-preview').style.display = 'block';
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('upload-preview-img').src = e.target.result;
    document.getElementById('upload-preview-info').textContent = `${file.name} (${formatSize(file.size)})`;
  };
  reader.readAsDataURL(file);
}

function showUploadError(msg) {
  const el = document.getElementById('upload-error');
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
}

async function submitUpload() {
  if (!pendingUploadFile) { showUploadError('الرجاء اختيار ملف للرفع'); return; }
  const btn = document.getElementById('upload-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';
  document.getElementById('upload-error').style.display = 'none';
  document.getElementById('upload-progress').style.display = 'block';

  try {
    const formData = new FormData();
    formData.append('file', pendingUploadFile);
    formData.append('alt_text', document.getElementById('upload-alt-text').value || '');
    formData.append('caption', document.getElementById('upload-caption').value || '');
    formData.append('category', document.getElementById('upload-category').value || '');

    const res = await _adminFetch('/api/admin/media/upload', {
      method: 'POST',
      body: formData,
      timeout: 60000,
    });
    document.getElementById('upload-progress').style.display = 'none';
    showNotification('✅ تم رفع الصورة بنجاح', 'success');
    closeModal('upload-modal');
    pendingUploadFile = null;
    currentOffset = 0;
    loadMedia();
  } catch (e) {
    document.getElementById('upload-progress').style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> رفع';
    showUploadError(e.message || 'فشل الرفع');
  }
}

function showNotification(msg, type) {
  const el = document.getElementById('upload-notification');
  if (!el) return;
  el.textContent = msg;
  el.className = 'media-notification alert alert-' + type;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Edit ──

async function openEditModal(id) {
  editingId = id;
  document.getElementById('edit-error').style.display = 'none';
  document.getElementById('edit-success').style.display = 'none';
  document.getElementById('edit-modal').classList.add('active');

  try {
    const item = await _adminGet(`/api/admin/media/${id}`);
    document.getElementById('edit-preview').innerHTML = `<img src="${escapeHtml(item.path)}" alt="${escapeHtml(item.alt_text || '')}" style="max-width:100%;max-height:200px;border-radius:8px;margin-bottom:15px;">`;
    document.getElementById('edit-alt-text').value = item.alt_text || '';
    document.getElementById('edit-caption').value = item.caption || '';
    const catSel = document.getElementById('edit-category');
    if (catSel) {
      const exists = [...catSel.options].some(o => o.value === item.category);
      catSel.value = exists ? item.category : '';
    }
    document.getElementById('edit-filename').textContent = item.filename || '—';
    document.getElementById('edit-uploader').textContent = item.uploader || '—';
    document.getElementById('edit-date').textContent = formatDate(item.created_at);
    document.getElementById('edit-usage').textContent = (item.usage_count || 0) + (item.used_in?.length > 0 ? ' (#' + item.used_in.map(u => u.content_id).join(', #') + ')' : '');
  } catch (e) {
    document.getElementById('edit-error').textContent = '⚠️ ' + e.message;
    document.getElementById('edit-error').style.display = 'block';
  }
}

async function saveEdit() {
  if (!editingId) return;
  const btn = document.querySelector('#edit-modal .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; }
  document.getElementById('edit-error').style.display = 'none';
  document.getElementById('edit-success').style.display = 'none';

  try {
    const data = {
      alt_text: document.getElementById('edit-alt-text').value || '',
      caption: document.getElementById('edit-caption').value || '',
      category: document.getElementById('edit-category').value || '',
    };
    await _adminPut(`/api/admin/media/${editingId}`, data);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ'; }
    document.getElementById('edit-success').textContent = '✅ تم تحديث بيانات الوسيط بنجاح';
    document.getElementById('edit-success').style.display = 'block';
    setTimeout(() => { closeModal('edit-modal'); loadMedia(); }, 1000);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> حفظ'; }
    document.getElementById('edit-error').textContent = '⚠️ ' + e.message;
    document.getElementById('edit-error').style.display = 'block';
  }
}

// ── Delete ──

async function openDeleteModal(id) {
  deletingId = id;
  document.getElementById('delete-error').style.display = 'none';
  document.getElementById('delete-warning').style.display = 'none';
  document.getElementById('delete-blocked').style.display = 'none';
  document.getElementById('delete-success').style.display = 'none';
  document.getElementById('delete-confirm-btn').style.display = 'inline-flex';
  document.getElementById('delete-message').style.display = 'block';
  document.getElementById('delete-message').textContent = 'هل أنت متأكد من حذف هذه الصورة؟';
  document.getElementById('delete-modal').classList.add('active');

  try {
    const item = await _adminGet(`/api/admin/media/${id}`);
    if ((item.usage_count || 0) > 0) {
      document.getElementById('delete-warning').style.display = 'block';
      document.getElementById('delete-warning-text').innerHTML = `<i class="fas fa-exclamation-triangle"></i> هذه الصورة مستخدمة في <strong>${item.usage_count}</strong> محتوى منشور.`;
      document.getElementById('delete-blocked').style.display = 'block';
      let details = '<div class="delete-usage-title">المعرفات المرتبطة:</div><div class="delete-usage-ids">';
      if (item.used_in && item.used_in.length > 0) {
        details += item.used_in.map(u => `<span class="usage-id-badge">#${u.content_id} (${u.type})</span>`).join('');
      } else {
        details += '<span style="color:#888;font-size:0.85rem;">غير متوفرة</span>';
      }
      details += '</div>';
      document.getElementById('delete-usage-details').innerHTML = details;
      document.getElementById('delete-confirm-btn').style.display = 'none';
      document.getElementById('delete-message').style.display = 'none';
    } else {
      document.getElementById('delete-warning').style.display = 'none';
      document.getElementById('delete-blocked').style.display = 'none';
    }
  } catch (e) {
    // Proceed anyway
  }
}

async function confirmDelete() {
  if (!deletingId) return;
  const btn = document.getElementById('delete-confirm-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحذف...';

  try {
    const res = await _adminDelete(`/api/admin/media/${deletingId}`);
    if (res.status === 204) {
      document.getElementById('delete-success').style.display = 'block';
      document.getElementById('delete-message').style.display = 'none';
      document.getElementById('delete-confirm-btn').style.display = 'none';
      setTimeout(() => {
        closeModal('delete-modal');
        deletingId = null;
        loadMedia();
      }, 1000);
    } else {
      let msg = 'فشل الحذف';
      try { const err = await res.json(); if (err.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
  } catch (e) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-trash-alt"></i> حذف';
    document.getElementById('delete-error').textContent = '⚠️ ' + e.message;
    document.getElementById('delete-error').style.display = 'block';
  }
}

// ── Modal helpers ──

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'upload-modal') pendingUploadFile = null;
  if (id === 'edit-modal') editingId = null;
  if (id === 'delete-modal') deletingId = null;
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('admin-user').textContent = localStorage.getItem('admin_user') || 'Zoheir IT Solutions';
  loadCategorySelects().then(() => loadMedia());
});
