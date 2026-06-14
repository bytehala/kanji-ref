# Kanji Reference

A personal kanji study app. Source of truth is `kanji.json`; on first load, the app seeds an IndexedDB (via Dexie) and uses it for search. Runs entirely client-side — no backend, no build step.

## Schema

```json
{
  "kanji": "string (single character)",
  "meaning": "string (English gloss)",
  "kana": "string (primary kana reading)",
  "romaji": "string (Hepburn romanization)",
  "components": [
    { "component": "string", "meaning": "string" }
  ],
  "expressions": [
    {
      "expression": "string",
      "kana": "string (full reading — for search)",
      "romaji": "string (full reading — for search)",
      "meaning": "string",
      "breakdown": [
        { "text": "string (character(s))", "reading": "string (kana shown above; omit for kana segments)" }
      ]
    }
  ],
  "family": [
    { "kanji": "string (single character — references another entry)", "type": "string (free-text, e.g. 'opposite', 'cardinal direction')" }
  ]
}
```

### Notes

- **Components** can be any character — radical, partial element, or full kanji. Unofficial elements are labeled `(unofficial) <description>`.
- **Expressions** keep the full reading in `kana`/`romaji` for search; the `breakdown` array drives display. It splits the expression into segments, each with the literal `text` and an optional `reading`. Segments **with** a `reading` render as furigana over just that text; segments **without** one (okurigana) render plain at the baseline. Each segment-with-reading is a **single character** — HTML `<ruby>` aligns one `<rt>` per base char, so a multi-char base would smear the kana across glyphs (the 一人/ひとり problem: と could land over 一 or 人). Split jukujikun per kanji with a conventional reading apportionment: `一人` → `[{ "text": "一", "reading": "ひと" }, { "text": "人", "reading": "り" }]`, `今日` → `[{ "text": "今", "reading": "きょ" }, { "text": "日", "reading": "う" }]`, `召し上がる` → `[{ "text": "召", "reading": "め" }, { "text": "し" }, { "text": "上", "reading": "あ" }, { "text": "がる" }]`. The concatenated `text` must equal `expression`, and the concatenated readings must equal `kana` (`npm test` enforces both, plus the single-char rule).
- **Family** entries reference other kanji by their character. The app resolves the meaning at display time from the linked entry. If a referenced entry doesn't exist yet, the family member is shown with a `(not yet in database)` placeholder.

## Searchable fields

Every field is searched, including nested arrays:

- `kanji`, `meaning`, `kana`, `romaji`
- `components[].component`, `components[].meaning`
- `expressions[].expression`, `expressions[].kana`, `expressions[].romaji`, `expressions[].meaning`
- `family[].kanji`, `family[].type`

Searching `月` returns every kanji containing the moon component. Searching `moon` does the same via the gloss. Searching `opposite` returns all kanji that have an opposite recorded.

## Running locally

You need a local web server (browsers block `fetch` of local files from `file://`):

```sh
# Python
python3 -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → Settings → Pages → Source: deploy from branch (e.g. `main` / root).
3. Site goes live at `https://<username>.github.io/<repo>/`.

No build step needed — Dexie is loaded from CDN, everything else is static.

## Updating data

Edit `kanji.json` and bump `DATA_VERSION` in `app.js` (top of file). On next page load, the app clears the local DB and re-seeds from the updated JSON.

After editing, run the data tests — they catch the silent ways the data can drift:

```sh
npm test
```

This checks (in `test/data.test.mjs`, no dependencies — just Node's built-in runner) that every expression's `breakdown` still reconstructs both its `expression` and its `kana`, and that every `romaji` matches its `kana`. A mismatch would otherwise render furigana or search results wrongly without throwing.

## File layout

```
.
├── index.html             # Page structure
├── styles.css             # Editorial paper-and-ink styling
├── app.js                 # Dexie setup, search, render
├── kanji.json             # Source of truth
├── package.json           # npm test script (no runtime deps)
├── test/data.test.mjs     # Data integrity tests
└── README.md
```

## Examples

### 眠 — sleep

```json
{
  "kanji": "眠",
  "meaning": "sleep, drowsy",
  "kana": "ねむ",
  "romaji": "nemu",
  "components": [
    { "component": "目", "meaning": "eye" },
    { "component": "民", "meaning": "people (phonetic, gives ねむ reading)" }
  ],
  "expressions": [
    { "expression": "眠い", "kana": "ねむい", "romaji": "nemui", "meaning": "sleepy",
      "breakdown": [{ "text": "眠", "reading": "ねむ" }, { "text": "い" }] },
    { "expression": "眠る", "kana": "ねむる", "romaji": "nemuru", "meaning": "to sleep",
      "breakdown": [{ "text": "眠", "reading": "ねむ" }, { "text": "る" }] },
    { "expression": "睡眠", "kana": "すいみん", "romaji": "suimin", "meaning": "sleep (noun)",
      "breakdown": [{ "text": "睡", "reading": "すい" }, { "text": "眠", "reading": "みん" }] }
  ],
  "family": [
    { "kanji": "寝", "type": "related" }
  ]
}
```

### 北 — north (with family)

```json
{
  "kanji": "北",
  "meaning": "north",
  "kana": "きた",
  "romaji": "kita",
  "components": [
    { "component": "北", "meaning": "(unofficial) two people back-to-back" }
  ],
  "expressions": [
    { "expression": "北", "kana": "きた", "romaji": "kita", "meaning": "north" },
    { "expression": "北海道", "kana": "ほっかいどう", "romaji": "hokkaidou", "meaning": "Hokkaido" }
  ],
  "family": [
    { "kanji": "南", "type": "cardinal direction" },
    { "kanji": "東", "type": "cardinal direction" },
    { "kanji": "西", "type": "cardinal direction" }
  ]
}
```
