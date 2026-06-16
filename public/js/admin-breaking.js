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
  const el = document.getElementById('breaking-notification');
  if (!el) return;
  el.className = 'alert alert-' + type;
  el.innerHTML = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, dur || 4000);
}

// ── Load ──

async function loadBreaking() {
  const list = document.getElementById('breaking-list');
  list.innerHTML = '<div class="loading">جاري التحميل...</div>';
  try {
    const params = new URLSearchParams();
    const s = document.getElementById('search-input')?.value?.trim();
    if (s) params.set('search', s);
    const st = document.getElementById('filter-status')?.value;
    if (st) params.set('is_active', st);
    const res = await _get('/api/admin/breaking-news?' + params.toString());
    renderStats(res);
    renderList(res.items || []);
  } catch (e) {
    list.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-circle"></i> ' + escape(e.message) + '</div>';
  }
}

function renderStats(res) {
  const el = document.getElementById('breaking-stats');
  if (!el) return;
  const total = res.total || 0;
  const all = res.items || [];
  const active = all.filter(i => i.is_active).length;
  const inactive = total - active;
  const now = new Date();
  const expired = all.filter(i => i.expires_at && new Date(i.expires_at) <= now).length;
  el.innerHTML = `
    <div class="breaking-stat"><div class="num">${total}</div><div class="lbl"><i class="fas fa-list"></i> المجموع</div></div>
    <div class="breaking-stat"><div class="num">${active}</div><div class="lbl"><i class="fas fa-check-circle" style="color:var(--danger)"></i> نشط</div></div>
    <div class="breaking-stat"><div class="num">${inactive}</div><div class="lbl"><i class="fas fa-times-circle" style="color:var(--text-light)"></i> غير نشط</div></div>
    <div class="breaking-stat"><div class="num">${expired}</div><div class="lbl"><i class="fas fa-clock" style="color:#f59e0b"></i> منتهية</div></div>
  `;
}

function formatDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('ar-DZ'); } catch { return d; }
}

