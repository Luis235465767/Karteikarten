import { lazy, Suspense } from "react";
import { passt, useRoute } from "./router";
import { TabLeiste } from "./components/TabLeiste";
import { TrainingStart } from "./pages/TrainingStart";
import { EinheitEditor } from "./pages/EinheitEditor";
import { HandballFormular } from "./pages/HandballFormular";
import { Verlauf } from "./pages/Verlauf";
import { Bibliothek } from "./pages/Bibliothek";
import { VorlageEditor } from "./pages/VorlageEditor";

// Die Statistik (mit Recharts) wird erst beim Öffnen geladen, damit der Start schnell bleibt.
const Statistik = lazy(() => import("./pages/Statistik"));

function Seite({ pfad }: { pfad: string }) {
  let p;
  if ((p = passt("/einheit/:id", pfad))) return <EinheitEditor key={p.id} id={p.id} />;
  if ((p = passt("/handball/:id", pfad))) return <HandballFormular key={p.id} id={p.id} />;
  if ((p = passt("/vorlage/:id", pfad))) return <VorlageEditor key={p.id} id={p.id} />;
  if (pfad === "/verlauf") return <Verlauf />;
  if (pfad === "/statistik") return <Suspense fallback={null}><Statistik /></Suspense>;
  if (pfad === "/bibliothek") return <Bibliothek tab="uebungen" />;
  if (pfad === "/bibliothek/vorlagen") return <Bibliothek tab="vorlagen" />;
  if (pfad === "/bibliothek/daten") return <Bibliothek tab="daten" />;
  return <TrainingStart />;
}

export default function App() {
  const pfad = useRoute();
  return (
    <div className="min-h-dvh pb-[calc(4rem+env(safe-area-inset-bottom)+1rem)]">
      <Seite pfad={pfad} />
      <TabLeiste pfad={pfad} />
    </div>
  );
}
