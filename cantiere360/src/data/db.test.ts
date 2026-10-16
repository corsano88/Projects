import { describe, expect, it } from "vitest";
import { Db } from "./db";
import { memoriaInRam, StoreLocale } from "./locale";
import type { Collezioni, NomeCollezione } from "./store";
import { caricaDatiEsempio } from "./esempio";

function leggi<K extends NomeCollezione>(db: Db, col: K): Collezioni[K][] {
  let out: Collezioni[K][] = [];
  db.store.ascolta(col, (d) => (out = d))();
  return out;
}

describe("Db con store locale", () => {
  it("il contratto firmato crea il progetto e lascia traccia nel registro", async () => {
    const db = new Db(new StoreLocale(memoriaInRam()), "u1");
    const t = await db.crea("trattative", {
      clienteId: "c1",
      titolo: "Scavo",
      descrizione: "",
      indirizzoLavori: "",
      stato: "preventivo",
      motivo: "",
      valoreStimato: 0,
      sopralluogo: { data: "2026-01-01", note: "" },
      preventivo: { numero: "1", data: "2026-01-02", importo: 1000, computoMetrico: "" },
      contratto: { dataFirma: "2026-01-03", importo: 1000 },
      storico: [],
    });
    const progettoId = await db.cambiaStatoTrattativa(t, "contratto_firmato", "");
    const [progetto] = leggi(db, "progetti");
    expect(progetto.id).toBe(progettoId);
    expect(progetto.codice).toMatch(/^P-\d{4}-001$/);
    const [aggiornata] = leggi(db, "trattative");
    expect(aggiornata.stato).toBe("contratto_firmato");
    expect(aggiornata.progettoId).toBe(progettoId);
    expect(leggi(db, "audit").map((a) => a.azione)).toEqual(["creato", "creato", "cambio stato"]);
  });

  it("rifiuta un cambio di stato non valido", async () => {
    const db = new Db(new StoreLocale(memoriaInRam()), "u1");
    const t = await db.crea("trattative", {
      clienteId: "c1",
      titolo: "X",
      descrizione: "",
      indirizzoLavori: "",
      stato: "potenziale",
      motivo: "",
      valoreStimato: 0,
      sopralluogo: { data: "", note: "" },
      preventivo: { numero: "", data: "", importo: 0, computoMetrico: "" },
      contratto: { dataFirma: "", importo: 0 },
      storico: [],
    });
    await expect(db.cambiaStatoTrattativa(t, "perso", "")).rejects.toThrow(/motivo/);
  });

  it("numera i DDT in sequenza e li firma", async () => {
    const db = new Db(new StoreLocale(memoriaInRam()), "u1");
    const dati = {
      cantiereId: "k",
      progettoId: "p",
      data: "2026-03-01",
      causale: "",
      destinazione: "",
      righe: [{ descrizione: "Escavatore", quantita: 1, unita: "pezzo" as const }],
      note: "",
      firmatario: "",
      firma: "",
      foto: [],
      stato: "bozza" as const,
    };
    const a = await db.nuovoDdt(dati);
    const b = await db.nuovoDdt(dati);
    expect([a.numero, b.numero]).toEqual(["2026/0001", "2026/0002"]);
    await db.firmaDdt(a, "Luca", "data:image/png;base64,AAA", ["data:image/jpeg;base64,BBB"]);
    const firmato = leggi(db, "ddt").find((d) => d.id === a.id)!;
    expect(firmato.stato).toBe("firmato");
    expect(firmato.foto).toHaveLength(1);
    await expect(db.firmaDdt(b, "Luca", "", [])).rejects.toThrow(/firma/);
  });

  it("carica i dati di esempio senza errori", async () => {
    const db = new Db(new StoreLocale(memoriaInRam()), "u1");
    await caricaDatiEsempio(db);
    expect(leggi(db, "progetti")).toHaveLength(1);
    expect(leggi(db, "allocazioni")).toHaveLength(5);
  });
});