function renderList(items) {
  const list = document.getElementById('breaking-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="breaking-empty"><i class="fas fa-bolt" style="font-size:2.5rem;opacity:0.2;display:block;margin-bottom:10px;"></i> لا توجد أخبار عاجلة</div>';
    return;
  }
  const now = new Date();
  let html = '<table class="table breaking-table"><thead><tr><th>#</th><th>العنوان</th><th>الحالة</th><th>البدء</th><th>الانتهاء</th><th>تاريخ الإضافة</th><th>الإجراءات</th></tr></thead><tbody>';
  items.forEach(item => {
    const isExpired = item.expires_at && new Date(item.expires_at) <= now;
    let badge = '';
    if (isExpired) badge = '<span class="breaking-badge expired"><i class="fas fa-clock"></i> منتهي</span>';
    else if (item.is_active) badge = '<span class="breaking-badge active"><i class="fas fa-bolt"></i> نشط</span>';
    else badge = '<span class="breaking-badge inactive"><i class="fas fa-times-circle"></i> غير نشط</span>';

    html += `<tr class="${isExpired ? 'breaking-expired' : ''}">
      <td>${item.priority || '-'}</td>
      <td><strong>${escape(item.title || 'بدون عنوان')}</strong></td>
      <td>${badge}</td>
      <td style="font-size:0.8rem;">${formatDate(item.starts_at)}</td>
      <td style="font-size:0.8rem;">${formatDate(item.expires_at)}</td>
      <td style="font-size:0.8rem;color:var(--text-light);">${item.created_at ? new Date(item.created_at).toLocaleDateString('ar-DZ') : '—'}</td>
      <td>
        <div class="breaking-actions">
          <button class="btn btn-sm btn-accent" onclick="moveItem(${item.id},'up')" title="رفع"><i class="fas fa-chevron-up"></i></button>
          <button class="btn btn-sm btn-accent" onclick="moveItem(${item.id},'down')" title="خفض"><i class="fas fa-chevron-down"></i></button>
          <button class="btn btn-sm btn-primary" onclick="openEditModal(${item.id})"><i class="fas fa-edit"></i></button>
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
  searchTimer = setTimeout(loadBreaking, 300);
}

// ── Add ──

function openAddModal() {
  document.getElementById('add-modal').classList.add('active');
  document.getElementById('add-error').style.display = 'none';
  document.getElementById('add-title').value = '';
  document.getElementById('add-url').value = '';
  document.getElementById('add-starts').value = '';
  document.getElementById('add-expires').value = '';
  document.getElementById('add-active').checked = true;
}

async function submitAdd() {
  const title = document.getElementById('add-title').value.trim();
  if (!title) { showFormError('add-error', 'العنوان مطلوب'); return; }
  const url = document.getElementById('add-url').value.trim() || null;
  const startsAt = document.getElementById('add-starts').value || null;
  const expiresAt = document.getElementById('add-expires').value || null;
  const active = document.getElementById('add-active').checked;
  try {
    await _post('/api/admin/breaking-news', { title, url, starts_at: startsAt, expires_at: expiresAt, is_active: active });
    closeModal('add-modal');
    showMsg('✅ تم إضافة الخبر العاجل', 'success');
    loadBreaking();
  } catch (e) {
    showFormError('add-error', e.message);
  }
}

// ── Edit ──

async function openEditModal(id) {
  editingId = id;
  document.getElementById('edit-modal').classList.add('active');
  document.getElementById('edit-error').style.display = 'none';
  try {
    const res = await _get('/api/admin/breaking-news?limit=100');
    const item = (res.items || []).find(i => i.id === id);
    if (!item) { showMsg('⚠️ السجل غير موجود', 'danger'); closeModal('edit-modal'); return; }
    document.getElementById('edit-title').value = item.title || '';
    document.getElementById('edit-url').value = item.url || '';
    document.getElementById('edit-starts').value = item.starts_at ? item.starts_at.slice(0, 16) : '';
    document.getElementById('edit-expires').value = item.expires_at ? item.expires_at.slice(0, 16) : '';
    document.getElementById('edit-active').checked = item.is_active;
  } catch (e) {
    showFormError('edit-error', e.message);
  }
}

async function submitEdit() {
  if (!editingId) return;
  const title = document.getElementById('edit-title').value.trim();
  if (!title) { showFormError('edit-error', 'العنوان مطلوب'); return; }
  const url = document.getElementById('edit-url').value.trim() || null;
  const startsAt = document.getElementById('edit-starts').value || null;
  const expiresAt = document.getElementById('edit-expires').value || null;
  const active = document.getElementById('edit-active').checked;
  try {
    await _put('/api/admin/breaking-news/' + editingId, { title, url, starts_at: startsAt, expires_at: expiresAt, is_active: active });
    closeModal('edit-modal');
    editingId = null;
    showMsg('✅ تم تحديث الخبر العاجل', 'success');
    loadBreaking();
  } catch (e) {
    showFormError('edit-error', e.message);
  }
}

// ── Delete ──

async function deleteItem(id) {
  if (!confirm('⚠️ هل أنت متأكد من حذف هذا الخبر العاجل؟')) return;
  try {
    await _del('/api/admin/breaking-news/' + id);
    showMsg('✅ تم الحذف', 'success');
    loadBreaking();
  } catch (e) {
    showMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Reorder ──

async function moveItem(id, direction) {
  try {
    await _post('/api/admin/breaking-news/reorder', { id, direction });
    showMsg('✅ تم إعادة الترتيب', 'success');
    loadBreaking();
  } catch (e) {
    showMsg('⚠️ ' + e.message, 'danger');
  }
}

// ── Archive Expired ──

async function archiveExpired() {
  try {
    const res = await _post('/api/admin/breaking-news/archive-expired', {});
    if (res.archived > 0) {
      showMsg('✅ تم أرشفة ' + res.archived + ' خبر منتهي', 'success');
    } else {
      showMsg('ℹ️ لا توجد أخبار منتهية للأرشفة', 'info');
    }
    loadBreaking();
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
  loadBreaking();
});
