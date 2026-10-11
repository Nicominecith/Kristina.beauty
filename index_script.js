﻿emailjs.init('NVEepTeYLVlNLke8z');

        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            light: '#FAF9F6',
                            beige: '#E5D3B3',
                            gold: '#C5A880',
                            dark: '#000000',
                            muted: '#4B4B4B'
                        }
                    },
                    fontFamily: {
                        sans: ['Montserrat', 'sans-serif'],
                        serif: ['Playfair Display', 'serif'],
                    }
                }
            }
        }

        document.addEventListener('contextmenu', e => e.preventDefault());
        document.onkeydown = function(e) {
            if (e.keyCode == 123 || (e.ctrlKey && e.shiftKey && (e.keyCode == 73 || e.keyCode == 74)) || (e.ctrlKey && (e.keyCode == 85 || e.keyCode == 83))) return false;
        };

// Boot-Animation Initialisierung
function initBootAnimation() {
    const loader = document.getElementById('intro-loader');
    if (!loader) return;

    // Ensure loader is visible
    loader.style.display = 'flex';
    loader.classList.remove('finished');

    // Set min date for date input
    const dateInp = document.getElementById('inp-date');
    if (dateInp) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const dd = String(today.getDate()).padStart(2, '0');
        dateInp.min = `${yyyy}-${mm}-${dd}`;
    }
    loadBookingPrefill();

    // Start animation sequence
    setTimeout(() => {
        if (loader && !loader.classList.contains('finished')) {
            loader.classList.add('exiting');
            setTimeout(() => {
                if (loader && !loader.classList.contains('finished')) {
                    loader.classList.add('finished');
                    const navbar = document.getElementById('navbar');
                    if (navbar) navbar.classList.add('nav-visible');
                    triggerReveals();
                }
            }, 700);
        }
    }, 2800);
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBootAnimation);
} else {
    // Page already loaded (in case of re-initialization)
    initBootAnimation();
}

function triggerReveals() {
    const items = document.querySelectorAll('.page-section.active .reveal-item');
    items.forEach((el, i) => setTimeout(() => el.classList.add('revealed'), i * 120));
}

let isTransitioning = false;
let currentPage = 'home';

function navigateTo(pageId) {
    if (isTransitioning || currentPage === pageId) return;
    isTransitioning = true;
    currentPage = pageId;
    const pageTitle = getPageTitle(pageId);
    window.history.pushState({ page: pageId }, pageTitle, '#' + pageId);
    performPageTransition(pageId);
}

function performPageTransition(pageId) {
    const pt = document.getElementById('page-transition');
    pt.classList.remove('sweep-out');
    pt.classList.add('sweep-in');
    pt.style.pointerEvents = 'all';
    setTimeout(() => {
        document.querySelectorAll('.page-section').forEach(s => { s.classList.remove('active'); s.style.opacity = '0'; });
        const target = document.getElementById('page-' + pageId);
        if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'instant' }); }
        const cartEl = document.getElementById('cart-summary');
        if (cartEl) { cartEl.classList.remove('expanded'); cartEl.classList.add('collapsed'); }
        pt.classList.remove('sweep-in');
        pt.classList.add('sweep-out');
        setTimeout(() => {
            if (target) {
                target.style.transition = 'opacity 0.4s ease';
                target.style.opacity = '1';
                const reveals = target.querySelectorAll('.reveal-item');
                reveals.forEach((el, i) => { el.classList.remove('revealed'); setTimeout(() => el.classList.add('revealed'), 80 + i * 110); });
            }
            pt.style.pointerEvents = 'none';
            isTransitioning = false;
        }, 600);
    }, 500);
    const menu = document.getElementById('mobile-menu');
    menu.classList.add('hidden');
    menu.classList.remove('flex');
}

function getPageTitle(pageId) {
    const titles = {
        'home': 'KRISTINA BEAUTY | Studio',
        'treatments': 'KRISTINA BEAUTY | Preisliste',
        'behandlungen': 'KRISTINA BEAUTY | Behandlungen',
        'booking': 'KRISTINA BEAUTY | Buchung',
        'reviews': 'KRISTINA BEAUTY | Bewertungen',
        'contact': 'KRISTINA BEAUTY | Kontakt',
        'legal': 'KRISTINA BEAUTY | Impressum',
        'datenschutz': 'KRISTINA BEAUTY | Datenschutz',
        'widerruf': 'KRISTINA BEAUTY | Widerruf'
    };
    return titles[pageId] || 'KRISTINA BEAUTY';
}

window.addEventListener('popstate', (e) => {
    const pageId = e.state?.page || 'home';
    currentPage = pageId;
    isTransitioning = true;
    performPageTransition(pageId);
});

window.addEventListener('load', () => {
    const hash = window.location.hash.slice(1) || 'home';
    if (hash !== 'home') {
        currentPage = hash;
        const target = document.getElementById('page-' + hash);
        if (target) {
            document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
            target.classList.add('active');
            window.history.replaceState({ page: hash }, getPageTitle(hash), '#' + hash);
        }
    } else {
        window.history.replaceState({ page: 'home' }, 'KRISTINA BEAUTY | Studio', '#home');
    }
});

document.getElementById('mobile-menu-btn').onclick = () => {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
    menu.classList.toggle('flex');
};

