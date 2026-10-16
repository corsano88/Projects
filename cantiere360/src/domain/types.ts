// Modello dati della Fase 1.
// Gli importi sono in centesimi di euro (interi) per evitare errori di arrotondamento.
// Le date sono stringhe ISO "AAAA-MM-GG"; i timestamp sono ISO completi.

export type ID = string;

export interface Base {
  id: ID;
  createdAt: string;
  updatedAt: string;
  createdBy: ID;
}

/** Dati che il chiamante fornisce quando crea un record. */
export type Nuovo<T extends Base> = Omit<T, keyof Base>;

// ---------- Ruoli ----------

export const RUOLI = ["admin", "ufficio", "capocantiere", "operaio"] as const;
export type Ruolo = (typeof RUOLI)[number];

export interface Utente extends Base {
  nome: string;
  email: string;
  ruolo: Ruolo;
  /** Collegamento facoltativo all'anagrafica dipendenti. */
  dipendenteId?: ID;
  attivo: boolean;
}

// ---------- Anagrafiche ----------

export interface Cliente extends Base {
  ragioneSociale: string;
  partitaIva: string;
  codiceFiscale: string;
  indirizzo: string;
  email: string;
  telefono: string;
  referente: string;
  note: string;
  /** Valori dei campi extra creati dall'utente, per id del campo. */
  extra?: Record<string, string>;
}

export const CATEGORIE_RISORSA = [
  "mezzi",
  "attrezzature",
  "dipendenti",
  "materiali",
  "subappaltatori",
] as const;
export type CategoriaRisorsa = (typeof CATEGORIE_RISORSA)[number];

export const UNITA = ["ora", "giorno", "pezzo", "kg", "t", "mc", "mq", "m", "forfait"] as const;
export type Unita = (typeof UNITA)[number];

export interface Certificazione {
  nome: string;
  /** Data di scadenza, vuota se non scade. */
  scadenza: string;
}

/**
 * Una risorsa di qualunque categoria (mezzo, attrezzatura, dipendente, materiale, subappaltatore).
 * I campi propri della categoria stanno in `campi`, quelli creati dall'utente in `extra`.
 */
export interface Risorsa extends Base {
  categoria: CategoriaRisorsa;
  nome: string;
  codice: string;
  /** Costo per unità, in centesimi. */
  costoUnitario: number;
  unita: Unita;
  attiva: boolean;
  campi: Record<string, string>;
  extra: Record<string, string>;
  /** Solo per i dipendenti. */
  certificazioni: Certificazione[];
  /** Solo per i dipendenti: 1 = alta, 3 = bassa. */
  priorita?: 1 | 2 | 3;
}

export type TipoCampo = "testo" | "numero" | "data";

/** Campo "extra" creato dall'utente per una categoria di anagrafica. */
export interface CampoCustom extends Base {
  categoria: CategoriaRisorsa | "clienti";
  etichetta: string;
  tipo: TipoCampo;
}

// ---------- Trattative (CRM) ----------

export const STATI_TRATTATIVA = [
  "potenziale",
  "sopralluogo",
  "preventivo",
  "contratto_firmato",
  "in_corso",
  "chiuso",
  "perso",
  "stand_by",
] as const;
export type StatoTrattativa = (typeof STATI_TRATTATIVA)[number];

export interface CambioStato {
  da: StatoTrattativa | null;
  a: StatoTrattativa;
  data: string;
  utente: ID;
  motivo?: string;
}

export interface Trattativa extends Base {
  clienteId: ID;
  titolo: string;
  descrizione: string;
  indirizzoLavori: string;
  stato: StatoTrattativa;
  /** Motivo, obbligatorio per "perso" e "stand_by". */
  motivo: string;
  /** Lo stato in cui era prima di "stand_by", per poterlo riprendere. */
  statoPrecedente?: StatoTrattativa;
  valoreStimato: number;
  sopralluogo: { data: string; note: string };
  preventivo: { numero: string; data: string; importo: number; computoMetrico: string };
  contratto: { dataFirma: string; importo: number };
  progettoId?: ID;
  storico: CambioStato[];
}

// ---------- Progetti e cantieri ----------

export type TipoFattura = "acconto" | "sal" | "saldo";

export interface Fattura {
  numero: string;
  data: string;
  tipo: TipoFattura;
  importo: number;
  pagata: boolean;
}

export interface Progetto extends Base {
  trattativaId: ID;
  clienteId: ID;
  codice: string;
  nome: string;
  importoContratto: number;
  stato: "attivo" | "chiuso";
  fatture: Fattura[];
}

export type StatoCantiere = "pianificato" | "aperto" | "chiuso";

export interface Cantiere extends Base {
  progettoId: ID;
  clienteId: ID;
  nome: string;
  indirizzo: string;
  dataInizio: string;
  dataFinePrevista: string;
  stato: StatoCantiere;
  capocantiereId?: ID;
}

export interface Allocazione extends Base {
  cantiereId: ID;
  progettoId: ID;
  risorsaId: ID;
  categoria: CategoriaRisorsa;
  dal: string;
  al: string;
  quantita: number;
  note: string;
}

// ---------- Gestione cantiere ----------

export interface VoceGiornale extends Base {
  cantiereId: ID;
  data: string;
  meteo: string;
  lavoriEseguiti: string;
  /** Avanzamento complessivo del cantiere, 0-100. */
  avanzamento: number;
  problemi: string;
  /** Risorse presenti quel giorno (precompilate dalle allocazioni). */
  presenti: ID[];
}

export const STATI_FISICI = ["solido", "fangoso", "liquido", "polverulento"] as const;
export type StatoFisico = (typeof STATI_FISICI)[number];

/** Formulario di Identificazione Rifiuti. */
export interface Fir extends Base {
  cantiereId: ID;
  numeroFormulario: string;
  data: string;
  codiceEer: string;
  descrizione: string;
  statoFisico: StatoFisico;
  quantitaKg: number;
  produttore: string;
  trasportatore: string;
  targaMezzo: string;
  destinatario: string;
  costoConferimento: number;
  /** Segnato quando il FIR è stato caricato su RENTRI. */
  inviatoRentri: boolean;
}

export interface RigaDdt {
  risorsaId?: ID;
  categoria?: CategoriaRisorsa;
  descrizione: string;
  quantita: number;
  unita: Unita;
}

export interface Ddt extends Base {
  cantiereId: ID;
  progettoId: ID;
  /** Numero progressivo nell'anno, es. "2026/0012". */
  numero: string;
  data: string;
  causale: string;
  destinazione: string;
  righe: RigaDdt[];
  note: string;
  firmatario: string;
  /** Immagine della firma (URL o data URL). Vuota finché non è firmato. */
  firma: string;
  foto: string[];
  stato: "bozza" | "firmato";
}

// ---------- Audit ----------

export interface EventoAudit extends Base {
  entita: string;
  entitaId: ID;
  azione: string;
  dettagli: string;
}
