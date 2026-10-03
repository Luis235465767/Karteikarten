// Vergleicht die neue Logik mit dem Originalcode der claude.ai-Version (wörtlich übernommen, nur ohne DOM)
// über viele zufällige Lernverläufe. So ist sichergestellt, dass sich der Algorithmus nicht verändert hat.
import { test } from "node:test";
import assert from "node:assert/strict";
import { baueStapel, neueRunde, beantworte, statistik } from "../js/stapel.js";
import { TAG } from "../js/srs.js";

// --- Original (physiologie-lernkarten.html), Indizes statt IDs ---
const DAY = 864e5, STEPS = [0, 1, 3, 7, 14, 30];
function origBuild(p, srs, mode, now) {
  if (mode === "all") return p.slice();
  const rev = p.filter(i => srs[i] && srs[i].d <= now).sort((a, b) => srs[a].d - srs[b].d);
  const neu = p.filter(i => !srs[i]);
  return rev.concat(neu);
}
function origMark(deck, pos, srs, ok, now) {
  const i = deck[pos];
  if (ok) { const b = Math.min((srs[i] ? srs[i].b : 0) + 1, 5); srs[i] = { b, d: now + STEPS[b] * DAY }; }
  else { srs[i] = { b: 0, d: now }; deck.splice(Math.min(pos + 5, deck.length), 0, i); }
  return pos + 1;
}
// --- Ende Original ---

function zufallsGenerator(seed) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const ohneU = karten => Object.fromEntries(Object.entries(karten).map(([k, { b, d }]) => [k, { b, d }]));

test("neue Logik verhält sich in 300 zufälligen Lernverläufen exakt wie das Original", () => {
  for (let lauf = 0; lauf < 300; lauf++) {
    const zufall = zufallsGenerator(lauf + 1);
    const n = 3 + Math.floor(zufall() * 25);
    const idx = Array.from({ length: n }, (_, i) => i);
    const id = i => `X-${String(i).padStart(3, "0")}`;
    let now = Date.parse("2026-10-01T08:00:00Z");
    const alt = {};
    let neu = {};
    for (let tag = 0; tag < 12; tag++) {
      const modus = zufall() < 0.8 ? "due" : "all";
      const altDeck = origBuild(idx, alt, modus, now);
      let runde = neueRunde({ stapel: baueStapel({ pool: idx.map(id), karten: neu, modus, now }), modus, thema: "all", now });
      assert.deepEqual(runde.deck, altDeck.map(id), `Lauf ${lauf}, Tag ${tag}: Stapel`);
      let pos = 0, schritte = 0;
      while (pos < altDeck.length && schritte++ < 400) {
        const ok = zufall() < 0.7;
        now += 1000;
        pos = origMark(altDeck, pos, alt, ok, now);
        ({ runde, karten: neu } = beantworte({ runde, karten: neu, gewusst: ok, now }));
        assert.deepEqual(runde.deck, altDeck.map(id));
        assert.equal(runde.pos, pos);
      }
      const altAlsIds = Object.fromEntries(Object.entries(alt).map(([i, v]) => [id(+i), v]));
      assert.deepEqual(ohneU(neu), altAlsIds, `Lauf ${lauf}, Tag ${tag}: Lernstand`);
      const s = statistik(idx.map(id), neu, now);
      assert.equal(s.faellig, idx.filter(i => alt[i] && alt[i].d <= now).length);
      assert.equal(s.gelernt, idx.filter(i => alt[i] && alt[i].b > 0).length);
      now += Math.floor(zufall() * 4) * TAG;
    }
  }
});
