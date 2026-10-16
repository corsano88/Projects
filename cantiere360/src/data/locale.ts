import type { Collezioni, DatiNuovi, Modifica, NomeCollezione, Store } from "./store";
import { nuovoId } from "./store";

/** Spazio di memoria minimo usato dallo store locale (localStorage nel browser, una mappa nei test). */
export interface Memoria {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function memoriaInRam(): Memoria {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

/** Store per la modalità demo: i dati restano nel browser. */
export class StoreLocale implements Store {
  readonly modalita = "demo" as const;
  private ascoltatori = new Map<NomeCollezione, Set<(docs: unknown[]) => void>>();

  constructor(
    private memoria: Memoria,
    private prefisso = "c360",
  ) {}

  private leggi<K extends NomeCollezione>(col: K): Collezioni[K][] {
    const raw = this.memoria.getItem(`${this.prefisso}:${col}`);
    return raw ? (JSON.parse(raw) as Collezioni[K][]) : [];
  }

  private scrivi<K extends NomeCollezione>(col: K, docs: Collezioni[K][]) {
    try {
      this.memoria.setItem(`${this.prefisso}:${col}`, JSON.stringify(docs));
    } catch {
      throw new Error("Memoria del browser piena. In modalità demo le foto occupano molto spazio: collega Firebase.");
    }
    this.ascoltatori.get(col)?.forEach((cb) => cb(docs));
  }

  ascolta<K extends NomeCollezione>(col: K, cb: (docs: Collezioni[K][]) => void): () => void {
    const set = this.ascoltatori.get(col) ?? new Set();
    this.ascoltatori.set(col, set);
    const f = cb as (docs: unknown[]) => void;
    set.add(f);
    cb(this.leggi(col));
    return () => set.delete(f);
  }

  async crea<K extends NomeCollezione>(col: K, dati: DatiNuovi<K>, utente: string, id?: string) {
    const ora = new Date().toISOString();
    const doc = { ...dati, id: id ?? nuovoId(), createdAt: ora, updatedAt: ora, createdBy: utente } as Collezioni[K];
    this.scrivi(col, [...this.leggi(col), doc]);
    return doc;
  }

  async aggiorna<K extends NomeCollezione>(col: K, id: string, modifica: Modifica<K>) {
    const docs = this.leggi(col);
    const i = docs.findIndex((d) => d.id === id);
    if (i < 0) throw new Error(`Documento non trovato: ${col}/${id}`);
    docs[i] = { ...docs[i], ...modifica, updatedAt: new Date().toISOString() };
    this.scrivi(col, docs);
  }

  async elimina(col: NomeCollezione, id: string) {
    this.scrivi(
      col,
      this.leggi(col).filter((d) => d.id !== id),
    );
  }

  async prossimoNumero(chiave: string) {
    const k = `${this.prefisso}:contatore:${chiave}`;
    const n = Number(this.memoria.getItem(k) ?? "0") + 1;
    this.memoria.setItem(k, String(n));
    return n;
  }

  async caricaImmagine(_percorso: string, dataUrl: string) {
    return dataUrl;
  }
}
