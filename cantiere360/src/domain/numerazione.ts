/** Chiave del contatore per una serie di documenti in un anno, es. "ddt-2026". */
export function chiaveSerie(serie: string, data: string): string {
  return `${serie}-${data.slice(0, 4)}`;
}

/** Formatta il numero di documento, es. 2026 e 12 → "2026/0012". */
export function formattaNumero(data: string, progressivo: number): string {
  return `${data.slice(0, 4)}/${String(progressivo).padStart(4, "0")}`;
}

/** Codice progetto leggibile, es. "P-2026-007". */
export function codiceProgetto(data: string, progressivo: number): string {
  return `P-${data.slice(0, 4)}-${String(progressivo).padStart(3, "0")}`;
}
