// Kanji Reference — IndexedDB-backed search over a JSON seed.

const DATA_VERSION = 8; // bump when kanji.json shape changes; clears + reseeds
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

  // Version-tagged URL so a DATA_VERSION bump always fetches fresh data
  // rather than a stale, heuristically-cached copy.
  const response = await fetch(`./kanji.json?v=${DATA_VERSION}`);
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
const detailBackdrop = document.getElementById("detail-backdrop");

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
      <div class="result-glyph">
        <span class="result-reading">${escapeHtml(entry.kana || "")}</span>
        <span class="result-kanji">${escapeHtml(entry.kanji)}</span>
      </div>
      <div class="result-meaning">${escapeHtml(entry.meaning || "")}</div>
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
  // After the new hero lays out, re-measure so a subsequent nav click
  // (Components / Family) lands the section below it, not under it.
  requestAnimationFrame(syncScrollPadding);
}

// ---------- Mobile detail overlay ----------

// On mobile (≤900px), the detail pane is a full-screen overlay above the list.
// The `is-open` class is a no-op on desktop, where the pane is a static column.
function openDetail() {
  detailPane.classList.add("is-open");
  document.body.classList.add("detail-open");
  // detailPane is position:fixed on mobile so its own scrollTop is a no-op;
  // detailContent is the scrollable container. Reset both so navigating from
  // a family link lands the user at the top of the new entry.
  detailPane.scrollTop = 0;
  detailContent.scrollTop = 0;
}

function closeDetail() {
  detailPane.classList.remove("is-open");
  document.body.classList.remove("detail-open");
}

