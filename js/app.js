// Smart Duka - app.js - FINAL v3 + Phase 8-13.5
// Dashboard, Theme, Navigation, Global Search, Helpers

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-screen') === name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Refresh the screen we just opened
  if (name === 'dashboard' && typeof refreshDashboard === 'function') refreshDashboard();
  if (name === 'products' && typeof loadProducts === 'function') loadProducts();
  if (name === 'sales' && typeof loadSales === 'function') loadSales();
  if (name === 'debts' && typeof loadDebts === 'function') loadDebts();
  if (name === 'loans' && typeof loadLoans === 'function') loadLoans();
  if (name === 'expenses' && typeof loadExpenses === 'function') loadExpenses();
}

function formatMoney(n) {
  const num = Number(n || 0);
  return 'KSh ' + num.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function showToast(msg) {
  let el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.style.display = 'none'; }, 3000);
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
    const items = await dbGetAll('audit');
    items.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    const box = document.getElementById('recent-activity');
    if (!box) return;
    if (items.length === 0) { box.innerHTML = '<p class="muted">No activity yet.</p>'; return; }
    let html = '';
    items.slice(0, 10).forEach(function (it) {
      const time = new Date(it.createdAt).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      html += '<div style="padding:8px 0;border-bottom:1px solid var(--border)"><strong>' + escapeHtml(it.action || it.title || 'Activity') + '</strong><div style="font-size:13px;color:var(--text-muted)">' + escapeHtml(it.detail || '') + ' • ' + time + '</div></div>';
    });
    box.innerHTML = html;
  } catch (e) {}
}

function updateGreeting() {
  const h = new Date().getHours();
  let greet = 'Good Evening, Boss';
  if (h < 12) greet = 'Good Morning, Boss';
  else if (h < 17) greet = 'Good Afternoon, Boss';
  const el = document.getElementById('greeting');
  if (el) el.textContent = greet;
  const dateEl = document.getElementById('dash-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Theme - Dark by default
function applyTheme(theme) {
  const body = document.body;
  const btn = document.getElementById('theme-toggle');
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
  const isDark = document.body.classList.contains('dark');
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
function clearGlobalSearch() {
  const inp = document.getElementById('global-search');
  if (inp) inp.value = '';
  const res = document.getElementById('global-results');
  if (res) { res.style.display = 'none'; res.innerHTML = ''; }
}

function quickSearch(term) {
  const inp = document.getElementById('global-search');
  if (inp) { inp.value = term; inp.dispatchEvent(new Event('input')); inp.focus(); }
}

function doGlobalSearch(query) {
  const box = document.getElementById('global-results');
  if (!box) return;
  const q = (query || '').toLowerCase().trim();
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }

  let results = [];

  // Products
  (typeof allProducts !== 'undefined' ? allProducts : []).forEach(function (p) {
    if ((p.name + ' ' + (p.category || '')).toLowerCase().includes(q)) {
      results.push({ label: p.name + ' • Stock: ' + p.qty + ' • ' + formatMoney(p.sellingPrice), screen: 'products', hint: 'Product' });
    }
  });
  // Debts
  (typeof allDebts !== 'undefined' ? allDebts : []).forEach(function (d) {
    if ((d.person + ' ' + (d.note || '')).toLowerCase().includes(q)) {
      results.push({ label: d.person + ' • Deni: ' + formatMoney(d.balance) + ' • ' + d.status, screen: 'debts', hint: 'Deni' });
    }
  });
  // Loans
  (typeof allLoans !== 'undefined' ? allLoans : []).forEach(function (l) {
    if ((l.person + ' ' + (l.note || '')).toLowerCase().includes(q)) {
      results.push({ label: l.person + ' • Loan: ' + formatMoney(l.balance) + ' • ' + (l.type === 'given' ? 'I Gave' : 'I Took'), screen: 'loans', hint: 'Loan' });
    }
  });
  // Expenses
  (typeof allExpenses !== 'undefined' ? allExpenses : []).forEach(function (e) {
    if ((e.type + ' ' + (e.desc || '')).toLowerCase().includes(q)) {
      results.push({ label: e.type + ' • ' + formatMoney(e.amount) + ' • ' + (e.desc || ''), screen: 'expenses', hint: 'Expense' });
    }
  });

  if (q.includes('low stock') || q === 'low') {
    (typeof allProducts !== 'undefined' ? allProducts : []).filter(function (p) { return Number(p.qty) <= Number(p.lowAt || 5); }).forEach(function (p) {
      results.push({ label: p.name + ' • LOW: ' + p.qty + ' left', screen: 'products', hint: 'Low Stock' });
    });
  }

  if (results.length === 0) {
    box.innerHTML = '<div style="padding:12px">No results for "' + escapeHtml(query) + '"</div>';
  } else {
    let html = '';
    results.slice(0, 12).forEach(function (r) {
      html += '<div class="search-result-item" onclick="goToSearchResult(\'' + r.screen + '\')" style="padding:10px 12px;border-bottom:1px solid var(--border);cursor:pointer"><strong>[' + r.hint + ']</strong> ' + escapeHtml(r.label) + '</div>';
    });
    box.innerHTML = html;
  }
  box.style.display = 'block';
}

function goToSearchResult(screen) {
  clearGlobalSearch();
  showScreen(screen);
}

document.addEventListener('DOMContentLoaded', function () {
  // Theme
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('smartduka-theme') || 'dark'; } catch (e) {}
  applyTheme(savedTheme);

  updateGreeting();
  setInterval(updateGreeting, 60000);

  // Dates defaults
  const debtDate = document.getElementById('debt-date');
  if (debtDate) debtDate.value = getTodayISO();
  const loanDate = document.getElementById('loan-date');
  if (loanDate) loanDate.value = getTodayISO();
  const expDate = document.getElementById('expense-date');
  if (expDate) expDate.value = getTodayISO();

  // Global search wiring
  const gSearch = document.getElementById('global-search');
  if (gSearch) {
    gSearch.addEventListener('input', function () { doGlobalSearch(gSearch.value); });
    gSearch.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') clearGlobalSearch();
      if (e.key === 'Enter') {
        const first = document.querySelector('.search-result-item');
        if (first) first.click();
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const inp = document.getElementById('global-search');
      if (inp) inp.focus();
    }
  });
  document.addEventListener('click', function (e) {
    const wrap = document.querySelector('.search-wrap');
    if (wrap && !wrap.contains(e.target)) {
      const res = document.getElementById('global-results');
      if (res) res.style.display = 'none';
    }
  });

  // Initial load
  setTimeout(function () { refreshDashboard(); }, 800);
});