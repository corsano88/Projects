import type { Allocazione, CategoriaRisorsa, Cantiere } from "./types";

/** Le categorie che non si possono avere in due cantieri nello stesso giorno. I materiali si consumano a quantità. */
export const CATEGORIE_ESCLUSIVE: CategoriaRisorsa[] = ["mezzi", "attrezzature", "dipendenti"];

export function siSovrappongono(a: { dal: string; al: string }, b: { dal: string; al: string }): boolean {
  return a.dal <= b.al && b.dal <= a.al;
}

export interface Conflitto {
  allocazione: Allocazione;
  cantiere?: Cantiere;
}

/**
 * Trova le allocazioni della stessa risorsa che si sovrappongono a quella proposta.
 * `ignoraId` serve quando si modifica un'allocazione esistente.
 */
export function trovaConflitti(
  proposta: Pick<Allocazione, "risorsaId" | "categoria" | "dal" | "al">,
  esistenti: Allocazione[],
  cantieri: Cantiere[] = [],
  ignoraId?: string,
): Conflitto[] {
  if (!CATEGORIE_ESCLUSIVE.includes(proposta.categoria)) return [];
  return esistenti
    .filter((a) => a.id !== ignoraId && a.risorsaId === proposta.risorsaId && siSovrappongono(a, proposta))
    .map((a) => ({ allocazione: a, cantiere: cantieri.find((c) => c.id === a.cantiereId) }));
}

export function verificaAllocazione(p: Pick<Allocazione, "dal" | "al" | "quantita" | "risorsaId">): string[] {
  const errori: string[] = [];
  if (!p.risorsaId) errori.push("Scegli una risorsa.");
  if (!p.dal || !p.al) errori.push("Indica le date di inizio e fine.");
  else if (p.al < p.dal) errori.push("La data di fine è prima di quella di inizio.");
  if (!(p.quantita > 0)) errori.push("La quantità deve essere maggiore di zero.");
  return errori;
}

/** Allocazioni di un cantiere attive in un certo giorno: servono a precompilare DDT e giornale dei lavori. */
export function attiveIl(allocazioni: Allocazione[], cantiereId: string, giorno: string): Allocazione[] {
  return allocazioni.filter((a) => a.cantiereId === cantiereId && a.dal <= giorno && giorno <= a.al);
}

/** Giorni di calendario compresi tra due date, estremi inclusi. */
export function giorni(dal: string, al: string): number {
  const ms = Date.parse(al + "T00:00:00Z") - Date.parse(dal + "T00:00:00Z");
  return Math.floor(ms / 86_400_000) + 1;
}
