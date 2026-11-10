// Smart Duka - backup.js - PHASE 15 FINAL
// Matches YOUR index.html:
// backup-status, backup-last, export-json-btn, export-csv-btn, import-file, import-btn, clear-all-btn, audit-list

async function exportBackup() {
  try {
    await openDB();
    var data = {};
    var stores = ['products', 'sales', 'debts', 'loans', 'expenses', 'closings', 'audit'];
    for (var i = 0; i < stores.length; i++) {
      data[stores[i]] = await dbGetAll(stores[i]);
    }
    data._meta = {
      app: 'Smart Duka',
      version: 1,
      exportedAt: new Date().toISOString(),
      expenseTypes: JSON.parse(localStorage.getItem('smartduka-expense-types') || '[]'),
      theme: localStorage.getItem('smartduka-theme') || 'dark'
    };

    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var dateStr = getTodayISO();
    a.href = url;
    a.download = 'smart-duka-backup-' + dateStr + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Update backup status
    var nowStr = new Date().toLocaleString('en-KE');
    try { localStorage.setItem('smartduka-last-backup', nowStr); } catch (e) {}
    updateBackupStatus();
    await logActivity('Backup exported', 'Backup downloaded - ' + dateStr);
    showToast('Backup downloaded! Save it to WhatsApp / Drive / Flash');
  } catch (e) {
    console.error(e);
    showToast('Backup failed');
  }
}

function exportCSV() {
  try {
    var sales = (typeof allSales !== 'undefined' && allSales) ? allSales : [];
    if (sales.length === 0) { showToast('No sales to export'); return; }
    var csv = 'Date,Customer,Items,Total,COGS,Profit,Paid,Balance,Payment\n';
    sales.forEach(function (s) {
      var items = (s.items || []).map(function (it) { return it.qty + 'x ' + it.name; }).join('; ');
      var date = (s.createdAt || '').slice(0, 10);
      csv += '"' + date + '","' + (s.customer || '') + '","' + items + '",' + s.total + ',' + s.cogs + ',' + (s.total - s.cogs) + ',' + s.paid + ',' + s.balance + ',"' + (s.payment || '') + '"\n';
    });
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'smart-duka-sales-' + getTodayISO() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Sales CSV downloaded - open in Excel');
  } catch (e) {
    console.error(e);
    showToast('CSV export failed');
  }
}

async function importBackupFile() {
  var fileInput = document.getElementById('import-file');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast('Choose a backup file (.json) first');
    return;
  }
  var file = fileInput.files[0];
  var reader = new FileReader();
  reader.onload = async function (e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.products && !data.sales) {
        showToast('This is not a Smart Duka backup file');
        return;
      }
      if (!confirm('Restore will REPLACE all current data with backup from ' + (data._meta ? data._meta.exportedAt : 'backup file') + '.\n\nMake a backup of current data first if you need it.\n\nContinue?')) return;

      await openDB();
      // Clear + restore each store
      var stores = ['products', 'sales', 'debts', 'loans', 'expenses', 'closings', 'audit'];
      for (var i = 0; i < stores.length; i++) {
        var storeName = stores[i];
        var items = data[storeName] || [];
        // Delete existing
        var existing = await dbGetAll(storeName);
        for (var j = 0; j < existing.length; j++) {
          await dbDelete(storeName, existing[j].id);
        }
        // Add backup items (keep original IDs if present, else new)
        for (var k = 0; k < items.length; k++) {
          // dbAdd uses auto-increment, so we use dbPut to keep ID
          await dbPut(storeName, items[k]);
        }
      }

      // Restore settings
      if (data._meta) {
        if (data._meta.expenseTypes) localStorage.setItem('smartduka-expense-types', JSON.stringify(data._meta.expenseTypes));
        if (data._meta.theme) applyTheme(data._meta.theme);
      }

      await logActivity('Backup restored', 'Restored from file ' + file.name);
      showToast('Backup restored! Reloading...');
      setTimeout(function () { location.reload(); }, 1000);
    } catch (err) {
      console.error(err);
      showToast('Restore failed - file is not valid JSON');
    }
  };
  reader.readAsText(file);
}

async function clearAllData() {
  var typed = prompt('To delete ALL data, type DELETE in capital letters:');
  if (typed !== 'DELETE') { showToast('Cancelled - you did not type DELETE'); return; }
  if (!confirm('Are you REALLY sure? This deletes products, sales, deni, loans, expenses, everything. No undo.')) return;
  try {
    await openDB();
    var stores = ['products', 'sales', 'debts', 'loans', 'expenses', 'closings', 'audit'];
    for (var i = 0; i < stores.length; i++) {
      var items = await dbGetAll(stores[i]);
      for (var j = 0; j < items.length; j++) {
        await dbDelete(stores[i], items[j].id);
      }
    }
    localStorage.removeItem('smartduka-expense-types');
    localStorage.removeItem('smartduka-last-backup');
    showToast('All data deleted');
    setTimeout(function () { location.reload(); }, 800);
  } catch (e) {
    console.error(e);
    showToast('Delete failed');
  }
}

function updateBackupStatus() {
  var last = 'Never';
  try { last = localStorage.getItem('smartduka-last-backup') || 'Never'; } catch (e) {}
  var statusEl = document.getElementById('backup-status');
  if (statusEl) statusEl.textContent = last === 'Never' ? 'Never backed up' : 'Backed up';
  var lastEl = document.getElementById('backup-last');
  if (lastEl) lastEl.textContent = last;
}

// Global names for your HTML onclick if used
function exportBackupGlobal() { exportBackup(); }

document.addEventListener('DOMContentLoaded', function () {
  var exportJsonBtn = document.getElementById('export-json-btn');
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportBackup);
  var exportCsvBtn = document.getElementById('export-csv-btn');
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
  var importBtn = document.getElementById('import-btn');
  if (importBtn) importBtn.addEventListener('click', importBackupFile);
  var clearBtn = document.getElementById('clear-all-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearAllData);

  updateBackupStatus();
  setTimeout(function () { updateBackupStatus(); }, 1000);
});