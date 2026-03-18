// TODO: Add global leaderboard using a free service like jsonbin.io
// TODO: Add friend rooms with a shared room code
// TODO: Add weekly photo pack rotation
// TODO: Add difficulty modes (easy = famous landmarks, hard = random streets)

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY        = 'worldsnap_result_v1';
const STREAK_KEY         = 'worldsnap_streak_v1';
const MAX_ATTEMPTS       = 3;
const MAX_DROPDOWN_ITEMS = 8;
const MS_PER_DAY         = 86_400_000;
const MS_PER_HOUR        = 3_600_000;
const MS_PER_MINUTE      = 60_000;
const GAME_URL           = 'https://alinadeemwork.github.io/copilotAgents/worldsnap';

// ── Full country list for the searchable dropdown ──────────────────────────
const ALL_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain",
  "Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
  "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria",
  "Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada",
  "Central African Republic","Chad","Chile","China","Colombia","Comoros",
  "Congo","Costa Rica","Croatia","Cuba","Cyprus","Czechia","Denmark",
  "Djibouti","Dominica","Dominican Republic","DR Congo","Ecuador","Egypt",
  "El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
  "Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana",
  "Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti",
  "Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland",
  "Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati",
  "Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya",
  "Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia",
  "Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico",
  "Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique",
  "Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua",
  "Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines",
  "Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles",
  "Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia",
  "South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania",
  "Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu",
  "Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

// ── Application state ──────────────────────────────────────────────────────
let state = {
  photos:     [],
  dayPhoto:   null,
  dayNumber:  0,
  todayKey:   '',
  attempts:   0,
  hintsShown: 0,
  guesses:    [],   // [{ country: string, correct: boolean }]
  finished:   false,
  won:        false
};

let highlightIndex = -1;

// ── DOM helper ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Date helpers ──────────────────────────────────────────────────────────
function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayNumber() {
  return Math.floor(Date.now() / MS_PER_DAY);
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight - now;
}

function formatCountdown() {
  const ms = msUntilMidnight();
  const h  = Math.floor(ms / MS_PER_HOUR);
  const m  = Math.floor((ms % MS_PER_HOUR) / MS_PER_MINUTE);
  return `Next photo in ${h}h ${m}m`;
}

// ── Flag emoji from ISO country code ─────────────────────────────────────
function isoToFlag(isoCode) {
  return [...isoCode.toUpperCase()].map(c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  ).join('');
}

// ── Streak management ─────────────────────────────────────────────────────
function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? JSON.parse(raw) : { count: 0, lastWonDay: '' };
  } catch {
    return { count: 0, lastWonDay: '' };
  }
}

function saveStreak(streak) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}

function updateStreakOnWin() {
  const streak = loadStreak();
  const today  = getTodayKey();
  if (streak.lastWonDay === today) return; // already counted today

  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  streak.count      = streak.lastWonDay === yesterday ? streak.count + 1 : 1;
  streak.lastWonDay = today;
  saveStreak(streak);
}

function breakStreakOnLoss() {
  const streak = loadStreak();
  // Only reset if the player hasn't already won today (streak not yet saved as a win)
  if (streak.lastWonDay !== getTodayKey()) {
    streak.count = 0;
    saveStreak(streak);
  }
}

// ── Local storage persistence ─────────────────────────────────────────────
function loadStoredResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data.day === getTodayKey() ? data : null; // discard stale entries
  } catch {
    return null;
  }
}

function saveResult() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    day:        state.todayKey,
    attempts:   state.attempts,
    guesses:    state.guesses,
    finished:   state.finished,
    won:        state.won,
    hintsShown: state.hintsShown
  }));
}

// ── Share text ────────────────────────────────────────────────────────────
function buildShareText() {
  const squares = state.guesses.map(g => g.correct ? '🟩' : '🟥');
  while (squares.length < MAX_ATTEMPTS) squares.push('⬛');
  const resultLine = state.won
    ? `${squares.join('')} Got it in ${state.guesses.length}!`
    : `${squares.join('')} Better luck tomorrow!`;
  return `WorldSnap 🌍 Day ${state.dayNumber}\n${resultLine}\nPlay at: ${GAME_URL}`;
}

// ── Clipboard ─────────────────────────────────────────────────────────────
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for older browsers / non-HTTPS contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function showCopyConfirm(elementId, message, duration = 3000) {
  const el = $(elementId);
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, duration);
}

