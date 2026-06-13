/* ==========================================
   NEXUS ADMIN APP - MAIN LOGIC
   Standalone app for business owners.
   Connects to shared Firebase project: bot-nuevo-bdf67
   ========================================== */

import {
  db, isFirebaseEnabled,
  collection, doc, addDoc, getDocs, onSnapshot,
  updateDoc, deleteDoc, setDoc, query, where
} from './firebase-config.js';

// --- STATE ---
let products = [];
let orders = [];
let promos = [];
let currentRestaurantId = '';
let userRole = '';
let allowedRestaurantId = '';
let sessionName = '';
let productsUnsubscribe = null;
let ordersUnsubscribe = null;
let promosUnsubscribe = null;

// --- DOM REFERENCES ---
const DOM = {
  // Panels
  adminTabs: document.querySelectorAll('.admin-tab'),
  adminSubpanels: document.querySelectorAll('.admin-subpanel'),
  adminProductsList: document.getElementById('admin-products-list'),
  adminOrdersList: document.getElementById('admin-orders-list'),
  adminPromosList: document.getElementById('admin-promos-list'),
  adminPendingBadge: document.getElementById('admin-pending-badge'),
  btnAddProduct: document.getElementById('btn-add-product'),
  btnClearOrders: document.getElementById('btn-clear-orders'),
  btnAddPromo: document.getElementById('btn-add-promo'),

  // Stats
  statPending: document.getElementById('stat-pending'),
  statPreparing: document.getElementById('stat-preparing'),
  statTransit: document.getElementById('stat-transit'),
  statCompleted: document.getElementById('stat-completed'),

  // Business Selector
  adminRestaurantSelect: document.getElementById('admin-restaurant-select'),
  bizSelectorWrapper: document.getElementById('biz-selector-wrapper'),

  // Settings Form
  formRestaurantConfig: document.getElementById('form-restaurant-config'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  restName: document.getElementById('rest-name'),
  restDesc: document.getElementById('rest-desc'),
  restPhone: document.getElementById('rest-phone'),
  restSchedule: document.getElementById('rest-schedule'),
  restAddress: document.getElementById('rest-address'),
  restMinDelivery: document.getElementById('rest-min-delivery'),
  restPayCash: document.getElementById('rest-pay-cash'),
  restPayCard: document.getElementById('rest-pay-card'),
  restPayTransfer: document.getElementById('rest-pay-transfer'),
  restLogo: document.getElementById('rest-logo'),
  settingsMsg: document.getElementById('settings-msg'),

  // Session header
  headerSession: document.getElementById('header-session'),
  sessionName: document.getElementById('session-name'),
  sessionRole: document.getElementById('session-role'),
  btnLogout: document.getElementById('btn-logout'),

  // Login / Register Modal
  modalLogin: document.getElementById('modal-login'),
  formLogin: document.getElementById('form-login'),
  formRegister: document.getElementById('form-register'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  loginErrorMsg: document.getElementById('login-error-msg'),
  btnToggleLoginPass: document.getElementById('btn-toggle-login-pass'),
  tabBtnLogin: document.getElementById('tab-btn-login'),
  tabBtnRegister: document.getElementById('tab-btn-register'),
  regOwnerName: document.getElementById('reg-owner-name'),
  regOwnerEmail: document.getElementById('reg-owner-email'),
  regOwnerPhone: document.getElementById('reg-owner-phone'),
  regOwnerPassword: document.getElementById('reg-owner-password'),
  btnToggleRegPass: document.getElementById('btn-toggle-reg-pass'),
  regBizName: document.getElementById('reg-biz-name'),
  regBizDesc: document.getElementById('reg-biz-desc'),
  regBizSchedule: document.getElementById('reg-biz-schedule'),
  regBizMinDelivery: document.getElementById('reg-biz-min-delivery'),
  regBizAddress: document.getElementById('reg-biz-address'),
  registerErrorMsg: document.getElementById('register-error-msg'),

  // Product Modal
  modalProductForm: document.getElementById('modal-product-form'),
  productForm: document.getElementById('form-product'),
  productModalTitle: document.getElementById('product-modal-title'),
  btnCloseProductModal: document.getElementById('btn-close-product-modal'),
  btnCancelProductModal: document.getElementById('btn-cancel-product-modal'),
  prodId: document.getElementById('prod-id'),
  prodName: document.getElementById('prod-name'),
  prodCategory: document.getElementById('prod-category'),
  prodPrice: document.getElementById('prod-price'),
  prodImg: document.getElementById('prod-img'),
  prodDesc: document.getElementById('prod-desc'),

  // Promo Modal
  modalPromoForm: document.getElementById('modal-promo-form'),
  promoForm: document.getElementById('form-promo'),
  promoModalTitle: document.getElementById('promo-modal-title'),
  btnClosePromoModal: document.getElementById('btn-close-promo-modal'),
  btnCancelPromoModal: document.getElementById('btn-cancel-promo-modal'),
  promoId: document.getElementById('promo-id'),
  promoTitle: document.getElementById('promo-title'),
  promoValue: document.getElementById('promo-value'),
  promoActive: document.getElementById('promo-active'),
  promoDesc: document.getElementById('promo-desc'),
  promoImg: document.getElementById('promo-img'),
};

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  setupLoginHandlers();
});

