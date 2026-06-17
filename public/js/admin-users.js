let editingUserId = null;
let roleChangeUserId = null;
let passwordResetUserId = null;
let debounceTimer = null;

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadUsers, 300);
}

function checkAuth() {
  if (!localStorage.getItem('admin_token')) window.location.href = '/admin';
}
checkAuth();

document.getElementById('admin-user').textContent = localStorage.getItem('admin_user') || 'Zoheir IT Solutions';

function logout() {
  API.admin.logout().catch(() => {});
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
  window.location.href = '/admin';
}

async function loadUsers() {
  try {
    const params = {};
    const search = document.getElementById('users-search').value;
    if (search) params.search = search;
    const role = document.getElementById('users-role-filter').value;
    if (role) params.role = role;
    const status = document.getElementById('users-status-filter').value;
    if (status) params.status = status;

    const result = await API.admin.getUsers(params);
    renderUsers(result.items || []);
    updateStats(result.items || []);
    document.getElementById('users-count').textContent = result.total || 0;
  } catch (e) {
    document.getElementById('users-list').innerHTML = `<div class="alert alert-danger">${e.message}</div>`;
  }
}

function updateStats(users) {
  const total = users.length;
  const active = users.filter(u => u.status === 'active').length;
  const suspended = users.filter(u => u.status === 'suspended').length;
  const archived = users.filter(u => u.status === 'archived').length;
  const publishers = users.filter(u => u.role === 'publisher').length;
  const editors = users.filter(u => u.role === 'editor_in_chief').length;
  const journalists = users.filter(u => u.role === 'journalist').length;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-suspended').textContent = suspended;
  document.getElementById('stat-archived').textContent = archived;
  document.getElementById('stat-publishers').textContent = publishers;
  document.getElementById('stat-editors').textContent = editors;
  document.getElementById('stat-journalists').textContent = journalists;
}

const STATUS_NAMES = {
  active: '🟢 نشط',
  suspended: '🔴 موقوف',
  archived: '⚪ مؤرشف',
};

const ROLE_NAMES = {
  publisher: 'ناشر',
  editor_in_chief: 'رئيس تحرير',
  journalist: 'صحفي',
};

function renderUsers(users) {
  if (!users.length) {
    document.getElementById('users-list').innerHTML = '<p style="color:#888;text-align:center;padding:40px 0;">👥 لا يوجد مستخدمون</p>';
    return;
  }
  let html = `<table class="table">
    <tr>
      <th>#</th>
      <th>الاسم</th>
      <th>اسم المستخدم</th>
      <th>البريد</th>
      <th>الدور</th>
      <th>الحالة</th>
      <th>آخر دخول</th>
      <th>الإجراءات</th>
    </tr>`;
  users.forEach(u => {
    const s = u.status || 'active';
    const rowClass = `user-row-${s}`;
    const roleClass = `user-role-${u.role}`;
    const statusClass = `user-status-${s}`;
    const statusText = STATUS_NAMES[s] || STATUS_NAMES.active;
    const lastLogin = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ar-DZ') : '—';
    html += `<tr class="${rowClass}">
      <td>${u.id}</td>
      <td><strong>${u.fullName}</strong></td>
      <td>${u.username}</td>
      <td>${u.email || '—'}</td>
      <td><span class="user-role-badge ${roleClass}">${ROLE_NAMES[u.role] || u.role}</span></td>
      <td><span class="user-status-badge ${statusClass}">${statusText}</span></td>
      <td style="font-size:0.8rem;color:#888;">${lastLogin}</td>
      <td class="user-actions">
        <button class="btn btn-sm btn-primary" onclick="openEditModal(${u.id})" title="تعديل">✏️</button>
        <button class="btn btn-sm" style="background:#8b5cf6;color:white;" onclick="openRoleModal(${u.id}, '${u.role}', '${u.fullName}')" title="تغيير الدور">🔄</button>
        <button class="btn btn-sm btn-warning" onclick="openPasswordModal(${u.id}, '${u.fullName}')" title="إعادة تعيين كلمة المرور">🔑</button>
        ${s === 'active'
          ? `<button class="btn btn-sm btn-danger" onclick="suspendUser(${u.id})" title="إيقاف">⛔</button>
             <button class="btn btn-sm" style="background:#6b7280;color:white;" onclick="archiveUser(${u.id})" title="أرشفة">📦</button>`
          : ''}
        ${s === 'suspended'
          ? `<button class="btn btn-sm btn-success" onclick="activateUser(${u.id})" title="تفعيل">✅</button>
             <button class="btn btn-sm" style="background:#6b7280;color:white;" onclick="archiveUser(${u.id})" title="أرشفة">📦</button>`
          : ''}
        ${s === 'archived'
          ? `<button class="btn btn-sm btn-success" onclick="restoreUser(${u.id})" title="استعادة">↩️</button>`
          : ''}
      </td>
    </tr>`;
  });
  html += '</table>';
  document.getElementById('users-list').innerHTML = html;
}

