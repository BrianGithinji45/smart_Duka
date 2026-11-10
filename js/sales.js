// Smart Duka - sales.js - PHASE 10
// Sales: Add to cart, save sale, deduct stock, auto-Deni, dashboard

let currentSaleItems = []; // Items in the sale you are building right now
let allSales = []; // All sales from DB

// Load all sales from DB
async function loadSales() {
  try {
    await openDB();
    allSales = await dbGetAll('sales');
    // Newest first
    allSales.sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    renderSalesHistory(allSales);
    updateDashboardSales();
    return allSales;
  } catch (e) {
    console.error('Load sales failed', e);
    return [];
  }
}

// When you pick a product in Sale form, auto-fill price
function onSaleProductChange() {
  const select = document.getElementById('sale-product');
  const priceEl = document.getElementById('sale-price');
  if (!select || !priceEl) return;
  const id = Number(select.value);
  if (!id) { priceEl.value = ''; return; }
  const product = allProducts.find(function (p) { return p.id === id; });
  if (product) {
    priceEl.value = product.selling;
    // Hint stock in qty placeholder
    const qtyEl = document.getElementById('sale-qty');
    if (qtyEl) qtyEl.placeholder = 'Stock: ' + product.qty;
  }
}

// Add one product to current sale cart
function addToSale() {
  const select = document.getElementById('sale-product');
  const qtyEl = document.getElementById('sale-qty');
  const priceEl = document.getElementById('sale-price');

  const productId = Number(select.value);
  const qty = Number(qtyEl.value);
  const price = Number(priceEl.value);

  if (!productId) { showToast('Choose a product first'); return; }
  if (!qty || qty <= 0) { showToast('Quantity must be more than 0'); return; }
  if (price < 0) { showToast('Price cannot be negative'); return; }

  const product = allProducts.find(function (p) { return p.id === productId; });
  if (!product) { showToast('Product not found'); return; }

  // Check stock - including what is already in cart
  const alreadyInCart = currentSaleItems
    .filter(function (item) { return item.productId === productId; })
    .reduce(function (sum, item) { return sum + item.qty; }, 0);

  if (qty + alreadyInCart > product.qty) {
    showToast('Not enough stock! You have ' + product.qty + ' ' + product.name + ', already in cart: ' + alreadyInCart);
    return;
  }

  currentSaleItems.push({
    productId: productId,
    name: product.name,
    qty: qty,
    price: price,
    buying: product.buying, // Save buying price now - for profit later
    total: qty * price,
    cogs: qty * product.buying
  });

  renderSaleCart();
  // Reset qty to 1, keep product selected for fast selling
  qtyEl.value = 1;
  qtyEl.focus();
}

