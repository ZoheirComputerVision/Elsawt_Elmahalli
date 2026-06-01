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
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
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

  // Admin API
  admin: {
    login: (username, password) => API.post('/admin/auth', { username, password }),
    dashboard: () => API.get('/admin/dashboard'),
    getContent: (params) => API.get(`/admin/content?${new URLSearchParams(params).toString()}`),
    getContentById: (id) => API.get(`/admin/content/${id}`),
    approve: (id) => API.post(`/admin/content/${id}/approve`),
    reject: (id, reason) => API.post(`/admin/content/${id}/reject`, { reason }),
    generate: (id) => API.post(`/admin/content/${id}/generate`),
    delete: (id) => API.post(`/admin/content/${id}/delete`),
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
  },
};
