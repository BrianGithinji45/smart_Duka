// Smart Duka - expenses.js - FINAL FIXED v3
// Custom expense names + Net Profit - clean, no breakdown text, no Auto word

let allExpenses = [];

async function loadExpenses() {
  try {
    await openDB();
    allExpenses = await dbGetAll('expenses');
    allExpenses.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    renderExpenses(allExpenses);
    updateDashboardExpenses();
    updateCustomExpenseSuggestions();
    updateNetProfit();
    return allExpenses;
  } catch (e) {
    console.error('Load expenses failed', e);
    return [];
  }
}

function renderExpenses(list) {
  var box = document.getElementById('expenses-list');
  if (!box) return;
  if (!list || list.length === 0) {
    box.innerHTML = '<p class="muted">No expenses yet.</p>';
    return;
  }
  var html = '';
  list.slice(0, 50).forEach(function (ex) {
    var dateStr = new Date(ex.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    html += '<div class="list-row">';
    html += '<div><strong>' + escapeHtml(ex.type) + '</strong>';
    if (ex.desc) html += '<div>' + escapeHtml(ex.desc) + '</div>';
    html += '<div class="muted">' + dateStr + '</div></div>';
    html += '<div><strong>' + formatMoney(ex.amount) + '</strong><br />';
    html += '<button class="btn-secondary" onclick="deleteExpense(' + ex.id + ')">Delete</button></div>';
    html += '</div>';
  });
  box.innerHTML = html;
}

async function handleAddExpense(e) {
  if (e) e.preventDefault();
  var typeEl = document.getElementById('expense-type');
  var type = typeEl ? (typeEl.value || '').trim() : '';
  var descEl = document.getElementById('expense-desc');
  var desc = descEl ? descEl.value.trim() : '';
  var amountEl = document.getElementById('expense-amount');
  var amount = amountEl ? Number(amountEl.value) : 0;
  var dateEl = document.getElementById('expense-date');
  var date = dateEl && dateEl.value ? dateEl.value : getTodayISO();

  if (!type) { showToast('Enter expense name - e.g. Transport, Water, Security'); return; }
  if (!amount || amount <= 0) { showToast('Amount must be more than 0'); return; }

  try {
    await dbAdd('expenses', {
      type: type,
      desc: desc || type,
      amount: amount,
      date: date,
      createdAt: new Date().toISOString()
    });
    saveCustomExpenseType(type);
    await logActivity('Expense added', type + ' - ' + formatMoney(amount) + (desc ? ' - ' + desc : ''));
    var form = document.getElementById('expense-form');
    if (form) form.reset();
    if (dateEl) dateEl.value = getTodayISO();
    await loadExpenses();
    if (typeof loadReports === 'function') loadReports();
    showToast('Expense saved: ' + type + ' - ' + formatMoney(amount));
  } catch (err) {
    console.error(err);
    showToast('Failed to save expense');
  }
}

async function deleteExpense(id) {
  var ex = allExpenses.find(function (x) { return x.id === id; });
  if (!ex) return;
  if (!confirm('Delete expense ' + ex.type + ' - ' + formatMoney(ex.amount) + '?')) return;
  try {
    await dbDelete('expenses', id);
    await logActivity('Deleted expense', ex.type + ' - ' + formatMoney(ex.amount));
    await loadExpenses();
    if (typeof loadReports === 'function') loadReports();
    showToast('Deleted expense');
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
}

// Custom names remembered
function saveCustomExpenseType(type) {
  try {
    var saved = JSON.parse(localStorage.getItem('smartduka-expense-types') || '[]');
    if (saved.indexOf(type) === -1) {
      saved.push(type);
      if (saved.length > 30) saved = saved.slice(-30);
      localStorage.setItem('smartduka-expense-types', JSON.stringify(saved));
    }
    updateCustomExpenseSuggestions();
  } catch (e) {}
}

function updateCustomExpenseSuggestions() {
  var datalist = document.getElementById('expense-types-list');
  if (!datalist) return;
  try {
    var saved = JSON.parse(localStorage.getItem('smartduka-expense-types') || '[]');
    var all = {};
    datalist.querySelectorAll('option').forEach(function (opt) { all[opt.value] = true; });
    saved.forEach(function (t) { all[t] = true; });
    datalist.innerHTML = '';
    Object.keys(all).forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t;
      datalist.appendChild(opt);
    });
  } catch (e) {}
}

