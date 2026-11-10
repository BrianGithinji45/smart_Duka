// Smart Duka - reports.js - PHASE 14
// Matches YOUR index.html:
// report-from, report-to, report-filter-btn, report-today-btn, report-week-btn, report-month-btn
// report-revenue, report-cogs, report-gross, report-expenses, report-net
// closing-list, closing-cash, closing-mpesa, closing-notes, close-day-btn, closed-days-list

let currentReportFrom = null;
let currentReportTo = null;
let currentClosingCounts = {}; // { productId: countedQty }

async function loadReports() {
  try {
    await openDB();
    // Default: Today
    if (!currentReportFrom || !currentReportTo) {
      var today = getTodayISO();
      currentReportFrom = today;
      currentReportTo = today;
    }
    await showReport(currentReportFrom, currentReportTo);
    await renderClosingList();
    await renderClosedDays();
    return true;
  } catch (e) {
    console.error('Load reports failed', e);
    return false;
  }
}

async function showReport(fromISO, toISO) {
  currentReportFrom = fromISO;
  currentReportTo = toISO;

  var fromEl = document.getElementById('report-from');
  if (fromEl) fromEl.value = fromISO;
  var toEl = document.getElementById('report-to');
  if (toEl) toEl.value = toISO;

  try {
    await openDB();
    var sales = await dbGetAll('sales');
    var expenses = await dbGetAll('expenses');

    // Filter by date: createdAt.slice(0,10) between from and to
    var filteredSales = sales.filter(function (s) {
      var d = (s.createdAt || '').slice(0, 10);
      return d >= fromISO && d <= toISO;
    });
    var filteredExpenses = expenses.filter(function (ex) {
      var d = (ex.createdAt || '').slice(0, 10);
      return d >= fromISO && d <= toISO;
    });

    var revenue = filteredSales.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
    var cogs = filteredSales.reduce(function (sum, s) { return sum + Number(s.cogs || 0); }, 0);
    var gross = revenue - cogs;
    var expensesTotal = filteredExpenses.reduce(function (sum, ex) { return sum + Number(ex.amount || 0); }, 0);
    var net = gross - expensesTotal;

    // Collected = paid (for closing info)
    var collected = filteredSales.reduce(function (sum, s) { return sum + Number(s.paid || 0); }, 0);
    var deniCreated = filteredSales.reduce(function (sum, s) { return sum + Number(s.balance || 0); }, 0);

    var revEl = document.getElementById('report-revenue');
    if (revEl) revEl.textContent = formatMoney(revenue);
    var cogsEl = document.getElementById('report-cogs');
    if (cogsEl) cogsEl.textContent = formatMoney(cogs);
    var grossEl = document.getElementById('report-gross');
    if (grossEl) grossEl.textContent = formatMoney(gross);
    var expEl = document.getElementById('report-expenses');
    if (expEl) expEl.textContent = formatMoney(expensesTotal);
    var netEl = document.getElementById('report-net');
    if (netEl) netEl.textContent = formatMoney(net);

    // Also update dashboard net if this report is Today
    if (fromISO === getTodayISO() && toISO === getTodayISO()) {
      if (typeof updateNetProfit === 'function') updateNetProfit();
    }

    // Store for closing
    window._reportData = {
      from: fromISO, to: toISO,
      revenue: revenue, cogs: cogs, gross: gross,
      expenses: expensesTotal, net: net,
      collected: collected, deniCreated: deniCreated,
      salesCount: filteredSales.length,
      expensesCount: filteredExpenses.length
    };

    // Show a small summary under cards if you want - we reuse closing-list area top? No, keep clean.
    console.log('Report', fromISO, 'to', toISO, 'Revenue', revenue, 'COGS', cogs, 'Gross', gross, 'Expenses', expensesTotal, 'Net', net);
    return window._reportData;
  } catch (e) {
    console.error(e);
    showToast('Failed to load report');
  }
}

