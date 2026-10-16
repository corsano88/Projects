import type { Db } from "./db";
import type { DatiNuovi } from "./store";

function giorno(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function risorsa(d: Partial<DatiNuovi<"risorse">> & Pick<DatiNuovi<"risorse">, "categoria" | "nome" | "unita" | "costoUnitario">): DatiNuovi<"risorse"> {
  return { codice: "", attiva: true, campi: {}, extra: {}, certificazioni: [], ...d };
}

/** Dati di esempio per provare il flusso completo in modalità demo. */
export async function caricaDatiEsempio(db: Db) {
  const rossi = await db.crea("clienti", {
    ragioneSociale: "Rossi Costruzioni S.r.l.",
    partitaIva: "01234567890",
    codiceFiscale: "01234567890",
    indirizzo: "Via Roma 10, Milano",
    email: "info@rossicostruzioni.it",
    telefono: "02 1234567",
    referente: "Mario Rossi",
    note: "",
  });
  const comune = await db.crea("clienti", {
    ragioneSociale: "Comune di Brescia",
    partitaIva: "00761890177",
    codiceFiscale: "00761890177",
    indirizzo: "Piazza della Loggia 1, Brescia",
    email: "",
    telefono: "",
    referente: "Ufficio Lavori Pubblici",
    note: "",
  });

  const escavatore = await db.crea(
    "risorse",
    risorsa({
      categoria: "mezzi",
      nome: "Escavatore CAT 320",
      codice: "M-01",
      unita: "giorno",
      costoUnitario: 45000,
      campi: { tipo: "Escavatore cingolato", targa: "AB123CD", scadenzaRevisione: giorno(20) },
    }),
  );
  const autocarro = await db.crea(
    "risorse",
    risorsa({ categoria: "mezzi", nome: "Autocarro Iveco Trakker", codice: "M-02", unita: "giorno", costoUnitario: 32000, campi: { tipo: "Autocarro", targa: "EF456GH" } }),
  );
  const martello = await db.crea(
    "risorse",
    risorsa({ categoria: "attrezzature", nome: "Martello demolitore", codice: "A-01", unita: "giorno", costoUnitario: 4000 }),
  );
  const luca = await db.crea(
    "risorse",
    risorsa({
      categoria: "dipendenti",
      nome: "Luca Bianchi",
      codice: "D-01",
      unita: "ora",
      costoUnitario: 2800,
      priorita: 1,
      campi: { mansione: "Capocantiere" },
      certificazioni: [{ nome: "Corso preposti 81/08", scadenza: giorno(400) }],
    }),
  );
  const ahmed = await db.crea(
    "risorse",
    risorsa({
      categoria: "dipendenti",
      nome: "Ahmed Kone",
      codice: "D-02",
      unita: "ora",
      costoUnitario: 2200,
      priorita: 2,
      campi: { mansione: "Escavatorista" },
      certificazioni: [{ nome: "Patentino escavatore", scadenza: giorno(10) }],
    }),
  );
  await db.crea("risorse", risorsa({ categoria: "materiali", nome: "Calcestruzzo C25/30", unita: "mc", costoUnitario: 11000, campi: { fornitore: "Calcestruzzi Nord" } }));
  await db.crea(
    "risorse",
    risorsa({ categoria: "subappaltatori", nome: "Impianti Verdi S.n.c.", unita: "forfait", costoUnitario: 0, campi: { referente: "Paolo Verdi", scadenzaDurc: giorno(60) } }),
  );

  // Una trattativa per ogni fase iniziale del flusso.
  const base = { descrizione: "", motivo: "", sopralluogo: { data: "", note: "" }, preventivo: { numero: "", data: "", importo: 0, computoMetrico: "" }, contratto: { dataFirma: "", importo: 0 }, storico: [] };
  await db.crea("trattative", { ...base, clienteId: rossi.id, titolo: "Ristrutturazione capannone", indirizzoLavori: "Via Milano 5, Monza", stato: "potenziale", valoreStimato: 8000000 });
  await db.crea("trattative", {
    ...base,
    clienteId: comune.id,
    titolo: "Demolizione ex scuola",
    indirizzoLavori: "Via Brescia 20, Brescia",
    stato: "preventivo",
    valoreStimato: 25000000,
    sopralluogo: { data: giorno(-20), note: "Presenza di amianto da verificare" },
    preventivo: { numero: "PR-2026-014", data: giorno(-10), importo: 24000000, computoMetrico: "Demolizione 1.200 mc · trasporto e conferimento macerie" },
  });
  const firmata = await db.crea("trattative", {
    ...base,
    clienteId: rossi.id,
    titolo: "Scavo fondazioni palazzina",
    indirizzoLavori: "Via Verdi 3, Bergamo",
    stato: "preventivo",
    valoreStimato: 12000000,
    sopralluogo: { data: giorno(-30), note: "" },
    preventivo: { numero: "PR-2026-009", data: giorno(-25), importo: 11500000, computoMetrico: "" },
    contratto: { dataFirma: giorno(-5), importo: 11500000 },
  });
  const progettoId = await db.cambiaStatoTrattativa(firmata, "contratto_firmato", "");

  const cantiere = await db.crea("cantieri", {
    progettoId: progettoId!,
    clienteId: rossi.id,
    nome: "Bergamo - Via Verdi",
    indirizzo: "Via Verdi 3, Bergamo",
    dataInizio: giorno(-3),
    dataFinePrevista: giorno(25),
    stato: "aperto",
    capocantiereId: luca.id,
  });
  for (const [r, cat, q] of [
    [escavatore.id, "mezzi", 1],
    [autocarro.id, "mezzi", 1],
    [martello.id, "attrezzature", 2],
    [luca.id, "dipendenti", 1],
    [ahmed.id, "dipendenti", 1],
  ] as const) {
    await db.crea("allocazioni", { cantiereId: cantiere.id, progettoId: progettoId!, risorsaId: r, categoria: cat, dal: giorno(-3), al: giorno(15), quantita: q, note: "" });
  }
  await db.crea("giornale", {
    cantiereId: cantiere.id,
    data: giorno(-1),
    meteo: "Sereno",
    lavoriEseguiti: "Scavo di sbancamento lato nord, carico macerie su autocarro.",
    avanzamento: 15,
    problemi: "",
    presenti: [escavatore.id, autocarro.id, luca.id, ahmed.id],
  });
  await db.crea("fir", {
    cantiereId: cantiere.id,
    numeroFormulario: "XRIF 000123/25",
    data: giorno(-1),
    codiceEer: "17 05 04",
    descrizione: "Terra e rocce da scavo",
    statoFisico: "solido",
    quantitaKg: 18500,
    produttore: "MK Service",
    trasportatore: "MK Service",
    targaMezzo: "EF456GH",
    destinatario: "Impianto recupero inerti Bergamo",
    costoConferimento: 27750,
    inviatoRentri: false,
  });
}
