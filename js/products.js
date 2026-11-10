// Smart Duka - products.js - PHASE 9
// Handles: Add product, list products, delete, adjust stock, dashboard update

let allProducts = []; // Cache - so search + dashboard are fast

// Load all products from DB and show them
async function loadProducts() {
  try {
    await openDB();
    allProducts = await dbGetAll('products');
    renderProducts(allProducts);
    updateDashboardProducts();
    updateProductDropdowns();
    updateLowStock();
    return allProducts;
  } catch (e) {
    console.error('Load products failed', e);
    return [];
  }
}

// Show products in table
function renderProducts(list) {
  const tbody = document.getElementById('products-body');
  if (!tbody) return;

  // Update total value pill + text
  const totalValue = list.reduce(function (sum, p) {
    return sum + (Number(p.qty) * Number(p.buying));
  }, 0);

  const totalEl = document.getElementById('stock-value-total');
  if (totalEl) totalEl.textContent = formatMoney(totalValue);
  const pill = document.getElementById('stock-value-total-pill');
  if (pill) pill.textContent = formatMoney(totalValue);

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">No products yet. Add your first product above.</td></tr>';
    return;
  }

  let html = '';
  list.forEach(function (p) {
    const value = Number(p.qty) * Number(p.buying);
    const isLow = Number(p.qty) <= Number(p.low || 5);
    const qtyDisplay = isLow ? p.qty + ' LOW' : p.qty;
    html += '<tr>';
    html += '<td><strong>' + escapeHtml(p.name) + '</strong><br><small class="muted">' + escapeHtml(p.category || 'General') + '</small></td>';
    html += '<td>' + qtyDisplay + '</td>';
    html += '<td>' + formatMoney(p.buying) + '</td>';
    html += '<td>' + formatMoney(p.selling) + '</td>';
    html += '<td>' + formatMoney(value) + '</td>';
    html += '<td><button class="btn-small" onclick="deleteProduct(' + p.id + ')">Delete</button></td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

// Add product from form
async function handleAddProduct(e) {
  e.preventDefault();

  const nameEl = document.getElementById('prod-name');
  const catEl = document.getElementById('prod-category');
  const qtyEl = document.getElementById('prod-qty');
  const buyEl = document.getElementById('prod-buying');
  const sellEl = document.getElementById('prod-selling');
  const lowEl = document.getElementById('prod-low');

  const name = nameEl.value.trim();
  const qty = Number(qtyEl.value);
  const buying = Number(buyEl.value);
  const selling = Number(sellEl.value);

  if (!name) {
    showToast('Please enter product name');
    return;
  }
  if (qty < 0 || buying < 0 || selling < 0) {
    showToast('Numbers cannot be negative');
    return;
  }
  if (selling < buying) {
    // Warn but allow - shopkeeper might be selling at loss to clear stock
    if (!confirm('Selling price is LESS than buying price. You will make a loss. Continue?')) {
      return;
    }
  }

  try {
    const newProduct = {
      name: name,
      category: catEl.value,
      qty: qty,
      buying: buying,
      selling: selling,
      low: Number(lowEl.value) || 5
    };

    const id = await dbAdd('products', newProduct);
    await logActivity('Added product', name + ' - Qty ' + qty + ' @ ' + formatMoney(selling));

    // Clear form
    document.getElementById('product-form').reset();
    if (lowEl) lowEl.value = 5;
    if (qtyEl) qtyEl.value = 0;
    nameEl.focus();

    await loadProducts();
    showToast('Product saved: ' + name);
  } catch (err) {
    console.error(err);
    showToast('Failed to save product');
  }
}

// Delete product
async function deleteProduct(id) {
  const product = allProducts.find(function (p) { return p.id === id; });
  const name = product ? product.name : 'this product';
  if (!confirm('Delete ' + name + '? This cannot be undone.')) return;

  try {
    await dbDelete('products', id);
    await logActivity('Deleted product', name);
    await loadProducts();
    showToast('Deleted: ' + name);
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
}

// Filter products by search + category
function filterProducts() {
  const search = (document.getElementById('search-products')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('filter-category')?.value || '';

  let filtered = allProducts;
  if (search) {
    filtered = filtered.filter(function (p) {
      return p.name.toLowerCase().includes(search);
    });
  }
  if (cat) {
    filtered = filtered.filter(function (p) { return p.category === cat; });
  }
  renderProducts(filtered);
}

// Update dropdowns that need products: Sale + Adjust Stock
function updateProductDropdowns() {
  const saleSelect = document.getElementById('sale-product');
  if (saleSelect) {
    const current = saleSelect.value;
    saleSelect.innerHTML = '<option value="">-- Choose product --</option>';
    allProducts.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + ' - ' + formatMoney(p.selling) + ' (Stock: ' + p.qty + ')';
      saleSelect.appendChild(opt);
    });
    if (current) saleSelect.value = current;
  }

  const adjustSelect = document.getElementById('adjust-product');
  if (adjustSelect) {
    adjustSelect.innerHTML = '<option value="">-- Choose --</option>';
    allProducts.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name + ' (Stock: ' + p.qty + ')';
      adjustSelect.appendChild(opt);
    });
  }
}

