# kanji-ref — conventions

## Component meanings (kanji.json)

Each `components[].meaning` follows the canonical short form:

```
Kangxi radical N — name
```

For non-radical pieces, drop the radical prefix and write the name only,
preceded by `(unofficial)`:

```
(unofficial) <brief name>
```

### Keep parentheticals only when they carry real information

- **Variant-form names** — `Kangxi radical 85 (sanzui) — water`,
  `Kangxi radical 113 (shimesu-hen) — altar, spirit`
- **"Variant of X" notes** — `Kangxi radical 125 (variant of 老) — old`,
  `(unofficial) advancing foot (variant of 牛)`
- **Phonetic role** — `<name> (phonetic, gives <reading>)` or just `<name> (phonetic)`

### Drop everything else

- Pictogram/layout asides: ❌ *"(three peaks)"*, *"(the box)"*, *"(stroke on top)"*,
  *"(the body of the kanji)"*
- The phrase ❌ *"The kanji IS this radical (...)"*
- Any description of *where* a piece sits in the kanji

### Examples

| ✅ | ❌ |
|---|---|
| `Kangxi radical 1 — one` | `Kangxi radical 1 — one. The kanji IS this radical (a single horizontal stroke).` |
| `Kangxi radical 47 — river` | `Kangxi radical 47 — river. The kanji IS this radical (three flowing lines of water).` |
| `Kangxi radical 31 — enclosure` | `Kangxi radical 31 — enclosure (the outer box)` |
| `Kangxi radical 85 (sanzui) — water` | `Kangxi radical 85 (water variant) — sanzui, the three-stroke water radical on the left` |
| `(unofficial) advancing foot (variant of 牛)` | `(unofficial) tip / advancing foot — variant of 牛, the upper part of 先` |

## Data invariants

`kanji.json` is checked by `npm test` for three drift modes:

1. Every expression has a non-empty `breakdown`; its `text` segments concatenate
   to the `expression` and its `reading` segments (falling back to `text` for
   kana-only segments) concatenate to the `kana`.
2. Every entry-level `romaji` matches the wāpuro romanization of its `kana`
   (うう → `uu`, おう → `ou`, sokuon doubles the next consonant).
3. Same check on every expression's `kana`/`romaji`.

Run `npm test` after any `kanji.json` edit. When adding kana the romanizer
table in `test/data.test.mjs` doesn't cover yet (e.g. new katakana, edge cases
like `n'` before a vowel), extend the table — don't relax the test.

Bump `DATA_VERSION` in `app.js` whenever the *content* (not just shape) of
`kanji.json` changes, so cached IndexedDB seeds get cleared on next load.
