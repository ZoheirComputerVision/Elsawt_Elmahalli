document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  loadContent();
  loadStats();
  loadTimeline();
  loadSidebar();
  setupAutoRefresh();
});

function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('ar-DZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function sourceBadge(item) {
  const officialSources = ['ولاية', 'مديرية', 'محافظة', 'وزارة', 'مصالح', 'بلدية'];
  const isOfficial = officialSources.some(s => (item.source_name || '').includes(s));
  if (isOfficial) return '<span class="source-badge official">📜 رسمي</span>';

  const fbSource = ['فيسبوك', 'facebook', 'صفحة'];
  if (fbSource.some(s => (item.source_name || '').includes(s))) return '<span class="source-badge social">📱 فيسبوك</span>';
  return '<span class="source-badge auto">🤖 تلقائي</span>';
}

function importanceBadge(item) {
    if (item.importance === 'high') return ' <span class="imp-badge high">⭐ هام</span>';
  if (item.importance === 'low') return ' <span class="imp-badge low">📄 عادي</span>';
  return '';
}

function createCard(item, featured = false) {
  const catNames = { news: 'خبر', activity: 'نشاط', announcement: 'إعلان', uncategorized: 'غير مصنف' };
  const date = item.event_date || (item.published_at ? item.published_at.split('T')[0] : (item.created_at ? item.created_at.split('T')[0] : '')) || '';
  const bodyText = item.body || '';
  const cleanBody = bodyText.replace(/^[📰📸📢]\s*/, '').replace(/🗓.*?\n/, '');

  if (featured) {
    const isOfficial = item.source_name && ['ولاية', 'مديرية', 'محافظة', 'وزارة', 'مصالح'].some(s => item.source_name.includes(s));
    return `
      <div class="hero-card ${isOfficial ? 'hero-official' : ''}">
        ${item.image_data ? `<div style="margin-bottom:12px;"><img src="${item.image_data}" alt="${item.title}" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;"></div>` : item.image_url ? `<div style="margin-bottom:12px;"><img src="${item.image_url}" alt="${item.title}" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;border:1px solid #e5e7eb;"></div>` : ''}
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
          <span class="hero-category">${catNames[item.category] || 'خبر'}</span>
          ${sourceBadge(item)}
          ${item.importance === 'high' ? '<span class="hero-category" style="background:#fed7aa;color:#9a3412;">⭐ هام</span>' : ''}
        </div>
        <h2>${item.title}</h2>
        <p>${(item.summary || cleanBody).substring(0, 200)}...</p>
        <div class="hero-meta">
          <span>📅 ${date}</span>
          <span>📡 ${item.source_name || 'غير محدد'}</span>
          <span>🎯 ${Math.round((item.overall_score || 0) * 100)}% ثقة</span>
          ${item.is_ai_generated ? '<span>🧠 AI</span>' : ''}
          <span>👁 ${item.view_count || 0} مشاهدة</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="card ${item.importance === 'high' ? 'card-highlight' : ''}">
      <div class="card-body">
        ${item.image_data ? `<div style="margin-bottom:10px;"><img src="${item.image_data}" alt="${item.title}" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;"></div>` : item.image_url ? `<div style="margin-bottom:10px;"><img src="${item.image_url}" alt="${item.title}" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;"></div>` : ''}
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
          <span class="card-category ${item.category}">${catNames[item.category] || 'غير مصنف'}</span>
          ${sourceBadge(item)}
          ${importanceBadge(item)}
        </div>
        <h3><a href="/article/${item.id}">${item.title}</a></h3>
        <p>${(item.summary || cleanBody).substring(0, 150)}...</p>
        <div class="card-meta">
          <span>📅 ${date}</span>
          ${item.is_ai_generated ? '<span class="ai-tag">🧠 AI</span>' : ''}
          <span>🎯 ${Math.round((item.overall_score || 0) * 100)}%</span>
          <span>👁 ${item.view_count || 0}</span>
        </div>
      </div>
    </div>
  `;
}

async function loadContent() {
  const container = document.getElementById('content-grid');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">📡 جاري تحميل المحتوى...</div>';

    const [recent, news, activities, announcements] = await Promise.all([
      API.getRecent(),
      API.getContent({ category: 'news', limit: 6 }),
      API.getContent({ category: 'activity', limit: 4 }),
      API.getContent({ category: 'announcement', limit: 4 }),
    ]);

    let html = '<div class="content-grid">';
    html += '<div class="main-content">';

    // Hero: أهم خبر (أول منشور أو الأعلى أهمية)
    const heroItem = recent[0];
    if (heroItem) {
      html += '<div class="hero">' + createCard(heroItem, true) + '</div>';
    }

    // الأخبار الرسمية أولاً
    const officialNews = (news.items || []).filter(n =>
      n.importance === 'high' || (n.source_name && ['ولاية', 'مديرية', 'محافظة', 'وزارة', 'مصالح'].some(s => n.source_name.includes(s)))
    );
    const normalNews = (news.items || []).filter(n => !officialNews.includes(n));

    if (officialNews.length > 0) {
      html += '<h3 class="section-title">📜 أخبار رسمية <span class="badge">' + officialNews.length + '</span></h3>';
      html += '<div class="news-grid">';
      officialNews.slice(0, 3).forEach(item => { html += createCard(item); });
      html += '</div>';
    }

    if (normalNews.length > 0) {
      html += '<h3 class="section-title">📰 آخر الأخبار</h3>';
      html += '<div class="news-grid">';
      normalNews.slice(0, 3).forEach(item => { html += createCard(item); });
      html += '</div>';
    }

    html += '</div><div class="sidebar" id="sidebar"></div></div>';

    // النشاطات
    if ((activities.items || []).length > 0) {
      html += '<h3 class="section-title">📸 النشاطات الجهوية</h3>';
      html += '<div class="news-grid">';
      activities.items.slice(0, 4).forEach(item => { html += createCard(item); });
      html += '</div>';
    }

    // الإعلانات المهمة
    const importantAnn = (announcements.items || []).filter(a => a.importance === 'high' || a.overall_score >= 0.7);
    if (importantAnn.length > 0) {
      html += '<h3 class="section-title">📢 إعلانات هامة</h3>';
      html += '<div class="news-grid">';
      importantAnn.slice(0, 3).forEach(item => { html += createCard(item); });
      html += '</div>';
    }

    container.innerHTML = html;
    loadSidebar();
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ تعذر تحميل المحتوى: ${e.message}</div>`;
  }
}

async function loadStats() {
  const container = document.getElementById('stats-bar');
  if (!container) return;
  try {
    const stats = await API.getStats();
    container.innerHTML = `
      <div class="stat-card"><div class="number">${stats.total_published || 0}</div><div class="label">📰 منشورات</div></div>
      <div class="stat-card"><div class="number">${stats.by_category?.news || 0}</div><div class="label">📰 أخبار</div></div>
      <div class="stat-card"><div class="number">${stats.by_category?.activity || 0}</div><div class="label">📸 نشاطات</div></div>
      <div class="stat-card"><div class="number">${stats.by_category?.announcement || 0}</div><div class="label">📢 إعلانات</div></div>
      <div class="stat-card"><div class="number">${stats.total_ai_decisions || 0}</div><div class="label">🤖 قرارات AI</div></div>
      <div class="stat-card"><div class="number">${stats.total_views || 0}</div><div class="label">👁 مشاهدات</div></div>
    `;
  } catch (e) { /* silent */ }
}

async function loadSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  try {
    const [recent, categories] = await Promise.all([API.getRecent(), API.getCategories()]);
    const catNames = { news: 'أخبار', activity: 'نشاطات', announcement: 'إعلانات' };

    sidebar.innerHTML = `
      <div>
        <h3>📂 التصنيفات</h3>
        <ul>
          ${(categories || []).map(c => `<li><a href="/${c.category === 'news' ? 'news' : c.category === 'activity' ? 'activities' : 'announcements'}.html">${catNames[c.category] || c.category} (${c.count})</a></li>`).join('')}
        </ul>
      </div>
      <div>
        <h3>🕐 آخر المنشورات</h3>
        <ul>
          ${(recent || []).slice(0, 8).map(item => `
            <li><a href="/article/${item.id}">${item.title}</a>
            <div class="date">${item.published_at ? item.published_at.split('T')[0] : item.event_date || ''} ${item.importance === 'high' ? '⭐' : ''}</div>
          `).join('')}
        </ul>
      </div>
      <div>
        <h3>🔗 المصادر الرسمية</h3>
        <ul>
          <li><a href="https://www.wilaya-tiaret.dz/" target="_blank">🏛 ولاية تيارت</a></li>
          <li><a href="https://www.interieur.gov.dz/" target="_blank">📜 وزارة الداخلية</a></li>
        </ul>
      </div>
      <div>
        <h3>🤖 معلومات النظام</h3>
        <ul>
          <li style="font-size:0.8rem;color:#888;">يتم جمع البيانات وتحليلها آليًا</li>
          <li style="font-size:0.8rem;color:#888;">جميع المنشورات تمر عبر التحقق</li>
          <li style="font-size:0.8rem;color:#888;">آخر تحديث: ${new Date().toLocaleTimeString('ar-DZ')}</li>
        </ul>
      </div>
    `;
  } catch (e) { /* silent */ }
}

async function loadTimeline() {
  const container = document.getElementById('timeline-content');
  if (!container) return;
  try {
    container.innerHTML = '<div class="loading">📅 جاري بناء الأرشفة الزمنية...</div>';
    const timeline = await API.getTimeline();
    let html = '';
    const years = Object.keys(timeline).sort((a, b) => b.localeCompare(a));

    for (const year of years) {
      html += `<div class="year-section"><h2>📅 ${year}</h2>`;
      const months = Object.keys(timeline[year]);
      for (const month of months) {
        html += `<h3 class="month-name">${month}</h3><div class="timeline">`;
        timeline[year][month].forEach(item => {
          const date = item.event_date || (item.created_at || '').split('T')[0] || '';
          const icons = { news: '📰', activity: '📸', announcement: '📢', uncategorized: '📄' };
          html += `
            <div class="timeline-item">
              <div class="t-date">${date}</div>
              <h4>${icons[item.category] || '📄'} <a href="/article/${item.id}">${item.title}</a></h4>
              <p>${(item.summary || item.body || '').substring(0, 120)}...</p>
              <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap;">
                <span class="status-badge ${item.status}">${item.status === 'published' ? '✅ منشور' : item.status === 'rejected' ? '❌ مرفوض' : '📝 مسودة'}</span>
                ${item.importance === 'high' ? '<span class="status-badge draft" style="background:#fed7aa;color:#9a3412;">⭐ هام</span>' : ''}
              </div>
            </div>
          `;
        });
        html += '</div></div>';
      }
      html += '</div>';
    }

    if (!years.length) html = '<div class="alert alert-info">📂 لا توجد محتويات مؤرشفة بعد. سيتم ملء الأرشيف تلقائيًا عند النشر.</div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ ${e.message}</div>`;
  }
}