function toggleCartDrawer() {
    const cart = document.getElementById('cart-summary');
    if (!cart) return;
    if (cart.classList.contains('collapsed')) {
        cart.classList.remove('collapsed');
        cart.classList.add('expanded');
    } else {
        cart.classList.remove('expanded');
        cart.classList.add('collapsed');
    }
}

let toastTimeout = null;
function showToast(title, sub) {
    const toast = document.getElementById('validation-toast');
    document.getElementById('toast-title').textContent = title || 'Bitte alles ausfüllen';
    document.getElementById('toast-sub').textContent = sub || 'Markierte Felder sind Pflichtfelder.';
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => hideToast(), 5000);
}
function hideToast() {
    document.getElementById('validation-toast').classList.remove('show');
}

let successToastTimeout = null;
function showSuccessToast() {
    const toast = document.getElementById('success-toast');
    toast.classList.add('show');
    clearTimeout(successToastTimeout);
    successToastTimeout = setTimeout(() => toast.classList.remove('show'), 5000);
}

function switchTab(tabId, btn) {
    document.querySelectorAll('.treatment-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.treatment-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    btn.classList.add('active');
}
function toggleFaq(btn) {
    const item = btn.parentElement;
    const isOpen = item.classList.contains('open');
    item.parentElement.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
}

let openTip = null, tipHideTimeout = null;
function showTip(id) { clearTimeout(tipHideTimeout); if (openTip && openTip !== id) hideTip(openTip); const el = document.getElementById(id); if (el) { el.classList.remove('hidden'); el.classList.add('visible'); } openTip = id; }
function hideTip(id) { tipHideTimeout = setTimeout(() => { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.classList.remove('visible'); } if (openTip === id) openTip = null; }, 400); }
function toggleTip(id) { const el = document.getElementById(id); if (!el) return; if (el.classList.contains('hidden')) showTip(id); else { el.classList.add('hidden'); el.classList.remove('visible'); } openTip = null; }
document.addEventListener('click', (e) => { if (openTip && !e.target.closest('.price-item')) { const el = document.getElementById(openTip); if (el) { el.classList.add('hidden'); el.classList.remove('visible'); } openTip = null; } });

const fullPriceListData = [
    { category: "Lashes Neuauflage", items: [
        { name: "1:1 Classic Lashes", price: "75€" },
        { name: "Hybrid Lashes", price: "80€" },
        { name: "Wet Look | Angel Set", price: "85€" },
        { name: "Volume Lashes", price: "85€" },
        { name: "Mega Volume", price: "100€", oldPrice: "90€" },
        { name: "Foxy Lashes", price: "100€", oldPrice: "90€" },
        { name: "Wispy (Aufpreis)", price: "+ 5€", details: ["Aufpreis auf jedes beliebige Set. Beispiel: Classic + Wispy = 80€"] }
    ]},
    { category: "Refill", items: [
        { name: "Bis zu 2 Wochen", price: "45€" },
        { name: "Bis zu 3 Wochen", price: "52€" },
        { name: "Bis zu 4 Wochen", price: "58€" },
        { name: "Wimpern entfernen", price: "10€" }
    ]},
    { category: "Liftings", items: [
        { name: "Browlifting inkl. Farbe", price: "45€" },
        { name: "Lashlifting inkl. Farbe", price: "55€" },
        { name: "Korean Lashlifting", price: "78€", isNew: true },
        { name: "Kombilifting", price: "90€" },
        { name: "Farbe", price: "6€" },
        { name: "Shape", price: "6€" },
        { name: "Shape & Farbe", price: "10€" }
    ]},
    { category: "Permanent Make Up", items: [
        { name: "Powderbrows", price: "160€" },
        { name: "Ombrebrows", price: "160€" },
        { name: "Kombibrows", price: "180€" },
        { name: "Aquarellips", price: "160€" },
        { name: "Velvetlips", price: "170€" },
        { name: "Ombrelips", price: "160€" }
    ]},
    { category: "Facials", items: [
        { name: "Microneedling 45min", price: "85€", details: ["Reinigung", "Enzympeeling", "Serum", "Maske", "Abschlusspflege"] },
        { name: "Microneedling Deluxe 70min", price: "95€", details: ["Reinigung – Double Cleansing", "Skin-Scrubber", "Enzym / Fruchtsäurepeeling", "Serum", "Maske", "Gesichts- und Kopfmassage", "Abschlusspflege", "inkl. Heimpflege"] },
        { name: "Microneedling mit Lachs-DNA", price: "135€", isNew: true, details: ["Reinigung", "Enzympeeling", "Lachs-DNA-Serum", "Maske", "Abschlusspflege"] },
        { name: "Aquafacial 60min", price: "90€", details: ["Reinigung", "Skin-Scrubber", "Peeling", "Serum", "Maske", "Abschlusspflege", "Gesichts- und Kopfmassage", "inkl. Heimpflege"] },
        { name: "BB Glow Augenringe", price: "36€" },
        { name: "BB Glow Gesicht", price: "80€" }
    ]},
    { category: "Facials Pakete", items: [
        { name: "Kombipaket Aquafacial & Microneedling", price: "150€" },
        { name: "Microneedling 3er Paket", price: "225€" },
        { name: "Microneedling 6er Paket", price: "485€" }
    ]},
    { category: "Remover / Tattooentfernung", items: [
        { name: "Erste Removerbehandlung", price: "105€" },
        { name: "Jede weitere Behandlung", price: "80€" },
        { name: "Tattooentfernung (bis 10cm)", price: "Nach Anfrage" }
    ]}
];

