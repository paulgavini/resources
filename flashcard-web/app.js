const DB_NAME = "notebooklm-flashcards";
const DB_VERSION = 1;
const LEGACY_STORAGE_KEY = "notebooklm-flashcards-state-v1";
const DEVELOPMENT_DECK_ID = "bundled-chemical-reactions";
const BADGES = [
  { id: "first_review", emoji: "⭐", title: "First card reviewed", description: "Mark one card as Review or Known." },
  { id: "streak_5", emoji: "🔥", title: "5-card streak", description: "Mark five cards Known in a row." },
  { id: "streak_10", emoji: "⚡", title: "10-card streak", description: "Mark ten cards Known in a row." },
  { id: "ten_mastered", emoji: "🎯", title: "10 cards mastered", description: "Mark ten different cards as Known." },
  { id: "half_deck", emoji: "🧠", title: "Half deck mastered", description: "Mark at least half of this deck as Known." },
  { id: "deck_master", emoji: "🏆", title: "Full deck mastered", description: "Mark every card in this deck as Known." },
  { id: "comeback", emoji: "✅", title: "Comeback card", description: "Mark a card Known after it was previously marked Review." },
];

let db;

const els = {
  csvInput: document.getElementById("csvInput"),
  deckSelect: document.getElementById("deckSelect"),
  deckTitle: document.getElementById("deckTitle"),
  deckMeta: document.getElementById("deckMeta"),
  counter: document.getElementById("counter"),
  cardLabel: document.getElementById("cardLabel"),
  cardText: document.getElementById("cardText"),
  flipButton: document.getElementById("flipButton"),
  flashcard: document.getElementById("flashcard"),
  prevButton: document.getElementById("prevButton"),
  nextButton: document.getElementById("nextButton"),
  againButton: document.getElementById("againButton"),
  goodButton: document.getElementById("goodButton"),
  againCount: document.getElementById("againCount"),
  goodCount: document.getElementById("goodCount"),
  xpValue: document.getElementById("xpValue"),
  levelValue: document.getElementById("levelValue"),
  streakValue: document.getElementById("streakValue"),
  masteryValue: document.getElementById("masteryValue"),
  encouragement: document.getElementById("encouragement"),
  badgeRow: document.getElementById("badgeRow"),
  progressBar: document.getElementById("progressBar"),
  deleteDeckButton: document.getElementById("deleteDeckButton"),
  shuffleButton: document.getElementById("shuffleButton"),
  printButton: document.getElementById("printButton"),
  exportButton: document.getElementById("exportButton"),
  resetButton: document.getElementById("resetButton"),
  toggleListButton: document.getElementById("toggleListButton"),
  drawer: document.getElementById("drawer"),
  closeDrawerButton: document.getElementById("closeDrawerButton"),
  searchInput: document.getElementById("searchInput"),
  cardList: document.getElementById("cardList"),
  printSheet: document.getElementById("printSheet"),
  filterButtons: Array.from(document.querySelectorAll(".filter-button")),
};

const state = {
  activeDeckId: "",
  decks: [],
  title: "Flashcards",
  cards: [],
  order: [],
  index: 0,
  showingAnswer: false,
  marks: {},
  stats: createEmptyStats(),
  filter: "all",
  search: "",
};

