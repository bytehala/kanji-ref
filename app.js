// Kanji Reference — IndexedDB-backed search over a JSON seed.

const DATA_VERSION = 1; // bump when kanji.json shape changes; clears + reseeds
const DB_NAME = "kanji-db";

const db = new Dexie(DB_NAME);
db.version(1).stores({
  kanji: "&kanji, meaning, kana, romaji",
});

// ---------- Seeding ----------

async function seedIfNeeded() {
  const storedVersion = localStorage.getItem("kanji_data_version");
  const count = await db.kanji.count();

  if (count > 0 && storedVersion === String(DATA_VERSION)) {
    return;
  }

  const response = await fetch("./kanji.json");
  if (!response.ok) {
    throw new Error(`Failed to load kanji.json: ${response.status}`);
  }
  const data = await response.json();

  await db.kanji.clear();
  await db.kanji.bulkPut(data);
  localStorage.setItem("kanji_data_version", String(DATA_VERSION));
}

// ---------- Search ----------

function matchesQuery(entry, query) {
  if (!query) return true;
  const q = query.toLowerCase();

  // Top-level fields
  if (entry.kanji && entry.kanji.includes(query)) return true;
  if (entry.meaning && entry.meaning.toLowerCase().includes(q)) return true;
  if (entry.kana && entry.kana.includes(query)) return true;
  if (entry.romaji && entry.romaji.toLowerCase().includes(q)) return true;

  // Components
  if (entry.components?.some(c =>
    (c.component && c.component.includes(query)) ||
    (c.meaning && c.meaning.toLowerCase().includes(q))
  )) return true;

  // Expressions
  if (entry.expressions?.some(e =>
    (e.expression && e.expression.includes(query)) ||
    (e.kana && e.kana.includes(query)) ||
    (e.romaji && e.romaji.toLowerCase().includes(q)) ||
    (e.meaning && e.meaning.toLowerCase().includes(q))
  )) return true;

  // Family
  if (entry.family?.some(f =>
    (f.kanji && f.kanji.includes(query)) ||
    (f.type && f.type.toLowerCase().includes(q))
  )) return true;

  return false;
}

async function search(query) {
  if (!query) {
    return await db.kanji.orderBy("kanji").toArray();
  }
  return await db.kanji.filter(entry => matchesQuery(entry, query)).toArray();
}

async function getByKanji(kanji) {
  return await db.kanji.get(kanji);
}

// ---------- Render ----------

const resultsList = document.getElementById("results-list");
const emptyState = document.getElementById("empty-state");
const detailPlaceholder = document.getElementById("detail-placeholder");
const detailContent = document.getElementById("detail-content");
const searchInput = document.getElementById("search");
const searchMeta = document.getElementById("search-meta");
const siteHeader = document.getElementById("site-header");
const searchToggle = document.getElementById("search-toggle");
const detailPane = document.getElementById("detail-pane");
const detailClose = document.getElementById("detail-close");

let selectedKanji = null;

function renderResults(entries) {
  resultsList.innerHTML = "";

  if (entries.length === 0) {
    emptyState.hidden = false;
    searchMeta.textContent = "0 entries";
    return;
  }
  emptyState.hidden = true;
  searchMeta.textContent = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;

  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "result-item";
    if (entry.kanji === selectedKanji) li.classList.add("active");
    li.dataset.kanji = entry.kanji;

    li.innerHTML = `
      <div class="result-kanji">${escapeHtml(entry.kanji)}</div>
      <div class="result-meta">
        <div class="result-reading">${escapeHtml(entry.kana || "")}</div>
        <div class="result-romaji">${escapeHtml(entry.romaji || "")}</div>
        <div class="result-meaning">${escapeHtml(entry.meaning || "")}</div>
      </div>
    `;

    li.addEventListener("click", () => selectKanji(entry.kanji));
    resultsList.appendChild(li);
  }
}

async function selectKanji(kanji) {
  const entry = await getByKanji(kanji);
  if (!entry) return;

  selectedKanji = kanji;

  // Update active state in list
  document.querySelectorAll(".result-item").forEach(el => {
    el.classList.toggle("active", el.dataset.kanji === kanji);
  });

  // Resolve family kanji meanings from DB
  const familyResolved = await Promise.all(
    (entry.family || []).map(async f => {
      const linked = await getByKanji(f.kanji);
      return {
        kanji: f.kanji,
        type: f.type || "",
        meaning: linked?.meaning || null,
        kana: linked?.kana || null,
      };
    })
  );

  renderDetail(entry, familyResolved);
  openDetail();
}

// ---------- Mobile detail overlay ----------

// On mobile (≤900px), the detail pane is a full-screen overlay above the list.
// The `is-open` class is a no-op on desktop, where the pane is a static column.
function openDetail() {
  detailPane.classList.add("is-open");
  document.body.classList.add("detail-open");
  detailPane.scrollTop = 0;
}

function closeDetail() {
  detailPane.classList.remove("is-open");
  document.body.classList.remove("detail-open");
}