const priceListContainer = document.getElementById('full-price-list');
fullPriceListData.forEach(({ category, items }, ci) => {
    const card = document.createElement('div');
    card.className = "bg-white p-6 sm:p-8 md:p-10 lg:p-12 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-gray-100 price-card reveal-item";
    card.style.transitionDelay = (ci * 0.08) + 's';
    card.innerHTML = `
        <div class="mb-7 md:mb-10 text-center">
            <h3 class="text-[11px] font-bold tracking-[0.4em] uppercase text-brand-gold mb-2">${category}</h3>
            <div class="w-8 h-[1px] bg-brand-gold/30 mx-auto"></div>
        </div>
        <div class="flex flex-col flex-grow">
            ${items.map(i => {
                const hasDetails = i.details && i.details.length > 0;
                const tooltipId = 'tip-' + Math.random().toString(36).substr(2,8);
                return `
                <div class="price-item group relative${hasDetails ? ' cursor-pointer' : ''}" ${hasDetails ? `onclick="toggleTip('${tooltipId}')" onmouseenter="showTip('${tooltipId}')" onmouseleave="hideTip('${tooltipId}')"` : ''}>
                    <span class="font-medium text-[10px] uppercase tracking-wider text-gray-700 flex items-center gap-1.5 flex-shrink-0">
                        ${i.name}
                        ${i.isNew ? `<span class="price-new">Neu</span>` : ''}${i.oldPrice ? `<span class="price-new price-changed">Neuer Preis</span>` : ''}
                        ${hasDetails ? `<span class="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-gold/15 text-brand-gold text-[9px] font-bold flex-shrink-0" title="Details">i</span>` : ''}
                    </span>
                    <div class="price-dots"></div>
                    <span class="font-serif text-brand-gold font-bold text-lg whitespace-nowrap flex-shrink-0">${i.oldPrice ? `<s class="price-old">${i.oldPrice}</s> ` : ''}${i.price}</span>
                    ${hasDetails ? `
                    <div id="${tooltipId}" class="price-tooltip hidden absolute left-0 top-full mt-2 z-50 bg-white border border-brand-gold/20 rounded-2xl shadow-xl p-4 min-w-[200px] max-w-[280px]" onclick="event.stopPropagation()">
                        <p class="text-[9px] font-bold tracking-[0.3em] uppercase text-brand-gold mb-3">Enthält</p>
                        <ul class="space-y-1.5">
                            ${i.details.map(d => `<li class="flex items-center gap-2 text-xs text-gray-600 font-light"><span class="w-1 h-1 rounded-full bg-brand-gold flex-shrink-0"></span>${d}</li>`).join('')}
                        </ul>
                    </div>` : ''}
                </div>`;
            }).join('')}
        </div>`;
    if (priceListContainer) priceListContainer.appendChild(card);
});

// ── Discount codes ──────────────────────────────────────────────
let appliedCodes = []; // Stores objects like { code: 'LIFT3', discount: 5, label: 'LIFT3', requiresCat: null }

function onDiscountInput(input) {
    const val = input.value.trim();
    const btn = document.getElementById('discount-apply-btn');
    const errEl = document.getElementById('discount-msg-error');
    if (btn) btn.style.display = val.length > 0 ? '' : 'none';
    if (input) input.classList.remove('has-error');
    if (errEl) errEl.style.display = 'none';
}

async function applyDiscountCode() {
    const input = document.getElementById('inp-discount');
    const errEl = document.getElementById('discount-msg-error');
    const code  = input.value.trim().toUpperCase();
    
    if (!code) return;
    if (appliedCodes.some(item => item.code === code)) {
        showDiscountError('Code bereits hinzugefügt');
        return;
    }

    if (input) input.disabled = true;
    const result = await CouponManager.validateCoupon(code);
    if (input) input.disabled = false;

    if (result.success && !result.redeemed) {
        appliedCodes.push({
            code: result.code,
            discount: result.discount || 0,
            label: result.label || result.code,
            requiresCat: result.requiresCat || null
        });
        input.value = '';
        renderDiscountChips();
        updateCart();
    } else {
        showDiscountError(result.message || 'Code ungültig');
    }
}

function removeDiscountCode(code) {
    appliedCodes = appliedCodes.filter(item => item.code !== code);
    renderDiscountChips();
    updateCart();
}

function renderDiscountChips() {
    const container = document.getElementById('discount-chips');
    if (!container) return;
    if (appliedCodes.length === 0) {
        container.style.setProperty('display', 'none', 'important');
        container.innerHTML = '';
        return;
    }
    container.style.removeProperty('display');
    container.style.display = 'flex';
    container.innerHTML = appliedCodes.map(item => { 
        return `<span class="discount-chip">
            <i class="fas fa-tag" style="font-size:9px;opacity:0.7;"></i>
            ${item.code}
            <span style="font-size:10px;font-weight:400;opacity:0.75;">−${item.discount} €</span>
            <button class="discount-chip-remove" onclick="removeDiscountCode('${item.code}')" title="Entfernen">
                <i class="fas fa-times" style="font-size:9px;"></i>
            </button>
        </span>`;
    }).join('');
}

