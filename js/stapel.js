// Stapel bauen, Runde fortsetzen, Statistik. Reine Funktionen ohne Browser-Abhängigkeiten.
import { bewerte, istNeu, istFaellig, istGelernt, istGefestigt, TAG, WIEDERHOLEN_NACH } from "./srs.js";

export function mische(liste, zufall = Math.random) {
  const a = liste.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** IDs der Karten im gewählten Thema ("all" = alle), in Lernzettel-Reihenfolge. */
export const kartenpool = (karten, thema) => karten.filter(k => thema === "all" || k.thema === thema).map(k => k.id);

/**
 * Stapel für eine neue Runde.
 * Modus "all": alle Karten des Pools. Modus "due": erst fällige Wiederholungen (älteste Fälligkeit zuerst),
 * dann neue Karten in Lernzettel-Reihenfolge. „gemischt“ mischt die beiden Gruppen jeweils für sich.
 */
export function baueStapel({ pool, karten, modus, gemischt = false, now, zufall = Math.random }) {
  if (modus === "all") return gemischt ? mische(pool, zufall) : pool.slice();
  let wiederholen = pool.filter(id => istFaellig(karten[id], now)).sort((a, b) => karten[a].d - karten[b].d);
  let neu = pool.filter(id => istNeu(karten[id]));
  if (gemischt) { wiederholen = mische(wiederholen, zufall); neu = mische(neu, zufall); }
  return wiederholen.concat(neu);
}

export const tagesKennung = now => new Date(now).toDateString();

export function neueRunde({ stapel, modus, thema, now }) {
  return { deck: stapel, pos: 0, mode: modus, sys: thema, t: now, day: tagesKennung(now) };
}

/** Eine angefangene Runde wird nur am selben Tag fortgesetzt. Unbekannte IDs (gelöschte Karten) fallen heraus. */
export function fortsetzbareRunde(runde, now, gueltigeIds) {
  if (!runde || !Array.isArray(runde.deck) || runde.day !== tagesKennung(now)) return null;
  const deck = runde.deck.filter(id => gueltigeIds.has(id));
  const pos = Math.min(runde.pos | 0, deck.length);
  if (pos >= deck.length) return null;
  return { ...runde, deck, pos };
}

/** Bewertet die aktuelle Karte der Runde. Gibt neue Runde und neuen Kartenstand zurück, ändert nichts in place. */
export function beantworte({ runde, karten, gewusst, now }) {
  if (runde.pos >= runde.deck.length) return { runde, karten };
  const id = runde.deck[runde.pos];
  const deck = runde.deck.slice();
  if (!gewusst) deck.splice(Math.min(runde.pos + 1 + WIEDERHOLEN_NACH, deck.length), 0, id);
  return {
    runde: { ...runde, deck, pos: runde.pos + 1, t: now },
    karten: { ...karten, [id]: bewerte(karten[id], gewusst, now) },
  };
}

export function statistik(pool, karten, now) {
  let faellig = 0, neu = 0, gelernt = 0, gefestigt = 0;
  for (const id of pool) {
    const e = karten[id];
    if (istNeu(e)) neu++;
    if (istFaellig(e, now)) faellig++;
    if (istGelernt(e)) gelernt++;
    if (istGefestigt(e)) gefestigt++;
  }
  return { gesamt: pool.length, faellig, neu, gelernt, gefestigt, anteilGelernt: pool.length ? gelernt / pool.length : 0 };
}

/** Frühester zukünftiger Fälligkeitszeitpunkt im Pool, oder null. */
export function naechsteFaelligkeit(pool, karten, now) {
  let min = null;
  for (const id of pool) { const e = karten[id]; if (e && e.d > now && (min === null || e.d < min)) min = e.d; }
  return min;
}

export function formatiereAbstand(ms) {
  const tage = Math.max(1, Math.round(ms / TAG));
  return tage === 1 ? "morgen" : `in ${tage} Tagen`;
}
