/* ==========================================================================
   محرك التشغيل المركزي لأسواق البركة (Al-Barakah Engine)
   ========================================================================== */

// كلمة السر الرسمية للوحة الإدارة والكاشير
const STAFF_SECRET_PASSWORD = "1234";

// حالة التطبيق التفاعلية
let storeProducts = [];
let customerCart = [];
let posCart = [];
let activeDepartment = "ALL";

// 1. تهيئة النظام
window.addEventListener("DOMContentLoaded", () => {
  // جلب الأصناف من ملف products.js أو الـ LocalStorage إذا سبق تعديلها
  const savedCatalog = localStorage.getItem("albarakah_custom_products");
  storeProducts = savedCatalog ? JSON.parse(savedCatalog) : BARAKAH_PRODUCTS;

  // جلب السلة المحفوظة
  const savedCart = localStorage.getItem("albarakah_customer_basket");
  if (savedCart) customerCart = JSON.parse(savedCart);

  renderStoreCatalog();
  renderPosTouchCatalog();
  renderInventoryTable();
  updateCartUI();

  // تفعيل الاستماع لاختصار لوحة المفاتيح السري (Shift + Ctrl + A)
  setupStaffKeyboardShortcut();
});

/* ==========================================================================
   محرك الاختصار السري للدخول للكاشير والمخازن (Shift + Ctrl + A)
   ========================================================================== */
function setupStaffKeyboardShortcut() {
  window.addEventListener("keydown", (e) => {
    // التحقق من ضغط Ctrl + Shift + A معاً
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "A" || e.key === "a" || e.code === "KeyA")) {
      e.preventDefault();
      openStaffAuthModal();
    }
  });
}

function openStaffAuthModal() {
  document.getElementById("authModal").classList.add("open");
  setTimeout(() => {
    document.getElementById("staffPasswordInput").focus();
  }, 100);
}

function closeStaffAuthModal() {
  document.getElementById("authModal").classList.remove("open");
  document.getElementById("staffPasswordInput").value = "";
}

function verifyStaffAccess(e) {
  e.preventDefault();
  const enteredPass = document.getElementById("staffPasswordInput").value;

  if (enteredPass === STAFF_SECRET_PASSWORD) {
    closeStaffAuthModal();
    document.getElementById("staffPortal").classList.add("open");
    showToast("✓ مرحباً بك في منظومة إدارة الكاشير والمخازن");
    renderPosTable();
  } else {
    alert("عفواً! كلمة المرور غير صحيحة، الوصول محمي.");
  }
}

function exitStaffPortal() {
  document.getElementById("staffPortal").classList.remove("open");
}