// ============================================================
// LOGIN / REGISTER HANDLERS
// ============================================================
function setupLoginHandlers() {
  // Tab switching
  DOM.tabBtnLogin.addEventListener('click', () => {
    DOM.tabBtnLogin.classList.add('active');
    DOM.tabBtnRegister.classList.remove('active');
    DOM.formLogin.style.display = 'block';
    DOM.formRegister.style.display = 'none';
    DOM.loginErrorMsg.style.display = 'none';
  });

  DOM.tabBtnRegister.addEventListener('click', () => {
    DOM.tabBtnRegister.classList.add('active');
    DOM.tabBtnLogin.classList.remove('active');
    DOM.formRegister.style.display = 'block';
    DOM.formLogin.style.display = 'none';
    DOM.registerErrorMsg.style.display = 'none';
  });

  // Password toggle (login)
  DOM.btnToggleLoginPass?.addEventListener('click', () => {
    const isText = DOM.loginPassword.type === 'text';
    DOM.loginPassword.type = isText ? 'password' : 'text';
    DOM.btnToggleLoginPass.innerHTML = isText ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
  });

  // Password toggle (register)
  DOM.btnToggleRegPass?.addEventListener('click', () => {
    const isText = DOM.regOwnerPassword.type === 'text';
    DOM.regOwnerPassword.type = isText ? 'password' : 'text';
    DOM.btnToggleRegPass.innerHTML = isText ? '<i class="bx bx-show"></i>' : '<i class="bx bx-hide"></i>';
  });

  // LOGIN submit
  DOM.formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = DOM.loginEmail.value.trim().toLowerCase();
    const password = DOM.loginPassword.value.trim();
    DOM.loginErrorMsg.style.display = 'none';

    if (!email || !password) return;

    if (isFirebaseEnabled) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', email));
        const snap = await getDocs(q);

        if (snap.empty) {
          showLoginError('Correo no registrado como administrador.');
          return;
        }

        let authorized = false;
        snap.forEach((docSnap) => {
          const u = docSnap.data();
          if ((u.role === 'admin' || u.role === 'owner') && (!u.password || u.password === password)) {
            authorized = true;
            userRole = u.role;
            allowedRestaurantId = u.restaurantId || 'all';
            sessionName = u.name || email;
          }
        });

        if (authorized) {
          hideLoginModal();
          showSessionHeader();
          startAdminConsole();
        } else {
          showLoginError('Contraseña incorrecta o sin privilegios de administrador.');
        }
      } catch (err) {
        showLoginError(`Error: ${err.message}`);
      }
    } else {
      // Local fallback
      if (email === 'admin@nexus.com' && password === 'admin123') {
        userRole = 'admin'; allowedRestaurantId = 'all'; sessionName = 'Administrador';
        hideLoginModal(); showSessionHeader(); startAdminConsole();
      } else {
        const localUsers = JSON.parse(localStorage.getItem('nexus_local_users')) || [];
        const found = localUsers.find(u => u.email === email && u.password === password);
        if (found && (found.role === 'admin' || found.role === 'owner')) {
          userRole = found.role; allowedRestaurantId = found.restaurantId || 'all'; sessionName = found.name || email;
          hideLoginModal(); showSessionHeader(); startAdminConsole();
        } else {
          showLoginError('Credenciales incorrectas o sin acceso de admin.');
        }
      }
    }
  });

  // REGISTER submit
  DOM.formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    DOM.registerErrorMsg.style.display = 'none';

    const ownerName = DOM.regOwnerName.value.trim();
    const ownerEmail = DOM.regOwnerEmail.value.trim().toLowerCase();
    const ownerPhone = DOM.regOwnerPhone.value.trim();
    const ownerPassword = DOM.regOwnerPassword.value.trim();
    const bizName = DOM.regBizName.value.trim();
    const bizDesc = DOM.regBizDesc.value.trim();
    const bizSchedule = DOM.regBizSchedule.value.trim();
    const bizMinDelivery = parseFloat(DOM.regBizMinDelivery.value) || 0;
    const bizAddress = DOM.regBizAddress.value.trim();
    const payCheckboxes = document.querySelectorAll("input[name='reg-pay-method']:checked");
    const paymentMethod = Array.from(payCheckboxes).map(c => c.value).join(', ') || 'Efectivo';

    if (!ownerName || !ownerEmail || !ownerPassword || !bizName || !bizDesc || !bizSchedule || !bizAddress) {
      showRegisterError('Por favor completa todos los campos obligatorios.');
      return;
    }

    const bizId = bizName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const businessData = {
      name: bizName, description: bizDesc, phone: ownerPhone,
      schedule: bizSchedule, address: bizAddress,
      minDeliveryAmount: bizMinDelivery.toFixed(2),
      paymentMethod, logoUrl: '', ownerId: ownerEmail, createdAt: Date.now()
    };

    const userData = {
      name: ownerName, email: ownerEmail, phone: ownerPhone,
      password: ownerPassword, role: 'owner',
      restaurantId: bizId, createdAt: Date.now()
    };

    if (isFirebaseEnabled) {
      try {
        const existing = await getDocs(query(collection(db, 'users'), where('email', '==', ownerEmail)));
        if (!existing.empty) { showRegisterError('Este correo ya está registrado.'); return; }

        const existingBiz = await getDocs(collection(db, 'businesses'));
        let bizExists = false;
        existingBiz.forEach(d => { if (d.id === bizId) bizExists = true; });
        if (bizExists) { showRegisterError(`El nombre "${bizName}" ya existe. Elige otro.`); return; }

        await setDoc(doc(db, 'businesses', bizId), businessData);
        await addDoc(collection(db, 'users'), userData);

        userRole = 'owner'; allowedRestaurantId = bizId; sessionName = ownerName;
        hideLoginModal(); showSessionHeader(); startAdminConsole();
      } catch (err) {
        showRegisterError(`Error al registrar: ${err.message}`);
      }
    } else {
      const allBiz = JSON.parse(localStorage.getItem('nexus_businesses')) || {};
      if (allBiz[bizId]) { showRegisterError(`El negocio "${bizName}" ya existe localmente.`); return; }
      allBiz[bizId] = businessData;
      localStorage.setItem('nexus_businesses', JSON.stringify(allBiz));
      const localUsers = JSON.parse(localStorage.getItem('nexus_local_users')) || [];
      localUsers.push(userData);
      localStorage.setItem('nexus_local_users', JSON.stringify(localUsers));
      userRole = 'owner'; allowedRestaurantId = bizId; sessionName = ownerName;
      hideLoginModal(); showSessionHeader(); startAdminConsole();
    }
  });
}

