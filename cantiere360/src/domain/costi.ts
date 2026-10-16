import { giorni } from "./allocazioni";
import type { Allocazione, Fir, Risorsa } from "./types";

/** Ore lavorative per giorno usate per stimare i costi orari. */
export const ORE_GIORNO = 8;

/** Costo stimato di un'allocazione, in centesimi. */
export function costoAllocazione(a: Pick<Allocazione, "dal" | "al" | "quantita">, r: Pick<Risorsa, "costoUnitario" | "unita">): number {
  const g = a.dal && a.al && a.al >= a.dal ? giorni(a.dal, a.al) : 0;
  switch (r.unita) {
    case "giorno":
      return Math.round(r.costoUnitario * g * a.quantita);
    case "ora":
      return Math.round(r.costoUnitario * g * ORE_GIORNO * a.quantita);
    default:
      // pezzo, kg, mc, forfait...: la quantità è già il totale
      return Math.round(r.costoUnitario * a.quantita);
  }
}

export interface RiepilogoCosti {
  risorse: number;
  smaltimento: number;
  totale: number;
}

export function riepilogoCosti(allocazioni: Allocazione[], risorse: Risorsa[], fir: Fir[]): RiepilogoCosti {
  const r = allocazioni.reduce((n, a) => {
    const ris = risorse.find((x) => x.id === a.risorsaId);
    return n + (ris ? costoAllocazione(a, ris) : 0);
  }, 0);
  const s = fir.reduce((n, f) => n + (f.costoConferimento || 0), 0);
  return { risorse: r, smaltimento: s, totale: r + s };
}
