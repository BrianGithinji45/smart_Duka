// Smart Duka - debts.js - PHASE 11
// Deni: Show, Add Manually, Record Payment, Delete

let allDebts = [];
let currentPayDebtId = null; // Which deni are we paying right now?

// Load all debts from DB
async function loadDebts() {
  try {
    await openDB();
    allDebts = await dbGetAll('debts');
    // Owing first, then paid. Newest first inside each group.
    allDebts.sort(function (a, b) {
      if (a.status !== b.status) {
        return a.status === 'owing' ? -1 : 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    renderDebts(allDebts);
    updateDashboardDebts();
    return allDebts;
  } catch (e) {
    console.error('Load debts failed', e);
    return [];
  }
}

// Show debts list
function renderDebts(list) {
  const box = document.getElementById('debts-list');
  if (!box) return;

  // Update totals at top
  const totalOwing = list
    .filter(function (d) { return d.status === 'owing'; })
    .reduce(function (sum, d) { return sum + Number(d.balance || 0); }, 0);
  const paidCount = list.filter(function (d) { return d.status === 'paid'; }).length;
  const owingCount = list.filter(function (d) { return d.status === 'owing'; }).length;

  const totalEl = document.getElementById('debts-total');
  if (totalEl) totalEl.textContent = formatMoney(totalOwing);
  const pill = document.getElementById('debts-total-pill');
  if (pill) pill.textContent = formatMoney(totalOwing);
  const paidEl = document.getElementById('debts-paid-count');
  if (paidEl) paidEl.textContent = paidCount;
  const owingEl = document.getElementById('debts-owing-count');
  if (owingEl) owingEl.textContent = owingCount;

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>No debts yet.</p><small>Good - everyone paid!</small></div>';
    return;
  }

  let html = '';
  list.forEach(function (d) {
    const isPaid = d.status === 'paid';
    const dateStr = new Date(d.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    const paidSoFar = Number(d.amount) - Number(d.balance);

    html += '<div style="padding:14px 0;border-bottom:1px solid var(--border)">';
    html += '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">';
    html += '<div><strong>' + escapeHtml(d.name) + '</strong> <span class="pill ' + (isPaid ? 'green' : 'red') + '">' + (isPaid ? 'Paid' : 'Owing') + '</span>';
    html += '<div style="font-size:13px;color:var(--text-muted)">' + dateStr + (d.phone ? ' • ' + escapeHtml(d.phone) : '') + '</div>';
    html += '<div style="font-size:14px;margin-top:4px">' + escapeHtml(d.items || '') + '</div></div>';
    html += '<div style="text-align:right;flex-shrink:0"><strong>' + formatMoney(d.balance) + '</strong><div style="font-size:12px;color:var(--text-muted)">of ' + formatMoney(d.amount) + ' • Paid ' + formatMoney(paidSoFar) + '</div></div>';
    html += '</div>';

    if (!isPaid) {
      html += '<div style="display:flex;gap:8px;margin-top:10px">';
      html += '<button class="btn-small" style="background:var(--green);color:white;border-color:var(--green)" onclick="openPayDebt(' + d.id + ')">Record Payment</button>';
      html += '<button class="btn-small" onclick="payFullDebt(' + d.id + ')">Paid Full ' + formatMoney(d.balance) + '</button>';
      html += '<button class="btn-small" onclick="deleteDebt(' + d.id + ')">Delete</button>';
      html += '</div>';
    } else {
      html += '<div style="margin-top:8px"><button class="btn-small" onclick="deleteDebt(' + d.id + ')">Delete</button></div>';
    }
    html += '</div>';
  });
  box.innerHTML = html;
}

// Add Deni manually from form
async function handleAddDebt(e) {
  e.preventDefault();
  const nameEl = document.getElementById('debt-name');
  const phoneEl = document.getElementById('debt-phone');
  const itemsEl = document.getElementById('debt-items');
  const amountEl = document.getElementById('debt-amount');
  const dateEl = document.getElementById('debt-date');

  const name = nameEl.value.trim();
  const amount = Number(amountEl.value);

  if (!name) { showToast('Enter customer name'); return; }
  if (!amount || amount <= 0) { showToast('Amount must be more than 0'); return; }

  try {
    const debt = {
      name: name,
      phone: phoneEl.value.trim(),
      items: itemsEl.value.trim() || 'Manual Deni',
      amount: amount,
      paid: 0,
      balance: amount,
      status: 'owing',
      date: dateEl.value || getTodayISO(),
      createdAt: new Date().toISOString()
    };
    await dbAdd('debts', debt);
    await logActivity('Manual Deni added', name + ' owes ' + formatMoney(amount));
    document.getElementById('debt-form').reset();
    const dDate = document.getElementById('debt-date');
    if (dDate) dDate.value = getTodayISO();
    await loadDebts();
    showToast('Deni saved: ' + name + ' owes ' + formatMoney(amount));
  } catch (err) {
    console.error(err);
    showToast('Failed to save Deni');
  }
}

// Open Pay box for one deni
function openPayDebt(id) {
  const debt = allDebts.find(function (d) { return d.id === id; });
  if (!debt) return;
  currentPayDebtId = id;
  const nameEl = document.getElementById('pay-debt-name');
  if (nameEl) nameEl.textContent = debt.name + ' - Owes ' + formatMoney(debt.balance);
  const amountEl = document.getElementById('pay-debt-amount');
  if (amountEl) {
    amountEl.value = debt.balance; // Suggest full balance, user can change to partial
    amountEl.max = debt.balance;
  }
  const box = document.getElementById('pay-debt-box');
  if (box) {
    box.classList.remove('hidden');
    box.classList.add('show');
  }
  // Scroll to pay box
  if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Cancel pay
function cancelPayDebt() {
  currentPayDebtId = null;
  const box = document.getElementById('pay-debt-box');
  if (box) {
    box.classList.add('hidden');
    box.classList.remove('show');
  }
  const amountEl = document.getElementById('pay-debt-amount');
  if (amountEl) amountEl.value = '';
}

// One-tap: Paid Full
async function payFullDebt(id) {
  const debt = allDebts.find(function (d) { return d.id === id; });
  if (!debt) return;
  if (!confirm(debt.name + ' paid full ' + formatMoney(debt.balance) + '?')) return;
  await saveDebtPayment(id, Number(debt.balance), 'Cash');
}

// Save payment - THE MAIN FUNCTION
async function saveDebtPayment(id, amount, method) {
  // If called from Pay box button, read from inputs
  if (id === undefined || id === null) {
    id = currentPayDebtId;
    amount = Number(document.getElementById('pay-debt-amount')?.value) || 0;
    method = document.getElementById('pay-debt-method')?.value || 'Cash';
  }

  const debt = allDebts.find(function (d) { return d.id === id; });
  if (!debt) { showToast('Deni not found'); return; }
  if (!amount || amount <= 0) { showToast('Enter amount more than 0'); return; }
  if (amount > debt.balance) {
    showToast('Cannot pay more than owed. Owes ' + formatMoney(debt.balance));
    return;
  }

  try {
    debt.paid = Number(debt.paid) + amount;
    debt.balance = Number(debt.balance) - amount;
    if (debt.balance <= 0) {
      debt.balance = 0;
      debt.status = 'paid';
    }
    await dbPut('debts', debt);
    await logActivity('Deni payment', debt.name + ' paid ' + formatMoney(amount) + ' via ' + method + ' - Remaining: ' + formatMoney(debt.balance));
    cancelPayDebt();
    await loadDebts();
    // Also refresh sales dashboard if it shows collected
    if (typeof loadSales === 'function') await loadSales();

    if (debt.balance === 0) {
      showToast('Fully paid! ' + debt.name + ' cleared Deni.');
    } else {
      showToast(debt.name + ' paid ' + formatMoney(amount) + '. Still owes ' + formatMoney(debt.balance));
    }
  } catch (err) {
    console.error(err);
    showToast('Payment failed');
  }
}

// Delete deni
async function deleteDebt(id) {
  const debt = allDebts.find(function (d) { return d.id === id; });
  if (!debt) return;
  if (!confirm('Delete Deni for ' + debt.name + ' - ' + formatMoney(debt.balance) + '?')) return;
  try {
    await dbDelete('debts', id);
    await logActivity('Deleted Deni', debt.name + ' - ' + formatMoney(debt.balance));
    await loadDebts();
    showToast('Deleted Deni for ' + debt.name);
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
}

// Filter debts by search
function filterDebts() {
  const search = (document.getElementById('search-debts')?.value || '').toLowerCase().trim();
  if (!search) { renderDebts(allDebts); return; }
  const filtered = allDebts.filter(function (d) {
    return (d.name + ' ' + (d.items || '') + ' ' + (d.phone || '')).toLowerCase().includes(search);
  });
  renderDebts(filtered);
}

// Dashboard: Total Deni
function updateDashboardDebts() {
  const total = allDebts
    .filter(function (d) { return d.status === 'owing'; })
    .reduce(function (sum, d) { return sum + Number(d.balance); }, 0);
  const el = document.getElementById('dash-debts');
  if (el) el.textContent = formatMoney(total);
}

// Wire up
document.addEventListener('DOMContentLoaded', function () {
  const debtForm = document.getElementById('debt-form');
  if (debtForm) debtForm.addEventListener('submit', handleAddDebt);

  const confirmBtn = document.getElementById('confirm-pay-debt-btn');
  if (confirmBtn) confirmBtn.addEventListener('click', function () { saveDebtPayment(); });

  const cancelBtn = document.getElementById('cancel-pay-debt-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelPayDebt);

  const searchInput = document.getElementById('search-debts');
  if (searchInput) searchInput.addEventListener('input', filterDebts);

  setTimeout(function () { loadDebts(); }, 500);
});