// Smart Duka - sales.js - FINAL v3
// Matches YOUR index.html:
// sale-form, sale-product, sale-qty, sale-price, add-to-sale-btn, sale-items-body, sale-total
// sale-payment, sale-customer, sale-phone, sale-paid, clear-sale-btn
// search-sales, filter-sales-date, sales-history-list
// dash-sales-today, dash-sales-count, dash-collected, dash-cash, dash-mpesa, dash-profit, recent-sales-list

let allSales = [];
let currentSaleItems = []; // [{ productId, name, qty, sellingPrice, buyingPrice, total, cogs }]

async function loadSales() {
  try {
    await openDB();
    allSales = await dbGetAll('sales');
    allSales.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    renderSalesHistory(allSales);
    updateDashboardSales();
    refreshSaleProductDropdown();
    // Net Profit depends on sales, so update it too
    if (typeof updateNetProfit === 'function') updateNetProfit();
    return allSales;
  } catch (e) {
    console.error('Load sales failed', e);
    return [];
  }
}

// ============ DASHBOARD SALES ============

function updateDashboardSales() {
  var todayISO = getTodayISO();
  var today = allSales.filter(function (s) { return s.createdAt.slice(0, 10) === todayISO; });

  var revenue = today.reduce(function (sum, s) { return sum + Number(s.total || 0); }, 0);
  var cogs = today.reduce(function (sum, s) { return sum + Number(s.cogs || 0); }, 0);
  var gross = revenue - cogs;

  // Collected = paid today (Cash + M-Pesa). Credit not counted as collected yet.
  var collected = today.reduce(function (sum, s) { return sum + Number(s.paid || 0); }, 0);
  var cashCollected = today.filter(function (s) { return s.payment === 'Cash'; }).reduce(function (sum, s) { return sum + Number(s.paid || 0); }, 0);
  var mpesaCollected = today.filter(function (s) { return s.payment === 'M-Pesa'; }).reduce(function (sum, s) { return sum + Number(s.paid || 0); }, 0);
  var mixedCollected = today.filter(function (s) { return s.payment === 'Cash+M-Pesa'; }).reduce(function (sum, s) { return sum + Number(s.paid || 0); }, 0);
  // For Cash+M-Pesa, we count it in Collected, but split is unknown - show in Collected only
  // Cash/M-Pesa breakdown shows pure Cash / pure M-Pesa, mixed goes to Collected

  var salesEl = document.getElementById('dash-sales-today');
  if (salesEl) salesEl.textContent = formatMoney(revenue);
  var countEl = document.getElementById('dash-sales-count');
  if (countEl) countEl.textContent = today.length + ' sales today';

  var collectedEl = document.getElementById('dash-collected');
  if (collectedEl) collectedEl.textContent = formatMoney(collected);
  var cashEl = document.getElementById('dash-cash');
  if (cashEl) cashEl.textContent = formatMoney(cashCollected);
  var mpesaEl = document.getElementById('dash-mpesa');
  if (mpesaEl) mpesaEl.textContent = formatMoney(mpesaCollected);

  var profitEl = document.getElementById('dash-profit');
  if (profitEl) profitEl.textContent = formatMoney(gross);

  // Recent Sales on Dashboard
  var recentBox = document.getElementById('recent-sales-list');
  if (recentBox) {
    if (today.length === 0) {
      recentBox.innerHTML = '<p class="muted">No sales yet today. Press "Sell" to record your first sale.</p>';
    } else {
      var html = '';
      today.slice(0, 5).forEach(function (s) {
        var time = new Date(s.createdAt).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
        var itemsText = (s.items || []).map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');
        var bal = Number(s.balance || 0);
        html += '<div class="list-row"><div><strong>' + escapeHtml(itemsText) + '</strong><div class="muted">' + time + ' • ' + escapeHtml(s.customer || 'Walk-in') + ' • ' + escapeHtml(s.payment || 'Cash') + '</div></div>';
        html += '<div><strong>' + formatMoney(s.total) + '</strong><div class="muted">Paid ' + formatMoney(s.paid) + (bal > 0 ? ' • Deni ' + formatMoney(bal) : '') + '</div></div></div>';
      });
      recentBox.innerHTML = html;
    }
  }

  // Auto Net Profit
  if (typeof updateNetProfit === 'function') updateNetProfit();
}

// ============ SALE PRODUCT DROPDOWN ============

function refreshSaleProductDropdown() {
  var select = document.getElementById('sale-product');
  if (!select) return;
  var products = (typeof allProducts !== 'undefined' && allProducts) ? allProducts : [];
  var currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose product --</option>';
  products.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + ' — ' + formatMoney(p.sellingPrice) + ' (Stock: ' + p.qty + ')';
    select.appendChild(opt);
  });
  if (currentVal) select.value = currentVal;

  // When product changes, auto-fill price
  // (we attach once, not on every refresh)
  if (!select._smartDukaBound) {
    select._smartDukaBound = true;
    select.addEventListener('change', function () {
      var pid = Number(select.value);
      var prod = products.find(function (p) { return p.id === pid; });
      var priceEl = document.getElementById('sale-price');
      if (prod && priceEl) priceEl.value = prod.sellingPrice;
    });
  }
}