// ---------- Mobile search toggle ----------

function openSearchBar() {
  siteHeader.classList.add("search-open");
  searchToggle.setAttribute("aria-expanded", "true");
}

function collapseSearchBar() {
  siteHeader.classList.remove("search-open");
  searchToggle.setAttribute("aria-expanded", "false");
}

function renderDetail(entry, familyResolved) {
  detailPlaceholder.hidden = true;
  detailContent.hidden = false;

  const components = entry.components || [];
  const expressions = entry.expressions || [];

  detailContent.innerHTML = `
    <header class="detail-header">
      <div class="detail-kanji">${escapeHtml(entry.kanji)}</div>
      <div class="detail-meta">
        <div class="detail-readings">
          <span class="detail-kana">${escapeHtml(entry.kana || "")}</span>
          <span class="detail-romaji">${escapeHtml(entry.romaji || "")}</span>
        </div>
        <div class="detail-meaning">${escapeHtml(entry.meaning || "")}</div>
      </div>
    </header>

    <section class="detail-section">
      <h2 class="section-title">Components</h2>
      ${components.length === 0
        ? `<p class="empty-section">Atomic — no decomposable components.</p>`
        : `<ul class="component-list">
            ${components.map(c => `
              <li class="component-item" data-search="${escapeHtml(c.component)}">
                <div class="component-char">${escapeHtml(c.component)}</div>
                <div class="component-meaning">${escapeHtml(c.meaning || "")}</div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>

    <section class="detail-section">
      <h2 class="section-title">Expressions</h2>
      ${expressions.length === 0
        ? `<p class="empty-section">No expressions recorded.</p>`
        : `<ul class="expression-list">
            ${expressions.map(e => `
              <li class="expression-item">
                <div class="expression-text">${escapeHtml(e.expression)}</div>
                <div class="expression-reading">
                  <span class="expression-kana">${escapeHtml(e.kana || "")}</span>
                  <span class="expression-romaji">${escapeHtml(e.romaji || "")}</span>
                </div>
                <div class="expression-meaning">${escapeHtml(e.meaning || "")}</div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>

    <section class="detail-section">
      <h2 class="section-title">Family</h2>
      ${familyResolved.length === 0
        ? `<p class="empty-section">No family connections recorded.</p>`
        : `<ul class="family-list">
            ${familyResolved.map(f => `
              <li class="family-item" data-kanji="${escapeHtml(f.kanji)}" ${f.meaning ? "" : "data-missing=\"true\""}>
                <div class="family-char">${escapeHtml(f.kanji)}</div>
                <div class="family-meaning">
                  ${f.meaning
                    ? `<span>${escapeHtml(f.meaning)}${f.kana ? ` — ${escapeHtml(f.kana)}` : ""}</span>`
                    : `<span class="family-missing">(not yet in database)</span>`}
                  ${f.type ? `<span class="family-type">${escapeHtml(f.type)}</span>` : ""}
                </div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>
  `;

  // Wire up component clicks → search by that component.
  // On mobile, close the overlay and reveal the query so results are visible.
  detailContent.querySelectorAll(".component-item").forEach(el => {
    el.addEventListener("click", () => {
      const q = el.dataset.search;
      searchInput.value = q;
      closeDetail();
      openSearchBar();
      runSearch(q);
    });
  });

  // Wire up family clicks → navigate to that kanji (if exists).
  // selectKanji re-renders the detail and scrolls the overlay back to top.
  detailContent.querySelectorAll(".family-item").forEach(el => {
    if (el.dataset.missing === "true") return;
    el.addEventListener("click", () => {
      selectKanji(el.dataset.kanji);
    });
  });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------- Wire up ----------

async function runSearch(query) {
  const entries = await search(query);
  renderResults(entries);
}

let searchTimer;
searchInput.addEventListener("input", e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => runSearch(e.target.value.trim()), 80);
});

// Mobile: toggle the search field open/closed
searchToggle.addEventListener("click", () => {
  if (siteHeader.classList.contains("search-open")) {
    collapseSearchBar();
  } else {
    openSearchBar();
    searchInput.focus();
  }
});

// Auto-collapse the search field when it loses focus while empty
searchInput.addEventListener("blur", () => {
  if (!searchInput.value.trim()) collapseSearchBar();
});

// Close the detail overlay
detailClose.addEventListener("click", closeDetail);

// Escape: close the overlay first, otherwise collapse the search field
document.addEventListener("keydown", e => {
  if (e.key !== "Escape") return;
  if (detailPane.classList.contains("is-open")) {
    closeDetail();
  } else if (siteHeader.classList.contains("search-open")) {
    collapseSearchBar();
    searchInput.blur();
  }
});

// ---------- Init ----------

(async () => {
  try {
    await seedIfNeeded();
    await runSearch("");
  } catch (err) {
    console.error(err);
    searchMeta.textContent = "Error loading data — see console.";
  }
})();
