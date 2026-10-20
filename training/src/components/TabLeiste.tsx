import { Icon } from "./Icon";
import { navigiere } from "../router";

const TABS = [
  { pfad: "/training", label: "Training", icon: "hantel", gehoert: ["/training", "/einheit", "/handball"] },
  { pfad: "/verlauf", label: "Verlauf", icon: "verlauf", gehoert: ["/verlauf"] },
  { pfad: "/statistik", label: "Statistik", icon: "statistik", gehoert: ["/statistik"] },
  { pfad: "/bibliothek", label: "Übungen", icon: "liste", gehoert: ["/bibliothek", "/vorlage", "/daten"] },
];

export function TabLeiste({ pfad }: { pfad: string }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-karte/95 backdrop-blur border-t border-linie pb-safe" aria-label="Hauptnavigation">
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {TABS.map(t => {
          const aktiv = t.gehoert.some(g => pfad.startsWith(g));
          return (
            <button key={t.pfad} type="button" onClick={() => navigiere(t.pfad)} aria-current={aktiv ? "page" : undefined}
              className={`h-16 flex flex-col items-center justify-center gap-0.5 text-xs font-semibold ${aktiv ? "text-akzent" : "text-muted"}`}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
