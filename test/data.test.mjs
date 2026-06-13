// Data integrity tests for kanji.json. Run with `npm test`.
//
// These guard against the two ways the data can silently drift:
//   1. A `breakdown` that no longer reconstructs its expression / kana.
//   2. A `romaji` that no longer matches its `kana`.
// Both feed the UI (breakdown → furigana display, kana/romaji → search),
// so a mismatch would render or search wrongly without ever erroring.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "..", "kanji.json"), "utf8"));

// ---------- Hiragana → Hepburn romaji (wāpuro style: う = "u", おう = "ou") ----------
// Long vowels stay literal (とうきょう → toukyou) and sokuon doubles the next
// consonant (ほっかいどう → hokkaidou), matching the convention used in the data.
const KANA_ROMAJI = {
  "きゃ": "kya", "きゅ": "kyu", "きょ": "kyo", "しゃ": "sha", "しゅ": "shu", "しょ": "sho",
  "ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho", "にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
  "ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo", "みゃ": "mya", "みゅ": "myu", "みょ": "myo",
  "りゃ": "rya", "りゅ": "ryu", "りょ": "ryo", "ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
  "じゃ": "ja", "じゅ": "ju", "じょ": "jo", "びゃ": "bya", "びゅ": "byu", "びょ": "byo",
  "ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",
  "あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
  "か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
  "が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
  "さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
  "ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
  "た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
  "だ": "da", "ぢ": "ji", "づ": "zu", "で": "de", "ど": "do",
  "な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
  "は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
  "ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
  "ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
  "ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
  "や": "ya", "ゆ": "yu", "よ": "yo",
  "ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
  "わ": "wa", "ゐ": "i", "ゑ": "e", "を": "o", "ん": "n",
};

function romanizeKana(kana) {
  if (!kana) return "";
  let out = "";
  let i = 0;
  while (i < kana.length) {
    const two = kana.slice(i, i + 2);
    if (KANA_ROMAJI[two]) { out += KANA_ROMAJI[two]; i += 2; continue; }
    const ch = kana[i];
    if (ch === "っ") {
      const rest = romanizeKana(kana.slice(i + 1));
      return out + (/^[a-z]/.test(rest) ? rest[0] : "") + rest;
    }
    out += KANA_ROMAJI[ch] ?? ch;
    i += 1;
  }
  return out;
}

// ---------- Helpers ----------
const everyExpression = (fn) => {
  for (const k of data) for (const e of k.expressions || []) fn(e, k);
};

// ---------- Shape ----------
test("each entry has the required top-level fields", () => {
  for (const k of data) {
    assert.equal(typeof k.kanji, "string", `entry missing kanji: ${JSON.stringify(k)}`);
    assert.equal([...k.kanji].length, 1, `${k.kanji}: kanji must be a single character`);
    for (const field of ["meaning", "kana", "romaji"]) {
      assert.ok(k[field], `${k.kanji}: missing ${field}`);
    }
    assert.ok(Array.isArray(k.expressions), `${k.kanji}: expressions must be an array`);
  }
});

test("each expression has a non-empty breakdown and no stale okurigana", () => {
  everyExpression((e, k) => {
    assert.ok(Array.isArray(e.breakdown) && e.breakdown.length > 0,
      `${k.kanji} / ${e.expression}: missing or empty breakdown`);
    assert.ok(!("okurigana" in e),
      `${k.kanji} / ${e.expression}: stale "okurigana" field — superseded by breakdown`);
    for (const s of e.breakdown) {
      assert.ok(s.text, `${k.kanji} / ${e.expression}: breakdown segment missing text`);
    }
  });
});

// ---------- Breakdown reconstructs the expression ----------
test("breakdown text concatenates to the expression", () => {
  everyExpression((e, k) => {
    const text = e.breakdown.map((s) => s.text).join("");
    assert.equal(text, e.expression,
      `${k.kanji} / ${e.expression}: breakdown text "${text}" ≠ expression`);
  });
});

test("breakdown readings concatenate to the kana", () => {
  everyExpression((e, k) => {
    const reading = e.breakdown.map((s) => s.reading ?? s.text).join("");
    assert.equal(reading, e.kana,
      `${k.kanji} / ${e.expression}: breakdown reading "${reading}" ≠ kana "${e.kana}"`);
  });
});

// ---------- kana / romaji don't drift ----------
test("entry romaji matches its kana", () => {
  for (const k of data) {
    assert.equal(romanizeKana(k.kana), k.romaji,
      `${k.kanji}: kana ${k.kana} romanizes to "${romanizeKana(k.kana)}" but romaji is "${k.romaji}"`);
  }
});

test("expression romaji matches its kana", () => {
  everyExpression((e, k) => {
    assert.equal(romanizeKana(e.kana), e.romaji,
      `${k.kanji} / ${e.expression}: kana ${e.kana} romanizes to "${romanizeKana(e.kana)}" but romaji is "${e.romaji}"`);
  });
});
