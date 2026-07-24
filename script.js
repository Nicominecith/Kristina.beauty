﻿﻿﻿
/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CONSTANTS & STATE
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
const MONTHS   = ['Januar','Februar','MÃ¤rz','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WEEKDAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const WD_LONG  = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

// Studio Ã–ffnungszeiten (0=So,1=Mo,2=Di,3=Mi,4=Do,5=Fr,6=Sa)
const HOURS = {
  0: { start: '09:30', end: '18:00' },
  1: null,
  2: { start: '17:30', end: '20:00' },
  3: { start: '16:00', end: '18:00' },
  4: null,
  5: { start: '09:30', end: '16:00' },
  6: { start: '09:30', end: '18:00' }
};

const STORAGE_KEY  = 'kristina_beauty_bookings';
const ADMIN_PASS   = 'beauty2026';
const STUDIO_NAME  = 'Kristina Beauty';
const STUDIO_ADDR  = 'Werkstraße 10, 22880 Wedel';

const today = new Date();
let curYear  = today.getFullYear();
let curMonth = today.getMonth();
let selDay   = null;
let selTime  = null;
let weekOff  = 0;
let adminMode = false;
let currentView = 'month';
let lastBookingForExport = null;

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   STORAGE HELPERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
async function checkLogin() {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        adminMode = true;
        showAdminTools();
        refreshData();
        return;
    }
    const pw = prompt('Bitte Mitarbeiter-Passwort eingeben:');
    if (pw === ADMIN_PASS) {
        sessionStorage.setItem('isLoggedIn', 'true');
        adminMode = true;
        showAdminTools();
        refreshData();
        showToast('Willkommen zurück!');
    } else {
        alert('Falsches Passwort.');
        window.location.href = 'index.html';
    }
}

