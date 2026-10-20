// Erzeugt realistische Beispieldaten der letzten 12 Wochen. Alle Einträge tragen beispiel: true.
import type { Backup, HandballEinheit, KraftEinheit, Uebung, Vorlage } from "../model/types";
import { heute, plusTage, wochenStart } from "../logic/datum";

type Daten = Pick<Backup, "uebungen" | "kraftEinheiten" | "vorlagen" | "handballEinheiten">;

/** Kleiner, reproduzierbarer Zufallsgenerator, damit die Beispieldaten immer gleich aussehen. */
function zufall(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function erzeugeBeispieldaten(bis = heute(), wochen = 12): Daten {
  const r = zufall(42);
  const u = (id: string, name: string, kategorie: string, notiz?: string): Uebung => ({ id: `bsp-${id}`, name, kategorie, notiz, beispiel: true });
  const uebungen = [
    u("bank", "Bankdrücken", "Brust"),
    u("knie", "Kniebeuge", "Beine", "Hantel hinten, bis parallel"),
    u("kreuz", "Kreuzheben", "Rücken"),
    u("ruder", "Rudern vorgebeugt", "Rücken"),
    u("schulter", "Schulterdrücken", "Schultern"),
    u("klimm", "Klimmzüge (Zusatzgewicht)", "Rücken"),
    u("ausfall", "Ausfallschritte", "Beine"),
    u("plank", "Crunches am Kabelzug", "Core"),
  ];
  const id = (n: string) => `bsp-${n}`;

  const vorlagen: Vorlage[] = [
    { id: "bsp-v-a", name: "Ganzkörper A", beispiel: true, uebungen: [
      { uebungId: id("knie"), zielSaetze: 3, zielWdh: 5 },
      { uebungId: id("bank"), zielSaetze: 3, zielWdh: 5 },
      { uebungId: id("ruder"), zielSaetze: 3, zielWdh: 8 },
    ] },
    { id: "bsp-v-b", name: "Ganzkörper B", beispiel: true, uebungen: [
      { uebungId: id("kreuz"), zielSaetze: 3, zielWdh: 5 },
      { uebungId: id("schulter"), zielSaetze: 3, zielWdh: 8 },
      { uebungId: id("klimm"), zielSaetze: 3, zielWdh: 6 },
      { uebungId: id("ausfall"), zielSaetze: 2, zielWdh: 10 },
    ] },
  ];

  // Startgewichte und wöchentliche Steigerung
  const start: Record<string, number> = { knie: 80, bank: 62.5, ruder: 55, kreuz: 100, schulter: 37.5, klimm: 0, ausfall: 20, plank: 25 };
  const plus: Record<string, number> = { knie: 2.5, bank: 1.25, ruder: 1.25, kreuz: 2.5, schulter: 0.6, klimm: 0.6, ausfall: 1, plank: 0.5 };
  const auf25 = (x: number) => Math.round(x / 1.25) * 1.25;

  const kraftEinheiten: KraftEinheit[] = [];
  const handballEinheiten: HandballEinheit[] = [];
  const ersteWoche = wochenStart(plusTage(bis, -7 * (wochen - 1)));

  for (let w = 0; w < wochen; w++) {
    const mo = plusTage(ersteWoche, 7 * w);
    // Kraft: Mo (A) und Do (B), gelegentlich ausgelassen
    const plan: [number, Vorlage][] = [[0, vorlagen[0]], [3, vorlagen[1]]];
    for (const [tag, v] of plan) {
      const datum = plusTage(mo, tag);
      if (datum > bis || r() < 0.1) continue;
      const eintraege = v.uebungen.map(x => {
        const name = x.uebungId.slice(4);
        const kg = auf25(start[name] + plus[name] * w + (r() < 0.2 ? -2.5 : 0));
        const saetze = Array.from({ length: x.zielSaetze ?? 3 }, (_, i) => ({
          wdh: Math.max(1, (x.zielWdh ?? 8) - (i === 2 && r() < 0.4 ? 1 : 0)),
          kg,
        }));
        return { uebungId: x.uebungId, saetze };
      });
      if (r() < 0.5) eintraege.push({ uebungId: id("plank"), saetze: [{ wdh: 12, kg: auf25(start.plank + plus.plank * w) }, { wdh: 12, kg: auf25(start.plank + plus.plank * w) }] });
      kraftEinheiten.push({ id: `bsp-k-${w}-${tag}`, datum, vorlageId: v.id, eintraege, beispiel: true });
    }
    // Handball: Di und Fr Training, Sa oder So Spiel
    const termine: [number, "Training" | "Spiel"][] = [[1, "Training"], [4, "Training"], [r() < 0.5 ? 5 : 6, "Spiel"]];
    for (const [tag, art] of termine) {
      const datum = plusTage(mo, tag);
      if (datum > bis || r() < 0.12) continue;
      const dauerMin = art === "Spiel" ? 60 + Math.round(r() * 3) * 5 : 75 + Math.round(r() * 3) * 15;
      const rpe = art === "Spiel" ? 7 + Math.round(r() * 2) : 4 + Math.round(r() * 3);
      handballEinheiten.push({ id: `bsp-h-${w}-${tag}`, datum, art, dauerMin, rpe, notiz: art === "Spiel" && r() < 0.3 ? "Auswärtsspiel" : undefined, beispiel: true });
    }
  }
  return { uebungen, vorlagen, kraftEinheiten, handballEinheiten };
}