function showDiscountError(msg) {
    const input = document.getElementById('inp-discount');
    const errEl = document.getElementById('discount-msg-error');
    if (input) input.classList.add('has-error');
    if (errEl) { errEl.innerHTML = `<i class="fas fa-circle-exclamation text-[10px]"></i> ${msg}`; errEl.style.display = 'flex'; }
}

function validateDiscountCode(input) { onDiscountInput(input); }
// ────────────────────────────────────────────────────────────────

const STORAGE_KEY_LOCAL = 'kristina_beauty_bookings';
const PREFILL_KEY = 'kristina_beauty_booking_prefill';

function buildCalendarKey(dateIso) {
    const [y, m, d] = dateIso.split('-').map(Number);
    return `${y}-${m}-${d}`;
}

function getStoredBookings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_LOCAL) || '{}');
    } catch (err) {
        console.warn('Konnte gespeicherte Buchungen nicht laden', err);
        return {};
    }
}

function saveStoredBookings(bookings) {
    localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(bookings));
}

async function loadLiveBookings() {
    try {
        const res = await fetch('/.netlify/functions/bookings');
        const data = await res.json();
        localStorage.setItem(STORAGE_KEY_LOCAL, JSON.stringify(data));
    } catch (e) { console.error("Live-Daten konnten nicht geladen werden", e); }
}

// Lade Live-Daten beim Start
loadLiveBookings();
setInterval(loadLiveBookings, 60000); // Jede Minute aktualisieren

function addBookingToStorage(booking) {
    const bookings = getStoredBookings();
    const key = booking.key || booking.dateKey;
    // Puhse zu API
    fetch('/.netlify/functions/bookings', {
        method: 'POST',
        body: JSON.stringify(booking)
    }).then(() => loadLiveBookings());
}

