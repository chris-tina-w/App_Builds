import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCaY86eQvnpWBJN8I1TsxthWtpyzDv3xx8",
  authDomain: "mola-mola-4c0c3.firebaseapp.com",
  projectId: "mola-mola-4c0c3",
  storageBucket: "mola-mola-4c0c3.firebasestorage.app",
  messagingSenderId: "815657708710",
  appId: "1:815657708710:web:fc8409057c5172b5d89867"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const molaEl = document.getElementById('mola');
const moodBubble = document.getElementById('mood-bubble');
const statStatus = document.getElementById('stat-status');
const statCycleLength = document.getElementById('stat-cycle-length');
const statPeriodLength = document.getElementById('stat-period-length');
const statNextStart = document.getElementById('stat-next-start');
const historyList = document.getElementById('history-list');
const openBanner = document.getElementById('open-cycle-banner');
const openBannerText = document.getElementById('open-cycle-text');
const endTodayBtn = document.getElementById('end-today-btn');
const statDaysUntil = document.getElementById('stat-days-until');
const countdownNote = document.getElementById('countdown-note');
const seedDataBtn = document.getElementById('seed-data-btn');
const clearDataBtn = document.getElementById('clear-data-btn');

const waveBox = document.getElementById('wave-box');
const wavePathFront = document.getElementById('wave-path-front');
const wavePathBack = document.getElementById('wave-path-back');
const waveMarker = document.getElementById('wave-marker');

const molaInfoBtn = document.getElementById('mola-info-btn');
const molaInfoDialog = document.getElementById('mola-info-dialog');
const molaInfoClose = document.getElementById('mola-info-close');

const dateOffsetSlider = document.getElementById('date-offset-slider');
const dateOffsetValue = document.getElementById('date-offset-value');
const dateOffsetReset = document.getElementById('date-offset-reset');

const startPeriodBtn = document.getElementById('start-period-btn');
const startCalDialog = document.getElementById('start-cal-dialog');
const startCalClose = document.getElementById('start-cal-close');
const startCalPrev = document.getElementById('start-cal-prev');
const startCalNext = document.getElementById('start-cal-next');
const startCalLabel = document.getElementById('start-cal-label');
const startCalGrid = document.getElementById('start-cal-grid');

const endCalDialog = document.getElementById('end-cal-dialog');
const endCalClose = document.getElementById('end-cal-close');
const endCalPrev = document.getElementById('end-cal-prev');
const endCalNext = document.getElementById('end-cal-next');
const endCalLabel = document.getElementById('end-cal-label');
const endCalGrid = document.getElementById('end-cal-grid');
const savePeriodBtn = document.getElementById('save-period-btn');
const periodOngoingBtn = document.getElementById('period-ongoing-btn');

let pendingStart = null;
let pendingEnd = null;
let startCalView = null;
let endCalView = null;

const appShell = document.getElementById('app-shell');
const signinScreen = document.getElementById('signin-screen');
const googleSigninBtn = document.getElementById('google-signin-btn');
const signinError = document.getElementById('signin-error');
const accountBar = document.getElementById('account-bar');
const accountEmail = document.getElementById('account-email');
const signoutBtn = document.getElementById('signout-btn');

let previewOffset = 0;
let currentUser = null;
let cycles = [];
let unsubscribeCycles = null;

function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000);
}

function fmtLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return fmtLocal(new Date());
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getPreviewToday() {
  return addDays(parseDate(todayStr()), previewOffset);
}

// --- Calendar date pickers -------------------------------------------------
//
// Each dialog shows a rolling 5-week (35-day) window instead of a rigid
// calendar-month grid, so the reference date (today, or the chosen start
// date) sits roughly in the middle rather than the window always starting
// on the 1st.

const CAL_WINDOW_DAYS = 35;

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

// Centers the 35-day window on centerDateStr (e.g. today's date lands
// roughly in the middle row rather than always being the 1st of the grid).
function centeredWindowStart(centerDateStr) {
  return startOfWeek(addDays(parseDate(centerDateStr), -17));
}