// Dashboard: Total products + Stock value
function updateDashboardProducts() {
  const countEl = document.getElementById('dash-products');
  if (countEl) countEl.textContent = allProducts.length;

  const value = allProducts.reduce(function (sum, p) {
    return sum + (Number(p.qty) * Number(p.buying));
  }, 0);
  const valueEl = document.getElementById('dash-stock-value');
  if (valueEl) valueEl.textContent = formatMoney(value);
}

// Low Stock list on dashboard
function updateLowStock() {
  const box = document.getElementById('low-stock-list');
  if (!box) return;
  const low = allProducts.filter(function (p) {
    return Number(p.qty) <= Number(p.low || 5);
  });
  if (low.length === 0) {
    box.innerHTML = '<div class="empty-state"><p>No low stock. Good!</p><small>All products have enough stock.</small></div>';
    return;
  }
  let html = '';
  low.forEach(function (p) {
    html += '<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)"><span><strong>' + escapeHtml(p.name) + '</strong> - ' + p.qty + ' left</span><span class="pill orange">Buy Soon</span></div>';
  });
  box.innerHTML = html;
}

// Adjust Stock: Restock / Damaged / Lost / Correction
async function handleAdjustStock(e) {
  e.preventDefault();
  const prodId = Number(document.getElementById('adjust-product').value);
  const type = document.getElementById('adjust-type').value;
  const qty = Number(document.getElementById('adjust-qty').value);
  const note = document.getElementById('adjust-note').value.trim();

  if (!prodId) { showToast('Choose a product first'); return; }
  if (!qty || qty <= 0) { showToast('Quantity must be more than 0'); return; }

  const product = allProducts.find(function (p) { return p.id === prodId; });
  if (!product) return;

  let newQty = product.qty;
  if (type === 'restock') newQty = product.qty + qty;
  else if (type === 'damaged' || type === 'lost') newQty = product.qty - qty;
  else if (type === 'correction') newQty = qty; // Correction = set to exact count

  if (newQty < 0) {
    showToast('Cannot go below 0. You only have ' + product.qty);
    return;
  }

  try {
    product.qty = newQty;
    await dbPut('products', product);
    await logActivity('Adjusted stock', product.name + ' - ' + type + ' ' + qty + ' - New qty: ' + newQty + ' - ' + note);
    document.getElementById('adjust-form').reset();
    document.getElementById('adjust-qty').value = 1;
    await loadProducts();
    showToast('Stock updated: ' + product.name + ' now ' + newQty);
  } catch (err) {
    console.error(err);
    showToast('Adjust failed');
  }
}

// Small helper: Stop HTML injection - if name has < > it won't break page
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Wire up forms when page loads
document.addEventListener('DOMContentLoaded', function () {
  const productForm = document.getElementById('product-form');
  if (productForm) productForm.addEventListener('submit', handleAddProduct);

  const adjustForm = document.getElementById('adjust-form');
  if (adjustForm) adjustForm.addEventListener('submit', handleAdjustStock);

  const searchInput = document.getElementById('search-products');
  if (searchInput) searchInput.addEventListener('input', filterProducts);

  const catFilter = document.getElementById('filter-category');
  if (catFilter) catFilter.addEventListener('change', filterProducts);

  // Load products on start - after DB opens
  // Small delay so openDB in app.js finishes first
  setTimeout(function () { loadProducts(); }, 300);
});