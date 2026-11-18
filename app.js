// ---------- State ----------
let allWords = [];      // every card from words.json
let deck = [];          // cards currently being shown (after shuffle/filter)
let index = 0;          // position in the deck
let showOnlyLearning = false;

// "known" words are saved on the device so progress survives closing the app
const STORAGE_KEY = 'flashcards-known';
let known = new Set(loadKnown());

function loadKnown() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveKnown() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...known])); }
  catch { /* storage unavailable: progress just won't persist */ }
}

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const card = $('card');

// ---------- Load words ----------
fetch('words.json')
  .then((r) => r.json())
  .then((data) => {
    allWords = data;
    buildDeck();
  })
  .catch(() => {
    $('word').textContent = 'Could not load words';
  });

function buildDeck() {
  deck = showOnlyLearning ? allWords.filter((w) => !known.has(w.word)) : [...allWords];
  if (index >= deck.length) index = 0;
  render();
}

// ---------- Draw the current card ----------
function render() {
  const wasFlipped = card.classList.contains('flipped');
  card.classList.remove('flipped');
  $('known').textContent = `Known: ${known.size} / ${allWords.length}`;
  $('done').classList.toggle('hidden', !(showOnlyLearning && deck.length === 0 && allWords.length > 0));

  if (deck.length === 0) {
    $('word').textContent = showOnlyLearning ? '🎉' : '';
    $('counter').textContent = '0 / 0';
    card.classList.remove('is-known');
    return;
  }

  const w = deck[index];
  // wait for the flip-back animation before swapping text, so the answer isn't revealed
  setTimeout(() => {
    $('word').textContent = w.word;
    $('word-back').textContent = w.word;
    $('explanation').textContent = w.explanation;
    $('example').textContent = w.example;
  }, wasFlipped ? 250 : 0);

  $('counter').textContent = `${index + 1} / ${deck.length}`;
  card.classList.toggle('is-known', known.has(w.word));
}

// ---------- Actions ----------
function flip() { card.classList.toggle('flipped'); }

function next() {
  if (deck.length === 0) return;
  index = (index + 1) % deck.length;
  render();
}

function prev() {
  if (deck.length === 0) return;
  index = (index - 1 + deck.length) % deck.length;
  render();
}

function mark(isKnown) {
  if (deck.length === 0) return;
  const w = deck[index].word;
  isKnown ? known.add(w) : known.delete(w);
  saveKnown();
  if (showOnlyLearning && isKnown) {
    buildDeck(); // card leaves the "still learning" pile
  } else {
    next();
  }
}

function shuffle() {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  index = 0;
  render();
}

// ---------- Wire up buttons, keyboard, and swipes ----------
card.addEventListener('click', flip);
$('next').addEventListener('click', next);
$('prev').addEventListener('click', prev);
$('gotit').addEventListener('click', () => mark(true));
$('learning').addEventListener('click', () => mark(false));
$('shuffle').addEventListener('click', shuffle);
$('filter').addEventListener('click', () => {
  showOnlyLearning = !showOnlyLearning;
  $('filter').textContent = showOnlyLearning ? 'Show: still learning' : 'Show: all';
  index = 0;
  buildDeck();
});
$('reset').addEventListener('click', () => {
  known.clear();
  saveKnown();
  buildDeck();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
});

// swipe left/right on phones
let touchX = null;
card.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
card.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) {
    e.preventDefault(); // a swipe shouldn't also flip the card
    dx < 0 ? next() : prev();
  }
  touchX = null;
});

// ---------- PWA: register the service worker (enables offline + install) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .catch((err) => console.log('Service worker failed:', err));
  });
}

window.addEventListener('offline', () => { $('offline-note').textContent = 'Offline — your cards still work.'; });
window.addEventListener('online', () => { $('offline-note').textContent = ''; });