// ============ CART ============

function addToSale() {
  var select = document.getElementById('sale-product');
  var qtyEl = document.getElementById('sale-qty');
  var priceEl = document.getElementById('sale-price');

  if (!select || !select.value) { showToast('Choose a product first'); return; }
  var productId = Number(select.value);
  var products = (typeof allProducts !== 'undefined' && allProducts) ? allProducts : [];
  var product = products.find(function (p) { return p.id === productId; });
  if (!product) { showToast('Product not found'); return; }

  var qty = qtyEl ? Number(qtyEl.value) : 1;
  var price = priceEl ? Number(priceEl.value) : Number(product.sellingPrice);
  if (!qty || qty <= 0) { showToast('Qty must be more than 0'); return; }
  if (!price || price < 0) { showToast('Price is not valid'); return; }

  // Stock check - allow decimals like 2.5 for Gomba
  var already = currentSaleItems.find(function (it) { return it.productId === productId; });
  var totalWanted = (already ? Number(already.qty) : 0) + qty;
  if (totalWanted > Number(product.qty)) {
    if (!confirm('Only ' + product.qty + ' left in stock for ' + product.name + '. You want ' + totalWanted + '. Continue anyway?')) return;
  }

  if (already) {
    already.qty = Number(already.qty) + qty;
    already.sellingPrice = price;
    already.total = Number(already.qty) * price;
    already.cogs = Number(already.qty) * Number(product.buyingPrice);
  } else {
    currentSaleItems.push({
      productId: productId,
      name: product.name,
      qty: qty,
      sellingPrice: price,
      buyingPrice: Number(product.buyingPrice),
      total: qty * price,
      cogs: qty * Number(product.buyingPrice)
    });
  }

  renderSaleCart();
  showToast('Added: ' + qty + 'x ' + product.name);
}

function renderSaleCart() {
  var tbody = document.getElementById('sale-items-body');
  var totalEl = document.getElementById('sale-total');
  if (!tbody) return;

  if (currentSaleItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">No items yet. Add a product above.</td></tr>';
    if (totalEl) totalEl.textContent = formatMoney(0);
    return;
  }

  var total = 0;
  var cogs = 0;
  var html = '';
  currentSaleItems.forEach(function (it, idx) {
    total += Number(it.total);
    cogs += Number(it.cogs);
    html += '<tr><td>' + escapeHtml(it.name) + '</td><td>' + it.qty + '</td><td>' + formatMoney(it.sellingPrice) + '</td><td>' + formatMoney(it.total) + '</td><td><button type="button" class="btn-secondary" onclick="removeSaleItem(' + idx + ')">Remove</button></td></tr>';
  });
  tbody.innerHTML = html;
  if (totalEl) totalEl.textContent = formatMoney(total);

  // Show profit hint in total line if you want - we keep total only in your HTML
  console.log('Cart total', total, 'Profit', total - cogs);
}

function removeSaleItem(idx) {
  currentSaleItems.splice(idx, 1);
  renderSaleCart();
}

function clearSale() {
  currentSaleItems = [];
  var form = document.getElementById('sale-form');
  if (form) form.reset();
  var qtyEl = document.getElementById('sale-qty');
  if (qtyEl) qtyEl.value = 1;
  var paidEl = document.getElementById('sale-paid');
  if (paidEl) paidEl.value = 0;
  renderSaleCart();
}

function getSaleTotal() {
  return currentSaleItems.reduce(function (sum, it) { return sum + Number(it.total); }, 0);
}
function getSaleCogs() {
  return currentSaleItems.reduce(function (sum, it) { return sum + Number(it.cogs); }, 0);
}

// ============ SAVE SALE ============