// scrollIntoView on a section needs to clear two possible sticky obstacles:
// - On desktop, the page-level .site-header (sticky at viewport top)
// - On mobile, the in-sheet .detail-header (sticky inside .detail-content)
// Each scroll container gets a scroll-padding-top equal to its sticky
// element's measured height + a small breathing-room buffer, so a nav
// click puts the section's title visibly below the sticky strip rather
// than under it. Recomputed on resize because both heights change with
// viewport width (font sizes scale per breakpoint).
function syncScrollPadding() {
  const buffer = 16; // px of breathing room below the sticky element

  // Desktop: the document scrolls; .site-header is the sticky obstacle.
  const siteHeaderH = siteHeader?.getBoundingClientRect().height || 0;
  document.documentElement.style.scrollPaddingTop = `${siteHeaderH + buffer}px`;

  // Mobile: .detail-content scrolls; the in-sheet .detail-header is sticky.
  const detailHeaderEl = detailContent.querySelector(".detail-header");
  if (detailHeaderEl) {
    const h = detailHeaderEl.getBoundingClientRect().height;
    detailContent.style.scrollPaddingTop = `${h + buffer}px`;
  } else {
    detailContent.style.scrollPaddingTop = "";
  }
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

// ---------- Reading helpers ----------

// Build ruby HTML for an expression. Each `breakdown` segment with a reading
// becomes one base/rt pair inside a `<ruby>` element; consecutive segments
// share one ruby so per-kanji bases sit alongside per-kanji rt's (the
// `<ruby>A<rt>a</rt>B<rt>b</rt></ruby>` form — the browser aligns each rt
// over its own base). Kana-only segments (okurigana) close any open ruby
// and render plain. `<rp>` parens are emitted for non-ruby fallback. Falls
// back to a single base/rt pair when no breakdown is present.
function renderExpressionRuby(e) {
  const segments = Array.isArray(e.breakdown) && e.breakdown.length
    ? e.breakdown
    : [{ text: e.expression, reading: e.kana || "" }];

  let html = "";
  let openRuby = false;
  for (const s of segments) {
    if (s.reading) {
      if (!openRuby) { html += "<ruby>"; openRuby = true; }
      html += `${escapeHtml(s.text)}<rp>(</rp><rt>${escapeHtml(s.reading)}</rt><rp>)</rp>`;
    } else {
      if (openRuby) { html += "</ruby>"; openRuby = false; }
      html += escapeHtml(s.text);
    }
  }
  if (openRuby) html += "</ruby>";
  return html;
}

function renderDetail(entry, familyResolved) {
  detailPlaceholder.hidden = true;
  detailContent.hidden = false;

  const components = entry.components || [];
  const expressions = entry.expressions || [];

  detailContent.innerHTML = `
    <header class="detail-header">
      <div class="detail-glyph">
        <ruby class="detail-kanji">${escapeHtml(entry.kanji)}<rp>(</rp><rt>${escapeHtml(entry.kana || "")}</rt><rp>)</rp></ruby>
        <div class="detail-meaning">${escapeHtml(entry.meaning || "")}</div>
      </div>
      <nav class="detail-nav" aria-label="Jump to section">
        <button type="button" class="detail-nav-btn is-active" data-target="expressions" aria-label="Jump to expressions" title="Expressions">語</button>
        <button type="button" class="detail-nav-btn" data-target="components" aria-label="Jump to components" title="Components">部</button>
        <button type="button" class="detail-nav-btn" data-target="family" aria-label="Jump to family" title="Family">族</button>
      </nav>
    </header>

    <section class="detail-section" data-section="expressions">
      <h2 class="section-title"><span class="section-title-jp">語</span>Expressions</h2>
      ${expressions.length === 0
        ? `<p class="empty-section">No expressions recorded.</p>`
        : `<ul class="expression-list">
            ${expressions.map(e => `
              <li class="expression-item">
                <div class="expression-text">${renderExpressionRuby(e)}</div>
                <div class="expression-meaning">${escapeHtml(e.meaning || "")}</div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>

    <section class="detail-section" data-section="components">
      <h2 class="section-title"><span class="section-title-jp">部</span>Components</h2>
      ${components.length === 0
        ? `<p class="empty-section">Atomic — no decomposable components.</p>`
        : `<ul class="component-list">
            ${components.map(c => `
              <li class="component-item" data-search="${escapeHtml(c.component)}">
                <div class="component-char">${escapeHtml(c.component)}</div>
                <div class="component-meaning">${escapeHtml(c.meaning || "")}${
                  Number.isInteger(c.kangxi)
                    ? ` <span class="component-kangxi">(${c.kangxi})</span>`
                    : ""
                }</div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>

    <section class="detail-section" data-section="family">
      <h2 class="section-title"><span class="section-title-jp">族</span>Family</h2>
      ${familyResolved.length === 0
        ? `<p class="empty-section">No family connections recorded.</p>`
        : `<ul class="family-list">
            ${familyResolved.map(f => `
              <li class="family-item" data-kanji="${escapeHtml(f.kanji)}" ${f.meaning ? "" : "data-missing=\"true\""}>
                ${f.kana
                  ? `<ruby class="family-char">${escapeHtml(f.kanji)}<rp>(</rp><rt>${escapeHtml(f.kana)}</rt><rp>)</rp></ruby>`
                  : `<span class="family-char">${escapeHtml(f.kanji)}</span>`}
                <div class="family-meaning">
                  ${f.meaning
                    ? `<span>${escapeHtml(f.meaning)}</span>`
                    : `<span class="family-missing">(not yet in database)</span>`}
                  ${f.type ? `<span class="family-type">${escapeHtml(f.type)}</span>` : ""}
                </div>
              </li>
            `).join("")}
          </ul>`
      }
    </section>
  `;

  // Wire up navigator clicks → smooth-scroll to the named section, parking
  // its title just below the sticky-header strip (so it doesn't disappear
  // under the hero). Native scrollIntoView ignored scroll-padding-top once
  // a sticky child sat inside the scroll container, so this computes the
  // landing scroll position manually: section.offsetTop − stickyHeight − a
  // breathing-room buffer. Falls back to scrollIntoView on desktop where
  // .detail-content isn't the scroll container.
  detailContent.querySelectorAll(".detail-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = detailContent.querySelector(`[data-section="${btn.dataset.target}"]`);
      if (target) {
        const onMobile = detailPane.classList.contains("is-open") &&
                          getComputedStyle(detailContent).overflowY === "auto";
        if (onMobile) {
          const containerRect = detailContent.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const headerH = detailContent.querySelector(".detail-header")?.getBoundingClientRect().height || 0;
          const offset = detailContent.scrollTop + (targetRect.top - containerRect.top) - headerH - 16;
          detailContent.scrollTo({ top: Math.max(0, offset), behavior: "smooth" });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      detailContent.querySelectorAll(".detail-nav-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

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

// Mobile: toggle the search field open/closed.
// Tapping search while the detail sheet is open dismisses the sheet first.
searchToggle.addEventListener("click", () => {
  if (detailPane.classList.contains("is-open")) {
    closeDetail();
    openSearchBar();
    searchInput.focus();
    return;
  }
  if (siteHeader.classList.contains("search-open")) {
    collapseSearchBar();
  } else {
    openSearchBar();
    searchInput.focus();
  }
});

// Tapping the dimmed area outside the sheet dismisses it
detailBackdrop.addEventListener("click", closeDetail);

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

// Resize listener: sticky-element heights track viewport width (different
// font sizes per breakpoint), so the scroll-padding has to follow.
window.addEventListener("resize", syncScrollPadding);

(async () => {
  try {
    await seedIfNeeded();
    await runSearch("");
    syncScrollPadding();
  } catch (err) {
    console.error(err);
    searchMeta.textContent = "Error loading data — see console.";
  }
})();
