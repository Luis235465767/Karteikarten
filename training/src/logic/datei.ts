// Datei herunterladen; auf dem Handy wenn möglich über das Teilen-Menü (z. B. „In Dateien sichern“).
export async function speichereDatei(name: string, inhalt: string, typ: string) {
  const blob = new Blob([inhalt], { type: typ });
  const datei = new File([blob], name, { type: typ });
  const mobil = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (mobil && navigator.canShare?.({ files: [datei] })) {
    try {
      await navigator.share({ files: [datei], title: name });
      return;
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export const zeitstempel = () => new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