// Date helpers
function getWeekRange() {
  var now = new Date();
  var day = now.getDay(); // 0 Sun, 1 Mon...
  var diffToMonday = (day === 0 ? -6 : 1 - day);
  var monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  var sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  function iso(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  }
  return { from: iso(monday), to: iso(sunday) };
}

function getMonthRange() {
  var now = new Date();
  var y = now.getFullYear();
  var m = now.getMonth();
  var first = new Date(y, m, 1);
  var last = new Date(y, m + 1, 0);
  function iso(d) {
    var yy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }
  return { from: iso(first), to: iso(last) };
}

// ============ DAILY CLOSING ============

async function renderClosingList() {
  var box = document.getElementById('closing-list');
  if (!box) return;
  try {
    await openDB();
    var products = await dbGetAll('products');
    products.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (products.length === 0) {
      box.innerHTML = '<p class="muted">Add products first, then do closing here.</p>';
      return;
    }
    // Keep previous counts if user already typed
    var html = '<p class="muted">Count what is left in shop now. Leave blank = same as system.</p>';
    html += '<table><thead><tr><th>Product</th><th>System</th><th>Counted</th><th>Diff</th></tr></thead><tbody>';
    products.forEach(function (p) {
      var counted = currentClosingCounts[p.id] !== undefined ? currentClosingCounts[p.id] : '';
      html += '<tr><td>' + escapeHtml(p.name) + '</td><td>' + p.qty + '</td>';
      html += '<td><input type="number" min="0" step="0.01" placeholder="' + p.qty + '" value="' + counted + '" data-closing-id="' + p.id + '" style="width:80px" /></td>';
      html += '<td id="closing-diff-' + p.id + '">-</td></tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;

    // Bind inputs to update diff live
    box.querySelectorAll('input[data-closing-id]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var pid = Number(inp.getAttribute('data-closing-id'));
        var prod = products.find(function (x) { return x.id === pid; });
        if (!prod) return;
        var val = inp.value === '' ? Number(prod.qty) : Number(inp.value);
        currentClosingCounts[pid] = inp.value === '' ? undefined : Number(inp.value);
        var diffEl = document.getElementById('closing-diff-' + pid);
        if (diffEl) {
          var diff = val - Number(prod.qty);
          if (diff === 0) diffEl.textContent = 'OK';
          else if (diff > 0) diffEl.textContent = '+' + diff + ' excess';
          else diffEl.textContent = diff + ' missing';
        }
      });
    });
  } catch (e) {
    console.error(e);
  }
}