function showLoginError(msg) { DOM.loginErrorMsg.innerText = msg; DOM.loginErrorMsg.style.display = 'block'; }
function showRegisterError(msg) { DOM.registerErrorMsg.innerText = msg; DOM.registerErrorMsg.style.display = 'block'; }
function hideLoginModal() { DOM.modalLogin.classList.remove('active'); }

function showSessionHeader() {
  DOM.headerSession.style.display = 'flex';
  DOM.sessionName.innerText = sessionName;
  DOM.sessionRole.innerText = userRole === 'admin' ? '⚡ Super Admin' : '🏪 Dueño de Negocio';
  DOM.btnLogout.addEventListener('click', () => { location.reload(); });
}

// ============================================================
// ADMIN CONSOLE BOOT
// ============================================================
function startAdminConsole() {
  setupPanelNavigation();
  setupEventListeners();
  loadRestaurants();
}

// ============================================================
// PANEL NAVIGATION
// ============================================================
function setupPanelNavigation() {
  DOM.adminTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      DOM.adminTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      DOM.adminSubpanels.forEach(p => p.classList.remove('active'));
      document.getElementById(tab.dataset.panel)?.classList.add('active');
    });
  });
}

// ============================================================
// LOAD BUSINESSES
// ============================================================
async function loadRestaurants() {
  const isAdmin = allowedRestaurantId === 'all';

  if (isAdmin) { DOM.bizSelectorWrapper.style.display = 'block'; }

  if (isFirebaseEnabled) {
    try {
      const snap = await getDocs(collection(db, 'businesses'));
      const loaded = [];
      snap.forEach(d => loaded.push({ id: d.id, ...d.data() }));
      const filtered = isAdmin ? loaded : loaded.filter(r => r.id === allowedRestaurantId);

      DOM.adminRestaurantSelect.innerHTML = '';
      filtered.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.id; opt.innerText = r.name;
        DOM.adminRestaurantSelect.appendChild(opt);
      });

      if (filtered.length > 0) {
        currentRestaurantId = filtered[0].id;
        DOM.adminRestaurantSelect.value = currentRestaurantId;
        onRestaurantChanged();
      }
    } catch (err) { console.error('Error cargando negocios:', err); }
  } else {
    const saved = JSON.parse(localStorage.getItem('nexus_businesses')) || {};
    const mock = { 'burger-shack': { name: 'Burger Shack' }, 'pizza-napolitana': { name: 'Pizza Napolitana' } };
    const all = { ...mock, ...saved };
    const entries = Object.entries(all).map(([id, d]) => ({ id, name: d.name }))
      .filter(r => isAdmin || r.id === allowedRestaurantId);

    DOM.adminRestaurantSelect.innerHTML = '';
    entries.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.id; opt.innerText = r.name;
      DOM.adminRestaurantSelect.appendChild(opt);
    });

    if (entries.length > 0) {
      currentRestaurantId = entries[0].id;
      DOM.adminRestaurantSelect.value = currentRestaurantId;
      onRestaurantChanged();
    }
  }
}