function formatWindowLabel(windowStart) {
  const windowEnd = addDays(windowStart, CAL_WINDOW_DAYS - 1);
  const sameMonth = windowStart.getMonth() === windowEnd.getMonth() &&
    windowStart.getFullYear() === windowEnd.getFullYear();
  if (sameMonth) {
    return windowStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  const sameYear = windowStart.getFullYear() === windowEnd.getFullYear();
  const startLabel = windowStart.toLocaleDateString(undefined, { month: 'short', year: sameYear ? undefined : 'numeric' });
  const endLabel = windowEnd.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

// Builds the weekday header + 35 day cells; dayRenderer(btn, dateStr, col)
// decides each cell's classes, disabled state, and click handler.
function renderCalendarGrid(gridEl, labelEl, windowStart, dayRenderer) {
  labelEl.textContent = formatWindowLabel(windowStart);
  gridEl.innerHTML = '';
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach((wd) => {
    const el = document.createElement('div');
    el.className = 'cal-weekday';
    el.textContent = wd;
    gridEl.appendChild(el);
  });
  for (let i = 0; i < CAL_WINDOW_DAYS; i++) {
    const date = addDays(windowStart, i);
    const dateStr = fmtLocal(date);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    const bubble = document.createElement('span');
    bubble.className = 'cal-day-bubble';
    bubble.textContent = String(date.getDate());
    btn.appendChild(bubble);
    dayRenderer(btn, dateStr, i % 7);
    gridEl.appendChild(btn);
  }
}

function updateCalNavButtons(nextBtn, windowStart, maxDateStr) {
  const maxDate = parseDate(maxDateStr);
  const nextWindowStart = addDays(windowStart, CAL_WINDOW_DAYS);
  nextBtn.disabled = nextWindowStart > maxDate;
}

function startDayRenderer(btn, dateStr) {
  const max = todayStr();
  if (dateStr === todayStr()) btn.classList.add('cal-day-today');
  if (dateStr > max) {
    btn.disabled = true;
    btn.classList.add('cal-day-disabled');
  } else {
    btn.addEventListener('click', () => {
      pendingStart = dateStr;
      pendingEnd = null;
      startCalDialog.close();
      openEndCalendar();
    });
  }
}

function renderStartCalendar() {
  renderCalendarGrid(startCalGrid, startCalLabel, startCalView, startDayRenderer);
  updateCalNavButtons(startCalNext, startCalView, todayStr());
}

function openStartCalendar() {
  startCalView = centeredWindowStart(todayStr());
  renderStartCalendar();
  startCalDialog.showModal();
}

function endDayRenderer(btn, dateStr, col) {
  const max = todayStr();
  if (dateStr === todayStr()) btn.classList.add('cal-day-today');
  if (dateStr === pendingStart) btn.classList.add('cal-day-anchor');

  const outOfRange = dateStr < pendingStart || dateStr > max;
  if (outOfRange) {
    btn.disabled = true;
    btn.classList.add('cal-day-disabled');
    return;
  }

  if (pendingEnd && dateStr >= pendingStart && dateStr <= pendingEnd) {
    btn.classList.add('cal-day-in-range');
    if (dateStr === pendingStart || col === 0) btn.classList.add('cal-range-cap-left');
    if (dateStr === pendingEnd || col === 6) btn.classList.add('cal-range-cap-right');
  }

  btn.addEventListener('click', () => {
    pendingEnd = dateStr;
    renderEndCalendar();
  });
}

function renderEndCalendar() {
  renderCalendarGrid(endCalGrid, endCalLabel, endCalView, endDayRenderer);
  updateCalNavButtons(endCalNext, endCalView, todayStr());
  savePeriodBtn.disabled = !pendingEnd;
}

function openEndCalendar() {
  pendingEnd = null;
  endCalView = centeredWindowStart(pendingStart);
  renderEndCalendar();
  endCalDialog.showModal();
}

// --- Firestore data layer ------------------------------------------------

const dataErrorBanner = document.getElementById('data-error-banner');
const dataErrorText = document.getElementById('data-error-text');
const dataErrorDismiss = document.getElementById('data-error-dismiss');

dataErrorDismiss.addEventListener('click', () => dataErrorBanner.classList.add('hidden'));

function showDataError(context, err) {
  console.error(context, err);
  const detail = err && err.code ? err.code : (err && err.message ? err.message : String(err));
  dataErrorText.textContent = `${context}: ${detail}`;
  dataErrorBanner.classList.remove('hidden');
}

function cyclesCollection(uid) {
  return collection(db, 'users', uid, 'cycles');
}

function subscribeToCycles(uid) {
  if (unsubscribeCycles) unsubscribeCycles();
  unsubscribeCycles = onSnapshot(
    cyclesCollection(uid),
    (snapshot) => {
      cycles = snapshot.docs
        .map((d) => ({ key: d.id, ...d.data() }))
        .sort((a, b) => a.start.localeCompare(b.start));
      render();
    },
    (err) => {
      showDataError('Could not load your data', err);
    }
  );
}

function addCycle(start, end) {
  if (!currentUser) return;
  addDoc(cyclesCollection(currentUser.uid), { start, end: end || null })
    .catch((err) => showDataError('Could not save entry', err));
}

function deleteCycle(key) {
  if (!currentUser) return;
  deleteDoc(doc(db, 'users', currentUser.uid, 'cycles', key))
    .catch((err) => showDataError('Could not delete entry', err));
}

function closeOpenCycleToday() {
  if (!currentUser) return;
  const openCycle = cycles.find(c => !c.end);
  if (!openCycle) return;
  updateDoc(doc(db, 'users', currentUser.uid, 'cycles', openCycle.key), { end: todayStr() })
    .catch((err) => showDataError('Could not update entry', err));
}

async function seedSampleData() {
  if (!currentUser) return;
  try {
    const batch = writeBatch(db);
    cycles.forEach((c) => batch.delete(doc(db, 'users', currentUser.uid, 'cycles', c.key)));

    let start = addDays(parseDate(todayStr()), -21);
    for (let i = 0; i < 10; i++) {
      const periodLen = randInt(4, 6);
      const end = addDays(start, periodLen - 1);
      const newDocRef = doc(cyclesCollection(currentUser.uid));
      batch.set(newDocRef, { start: fmtLocal(start), end: fmtLocal(end) });
      const cycleLen = randInt(26, 31);
      start = addDays(start, -cycleLen);
    }
    await batch.commit();
  } catch (err) {
    showDataError('Could not load sample data', err);
  }
}

async function clearAllData() {
  if (!currentUser) return;
  if (!confirm('Clear all logged cycles? This cannot be undone.')) return;
  try {
    const batch = writeBatch(db);
    cycles.forEach((c) => batch.delete(doc(db, 'users', currentUser.uid, 'cycles', c.key)));
    await batch.commit();
  } catch (err) {
    showDataError('Could not clear data', err);
  }
}

// Finds the cycle (open or closed) that a given date falls inside, if any.
function findActiveCycle(cycles, date) {
  for (const c of cycles) {
    const start = parseDate(c.start);
    if (c.end) {
      const end = parseDate(c.end);
      if (date >= start && date <= end) return c;
    } else if (date >= start) {
      return c;
    }
  }
  return null;
}

const DEFAULT_CYCLE_LENGTH = 28;

function computeStats(cycles) {
  const closed = cycles.filter(c => c.end);
  const periodLengths = closed.map(c => daysBetween(parseDate(c.start), parseDate(c.end)) + 1);
  const avgPeriodLength = periodLengths.length
    ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
    : null;

  const starts = cycles.map(c => c.start).sort();
  const cycleLengths = [];
  for (let i = 1; i < starts.length; i++) {
    cycleLengths.push(daysBetween(parseDate(starts[i - 1]), parseDate(starts[i])));
  }
  const recentCycleLengths = cycleLengths.slice(-6);
  // avgCycleLength is only set once we have real history (2+ logged starts) —
  // it's shown as-is in the stats grid, so it should never be a guess.
  const avgCycleLength = recentCycleLengths.length
    ? Math.round(recentCycleLengths.reduce((a, b) => a + b, 0) / recentCycleLengths.length)
    : null;

  const lastStart = starts.length ? parseDate(starts[starts.length - 1]) : null;

  // Until there's enough history to measure a real average, fall back to a
  // typical 28-day cycle so the countdown still has something to show.
  const isEstimate = !avgCycleLength && !!lastStart;
  const effectiveCycleLength = avgCycleLength || (lastStart ? DEFAULT_CYCLE_LENGTH : null);

  const predictedNext = lastStart && effectiveCycleLength
    ? new Date(lastStart.getTime() + effectiveCycleLength * 86400000)
    : null;

  return { avgPeriodLength, avgCycleLength, effectiveCycleLength, isEstimate, lastStart, predictedNext };
}

function determineMood(cycles, stats, today) {
  const activeCycle = findActiveCycle(cycles, today);
  if (activeCycle) {
    const dayNum = daysBetween(parseDate(activeCycle.start), today) + 1;
    return {
      mood: 'period',
      status: `On period (day ${dayNum})`,
      message: "I'm here with you — resting on the current. 🌊🩸"
    };
  }

  if (!stats.lastStart) {
    return {
      mood: 'calm',
      status: 'No data yet',
      message: "Hi! Log your first period below and I'll start tracking. 🌊"
    };
  }

  const dayOfCycle = daysBetween(stats.lastStart, today) + 1;

  if (stats.avgCycleLength) {
    const ovulationDay = stats.avgCycleLength - 14;
    const fertileStart = ovulationDay - 5;
    const fertileEnd = ovulationDay + 1;
    if (dayOfCycle >= fertileStart && dayOfCycle <= fertileEnd) {
      return {
        mood: 'fertile',
        status: `Fertile window (day ${dayOfCycle})`,
        message: "Feeling extra sparkly today! ✨🐟"
      };
    }
    if (stats.predictedNext && today >= stats.predictedNext) {
      return {
        mood: 'calm',
        status: `Day ${dayOfCycle} — period may be due`,
        message: "Your period might start any day now. 🌊"
      };
    }
  }

  return {
    mood: 'calm',
    status: `Day ${dayOfCycle} of cycle`,
    message: "Just drifting along peacefully. 🌊🐟"
  };
}

function computeCountdown(cycles, stats, today) {
  const activeCycle = findActiveCycle(cycles, today);
  if (activeCycle) {
    return { onPeriod: true };
  }
  if (!stats.lastStart || !stats.effectiveCycleLength) {
    return { daysUntil: null };
  }
  const dayOfCycle = daysBetween(stats.lastStart, today) + 1;
  const daysUntil = daysBetween(today, stats.predictedNext);
  const percent = Math.max(0, Math.min(100, (dayOfCycle / stats.effectiveCycleLength) * 100));
  return { daysUntil, percent, dayOfCycle, cycleLength: stats.effectiveCycleLength, estimated: stats.isEstimate };
}

// Builds a periodic wavy path (viewBox 400x60) with `waves` full crests, so it can
// loop seamlessly when the <svg> is doubled in width and scrolled by 50%.
function buildWavePath(amplitude, waves = 4, width = 400, height = 60) {
  const mid = height / 2;
  const segmentWidth = width / (waves * 2);
  let d = `M0,${mid}`;
  for (let i = 0; i < waves * 2; i++) {
    const x1 = segmentWidth * i + segmentWidth / 2;
    const y1 = mid + (i % 2 === 0 ? -amplitude : amplitude);
    const x2 = segmentWidth * (i + 1);
    const y2 = mid;
    d += ` Q${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }
  d += ` L${width},${height} L0,${height} Z`;
  return d;
}

function updateOffsetLabel() {
  const d = getPreviewToday();
  if (previewOffset === 0) {
    dateOffsetValue.textContent = `Today (${formatDate(d)})`;
  } else {
    const sign = previewOffset > 0 ? '+' : '';
    dateOffsetValue.textContent = `${sign}${previewOffset}d · ${formatDate(d)}`;
  }
}

function render() {
  const stats = computeStats(cycles);
  const previewToday = getPreviewToday();
  const moodInfo = determineMood(cycles, stats, previewToday);

  molaEl.classList.remove('mood-period', 'mood-fertile', 'mood-calm');
  molaEl.classList.add(`mood-${moodInfo.mood}`);
  moodBubble.textContent = moodInfo.message;

  statStatus.textContent = moodInfo.status;
  statCycleLength.textContent = stats.avgCycleLength ? `${stats.avgCycleLength} days` : '–';
  statPeriodLength.textContent = stats.avgPeriodLength ? `${stats.avgPeriodLength} days` : '–';
  statNextStart.textContent = stats.predictedNext
    ? `${formatDate(stats.predictedNext)}${stats.isEstimate ? ' (est.)' : ''}`
    : '–';

  const countdown = computeCountdown(cycles, stats, previewToday);
  waveMarker.classList.remove('marker-period', 'marker-soon');
  waveBox.classList.remove('wave-soon');

  let urgency, percent, soon, note = '';
  if (countdown.onPeriod) {
    statDaysUntil.textContent = "It's here";
    percent = 100;
    urgency = 1;
    soon = true;
    waveMarker.classList.add('marker-period');
  } else if (countdown.daysUntil === null) {
    statDaysUntil.textContent = '–';
    percent = 0;
    urgency = 0.12;
    soon = false;
  } else {
    const daysUntil = countdown.daysUntil;
    if (daysUntil <= 0) {
      statDaysUntil.textContent = daysUntil === 0 ? 'Due today' : `${Math.abs(daysUntil)}d overdue`;
      urgency = 1;
      soon = true;
    } else {
      statDaysUntil.textContent = `${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
      urgency = Math.max(0, Math.min(1, 1 - daysUntil / 14));
      soon = daysUntil <= 3;
    }
    percent = countdown.percent;
    if (countdown.estimated) {
      note = `Estimate based on a typical ${DEFAULT_CYCLE_LENGTH}-day cycle — log your next period for a personalized prediction.`;
    }
  }
  countdownNote.textContent = note;
  countdownNote.classList.toggle('hidden', !note);

  if (soon) {
    waveMarker.classList.add('marker-soon');
    waveBox.classList.add('wave-soon');
  }

  const waveHeight = 6 + urgency * 22;
  const waveDuration = 3.4 - urgency * 2.8;
  waveBox.style.setProperty('--wave-height', `${waveHeight.toFixed(1)}px`);
  waveBox.style.setProperty('--wave-duration', `${waveDuration.toFixed(2)}s`);

  const frontAmplitude = 4 + urgency * 18;
  const backAmplitude = 3 + urgency * 12;
  wavePathFront.setAttribute('d', buildWavePath(frontAmplitude));
  wavePathBack.setAttribute('d', buildWavePath(backAmplitude));

  waveMarker.style.left = `${percent}%`;

  const openCycle = cycles.find(c => !c.end);
  if (openCycle) {
    openBanner.classList.remove('hidden');
    openBannerText.textContent = `Period started ${formatDate(parseDate(openCycle.start))} — still open.`;
  } else {
    openBanner.classList.add('hidden');
  }

  historyList.innerHTML = '';
  if (cycles.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty-state';
    li.textContent = 'No entries yet — log your first period above.';
    historyList.appendChild(li);
  } else {
    [...cycles].reverse().forEach((cycle) => {
      const li = document.createElement('li');
      li.className = 'history-item';

      const datesSpan = document.createElement('span');
      datesSpan.className = 'dates';
      const startFmt = formatDate(parseDate(cycle.start));
      if (cycle.end) {
        const endFmt = formatDate(parseDate(cycle.end));
        const len = daysBetween(parseDate(cycle.start), parseDate(cycle.end)) + 1;
        datesSpan.innerHTML = `${startFmt} – ${endFmt} <span class="length-tag">(${len}d)</span>`;
      } else {
        datesSpan.innerHTML = `${startFmt} – ongoing`;
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete entry';
      delBtn.addEventListener('click', () => deleteCycle(cycle.key));

      li.appendChild(datesSpan);
      li.appendChild(delBtn);
      historyList.appendChild(li);
    });
  }
}

startPeriodBtn.addEventListener('click', openStartCalendar);
startCalClose.addEventListener('click', () => startCalDialog.close());
startCalDialog.addEventListener('click', (e) => {
  if (e.target === startCalDialog) startCalDialog.close();
});
startCalPrev.addEventListener('click', () => {
  startCalView = addDays(startCalView, -CAL_WINDOW_DAYS);
  renderStartCalendar();
});
startCalNext.addEventListener('click', () => {
  startCalView = addDays(startCalView, CAL_WINDOW_DAYS);
  renderStartCalendar();
});

function closeEndCalendar() {
  pendingStart = null;
  pendingEnd = null;
  endCalDialog.close();
}
endCalClose.addEventListener('click', closeEndCalendar);
endCalDialog.addEventListener('click', (e) => {
  if (e.target === endCalDialog) closeEndCalendar();
});
endCalPrev.addEventListener('click', () => {
  endCalView = addDays(endCalView, -CAL_WINDOW_DAYS);
  renderEndCalendar();
});
endCalNext.addEventListener('click', () => {
  endCalView = addDays(endCalView, CAL_WINDOW_DAYS);
  renderEndCalendar();
});
savePeriodBtn.addEventListener('click', () => {
  if (!pendingEnd) return;
  addCycle(pendingStart, pendingEnd);
  pendingStart = null;
  pendingEnd = null;
  endCalDialog.close();
});
periodOngoingBtn.addEventListener('click', () => {
  addCycle(pendingStart, null);
  pendingStart = null;
  pendingEnd = null;
  endCalDialog.close();
});

endTodayBtn.addEventListener('click', closeOpenCycleToday);
seedDataBtn.addEventListener('click', seedSampleData);
clearDataBtn.addEventListener('click', clearAllData);

molaInfoBtn.addEventListener('click', () => molaInfoDialog.showModal());
molaInfoClose.addEventListener('click', () => molaInfoDialog.close());
molaInfoDialog.addEventListener('click', (e) => {
  if (e.target === molaInfoDialog) molaInfoDialog.close();
});

dateOffsetSlider.addEventListener('input', () => {
  previewOffset = parseInt(dateOffsetSlider.value, 10);
  updateOffsetLabel();
  render();
});

dateOffsetReset.addEventListener('click', () => {
  previewOffset = 0;
  dateOffsetSlider.value = 0;
  updateOffsetLabel();
  render();
});

updateOffsetLabel();
render();

// --- Auth ------------------------------------------------------------------

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    signinScreen.classList.add('hidden');
    appShell.classList.remove('hidden');
    accountBar.classList.remove('hidden');
    accountEmail.textContent = user.email || '';
    subscribeToCycles(user.uid);
  } else {
    signinScreen.classList.remove('hidden');
    appShell.classList.add('hidden');
    accountBar.classList.add('hidden');
    if (unsubscribeCycles) {
      unsubscribeCycles();
      unsubscribeCycles = null;
    }
    cycles = [];
    render();
  }
});