// ── Render helpers ────────────────────────────────────────────────────────
function renderStreak() {
  $('streak-count').textContent = loadStreak().count;
}

function renderAttemptPips() {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const pip = $(`pip-${i}`);
    pip.className = 'attempt-pip';
    if (i < state.guesses.length) {
      pip.classList.add(state.guesses[i].correct ? 'used-correct' : 'used-wrong');
    }
  }
}

function renderHints() {
  const list = $('hints-list');
  list.innerHTML = '';
  for (let i = 0; i < state.hintsShown; i++) {
    const hint = state.dayPhoto.hints[i];
    if (!hint) break;
    const div = document.createElement('div');
    div.className = 'hint-item';
    div.innerHTML = `<span class="hint-icon">💡</span><span>${hint}</span>`;
    list.appendChild(div);
  }
}

function showResult() {
  const photo   = state.dayPhoto;
  const flag    = isoToFlag(photo.isoCode);
  const outcome = $('result-outcome');

  if (state.won) {
    outcome.textContent = '🎉 Correct!';
    outcome.className   = 'result-outcome win';
  } else {
    outcome.textContent = '😞 Better luck tomorrow!';
    outcome.className   = 'result-outcome lose';
  }

  $('result-country').innerHTML = `The answer was <strong>${flag} ${photo.country}</strong>`;
  $('emoji-card').textContent   = buildShareText();
  $('result-section').hidden    = false;

  // Unblur the photo and update label
  $('daily-photo').classList.remove('blurred');
  $('photo-label').textContent = `📍 ${photo.country}`;

  // Pulse effect on win
  if (state.won) {
    const wrap = $('photo-wrap');
    wrap.classList.add('correct-pulse');
    wrap.addEventListener('animationend', () => wrap.classList.remove('correct-pulse'), { once: true });
  }
}

function lockInputArea() {
  $('input-area').hidden = true;
}

// ── Dropdown ──────────────────────────────────────────────────────────────
function openDropdown(matches) {
  const dd = $('dropdown');
  dd.innerHTML   = '';
  highlightIndex = -1;

  if (!matches.length) {
    const el = document.createElement('div');
    el.className   = 'dropdown-item no-match';
    el.textContent = 'No countries found';
    dd.appendChild(el);
  } else {
    matches.slice(0, MAX_DROPDOWN_ITEMS).forEach(country => {
      const el = document.createElement('div');
      el.className = 'dropdown-item';
      el.setAttribute('role', 'option');
      el.textContent = country;
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        selectCountry(country);
      });
      dd.appendChild(el);
    });
  }
  dd.classList.add('open');
}

function closeDropdown() {
  $('dropdown').classList.remove('open');
  highlightIndex = -1;
}

function highlightDropdownItem(delta) {
  const items = $('dropdown').querySelectorAll('.dropdown-item:not(.no-match)');
  if (!items.length) return;
  items[highlightIndex]?.classList.remove('active');
  if (highlightIndex === -1) {
    // First keyboard navigation: go to first or last item based on direction
    highlightIndex = delta > 0 ? 0 : items.length - 1;
  } else {
    highlightIndex = Math.max(0, Math.min(highlightIndex + delta, items.length - 1));
  }
  items[highlightIndex].classList.add('active');
  items[highlightIndex].scrollIntoView({ block: 'nearest' });
}

function selectCountry(country) {
  $('country-input').value = country;
  closeDropdown();
}

// ── Guess logic ───────────────────────────────────────────────────────────
function shakeElement(el) {
  el.classList.add('wrong-shake');
  el.addEventListener('animationend', () => el.classList.remove('wrong-shake'), { once: true });
}

function submitGuess() {
  if (state.finished) return;

  const input = $('country-input');
  const raw   = input.value.trim();

  if (!raw) {
    shakeElement(input);
    return;
  }

  // Validate against the known country list (case-insensitive)
  const matched = ALL_COUNTRIES.find(c => c.toLowerCase() === raw.toLowerCase());
  if (!matched) {
    shakeElement($('input-group'));
    input.placeholder = 'Please pick a country from the list';
    setTimeout(() => { input.placeholder = 'Type a country name…'; }, 2000);
    return;
  }

  const correct = matched.toLowerCase() === state.dayPhoto.country.toLowerCase();
  state.attempts++;
  state.guesses.push({ country: matched, correct });

  renderAttemptPips();
  input.value = '';
  closeDropdown();

  if (correct) {
    state.won      = true;
    state.finished = true;
    updateStreakOnWin();
    renderStreak();
    saveResult();
    lockInputArea();
    showResult();
    return;
  }

  // Wrong guess — reveal the next hint
  if (state.hintsShown < state.dayPhoto.hints.length) {
    state.hintsShown++;
    renderHints();
  }

  if (state.attempts >= MAX_ATTEMPTS) {
    state.finished = true;
    breakStreakOnLoss();
    renderStreak();
    saveResult();
    lockInputArea();
    showResult();
    return;
  }

  // Shake the input to signal wrong answer and persist partial progress
  shakeElement($('input-group'));
  saveResult();
}