function onRestaurantChanged() {
  loadRestaurantMetadata();
  loadAdminProducts();
  loadAdminOrders();
  loadAdminPromos();
}

// ============================================================
// RESTAURANT SETTINGS
// ============================================================
async function loadRestaurantMetadata() {
  if (isFirebaseEnabled) {
    onSnapshot(doc(db, 'businesses', currentRestaurantId), (snap) => {
      if (snap.exists()) fillConfigForm(snap.data());
    });
  } else {
    const data = (JSON.parse(localStorage.getItem('nexus_businesses')) || {})[currentRestaurantId] || {};
    fillConfigForm(data);
  }
}

function fillConfigForm(data) {
  DOM.restName.value = data.name || '';
  DOM.restDesc.value = data.description || '';
  DOM.restPhone.value = data.phone || '';
  DOM.restSchedule.value = data.schedule || '';
  DOM.restAddress.value = data.address || '';
  DOM.restMinDelivery.value = data.minDeliveryAmount || '0.00';
  DOM.restLogo.value = data.logoUrl || '';
  const methods = (data.paymentMethod || '').split(',').map(m => m.trim());
  DOM.restPayCash.checked = methods.includes('Efectivo');
  DOM.restPayCard.checked = methods.includes('Tarjeta');
  DOM.restPayTransfer.checked = methods.includes('Transferencia');
}

