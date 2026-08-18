const STORAGE_KEY = 'molaMolaCycles';

const molaEl = document.getElementById('mola');
const moodBubble = document.getElementById('mood-bubble');
const statStatus = document.getElementById('stat-status');
const statCycleLength = document.getElementById('stat-cycle-length');
const statPeriodLength = document.getElementById('stat-period-length');
const statNextStart = document.getElementById('stat-next-start');
const logForm = document.getElementById('log-form');
const startInput = document.getElementById('start-date');
const endInput = document.getElementById('end-date');
const historyList = document.getElementById('history-list');
const openBanner = document.getElementById('open-cycle-banner');
const openBannerText = document.getElementById('open-cycle-text');
const endTodayBtn = document.getElementById('end-today-btn');
const statDaysUntil = document.getElementById('stat-days-until');
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

let previewOffset = 0;

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

function loadCycles() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return raw.sort((a, b) => a.start.localeCompare(b.start));
  } catch {
    return [];
  }
}

function saveCycles(cycles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cycles));
}

function addCycle(start, end) {
  const cycles = loadCycles();
  cycles.push({ start, end: end || null });
  saveCycles(cycles);
}

function deleteCycle(index) {
  const cycles = loadCycles();
  cycles.splice(index, 1);
  saveCycles(cycles);
  render();
}

function closeOpenCycleToday() {
  const cycles = loadCycles();
  const openIndex = cycles.findIndex(c => !c.end);
  if (openIndex === -1) return;
  cycles[openIndex].end = todayStr();
  saveCycles(cycles);
  render();
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
  const avgCycleLength = recentCycleLengths.length
    ? Math.round(recentCycleLengths.reduce((a, b) => a + b, 0) / recentCycleLengths.length)
    : null;

  const lastStart = starts.length ? parseDate(starts[starts.length - 1]) : null;
  const predictedNext = lastStart && avgCycleLength
    ? new Date(lastStart.getTime() + avgCycleLength * 86400000)
    : null;

  return { avgPeriodLength, avgCycleLength, lastStart, predictedNext };
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
  if (!stats.lastStart || !stats.avgCycleLength) {
    return { daysUntil: null };
  }
  const dayOfCycle = daysBetween(stats.lastStart, today) + 1;
  const daysUntil = daysBetween(today, stats.predictedNext);
  const percent = Math.max(0, Math.min(100, (dayOfCycle / stats.avgCycleLength) * 100));
  return { daysUntil, percent, dayOfCycle, cycleLength: stats.avgCycleLength };
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

function seedSampleData() {
  const cycles = [];
  let start = addDays(parseDate(todayStr()), -21);
  for (let i = 0; i < 10; i++) {
    const periodLen = randInt(4, 6);
    const end = addDays(start, periodLen - 1);
    cycles.unshift({ start: fmtLocal(start), end: fmtLocal(end) });
    const cycleLen = randInt(26, 31);
    start = addDays(start, -cycleLen);
  }
  saveCycles(cycles);
  render();
}

function clearAllData() {
  if (!confirm('Clear all logged cycles? This cannot be undone.')) return;
  localStorage.removeItem(STORAGE_KEY);
  render();
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
  const cycles = loadCycles();
  const stats = computeStats(cycles);
  const previewToday = getPreviewToday();
  const moodInfo = determineMood(cycles, stats, previewToday);

  molaEl.classList.remove('mood-period', 'mood-fertile', 'mood-calm');
  molaEl.classList.add(`mood-${moodInfo.mood}`);
  moodBubble.textContent = moodInfo.message;

  statStatus.textContent = moodInfo.status;
  statCycleLength.textContent = stats.avgCycleLength ? `${stats.avgCycleLength} days` : '–';
  statPeriodLength.textContent = stats.avgPeriodLength ? `${stats.avgPeriodLength} days` : '–';
  statNextStart.textContent = stats.predictedNext ? formatDate(stats.predictedNext) : '–';

  const countdown = computeCountdown(cycles, stats, previewToday);
  waveMarker.classList.remove('marker-period', 'marker-soon');
  waveBox.classList.remove('wave-soon');

  let urgency, percent, soon;
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
  }

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
      const realIndex = cycles.indexOf(cycle);
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
      delBtn.addEventListener('click', () => deleteCycle(realIndex));

      li.appendChild(datesSpan);
      li.appendChild(delBtn);
      historyList.appendChild(li);
    });
  }
}

logForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const start = startInput.value;
  const end = endInput.value;
  if (!start) return;
  if (end && end < start) {
    alert('End date cannot be before start date.');
    return;
  }
  addCycle(start, end);
  logForm.reset();
  render();
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

startInput.max = todayStr();
endInput.max = todayStr();

updateOffsetLabel();
render();