function createEmptyStats() {
  return {
    xp: 0,
    streak: 0,
    bestStreak: 0,
    attempts: 0,
    badges: {},
    message: "Choose a card response to start building progress.",
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("decks")) {
        database.createObjectStore("decks", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("settings")) {
        database.createObjectStore("settings", { keyPath: "key" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function storeRequest(storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const request = action(store);
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function getAllDecks() {
  return storeRequest("decks", "readonly", (store) => store.getAll());
}

function putDeck(deck) {
  return storeRequest("decks", "readwrite", (store) => store.put(deck));
}

function deleteDeckRecord(id) {
  return storeRequest("decks", "readwrite", (store) => store.delete(id));
}

async function getSetting(key) {
  const record = await storeRequest("settings", "readonly", (store) => store.get(key));
  return record ? record.value : null;
}

function setSetting(key, value) {
  return storeRequest("settings", "readwrite", (store) => store.put({ key, value }));
}

async function init() {
  db = await openDatabase();
  await migrateLegacyDeck();
  await removeDevelopmentDeck();
  await refreshDecks();

  if (!state.decks.length) {
    clearActiveDeck();
    render();
    return;
  }

  const activeDeckId = await getSetting("activeDeckId");
  const deck = state.decks.find((candidate) => candidate.id === activeDeckId) || state.decks[0];
  await activateDeck(deck.id);
}

async function migrateLegacyDeck() {
  if (await getSetting("legacyMigrated")) return;

  try {
    const saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.cards) && saved.cards.length) {
      const deck = normalizeDeck({
        id: createId(),
        title: saved.title || "Imported flashcards",
        cards: saved.cards,
        order: saved.order,
        index: saved.index,
        marks: saved.marks,
        stats: saved.stats,
      });
      await putDeck(deck);
      await setSetting("activeDeckId", deck.id);
    }
  } catch {
    // Ignore malformed legacy data.
  }

  await setSetting("legacyMigrated", true);
}

async function removeDevelopmentDeck() {
  const decks = await getAllDecks();
  const developmentDeckIds = decks
    .filter((deck) => {
      const firstQuestion = deck.cards && deck.cards[0] ? deck.cards[0].question : "";
      return deck.id === DEVELOPMENT_DECK_ID
        || (deck.title === "Chemical reactions"
          && firstQuestion === "Why do chemists classify chemical reactions into common types?");
    })
    .map((deck) => deck.id);

  await Promise.all(developmentDeckIds.map((id) => deleteDeckRecord(id)));

  if (developmentDeckIds.includes(await getSetting("activeDeckId"))) {
    await setSetting("activeDeckId", "");
  }
}

async function refreshDecks() {
  state.decks = (await getAllDecks())
    .map(normalizeDeck)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

function normalizeDeck(deck) {
  const cards = Array.isArray(deck.cards) ? deck.cards : [];
  const order = Array.isArray(deck.order) && deck.order.length === cards.length
    ? deck.order
    : cards.map((_, idx) => idx);

  return {
    id: deck.id || createId(),
    title: deck.title || "Untitled deck",
    cards,
    order,
    index: Math.min(Math.max(Number(deck.index) || 0, 0), Math.max(cards.length - 1, 0)),
    marks: deck.marks && typeof deck.marks === "object" ? deck.marks : {},
    stats: normalizeStats(deck.stats),
    createdAt: Number(deck.createdAt) || Date.now(),
    updatedAt: Number(deck.updatedAt) || Date.now(),
  };
}

function normalizeStats(stats) {
  return {
    ...createEmptyStats(),
    ...(stats && typeof stats === "object" ? stats : {}),
    badges: stats && typeof stats.badges === "object" ? stats.badges : {},
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows
    .filter((cells) => cells.some((value) => value.trim()))
    .map((cells, idx) => ({
      id: stableId(cells[0] || `card-${idx}`),
      question: (cells[0] || "").trim(),
      answer: (cells[1] || "").trim(),
    }))
    .filter((card) => card.question && card.answer);
}

function stableId(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return `card-${Math.abs(hash)}`;
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `deck-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function addDeck(cards, title, preferredId = "") {
  const now = Date.now();
  const deck = normalizeDeck({
    id: preferredId || createId(),
    title,
    cards,
    order: cards.map((_, idx) => idx),
    index: 0,
    marks: {},
    stats: createEmptyStats(),
    createdAt: now,
    updatedAt: now,
  });
  await putDeck(deck);
  await refreshDecks();
  await activateDeck(deck.id);
}

async function activateDeck(id) {
  const deck = state.decks.find((candidate) => candidate.id === id);
  if (!deck) return;

  state.activeDeckId = deck.id;
  state.title = deck.title;
  state.cards = deck.cards;
  state.order = deck.order;
  state.index = deck.index;
  state.marks = deck.marks;
  state.stats = normalizeStats(deck.stats);
  state.showingAnswer = false;
  state.search = "";
  els.searchInput.value = "";

  await setSetting("activeDeckId", deck.id);
  render();
}

function clearActiveDeck() {
  state.activeDeckId = "";
  state.title = "Flashcards";
  state.cards = [];
  state.order = [];
  state.index = 0;
  state.marks = {};
  state.stats = createEmptyStats();
  state.showingAnswer = false;
  state.search = "";
  els.searchInput.value = "";
}

function activeDeckRecord() {
  const existing = state.decks.find((deck) => deck.id === state.activeDeckId);
  const now = Date.now();
  return normalizeDeck({
    id: state.activeDeckId || createId(),
    title: state.title,
    cards: state.cards,
    order: state.order,
    index: state.index,
    marks: state.marks,
    stats: state.stats,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  });
}

function saveState() {
  if (!state.activeDeckId) return Promise.resolve();
  const deck = activeDeckRecord();
  const deckIndex = state.decks.findIndex((candidate) => candidate.id === deck.id);
  if (deckIndex === -1) {
    state.decks.push(deck);
  } else {
    state.decks[deckIndex] = deck;
  }
  return putDeck(deck).then(() => setSetting("activeDeckId", deck.id));
}

function currentCard() {
  if (!state.cards.length) return null;
  return state.cards[state.order[state.index]];
}

function render() {
  const card = currentCard();
  const total = state.cards.length;
  const done = Object.keys(state.marks).length;
  const known = Object.values(state.marks).filter((mark) => mark === "good").length;
  const review = Object.values(state.marks).filter((mark) => mark === "again").length;
  const mastery = total ? Math.round((known / total) * 100) : 0;

  renderDeckSelect();
  els.deckTitle.textContent = state.title;
  els.deckMeta.textContent = total ? `${done} reviewed of ${total}` : "Import a two-column CSV";
  els.counter.textContent = total ? `${state.index + 1} / ${total}` : "0 / 0";
  els.goodCount.textContent = String(known);
  els.againCount.textContent = String(review);
  els.xpValue.textContent = String(state.stats.xp);
  els.levelValue.textContent = String(currentLevel());
  els.streakValue.textContent = String(state.stats.streak);
  els.masteryValue.textContent = `${mastery}%`;
  els.encouragement.textContent = state.stats.message;
  els.progressBar.style.width = total ? `${(done / total) * 100}%` : "0%";

  if (!card) {
    els.cardLabel.textContent = "Deck";
    els.cardText.textContent = "Import a CSV to begin.";
    els.cardText.classList.remove("answer");
    els.flipButton.textContent = "Choose file";
  } else if (state.showingAnswer) {
    els.cardLabel.textContent = "Answer";
    els.cardText.innerHTML = formatText(card.answer);
    els.cardText.classList.add("answer");
    els.flipButton.textContent = "See question";
  } else {
    els.cardLabel.textContent = "Question";
    els.cardText.innerHTML = formatText(card.question);
    els.cardText.classList.remove("answer");
    els.flipButton.textContent = "See answer";
  }

  els.prevButton.disabled = total <= 1;
  els.nextButton.disabled = total <= 1;
  els.againButton.disabled = !total;
  els.goodButton.disabled = !total;
  els.shuffleButton.disabled = !total;
  els.printButton.disabled = !total;
  els.exportButton.disabled = !total;
  els.deleteDeckButton.disabled = !state.activeDeckId;
  els.deckSelect.disabled = !state.decks.length;

  renderList();
  renderPrintSheet();
  renderBadges();
}

function renderDeckSelect() {
  const fragment = document.createDocumentFragment();
  state.decks.forEach((deck) => {
    const option = document.createElement("option");
    const reviewed = Object.keys(deck.marks || {}).length;
    option.value = deck.id;
    option.textContent = `${deck.title} (${reviewed}/${deck.cards.length})`;
    fragment.append(option);
  });
  els.deckSelect.replaceChildren(fragment);
  els.deckSelect.value = state.activeDeckId;
}

function move(delta) {
  if (!state.cards.length) return;
  state.index = (state.index + delta + state.order.length) % state.order.length;
  state.showingAnswer = false;
  void saveState();
  render();
}

function flip() {
  if (!state.cards.length) {
    els.csvInput.click();
    return;
  }
  state.showingAnswer = !state.showingAnswer;
  render();
}

function mark(value) {
  const card = currentCard();
  if (!card) return;
  applyProgress(value, card);
  state.marks[card.id] = value;
  state.showingAnswer = false;
  state.index = (state.index + 1 + state.order.length) % state.order.length;
  void saveState();
  render();
}

function applyProgress(value, card) {
  const previousMark = state.marks[card.id];
  const knownBefore = Object.values(state.marks).filter((mark) => mark === "good").length;
  let xpGain = value === "good" ? 5 : 1;
  const unlocked = [];
  const comeback = previousMark === "again" && value === "good";

  state.stats.attempts += 1;

  if (value === "good") {
    state.stats.streak += 1;
    state.stats.bestStreak = Math.max(state.stats.bestStreak, state.stats.streak);
    if (state.stats.streak > 1 && state.stats.streak % 5 === 0) xpGain += 2;
    if (comeback) xpGain += 3;
  } else {
    state.stats.streak = 0;
  }

  state.stats.xp += xpGain;
  const knownAfter = knownBefore + (value === "good" && previousMark !== "good" ? 1 : 0);

  unlockBadge("first_review", unlocked);
  if (state.stats.streak >= 5) unlockBadge("streak_5", unlocked);
  if (state.stats.streak >= 10) unlockBadge("streak_10", unlocked);
  if (knownAfter >= 10) unlockBadge("ten_mastered", unlocked);
  if (state.cards.length && knownAfter >= Math.ceil(state.cards.length / 2)) unlockBadge("half_deck", unlocked);
  if (state.cards.length && knownAfter >= state.cards.length) unlockBadge("deck_master", unlocked);
  if (comeback) unlockBadge("comeback", unlocked);

  state.stats.message = buildEncouragement(value, xpGain, comeback, knownAfter, unlocked);
}

function unlockBadge(id, unlocked) {
  if (state.stats.badges[id]) return;
  state.stats.badges[id] = Date.now();
  const badge = BADGES.find((candidate) => candidate.id === id);
  if (badge) unlocked.push(badge);
}

function buildEncouragement(value, xpGain, comeback, knownAfter, unlocked) {
  if (unlocked.length) {
    const badge = unlocked[unlocked.length - 1];
    return `${badge.emoji} Badge unlocked: ${badge.title}. +${xpGain} XP`;
  }

  if (comeback) return `✅ Nice recovery. That review card is stronger now. +${xpGain} XP`;
  if (value === "again") return `🧠 Good choice. Reviewing this again is how it sticks. +${xpGain} XP`;
  if (state.stats.streak >= 5) return `🔥 ${state.stats.streak}-card streak. Keep the momentum steady. +${xpGain} XP`;
  if (knownAfter > 0 && knownAfter % 10 === 0) return `🎯 ${knownAfter} cards mastered. Strong progress. +${xpGain} XP`;
  return `⭐ Good retrieval. +${xpGain} XP`;
}

function currentLevel() {
  return Math.floor(state.stats.xp / 50) + 1;
}

function shuffle() {
  for (let i = state.order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [state.order[i], state.order[j]] = [state.order[j], state.order[i]];
  }
  state.index = 0;
  state.showingAnswer = false;
  void saveState();
  render();
}

function resetProgress() {
  state.index = 0;
  state.showingAnswer = false;
  state.marks = {};
  state.stats = createEmptyStats();
  void saveState();
  render();
}

function renderBadges() {
  const fragment = document.createDocumentFragment();
  BADGES.forEach((badge) => {
    const unlocked = Boolean(state.stats.badges[badge.id]);
    const status = unlocked ? "Unlocked" : "Locked";
    const description = `${badge.title}. ${badge.description} ${status}.`;
    const item = document.createElement("span");
    item.className = unlocked ? "badge unlocked" : "badge";
    item.title = description;
    item.dataset.description = description;
    item.tabIndex = 0;
    item.setAttribute("role", "img");
    item.setAttribute("aria-label", description);
    item.textContent = badge.emoji;
    fragment.append(item);
  });
  els.badgeRow.replaceChildren(fragment);
}

async function deleteCurrentDeck() {
  if (!state.activeDeckId) return;
  const shouldDelete = window.confirm(`Delete "${state.title}" from this browser?`);
  if (!shouldDelete) return;

  const deletedDeckId = state.activeDeckId;
  await deleteDeckRecord(deletedDeckId);
  await refreshDecks();

  if (!state.decks.length) {
    clearActiveDeck();
    await setSetting("activeDeckId", "");
    render();
    return;
  }

  await activateDeck(state.decks[0].id);
}

function renderList() {
  const query = state.search.trim().toLowerCase();
  const current = currentCard();
  const fragment = document.createDocumentFragment();

  state.cards.forEach((card, idx) => {
    const mark = state.marks[card.id] || "new";
    const haystack = `${card.question} ${card.answer}`.toLowerCase();
    if (state.filter !== "all" && mark !== state.filter) return;
    if (query && !haystack.includes(query)) return;

    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    if (current && current.id === card.id) button.classList.add("active");
    button.addEventListener("click", () => {
      const orderIndex = state.order.indexOf(idx);
      state.index = orderIndex === -1 ? 0 : orderIndex;
      state.showingAnswer = false;
      void saveState();
      render();
      if (window.matchMedia("(max-width: 980px)").matches) {
        els.drawer.classList.remove("open");
      }
    });

    const question = document.createElement("span");
    question.className = "list-question";
    question.innerHTML = formatText(card.question);

    const stateLabel = document.createElement("span");
    stateLabel.className = "list-state";
    stateLabel.textContent = mark === "again" ? "Review" : mark === "good" ? "Known" : "New";

    button.append(question, stateLabel);
    li.append(button);
    fragment.append(li);
  });

  els.cardList.replaceChildren(fragment);
}

function renderPrintSheet() {
  const fragment = document.createDocumentFragment();
  state.cards.forEach((card, idx) => {
    const article = document.createElement("article");
    article.className = "print-card";
    const q = document.createElement("div");
    const a = document.createElement("div");
    q.innerHTML = `<strong>Question ${idx + 1}</strong>`;
    a.innerHTML = "<strong>Answer</strong>";
    const qp = document.createElement("p");
    const ap = document.createElement("p");
    qp.innerHTML = formatText(card.question);
    ap.innerHTML = formatText(card.answer);
    q.append(qp);
    a.append(ap);
    article.append(q, a);
    fragment.append(article);
  });
  els.printSheet.replaceChildren(fragment);
}

function exportAnkiTsv() {
  const rows = state.cards.map((card) => `${tsvSafe(card.question)}\t${tsvSafe(card.answer)}`);
  const blob = new Blob([rows.join("\n")], { type: "text/tab-separated-values;charset=utf-8" });
  downloadBlob(blob, `${safeFileName(state.title)}-anki.tsv`);
}

function formatText(value) {
  return escapeHtml(value).replace(/\$([^$]+)\$/g, (_, expression) => {
    return `<span class="math">${formatMath(expression)}</span>`;
  });
}

function formatMath(expression) {
  return expression
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\times/g, "×")
    .replace(/\\Delta/g, "Δ")
    .replace(/\\alpha/g, "α")
    .replace(/\\beta/g, "β")
    .replace(/\\gamma/g, "γ")
    .replace(/_\{([^}]+)\}/g, "<sub>$1</sub>")
    .replace(/\^\{([^}]+)\}/g, "<sup>$1</sup>");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tsvSafe(value) {
  return value.replace(/\r?\n/g, "<br>").replace(/\t/g, " ");
}

function safeFileName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "flashcards";
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

els.csvInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const text = await file.text();
  const cards = parseCsv(text);
  if (!cards.length) {
    window.alert("No two-column flashcards were found in that CSV.");
    event.target.value = "";
    return;
  }

  await addDeck(cards, file.name.replace(/\.[^.]+$/, "") || "Imported flashcards");
  event.target.value = "";
});

els.deckSelect.addEventListener("change", async () => {
  await activateDeck(els.deckSelect.value);
});
els.flipButton.addEventListener("click", flip);
els.flashcard.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  flip();
});
els.prevButton.addEventListener("click", () => move(-1));
els.nextButton.addEventListener("click", () => move(1));
els.againButton.addEventListener("click", () => mark("again"));
els.goodButton.addEventListener("click", () => mark("good"));
els.deleteDeckButton.addEventListener("click", () => {
  void deleteCurrentDeck();
});
els.shuffleButton.addEventListener("click", shuffle);
els.resetButton.addEventListener("click", resetProgress);
els.printButton.addEventListener("click", () => window.print());
els.exportButton.addEventListener("click", exportAnkiTsv);
els.toggleListButton.addEventListener("click", () => els.drawer.classList.toggle("open"));
els.closeDrawerButton.addEventListener("click", () => els.drawer.classList.remove("open"));
els.searchInput.addEventListener("input", () => {
  state.search = els.searchInput.value;
  renderList();
});

els.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    els.filterButtons.forEach((candidate) => candidate.classList.toggle("active", candidate === button));
    renderList();
  });
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select")) return;
  if (event.key === " ") {
    event.preventDefault();
    flip();
  } else if (event.key === "ArrowLeft") {
    move(-1);
  } else if (event.key === "ArrowRight") {
    move(1);
  } else if (event.key.toLowerCase() === "x") {
    mark("again");
  } else if (event.key === "Enter" || event.key.toLowerCase() === "k") {
    mark("good");
  }
});

init().catch((error) => {
  console.error(error);
  els.deckMeta.textContent = "IndexedDB could not be opened in this browser.";
});
