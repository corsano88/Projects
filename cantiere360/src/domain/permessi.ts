import type { Ruolo } from "./types";

/**
 * Permessi della Fase 1. È un sottoinsieme del modello a 14 ruoli del documento di strategia:
 * - admin: tutto, compresa la gestione utenti
 * - ufficio: commerciale e ufficio tecnico (CRM, anagrafiche, progetti, pianificazione)
 * - capocantiere: compila giornale dei lavori, FIR e DDT dei cantieri, vede anagrafiche e progetti
 * - operaio: usa solo la webapp mobile per compilare e firmare i DDT
 * Le stesse regole sono applicate lato server in firestore.rules.
 */
export type Area =
  | "utenti"
  | "anagrafiche"
  | "trattative"
  | "progetti"
  | "allocazioni"
  | "giornale"
  | "fir"
  | "ddt"
  | "audit";

export type Azione = "leggi" | "scrivi";

const MATRICE: Record<Ruolo, Partial<Record<Area, Azione[]>>> = {
  admin: {
    utenti: ["leggi", "scrivi"],
    anagrafiche: ["leggi", "scrivi"],
    trattative: ["leggi", "scrivi"],
    progetti: ["leggi", "scrivi"],
    allocazioni: ["leggi", "scrivi"],
    giornale: ["leggi", "scrivi"],
    fir: ["leggi", "scrivi"],
    ddt: ["leggi", "scrivi"],
    audit: ["leggi"],
  },
  ufficio: {
    anagrafiche: ["leggi", "scrivi"],
    trattative: ["leggi", "scrivi"],
    progetti: ["leggi", "scrivi"],
    allocazioni: ["leggi", "scrivi"],
    giornale: ["leggi", "scrivi"],
    fir: ["leggi", "scrivi"],
    ddt: ["leggi", "scrivi"],
    audit: ["leggi"],
  },
  capocantiere: {
    anagrafiche: ["leggi"],
    progetti: ["leggi"],
    allocazioni: ["leggi"],
    giornale: ["leggi", "scrivi"],
    fir: ["leggi", "scrivi"],
    ddt: ["leggi", "scrivi"],
  },
  operaio: {
    anagrafiche: ["leggi"],
    progetti: ["leggi"],
    allocazioni: ["leggi"],
    ddt: ["leggi", "scrivi"],
  },
};

export function puo(ruolo: Ruolo | undefined, area: Area, azione: Azione = "leggi"): boolean {
  if (!ruolo) return false;
  return MATRICE[ruolo][area]?.includes(azione) ?? false;
}

export const ETICHETTE_RUOLO: Record<Ruolo, string> = {
  admin: "Amministratore",
  ufficio: "Ufficio",
  capocantiere: "Capocantiere",
  operaio: "Operaio",
};

/** Gli operai lavorano solo dalla webapp mobile. */
export function soloMobile(ruolo: Ruolo | undefined): boolean {
  return ruolo === "operaio";
}