function switchPortalTab(tabName, btn) {
  document.querySelectorAll(".portal-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".portal-view").forEach(v => v.classList.remove("active"));

  btn.classList.add("active");
  if (tabName === "pos") {
    document.getElementById("tabPos").classList.add("active");
  } else {
    document.getElementById("tabInventory").classList.add("active");
    renderInventoryTable();
  }
}

/* ==========================================================================
   عرض المنتجات بالمتجر الإلكتروني
   ========================================================================== */
function renderStoreCatalog() {
  const container = document.getElementById("productsCatalogContainer");
  const searchQuery = document.getElementById("liveSearchInput").value.trim().toLowerCase();
  container.innerHTML = "";

  const filtered = storeProducts.filter(p => {
    const matchesDept = activeDepartment === "ALL" || p.dept === activeDepartment;
    const matchesQuery = !searchQuery || 
      p.nameAr.toLowerCase().includes(searchQuery) || 
      p.brand.toLowerCase().includes(searchQuery) ||
      p.barcode.includes(searchQuery);
    return matchesDept && matchesQuery;
  });

  document.getElementById("totalItemsBadge").innerText = `${filtered.length} صنف متوفر`;

  filtered.forEach(p => {
    const cartItem = customerCart.find(i => i.id === p.id);
    const inQty = cartItem ? cartItem.qty : 0;
    const isOut = p.stock <= 0;

    const card = document.createElement("div");
    card.className = "card-item";
    card.innerHTML = `
      ${p.badge ? `<span class="card-badge">${p.badge}</span>` : ""}
      <div class="card-icon-preview">${p.icon}</div>
      <span class="card-brand">${p.brand}</span>
      <h4 class="card-title">${p.nameAr}</h4>
      <span class="card-unit">${p.unit}</span>
      <div class="card-price-row">
        <div class="price-box">${p.price.toFixed(2)} <small>ج.م</small></div>
        <span class="stock-pill ${p.stock < 20 ? 'low' : ''}">
          ${isOut ? 'نفد من المخزن' : `متاح: ${p.stock}`}
        </span>
      </div>
      <div>
        ${isOut ? `
          <button class="btn-disabled btn-block" disabled>غير متوفر</button>
        ` : inQty === 0 ? `
          <button class="btn-primary btn-block" onclick="adjustCustomerCart(${p.id}, 1)">أضف للسلة 🛒</button>
        ` : `
          <div class="qty-stepper">
            <button onclick="adjustCustomerCart(${p.id}, -1)">−</button>
            <span>${inQty}</span>
            <button onclick="adjustCustomerCart(${p.id}, 1)" ${inQty >= p.stock ? 'disabled' : ''}>+</button>
          </div>
        `}
      </div>
    `;
    container.appendChild(card);
  });
}

function filterDepartment(deptKey, btn) {
  activeDepartment = deptKey;
  document.querySelectorAll(".tab-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("currentDeptHeading").innerText = btn.innerText;
  renderStoreCatalog();
}

document.getElementById("liveSearchInput").addEventListener("input", renderStoreCatalog);

/* ==========================================================================
   سلة مشتريات المتجر (Customer Cart)
   ========================================================================== */
function adjustCustomerCart(productId, delta) {
  const prod = storeProducts.find(p => p.id === productId);
  if (!prod) return;

  const itemIdx = customerCart.findIndex(i => i.id === productId);
  if (itemIdx > -1) {
    const newQty = customerCart[itemIdx].qty + delta;
    if (newQty > prod.stock) {
      showToast("عذراً، وصلت للحد الأقصى المتاح بالمخزن!");
      return;
    }
    if (newQty <= 0) customerCart.splice(itemIdx, 1);
    else customerCart[itemIdx].qty = newQty;
  } else if (delta > 0) {
    customerCart.push({ id: prod.id, qty: 1 });
  }

  localStorage.setItem("albarakah_customer_basket", JSON.stringify(customerCart));
  renderStoreCatalog();
  updateCartUI();
}

function updateCartUI() {
  const countPill = document.getElementById("cartCountPill");
  const list = document.getElementById("cartItemsList");
  list.innerHTML = "";

  let subtotal = 0;
  let totalCount = 0;

  customerCart.forEach(item => {
    const p = storeProducts.find(x => x.id === item.id);
    if (!p) return;

    totalCount += item.qty;
    const line = p.price * item.qty;
    subtotal += line;

    const row = document.createElement("div");
    row.className = "cart-flyout-item";
    row.innerHTML = `
      <div style="font-size:26px">${p.icon}</div>
      <div style="flex:1">
        <strong>${p.nameAr}</strong><br>
        <small>${p.price.toFixed(2)} × ${item.qty} = <b>${line.toFixed(2)} ج.م</b></small>
      </div>
      <div class="qty-stepper" style="width:90px">
        <button onclick="adjustCustomerCart(${p.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="adjustCustomerCart(${p.id}, 1)">+</button>
      </div>
    `;
    list.appendChild(row);
  });

  countPill.innerText = totalCount;

  // حسابات الشحن والضريبة
  const isFreeShip = subtotal >= 500;
  const shipping = (subtotal === 0 || isFreeShip) ? 0 : 35;
  const vat = subtotal - (subtotal / 1.14);
  const grand = subtotal + shipping;

  document.getElementById("cartSubtotal").innerText = `${subtotal.toFixed(2)} ج.م`;
  document.getElementById("cartVat").innerText = `${vat.toFixed(2)} ج.م`;
  document.getElementById("cartShipping").innerText = isFreeShip ? "مجاني" : `${shipping.toFixed(2)} ج.م`;
  document.getElementById("cartGrandTotal").innerText = `${grand.toFixed(2)} ج.م`;

  // شريط الشحن
  const bar = document.getElementById("shippingBar");
  const percent = Math.min(100, Math.round((subtotal / 500) * 100));
  bar.style.width = `${percent}%`;
  document.getElementById("shippingStatusText").innerText = isFreeShip ? "🎉 حصلت على شحن مجاني!" : `أضف ${(500 - subtotal).toFixed(2)} ج.م للحصول على شحن مجاني`;
}

function toggleCartDrawer() {
  document.getElementById("cartFlyout").classList.toggle("open");
  document.getElementById("cartOverlay").classList.toggle("open");
}

function submitStoreOrder() {
  if (customerCart.length === 0) return showToast("السلة فارغة!");

  // خصم المخزون
  customerCart.forEach(item => {
    const p = storeProducts.find(x => x.id === item.id);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  });

  saveInventoryChanges();
  customerCart = [];
  localStorage.removeItem("albarakah_customer_basket");
  toggleCartDrawer();
  renderStoreCatalog();
  updateCartUI();
  alert("✓ تم استلام طلبك بنجاح من أسواق البركة وجاري تحضيره للتوصيل السريع!");
}

/* ==========================================================================
   منظومة الكاشير السريعة (POS Functions)
   ========================================================================== */
function handlePosBarcode(e) {
  e.preventDefault();
  const barcode = document.getElementById("posBarcodeInput").value.trim();
  const prod = storeProducts.find(p => p.barcode === barcode);

  if (prod) {
    addPosItem(prod.id);
    document.getElementById("posBarcodeInput").value = "";
  } else {
    showToast("الباركود غير مسجل في المخازن!");
  }
}

function addPosItem(productId) {
  const p = storeProducts.find(x => x.id === productId);
  if (!p || p.stock <= 0) return showToast("الصنف نافد من المخزن!");

  const idx = posCart.findIndex(i => i.id === productId);
  if (idx > -1) {
    if (posCart[idx].qty < p.stock) posCart[idx].qty++;
  } else {
    posCart.push({ id: productId, qty: 1 });
  }
  renderPosTable();
}

function renderPosTable() {
  const tbody = document.getElementById("posTableItems");
  tbody.innerHTML = "";
  let grandTotal = 0;

  posCart.forEach(item => {
    const p = storeProducts.find(x => x.id === item.id);
    if (!p) return;
    const line = p.price * item.qty;
    grandTotal += line;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${p.nameAr}</b><br><small style="color:#64748b">${p.barcode}</small></td>
      <td>${item.qty}</td>
      <td>${p.price.toFixed(2)}</td>
      <td><b>${line.toFixed(2)}</b></td>
      <td><button onclick="removePosItem(${p.id})" style="background:none;border:none;color:#ef4444;cursor:pointer">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("posDueAmount").innerText = `${grandTotal.toFixed(2)} ج.م`;
  calcChange();
}

function removePosItem(id) {
  posCart = posCart.filter(i => i.id !== id);
  renderPosTable();
}

function calcChange() {
  const total = posCart.reduce((sum, i) => {
    const p = storeProducts.find(x => x.id === i.id);
    return sum + (p ? p.price * i.qty : 0);
  }, 0);

  const cash = parseFloat(document.getElementById("posCashIn").value) || 0;
  const change = cash > total ? cash - total : 0;
  document.getElementById("posChangeDue").innerText = `${change.toFixed(2)} ج.م`;
}

function completePosReceipt() {
  if (posCart.length === 0) return showToast("فاتورة الكاشير فارغة!");

  // خصم فوري من المخزن
  posCart.forEach(item => {
    const p = storeProducts.find(x => x.id === item.id);
    if (p) p.stock = Math.max(0, p.stock - item.qty);
  });

  saveInventoryChanges();
  alert("✓ تمت المعاملة بنجاح، وطباعة إيصال الكاشير الحراري!");
  posCart = [];
  document.getElementById("posCashIn").value = "";
  renderPosTable();
  renderStoreCatalog();
}

function renderPosTouchCatalog() {
  const grid = document.getElementById("posTouchGrid");
  grid.innerHTML = "";
  storeProducts.forEach(p => {
    const btn = document.createElement("div");
    btn.className = "touch-btn";
    btn.innerHTML = `
      <div style="font-size:24px">${p.icon}</div>
      <b style="font-size:0.8rem;display:block">${p.nameAr}</b>
      <span style="color:#34d399">${p.price.toFixed(2)} ج.م</span>
    `;
    btn.onclick = () => addPosItem(p.id);
    grid.appendChild(btn);
  });
}

/* ==========================================================================
   لوحة جرد المخازن وتعديل الأسعار التفاعلية (Inventory Management)
   ========================================================================== */
function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTableBody");
  tbody.innerHTML = "";

  storeProducts.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-family:monospace">${p.barcode}</td>
      <td>${p.icon} <b>${p.nameAr}</b></td>
      <td>${p.dept}</td>
      <td>
        <input type="number" step="0.5" value="${p.price}" onchange="updateProductPrice(${p.id}, this.value)" style="width:80px" />
      </td>
      <td>
        <input type="number" value="${p.stock}" onchange="updateProductStock(${p.id}, this.value)" style="width:75px" />
      </td>
      <td>
        <span style="color:${p.stock < 20 ? '#ef4444' : '#10b981'};font-weight:bold">
          ${p.stock <= 0 ? 'نافد' : p.stock < 20 ? 'أوشك على النفاد' : 'متوفر'}
        </span>
      </td>
      <td>
        <button class="btn-primary" style="padding:4px 8px;font-size:0.75rem" onclick="quickAddStock(${p.id}, 20)">+20 حبة</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateProductPrice(id, val) {
  const p = storeProducts.find(x => x.id === id);
  if (p) {
    p.price = parseFloat(val) || p.price;
    saveInventoryChanges();
    showToast(`تم تحديث سعر: ${p.nameAr}`);
  }
}

function updateProductStock(id, val) {
  const p = storeProducts.find(x => x.id === id);
  if (p) {
    p.stock = parseInt(val, 10) || 0;
    saveInventoryChanges();
    showToast(`تم تحديث رصيد: ${p.nameAr}`);
  }
}

function quickAddStock(id, amount) {
  const p = storeProducts.find(x => x.id === id);
  if (p) {
    p.stock += amount;
    saveInventoryChanges();
    renderInventoryTable();
    showToast(`أضيفت ${amount} قطعة إلى ${p.nameAr}`);
  }
}

function saveInventoryChanges() {
  localStorage.setItem("albarakah_custom_products", JSON.stringify(storeProducts));
  renderStoreCatalog();
}

function showToast(msg) {
  const t = document.getElementById("toastMessage");
  t.innerText = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}
