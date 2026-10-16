import { describe, expect, it } from "vitest";
import { attiveIl, giorni, trovaConflitti, verificaAllocazione } from "./allocazioni";
import { costoAllocazione, riepilogoCosti } from "./costi";
import { centesimi, euro } from "./formato";
import { codiceProgetto, formattaNumero } from "./numerazione";
import { puo } from "./permessi";
import { codiceEerValido, esportaRentriCsv, verificaFir } from "./rentri";
import { applicaCambio, statiSuccessivi, verificaCambio } from "./trattative";
import type { Allocazione, Cantiere, Fir, Risorsa, Trattativa } from "./types";

const base = { id: "x", createdAt: "", updatedAt: "", createdBy: "u" };

function trattativa(p: Partial<Trattativa> = {}): Trattativa {
  return {
    ...base,
    clienteId: "c",
    titolo: "T",
    descrizione: "",
    indirizzoLavori: "",
    stato: "potenziale",
    motivo: "",
    valoreStimato: 0,
    sopralluogo: { data: "", note: "" },
    preventivo: { numero: "", data: "", importo: 0, computoMetrico: "" },
    contratto: { dataFirma: "", importo: 0 },
    storico: [],
    ...p,
  };
}

function alloc(p: Partial<Allocazione>): Allocazione {
  return { ...base, cantiereId: "k1", progettoId: "p", risorsaId: "r1", categoria: "mezzi", dal: "2026-01-01", al: "2026-01-10", quantita: 1, note: "", ...p };
}

describe("trattative", () => {
  it("segue il flusso del PDF un passo alla volta", () => {
    expect(statiSuccessivi(trattativa())).toEqual(["sopralluogo", "perso", "stand_by"]);
    expect(statiSuccessivi(trattativa({ stato: "preventivo" }))).toEqual(["contratto_firmato", "sopralluogo", "perso", "stand_by"]);
    expect(statiSuccessivi(trattativa({ stato: "in_corso" }))).toEqual(["chiuso", "stand_by"]);
    expect(statiSuccessivi(trattativa({ stato: "chiuso" }))).toEqual([]);
    expect(statiSuccessivi(trattativa({ stato: "perso" }))).toEqual([]);
  });

  it("dopo il contratto non si può più perdere", () => {
    expect(statiSuccessivi(trattativa({ stato: "contratto_firmato" }))).not.toContain("perso");
    expect(statiSuccessivi(trattativa({ stato: "stand_by", statoPrecedente: "in_corso" }))).toEqual(["in_corso", "chiuso"]);
  });

  it("da stand by riprende dallo stato precedente", () => {
    expect(statiSuccessivi(trattativa({ stato: "stand_by", statoPrecedente: "sopralluogo" }))).toEqual(["sopralluogo", "perso"]);
  });

  it("chiede il motivo per perso e stand by", () => {
    expect(verificaCambio(trattativa(), "perso", "")).toHaveLength(1);
    expect(verificaCambio(trattativa(), "perso", "prezzo troppo alto")).toEqual([]);
    expect(verificaCambio(trattativa(), "stand_by", " ")).toHaveLength(1);
  });

  it("non firma il contratto senza importi e data", () => {
    const t = trattativa({ stato: "preventivo", sopralluogo: { data: "2026-01-01", note: "" } });
    expect(verificaCambio(t, "contratto_firmato", "")).toHaveLength(3);
    const ok = { ...t, preventivo: { ...t.preventivo, importo: 100 }, contratto: { dataFirma: "2026-02-01", importo: 100 } };
    expect(verificaCambio(ok, "contratto_firmato", "")).toEqual([]);
  });

  it("rifiuta i salti di stato", () => {
    expect(verificaCambio(trattativa(), "contratto_firmato", "")[0]).toMatch(/Non si può passare/);
  });

  it("registra lo storico e ricorda lo stato prima dello stand by", () => {
    const t = trattativa({ stato: "sopralluogo" });
    const r = applicaCambio(t, "stand_by", "cliente in ferie", "u1", "2026-01-01T10:00:00Z");
    expect(r.stato).toBe("stand_by");
    expect(r.statoPrecedente).toBe("sopralluogo");
    expect(r.motivo).toBe("cliente in ferie");
    expect(r.storico.at(-1)).toMatchObject({ da: "sopralluogo", a: "stand_by", utente: "u1", motivo: "cliente in ferie" });
  });
});