window.addEventListener('DOMContentLoaded', checkLogin);
function saveBookings(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function getKey(y,m,d) { return `${y}-${m}-${d}`; }
function normKey(k) { const [y,m,d]=k.split('-').map(Number); return `${y}-${m}-${d}`; }

let bookingsData = {};
async function fetchLiveBookings() {
  try {
    const res = await fetch('/.netlify/functions/bookings');
    return await res.json();
  } catch (err) { return {}; }
}

function updateRevenueDisplay() {
    let total = 0;
    Object.values(bookingsData).forEach(day => {
        day.forEach(b => {
            if (b.status === 'confirmed' || b.status === 'pending') {
                total += (parseFloat(b.total) || 0);
            }
        });
    });
    const revEl = document.getElementById('revenue-count');
    if (revEl) revEl.textContent = total.toFixed(2) + ' €';
}

async function refreshData() {
  bookingsData = await fetchLiveBookings();
  updateRevenueDisplay();
  renderMonth();
  if (currentView === 'bookings') renderBookingsList();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TIME HELPERS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function parseTime(t) { const [h,m]=t.split(':').map(Number); return h*60+m; }
function fmtTime(min) { return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`; }
function getDaySlots(dow) {
  const h = HOURS[dow]; if(!h) return [];
  const slots=[];
  for(let t=parseTime(h.start); t<parseTime(h.end); t+=30) slots.push(fmtTime(t));
  return slots;
}
function getDayHoursText(dow) {
  const h=HOURS[dow]; return h ? `${h.start} â€“ ${h.end} Uhr` : 'Geschlossen';
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CLOCK
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function tickClock() {
  const el = document.getElementById('current-dt');
  if (!el) return;
  const n = new Date();
  el.textContent = `${WD_LONG[n.getDay()]}, ${String(n.getDate()).padStart(2,'0')}.${String(n.getMonth()+1).padStart(2,'0')}.${n.getFullYear()} â€“ ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')} Uhr`;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   TOAST
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function showToast(msg, duration=3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER MONTH
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderMonth() {
  document.getElementById('month-label').textContent = MONTHS[curMonth] + ' ' + curYear;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Weekday headers
  WEEKDAYS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-weekday'; el.textContent = d;
    grid.appendChild(el);
  });

  // Empty cells before 1st
  const first = new Date(curYear, curMonth, 1);
  let startDow = first.getDay(); startDow = startDow===0 ? 6 : startDow-1;
  for(let i=0;i<startDow;i++){
    const el=document.createElement('div'); el.className='cal-day empty'; grid.appendChild(el);
  }

  const daysInMonth = new Date(curYear, curMonth+1, 0).getDate();
  for(let d=1;d<=daysInMonth;d++){
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const dt = new Date(curYear, curMonth, d);
    const isToday  = d===today.getDate() && curMonth===today.getMonth() && curYear===today.getFullYear();
    const isPast   = dt < new Date(today.getFullYear(),today.getMonth(),today.getDate());
    const dow      = dt.getDay();
    const isClosed = !HOURS[dow];
    const isSel    = selDay && selDay.d===d && selDay.m===curMonth && selDay.y===curYear;

    if (isClosed)  el.classList.add('closed');
    else if (isPast) el.classList.add('past');
    else if (isToday) el.classList.add('today','open');
    else el.classList.add('open');

    if (isSel) el.classList.add('selected');

    if (!isClosed && !isPast) el.onclick = () => selectDay(d, curMonth, curYear);
    grid.appendChild(el);
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   SELECT DAY
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function selectDay(d,m,y) {
  selDay = {d,m,y}; selTime = null;
  renderMonth();
  const dt = new Date(y,m,d);
  document.getElementById('panel-date').textContent = WD_LONG[dt.getDay()] + ', ' + d + '. ' + MONTHS[m] + ' ' + y;
  document.getElementById('panel-hours').textContent = 'Ã–ffnungszeiten: ' + getDayHoursText(dt.getDay());
  renderSlots(d,m,y);
  renderDayBookings(d,m,y);
  const panel = document.getElementById('day-panel');
  panel.classList.add('visible');
  setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'nearest'}),50);
}

function clearSelection() {
  selDay=null; selTime=null;
  renderMonth();
  document.getElementById('day-panel').classList.remove('visible');
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER SLOTS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderSlots(d,m,y) {
  const dow = new Date(y,m,d).getDay();
  const container = document.getElementById('time-slots');
  container.innerHTML='';
  const slots = getDaySlots(dow);
  if(!slots.length){
    container.innerHTML='<div class="empty-msg">Heute geschlossen.</div>';
    return;
  }
  const key = getKey(y,m,d);
  const taken = (bookingsData[key]||[]).filter(b=>b.status==='confirmed').map(b=>b.time);
  slots.forEach(t => {
    const el=document.createElement('div');
    el.className='slot';
    el.textContent=t;
    if(taken.includes(t)){
      el.classList.add('taken');
    } else {
      el.onclick=()=>{
        selTime=t;
        container.querySelectorAll('.slot').forEach(s=>s.classList.remove('selected'));
        el.classList.add('selected');
      };
    }
    container.appendChild(el);
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   RENDER DAY BOOKINGS
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderDayBookings(d,m,y) {
  const container=document.getElementById('day-bookings');
  const key=getKey(y,m,d);
  const all=adminMode ? (bookingsData[key]||[]) : [];
  if(!all.length){ container.innerHTML=''; return; }
  const rows=all.map(b=>{
    const svc=b.service||(Array.isArray(b.services)?b.services.map(s=>`${s.name}${s.quantity>1?' x'+s.quantity:''}`).join(', '):'');
    const statusBadge=b.status==='pending'?'Anfrage':b.status==='declined'?'Abgelehnt':'BestÃ¤tigt';
    const adminHtml=adminMode&&b.id?`
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
        <button class="btn btn-ghost btn-sm" onclick="editBooking('${b.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="declineBooking('${b.id}')">Ablehnen</button>
        <button class="btn btn-gold btn-sm" onclick="openCalModal('${b.id}')"><i class="fas fa-calendar-plus"></i> Kalender</button>
      </div>`:'';
    return `<div class="booking-item">
      <div class="booking-time">${b.time}</div>
      <div>
        <div class="booking-name">${b.name}</div>
        ${svc?`<div class="booking-sub">${svc}</div>`:''}
        <span class="booking-badge">${statusBadge}</span>
        ${adminHtml}
      </div>
    </div>`;
  }).join('');
  container.innerHTML=`<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-top:0.75rem;background:var(--white);">
    <div class="panel-label" style="margin-bottom:0.5rem;">Termine</div>
    ${rows}
  </div>`;
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   GO BOOK (redirect to main site)
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function goBook() {
  if(!selDay){ showToast('Bitte wÃ¤hle zuerst einen Tag aus.'); return; }
  const ds=`${selDay.y}-${String(selDay.m+1).padStart(2,'0')}-${String(selDay.d).padStart(2,'0')}`;
  localStorage.setItem('kristina_beauty_booking_prefill', JSON.stringify({
    date: ds, time: selTime ? selTime+' Uhr' : ''
  }));
  window.location.href='index.html#booking';
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   WEEK VIEW
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function getWeekStart(off) {
  const d=new Date(today);
  d.setDate(d.getDate()-d.getDay()+1+off*7);
  return d;
}
function changeWeek(dir){ weekOff+=dir; renderWeek(); }
function renderWeek() {
  const ws=getWeekStart(weekOff);
  const we=new Date(ws); we.setDate(we.getDate()+6);
  document.getElementById('week-label').textContent=
    ws.getDate()+'. '+MONTHS[ws.getMonth()]+' â€“ '+we.getDate()+'. '+MONTHS[we.getMonth()];
  const grid=document.getElementById('week-grid');
  grid.innerHTML='';
  const times=[];
  for(let t=parseTime('09:00');t<=parseTime('20:00');t+=30) times.push(fmtTime(t));
  // Corner
  const c=document.createElement('div'); c.className='wg-header'; grid.appendChild(c);
  const dn=['Mo','Di','Mi','Do','Fr','Sa','So'];
  for(let i=0;i<7;i++){
    const d=new Date(ws); d.setDate(d.getDate()+i);
    const th=document.createElement('div'); th.className='wg-header';
    th.innerHTML=`<span style="font-size:8px;letter-spacing:.18em;">${dn[i]}</span><br><span style="font-size:12px;font-family:Playfair Display,serif;font-weight:400;letter-spacing:0;">${d.getDate()}</span>`;
    grid.appendChild(th);
  }
  times.forEach(t=>{
    const tc=document.createElement('div'); tc.className='wg-time'; tc.textContent=t;
    grid.appendChild(tc);
    for(let i=0;i<7;i++){
      const d=new Date(ws); d.setDate(d.getDate()+i);
      const key=getKey(d.getFullYear(),d.getMonth(),d.getDate());
      const dow=d.getDay();
      const cell=document.createElement('div'); cell.className='wg-cell';
      const open=HOURS[dow]&&parseTime(t)>=parseTime(HOURS[dow].start)&&parseTime(t)<parseTime(HOURS[dow].end);
      const books=(bookingsData[key]||[]).filter(b=>b.time===t&&b.status==='confirmed');
      if(!open){ cell.classList.add('closed'); }
      else if(!books.length){
        cell.classList.add('available');
        cell.title='Klicke zum Buchen';
        cell.onclick=()=>{ selDay={d:d.getDate(),m:d.getMonth(),y:d.getFullYear()}; selTime=t; goBook(); };
      }
      books.forEach(b=>{
        const ev=document.createElement('div'); ev.className='wg-event';
        ev.textContent=b.name+' Â· '+(b.service||'');
        cell.appendChild(ev);
      });
      grid.appendChild(cell);
    }
  });
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   BOOKINGS LIST VIEW
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function renderBookingsList() {
  const container=document.getElementById('bookings-list');
  const all=[];
  const stored=getBookings();
  Object.entries(stored).forEach(([key,items])=>{
    const [y,m,d]=key.split('-').map(Number);
    const dt=new Date(y,m,d);
    if(dt>=new Date(today.getFullYear(),today.getMonth(),today.getDate())){
      items.forEach(item=>{ if(!adminMode&&item.status!=='confirmed') return; all.push({...item,date:dt,d,m,y}); });
    }
  });
  all.sort((a,b)=>a.date-b.date||(a.time>b.time?1:-1));
  if(!all.length){ container.innerHTML='<div class="empty-msg">Keine kommenden Buchungen.</div>'; return; }
  const dn=['So','Mo','Di','Mi','Do','Fr','Sa'];
  container.innerHTML=all.map(b=>{
    const svc=b.service||(Array.isArray(b.services)?b.services.map(s=>`${s.name}${s.quantity>1?' x'+s.quantity:''}`).join(', '):'');
    const statusLabel=b.status==='pending'?'Anfrage':b.status==='declined'?'Abgelehnt':'BestÃ¤tigt';
    const label=dn[b.date.getDay()]+', '+b.d+'. '+MONTHS[b.m];
    const adminHtml=adminMode&&b.id?`
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">
        <button class="btn btn-ghost btn-sm" onclick="editBooking('${b.id}')"><i class="fas fa-edit"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="deleteBooking('${b.id}')"><i class="fas fa-trash"></i></button>
        <button class="btn btn-ghost btn-sm" onclick="declineBooking('${b.id}')">Ablehnen</button>
        <button class="btn btn-gold btn-sm" onclick="openCalModal('${b.id}')"><i class="fas fa-calendar-plus"></i> Kalender</button>
      </div>`:'';
    return `<div class="booking-item">
      <div class="booking-time">${b.time}</div>
      <div style="flex:1">
        <div class="booking-name">${b.name}</div>
        <div class="booking-sub">${label}</div>
        ${svc?`<span class="booking-badge">${svc}</span>`:''}
        <div style="font-size:9px;color:${b.status==='declined'?'#e74c3c':'var(--muted)'};margin-top:2px;">${statusLabel}</div>
        ${adminHtml}
      </div>
    </div>`;
  }).join('');
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   ADMIN
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
/* ——————————————————————————————————————————————————————————————————————————————————————————————————————
   ADMIN TOOLS (Revenue & Coupon Generator)
—————————————————————————————————————————————————————————————————————————————————————————————————————— */
async function generateEmployeeCode() {
    const val = document.getElementById('custom-discount-val')?.value || 10;
    const btn = document.getElementById('gen-code-btn');
    if (!btn) return;
    
    btn.disabled = true;
    try {
        const res = await fetch('/.netlify/functions/coupon', {
            method: 'POST',
            body: JSON.stringify({ action: 'generate', discount: val })
        });
        const data = await res.json();
        const codeInfo = document.getElementById('last-gen-code');
        if (codeInfo) {
            codeInfo.innerHTML = `Code erstellt: <strong style="color:#C5A880; font-size:14px; letter-spacing:1px;">${data.code}</strong> (${data.discount}€)`;
        }
        showToast('Gutschein erstellt!');
    } catch (e) { 
        console.error(e);
        alert('Fehler beim Erstellen des Codes.'); 
    }
    btn.disabled = false;
}

async function resetRevenue() {
    if (!confirm('Möchtest du wirklich alle Einnahmen und Buchungsdaten unwiderruflich vom Server löschen?')) return;
    try {
        await fetch('/.netlify/functions/bookings', {
            method: 'POST',
            body: JSON.stringify({ action: 'reset' })
        });
        await refreshData();
        showToast('Daten wurden zurückgesetzt.');
    } catch (e) { alert('Fehler beim Reset.'); }
}

function toggleAdminMode() {
  if(adminMode){
    adminMode=false;
    if(document.getElementById('admin-tools-box')) document.getElementById('admin-tools-box').remove();
    document.getElementById('admin-status').textContent='Admin-Modus beendet';
    document.getElementById('admin-btn').innerHTML='<i class="fas fa-lock"></i> Admin';
    renderBookingsList(); renderDayBookings(selDay?.d,selDay?.m,selDay?.y);
    return;
  }
  const pw=prompt('Admin-Passwort');
  if(pw===ADMIN_PASS){
    adminMode=true;
    showAdminTools();
    document.getElementById('admin-warning').style.display='none';
    document.getElementById('admin-status').textContent='Admin-Modus aktiv';
    document.getElementById('admin-btn').innerHTML='<i class="fas fa-lock-open"></i> Admin';
    renderBookingsList();
    if(selDay) renderDayBookings(selDay.d,selDay.m,selDay.y);
  } else {
    document.getElementById('admin-warning').style.display='inline';
  }
}

function showAdminTools() {
    if (document.getElementById('admin-tools-box')) return;
    const controls = document.querySelector('.admin-controls') || document.body;
    const toolBox = document.createElement('div');
    toolBox.id = 'admin-tools-box';
    toolBox.style.cssText = 'background:#fff; padding:1.2rem; border-radius:12px; border:1px solid #eee; margin:1rem; box-shadow:0 4px 15px rgba(0,0,0,0.05);';
    toolBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid #f5f5f5; padding-bottom:0.5rem;">
          <span style="font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:0.1em; color:#888;">Umsatz (Gesamt)</span>
          <span id="revenue-count" style="font-weight:bold; font-size:1.1rem; color:#000;">Lade...</span>
      </div>
      <div style="margin-bottom:1rem;">
          <label style="display:block; font-size:9px; font-weight:bold; text-transform:uppercase; color:#C5A880; margin-bottom:5px;">Gutschein-Generator</label>
          <div style="display:flex; gap:0.5rem; align-items:center;">
              <input type="number" id="custom-discount-val" placeholder="€" value="10" 
                     style="width:60px; padding:0.45rem; border:1px solid #ddd; border-radius:6px; font-size:12px; text-align:center;">
              <button id="gen-code-btn" class="btn btn-gold btn-sm" onclick="generateEmployeeCode()" style="flex:1; margin:0; padding:0.5rem; font-size:10px;">
                  Code erstellen
              </button>
          </div>
          <div id="last-gen-code" style="margin-top:0.7rem; font-size:11px; color:#333; text-align:center; min-height:16px;"></div>
      </div>
      <button onclick="resetRevenue()" style="background:none; border:none; color:#e74c3c; font-size:9px; cursor:pointer; width:100%; text-decoration:underline; opacity:0.6; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">
          <i class="fas fa-trash-alt"></i> Alle Buchungsdaten vom Server löschen
      </button>`;
    controls.appendChild(toolBox);
    updateRevenueDisplay();
    document.getElementById('admin-btn').innerHTML='<i class="fas fa-lock-open"></i> Admin';
}
function findBooking(id){ for(const list of Object.values(getBookings())){ const b=list.find(x=>x.id===id); if(b) return b; } return null; }
function editBooking(id){
  const b=findBooking(id); if(!b) return;
  const name=prompt('Name',b.name); if(name===null) return;
  const time=prompt('Uhrzeit',b.time); if(time===null) return;
  const svc=prompt('Behandlung',b.service||''); if(svc===null) return;
  b.name=name.trim()||b.name; b.time=time.trim()||b.time; b.service=svc.trim()||b.service; b.status='confirmed';
  saveOneBooking(b); renderBookingsList(); if(selDay) renderDayBookings(selDay.d,selDay.m,selDay.y);
}
function deleteBooking(id){
  if(!confirm('Termin wirklich lÃ¶schen?')) return;
  const items=getBookings();
  Object.keys(items).forEach(k=>{ items[k]=items[k].filter(b=>b.id!==id); if(!items[k].length) delete items[k]; });
  saveBookings(items); refreshData(); renderMonth(); renderBookingsList();
  if(selDay) renderDayBookings(selDay.d,selDay.m,selDay.y);
}
function declineBooking(id){
  const b=findBooking(id); if(!b) return; b.status='declined';
  saveOneBooking(b); refreshData(); renderMonth(); renderBookingsList();
  if(selDay) renderDayBookings(selDay.d,selDay.m,selDay.y);
}
function saveOneBooking(booking){
  const key=normKey(booking.key||booking.date);
  const items=getBookings();
  if(!items[key]) items[key]=[];
  items[key]=items[key].filter(b=>b.id!==booking.id);
  items[key].push(booking);
  saveBookings(items); refreshData();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   VIEW SWITCHING
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function setView(v) {
  if(v==='bookings'&&!adminMode){
    const pw=prompt('Admin-Passwort fÃ¼r BuchungsÃ¼bersicht');
    if(pw!==ADMIN_PASS){ showToast('Nur Admins kÃ¶nnen alle Buchungen sehen.'); return; }
    adminMode=true;
    document.getElementById('admin-status').textContent='Admin-Modus aktiv';
    document.getElementById('admin-btn').innerHTML='<i class="fas fa-lock-open"></i> Admin';
  }
  currentView=v;
  document.getElementById('view-month').style.display    = v==='month'    ? '' : 'none';
  document.getElementById('view-week').style.display     = v==='week'     ? '' : 'none';
  document.getElementById('view-bookings').style.display = v==='bookings' ? '' : 'none';
  document.querySelectorAll('.view-btn').forEach((btn,i)=>{
    btn.classList.toggle('active', ['month','week','bookings'][i]===v);
  });
  if(v==='month') renderMonth();
  if(v==='week')  renderWeek();
  if(v==='bookings') renderBookingsList();
}

function changeMonth(dir){
  curMonth+=dir;
  if(curMonth>11){ curMonth=0; curYear++; }
  if(curMonth<0)  { curMonth=11; curYear--; }
  renderMonth();
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   CALENDAR EXPORT MODAL
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function buildICS(booking) {
  // Parse date
  let year,month,day,hour=10,minute=0;
  if(booking.date){
    const parts=booking.date.split('-').map(Number);
    year=parts[0]; month=parts[1]-1; day=parts[2];
  } else if(selDay){
    year=selDay.y; month=selDay.m; day=selDay.d;
  } else return null;

  if(booking.time){
    const tp=booking.time.replace(' Uhr','').split(':').map(Number);
    hour=tp[0]; minute=tp[1]||0;
  }

  const dt=new Date(year,month,day,hour,minute);
  const dtEnd=new Date(dt.getTime()+90*60000); // +90 min default

  function pad(n){ return String(n).padStart(2,'0'); }
  function icsDate(d){ return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }

  const svc=booking.service||(Array.isArray(booking.services)?booking.services.map(s=>s.name).join(', '):'Behandlung');
  const uid=`kb-${Date.now()}@kristinabeauty.de`;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kristina Beauty//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(dt)}`,
    `DTEND:${icsDate(dtEnd)}`,
    `SUMMARY:${STUDIO_NAME} â€“ ${svc}`,
    `DESCRIPTION:Termin bei ${STUDIO_NAME}\\nBehandlung: ${svc}\\nAdresse: ${STUDIO_ADDR}\\n\\nBitte pÃ¼nktlich erscheinen. Bei Fragen: Instagram @kristina.beauty.kb`,
    `LOCATION:${STUDIO_ADDR}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function buildGoogleURL(booking) {
  let year,month,day,hour=10,minute=0;
  if(booking.date){
    const parts=booking.date.split('-').map(Number);
    year=parts[0]; month=parts[1]-1; day=parts[2];
  } else return '#';
  if(booking.time){
    const tp=booking.time.replace(' Uhr','').split(':').map(Number);
    hour=tp[0]; minute=tp[1]||0;
  }
  const dt=new Date(year,month,day,hour,minute);
  const dtEnd=new Date(dt.getTime()+90*60000);
  function pad(n){ return String(n).padStart(2,'0'); }
  function gDate(d){ return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`; }
  const svc=booking.service||(Array.isArray(booking.services)?booking.services.map(s=>s.name).join(', '):'Behandlung');
  const params=new URLSearchParams({
    action:'TEMPLATE',
    text:`${STUDIO_NAME} â€“ ${svc}`,
    dates:`${gDate(dt)}/${gDate(dtEnd)}`,
    details:`Termin bei ${STUDIO_NAME}\nBehandlung: ${svc}\nInstagram: @kristina.beauty.kb`,
    location:STUDIO_ADDR
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

function openCalModal(bookingId) {
  let booking=null;
  if(bookingId){ booking=findBooking(bookingId); }
  if(!booking&&lastBookingForExport){ booking=lastBookingForExport; }
  if(!booking) return;

  // Fill summary
  const svc=booking.service||(Array.isArray(booking.services)?booking.services.map(s=>s.name).join(', '):'');
  let dateStr='';
  if(booking.date){
    const [y,m,d]=booking.date.split('-').map(Number);
    const dt=new Date(y,m-1,d);
    dateStr=`${WD_LONG[dt.getDay()]}, ${d}. ${MONTHS[m-1]} ${y}`;
  }
  document.getElementById('modal-booking-title').textContent=`${STUDIO_NAME}${svc?' â€“ '+svc:''}`;
  document.getElementById('modal-booking-info').textContent=`${dateStr}${booking.time?' Â· '+booking.time+' Uhr':''}`;

  // Google link
  document.getElementById('cal-google').href=buildGoogleURL(booking);

  // ICS download
  const ics=buildICS(booking);
  if(ics){
    const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    document.getElementById('cal-ics').href=url;
    document.getElementById('cal-outlook').href=url;
  }

  document.getElementById('cal-modal-overlay').classList.add('open');
  document.body.style.overflow='hidden';
}

function closeCalModal(){
  document.getElementById('cal-modal-overlay').classList.remove('open');
  document.body.style.overflow='';
}

// Close on overlay click
document.getElementById('cal-modal-overlay').addEventListener('click', function(e){
  if(e.target===this) closeCalModal();
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeCalModal(); });

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   LISTEN FOR BOOKING FROM MAIN SITE
   After a booking is made on index.html, it stores the booking
   in localStorage and we can offer the export directly.
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
function checkForNewBooking() {
  try {
    const raw = localStorage.getItem('kristina_beauty_last_booking');
    if (!raw) return;
    const booking = JSON.parse(raw);
    if (!booking || !booking.id) return;
    // Only show once
    localStorage.removeItem('kristina_beauty_last_booking');
    lastBookingForExport = booking;

    // Show a banner
    showCalendarBanner(booking);
  } catch(e) {}
}

function showCalendarBanner(booking) {
  const svc = booking.service || '';
  const banner = document.createElement('div');
  banner.style.cssText=`
    position:fixed; bottom:1.5rem; left:50%; transform:translateX(-50%);
    background:var(--white); border:1px solid var(--gold-border);
    box-shadow: 0 12px 40px rgba(0,0,0,0.15);
    border-radius:999px; padding:0.75rem 1.1rem 0.75rem 1rem;
    display:flex; align-items:center; gap:0.75rem;
    z-index:300; animation: slideIn 0.4s cubic-bezier(0.34,1.56,0.64,1);
    max-width:calc(100vw - 2rem); font-size:0.82rem;
  `;
  banner.innerHTML=`
    <i class="fas fa-calendar-check" style="color:var(--gold);font-size:1.1rem;flex-shrink:0;"></i>
    <span style="color:var(--dark);font-weight:600;">Termin gespeichert!</span>
    <button onclick="openCalModal(null)" style="
      background:var(--gold); color:#fff; border:none;
      padding:0.5rem 1rem; border-radius:999px; font-size:9px;
      font-weight:700; letter-spacing:.15em; text-transform:uppercase;
      cursor:pointer; white-space:nowrap; font-family:Montserrat,sans-serif;
    ">In Kalender speichern</button>
    <button onclick="this.parentElement.remove()" style="
      background:none; border:none; color:#aaa; cursor:pointer;
      font-size:1rem; padding:0.25rem; line-height:1;
    ">Ã—</button>
  `;
  document.body.appendChild(banner);
  setTimeout(()=>{ if(banner.parentElement) banner.remove(); }, 12000);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   INIT
â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
refreshData();
renderMonth();
tickClock();
setInterval(tickClock, 30000);
checkForNewBooking();
