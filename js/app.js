// Smart Duka - app.js - FINAL v3 + Phase 8 + 9 + 10
// Centered header + Global Search + Dark Default + Smart Greeting + Active Nav + IndexedDB + Products + Sales

// Show one screen, hide others + highlight nav button
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function (screen) {
    screen.classList.remove('active');
  });

  const target = document.getElementById(screenId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  } else {
    console.error('Screen not found:', screenId);
    return;
  }

  document.querySelectorAll('nav button').forEach(function (btn) {
    if (btn.getAttribute('data-screen') === screenId) {
      btn.classList.add('nav-active');
    } else {
      btn.classList.remove('nav-active');
    }
  });

  hideGlobalResults();
}

// Greeting changes by time of day
function updateGreeting() {
  const el = document.getElementById('greeting');
  if (!el) return;
  const hour = new Date().getHours();
  let greeting = 'Good morning. How is business today?';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon. How is business today?';
  } else if (hour >= 17 || hour < 5) {
    greeting = 'Good evening. How is business today?';
  }
  el.textContent = greeting;
}

function showTodayDate() {
  const el = document.getElementById('today-date');
  if (!el) return;
  const today = new Date();
  el.textContent = today.toLocaleDateString('en-KE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function applyTheme(theme) {
  const btn = document.getElementById('theme-btn');
  if (theme === 'light') {
    document.body.classList.remove('dark');
    if (btn) btn.textContent = 'Dark Mode';
  } else {
    document.body.classList.add('dark');
    if (btn) btn.textContent = 'Light Mode';
  }
  try { localStorage.setItem('smartduka-theme', theme); } catch (e) {}
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark');
  applyTheme(isDark ? 'light' : 'dark');
  showToast(isDark ? 'Switched to Light Mode' : 'Switched to Dark Mode');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden');
  if (toast._timer) clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.classList.add('hidden');
  }, 3000);
}

function formatMoney(amount) {
  const num = Number(amount) || 0;
  return 'KSh ' + num.toLocaleString('en-KE', { maximumFractionDigits: 2 });
}

function getTodayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// =====================================================
// GLOBAL SEARCH - Search Anything
// =====================================================