async function handleSettingsSave() {
  const payMethods = [];
  if (DOM.restPayCash.checked) payMethods.push('Efectivo');
  if (DOM.restPayCard.checked) payMethods.push('Tarjeta');
  if (DOM.restPayTransfer.checked) payMethods.push('Transferencia');

  const restData = {
    name: DOM.restName.value.trim(),
    description: DOM.restDesc.value.trim(),
    phone: DOM.restPhone.value.trim(),
    schedule: DOM.restSchedule.value.trim(),
    address: DOM.restAddress.value.trim(),
    minDeliveryAmount: parseFloat(DOM.restMinDelivery.value || 0).toFixed(2),
    paymentMethod: payMethods.join(', ') || 'Efectivo',
    logoUrl: DOM.restLogo.value.trim()
  };

  if (isFirebaseEnabled) {
    try {
      await updateDoc(doc(db, 'businesses', currentRestaurantId), restData);
      showSettingsMsg();
    } catch (err) { alert(`Error al guardar: ${err.message}`); }
  } else {
    const allBiz = JSON.parse(localStorage.getItem('nexus_businesses')) || {};
    allBiz[currentRestaurantId] = { ...allBiz[currentRestaurantId], ...restData };
    localStorage.setItem('nexus_businesses', JSON.stringify(allBiz));
    showSettingsMsg();
  }
}

function showSettingsMsg() {
  DOM.settingsMsg.style.display = 'block';
  setTimeout(() => { DOM.settingsMsg.style.display = 'none'; }, 3500);
}

// ============================================================
// PRODUCTS
// ============================================================
function loadAdminProducts() {
  if (productsUnsubscribe) productsUnsubscribe();
  if (isFirebaseEnabled) {
    productsUnsubscribe = onSnapshot(
      query(collection(db, 'businesses', currentRestaurantId, 'products')),
      (snap) => {
        products = [];
        snap.forEach(d => products.push({ id: d.id, ...d.data() }));
        renderProducts();
      }
    );
  } else {
    products = (JSON.parse(localStorage.getItem('nexus_products')) || [])
      .filter(p => p.restaurantId === currentRestaurantId);
    renderProducts();
  }
}

function renderProducts() {
  DOM.adminProductsList.innerHTML = '';
  if (products.length === 0) {
    DOM.adminProductsList.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bx bx-food-menu"></i><p>No hay productos. ¡Agrega el primero!</p></div></td></tr>`;
    return;
  }

  products.forEach(p => {
    const tr = document.createElement('tr');
    const img = p.imageUrl || p.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80';
    tr.innerHTML = `
      <td><img src="${img}" alt="${p.name}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;" onerror="this.src='https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=80&q=80'"></td>
      <td style="font-weight:600">${p.name}</td>
      <td><span class="status-badge badge-preparing" style="font-size:0.68rem;">${p.category || 'General'}</span></td>
      <td style="font-weight:700;color:var(--color-success)">$${parseFloat(p.price).toFixed(2)}</td>
      <td style="font-size:0.78rem;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.description || ''}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="primary-btn btn-sm btn-info edit-prod" data-id="${p.id}" title="Editar"><i class="bx bx-edit"></i></button>
          <button class="primary-btn btn-sm btn-danger del-prod" data-id="${p.id}" title="Eliminar"><i class="bx bx-trash"></i></button>
        </div>
      </td>`;
    tr.querySelector('.edit-prod').addEventListener('click', () => openProductModal(p.id));
    tr.querySelector('.del-prod').addEventListener('click', () => deleteProduct(p.id));
    DOM.adminProductsList.appendChild(tr);
  });
}

function openProductModal(productId = null) {
  if (productId) {
    const p = products.find(p => p.id === productId);
    if (!p) return;
    DOM.productModalTitle.innerText = 'Editar Producto';
    DOM.prodId.value = p.id;
    DOM.prodName.value = p.name;
    DOM.prodCategory.value = p.category || '';
    DOM.prodPrice.value = p.price;
    DOM.prodImg.value = p.imageUrl || p.img || '';
    DOM.prodDesc.value = p.description || '';
  } else {
    DOM.productModalTitle.innerText = 'Agregar Producto';
    DOM.productForm.reset(); DOM.prodId.value = '';
  }
  DOM.modalProductForm.classList.add('active');
}

