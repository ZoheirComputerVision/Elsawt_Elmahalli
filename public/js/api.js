const API = {
  base: '/api',

  _adminHeaders(headers = {}) {
    const token = localStorage.getItem('admin_token');
    if (token) headers['x-admin-auth'] = token;
    return headers;
  },

  async _fetch(url, options = {}) {
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      if (e.name === 'AbortError') throw new Error('انتهت مهلة الطلب');
      throw e;
    }
  },

  async get(endpoint, admin = false) {
    const headers = admin ? this._adminHeaders() : {};
    const res = await this._fetch(this.base + endpoint, { headers });
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  async post(endpoint, data, admin = false) {
    const headers = this._adminHeaders({ 'Content-Type': 'application/json' });
    if (!admin) delete headers['x-admin-auth'];
    const res = await this._fetch(this.base + endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `API Error: ${res.status}`;
      try { const err = await res.json(); if (err.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  async put(endpoint, data) {
    const headers = this._adminHeaders({ 'Content-Type': 'application/json' });
    const res = await this._fetch(this.base + endpoint, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let msg = `API Error: ${res.status}`;
      try { const err = await res.json(); if (err.error) msg = err.error; } catch {}
      throw new Error(msg);
    }
    return res.json();
  },

  // Public API
  getContent: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return API.get(`/content${q ? '?' + q : ''}`);
  },
  getContentById: (id) => API.get(`/content/${id}`),
  getTimeline: () => API.get('/timeline'),
  getStats: () => API.get('/stats'),
  getCategories: () => API.get('/categories'),
  search: (q) => API.get(`/search?q=${encodeURIComponent(q)}`),
  getRecent: () => API.get('/recent'),
  getFeatured: () => API.get('/featured'),
  getBreakingNews: () => API.get('/breaking-news'),
  trackView: (id) => API.post(`/content/${id}/view`),

  // Admin API
  admin: {
    login: (username, password) => API.post('/admin/auth', { username, password }),
    dashboard: () => API.get('/admin/dashboard', true),
    getContent: (params) => API.get(`/admin/content?${new URLSearchParams(params).toString()}`, true),
    getContentById: (id) => API.get(`/admin/content/${id}`, true),
    approve: (id) => API.post(`/admin/content/${id}/approve`, null, true),
    reject: (id, reason) => API.post(`/admin/content/${id}/reject`, { reason }, true),
    generate: (id) => API.post(`/admin/content/${id}/generate`, null, true),
    removeItem: (id) => API.post(`/admin/content/${id}/delete`, null, true),
    updateItem: (id, data) => API.post(`/admin/content/${id}/update`, data, true),
    setArticleImage: (id, mediaId) => API.post(`/admin/content/${id}/image`, { media_id: mediaId }, true),
    removeArticleImage: (id) => API.post(`/admin/content/${id}/image`, { remove: true }, true),
    collect: () => API.post('/admin/collect', null, true),
    collectManual: (data) => API.post('/admin/collect/manual', data, true),
    analyze: () => API.post('/admin/analyze', null, true),
    publish: () => API.post('/admin/publish', null, true),
    getLogs: (params) => API.get(`/admin/logs?${new URLSearchParams(params).toString()}`, true),
    getSettings: () => API.get('/admin/settings', true),
    updateSetting: (key, value) => API.post('/admin/settings', { key, value }, true),
    exportArchive: () => API.post('/admin/archive/export', null, true),
    getTimeline: () => API.get('/admin/archive/timeline', true),
    getSources: () => API.get('/admin/sources', true),
    runCollector: () => API.post('/admin/scheduler/run-collector', null, true),

    // User management
    getUsers: (params) => API.get(`/admin/users?${new URLSearchParams(params).toString()}`, true),
    createUser: (data) => API.post('/admin/users', data, true),
    updateUser: (id, data) => API.put(`/admin/users/${id}`, data),
    suspendUser: (id) => API.post(`/admin/users/${id}/suspend`, null, true),
    activateUser: (id) => API.post(`/admin/users/${id}/activate`, null, true),
    archiveUser: (id) => API.post(`/admin/users/${id}/archive`, null, true),
    restoreUser: (id) => API.post(`/admin/users/${id}/restore`, null, true),
    changeUserRole: (id, role) => API.post(`/admin/users/${id}/role`, { role }, true),
    resetUserPassword: (id, password) => API.post(`/admin/users/${id}/reset-password`, { password }, true),
    reactivate: (id) => API.post(`/admin/content/${id}/reactivate`, null, true),
    expire: (id) => API.post(`/admin/content/${id}/expire`, null, true),
    archiveContent: (id) => API.post(`/admin/content/${id}/archive`, null, true),
    restoreContent: (id) => API.post(`/admin/content/${id}/restore`, null, true),
    getExpiringSoon: (days) => API.get(`/admin/content/expiring-soon?days=${days}`, true),

    logout: () => API.post('/admin/auth/logout', null, true),
  },
};