googleSigninBtn.addEventListener('click', async () => {
  signinError.textContent = '';
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (err) {
    signinError.textContent = `Sign-in failed: ${err.message}`;
  }
});

signoutBtn.addEventListener('click', () => fbSignOut(auth));

// --- PWA: install banner + service worker -------------------------------

const INSTALL_DISMISS_KEY = 'molaInstallDismissed';
const installBanner = document.getElementById('install-banner');
const installBannerText = document.getElementById('install-banner-text');
const installBannerAction = document.getElementById('install-banner-action');
const installBannerDismiss = document.getElementById('install-banner-dismiss');

let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function showInstallBanner(text, { withAction } = {}) {
  if (localStorage.getItem(INSTALL_DISMISS_KEY) === 'true') return;
  if (isStandalone()) return;
  installBannerText.textContent = text;
  installBannerAction.classList.toggle('hidden', !withAction);
  installBanner.classList.remove('hidden');
}

function dismissInstallBanner() {
  installBanner.classList.add('hidden');
  localStorage.setItem(INSTALL_DISMISS_KEY, 'true');
}

installBannerDismiss.addEventListener('click', dismissInstallBanner);

installBannerAction.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBanner.classList.add('hidden');
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBanner('Install Mola Mola Tracker on your phone for quick access. 🐟', { withAction: true });
});

window.addEventListener('appinstalled', () => {
  installBanner.classList.add('hidden');
  localStorage.setItem(INSTALL_DISMISS_KEY, 'true');
});

if (isIos() && !isStandalone()) {
  showInstallBanner('Tip: tap Share, then "Add to Home Screen" to install this app. 🐟');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