async function saveSale(e) {
  if (e) e.preventDefault();
  if (currentSaleItems.length === 0) { showToast('Add at least one product first'); return; }

  var customerEl = document.getElementById('sale-customer');
  var customer = customerEl ? (customerEl.value || '').trim() || 'Walk-in' : 'Walk-in';
  var phoneEl = document.getElementById('sale-phone');
  var phone = phoneEl ? phoneEl.value.trim() : '';
  var paymentEl = document.getElementById('sale-payment');
  var payment = paymentEl ? paymentEl.value : 'Cash';
  var paidEl = document.getElementById('sale-paid');
  var paidRaw = paidEl ? paidEl.value : '';

  var total = getSaleTotal();
  var cogs = getSaleCogs();
  var gross = total - cogs;

  // If paid is empty, assume full payment unless Credit
  var paid = paidRaw === '' || paidRaw === null ? (payment === 'Credit' ? 0 : total) : Number(paidRaw);
  if (isNaN(paid) || paid < 0) { showToast('Paid amount is not valid'); return; }
  if (paid > total) { showToast('Paid cannot be more than Total ' + formatMoney(total)); return; }

  var balance = total - paid;

  // If balance > 0, need customer name for Deni
  if (balance > 0 && (customer === 'Walk-in' || customer === '')) {
    showToast('Balance ' + formatMoney(balance) + ' — Enter customer name for Deni');
    if (customerEl) customerEl.focus();
    return;
  }

  try {
    await openDB();

    // 1. Save sale - COGS saved now so later price change does not change old profit
    var saleId = await dbAdd('sales', {
      customer: customer,
      phone: phone,
      payment: payment,
      items: currentSaleItems,
      total: total,
      cogs: cogs,
      grossProfit: gross,
      paid: paid,
      balance: balance,
      createdAt: new Date().toISOString(),
      date: getTodayISO()
    });

    // 2. Deduct stock
    for (var i = 0; i < currentSaleItems.length; i++) {
      var it = currentSaleItems[i];
      var prod = await dbGet('products', it.productId);
      if (prod) {
        prod.qty = Number(prod.qty) - Number(it.qty);
        await dbPut('products', prod);
      }
    }

    // 3. If balance > 0, auto-create Deni - NOT a second sale
    if (balance > 0) {
      await dbAdd('debts', {
        person: customer,
        name: customer,
        phone: phone,
        amount: total,
        paid: paid,
        balance: balance,
        status: 'owing',
        items: currentSaleItems.map(function (x) { return x.qty + 'x ' + x.name; }).join(', '),
        note: currentSaleItems.map(function (x) { return x.qty + 'x ' + x.name; }).join(', ') + ' - Sale #' + saleId,
        date: getTodayISO(),
        createdAt: new Date().toISOString(),
        saleId: saleId
      });
    }

    await logActivity('Sale completed', customer + ' - ' + formatMoney(total) + ' - Profit ' + formatMoney(gross) + (balance > 0 ? ' - Deni ' + formatMoney(balance) : ''));

    var savedText = currentSaleItems.map(function (x) { return x.qty + 'x ' + x.name; }).join(', ');
    clearSale();
    await loadSales();
    if (typeof loadProducts === 'function') await loadProducts();
    if (typeof loadDebts === 'function') await loadDebts();
    if (typeof loadExpenses === 'function') await loadExpenses(); // triggers Net Profit recalc

    if (balance > 0) {
      showToast('Sale saved: ' + formatMoney(total) + ' • Deni ' + formatMoney(balance) + ' for ' + customer);
    } else {
      showToast('Sale saved: ' + formatMoney(total) + ' • Profit ' + formatMoney(gross));
    }
    console.log('Sale saved:', savedText, 'Total', total, 'COGS', cogs, 'Profit', gross, 'Deni', balance);
  } catch (err) {
    console.error(err);
    showToast('Failed to save sale');
  }
}

// ============ SALES HISTORY - SEARCH + DATE FILTER ============

function renderSalesHistory(list) {
  var box = document.getElementById('sales-history-list');
  if (!box) return;
  if (!list || list.length === 0) {
    box.innerHTML = '<p class="muted">No sales yet.</p>';
    return;
  }
  var html = '';
  list.slice(0, 50).forEach(function (s) {
    var dateStr = new Date(s.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
    var time = new Date(s.createdAt).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' });
    var itemsText = (s.items || []).map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');
    var bal = Number(s.balance || 0);
    html += '<div class="list-row"><div><strong>' + escapeHtml(itemsText) + '</strong><div class="muted">' + dateStr + ' ' + time + ' • ' + escapeHtml(s.customer || 'Walk-in') + ' • ' + escapeHtml(s.payment || 'Cash') + '</div></div>';
    html += '<div><strong>' + formatMoney(s.total) + '</strong><div class="muted">Paid ' + formatMoney(s.paid) + (bal > 0 ? ' • Deni ' + formatMoney(bal) : ' • Paid Full') + '</div></div></div>';
  });
  box.innerHTML = html;
}

function filterSalesHistory() {
  var searchEl = document.getElementById('search-sales');
  var dateEl = document.getElementById('filter-sales-date');
  var q = searchEl ? (searchEl.value || '').toLowerCase().trim() : '';
  var dateFilter = dateEl ? dateEl.value : '';

  var filtered = allSales.filter(function (s) {
    var matchesSearch = true;
    if (q) {
      var itemsText = (s.items || []).map(function (it) { return it.name; }).join(' ').toLowerCase();
      matchesSearch = (itemsText + ' ' + (s.customer || '').toLowerCase()).includes(q);
    }
    var matchesDate = true;
    if (dateFilter) matchesDate = s.createdAt.slice(0, 10) === dateFilter;
    return matchesSearch && matchesDate;
  });
  renderSalesHistory(filtered);
}

document.addEventListener('DOMContentLoaded', function () {
  var saleForm = document.getElementById('sale-form');
  if (saleForm) saleForm.addEventListener('submit', saveSale);

  var addBtn = document.getElementById('add-to-sale-btn');
  if (addBtn) addBtn.addEventListener('click', addToSale);

  var clearBtn = document.getElementById('clear-sale-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearSale);

  var searchEl = document.getElementById('search-sales');
  if (searchEl) searchEl.addEventListener('input', filterSalesHistory);
  var dateEl = document.getElementById('filter-sales-date');
  if (dateEl) dateEl.addEventListener('change', filterSalesHistory);

  setTimeout(function () { loadSales(); }, 500);
});