async function handleProductSubmit(e) {
  e.preventDefault();
  const id = DOM.prodId.value;
  const data = {
    name: DOM.prodName.value.trim(), category: DOM.prodCategory.value.trim(),
    price: parseFloat(DOM.prodPrice.value), imageUrl: DOM.prodImg.value.trim(),
    description: DOM.prodDesc.value.trim(), isAvailable: true, updatedAt: Date.now()
  };
  if (isFirebaseEnabled) {
    try {
      if (id) await updateDoc(doc(db, 'businesses', currentRestaurantId, 'products', id), data);
      else await addDoc(collection(db, 'businesses', currentRestaurantId, 'products'), data);
    } catch (err) { alert(`Error: ${err.message}`); }
  } else {
    const all = JSON.parse(localStorage.getItem('nexus_products')) || [];
    if (id) { const i = all.findIndex(p => p.id === id); if (i !== -1) all[i] = { id, ...data, restaurantId: currentRestaurantId }; }
    else all.push({ id: 'prod-' + Date.now(), ...data, restaurantId: currentRestaurantId });
    localStorage.setItem('nexus_products', JSON.stringify(all));
    loadAdminProducts();
  }
  DOM.modalProductForm.classList.remove('active');
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  if (isFirebaseEnabled) {
    try { await deleteDoc(doc(db, 'businesses', currentRestaurantId, 'products', id)); }
    catch (err) { alert(`Error: ${err.message}`); }
  } else {
    let all = JSON.parse(localStorage.getItem('nexus_products')) || [];
    all = all.filter(p => p.id !== id);
    localStorage.setItem('nexus_products', JSON.stringify(all));
    loadAdminProducts();
  }
}

// ============================================================
// ORDERS
// ============================================================
function loadAdminOrders() {
  if (ordersUnsubscribe) ordersUnsubscribe();
  if (isFirebaseEnabled) {
    ordersUnsubscribe = onSnapshot(
      query(collection(db, 'orders'), where('storeId', '==', currentRestaurantId)),
      (snap) => {
        orders = [];
        snap.forEach(d => orders.push({ firestoreId: d.id, ...d.data() }));
        renderOrders();
      }
    );
  } else {
    orders = (JSON.parse(localStorage.getItem('nexus_orders')) || [])
      .filter(o => o.storeId === currentRestaurantId || o.restaurantId === currentRestaurantId);
    renderOrders();
  }
}

