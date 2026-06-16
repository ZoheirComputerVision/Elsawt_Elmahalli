let editingId = null;

function checkAuth() { if (!localStorage.getItem('admin_token')) window.location.href = '/admin'; }
function logout() { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); window.location.href = '/admin'; }

function _auth() { return { 'x-admin-auth': localStorage.getItem('admin_token') || '' }; }

async function _get(path) {
  const r = await fetch(path, { headers: _auth() });
  if (!r.ok) { let m = 'خطأ ' + r.status; try { const e = await r.json(); m = e.error || m; } catch {} throw new Error(m); }
  return r.json();
}

async function _post(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { ..._auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { let m = 'خطأ ' + r.status; try { const e = await r.json(); m = e.error || m; } catch {} throw new Error(m); }
  return r.json();
}

async function _put(path, body) {
  const r = await fetch(path, { method: 'PUT', headers: { ..._auth(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { let m = 'خطأ ' + r.status; try { const e = await r.json(); m = e.error || m; } catch {} throw new Error(m); }
  return r.json();
}

async function _del(path) {
  const r = await fetch(path, { method: 'DELETE', headers: _auth() });
  if (!r.ok) { let m = 'خطأ ' + r.status; try { const e = await r.json(); m = e.error || m; } catch {} throw new Error(m); }
  return r.json();
}

function escape(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function showMsg(msg, type, dur) {
  const el = document.getElementById('featured-notification');
  if (!el) return;
  el.className = 'alert alert-' + type;
  el.innerHTML = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, dur || 4000);
}

// ── Load ──

async function loadFeatured() {
  const list = document.getElementById('featured-list');
  list.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const params = new URLSearchParams();
    const s = document.getElementById('search-input')?.value?.trim();
    if (s) params.set('search', s);
    const st = document.getElementById('filter-status')?.value;
    if (st) params.set('is_active', st);
    const res = await _get('/api/admin/featured-stories?' + params.toString());
    renderStats(res);
    renderList(res.items || []);
  } catch (e) {
    list.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> ' + escape(e.message) + '</div>';
  }
}

function renderStats(res) {
  const el = document.getElementById('featured-stats');
  if (!el) return;
  const total = res.total || 0;
  const all = res.items || [];
  const active = all.filter(i => i.is_active).length;
  const inactive = total - active;
  el.innerHTML = `
    <div class="featured-stat"><div class="num">${total}</div><div class="lbl"><i class="fas fa-star"></i> المجموع</div></div>
    <div class="featured-stat"><div class="num">${active}</div><div class="lbl"><i class="fas fa-check-circle" style="color:var(--success)"></i> نشط</div></div>
    <div class="featured-stat"><div class="num">${inactive}</div><div class="lbl"><i class="fas fa-times-circle" style="color:var(--text-light)"></i> غير نشط</div></div>
  `;
}

function renderList(items) {
  const list = document.getElementById('featured-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="featured-empty"><i class="fas fa-star" style="font-size:2.5rem;opacity:0.2;display:block;margin-bottom:10px;"></i> لا توجد أخبار مميزة</div>';
    return;
  }
  let html = '<table class="table featured-table"><thead><tr><th>#</th><th>العنوان</th><th>الحالة</th><th>تاريخ الإضافة</th><th>الإجراءات</th></tr></thead><tbody>';
  items.forEach(item => {
    const activeBadge = item.is_active
      ? '<span class="featured-badge active"><i class="fas fa-check-circle"></i> نشط</span>'
      : '<span class="featured-badge inactive"><i class="fas fa-times-circle"></i> غير نشط</span>';
    html += `<tr>
      <td>${item.featured_order || '-'}</td>
      <td><strong>${escape(item.title || 'بدون عنوان')}</strong></td>
      <td>${activeBadge}</td>
      <td style="font-size:0.82rem;color:var(--text-light);">${item.created_at ? new Date(item.created_at).toLocaleDateString('ar-DZ') : '—'}</td>
      <td>
        <div class="featured-actions">
          <button class="btn btn-sm btn-accent" onclick="moveItem(${item.id},'up')" title="رفع"><i class="fas fa-chevron-up"></i></button>
          <button class="btn btn-sm btn-accent" onclick="moveItem(${item.id},'down')" title="خفض"><i class="fas fa-chevron-down"></i></button>
          <button class="btn btn-sm btn-primary" onclick="openEditModal(${item.id},${item.featured_order},${item.is_active})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-danger" onclick="deleteItem(${item.id})"><i class="fas fa-trash-alt"></i></button>
        </div>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';
  list.innerHTML = html;
}

// ── Search ──

let searchTimer = null;
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(loadFeatured, 300);
}

// ── Add ──

let articleSearchTimer = null;

function openAddModal() {
  document.getElementById('add-modal').classList.add('active');
  document.getElementById('add-error').style.display = 'none';
  document.getElementById('selected-article-id').value = '';
  document.getElementById('selected-article-info').style.display = 'none';
  document.getElementById('article-results').innerHTML = '';
  document.getElementById('article-search').value = '';
  document.getElementById('add-order').value = '1';
  document.getElementById('add-active').checked = true;
}

function onArticleSearch() {
  if (articleSearchTimer) clearTimeout(articleSearchTimer);
  articleSearchTimer = setTimeout(searchArticles, 400);
}

async function searchArticles() {
  const q = document.getElementById('article-search').value.trim();
  const results = document.getElementById('article-results');
  if (q.length < 2) { results.innerHTML = ''; return; }
  try {
    const res = await _get('/api/admin/content?status=published&limit=10&search=' + encodeURIComponent(q));
    if (!res.items || res.items.length === 0) {
      results.innerHTML = '<div class="article-result-item" style="color:var(--text-light);">لا توجد نتائج</div>';
      return;
    }
    results.innerHTML = res.items.map(a => `
      <div class="article-result-item" onclick="selectArticle(${a.id}, '${escape(a.title)}')">
        <div class="article-result-title">${escape(a.title)}</div>
        <div class="article-result-meta">${escape(a.category || '—')} · ${a.published_at ? new Date(a.published_at).toLocaleDateString('ar-DZ') : '—'}</div>
      </div>
    `).join('');
  } catch (e) {
    results.innerHTML = '<div class="article-result-item" style="color:var(--danger);">خطأ: ' + escape(e.message) + '</div>';
  }
}

function selectArticle(id, title) {
  document.getElementById('selected-article-id').value = id;
  document.getElementById('selected-article-info').style.display = 'block';
  document.getElementById('selected-article-info').innerHTML = '<i class="fas fa-check-circle" style="color:var(--success)"></i> تم اختيار: <strong>' + title + '</strong>';
  document.getElementById('article-results').innerHTML = '';
  document.getElementById('article-search').value = title;
}

async function submitAdd() {
  const articleId = document.getElementById('selected-article-id').value;
  if (!articleId) { showFormError('add-error', 'الرجاء اختيار مقال'); return; }
  const order = parseInt(document.getElementById('add-order').value) || 1;
  const active = document.getElementById('add-active').checked;
  try {
    await _post('/api/admin/featured-stories', { article_id: parseInt(articleId), featured_order: order, is_active: active });
    closeModal('add-modal');
    showMsg('✅ تم إضافة الخبر المميز', 'success');
    loadFeatured();
  } catch (e) {
    showFormError('add-error', e.message);
  }
}

// ── Edit ──

function openEditModal(id, order, active) {
  editingId = id;
  document.getElementById('edit-modal').classList.add('active');
  document.getElementById('edit-error').style.display = 'none';
  document.getElementById('edit-order').value = order;
  document.getElementById('edit-active').checked = active;
}

async function submitEdit() {
  if (!editingId) return;
  const order = parseInt(document.getElementById('edit-order').value);
  const active = document.getElementById('edit-active').checked;
  try {
    await _put('/api/admin/featured-stories/' + editingId, { featured_order: order, is_active: active });
    closeModal('edit-modal');
    editingId = null;
    showMsg('✅ تم تحديث الخبر المميز', 'success');
    loadFeatured();
  } catch (e) {
    showFormError('edit-error', e.message);
  }
}

// ── Delete ──

async function deleteItem(id) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا الخبر المميز؟')) return;
  try {
    await _del('/api/admin/featured-stories/' + id);
    showMsg('✅ تم الحذف', 'success');
    loadFeatured();
  } catch (e) {
    showMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Reorder ──

async function moveItem(id, direction) {
  try {
    const res = await _post('/api/admin/featured-stories/reorder', { id, direction });
    showMsg('✅ تم إعادة الترتيب', 'success');
    loadFeatured();
  } catch (e) {
    showMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Helpers ──

function showFormError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = '⚠️ ' + msg; el.style.display = 'block'; }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('admin-user').textContent = localStorage.getItem('admin_user') || 'Zoheir IT Solutions';
  loadFeatured();
});
