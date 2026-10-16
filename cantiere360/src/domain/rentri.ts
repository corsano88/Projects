import type { Cantiere, Fir } from "./types";
import { euro } from "./formato";

/**
 * Export dei FIR in un file CSV da caricare su RENTRI.
 *
 * RENTRI accetta caricamenti massivi; il tracciato ufficiale va confrontato con il modello
 * scaricabile dal portale prima dell'uso in produzione. Le colonne sono definite qui in un solo
 * punto, così adattarle al modello ufficiale richiede di cambiare solo questo elenco.
 */
export const COLONNE_RENTRI: { intestazione: string; valore: (f: Fir, c?: Cantiere) => string }[] = [
  { intestazione: "numero_formulario", valore: (f) => f.numeroFormulario },
  { intestazione: "data", valore: (f) => f.data },
  { intestazione: "codice_eer", valore: (f) => f.codiceEer },
  { intestazione: "descrizione_rifiuto", valore: (f) => f.descrizione },
  { intestazione: "stato_fisico", valore: (f) => f.statoFisico },
  { intestazione: "quantita_kg", valore: (f) => String(f.quantitaKg).replace(".", ",") },
  { intestazione: "produttore", valore: (f) => f.produttore },
  { intestazione: "luogo_produzione", valore: (_f, c) => (c ? [c.nome, c.indirizzo].filter(Boolean).join(" - ") : "") },
  { intestazione: "trasportatore", valore: (f) => f.trasportatore },
  { intestazione: "targa_mezzo", valore: (f) => f.targaMezzo },
  { intestazione: "destinatario", valore: (f) => f.destinatario },
  { intestazione: "costo_conferimento_eur", valore: (f) => euro(f.costoConferimento, false) },
];

function cella(v: string): string {
  // Separatore ";" come da convenzione italiana; virgolette se servono.
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function esportaRentriCsv(fir: Fir[], cantieri: Cantiere[]): string {
  const righe = [COLONNE_RENTRI.map((c) => c.intestazione).join(";")];
  for (const f of [...fir].sort((a, b) => a.data.localeCompare(b.data))) {
    const c = cantieri.find((x) => x.id === f.cantiereId);
    righe.push(COLONNE_RENTRI.map((col) => cella(col.valore(f, c))).join(";"));
  }
  // BOM per far aprire correttamente gli accenti in Excel.
  return "﻿" + righe.join("\r\n") + "\r\n";
}

/** Formato del codice EER: sei cifre a coppie, con asterisco facoltativo per i pericolosi (es. "17 09 04", "17 06 05*"). */
export function codiceEerValido(codice: string): boolean {
  return /^\d{2} ?\d{2} ?\d{2}\*?$/.test(codice.trim());
}

export function verificaFir(f: Pick<Fir, "numeroFormulario" | "data" | "codiceEer" | "quantitaKg" | "destinatario">): string[] {
  const errori: string[] = [];
  if (!f.numeroFormulario.trim()) errori.push("Inserisci il numero del formulario.");
  if (!f.data) errori.push("Inserisci la data.");
  if (!codiceEerValido(f.codiceEer)) errori.push('Codice EER non valido (es. "17 09 04").');
  if (!(f.quantitaKg > 0)) errori.push("Il peso deve essere maggiore di zero.");
  if (!f.destinatario.trim()) errori.push("Inserisci l'impianto di destinazione.");
  return errori;
}