function getSearchableData() {
  const items = [];

  const shortcuts = [
    { title: 'Record New Sale', detail: 'Sell products to a customer', tag: 'Sell', screen: 'screen-sales' },
    { title: 'My Stock / Products', detail: 'Add product, check stock', tag: 'Stock', screen: 'screen-products' },
    { title: 'People Who Owe Me (Deni)', detail: 'See who owes you, record payment', tag: 'Deni', screen: 'screen-debts' },
    { title: 'Loans', detail: 'Loans you gave / loans you took', tag: 'Loans', screen: 'screen-loans' },
    { title: 'Expenses', detail: 'Transport, rent, tokens', tag: 'Expenses', screen: 'screen-expenses' },
    { title: 'Reports & Daily Closing', detail: 'Profit, revenue, close day', tag: 'Reports', screen: 'screen-reports' },
    { title: 'Backup & Restore', detail: 'Download backup, restore data', tag: 'Backup', screen: 'screen-backup' },
    { title: 'Dashboard / Home', detail: 'Today sales, profit, low stock', tag: 'Home', screen: 'screen-dashboard' },
  ];
  shortcuts.forEach(function (s) { items.push(s); });

  document.querySelectorAll('#products-body tr').forEach(function (row) {
    const text = row.innerText.trim();
    if (!text || text.includes('No products yet')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Product in Stock - ' + text.replace(/\n/g, ' | '), tag: 'Stock', screen: 'screen-products' });
  });

  document.querySelectorAll('#debts-list > *').forEach(function (el) {
    const text = el.innerText.trim();
    if (!text || text.includes('No debts yet')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Deni - ' + text.replace(/\n/g, ' | ').slice(0, 80), tag: 'Deni', screen: 'screen-debts' });
  });

  document.querySelectorAll('#loans-list > *').forEach(function (el) {
    const text = el.innerText.trim();
    if (!text || text.includes('No loans yet')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Loan - ' + text.replace(/\n/g, ' | ').slice(0, 80), tag: 'Loans', screen: 'screen-loans' });
  });

  document.querySelectorAll('#expenses-list > *').forEach(function (el) {
    const text = el.innerText.trim();
    if (!text || text.includes('No expenses yet')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Expense - ' + text.replace(/\n/g, ' | ').slice(0, 80), tag: 'Expenses', screen: 'screen-expenses' });
  });

  document.querySelectorAll('#sales-history-list > *').forEach(function (el) {
    const text = el.innerText.trim();
    if (!text || text.includes('No sales yet')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Sale - ' + text.replace(/\n/g, ' | ').slice(0, 80), tag: 'Sales', screen: 'screen-sales' });
  });

  document.querySelectorAll('#low-stock-list > *').forEach(function (el) {
    const text = el.innerText.trim();
    if (!text || text.includes('No low stock')) return;
    items.push({ title: text.split('\n')[0] || text, detail: 'Low Stock - ' + text, tag: 'Stock', screen: 'screen-products' });
  });

  return items;
}

function renderGlobalResults(query) {
  const box = document.getElementById('global-results');
  const clearBtn = document.getElementById('global-search-clear');
  if (!box) return;

  if (!query || query.trim().length === 0) {
    box.classList.add('hidden');
    if (clearBtn) clearBtn.classList.remove('visible');
    return;
  }

  if (clearBtn) clearBtn.classList.add('visible');
  const q = query.toLowerCase().trim();
  const all = getSearchableData();
  const matches = all.filter(function (item) {
    return (item.title + ' ' + item.detail).toLowerCase().includes(q);
  }).slice(0, 8);

  if (matches.length === 0) {
    box.innerHTML = '<div class="global-empty">No results for "' + query + '".<br>Try product name, customer name, or "deni", "stock", "loan".</div>';
    box.classList.remove('hidden');
    return;
  }

  let html = '';
  matches.forEach(function (item) {
    html += '<div class="global-result-item" onclick="goToSearchResult(\'' + item.screen + '\')">';
    html += '<div><strong>' + item.title + '</strong><small>' + item.detail + '</small></div>';
    html += '<span class="global-result-tag">' + item.tag + '</span>';
    html += '</div>';
  });
  html += '<div class="global-hint">Tap a result to go to that screen. Press Enter for first result.</div>';
  box.innerHTML = html;
  box.classList.remove('hidden');
}

function hideGlobalResults() {
  const box = document.getElementById('global-results');
  if (box) box.classList.add('hidden');
}

function clearGlobalSearch() {
  const input = document.getElementById('global-search');
  if (input) input.value = '';
  const clearBtn = document.getElementById('global-search-clear');
  if (clearBtn) clearBtn.classList.remove('visible');
  hideGlobalResults();
  if (input) input.focus();
}

function goToSearchResult(screenId) {
  clearGlobalSearch();
  showScreen(screenId);
}

function quickSearch(word) {
  const input = document.getElementById('global-search');
  if (!input) return;
  input.value = word;
  renderGlobalResults(word);
  input.focus();
}

function setupGlobalSearch() {
  const input = document.getElementById('global-search');
  if (!input) return;

  input.addEventListener('input', function () {
    renderGlobalResults(input.value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = document.querySelector('.global-result-item');
      if (first) first.click();
    }
    if (e.key === 'Escape') {
      clearGlobalSearch();
      input.blur();
    }
  });

  document.addEventListener('click', function (e) {
    const wrap = document.querySelector('.global-search-wrap');
    if (wrap && !wrap.contains(e.target)) hideGlobalResults();
  });

  document.addEventListener('keydown', function (e) {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      input.focus();
    }
  });
}

// =====================================================
// START APP - Phase 8 + 9 + 10
// Order matters: DB -> Products -> Sales -> Debts
// =====================================================
document.addEventListener('DOMContentLoaded', function () {
  // 1. Theme - Dark by default, remember choice
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('smartduka-theme') || 'dark';
  } catch (e) { savedTheme = 'dark'; }
  applyTheme(savedTheme);

  // 2. Greeting + Date
  updateGreeting();
  showTodayDate();

  // 3. Global Search
  setupGlobalSearch();

  // 4. Default dates in forms
  const ids = ['debt-date', 'loan-date', 'expense-date', 'report-from', 'report-to'];
  ids.forEach(function (id) {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = getTodayISO();
  });

  // 5. Open DB (Phase 8) then load in order: Products -> Sales -> Debts
  if (typeof openDB === 'function') {
    openDB().then(function () {
      console.log('Smart Duka ready - DB open');
      // Products first - Sales needs products for stock check
      if (typeof loadProducts === 'function') {
        loadProducts().then(function () {
          // Sales second - needs products loaded
          if (typeof loadSales === 'function') loadSales();
          // Debts third - will be used in Phase 11
          if (typeof loadDebts === 'function') loadDebts();
          // Expenses / Loans / Reports load in their own files too
          if (typeof loadExpenses === 'function') loadExpenses();
          if (typeof loadLoans === 'function') loadLoans();
        });
      }
    }).catch(function (e) {
      console.error('DB failed to open', e);
      showToast('Database failed to open. Check console (F12).');
    });
  } else {
    console.error('openDB not found - check js/db.js is loaded before app.js');
  }

  console.log('Smart Duka v3 + Phase 8 + 9 + 10 loaded');
});