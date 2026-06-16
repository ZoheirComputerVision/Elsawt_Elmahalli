document.addEventListener('DOMContentLoaded', () => {
  setCurrentDate();
  loadContent();
  loadTimeline();
  loadSidebar();
  setupAutoRefresh();
});

function setCurrentDate() {
  const el = document.getElementById('current-date');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('ar-SA',{weekday:'long',calendar:'islamic'})+' '+now.toLocaleDateString('ar-SA',{day:'numeric',month:'long',calendar:'islamic'})+' '+now.toLocaleDateString('ar-SA',{year:'numeric',calendar:'islamic'})+' الموافق ل '+now.toLocaleDateString('ar-DZ',{day:'numeric',month:'long',year:'numeric'});
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

const CAT_ICONS = {
  'الوطن': '🇩🇿', 'اقتصاد': '💰', 'رياضة': '⚽', 'العالم': '🌍',
  'مجتمع': '👥', 'اسلاميات': '🕌', 'تكنولوجيا': '💻',
};

function createCard(item, featured = false) {
  const catNames = {
    'الوطن': 'الوطن', 'اقتصاد': 'اقتصاد', 'رياضة': 'رياضة', 'العالم': 'العالم',
    'مجتمع': 'مجتمع', 'اسلاميات': 'اسلاميات', 'تكنولوجيا': 'تكنولوجيا',
    news: 'خبر', activity: 'نشاط', announcement: 'إعلان', uncategorized: 'غير مصنف',
  };
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

const CATEGORY_ORDER = ['الوطن', 'اقتصاد', 'رياضة', 'العالم', 'مجتمع', 'اسلاميات', 'تكنولوجيا'];

async function loadContent() {
  const container = document.getElementById('content-grid');
  if (!container) return;

  try {
    container.innerHTML = '<div class="loading">📡 جاري تحميل المحتوى...</div>';

    const [recent, stats] = await Promise.all([
      API.getRecent(),
      API.getStats(),
    ]);

    const catPromises = CATEGORY_ORDER.map(cat => API.getContent({ category: cat, limit: 4 }));
    const catResults = await Promise.all(catPromises);

    // Featured story = first recent item
    const featured = recent[0];

    // Breaking news = items with high importance
    const breakingItems = recent.filter(i => i.importance === 'high');

    // Most important = high importance excluding featured
    const importantItems = recent.filter(i =>
      i.importance === 'high' && i.id !== featured?.id
    ).slice(0, 4);

    // Most read = fetch more items and sort by view_count
    let mostRead = [];
    try {
      const allData = await API.getContent({ limit: 30 });
      mostRead = (allData.items || []).sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 5);
    } catch (e) { /* silent */ }

    let html = '';

    // A. Breaking News Ticker
    if (breakingItems.length > 0) {
      const titles = breakingItems.map(item => item.title).join('  •  ');
      html += '<div class="breaking-news-ticker">';
      html += '  <span class="ticker-label">📢 عاجل</span>';
      html += '  <div class="ticker-track">';
      html += `    <span class="ticker-text">${titles}  •  ${titles}</span>`;
      html += '  </div>';
      html += '</div>';
    }

    // B. Featured Story + Quick Stats side-by-side
    html += '<div class="hero-stats-row">';
    html += '  <div class="hero-col">';
    if (featured) {
      html += '<div class="hero">' + createCard(featured, true) + '</div>';
    }
    html += '  </div>';
    html += '  <div class="stats-col">';
    html += '    <div class="stats-grid">';
    if (stats) {
      html += `      <div class="stat-mini"><span class="stat-num">${stats.total_published || 0}</span><span class="stat-lbl">📰 مقال منشور</span></div>`;
      // Count unique sources
      const srcCount = stats.by_category ? Object.keys(stats.by_category).length : 3;
      html += `      <div class="stat-mini"><span class="stat-num">${srcCount}</span><span class="stat-lbl">📡 مصادر رسمية</span></div>`;
      // Regions: count non-zero categories
      const regCount = Object.values(stats.by_category || {}).filter(v => v > 0).length || 1;
      html += `      <div class="stat-mini"><span class="stat-num">${regCount}</span><span class="stat-lbl">📍 تغطية جهوية</span></div>`;
      html += `      <div class="stat-mini"><span class="stat-num">🕐</span><span class="stat-lbl">${new Date().toLocaleDateString('ar-DZ',{hour:'2-digit',minute:'2-digit'})}</span></div>`;
    }
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // Start content grid
    html += '<div class="content-grid">';
    html += '  <div class="main-content">';

    // C. Most Important News section
    if (importantItems.length > 0) {
      html += '<h3 class="section-title">⭐ أهم الأخبار <span class="badge">مهمة</span></h3>';
      html += '<div class="news-grid important-grid">';
      importantItems.forEach(item => { html += createCard(item); });
      html += '</div>';
    }

    // D. Category sections by priority
    CATEGORY_ORDER.forEach((cat, idx) => {
      const data = catResults[idx];
      const items = (data.items || []).slice(0, 4);
      if (items.length === 0) return;
      const icon = CAT_ICONS[cat] || '📰';
      html += `<h3 class="section-title">${icon} ${cat} <span class="badge">${items.length}</span></h3>`;
      html += '<div class="news-grid">';
      items.forEach(item => { html += createCard(item); });
      html += '</div>';
    });

    html += '  </div>'; // close main-content
    html += '  <div class="sidebar" id="sidebar">';

    // E. Most Read in sidebar
    if (mostRead.length > 0) {
      html += '    <div class="sidebar-mostread">';
      html += '      <h3>🔥 الأكثر قراءة</h3>';
      html += '      <ul>';
      mostRead.forEach((item, i) => {
        const views = item.view_count || 0;
        html += `        <li><span class="read-rank">${i + 1}</span><a href="/article/${item.id}">${item.title}</a><span class="read-views">👁 ${views}</span></li>`;
      });
      html += '      </ul>';
      html += '    </div>';
    }

    html += '  </div>'; // close sidebar
    html += '</div>'; // close content-grid
    container.innerHTML = html;
    loadSidebar();
  } catch (e) {
    container.innerHTML = `<div class="alert alert-danger">⚠️ تعذر تحميل المحتوى: ${e.message}</div>`;
  }
}

async function loadSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  try {
    const [recent, categories] = await Promise.all([API.getRecent(), API.getCategories()]);
    const catNames = {
      'الوطن': 'الوطن', 'اقتصاد': 'اقتصاد', 'رياضة': 'رياضة', 'العالم': 'العالم',
      'مجتمع': 'مجتمع', 'اسلاميات': 'اسلاميات', 'تكنولوجيا': 'تكنولوجيا',
      news: 'أخبار', activity: 'نشاطات', announcement: 'إعلانات',
    };
    const catIcons = {
      'الوطن': '🇩🇿', 'اقتصاد': '💰', 'رياضة': '⚽', 'العالم': '🌍',
      'مجتمع': '👥', 'اسلاميات': '🕌', 'تكنولوجيا': '💻', news: '📰', activity: '📸', announcement: '📢',
    };

    const sortedCats = [...(categories || [])].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return 0;
    });

    // Append to existing sidebar content (most-read already rendered by loadContent)
    const extra = document.createElement('div');
    extra.className = 'sidebar-extra';
    extra.innerHTML = `
      <div class="sidebar-cats">
        <h3>📂 التصنيفات</h3>
        <ul>
          ${sortedCats.map(c => `<li><a href="news.html?cat=${encodeURIComponent(c.category)}">${catIcons[c.category] || '📰'} ${catNames[c.category] || c.category} (${c.count})</a></li>`).join('')}
        </ul>
      </div>
      <div class="sidebar-recent">
        <h3>🕐 آخر المنشورات</h3>
        <ul>
          ${(recent || []).slice(0, 8).map(item => `
            <li><a href="/article/${item.id}">${item.title}</a>
            <div class="date">${item.published_at ? item.published_at.split('T')[0] : item.event_date || ''} ${item.importance === 'high' ? '⭐' : ''}</div>
          `).join('')}
        </ul>
      </div>
    `;
    sidebar.appendChild(extra);
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
  const catNames = {
    'الوطن': '🇩🇿 الوطن', 'اقتصاد': '💰 اقتصاد', 'رياضة': '⚽ رياضة',
    'العالم': '🌍 العالم', 'مجتمع': '👥 مجتمع', 'اسلاميات': '🕌 اسلاميات',
    'تكنولوجيا': '💻 تكنولوجيا',
    news: '📰 الأخبار', activity: '📸 النشاطات', announcement: '📢 الإعلانات'
  };
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
