// Smart Duka - loans.js - PHASE 12
// Loans: I Gave Out vs I Took, Record Repayment, Delete

let allLoans = [];
let currentPayLoanId = null;

async function loadLoans() {
  try {
    await openDB();
    allLoans = await dbGetAll('loans');
    // Owing / Active first, then paid. Newest first.
    allLoans.sort(function (a, b) {
      if (a.status !== b.status) {
        return a.status === 'active' ? -1 : 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    renderLoans(allLoans);
    updateDashboardLoans();
    return allLoans;
  } catch (e) {
    console.error('Load loans failed', e);
    return [];
  }
}

function renderLoans(list) {
  const box = document.getElementById('loans-list');
  if (!box) return;

  const outTotal = list
    .filter(function (l) { return l.type === 'given' && l.status === 'active'; })
    .reduce(function (sum, l) { return sum + Number(l.balance || 0); }, 0);
  const inTotal = list
    .filter(function (l) { return l.type === 'received' && l.status === 'active'; })
    .reduce(function (sum, l) { return sum + Number(l.balance || 0); }, 0);

  const outEl = document.getElementById('loans-out-total');
  if (outEl) outEl.textContent = formatMoney(outTotal);
  const inEl = document.getElementById('loans-in-total');
  if (inEl) inEl.textContent = formatMoney(inTotal);

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>No loans yet.</p><small>Loans you give / take will appear here.</small></div>';
    return;
  }

  let html = '';
  list.forEach(function (l) {
    const isActive = l.status === 'active';
    const isGiven = l.type === 'given';
    const dateStr = new Date(l.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    const dueStr = l.due ? ' • Due: ' + l.due : '';
    const paidSoFar = Number(l.amount) - Number(l.balance);

    html += '<div style="padding:14px 0;border-bottom:1px solid var(--border)">';
    html += '<div style="display:flex;justify-content:space-between;gap:10px">';
    html += '<div><strong>' + escapeHtml(l.person) + '</strong> ';
    html += '<span class="pill ' + (isGiven ? 'blue' : 'orange') + '">' + (isGiven ? 'I Gave Out' : 'I Took') + '</span> ';
    html += '<span class="pill ' + (isActive ? 'red' : 'green') + '">' + (isActive ? 'Active' : 'Paid') + '</span>';
    html += '<div style="font-size:13px;color:var(--text-muted)">' + dateStr + dueStr + (l.phone ? ' • ' + escapeHtml(l.phone) : '') + '</div>';
    if (l.note) html += '<div style="font-size:14px;margin-top:4px">' + escapeHtml(l.note) + '</div>';
    html += '</div>';
    html += '<div style="text-align:right;flex-shrink:0"><strong>' + formatMoney(l.balance) + '</strong><div style="font-size:12px;color:var(--text-muted)">of ' + formatMoney(l.amount) + ' • Repaid ' + formatMoney(paidSoFar) + '</div></div>';
    html += '</div>';

    if (isActive) {
      html += '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">';
      if (isGiven) {
        html += '<button class="btn-small" style="background:var(--green);color:white;border-color:var(--green)" onclick="openPayLoan(' + l.id + ')">They Repaid Me</button>';
      } else {
        html += '<button class="btn-small" style="background:var(--green);color:white;border-color:var(--green)" onclick="openPayLoan(' + l.id + ')">I Repaid Them</button>';
      }
      html += '<button class="btn-small" onclick="payFullLoan(' + l.id + ')">Paid Full ' + formatMoney(l.balance) + '</button>';
      html += '<button class="btn-small" onclick="deleteLoan(' + l.id + ')">Delete</button>';
      html += '</div>';
    } else {
      html += '<div style="margin-top:8px"><button class="btn-small" onclick="deleteLoan(' + l.id + ')">Delete</button></div>';
    }
    html += '</div>';
  });
  box.innerHTML = html;
}

async function handleAddLoan(e) {
  e.preventDefault();
  const type = document.getElementById('loan-type').value;
  const person = document.getElementById('loan-person').value.trim();
  const phone = document.getElementById('loan-phone').value.trim();
  const amount = Number(document.getElementById('loan-amount').value);
  const date = document.getElementById('loan-date').value || getTodayISO();
  const due = document.getElementById('loan-due').value;
  const note = document.getElementById('loan-note').value.trim();

  if (!person) { showToast('Enter person name'); return; }
  if (!amount || amount <= 0) { showToast('Amount must be more than 0'); return; }

  try {
    await dbAdd('loans', {
      type: type, // 'given' or 'received'
      person: person,
      phone: phone,
      amount: amount,
      paid: 0,
      balance: amount,
      status: 'active',
      date: date,
      due: due,
      note: note,
      createdAt: new Date().toISOString()
    });
    await logActivity('Loan added', (type === 'given' ? 'Gave out ' : 'Took ') + formatMoney(amount) + ' - ' + person);
    document.getElementById('loan-form').reset();
    const dEl = document.getElementById('loan-date');
    if (dEl) dEl.value = getTodayISO();
    await loadLoans();
    showToast('Loan saved: ' + person + ' - ' + formatMoney(amount));
  } catch (err) {
    console.error(err);
    showToast('Failed to save loan');
  }
}

// Open repayment - we reuse a simple prompt-style box using confirm + prompt for speed
// In Phase 12 we use prompt() so you don't need new HTML. Later we can make a pretty box like Deni.
function openPayLoan(id) {
  const loan = allLoans.find(function (l) { return l.id === id; });
  if (!loan) return;
  const label = loan.type === 'given' ? 'How much did ' + loan.person + ' repay you?' : 'How much did you repay ' + loan.person + '?';
  const input = prompt(label + ' (Owes ' + formatMoney(loan.balance) + ')', loan.balance);
  if (input === null) return; // Cancelled
  const amount = Number(input);
  if (!amount || amount <= 0) { showToast('Enter amount more than 0'); return; }
  if (amount > loan.balance) { showToast('Cannot pay more than owed: ' + formatMoney(loan.balance)); return; }
  saveLoanPayment(id, amount);
}

async function payFullLoan(id) {
  const loan = allLoans.find(function (l) { return l.id === id; });
  if (!loan) return;
  if (!confirm('Mark as fully repaid: ' + formatMoney(loan.balance) + ' for ' + loan.person + '?')) return;
  await saveLoanPayment(id, Number(loan.balance));
}

async function saveLoanPayment(id, amount) {
  const loan = allLoans.find(function (l) { return l.id === id; });
  if (!loan) return;
  try {
    loan.paid = Number(loan.paid) + amount;
    loan.balance = Number(loan.balance) - amount;
    if (loan.balance <= 0) {
      loan.balance = 0;
      loan.status = 'paid';
    }
    await dbPut('loans', loan);
    await logActivity('Loan repayment', loan.person + ' - ' + formatMoney(amount) + ' - Remaining: ' + formatMoney(loan.balance));
    await loadLoans();
    if (loan.balance === 0) {
      showToast('Loan fully repaid! ' + loan.person);
    } else {
      showToast('Repaid ' + formatMoney(amount) + '. Still ' + formatMoney(loan.balance));
    }
  } catch (e) {
    console.error(e);
    showToast('Repayment failed');
  }
}

async function deleteLoan(id) {
  const loan = allLoans.find(function (l) { return l.id === id; });
  if (!loan) return;
  if (!confirm('Delete loan for ' + loan.person + ' - ' + formatMoney(loan.balance) + '?')) return;
  try {
    await dbDelete('loans', id);
    await logActivity('Deleted loan', loan.person + ' - ' + formatMoney(loan.balance));
    await loadLoans();
    showToast('Deleted loan for ' + loan.person);
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
}

function filterLoans() {
  const search = (document.getElementById('search-loans')?.value || '').toLowerCase().trim();
  if (!search) { renderLoans(allLoans); return; }
  const filtered = allLoans.filter(function (l) {
    return (l.person + ' ' + (l.note || '') + ' ' + (l.phone || '')).toLowerCase().includes(search);
  });
  renderLoans(filtered);
}

function updateDashboardLoans() {
  const outTotal = allLoans
    .filter(function (l) { return l.type === 'given' && l.status === 'active'; })
    .reduce(function (sum, l) { return sum + Number(l.balance); }, 0);
  const inTotal = allLoans
    .filter(function (l) { return l.type === 'received' && l.status === 'active'; })
    .reduce(function (sum, l) { return sum + Number(l.balance); }, 0);
  const outEl = document.getElementById('dash-loans-out');
  if (outEl) outEl.textContent = formatMoney(outTotal);
  const inEl = document.getElementById('dash-loans-in');
  if (inEl) inEl.textContent = formatMoney(inTotal);
}

document.addEventListener('DOMContentLoaded', function () {
  const loanForm = document.getElementById('loan-form');
  if (loanForm) loanForm.addEventListener('submit', handleAddLoan);

  const searchInput = document.getElementById('search-loans');
  if (searchInput) searchInput.addEventListener('input', filterLoans);

  setTimeout(function () { loadLoans(); }, 600);
});