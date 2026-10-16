import type { CategoriaRisorsa, TipoCampo, Unita } from "./types";

export interface DefCampo {
  chiave: string;
  etichetta: string;
  tipo: TipoCampo;
}

export interface DefCategoria {
  titolo: string;
  singolare: string;
  unitaPredefinita: Unita;
  campi: DefCampo[];
}

/** Campi propri di ogni anagrafica (riquadro "ANAGRAFICHE" del PDF). Gli altri campi si aggiungono come "extra". */
export const CATEGORIE: Record<CategoriaRisorsa, DefCategoria> = {
  mezzi: {
    titolo: "Mezzi",
    singolare: "Mezzo",
    unitaPredefinita: "giorno",
    campi: [
      { chiave: "tipo", etichetta: "Tipo (es. escavatore, autocarro)", tipo: "testo" },
      { chiave: "targa", etichetta: "Targa / telaio", tipo: "testo" },
      { chiave: "scadenzaRevisione", etichetta: "Scadenza revisione", tipo: "data" },
      { chiave: "scadenzaAssicurazione", etichetta: "Scadenza assicurazione", tipo: "data" },
    ],
  },
  attrezzature: {
    titolo: "Attrezzature",
    singolare: "Attrezzatura",
    unitaPredefinita: "giorno",
    campi: [
      { chiave: "tipo", etichetta: "Tipo", tipo: "testo" },
      { chiave: "matricola", etichetta: "Matricola", tipo: "testo" },
      { chiave: "scadenzaVerifica", etichetta: "Scadenza verifica", tipo: "data" },
    ],
  },
  dipendenti: {
    titolo: "Dipendenti",
    singolare: "Dipendente",
    unitaPredefinita: "ora",
    campi: [
      { chiave: "mansione", etichetta: "Mansione", tipo: "testo" },
      { chiave: "codiceFiscale", etichetta: "Codice fiscale", tipo: "testo" },
      { chiave: "telefono", etichetta: "Telefono", tipo: "testo" },
      { chiave: "scadenzaVisitaMedica", etichetta: "Scadenza visita medica", tipo: "data" },
    ],
  },
  materiali: {
    titolo: "Materiali",
    singolare: "Materiale",
    unitaPredefinita: "pezzo",
    campi: [
      { chiave: "fornitore", etichetta: "Fornitore", tipo: "testo" },
      { chiave: "giacenza", etichetta: "Giacenza in magazzino", tipo: "numero" },
    ],
  },
  subappaltatori: {
    titolo: "Subappaltatori",
    singolare: "Subappaltatore",
    unitaPredefinita: "forfait",
    campi: [
      { chiave: "partitaIva", etichetta: "Partita IVA", tipo: "testo" },
      { chiave: "referente", etichetta: "Referente", tipo: "testo" },
      { chiave: "telefono", etichetta: "Telefono", tipo: "testo" },
      { chiave: "scadenzaDurc", etichetta: "Scadenza DURC", tipo: "data" },
    ],
  },
};

/** Scadenze (revisioni, DURC, certificazioni...) già passate o entro `giorniAvviso` giorni. */
export function scadenzeVicine(
  campi: Record<string, string>,
  certificazioni: { nome: string; scadenza: string }[],
  def: DefCategoria,
  oggi: string,
  giorniAvviso = 30,
): { nome: string; scadenza: string; scaduta: boolean }[] {
  const limite = new Date(Date.parse(oggi + "T00:00:00Z") + giorniAvviso * 86_400_000).toISOString().slice(0, 10);
  const date = [
    ...def.campi.filter((c) => c.tipo === "data").map((c) => ({ nome: c.etichetta, scadenza: campi[c.chiave] ?? "" })),
    ...certificazioni,
  ];
  return date
    .filter((d) => d.scadenza && d.scadenza <= limite)
    .map((d) => ({ ...d, scaduta: d.scadenza < oggi }));
}