// ── Event listeners ───────────────────────────────────────────────────────
$('country-input').addEventListener('input', function () {
  const q = this.value.trim().toLowerCase();
  if (!q) { closeDropdown(); return; }
  openDropdown(ALL_COUNTRIES.filter(c => c.toLowerCase().includes(q)));
});

$('country-input').addEventListener('keydown', function (e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); highlightDropdownItem(1);  return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); highlightDropdownItem(-1); return; }
  if (e.key === 'Enter') {
    const items = $('dropdown').querySelectorAll('.dropdown-item:not(.no-match)');
    if (highlightIndex >= 0 && items[highlightIndex]) {
      selectCountry(items[highlightIndex].textContent);
    } else {
      submitGuess();
    }
    return;
  }
  if (e.key === 'Escape') closeDropdown();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.input-group')) closeDropdown();
});

$('btn-guess').addEventListener('click', submitGuess);

$('btn-copy-result').addEventListener('click', async () => {
  await copyToClipboard(buildShareText());
  showCopyConfirm('copy-result-confirm', '✅ Copied to clipboard!');
});

$('btn-retry').addEventListener('click', () => location.reload());

// ── Share section setup ───────────────────────────────────────────────────
function setupShareSection() {
  $('btn-copy-link').addEventListener('click', async () => {
    await copyToClipboard(GAME_URL);
    showCopyConfirm('copy-link-confirm', '✅ Link copied!');
  });

  const msg = encodeURIComponent(`Play WorldSnap with me today! 🌍 ${GAME_URL}`);
  $('btn-whatsapp').href = `https://wa.me/?text=${msg}`;
  $('share-section').hidden = false;
}

// ── Game start (called after photos.json loads) ───────────────────────────
function startGame(photos) {
  const dayNumber = getDayNumber();
  const dayIndex  = dayNumber % photos.length;

  state.photos    = photos;
  state.dayPhoto  = photos[dayIndex];
  state.dayNumber = dayNumber;
  state.todayKey  = getTodayKey();

  $('daily-photo').src = state.dayPhoto.imageUrl;
  renderStreak();
  setupShareSection();

  const stored = loadStoredResult();
  if (stored) {
    // Restore a previous session for today
    state.attempts   = stored.attempts;
    state.guesses    = stored.guesses;
    state.finished   = stored.finished;
    state.won        = stored.won;
    // hintsShown was added later; for older stored results, estimate from the number
    // of wrong guesses. This relies on the game invariant: exactly one hint is revealed
    // per wrong guess. If that rule ever changes, increment a schema version number
    // in the stored payload and handle the migration explicitly here.
    state.hintsShown = stored.hintsShown ?? stored.guesses.filter(g => !g.correct).length;

    renderAttemptPips();
    renderHints();

    if (state.finished) {
      showResult();
      lockInputArea();
      $('played-banner').hidden    = false;
      $('next-reset').textContent  = formatCountdown();
    }
    // If not finished (partial game), restore state and let the player continue
  }

  $('loading-screen').hidden = true;
  $('main-content').hidden   = false;
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
async function init() {
  try {
    const res = await fetch('data/photos.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const photos = await res.json();
    if (!Array.isArray(photos) || photos.length === 0) {
      throw new Error('Photos data is empty or invalid');
    }
    startGame(photos);
  } catch (err) {
    console.error('WorldSnap init error:', err);
    $('error-message').textContent = err.message || 'Failed to load today\'s photo.';
    $('loading-screen').hidden = true;
    $('error-screen').hidden   = false;
  }
}

init();

// Automatically reload at midnight to show the next day's photo.
// After each reload, init() runs again and re-establishes this timeout,
// so the game stays fresh across multiple consecutive days of use.
setTimeout(() => location.reload(), msUntilMidnight() + 1000);