async function loadCategoryPage(category) {
  const container = document.getElementById('category-content');
  if (!container) return;
  const catNames = { news: '📰 الأخبار', activity: '📸 النشاطات', announcement: '📢 الإعلانات' };
  try {
    container.innerHTML = '<div class="loading">جاري التحميل...</div>';
    const data = await API.getContent({ category, limit: 50 });

    if (!data.items?.length) {
      container.innerHTML = `<div class="alert alert-info">لا توجد محتويات في "${catNames[category] || category}" بعد</div>`;
      return;
    }

    // ترتيب: الرسمي أولاً ثم الهام ثم الباقي
    const sorted = [...data.items].sort((a, b) => {
      const aScore = (a.importance === 'high' ? 100 : 0) + (a.overall_score || 0) * 50;
      const bScore = (b.importance === 'high' ? 100 : 0) + (b.overall_score || 0) * 50;
      return bScore - aScore;
    });

    let html = `<h3 class="section-title">${catNames[category] || category}</h3>`;
    html += '<div class="news-grid">';
    sorted.forEach(item => { html += createCard(item); });
    html += '</div>';
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ ${e.message}</div>`;
  }
}

function setupAutoRefresh() {
  const meta = document.querySelector('meta[data-auto-refresh]');
  const interval = parseInt(meta?.getAttribute('data-auto-refresh')) || 180000;
  setInterval(() => {
    loadContent();
    loadStats();
  }, interval);
}

function initSearch() {
  const btn = document.getElementById('search-btn');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!btn || !input) return;

  btn.addEventListener('click', async () => {
    const q = input.value.trim();
    if (q.length < 2) return;
    results.innerHTML = '<div class="loading">🔍 جاري البحث...</div>';
    try {
      const data = await API.search(q);
      if (!data.items?.length) {
        results.innerHTML = '<div class="alert alert-info">❌ لا توجد نتائج للبحث</div>';
        return;
      }
      let html = `<div class="section-title">🔍 نتائج البحث عن "${q}" <span class="badge">${data.items.length}</span></div>`;
      html += '<div class="news-grid">';
      data.items.forEach(item => { html += createCard(item); });
      html += '</div>';
      results.innerHTML = html;
    } catch (e) {
      results.innerHTML = `<div class="alert alert-danger">⚠️ ${e.message}</div>`;
    }
  });

  input.addEventListener('keypress', (e) => { if (e.key === 'Enter') btn.click(); });
}