function updateDashboardExpenses() {
  var todayISO = getTodayISO();
  var today = allExpenses.filter(function (ex) { return ex.createdAt.slice(0, 10) === todayISO; });
  var todayTotal = today.reduce(function (sum, ex) { return sum + Number(ex.amount); }, 0);
  var now = new Date();
  var thisMonth = allExpenses.filter(function (ex) {
    var d = new Date(ex.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  var monthTotal = thisMonth.reduce(function (sum, ex) { return sum + Number(ex.amount); }, 0);

  var dashExp = document.getElementById('dash-expenses');
  if (dashExp) dashExp.textContent = formatMoney(todayTotal);
  var dashCount = document.getElementById('dash-expense-count');
  if (dashCount) dashCount.textContent = today.length + ' expenses';
  var expToday = document.getElementById('expenses-today');
  if (expToday) expToday.textContent = formatMoney(todayTotal);
  var expMonth = document.getElementById('expenses-month');
  if (expMonth) expMonth.textContent = formatMoney(monthTotal);

  updateNetProfit();
}

// AUTO NET PROFIT - FIXED: No breakdown text, just the numbers
function updateNetProfit() {
  var salesList = (typeof allSales !== 'undefined' && allSales) ? allSales : [];
  var todayISO = getTodayISO();
  var todaySales = salesList.filter(function (s) { return s.createdAt.slice(0, 10) === todayISO; });
  var revenueToday = todaySales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
  var cogsToday = todaySales.reduce(function (sum, s) {
    if (s.cogs !== undefined) return sum + Number(s.cogs || 0);
    var itemsCogs = (s.items || []).reduce(function (isum, it) {
      return isum + (Number(it.qty || 0) * Number(it.buyingPrice || it.buyPrice || 0));
    }, 0);
    return sum + itemsCogs;
  }, 0);
  var grossToday = revenueToday - cogsToday;
  var todayExpenses = allExpenses.filter(function (ex) { return ex.createdAt.slice(0, 10) === todayISO; });
  var expensesToday = todayExpenses.reduce(function (sum, ex) { return sum + Number(ex.amount); }, 0);
  var netToday = grossToday - expensesToday;

  // Dashboard
  var dashNet = document.getElementById('dash-net-profit');
  if (dashNet) dashNet.textContent = formatMoney(netToday);
  var dashProfit = document.getElementById('dash-profit');
  if (dashProfit) dashProfit.textContent = formatMoney(grossToday);

  // Expenses tab
  var expNet = document.getElementById('expenses-net-today');
  if (expNet) expNet.textContent = formatMoney(netToday);

  // Reports tab
  var repRev = document.getElementById('report-revenue');
  if (repRev) repRev.textContent = formatMoney(revenueToday);
  var repCogs = document.getElementById('report-cogs');
  if (repCogs) repCogs.textContent = formatMoney(cogsToday);
  var repGross = document.getElementById('report-gross');
  if (repGross) repGross.textContent = formatMoney(grossToday);
  var repExp = document.getElementById('report-expenses');
  if (repExp) repExp.textContent = formatMoney(expensesToday);
  var repNet = document.getElementById('report-net');
  if (repNet) repNet.textContent = formatMoney(netToday);

  window._todayNetProfit = netToday;
  window._todayGrossProfit = grossToday;
  window._todayExpenses = expensesToday;
  window._todayRevenue = revenueToday;
  return netToday;
}

document.addEventListener('DOMContentLoaded', function () {
  var expenseForm = document.getElementById('expense-form');
  if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);
  updateCustomExpenseSuggestions();
  setTimeout(function () { loadExpenses(); }, 700);
});