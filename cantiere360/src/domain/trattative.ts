import type { StatoTrattativa, Trattativa } from "./types";

export const ETICHETTE_STATO: Record<StatoTrattativa, string> = {
  potenziale: "Potenziale",
  sopralluogo: "Sopralluogo",
  preventivo: "Preventivo",
  contratto_firmato: "Contratto firmato",
  in_corso: "In corso",
  chiuso: "Chiuso",
  perso: "Perso",
  stand_by: "In stand by",
};

/** Ordine del flusso principale, dal PDF: lead → sopralluogo → preventivo → contratto → SAL → saldo. */
export const FLUSSO: StatoTrattativa[] = [
  "potenziale",
  "sopralluogo",
  "preventivo",
  "contratto_firmato",
  "in_corso",
  "chiuso",
];

const PRIMA_DEL_CONTRATTO: StatoTrattativa[] = ["potenziale", "sopralluogo", "preventivo"];

/** Stati che richiedono un motivo. */
export const CON_MOTIVO: StatoTrattativa[] = ["perso", "stand_by"];

/** Stati raggiungibili da quello attuale. */
export function statiSuccessivi(t: Pick<Trattativa, "stato" | "statoPrecedente">): StatoTrattativa[] {
  const { stato } = t;
  if (stato === "chiuso" || stato === "perso") return [];
  if (stato === "stand_by") {
    // Si riprende dallo stato in cui era, oppure si chiude: "perso" prima del contratto, "chiuso" dopo.
    const ripresa = t.statoPrecedente ?? "potenziale";
    return PRIMA_DEL_CONTRATTO.includes(ripresa) ? [ripresa, "perso"] : [ripresa, "chiuso"];
  }
  const i = FLUSSO.indexOf(stato);
  const out: StatoTrattativa[] = [];
  if (i >= 0 && i < FLUSSO.length - 1) out.push(FLUSSO[i + 1]);
  // Un passo indietro è ammesso solo prima del contratto (es. nuovo sopralluogo dopo il preventivo).
  if (stato === "sopralluogo" || stato === "preventivo") out.push(FLUSSO[i - 1]);
  // Dopo la firma del contratto la trattativa non si perde più: va avanti, si chiude o si sospende.
  if (PRIMA_DEL_CONTRATTO.includes(stato)) out.push("perso");
  out.push("stand_by");
  return out;
}

/**
 * Controlla un cambio di stato. Restituisce l'elenco dei problemi; vuoto se il cambio è valido.
 */
export function verificaCambio(t: Trattativa, a: StatoTrattativa, motivo: string): string[] {
  const errori: string[] = [];
  if (!statiSuccessivi(t).includes(a)) {
    errori.push(`Non si può passare da "${ETICHETTE_STATO[t.stato]}" a "${ETICHETTE_STATO[a]}".`);
    return errori;
  }
  if (CON_MOTIVO.includes(a) && !motivo.trim()) {
    errori.push(`Indica il motivo per "${ETICHETTE_STATO[a]}".`);
  }
  if (a === "preventivo" && !t.sopralluogo.data) {
    errori.push("Inserisci la data del sopralluogo prima del preventivo.");
  }
  if (a === "contratto_firmato") {
    if (!(t.preventivo.importo > 0)) errori.push("Inserisci l'importo del preventivo.");
    if (!t.contratto.dataFirma) errori.push("Inserisci la data di firma del contratto.");
    if (!(t.contratto.importo > 0)) errori.push("Inserisci l'importo del contratto.");
  }
  return errori;
}

/** Applica il cambio di stato (senza controlli: chiamare prima `verificaCambio`). */
export function applicaCambio(
  t: Trattativa,
  a: StatoTrattativa,
  motivo: string,
  utente: string,
  ora: string,
): Pick<Trattativa, "stato" | "motivo" | "statoPrecedente" | "storico"> {
  return {
    stato: a,
    motivo: CON_MOTIVO.includes(a) ? motivo.trim() : "",
    statoPrecedente: a === "stand_by" ? t.stato : undefined,
    storico: [
      ...t.storico,
      { da: t.stato, a, data: ora, utente, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) },
    ],
  };
}

/** Il passaggio a "contratto firmato" crea il progetto, se non esiste già. */
export function creaProgettoAlCambio(t: Trattativa, a: StatoTrattativa): boolean {
  return a === "contratto_firmato" && !t.progettoId;
}