async function closeDay() {
  var cashEl = document.getElementById('closing-cash');
  var mpesaEl = document.getElementById('closing-mpesa');
  var notesEl = document.getElementById('closing-notes');

  var cashCounted = cashEl ? Number(cashEl.value || 0) : 0;
  var mpesaCounted = mpesaEl ? Number(mpesaEl.value || 0) : 0;
  var notes = notesEl ? notesEl.value.trim() : '';

  // Ensure report is for today (or selected range) - we close for the selected From-To
  var from = currentReportFrom || getTodayISO();
  var to = currentReportTo || getTodayISO();
  var report = window._reportData || await showReport(from, to);

  try {
    await openDB();
    var products = await dbGetAll('products');

    // Build stock diffs
    var diffs = [];
    products.forEach(function (p) {
      var countedRaw = currentClosingCounts[p.id];
      if (countedRaw === undefined || countedRaw === '') return; // Not counted, skip
      var counted = Number(countedRaw);
      var diff = counted - Number(p.qty);
      if (diff !== 0) {
        diffs.push({ productId: p.id, name: p.name, system: Number(p.qty), counted: counted, diff: diff });
      }
    });

    // Expected cash = collected today (paid) - we don't track cash out, so we compare to collected
    // For simplicity: Expected = Collected in report range
    var expectedCashMpesa = report.collected;

    if (!confirm('Close day ' + from + ' to ' + to + '?\nRevenue: ' + formatMoney(report.revenue) + '\nNet: ' + formatMoney(report.net) + '\nCash+M-Pesa Counted: ' + formatMoney(cashCounted + mpesaCounted) + ' (Expected Collected: ' + formatMoney(expectedCashMpesa) + ')\nStock diffs: ' + diffs.length + ' products\n\nThis saves a closing report. Continue?')) return;

    // Save closing
    await dbAdd('closings', {
      from: from,
      to: to,
      revenue: report.revenue,
      cogs: report.cogs,
      gross: report.gross,
      expenses: report.expenses,
      net: report.net,
      collected: report.collected,
      deniCreated: report.deniCreated,
      salesCount: report.salesCount,
      cashCounted: cashCounted,
      mpesaCounted: mpesaCounted,
      cashDiff: (cashCounted + mpesaCounted) - expectedCashMpesa,
      stockDiffs: diffs,
      notes: notes,
      createdAt: new Date().toISOString(),
      date: getTodayISO()
    });

    await logActivity('Day closed', from + ' to ' + to + ' - Revenue ' + formatMoney(report.revenue) + ' - Net ' + formatMoney(report.net));

    // Reset closing inputs
    currentClosingCounts = {};
    if (cashEl) cashEl.value = 0;
    if (mpesaEl) mpesaEl.value = 0;
    if (notesEl) notesEl.value = '';

    await renderClosingList();
    await renderClosedDays();
    showToast('Day closed & saved! Revenue ' + formatMoney(report.revenue) + ' • Net ' + formatMoney(report.net));
  } catch (e) {
    console.error(e);
    showToast('Failed to close day');
  }
}

async function renderClosedDays() {
  var box = document.getElementById('closed-days-list');
  if (!box) return;
  try {
    await openDB();
    var closings = await dbGetAll('closings');
    closings.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    if (closings.length === 0) {
      box.innerHTML = '<p class="muted">No closed days yet.</p>';
      return;
    }
    var html = '';
    closings.slice(0, 10).forEach(function (c) {
      var dateStr = new Date(c.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
      html += '<div class="list-row"><div><strong>Closed: ' + escapeHtml(c.from) + ' to ' + escapeHtml(c.to) + '</strong><div class="muted">' + dateStr + ' • ' + c.salesCount + ' sales • ' + (c.notes ? escapeHtml(c.notes) : 'No notes') + '</div>';
      if (c.stockDiffs && c.stockDiffs.length > 0) {
        html += '<div class="muted">Stock diffs: ' + c.stockDiffs.map(function (d) { return d.name + ' ' + d.diff; }).join(', ') + '</div>';
      }
      html += '</div><div><strong>' + formatMoney(c.net) + '</strong><div class="muted">Net • Rev ' + formatMoney(c.revenue) + '</div><div class="muted">Cash diff ' + formatMoney(c.cashDiff) + '</div></div></div>';
    });
    box.innerHTML = html;
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var filterBtn = document.getElementById('report-filter-btn');
  if (filterBtn) filterBtn.addEventListener('click', function () {
    var from = document.getElementById('report-from').value || getTodayISO();
    var to = document.getElementById('report-to').value || getTodayISO();
    if (from > to) { showToast('From date cannot be after To date'); return; }
    showReport(from, to);
  });

  var todayBtn = document.getElementById('report-today-btn');
  if (todayBtn) todayBtn.addEventListener('click', function () {
    var t = getTodayISO();
    showReport(t, t);
  });

  var weekBtn = document.getElementById('report-week-btn');
  if (weekBtn) weekBtn.addEventListener('click', function () {
    var r = getWeekRange();
    showReport(r.from, r.to);
  });

  var monthBtn = document.getElementById('report-month-btn');
  if (monthBtn) monthBtn.addEventListener('click', function () {
    var r = getMonthRange();
    showReport(r.from, r.to);
  });

  var closeBtn = document.getElementById('close-day-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeDay);

  setTimeout(function () { loadReports(); }, 900);
});