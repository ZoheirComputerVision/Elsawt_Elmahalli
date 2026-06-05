const API = {
  base: '/api',

  async get(endpoint) {
    const res = await fetch(this.base + endpoint);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  },

  async post(endpoint, data) {
    const res = await fetch(this.base + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  trackView: (id) => API.post(`/content/${id}/view`),

  // Admin API
  admin: {
    login: (username, password) => API.post('/admin/auth', { username, password }),
    dashboard: () => API.get('/admin/dashboard'),
    getContent: (params) => API.get(`/admin/content?${new URLSearchParams(params).toString()}`),
    getContentById: (id) => API.get(`/admin/content/${id}`),
    approve: (id) => API.post(`/admin/content/${id}/approve`),
    reject: (id, reason) => API.post(`/admin/content/${id}/reject`, { reason }),
    generate: (id) => API.post(`/admin/content/${id}/generate`),
    removeItem: (id) => API.post(`/admin/content/${id}/delete`),
    updateItem: (id, data) => API.post(`/admin/content/${id}/update`, data),
    collect: () => API.post('/admin/collect'),
    collectManual: (data) => API.post('/admin/collect/manual', data),
    analyze: () => API.post('/admin/analyze'),
    publish: () => API.post('/admin/publish'),
    getLogs: (params) => API.get(`/admin/logs?${new URLSearchParams(params).toString()}`),
    getSettings: () => API.get('/admin/settings'),
    updateSetting: (key, value) => API.post('/admin/settings', { key, value }),
    exportArchive: () => API.post('/admin/archive/export'),
    getTimeline: () => API.get('/admin/archive/timeline'),
    getSources: () => API.get('/admin/sources'),
    runCollector: () => API.post('/admin/scheduler/run-collector'),
    fbComment: (id, message) => API.post(`/admin/content/${id}/fb-comment`, { message }),
    fbShare: (id, message) => API.post(`/admin/content/${id}/fb-share`, { message }),
    getFbReplies: (contentId) => API.get(`/admin/fb-replies${contentId ? `?content_id=${contentId}` : ''}`),
  },
};
