import type {
  Allocazione,
  Base,
  CampoCustom,
  Cantiere,
  Cliente,
  Ddt,
  EventoAudit,
  Fir,
  Progetto,
  Risorsa,
  Trattativa,
  Utente,
  VoceGiornale,
} from "../domain/types";

/** Tutte le collezioni, con il tipo dei loro documenti. */
export interface Collezioni {
  utenti: Utente;
  clienti: Cliente;
  risorse: Risorsa;
  campiCustom: CampoCustom;
  trattative: Trattativa;
  progetti: Progetto;
  cantieri: Cantiere;
  allocazioni: Allocazione;
  giornale: VoceGiornale;
  fir: Fir;
  ddt: Ddt;
  audit: EventoAudit;
}

export type NomeCollezione = keyof Collezioni;

export type DatiNuovi<K extends NomeCollezione> = Omit<Collezioni[K], keyof Base>;
export type Modifica<K extends NomeCollezione> = Partial<Omit<Collezioni[K], keyof Base>>;

/**
 * Accesso ai dati. Due implementazioni: Firebase (produzione) e browser (demo, senza configurazione).
 * Le pagine non usano direttamente lo store ma `Db`, che aggiunge il registro delle modifiche.
 */
export interface Store {
  readonly modalita: "demo" | "firebase";
  ascolta<K extends NomeCollezione>(
    col: K,
    cb: (docs: Collezioni[K][]) => void,
    errore?: (e: Error) => void,
  ): () => void;
  crea<K extends NomeCollezione>(col: K, dati: DatiNuovi<K>, utente: string, id?: string): Promise<Collezioni[K]>;
  aggiorna<K extends NomeCollezione>(col: K, id: string, modifica: Modifica<K>): Promise<void>;
  elimina(col: NomeCollezione, id: string): Promise<void>;
  /** Contatore atomico per la numerazione dei documenti: restituisce 1, 2, 3... */
  prossimoNumero(chiave: string): Promise<number>;
  /** Salva un'immagine (firma o foto) e restituisce l'indirizzo da memorizzare nel documento. */
  caricaImmagine(percorso: string, dataUrl: string): Promise<string>;
}

export function nuovoId(): string {
  return crypto.randomUUID();
}
