# kanji-ref — conventions

## Component schema (kanji.json)

Each item in `components[]` has:

- `component` — the literal piece (radical, sub-radical, partial element, or unofficial)
- `meaning` — short English name only (no radical prefix, no pictogram description)
- `kangxi` — the Kangxi radical number (1–214), **only when the piece is one of the 214 radicals**

The app renders the kangxi number as a muted superscript next to the name
(`mouth (30)`). The user doesn't need to memorize the index — knowing the
piece *is* a Kangxi radical is what's useful.

```json
{ "component": "口", "meaning": "mouth", "kangxi": 30 }
{ "component": "囗", "meaning": "enclosure", "kangxi": 31 }
{ "component": "⺍", "meaning": "(unofficial) hands stretching out" }
```

### Keep these parentheticals in `meaning` (they carry real info)

- **Variant-form name** — `water (sanzui)`, `altar, spirit (shimesu-hen)`
- **"Variant of X" note** — `old (variant of 老)`, `(unofficial) advancing foot (variant of 牛)`
- **Phonetic role** — `<name> (phonetic, gives <reading>)` or just `<name> (phonetic)`

### Drop everything else

- Pictogram/layout asides — *"(three peaks)"*, *"(the box)"*, *"(stroke on top)"*,
  *"(the body of the kanji)"*
- The phrase *"The kanji IS this radical (...)"*
- Any description of *where* a piece sits in the kanji
- The literal "Kangxi radical N —" prefix — the `kangxi` field handles it

### Decompose verbosely — include both the bigger groupings and their sub-pieces

When a kanji decomposes into a larger piece that *itself* breaks down further,
list **every** distinct component the learner might recognize. Don't stop at the
first level. Example for 投 (throw):

- ✅ 扌 hand (64), 殳 weapon (79), 几 table (16), 又 hand-right (29)

Even though 殳 contains 几+又, list all four — it helps the learner build
the pictogram. Same principle anywhere a piece decomposes further: 員 → 口,
貝, 目, 八 (since 貝 itself = 目+八). Stop only at indivisible strokes or when
the next level isn't a recognizable component.

### Examples

| ✅ | ❌ |
|---|---|
| `{"component":"口", "meaning":"mouth", "kangxi":30}` | `{"component":"口", "meaning":"Kangxi radical 30 — mouth"}` |
| `{"component":"氵", "meaning":"water (sanzui)", "kangxi":85}` | `{"component":"氵", "meaning":"Kangxi radical 85 (water variant) — sanzui"}` |
| `{"component":"⺧", "meaning":"(unofficial) advancing foot (variant of 牛)"}` | `{"component":"⺧", "meaning":"(unofficial) tip / advancing foot — variant of 牛, the upper part of 先"}` |

## No redundant single-kanji expressions

The hero already shows the kanji, its kana, and its meaning. Don't repeat
it as its own "expression" — list **only compound expressions** that USE
the kanji.

- ❌ In the 一 entry: an `一 / いち / one` expression
- ❌ In the 月 entry: a `月 / つき / moon` expression
- ✅ In the 一 entry: 一月 (ichigatsu), 一人 (hitori)
- ✅ In the 月 entry: 今月 (kongetsu), 月曜日 (getsuyoubi)

This includes entries whose `expressions` would shrink to just one or zero
items after the cull — that's fine, leave it.

`npm test` enforces this: no `expressions[].expression` may equal the
parent entry's `kanji`.

## Breakdown segments are per-kanji

Each breakdown segment that has a `reading` must have **single-character** text.
HTML `<ruby>` aligns one `<rt>` per base character, so a multi-char base with a
single reading would smear the kana across glyphs and let the reader guess which
kana belongs to which kanji (the 一人 / ひとり problem — does と go over 一 or
人?). Split jukujikun per kanji even when the split is arbitrary:

- ✅ `一人` → `[{"text":"一","reading":"ひと"}, {"text":"人","reading":"り"}]`
- ✅ `今日` → `[{"text":"今","reading":"きょ"}, {"text":"日","reading":"う"}]`
- ✅ `田舎` → `[{"text":"田","reading":"いな"}, {"text":"舎","reading":"か"}]`
- ❌ `[{"text":"一人","reading":"ひとり"}]` — single rt over multi-char base

Okurigana segments (no `reading`) may stay multi-char (`まれる`, `がる`).

## Data invariants

`kanji.json` is checked by `npm test` for these drift modes:

1. Every expression has a non-empty `breakdown`; its `text` segments concatenate
   to the `expression` and its `reading` segments (falling back to `text` for
   kana-only segments) concatenate to the `kana`.
2. Each segment with a `reading` has single-character text (the per-kanji rule
   above).
3. Every entry-level `romaji` matches the wāpuro romanization of its `kana`
   (うう → `uu`, おう → `ou`, sokuon doubles the next consonant).
4. Same check on every expression's `kana`/`romaji`.

Run `npm test` after any `kanji.json` edit. When adding kana the romanizer
table in `test/data.test.mjs` doesn't cover yet (e.g. new katakana, edge cases
like `n'` before a vowel), extend the table — don't relax the test.

Bump `DATA_VERSION` in `app.js` whenever the *content* (not just shape) of
`kanji.json` changes, so cached IndexedDB seeds get cleared on next load.