function openCreateModal() {
  editingUserId = null;
  document.getElementById('user-modal-title').textContent = '➕ إضافة مستخدم جديد';
  document.getElementById('user-modal-submit').textContent = '💾 حفظ';
  document.getElementById('user-form').reset();
  document.getElementById('u-password-group').style.display = 'block';
  document.getElementById('u-password').required = true;
  document.getElementById('user-modal').classList.add('active');
}

async function openEditModal(id) {
  editingUserId = id;
  try {
    const users = await API.admin.getUsers({ limit: 100 });
    const user = (users.items || []).find(u => u.id === id);
    if (!user) throw new Error('المستخدم غير موجود');
    document.getElementById('user-modal-title').textContent = `✏️ تعديل: ${user.fullName}`;
    document.getElementById('user-modal-submit').textContent = '💾 حفظ التعديلات';
    document.getElementById('u-fullName').value = user.fullName;
    document.getElementById('u-username').value = user.username;
    document.getElementById('u-email').value = user.email || '';
    document.getElementById('u-phone').value = user.phone || '';
    document.getElementById('u-password').required = false;
    document.getElementById('u-password-group').style.display = 'none';
    document.getElementById('u-role').value = user.role;
    document.getElementById('user-modal').classList.add('active');
  } catch (e) {
    alert(e.message);
  }
}

function closeModal() {
  document.getElementById('user-modal').classList.remove('active');
  editingUserId = null;
}

async function submitUser() {
  const data = {
    fullName: document.getElementById('u-fullName').value.trim(),
    username: document.getElementById('u-username').value.trim(),
    email: document.getElementById('u-email').value.trim() || undefined,
    phone: document.getElementById('u-phone').value.trim() || undefined,
    role: document.getElementById('u-role').value,
  };
  if (!data.fullName || !data.username) { alert('الاسم الكامل واسم المستخدم مطلوبان'); return; }

  if (editingUserId) {
    try {
      await API.admin.updateUser(editingUserId, data);
      closeModal();
      loadUsers();
    } catch (e) { alert(e.message); }
  } else {
    data.password = document.getElementById('u-password').value;
    if (!data.password || data.password.length < 4) { alert('كلمة المرور مطلوبة (4 أحرف على الأقل)'); return; }
    try {
      await API.admin.createUser(data);
      closeModal();
      loadUsers();
    } catch (e) { alert(e.message); }
  }
}

async function suspendUser(id) {
  if (!confirm('⛔ هل أنت متأكد من إيقاف هذا المستخدم؟')) return;
  try {
    await API.admin.suspendUser(id);
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function activateUser(id) {
  if (!confirm('✅ هل أنت متأكد من تفعيل هذا المستخدم؟')) return;
  try {
    await API.admin.activateUser(id);
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function archiveUser(id) {
  if (!confirm('📦 هل أنت متأكد من أرشفة هذا المستخدم؟ سيبقى محفوظاً مع جميع مقالاته وسجلاته.')) return;
  try {
    await API.admin.archiveUser(id);
    loadUsers();
  } catch (e) { alert(e.message); }
}

async function restoreUser(id) {
  if (!confirm('↩️ هل أنت متأكد من استعادة هذا المستخدم من الأرشيف؟')) return;
  try {
    await API.admin.restoreUser(id);
    loadUsers();
  } catch (e) { alert(e.message); }
}

function openRoleModal(id, currentRole, fullName) {
  roleChangeUserId = id;
  document.getElementById('role-change-info').textContent = `تغيير دور ${fullName}`;
  document.getElementById('role-select').value = currentRole;
  document.getElementById('role-modal').classList.add('active');
}

async function submitRoleChange() {
  if (!roleChangeUserId) return;
  const role = document.getElementById('role-select').value;
  try {
    await API.admin.changeUserRole(roleChangeUserId, role);
    document.getElementById('role-modal').classList.remove('active');
    roleChangeUserId = null;
    loadUsers();
  } catch (e) { alert(e.message); }
}

function openPasswordModal(id, fullName) {
  passwordResetUserId = id;
  document.getElementById('password-reset-info').textContent = `إعادة تعيين كلمة المرور لـ ${fullName}`;
  document.getElementById('new-password').value = '';
  document.getElementById('password-modal').classList.add('active');
}

async function submitPasswordReset() {
  if (!passwordResetUserId) return;
  const password = document.getElementById('new-password').value;
  if (!password || password.length < 4) { alert('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); return; }
  try {
    await API.admin.resetUserPassword(passwordResetUserId, password);
    document.getElementById('password-modal').classList.remove('active');
    passwordResetUserId = null;
    alert('✅ تم إعادة تعيين كلمة المرور بنجاح');
    loadUsers();
  } catch (e) { alert(e.message); }
}

document.addEventListener('DOMContentLoaded', loadUsers);