// Smart Duka - app.js - FINAL FIXED for YOUR v3 HTML
// Your HTML uses: showScreen('screen-dashboard'), theme-btn, nav-active, today-date, greeting

function showScreen(screenId) {
  // Accept both 'dashboard' and 'screen-dashboard'
  var id = screenId;
  if (id.indexOf('screen-') !== 0) id = 'screen-' + id;

  // Hide all screens
  document.querySelectorAll('.screen').forEach(function (s) {
    s.classList.remove('active');
  });
  var target = document.getElementById(id);
  if (target) target.classList.add('active');

  // Nav highlight - your HTML uses .nav-active on nav buttons
  document.querySelectorAll('nav button').forEach(function (b) {
    if (b.getAttribute('data-screen') === id) {
      b.classList.add('nav-active');
    } else {
      b.classList.remove('nav-active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh the screen we just opened
  if (id === 'screen-dashboard' && typeof refreshDashboard === 'function') refreshDashboard();
  if (id === 'screen-products' && typeof loadProducts === 'function') loadProducts();
  if (id === 'screen-sales' && typeof loadSales === 'function') loadSales();
  if (id === 'screen-debts' && typeof loadDebts === 'function') loadDebts();
  if (id === 'screen-loans' && typeof loadLoans === 'function') loadLoans();
  if (id === 'screen-expenses' && typeof loadExpenses === 'function') loadExpenses();
  if (id === 'screen-reports' && typeof loadReports === 'function') loadReports();
}

function formatMoney(n) {
  var num = Number(n || 0);
  return 'KSh ' + num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getTodayISO() {
  var d = new Date();
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, '0');
  var day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function showToast(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.add('hidden'); }, 3000);
}

async function logActivity(title, detail) {
  try {
    await logAudit(title, detail);
    await loadRecentActivity();
  } catch (e) {}
}

async function loadRecentActivity() {
  try {
    await openDB();
    var items = await dbGetAll('audit');
    items.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    // Your HTML has audit-list in Backup, not recent-activity on Dashboard
    // We also fill recent-sales on Dashboard from sales.js, so this is for Backup
    var box = document.getElementById('audit-list');
    if (!box) return;
    if (items.length === 0) { box.innerHTML = '<p class="muted">No activity yet.</p>'; return; }
    var html = '';
    items.slice(0, 20).forEach(function (it) {
      var time = new Date(it.createdAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      html += '<div class="list-row"><div><strong>' + escapeHtml(it.action || it.title || 'Activity') + '</strong><div class="muted">' + escapeHtml(it.detail || '') + '</div></div><div class="muted">' + time + '</div></div>';
    });
    box.innerHTML = html;
  } catch (e) {}
}

function updateGreeting() {
  var h = new Date().getHours();
  var greet = 'Good evening. How is business today?';
  if (h < 12) greet = 'Good morning. How is business today?';
  else if (h < 17) greet = 'Good afternoon. How is business today?';

  var el = document.getElementById('greeting');
  if (el) el.textContent = greet;

  var dateEl = document.getElementById('today-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // Also support old dash-date if present
  var dashDate = document.getElementById('dash-date');
  if (dashDate) dashDate.textContent = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Theme - Dark by default - Your HTML button is id="theme-btn"
function applyTheme(theme) {
  var body = document.body;
  var btn = document.getElementById('theme-btn');
  // Also support old id if present
  if (!btn) btn = document.getElementById('theme-toggle');
  if (theme === 'light') {
    body.classList.remove('dark');
    if (btn) btn.textContent = 'Dark Mode';
  } else {
    body.classList.add('dark');
    if (btn) btn.textContent = 'Light Mode';
  }
  try { localStorage.setItem('smartduka-theme', theme); } catch (e) {}
}

function toggleTheme() {
  var isDark = document.body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
}

function refreshDashboard() {
  if (typeof loadProducts === 'function') loadProducts();
  if (typeof loadSales === 'function') loadSales();
  if (typeof loadDebts === 'function') loadDebts();
  if (typeof loadLoans === 'function') loadLoans();
  if (typeof loadExpenses === 'function') loadExpenses();
  loadRecentActivity();
}

// ============ GLOBAL SEARCH ============
// Your HTML: global-search, global-search-clear, global-results (class hidden)

function clearGlobalSearch() {
  var inp = document.getElementById('global-search');
  if (inp) inp.value = '';
  var res = document.getElementById('global-results');
  if (res) { res.classList.add('hidden'); res.innerHTML = ''; }
}

function quickSearch(term) {
  var inp = document.getElementById('global-search');
  if (inp) { inp.value = term; inp.dispatchEvent(new Event('input')); inp.focus(); }
}

function doGlobalSearch(query) {
  var box = document.getElementById('global-results');
  if (!box) return;
  var q = (query || '').toLowerCase().trim();
  if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }

  var results = [];

  (typeof allProducts !== 'undefined' && allProducts ? allProducts : []).forEach(function (p) {
    if ((p.name + ' ' + (p.category || '')).toLowerCase().includes(q)) {
      results.push({ label: p.name + ' • Stock: ' + p.qty + ' • ' + formatMoney(p.sellingPrice), screen: 'screen-products', hint: 'Product' });
    }
  });
  (typeof allDebts !== 'undefined' && allDebts ? allDebts : []).forEach(function (d) {
    var name = d.person || d.name || '';
    if ((name + ' ' + (d.note || '') + ' ' + (d.items || '')).toLowerCase().includes(q)) {
      results.push({ label: name + ' • Deni: ' + formatMoney(d.balance) + ' • ' + d.status, screen: 'screen-debts', hint: 'Deni' });
    }
  });
  (typeof allLoans !== 'undefined' && allLoans ? allLoans : []).forEach(function (l) {
    if ((l.person + ' ' + (l.note || '')).toLowerCase().includes(q)) {
      results.push({ label: l.person + ' • Loan: ' + formatMoney(l.balance) + ' • ' + (l.type === 'given' ? 'I Gave' : 'I Took'), screen: 'screen-loans', hint: 'Loan' });
    }
  });
  (typeof allExpenses !== 'undefined' && allExpenses ? allExpenses : []).forEach(function (e) {
    if ((e.type + ' ' + (e.desc || '')).toLowerCase().includes(q)) {
      results.push({ label: e.type + ' • ' + formatMoney(e.amount) + ' • ' + (e.desc || ''), screen: 'screen-expenses', hint: 'Expense' });
    }
  });

  if (q.includes('low stock') || q === 'low') {
    (typeof allProducts !== 'undefined' && allProducts ? allProducts : []).filter(function (p) { return Number(p.qty) <= Number(p.lowAt || p.low || 5); }).forEach(function (p) {
      results.push({ label: p.name + ' • LOW: ' + p.qty + ' left', screen: 'screen-products', hint: 'Low Stock' });
    });
  }

  if (results.length === 0) {
    box.innerHTML = '<div class="list-row">No results for "' + escapeHtml(query) + '"</div>';
  } else {
    var html = '';
    results.slice(0, 12).forEach(function (r) {
      html += '<div class="list-row" onclick="goToSearchResult(\'' + r.screen + '\')"><div><strong>[' + r.hint + ']</strong> ' + escapeHtml(r.label) + '</div></div>';
    });
    box.innerHTML = html;
  }
  box.classList.remove('hidden');
}

function goToSearchResult(screen) {
  clearGlobalSearch();
  showScreen(screen);
}

document.addEventListener('DOMContentLoaded', function () {
  // Theme - dark by default
  var savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('smartduka-theme') || 'dark'; } catch (e) {}
  applyTheme(savedTheme);

  updateGreeting();
  setInterval(updateGreeting, 60000);

  // Dates defaults - your HTML IDs
  var debtDate = document.getElementById('debt-date');
  if (debtDate) debtDate.value = getTodayISO();
  var loanDate = document.getElementById('loan-date');
  if (loanDate) loanDate.value = getTodayISO();
  var expDate = document.getElementById('expense-date');
  if (expDate) expDate.value = getTodayISO();
  var reportFrom = document.getElementById('report-from');
  if (reportFrom) reportFrom.value = getTodayISO();
  var reportTo = document.getElementById('report-to');
  if (reportTo) reportTo.value = getTodayISO();

  // Theme button - your HTML uses onclick="toggleTheme()" already, but also bind here as backup
  var themeBtn = document.getElementById('theme-btn');
  if (themeBtn && !themeBtn._bound) {
    themeBtn._bound = true;
    // onclick in HTML already calls toggleTheme, so don't double-bind
  }

  // Global search wiring - your HTML uses onclick for clear, input event here
  var gSearch = document.getElementById('global-search');
  if (gSearch) {
    gSearch.addEventListener('input', function () { doGlobalSearch(gSearch.value); });
    gSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') clearGlobalSearch();
      if (e.key === 'Enter') {
        var first = document.querySelector('#global-results .list-row');
        if (first) first.click();
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      var inp = document.getElementById('global-search');
      if (inp) inp.focus();
    }
  });
  document.addEventListener('click', function (e) {
    var wrap = document.querySelector('.global-search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      var res = document.getElementById('global-results');
      if (res) res.classList.add('hidden');
    }
  });

  // Initial load
  setTimeout(function () { refreshDashboard(); }, 800);
});