function renderOrders() {
  DOM.adminOrdersList.innerHTML = '';
  const pending = orders.filter(o => o.status === 'pendiente' || o.status === 'preparando').length;
  DOM.adminPendingBadge.innerText = pending;
  DOM.adminPendingBadge.style.display = pending > 0 ? 'inline-flex' : 'none';

  // Update stats
  DOM.statPending.innerText = orders.filter(o => o.status === 'pendiente').length;
  DOM.statPreparing.innerText = orders.filter(o => o.status === 'preparando').length;
  DOM.statTransit.innerText = orders.filter(o => o.status === 'transit').length;
  DOM.statCompleted.innerText = orders.filter(o => o.status === 'completed').length;

  if (orders.length === 0) {
    DOM.adminOrdersList.innerHTML = `<div class="empty-state"><i class="bx bx-receipt"></i><p>No hay pedidos registrados.</p></div>`;
    return;
  }

  const sorted = [...orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  sorted.forEach(o => {
    const refId = o.firestoreId || o.id;
    const card = document.createElement('div');
    card.className = 'order-card glass-card';
    const statusColors = { pendiente: '#f59e0b', preparando: '#0ea5e9', transit: '#8b5cf6', completed: '#10b981' };
    const color = statusColors[o.status] || '#64748b';
    const items = (o.items || []).map(i => `${i.qty}x ${i.name}`).join(', ');

    let actionBtn = '';
    if (o.status === 'pendiente') actionBtn = `<button class="primary-btn btn-sm" data-ref="${refId}" data-next="preparando">✔ Aceptar</button>`;
    else if (o.status === 'preparando') actionBtn = `<button class="primary-btn btn-sm btn-info" data-ref="${refId}" data-next="transit">🚴 Despachar</button>`;
    else if (o.status === 'transit') actionBtn = `<button class="primary-btn btn-sm btn-success" data-ref="${refId}" data-next="completed">✔ Entregado</button>`;

    card.innerHTML = `
      <div style="border-left:3px solid ${color}; padding-left:12px;">
        <div style="font-size:0.75rem;font-weight:800;color:${color};font-family:var(--font-mono);">#${(o.id||'???').replace('NEX-','')}</div>
        <div style="font-weight:600;margin-top:2px;">${o.customer || o.name || '?'}</div>
        <div style="font-size:0.75rem;color:var(--text-muted)">📍 ${o.address || '?'} · 📞 ${o.phone || '?'}</div>
      </div>
      <div>
        <div style="font-size:0.78rem;color:var(--text-secondary)">${items}</div>
        <span class="status-badge" style="margin-top:6px;display:inline-flex;background:${color}22;color:${color};border:1px solid ${color}44;">${o.status}</span>
      </div>
      <div class="order-right">
        <div class="order-total">$${(o.total || 0).toFixed(2)}</div>
        <div class="order-time">${o.time || ''}</div>
        <div style="margin-top:8px;">${actionBtn}</div>
      </div>`;

    card.querySelector('button[data-ref]')?.addEventListener('click', (ev) => {
      const btn = ev.currentTarget;
      advanceOrderStatus(btn.dataset.ref, btn.dataset.next);
    });

    DOM.adminOrdersList.appendChild(card);
  });
}

async function advanceOrderStatus(refId, nextStatus) {
  if (isFirebaseEnabled) {
    try { await updateDoc(doc(db, 'orders', refId), { status: nextStatus }); }
    catch (err) { console.error('Error actualizando pedido:', err); }
  } else {
    const all = JSON.parse(localStorage.getItem('nexus_orders')) || [];
    const o = all.find(o => o.firestoreId === refId || o.id === refId);
    if (o) { o.status = nextStatus; localStorage.setItem('nexus_orders', JSON.stringify(all)); loadAdminOrders(); }
  }
}

// ============================================================
// PROMOS
// ============================================================
function loadAdminPromos() {
  if (promosUnsubscribe) promosUnsubscribe();
  if (isFirebaseEnabled) {
    promosUnsubscribe = onSnapshot(
      query(collection(db, 'businesses', currentRestaurantId, 'promos')),
      (snap) => {
        promos = [];
        snap.forEach(d => promos.push({ id: d.id, ...d.data() }));
        renderPromos();
      }
    );
  } else {
    promos = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    renderPromos();
  }
}

function renderPromos() {
  DOM.adminPromosList.innerHTML = '';
  if (promos.length === 0) {
    DOM.adminPromosList.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bx bx-purchase-tag"></i><p>Sin promociones. ¡Crea tu primera oferta!</p></div>`;
    return;
  }

  promos.forEach(p => {
    const card = document.createElement('div');
    card.className = `promo-card${p.isActive === false ? ' promo-inactive' : ''}`;
    card.innerHTML = `
      <div class="promo-badge">${p.value}</div>
      <h4>${p.title}</h4>
      <p>${p.description || ''}</p>
      ${!p.isActive ? '<p style="font-size:0.72rem;color:var(--color-danger);margin-top:6px;">⚫ Inactiva</p>' : ''}
      <div class="promo-card-actions">
        <button class="primary-btn btn-sm btn-info edit-promo" data-id="${p.id}"><i class="bx bx-edit"></i> Editar</button>
        <button class="primary-btn btn-sm btn-danger del-promo" data-id="${p.id}"><i class="bx bx-trash"></i></button>
      </div>`;
    card.querySelector('.edit-promo').addEventListener('click', () => openPromoModal(p.id));
    card.querySelector('.del-promo').addEventListener('click', () => deletePromo(p.id));
    DOM.adminPromosList.appendChild(card);
  });
}

function openPromoModal(promoId = null) {
  if (promoId) {
    const p = promos.find(p => p.id === promoId);
    if (!p) return;
    DOM.promoModalTitle.innerText = 'Editar Promoción';
    DOM.promoId.value = p.id; DOM.promoTitle.value = p.title; DOM.promoValue.value = p.value;
    DOM.promoActive.checked = p.isActive !== false; DOM.promoDesc.value = p.description || ''; DOM.promoImg.value = p.imageUrl || '';
  } else {
    DOM.promoModalTitle.innerText = 'Nueva Promoción';
    DOM.promoForm.reset(); DOM.promoId.value = ''; DOM.promoActive.checked = true;
  }
  DOM.modalPromoForm.classList.add('active');
}

async function handlePromoSubmit(e) {
  e.preventDefault();
  const id = DOM.promoId.value;
  const data = {
    title: DOM.promoTitle.value.trim(), value: DOM.promoValue.value.trim(),
    isActive: DOM.promoActive.checked, description: DOM.promoDesc.value.trim(),
    imageUrl: DOM.promoImg.value.trim(), updatedAt: Date.now()
  };
  if (isFirebaseEnabled) {
    try {
      if (id) await updateDoc(doc(db, 'businesses', currentRestaurantId, 'promos', id), data);
      else await addDoc(collection(db, 'businesses', currentRestaurantId, 'promos'), data);
    } catch (err) { alert(`Error: ${err.message}`); }
  } else {
    const all = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    if (id) { const i = all.findIndex(p => p.id === id); if (i !== -1) all[i] = { id, ...data }; }
    else all.push({ id: 'promo-' + Date.now(), ...data });
    localStorage.setItem(`nexus_promos_${currentRestaurantId}`, JSON.stringify(all));
    loadAdminPromos();
  }
  DOM.modalPromoForm.classList.remove('active');
}

async function deletePromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  if (isFirebaseEnabled) {
    try { await deleteDoc(doc(db, 'businesses', currentRestaurantId, 'promos', id)); }
    catch (err) { alert(`Error: ${err.message}`); }
  } else {
    let all = JSON.parse(localStorage.getItem(`nexus_promos_${currentRestaurantId}`)) || [];
    all = all.filter(p => p.id !== id);
    localStorage.setItem(`nexus_promos_${currentRestaurantId}`, JSON.stringify(all));
    loadAdminPromos();
  }
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  // Product modal
  DOM.btnAddProduct.addEventListener('click', () => openProductModal());
  DOM.btnCloseProductModal.addEventListener('click', () => DOM.modalProductForm.classList.remove('active'));
  DOM.btnCancelProductModal.addEventListener('click', () => DOM.modalProductForm.classList.remove('active'));
  DOM.productForm.addEventListener('submit', handleProductSubmit);

  // Promo modal
  DOM.btnAddPromo.addEventListener('click', () => openPromoModal());
  DOM.btnClosePromoModal.addEventListener('click', () => DOM.modalPromoForm.classList.remove('active'));
  DOM.btnCancelPromoModal.addEventListener('click', () => DOM.modalPromoForm.classList.remove('active'));
  DOM.promoForm.addEventListener('submit', handlePromoSubmit);

  // Settings save
  DOM.btnSaveSettings.addEventListener('click', handleSettingsSave);
  DOM.formRestaurantConfig.addEventListener('submit', (e) => { e.preventDefault(); handleSettingsSave(); });

  // Business selector
  DOM.adminRestaurantSelect.addEventListener('change', (e) => {
    currentRestaurantId = e.target.value;
    onRestaurantChanged();
  });

  // Clear orders
  DOM.btnClearOrders.addEventListener('click', () => {
    if (!confirm('¿Limpiar historial de pedidos?')) return;
    if (!isFirebaseEnabled) {
      let all = JSON.parse(localStorage.getItem('nexus_orders')) || [];
      all = all.filter(o => (o.storeId || o.restaurantId) !== currentRestaurantId);
      localStorage.setItem('nexus_orders', JSON.stringify(all));
      loadAdminOrders();
    } else {
      alert('En Firebase, elimina registros desde la consola por seguridad.');
    }
  });
}
