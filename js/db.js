// db.js - IndexedDB database will live here (Phase 9)
console.log('db.js loaded');// Smart Duka - db.js - PHASE 8
// IndexedDB = Safe Box inside browser. Works offline. Free. No server needed.
// This file ONLY handles saving / reading data. No UI here.

const DB_NAME = 'SmartDukaDB';
const DB_VERSION = 1;

// The 7 drawers
const STORES = ['products', 'sales', 'debts', 'loans', 'expenses', 'closings', 'audit'];

let db = null;

// Open the safe box. Call this once when app starts.
function openDB() {
  return new Promise(function (resolve, reject) {
    // If already open, just use it
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Runs ONLY first time, or when version changes
    // This is where we create the drawers
    request.onupgradeneeded = function (event) {
      const database = event.target.result;

      STORES.forEach(function (storeName) {
        // If drawer doesn't exist yet, create it
        if (!database.objectStoreNames.contains(storeName)) {
          // keyPath: 'id' = each item gets a unique ID, auto-increment
          database.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
        }
      });

      console.log('Smart Duka DB: Drawers created');
    };

    request.onsuccess = function (event) {
      db = event.target.result;
      console.log('Smart Duka DB: Opened OK');
      resolve(db);
    };

    request.onerror = function (event) {
      console.error('Smart Duka DB: Failed to open', event.target.error);
      reject(event.target.error);
    };
  });
}

// Helper: Get a drawer to work with
// mode = 'readonly' to read, 'readwrite' to save/delete
function getStore(storeName, mode) {
  if (!db) throw new Error('DB not open yet. Call openDB() first.');
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// ---------- SAVE ----------
// Example: await dbAdd('products', { name: 'Oranges', qty: 500, buying: 6, selling: 10 })
function dbAdd(storeName, data) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readwrite');
      // Add timestamp automatically if not there
      if (!data.createdAt) data.createdAt = new Date().toISOString();
      if (!data.updatedAt) data.updatedAt = new Date().toISOString();
      const req = store.add(data);
      req.onsuccess = function () { resolve(req.result); }; // returns new ID
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- READ ALL ----------
// Example: const allProducts = await dbGetAll('products')
function dbGetAll(storeName) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readonly');
      const req = store.getAll();
      req.onsuccess = function () { resolve(req.result || []); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- READ ONE ----------
// Example: const one = await dbGet('products', 1)
function dbGet(storeName, id) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readonly');
      const req = store.get(id);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- UPDATE ----------
// Must include id. Example: await dbPut('products', { id: 1, name: 'Oranges', qty: 100 })
function dbPut(storeName, data) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readwrite');
      data.updatedAt = new Date().toISOString();
      const req = store.put(data);
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- DELETE ONE ----------
// Example: await dbDelete('products', 1)
function dbDelete(storeName, id) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readwrite');
      const req = store.delete(id);
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- DELETE ALL IN A DRAWER ----------
// Example: await dbClear('sales') - deletes all sales, keeps drawer
function dbClear(storeName) {
  return new Promise(function (resolve, reject) {
    try {
      const store = getStore(storeName, 'readwrite');
      const req = store.clear();
      req.onsuccess = function () { resolve(); };
      req.onerror = function () { reject(req.error); };
    } catch (e) { reject(e); }
  });
}

// ---------- AUDIT LOG ----------
// Call this whenever something important happens
// Example: await logActivity('Added product Oranges')
function logActivity(action, detail) {
  return dbAdd('audit', {
    action: action,
    detail: detail || '',
    date: new Date().toISOString()
  }).catch(function (e) {
    // Audit should never break the app if it fails
    console.warn('Audit log failed', e);
  });
}

// ---------- TEST HELPER ----------
// We will use this to test Phase 8. You can delete it later.
async function testDB() {
  try {
    await openDB();
    console.log('TEST: DB opened');

    // Add a test product
    const id = await dbAdd('products', {
      name: 'TEST Oranges',
      category: 'Fruits',
      qty: 500,
      buying: 6,
      selling: 10,
      low: 5
    });
    console.log('TEST: Added product with id', id);

    const all = await dbGetAll('products');
    console.log('TEST: All products now:', all);

    // Clean up test product so it doesn't stay in your real app
    await dbDelete('products', id);
    console.log('TEST: Deleted test product. DB works!');

    showToast('Database works! Data will now save.');
    return true;
  } catch (e) {
    console.error('TEST: DB failed', e);
    showToast('Database failed. Check console (F12).');
    return false;
  }
}