describe("allocazioni", () => {
  const cantieri = [{ ...base, id: "k1", nome: "Bergamo" } as Cantiere];

  it("trova la stessa risorsa in periodi sovrapposti", () => {
    const esistenti = [alloc({ id: "a1" })];
    expect(trovaConflitti({ risorsaId: "r1", categoria: "mezzi", dal: "2026-01-10", al: "2026-01-12" }, esistenti, cantieri)).toHaveLength(1);
    expect(trovaConflitti({ risorsaId: "r1", categoria: "mezzi", dal: "2026-01-11", al: "2026-01-12" }, esistenti)).toHaveLength(0);
    expect(trovaConflitti({ risorsaId: "r2", categoria: "mezzi", dal: "2026-01-01", al: "2026-01-12" }, esistenti)).toHaveLength(0);
  });

  it("non segnala la stessa allocazione mentre la si modifica", () => {
    expect(trovaConflitti(alloc({}), [alloc({ id: "a1" })], [], "a1")).toHaveLength(0);
  });

  it("i materiali non vanno in conflitto", () => {
    expect(trovaConflitti({ risorsaId: "r1", categoria: "materiali", dal: "2026-01-01", al: "2026-01-02" }, [alloc({ categoria: "materiali" })])).toHaveLength(0);
  });

  it("controlla date e quantità", () => {
    expect(verificaAllocazione({ risorsaId: "r", dal: "2026-01-05", al: "2026-01-01", quantita: 1 })).toHaveLength(1);
    expect(verificaAllocazione({ risorsaId: "", dal: "", al: "", quantita: 0 })).toHaveLength(3);
  });

  it("trova le risorse attive in un giorno", () => {
    const tutte = [alloc({ id: "a" }), alloc({ id: "b", cantiereId: "k2" }), alloc({ id: "c", dal: "2026-02-01", al: "2026-02-02" })];
    expect(attiveIl(tutte, "k1", "2026-01-05").map((a) => a.id)).toEqual(["a"]);
  });

  it("conta i giorni estremi inclusi", () => {
    expect(giorni("2026-01-01", "2026-01-01")).toBe(1);
    expect(giorni("2026-03-28", "2026-04-02")).toBe(6);
  });
});

describe("costi", () => {
  it("calcola giorno, ora e quantità", () => {
    const a = { dal: "2026-01-01", al: "2026-01-05", quantita: 2 };
    expect(costoAllocazione(a, { costoUnitario: 10000, unita: "giorno" })).toBe(100000);
    expect(costoAllocazione(a, { costoUnitario: 2000, unita: "ora" })).toBe(2000 * 5 * 8 * 2);
    expect(costoAllocazione(a, { costoUnitario: 500, unita: "mc" })).toBe(1000);
  });

  it("somma risorse e smaltimento", () => {
    const r = [{ ...base, id: "r1", costoUnitario: 100, unita: "giorno" } as Risorsa];
    const fir = [{ costoConferimento: 50 } as Fir];
    expect(riepilogoCosti([alloc({ dal: "2026-01-01", al: "2026-01-02" })], r, fir)).toEqual({ risorse: 200, smaltimento: 50, totale: 250 });
  });
});

describe("formato e numerazione", () => {
  it("converte gli importi", () => {
    expect(centesimi("1.234,56")).toBe(123456);
    expect(centesimi("1234.5")).toBe(123450);
    expect(centesimi("abc")).toBe(0);
    expect(euro(123456, false)).toBe("1234,56");
  });

  it("numera i documenti per anno", () => {
    expect(formattaNumero("2026-05-01", 12)).toBe("2026/0012");
    expect(codiceProgetto("2026-05-01", 7)).toBe("P-2026-007");
  });
});

describe("permessi", () => {
  it("l'operaio usa solo i DDT", () => {
    expect(puo("operaio", "ddt", "scrivi")).toBe(true);
    expect(puo("operaio", "trattative")).toBe(false);
    expect(puo("operaio", "anagrafiche", "scrivi")).toBe(false);
  });
  it("il capocantiere non vede il CRM", () => {
    expect(puo("capocantiere", "trattative")).toBe(false);
    expect(puo("capocantiere", "giornale", "scrivi")).toBe(true);
  });
  it("solo l'admin gestisce gli utenti e nessuno scrive il registro", () => {
    expect(puo("admin", "utenti", "scrivi")).toBe(true);
    expect(puo("ufficio", "utenti")).toBe(false);
    expect(puo("admin", "audit", "scrivi")).toBe(false);
  });
});

describe("RENTRI", () => {
  const fir: Fir = {
    ...base,
    cantiereId: "k1",
    numeroFormulario: "XRIF 1/25",
    data: "2026-01-02",
    codiceEer: "17 09 04",
    descrizione: 'Misti; con "virgolette"',
    statoFisico: "solido",
    quantitaKg: 1250.5,
    produttore: "MK",
    trasportatore: "MK",
    targaMezzo: "AA000AA",
    destinatario: "Impianto",
    costoConferimento: 12345,
    inviatoRentri: false,
  };

  it("valida il codice EER", () => {
    expect(codiceEerValido("17 09 04")).toBe(true);
    expect(codiceEerValido("170605*")).toBe(true);
    expect(codiceEerValido("17 09")).toBe(false);
  });

  it("controlla i campi obbligatori del FIR", () => {
    expect(verificaFir(fir)).toEqual([]);
    expect(verificaFir({ ...fir, quantitaKg: 0, destinatario: "" })).toHaveLength(2);
  });

  it("esporta un CSV con separatore ; e valori protetti", () => {
    const csv = esportaRentriCsv([fir], [{ ...base, id: "k1", nome: "Bergamo", indirizzo: "Via Verdi 3" } as Cantiere]);
    const righe = csv.replace("﻿", "").trim().split("\r\n");
    expect(righe[0].split(";")[0]).toBe("numero_formulario");
    expect(righe[1]).toContain('"Misti; con ""virgolette"""');
    expect(righe[1]).toContain("1250,5");
    expect(righe[1]).toContain("123,45");
    expect(righe[1]).toContain("Bergamo - Via Verdi 3");
  });
});