function loadBookingPrefill() {
    try {
        const raw = localStorage.getItem(PREFILL_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        localStorage.removeItem(PREFILL_KEY);
        if (data.date) {
            const dateInp = document.getElementById('inp-date');
            if (dateInp) {
                dateInp.value = data.date;
            }
        }
        if (data.time) {
            const timeSel = document.getElementById('inp-time');
            if (timeSel) {
                timeSel.value = data.time.endsWith(' Uhr') ? data.time : `${data.time} Uhr`;
            }
        }
    } catch (err) {
        console.warn('Konnte Vorbelegung nicht laden', err);
    }
}

const bookingServices = [
    { cat: "Lashes Neuauflage", name: "1:1 Classic Lashes", price: 75 },
    { cat: "Lashes Neuauflage", name: "Hybrid Lashes", price: 80 },
    { cat: "Lashes Neuauflage", name: "Wet Look / Angel Set", price: 85 },
    { cat: "Lashes Neuauflage", name: "Volume Lashes", price: 85 },
    { cat: "Lashes Neuauflage", name: "Mega Volume", price: 100 },
    { cat: "Lashes Neuauflage", name: "Foxy Lashes", price: 100 },
    { cat: "Refill", name: "Refill bis 2 Wochen", price: 45 },
    { cat: "Refill", name: "Refill bis 3 Wochen", price: 52 },
    { cat: "Refill", name: "Refill bis 4 Wochen", price: 58 },
    { cat: "Refill", name: "Wimpern entfernen", price: 10 },
    { cat: "Liftings", name: "Browlifting inkl. Farbe", price: 45 },
    { cat: "Liftings", name: "Lashlifting inkl. Farbe", price: 55 },
    { cat: "Liftings", name: "Korean Lashlifting", price: 78 },
    { cat: "Liftings", name: "Kombilifting", price: 90 },
    { cat: "Liftings", name: "Farbe", price: 6 },
    { cat: "Liftings", name: "Shape", price: 6 },
    { cat: "Liftings", name: "Shape & Farbe", price: 10 },
    { cat: "Permanent Make Up", name: "Powderbrows", price: 160 },
    { cat: "Permanent Make Up", name: "Ombrebrows", price: 160 },
    { cat: "Permanent Make Up", name: "Kombibrows", price: 180 },
    { cat: "Permanent Make Up", name: "Aquarellips", price: 160 },
    { cat: "Permanent Make Up", name: "Velvetlips", price: 170 },
    { cat: "Permanent Make Up", name: "Ombrelips", price: 160 },
    { cat: "Facials", name: "Microneedling 45min", price: 85 },
    { cat: "Facials", name: "Microneedling Deluxe 70min", price: 95 },
    { cat: "Facials", name: "Microneedling mit Lachs-DNA", price: 135 },
    { cat: "Facials", name: "Aquafacial 60min", price: 90 },
    { cat: "Facials", name: "BB Glow Augenringe", price: 36 },
    { cat: "Facials", name: "BB Glow Gesicht", price: 80 },
    { cat: "Facials Pakete", name: "Kombipaket Aquafacial & Microneedling", price: 150 },
    { cat: "Facials Pakete", name: "Microneedling 3er Paket", price: 225 },
    { cat: "Facials Pakete", name: "Microneedling 6er Paket", price: 485 },
    { cat: "Remover", name: "Erste Removerbehandlung", price: 105 },
    { cat: "Remover", name: "Jede weitere Removerbehandlung", price: 80 },
];

const quantities = {};
bookingServices.forEach((_, i) => quantities[i] = 0);

function getCategories() {
    const cats = [];
    bookingServices.forEach(s => { if (!cats.includes(s.cat)) cats.push(s.cat); });
    return cats;
}

function renderBookingServices() {
    const container = document.getElementById('booking-services');
    container.innerHTML = '';
    const cats = getCategories();
    cats.forEach(cat => {
        const servicesInCat = bookingServices.filter(s => s.cat === cat);
        const catIndices = servicesInCat.map(s => bookingServices.indexOf(s));
        const catTotal = catIndices.reduce((sum, i) => sum + quantities[i], 0);
        const wrapper = document.createElement('div');
        wrapper.className = 'booking-category';
        const header = document.createElement('button');
        header.type = 'button';
        header.className = 'booking-category-header' + (catTotal > 0 ? ' has-items' : '');
        header.setAttribute('data-cat', cat);
        header.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-dark">${cat}</span>
                ${catTotal > 0 ? `<span class="cat-item-badge">${catTotal}</span>` : ''}
            </div>
            <i class="fas fa-chevron-down text-xs text-gray-400 transition-transform duration-300" style="transform: rotate(0deg)"></i>`;
        header.onclick = () => toggleCategory(cat);
        const body = document.createElement('div');
        body.className = 'booking-category-body';
        body.setAttribute('id', 'catbody-' + cat.replace(/\s+/g,'_'));
        servicesInCat.forEach(service => {
            const idx = bookingServices.indexOf(service);
            const line = document.createElement('div');
            line.className = 'service-line';
            line.innerHTML = `
                <div class="service-line-name">${service.name}</div>
                <div class="service-line-price">${service.price} €</div>
                <div class="qty-stepper">
                    <button type="button" class="qty-btn" onclick="changeQty(${idx}, -1)" ${quantities[idx] === 0 ? 'disabled' : ''}>−</button>
                    <div class="qty-num" id="qty-${idx}">${quantities[idx]}</div>
                    <button type="button" class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
                </div>`;
            body.appendChild(line);
        });
        wrapper.appendChild(header);
        wrapper.appendChild(body);
        container.appendChild(wrapper);
    });
}

let openCategories = new Set();
function toggleCategory(cat) {
    const bodyId = 'catbody-' + cat.replace(/\s+/g,'_');
    const body = document.getElementById(bodyId);
    if (!body) return;
    const isOpen = body.classList.contains('open');
    if (isOpen) { body.classList.remove('open'); openCategories.delete(cat); }
    else { body.classList.add('open'); openCategories.add(cat); }
    document.querySelectorAll('.booking-category-header').forEach(h => {
        if (h.getAttribute('data-cat') === cat) {
            const icon = h.querySelector('.fa-chevron-down');
            if (icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    });
}

function changeQty(idx, delta) {
    quantities[idx] = Math.max(0, quantities[idx] + delta);
    const hasItems = Object.values(quantities).some(q => q > 0);
    const warning = document.getElementById('no-service-warning');
    if (hasItems && warning) warning.classList.remove('show');
    renderBookingServices();
    openCategories.forEach(cat => {
        const bodyId = 'catbody-' + cat.replace(/\s+/g,'_');
        const body = document.getElementById(bodyId);
        if (body) {
            body.classList.add('open');
            document.querySelectorAll('.booking-category-header').forEach(h => {
                if (h.getAttribute('data-cat') === cat) {
                    const icon = h.querySelector('.fa-chevron-down');
                    if (icon) icon.style.transform = 'rotate(180deg)';
                }
            });
        }
    });
    updateCart();
}

function updateCart() {
    let total = 0;
    let html = '';
    let itemCount = 0;
    bookingServices.forEach((s, i) => {
        if (quantities[i] > 0) {
            const lineTotal = s.price * quantities[i];
            total += lineTotal;
            itemCount += quantities[i];
            html += `<div class="cart-line">
                <div>
                    <div class="cart-line-name">${s.name}</div>
                    <span class="cart-line-qty">${quantities[i]}× ${s.price} €</span>
                </div>
                <div class="cart-line-price">${lineTotal} €</div>
            </div>`;
        }
    });
    const hasLiftings = bookingServices.some((s, i) => quantities[i] > 0 && s.cat === 'Liftings');
    let discountAmount = 0;
    (typeof appliedCodes !== 'undefined' ? appliedCodes : []).forEach(item => { // 'item' is the full object
        // No need to look up in VALID_CODES
        if (!item.requiresCat || hasLiftings) discountAmount += item.discount;
    });
    const discountActive = discountAmount > 0 && itemCount > 0;
    const finalTotal = discountActive ? Math.max(0, total - discountAmount) : total;

    const hasItems = itemCount > 0;
    const countText = hasItems ? itemCount + (itemCount === 1 ? ' Behandlung' : ' Behandlungen') : '';
    const emptyD = document.getElementById('cart-empty-desktop');
    const linesD = document.getElementById('cart-lines-desktop');
    const totalWD = document.getElementById('cart-total-wrapper-desktop');
    const totalD = document.getElementById('cart-total-desktop');
    const countD = document.getElementById('cart-count-desktop');
    const discD  = document.getElementById('cart-discount-line-desktop');
    if (emptyD) emptyD.style.display = hasItems ? 'none' : '';
    if (linesD) { linesD.classList.toggle('hidden', !hasItems); if (hasItems) linesD.innerHTML = html.replace(/â‚¬/g, '€'); }
    if (totalWD) totalWD.classList.toggle('hidden', !hasItems);
    if (totalD) totalD.textContent = finalTotal + ' €';
    if (countD) countD.textContent = countText;
    if (discD) {
        discD.classList.toggle('hidden', !discountActive);
        if (discountActive) discD.innerHTML = `<span class="text-[10px] font-bold tracking-[0.2em] uppercase text-green-600">Rabatt</span><span class="text-[13px] font-bold text-green-600">− ${discountAmount} €</span>`;
    }
    const emptyM = document.getElementById('cart-empty-mobile');
    const linesM = document.getElementById('cart-lines-mobile');
    const totalWM = document.getElementById('cart-total-wrapper-mobile');
    const totalMF = document.getElementById('cart-total-mobile-full');
    const totalMB = document.getElementById('cart-total-mobile');
    const countM = document.getElementById('cart-count-mobile');
    const discM  = document.getElementById('cart-discount-line-mobile');
    if (emptyM) emptyM.style.display = hasItems ? 'none' : '';
    if (linesM) { linesM.classList.toggle('hidden', !hasItems); if (hasItems) linesM.innerHTML = html.replace(/â‚¬/g, '€'); }
    if (totalWM) totalWM.classList.toggle('hidden', !hasItems);
    if (totalMF) totalMF.textContent = finalTotal + ' €';
    if (totalMB) totalMB.textContent = hasItems ? finalTotal + ' €' : '';
    if (countM) countM.textContent = hasItems ? '(' + itemCount + ')' : '';
    if (discM) {
        discM.classList.toggle('hidden', !discountActive);
        if (discountActive) discM.innerHTML = `<span class="text-[10px] font-bold tracking-[0.2em] uppercase text-green-600">Rabatt</span><span class="text-[13px] font-bold text-green-600">− ${discountAmount} €</span>`;
    }
    if (hasItems && window.innerWidth < 768) {
        const cart = document.getElementById('cart-summary');
        if (cart && cart.classList.contains('collapsed')) {
            cart.classList.remove('collapsed');
            cart.classList.add('expanded');
        }
    }
}

function setFieldError(inputId, errorId, hasError) {
    const inp = document.getElementById(inputId);
    const err = document.getElementById(errorId);
    if (!inp || !err) return;
    if (hasError) {
        inp.classList.add('has-error');
        err.classList.add('show');
        inp.addEventListener('input', () => {
            inp.classList.remove('has-error');
            err.classList.remove('show');
        }, { once: true });
    } else {
        inp.classList.remove('has-error');
        err.classList.remove('show');
    }
}

function clearAllErrors() {
    ['inp-vorname','inp-nachname','inp-phone','inp-email','inp-date','inp-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('has-error');
    });
    ['err-vorname','err-nachname','err-phone','err-email','err-date','err-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
    });
    const w = document.getElementById('no-service-warning');
    if (w) w.classList.remove('show');
}

function setBtnsLoading(loading) {
    ['submit-btn', 'submit-btn-mobile'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        if (loading) {
            btn.disabled = true;
            btn.classList.add('btn-sending');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2 text-xs"></i> Wird gesendet …';
        } else {
            btn.disabled = false;
            btn.classList.remove('btn-sending');
            btn.innerHTML = '<i class="fas fa-paper-plane mr-2 text-xs"></i> Anfrage absenden';
        }
    });
}

function submitBooking() {
    clearAllErrors();
    hideToast(); // Ensure toast is hidden before new validation
    const vorname = document.getElementById('inp-vorname').value.trim();
    const nachname = document.getElementById('inp-nachname').value.trim();
    const email = document.getElementById('inp-email').value.trim();
    const phone = document.getElementById('inp-phone').value.trim();
    const datum = document.getElementById('inp-date').value;
    const zeit = document.getElementById('inp-time').value;
    const notes = document.getElementById('inp-notes').value.trim();
    const hasItems = Object.values(quantities).some(q => q > 0);
    const errors = [];
    if (!hasItems) errors.push('service');
    if (!vorname)  errors.push('vorname');
    if (!nachname) errors.push('nachname');
    if (!phone)    errors.push('phone');
    if (!email)    errors.push('email');
    if (!datum)    errors.push('date');
    if (!zeit)     errors.push('time');
    if (errors.length > 0) {
        if (!hasItems) document.getElementById('no-service-warning').classList.add('show');
        setFieldError('inp-vorname', 'err-vorname', !vorname);
        setFieldError('inp-nachname', 'err-nachname', !nachname);
        setFieldError('inp-phone', 'err-phone', !phone);
        setFieldError('inp-email', 'err-email', !email);
        setFieldError('inp-date', 'err-date', !datum);
        setFieldError('inp-time', 'err-time', !zeit);
        const missing = [];
        if (!hasItems) missing.push('Behandlung');
        if (!vorname || !nachname) missing.push('Name');
        if (!phone) missing.push('Telefon');
        if (!email) missing.push('E-Mail');
        if (!datum) missing.push('Datum');
        if (!zeit) missing.push('Zeit');
        showToast('Bitte alles ausfüllen', 'Fehlend: ' + missing.join(', '));
        ['submit-btn', 'submit-btn-mobile'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.remove('shake');
                void btn.offsetWidth;
                btn.classList.add('shake');
                btn.addEventListener('animationend', () => btn.classList.remove('shake'), { once: true });
            }
        });
        if (!hasItems) {
            document.getElementById('booking-services').scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            const firstErr = document.querySelector('.form-input.has-error');
            if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    let behandlungLines = [];
    let total = 0;
    bookingServices.forEach((s, i) => {
        if (quantities[i] > 0) {
            behandlungLines.push(`${quantities[i]}× ${s.name} (${s.price * quantities[i]} €)`);
            total += s.price * quantities[i];
        }
    });
    const behandlung = behandlungLines.join('\n'); // Corrected variable name
    const preis      = total + ' €';
    const name       = vorname + ' ' + nachname;
    const hasLiftings   = bookingServices.some((s, i) => quantities[i] > 0 && s.cat === 'Liftings');
    let discountAmount = 0;
    appliedCodes.forEach(item => {
        if (!item.requiresCat || hasLiftings) discountAmount += item.discount;
    });
    const finalTotal    = Math.max(0, total - discountAmount);
    const rabatt        = appliedCodes.length > 0 ? appliedCodes.map(item => item.code).join(', ') + ` (− ${discountAmount} €)` : 'Kein Rabattcode';
    const storedServices = bookingServices
        .map((s, i) => ({ ...s, quantity: quantities[i] }))
        .filter(s => s.quantity > 0);
    const bookingObj = {
        id: `b_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        key: buildCalendarKey(datum),
        date: datum,
        time: zeit.replace(/\s*Uhr$/, ''),
        name,
        email,
        phone,
        services: storedServices,
        service: storedServices.map(s => `${s.name}${s.quantity > 1 ? ' x' + s.quantity : ''}`).join(', '),
        notes: notes || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        appliedDiscountCodes: appliedCodes.map(c => ({ code: c.code, discount: c.discount })), // Store applied codes and their amounts
        total: finalTotal
    };
    const templateParams = {
        name: name,
        datum: datum,
        email: email,
        telefon: phone,
        behandlung: behandlung,
        preis: finalTotal + ' €' + (discountAmount > 0 ? ` (inkl. ${discountAmount} € Rabatt)` : ''),
        zeit: zeit,
        zahlungsart: 'Bar',
        anmerkungen: (notes || '–') + '\n' + rabatt
    };

    setBtnsLoading(true);

    (async () => {
        // Versuche zuerst, die Rabattcodes einzulösen
        if (appliedCodes.length > 0) {
            const customerName = `${vorname} ${nachname}`;
            const redeemResult = await CouponManager.redeemCoupons(appliedCodes.map(item => item.code), customerName);
            if (!redeemResult.success) {
                setBtnsLoading(false);
                showToast('Rabattcode-Fehler', redeemResult.message || 'Einlösen der Rabattcodes fehlgeschlagen.');
                return; // Buchung abbrechen, wenn Einlösung fehlschlägt
            }
        }

        // Wenn die Einlösung erfolgreich war oder keine Codes angewendet wurden, fahre mit E-Mail und Buchungsspeicherung fort
        emailjs.send('service_ayviqus', 'template_5249tc9', templateParams)
            .then(() => {
                addBookingToStorage(bookingObj);
                localStorage.setItem('kristina_beauty_last_booking', JSON.stringify(bookingObj));

                setBtnsLoading(false);
                document.getElementById('booking-form-wrapper').style.display = 'none';
                const cartEl = document.getElementById('cart-summary');
                if (cartEl) cartEl.style.display = 'none';
                document.getElementById('booking-success').style.display = 'block';
                showSuccessToast();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            })
            .catch((err) => {
                setBtnsLoading(false);
                console.error('EmailJS Fehler:', err);
                showToast('Fehler beim Senden', 'Bitte versuche es erneut oder ruf uns direkt an.');
            });
    })();
}


renderBookingServices();
updateCart();
function openSocialModal(platform) {
    const overlay = document.getElementById('social-modal-overlay');
    const icon    = document.getElementById('modal-icon');
    const label   = document.getElementById('modal-platform');
    const handle  = document.getElementById('modal-handle');
    const content = document.getElementById('modal-embed-content');
    const extLink = document.getElementById('modal-external-link');
    if (platform === 'instagram') {
        icon.style.background = 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)';
        icon.innerHTML = '<i class="fab fa-instagram"></i>';
        label.textContent  = 'Instagram';
        handle.textContent = '@kristina.beauty.kb';
        extLink.href = 'https://www.instagram.com/kristina.beauty.kb/';
        content.innerHTML = `<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/kristina.beauty.kb/" data-instgrm-version="14" style="background:#FFF; border:0; border-radius:12px; margin:0; padding:0; width:100%;"></blockquote>`;
        if (window.instgrm) setTimeout(() => window.instgrm.Embeds.process(), 150);
        else { const s = document.createElement('script'); s.src = '//platform.instagram.com/en_US/embeds.js'; s.async = true; document.body.appendChild(s); }
    } else {
        icon.style.background = '#000';
        icon.innerHTML = '<i class="fab fa-tiktok"></i>';
        label.textContent  = 'TikTok';
        handle.textContent = '@kr1stiinaa';
        extLink.href = 'https://www.tiktok.com/@kr1stiinaa';
        content.innerHTML = `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@kr1stiinaa" data-unique-id="kr1stiinaa" data-embed-from="oembed" data-embed-type="creator" style="max-width:100%; min-width:0; width:100%;"><section><a target="_blank" href="https://www.tiktok.com/@kr1stiinaa?refer=creator_embed">@kr1stiinaa</a></section></blockquote>`;
        const s = document.createElement('script'); s.src = 'https://www.tiktok.com/embed.js'; s.async = true; document.body.appendChild(s);
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}
function closeSocialModal() {
    document.getElementById('social-modal-overlay').style.display = 'none';
    document.getElementById('modal-embed-content').innerHTML = '';
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSocialModal(); });

const allReviews = [
    { name: "Johanna", service: "Wimpernlifting", date: "vor 1 Monat", text: "Kristina ist ein super angenehmer Mensch und hat sehr professionell gearbeitet. Ich bin mehr als zufrieden mit dem Endergebnis und werde auf jeden Fall wieder kommen!" },
    { name: "Judith", service: "Kombibrows", date: "vor 2 Monaten", text: "Ich bin absolut begeistert! Kristina arbeitet unglaublich professionell, präzise und mit viel Liebe zum Detail. Man fühlt sich bei ihr sofort wohl und bestens aufgehoben. Das Ergebnis ist einfach wunderschön." },
    { name: "Kim", service: "Ombrelips", date: "vor 3 Monaten", text: "Für mich der erste Termin einer Lippenpigmentierung und ich bin sehr zufrieden mit dem Ergebnis! Kristina hat mich super aufgeklärt und mir alles gezeigt. Ich hab mich sehr wohl gefühlt bei ihr 😍." },
    { name: "Michaela", service: "Refill", date: "vor 4 Monaten", text: "Ich war heute in dem neuen Studio von Kristina. Ich bin total begeistert von dem neuen Ambiente. Ein Ort zum Wohlfühlen. Ich bin sehr gerne bei Kristina, weil sie ihre Arbeit einfach toll macht." },
    { name: "Ann-Kathrin", service: "Mega Volume", date: "vor 5 Monaten", text: "Ein wunderschönes Studio, sehr hell und liebevoll eingerichtet. Alles ist super sauber und man fühlt sich gleich wohl. Kristina ist unglaublich freundlich, herzlich und sehr nett." },
    { name: "Svetlana", service: "Wimpernverlängerung", date: "vor 6 Monaten", text: "Sehr professionell, freundlich, arbeitet sorgfältig und sehr sauber. Bin mehr als zufrieden und kann Kristina jedem empfehlen." },
    { name: "Maria H.", service: "Aquafacial", date: "vor 7 Monaten", text: "Tolle Behandlung, meine Haut sieht super aus. Sehr kompetente Beratung und ein tolles Studio!" },
    { name: "Nina", service: "Classic Lashes", date: "vor 8 Monaten", text: "Wunderschöne Wimpern, die sehr lange halten. Kristina arbeitet sehr präzise und sauber. Absolut empfehlenswert!" }
];

const INITIAL_COUNT = 6;
let showingAll = false;

function renderReviews(count) {
    const grid = document.getElementById('reviews-grid');
    grid.innerHTML = allReviews.slice(0, count).map(r => `
        <div class="review-card flex flex-col">
            <div class="flex gap-1 mb-3">${[1,2,3,4,5].map(() => '<i class="fas fa-star text-brand-gold text-sm"></i>').join('')}</div>
            <p class="text-gray-600 font-light text-sm leading-relaxed mb-4 flex-grow">„${r.text}"</p>
            <div class="flex items-center justify-between mt-auto pt-3 border-t border-gray-50 gap-2 flex-wrap">
                <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 md:w-9 md:h-9 rounded-full bg-brand-light flex items-center justify-center text-brand-gold font-bold text-sm flex-shrink-0">${r.name[0].toUpperCase()}</div>
                    <div>
                        <p class="text-xs font-bold text-brand-dark">${r.name}</p>
                        <p class="text-[10px] text-gray-400 font-light">${r.date}</p>
                    </div>
                </div>
                <span class="text-[9px] font-semibold tracking-wider uppercase text-brand-gold/80 bg-brand-light px-2 py-1 rounded-full">${r.service}</span>
            </div>
        </div>`).join('');
}

function showMoreReviews() {
    if (!showingAll) {
        renderReviews(allReviews.length);
        document.getElementById('show-more-btn').textContent = 'Weniger anzeigen';
        showingAll = true;
    } else {
        renderReviews(INITIAL_COUNT);
        document.getElementById('show-more-btn').textContent = 'Alle Bewertungen anzeigen';
        showingAll = false;
    }
}

renderReviews(INITIAL_COUNT);

function copyDiscountCode() {}
