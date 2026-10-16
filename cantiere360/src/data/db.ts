import type { Base, Ddt, StatoTrattativa, Trattativa } from "../domain/types";
import { applicaCambio, creaProgettoAlCambio, ETICHETTE_STATO, verificaCambio } from "../domain/trattative";
import { chiaveSerie, codiceProgetto, formattaNumero } from "../domain/numerazione";
import type { Collezioni, DatiNuovi, Modifica, NomeCollezione, Store } from "./store";

/**
 * Operazioni sui dati usate dalle pagine. Ogni modifica lascia una traccia nel registro "audit"
 * (chi, cosa, quando): il documento di strategia tratta la tracciabilità come requisito di base.
 */
export class Db {
  constructor(
    readonly store: Store,
    readonly utenteId: string,
  ) {}

  private async traccia(entita: NomeCollezione, entitaId: string, azione: string, dettagli = "") {
    await this.store.crea("audit", { entita, entitaId, azione, dettagli }, this.utenteId);
  }

  async crea<K extends NomeCollezione>(col: K, dati: DatiNuovi<K>, id?: string): Promise<Collezioni[K]> {
    const doc = await this.store.crea(col, dati, this.utenteId, id);
    await this.traccia(col, doc.id, "creato");
    return doc;
  }

  async aggiorna<K extends NomeCollezione>(col: K, id: string, modifica: Modifica<K>, dettagli = "") {
    // I moduli passano spesso il documento intero: i campi di sistema non si toccano.
    const { id: _id, createdAt: _c, createdBy: _b, updatedAt: _u, ...pulita } = modifica as Modifica<K> & Partial<Base>;
    modifica = pulita as Modifica<K>;
    await this.store.aggiorna(col, id, modifica);
    await this.traccia(col, id, "modificato", dettagli || Object.keys(modifica).join(", "));
  }

  async elimina(col: NomeCollezione, id: string) {
    await this.store.elimina(col, id);
    await this.traccia(col, id, "eliminato");
  }

  /**
   * Cambia lo stato di una trattativa. Al passaggio a "contratto firmato" crea il progetto,
   * da cui parte la pianificazione delle risorse (freccia Contratto → Pianificazione del PDF).
   */
  async cambiaStatoTrattativa(t: Trattativa, a: StatoTrattativa, motivo: string): Promise<string | undefined> {
    const errori = verificaCambio(t, a, motivo);
    if (errori.length) throw new Error(errori.join(" "));
    const ora = new Date().toISOString();
    const modifica: Modifica<"trattative"> = applicaCambio(t, a, motivo, this.utenteId, ora);

    let progettoId = t.progettoId;
    if (creaProgettoAlCambio(t, a)) {
      const oggi = ora.slice(0, 10);
      const n = await this.store.prossimoNumero(chiaveSerie("progetto", oggi));
      const progetto = await this.crea("progetti", {
        trattativaId: t.id,
        clienteId: t.clienteId,
        codice: codiceProgetto(oggi, n),
        nome: t.titolo,
        importoContratto: t.contratto.importo,
        stato: "attivo",
        fatture: [],
      });
      progettoId = progetto.id;
      modifica.progettoId = progettoId;
    }
    if (a === "chiuso" && t.progettoId) {
      await this.aggiorna("progetti", t.progettoId, { stato: "chiuso" });
    }

    await this.store.aggiorna("trattative", t.id, modifica);
    await this.traccia(
      "trattative",
      t.id,
      "cambio stato",
      `${ETICHETTE_STATO[t.stato]} → ${ETICHETTE_STATO[a]}${motivo.trim() ? ` (${motivo.trim()})` : ""}`,
    );
    return progettoId;
  }

  /** Crea un DDT con il numero progressivo dell'anno. */
  async nuovoDdt(dati: Omit<DatiNuovi<"ddt">, "numero">): Promise<Ddt> {
    const n = await this.store.prossimoNumero(chiaveSerie("ddt", dati.data));
    return this.crea("ddt", { ...dati, numero: formattaNumero(dati.data, n) });
  }

  /** Salva firma e foto (in Storage con Firebase) e segna il DDT come firmato. */
  async firmaDdt(ddt: Ddt, firmatario: string, firmaDataUrl: string, fotoDataUrl: string[]) {
    if (!firmatario.trim()) throw new Error("Scrivi il nome di chi firma.");
    if (!firmaDataUrl) throw new Error("Manca la firma.");
    const firma = await this.store.caricaImmagine(`ddt/${ddt.id}/firma.png`, firmaDataUrl);
    const foto = await this.caricaFoto(ddt, fotoDataUrl);
    await this.aggiorna("ddt", ddt.id, { firmatario: firmatario.trim(), firma, foto, stato: "firmato" }, "firmato");
  }

  /** Aggiunge foto a un DDT senza firmarlo. */
  async aggiungiFotoDdt(ddt: Ddt, fotoDataUrl: string[]) {
    if (!fotoDataUrl.length) return;
    await this.aggiorna("ddt", ddt.id, { foto: await this.caricaFoto(ddt, fotoDataUrl) }, "foto aggiunte");
  }

  private async caricaFoto(ddt: Ddt, fotoDataUrl: string[]): Promise<string[]> {
    const foto = [...ddt.foto];
    for (const [i, f] of fotoDataUrl.entries()) {
      foto.push(await this.store.caricaImmagine(`ddt/${ddt.id}/foto-${Date.now()}-${i}.jpg`, f));
    }
    return foto;
  }
}