// Show cart table + total
function renderSaleCart() {
  const tbody = document.getElementById('sale-items-body');
  const totalEl = document.getElementById('sale-total');
  const paidEl = document.getElementById('sale-paid');

  if (!tbody) return;

  if (currentSaleItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="muted">No items yet. Add a product above.</td></tr>';
    if (totalEl) totalEl.textContent = 'KSh 0';
    if (paidEl) paidEl.value = 0;
    return;
  }

  let html = '';
  let total = 0;
  currentSaleItems.forEach(function (item, index) {
    total += item.total;
    html += '<tr>';
    html += '<td>' + escapeHtml(item.name) + '</td>';
    html += '<td>' + item.qty + '</td>';
    html += '<td>' + formatMoney(item.price) + '</td>';
    html += '<td>' + formatMoney(item.total) + '</td>';
    html += '<td><button type="button" class="btn-small" onclick="removeFromSale(' + index + ')">Remove</button></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
  if (totalEl) totalEl.textContent = formatMoney(total);
  // Auto-fill paid = total (customer pays full by default)
  // If user already typed less, don't overwrite
  if (paidEl && Number(paidEl.value) === 0) paidEl.value = total;
}

function removeFromSale(index) {
  currentSaleItems.splice(index, 1);
  renderSaleCart();
}

function clearSaleCart() {
  currentSaleItems = [];
  renderSaleCart();
  const form = document.getElementById('sale-form');
  if (form) form.reset();
  const qtyEl = document.getElementById('sale-qty');
  if (qtyEl) qtyEl.value = 1;
  const paidEl = document.getElementById('sale-paid');
  if (paidEl) paidEl.value = 0;
}

// Save sale - THE MAIN FUNCTION
async function handleSaveSale(e) {
  e.preventDefault();

  if (currentSaleItems.length === 0) {
    showToast('Add at least one product to sale');
    return;
  }

  const payment = document.getElementById('sale-payment').value;
  const customer = document.getElementById('sale-customer').value.trim();
  const phone = document.getElementById('sale-phone').value.trim();
  let paid = Number(document.getElementById('sale-paid').value) || 0;

  const total = currentSaleItems.reduce(function (sum, item) { return sum + item.total; }, 0);
  const cogs = currentSaleItems.reduce(function (sum, item) { return sum + item.cogs; }, 0);
  const grossProfit = total - cogs;

  // If payment is Credit, paid must be 0 or less than total
  if (payment === 'Credit' && paid >= total) {
    showToast('Credit sale: Paid should be less than total. If they paid full, choose Cash / M-Pesa.');
    return;
  }

  // If customer chose Credit but didn't give name, ask
  if (payment === 'Credit' && !customer) {
    if (!confirm('No customer name for Credit sale. Continue without name?')) return;
  }

  // If paid is more than total, cap it - no overpay
  if (paid > total) {
    showToast('Paid is more than total. Setting paid = total.');
    paid = total;
  }

  const balance = total - paid; // Amount still owed = Deni
  const saleDate = new Date().toISOString();

  const sale = {
    items: currentSaleItems,
    total: total,
    cogs: cogs,
    grossProfit: grossProfit,
    payment: payment,
    customer: customer || 'Walk-in',
    phone: phone,
    paid: paid,
    balance: balance,
    date: saleDate,
    createdAt: saleDate
  };

  try {
    // 1. Save sale
    const saleId = await dbAdd('sales', sale);

    // 2. Deduct stock for each item
    for (let i = 0; i < currentSaleItems.length; i++) {
      const item = currentSaleItems[i];
      const product = allProducts.find(function (p) { return p.id === item.productId; });
      if (product) {
        product.qty = product.qty - item.qty;
        if (product.qty < 0) product.qty = 0;
        await dbPut('products', product);
      }
    }

    // 3. If balance > 0, create Deni automatically
    if (balance > 0) {
      const itemsText = currentSaleItems.map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');
      await dbAdd('debts', {
        name: customer || 'Walk-in',
        phone: phone,
        items: itemsText,
        amount: balance,
        paid: 0,
        balance: balance,
        status: 'owing',
        saleId: saleId,
        date: saleDate,
        createdAt: saleDate
      });
      await logActivity('Auto Deni created', (customer || 'Walk-in') + ' owes ' + formatMoney(balance) + ' from sale #' + saleId);
    }

    await logActivity('Sale saved', 'Sale #' + saleId + ' - ' + formatMoney(total) + ' - ' + (customer || 'Walk-in') + ' - Profit ' + formatMoney(grossProfit));

    // 4. Clear cart + reload everything
    clearSaleCart();
    await loadProducts();
    await loadSales();
    if (typeof loadDebts === 'function') await loadDebts();

    showToast('Sale saved! ' + formatMoney(total) + (balance > 0 ? ' - Deni: ' + formatMoney(balance) : ' - Fully paid'));
  } catch (err) {
    console.error(err);
    showToast('Failed to save sale');
  }
}

// Show sales history list
function renderSalesHistory(list) {
  const box = document.getElementById('sales-history-list');
  if (!box) return;

  if (list.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>No sales yet.</p><small>Your sales will appear here.</small></div>';
    return;
  }

  let html = '';
  list.slice(0, 20).forEach(function (sale) {
    const itemsText = sale.items.map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');
    const dateStr = new Date(sale.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) + ' ' + new Date(sale.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    html += '<div style="padding:12px 0;border-bottom:1px solid var(--border)">';
    html += '<div style="display:flex;justify-content:space-between;gap:10px"><strong>' + formatMoney(sale.total) + '</strong><span class="muted" style="font-size:13px">' + dateStr + '</span></div>';
    html += '<div style="font-size:14px">' + escapeHtml(itemsText) + '</div>';
    html += '<div style="font-size:13px;color:var(--text-muted)">' + escapeHtml(sale.customer) + ' • ' + escapeHtml(sale.payment) + ' • Paid ' + formatMoney(sale.paid) + (sale.balance > 0 ? ' • <b style="color:var(--red)">Deni ' + formatMoney(sale.balance) + '</b>' : ' • Fully paid') + ' • Profit ' + formatMoney(sale.grossProfit) + '</div>';
    html += '</div>';
  });
  box.innerHTML = html;
}

// Filter sales history by search + date
function filterSalesHistory() {
  const search = (document.getElementById('search-sales')?.value || '').toLowerCase().trim();
  const dateFilter = document.getElementById('filter-sales-date')?.value || '';

  let filtered = allSales;
  if (search) {
    filtered = filtered.filter(function (s) {
      const hay = (s.customer + ' ' + s.items.map(function (it) { return it.name; }).join(' ')).toLowerCase();
      return hay.includes(search);
    });
  }
  if (dateFilter) {
    filtered = filtered.filter(function (s) {
      return s.createdAt.slice(0, 10) === dateFilter;
    });
  }
  renderSalesHistory(filtered);
}

// Dashboard: Sales today + Collected + Profit + Recent
function updateDashboardSales() {
  const todayISO = getTodayISO();
  const todaySales = allSales.filter(function (s) { return s.createdAt.slice(0, 10) === todayISO; });

  const totalToday = todaySales.reduce(function (sum, s) { return sum + s.total; }, 0);
  const profitToday = todaySales.reduce(function (sum, s) { return sum + s.grossProfit; }, 0);
  const collectedToday = todaySales.reduce(function (sum, s) { return sum + s.paid; }, 0);

  // Cash vs M-Pesa - simple split: if payment is Cash, all paid is cash, if M-Pesa, all is mpesa
  // Cash+M-Pesa we count as half/half - good enough for Phase 10, we improve later
  let cash = 0, mpesa = 0;
  todaySales.forEach(function (s) {
    if (s.payment === 'Cash') cash += s.paid;
    else if (s.payment === 'M-Pesa') mpesa += s.paid;
    else if (s.payment === 'Cash+M-Pesa') { cash += s.paid / 2; mpesa += s.paid / 2; }
    else if (s.payment === 'Credit') { /* paid on credit still counts if they paid part */ cash += s.paid; }
  });

  const elSales = document.getElementById('dash-sales-today');
  if (elSales) elSales.textContent = formatMoney(totalToday);
  const elCount = document.getElementById('dash-sales-count');
  if (elCount) elCount.textContent = todaySales.length + ' sales today';
  const elCollected = document.getElementById('dash-collected');
  if (elCollected) elCollected.textContent = formatMoney(collectedToday);
  const elCash = document.getElementById('dash-cash');
  if (elCash) elCash.textContent = formatMoney(cash);
  const elMpesa = document.getElementById('dash-mpesa');
  if (elMpesa) elMpesa.textContent = formatMoney(mpesa);
  const elProfit = document.getElementById('dash-profit');
  if (elProfit) elProfit.textContent = formatMoney(profitToday);

  // Recent sales on dashboard - last 5 today
  const recentBox = document.getElementById('recent-sales-list');
  if (recentBox) {
    if (todaySales.length === 0) {
      recentBox.innerHTML = '<div class="empty-state"><p>No sales yet today.</p><button class="btn-small" onclick="showScreen(\'screen-sales\')">Record First Sale</button></div>';
    } else {
      let html = '';
      todaySales.slice(0, 5).forEach(function (s) {
        const itemsText = s.items.map(function (it) { return it.qty + 'x ' + it.name; }).join(', ');
        html += '<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between"><span>' + escapeHtml(itemsText) + ' • ' + escapeHtml(s.customer) + '</span><strong>' + formatMoney(s.total) + '</strong></div>';
      });
      recentBox.innerHTML = html;
    }
  }
}

// Wire up
document.addEventListener('DOMContentLoaded', function () {
  const saleForm = document.getElementById('sale-form');
  if (saleForm) saleForm.addEventListener('submit', handleSaveSale);

  const addBtn = document.getElementById('add-to-sale-btn');
  if (addBtn) addBtn.addEventListener('click', addToSale);

  const clearBtn = document.getElementById('clear-sale-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearSaleCart);

  const prodSelect = document.getElementById('sale-product');
  if (prodSelect) prodSelect.addEventListener('change', onSaleProductChange);

  const searchInput = document.getElementById('search-sales');
  if (searchInput) searchInput.addEventListener('input', filterSalesHistory);

  const dateFilter = document.getElementById('filter-sales-date');
  if (dateFilter) dateFilter.addEventListener('change', filterSalesHistory);

  // When payment changes to Credit, hint customer name
  const paymentSelect = document.getElementById('sale-payment');
  if (paymentSelect) {
    paymentSelect.addEventListener('change', function () {
      if (paymentSelect.value === 'Credit') {
        showToast('Credit sale: Remember customer name - it becomes Deni');
        const cust = document.getElementById('sale-customer');
        if (cust) cust.focus();
      }
    });
  }

  setTimeout(function () { loadSales(); }, 400);
});