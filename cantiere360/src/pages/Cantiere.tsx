import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CATEGORIE } from "../domain/anagrafiche";
import { attiveIl, trovaConflitti, verificaAllocazione } from "../domain/allocazioni";
import { costoAllocazione, riepilogoCosti } from "../domain/costi";
import { dataIt, euro, oggi } from "../domain/formato";
import { puo } from "../domain/permessi";
import { verificaFir } from "../domain/rentri";
import type { Allocazione, Cantiere, CategoriaRisorsa, Fir, VoceGiornale } from "../domain/types";
import { CATEGORIE_RISORSA, STATI_FISICI } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import type { DatiNuovi } from "../data/store";
import { AreaTesto, Errori, Etichetta, Importo, Modale, Pagina, Scelta, Testo, useAzione, Vuoto } from "../ui/componenti";
import { EtichettaCantiere } from "./Progetti";
import { ElencoDdt } from "./Ddt";

// ---------- Allocazione risorse ----------

function FormAllocazione({ cantiere, allocazione, onChiudi }: { cantiere: Cantiere; allocazione?: Allocazione; onChiudi: () => void }) {
  const { db } = useSessione();
  const risorse = (useCollezione("risorse") ?? []).filter((r) => r.attiva || r.id === allocazione?.risorsaId);
  const tutte = useCollezione("allocazioni") ?? [];
  const cantieri = useCollezione("cantieri") ?? [];
  const [d, setD] = useState<DatiNuovi<"allocazioni">>(
    allocazione
      ? { ...allocazione }
      : {
          cantiereId: cantiere.id,
          progettoId: cantiere.progettoId,
          risorsaId: "",
          categoria: "dipendenti",
          dal: cantiere.dataInizio > oggi() ? cantiere.dataInizio : oggi(),
          al: cantiere.dataFinePrevista || cantiere.dataInizio,
          quantita: 1,
          note: "",
        },
  );
  const { errori, setErrori, esegui, inCorso } = useAzione();
  const conflitti = d.risorsaId ? trovaConflitti(d, tutte, cantieri, allocazione?.id) : [];
  const risorsa = risorse.find((r) => r.id === d.risorsaId);
  const opzioni = risorse
    .filter((r) => r.categoria === d.categoria)
    .sort((a, b) => (a.priorita ?? 2) - (b.priorita ?? 2) || a.nome.localeCompare(b.nome))
    .map((r) => {
      // Mostra subito se la risorsa è già impegnata nel periodo scelto.
      const occ = trovaConflitti({ ...d, risorsaId: r.id }, tutte, cantieri, allocazione?.id);
      return { valore: r.id, etichetta: r.nome + (occ.length ? ` (occupato: ${occ.map((o) => o.cantiere?.nome ?? "?").join(", ")})` : "") };
    });

  return (
    <Modale titolo={allocazione ? "Modifica allocazione" : "Alloca una risorsa"} onChiudi={onChiudi}>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          const err = verificaAllocazione(d);
          if (err.length) return setErrori(err);
          if (conflitti.length && !confirm("La risorsa è già impegnata in quel periodo. Allocarla comunque?")) return;
          void esegui(async () => {
            if (allocazione) await db.aggiorna("allocazioni", allocazione.id, d);
            else await db.crea("allocazioni", d);
            onChiudi();
          });
        }}
      >
        <Scelta
          etichetta="Categoria"
          valore={d.categoria}
          onCambia={(categoria) => setD({ ...d, categoria, risorsaId: "" })}
          opzioni={CATEGORIE_RISORSA.map((c) => ({ valore: c, etichetta: CATEGORIE[c].titolo }))}
        />
        <Scelta etichetta="Risorsa" valore={d.risorsaId} onCambia={(risorsaId) => setD({ ...d, risorsaId })} vuota="Scegli…" opzioni={opzioni} />
        <Testo etichetta="Dal" tipo="date" valore={d.dal} onCambia={(dal) => setD({ ...d, dal })} />
        <Testo etichetta="Al" tipo="date" valore={d.al} onCambia={(al) => setD({ ...d, al })} />
        <Testo
          etichetta={`Quantità${risorsa ? ` (${d.categoria === "materiali" ? risorsa.unita : "unità"})` : ""}`}
          tipo="number"
          valore={String(d.quantita)}
          onCambia={(v) => setD({ ...d, quantita: Number(v) })}
        />
        {risorsa && (
          <p className="nota">
            Costo stimato: <strong>{euro(costoAllocazione(d, risorsa))}</strong> ({euro(risorsa.costoUnitario)}/{risorsa.unita})
          </p>
        )}
        <AreaTesto etichetta="Note" valore={d.note} onCambia={(note) => setD({ ...d, note })} />
        {conflitti.length > 0 && (
          <p className="avviso largo">
            Già impegnata:{" "}
            {conflitti.map((c) => `${c.cantiere?.nome ?? "?"} dal ${dataIt(c.allocazione.dal)} al ${dataIt(c.allocazione.al)}`).join("; ")}
          </p>
        )}
        <Errori errori={errori} />
        <div className="piede">
          {allocazione && (
            <button type="button" className="pericolo" onClick={() => void esegui(async () => (await db.elimina("allocazioni", allocazione.id), onChiudi()))}>
              Togli
            </button>
          )}
          <button type="button" onClick={onChiudi}>
            Annulla
          </button>
          <button className="primario" type="submit" disabled={inCorso}>
            Salva
          </button>
        </div>
      </form>
    </Modale>
  );
}

function Risorse({ cantiere }: { cantiere: Cantiere }) {
  const { utente } = useSessione();
  const allocazioni = (useCollezione("allocazioni") ?? []).filter((a) => a.cantiereId === cantiere.id);
  const risorse = useCollezione("risorse") ?? [];
  const [modifica, setModifica] = useState<Allocazione | "nuova" | null>(null);
  const scrive = puo(utente.ruolo, "allocazioni", "scrivi");
  const g = oggi();
  return (
    <>
      {scrive && (
        <p>
          <button className="primario" onClick={() => setModifica("nuova")}>
            + Alloca risorsa
          </button>
        </p>
      )}
      {!allocazioni.length && <Vuoto>Nessuna risorsa allocata a questo cantiere.</Vuoto>}
      {CATEGORIE_RISORSA.map((cat: CategoriaRisorsa) => {
        const qui = allocazioni.filter((a) => a.categoria === cat).sort((a, b) => a.dal.localeCompare(b.dal));
        if (!qui.length) return null;
        return (
          <section key={cat} className="riquadro">
            <h3>{CATEGORIE[cat].titolo}</h3>
            <table>
              <thead>
                <tr>
                  <th>Risorsa</th>
                  <th>Periodo</th>
                  <th>Quantità</th>
                  <th>Costo stimato</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {qui.map((a) => {
                  const r = risorse.find((x) => x.id === a.risorsaId);
                  const attiva = a.dal <= g && g <= a.al;
                  return (
                    <tr key={a.id} className={scrive ? "cliccabile" : ""} onClick={() => scrive && setModifica(a)}>
                      <td>
                        {r?.nome ?? "?"} {attiva && <Etichetta tono="ok">oggi</Etichetta>}
                      </td>
                      <td>
                        {dataIt(a.dal)} – {dataIt(a.al)}
                      </td>
                      <td>{a.quantita}</td>
                      <td>{r ? euro(costoAllocazione(a, r)) : ""}</td>
                      <td>{a.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
      {modifica && <FormAllocazione cantiere={cantiere} allocazione={modifica === "nuova" ? undefined : modifica} onChiudi={() => setModifica(null)} />}
    </>
  );
}

// ---------- Giornale dei lavori ----------

function FormGiornale({ cantiere, voce, onChiudi }: { cantiere: Cantiere; voce?: VoceGiornale; onChiudi: () => void }) {
  const { db } = useSessione();
  const allocazioni = useCollezione("allocazioni") ?? [];
  const risorse = useCollezione("risorse") ?? [];
  const giornale = useCollezione("giornale") ?? [];
  const ultimo = giornale.filter((v) => v.cantiereId === cantiere.id).sort((a, b) => b.data.localeCompare(a.data))[0];
  const [d, setD] = useState<DatiNuovi<"giornale">>(
    voce
      ? { ...voce }
      : {
          cantiereId: cantiere.id,
          data: oggi(),
          meteo: "",
          lavoriEseguiti: "",
          avanzamento: ultimo?.avanzamento ?? 0,
          problemi: "",
          presenti: attiveIl(allocazioni, cantiere.id, oggi()).map((a) => a.risorsaId),
        },
  );
  const { errori, setErrori, esegui, inCorso } = useAzione();
  // Le risorse previste in quel giorno, più quelle già segnate presenti.
  const previste = new Set([...attiveIl(allocazioni, cantiere.id, d.data).map((a) => a.risorsaId), ...d.presenti]);
  return (
    <Modale titolo={voce ? `Giornale del ${dataIt(voce.data)}` : "Nuova voce del giornale"} onChiudi={onChiudi} largo>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          if (!d.lavoriEseguiti.trim()) return setErrori(["Descrivi i lavori eseguiti."]);
          void esegui(async () => {
            if (voce) await db.aggiorna("giornale", voce.id, d);
            else await db.crea("giornale", d);
            onChiudi();
          });
        }}
      >
        <Testo etichetta="Data" tipo="date" valore={d.data} onCambia={(data) => setD({ ...d, data })} />
        <Testo etichetta="Meteo" valore={d.meteo} onCambia={(meteo) => setD({ ...d, meteo })} />
        <AreaTesto etichetta="Lavori eseguiti *" valore={d.lavoriEseguiti} onCambia={(lavoriEseguiti) => setD({ ...d, lavoriEseguiti })} />
        <AreaTesto etichetta="Problemi / note" valore={d.problemi} onCambia={(problemi) => setD({ ...d, problemi })} />
        <Testo
          etichetta="Avanzamento del cantiere (%)"
          tipo="number"
          valore={String(d.avanzamento)}
          onCambia={(v) => setD({ ...d, avanzamento: Math.max(0, Math.min(100, Number(v))) })}
        />
        <fieldset className="largo">
          <legend>Presenti (precompilati dalle risorse allocate)</legend>
          {!previste.size && <p className="nota">Nessuna risorsa allocata per questo giorno.</p>}
          {[...previste].map((id) => {
            const r = risorse.find((x) => x.id === id);
            return (
              <label key={id} className="spunta">
                <input
                  type="checkbox"
                  checked={d.presenti.includes(id)}
                  onChange={(e) => setD({ ...d, presenti: e.target.checked ? [...d.presenti, id] : d.presenti.filter((x) => x !== id) })}
                />
                {r?.nome ?? "?"} <span className="nota">{r ? CATEGORIE[r.categoria].singolare : ""}</span>
              </label>
            );
          })}
        </fieldset>
        <Errori errori={errori} />
        <div className="piede">
          <button type="button" onClick={onChiudi}>
            Annulla
          </button>
          <button className="primario" type="submit" disabled={inCorso}>
            Salva
          </button>
        </div>
      </form>
    </Modale>
  );
}

function Giornale({ cantiere }: { cantiere: Cantiere }) {
  const { utente } = useSessione();
  const voci = (useCollezione("giornale") ?? []).filter((v) => v.cantiereId === cantiere.id).sort((a, b) => b.data.localeCompare(a.data));
  const risorse = useCollezione("risorse") ?? [];
  const [modifica, setModifica] = useState<VoceGiornale | "nuova" | null>(null);
  const scrive = puo(utente.ruolo, "giornale", "scrivi");
  return (
    <>
      {scrive && (
        <p>
          <button className="primario" onClick={() => setModifica("nuova")}>
            + Voce di oggi
          </button>
        </p>
      )}
      {!voci.length && <Vuoto>Il giornale dei lavori è vuoto.</Vuoto>}
      {voci.map((v) => (
        <article key={v.id} className={`riquadro voce ${scrive ? "cliccabile" : ""}`} onClick={() => scrive && setModifica(v)}>
          <header>
            <strong>{dataIt(v.data)}</strong>
            {v.meteo && <span className="nota"> · {v.meteo}</span>}
            <span className="avanzamento">
              <span style={{ width: `${v.avanzamento}%` }} />
            </span>
            <span>{v.avanzamento}%</span>
          </header>
          <p>{v.lavoriEseguiti}</p>
          {v.problemi && <p className="avviso">{v.problemi}</p>}
          <p className="nota">Presenti: {v.presenti.map((id) => risorse.find((r) => r.id === id)?.nome ?? "?").join(", ") || "—"}</p>
        </article>
      ))}
      {modifica && <FormGiornale cantiere={cantiere} voce={modifica === "nuova" ? undefined : modifica} onChiudi={() => setModifica(null)} />}
    </>
  );
}

// ---------- FIR ----------

export function FormFir({ cantiere, fir, onChiudi }: { cantiere: Cantiere; fir?: Fir; onChiudi: () => void }) {
  const { db } = useSessione();
  const [d, setD] = useState<DatiNuovi<"fir">>(
    fir
      ? { ...fir }
      : {
          cantiereId: cantiere.id,
          numeroFormulario: "",
          data: oggi(),
          codiceEer: "17 09 04",
          descrizione: "Rifiuti misti dell'attività di costruzione e demolizione",
          statoFisico: "solido",
          quantitaKg: 0,
          produttore: "",
          trasportatore: "",
          targaMezzo: "",
          destinatario: "",
          costoConferimento: 0,
          inviatoRentri: false,
        },
  );
  const { errori, setErrori, esegui, inCorso } = useAzione();
  const set = <K extends keyof typeof d>(k: K) => (v: (typeof d)[K]) => setD({ ...d, [k]: v });
  return (
    <Modale titolo={fir ? `FIR ${fir.numeroFormulario}` : "Nuovo FIR"} onChiudi={onChiudi} largo>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          const err = verificaFir(d);
          if (err.length) return setErrori(err);
          void esegui(async () => {
            if (fir) await db.aggiorna("fir", fir.id, d);
            else await db.crea("fir", d);
            onChiudi();
          });
        }}
      >
        <Testo etichetta="Numero formulario" obbligatorio valore={d.numeroFormulario} onCambia={set("numeroFormulario")} />
        <Testo etichetta="Data" tipo="date" valore={d.data} onCambia={set("data")} />
        <Testo etichetta="Codice EER" obbligatorio valore={d.codiceEer} onCambia={set("codiceEer")} />
        <Scelta etichetta="Stato fisico" valore={d.statoFisico} onCambia={set("statoFisico")} opzioni={STATI_FISICI.map((s) => ({ valore: s, etichetta: s }))} />
        <Testo etichetta="Descrizione rifiuto" largo valore={d.descrizione} onCambia={set("descrizione")} />
        <Testo etichetta="Peso (kg)" tipo="number" obbligatorio valore={String(d.quantitaKg || "")} onCambia={(v) => setD({ ...d, quantitaKg: Number(v) })} />
        <Importo etichetta="Costo di conferimento" valore={d.costoConferimento} onCambia={set("costoConferimento")} />
        <Testo etichetta="Produttore" valore={d.produttore} onCambia={set("produttore")} />
        <Testo etichetta="Trasportatore" valore={d.trasportatore} onCambia={set("trasportatore")} />
        <Testo etichetta="Targa mezzo" valore={d.targaMezzo} onCambia={set("targaMezzo")} />
        <Testo etichetta="Impianto di destinazione" obbligatorio valore={d.destinatario} onCambia={set("destinatario")} />
        <label className="spunta largo">
          <input type="checkbox" checked={d.inviatoRentri} onChange={(e) => setD({ ...d, inviatoRentri: e.target.checked })} />
          Già caricato su RENTRI
        </label>
        <Errori errori={errori} />
        <div className="piede">
          <button type="button" onClick={onChiudi}>
            Annulla
          </button>
          <button className="primario" type="submit" disabled={inCorso}>
            Salva
          </button>
        </div>
      </form>
    </Modale>
  );
}

function ElencoFirCantiere({ cantiere }: { cantiere: Cantiere }) {
  const { utente } = useSessione();
  const fir = (useCollezione("fir") ?? []).filter((f) => f.cantiereId === cantiere.id).sort((a, b) => b.data.localeCompare(a.data));
  const [modifica, setModifica] = useState<Fir | "nuovo" | null>(null);
  const scrive = puo(utente.ruolo, "fir", "scrivi");
  return (
    <>
      <p>
        {scrive && (
          <button className="primario" onClick={() => setModifica("nuovo")}>
            + FIR
          </button>
        )}{" "}
        <Link to="/fir">Export RENTRI →</Link>
      </p>
      {!fir.length && <Vuoto>Nessun formulario rifiuti per questo cantiere.</Vuoto>}
      {!!fir.length && <TabellaFir fir={fir} onApri={scrive ? setModifica : undefined} />}
      {modifica && <FormFir cantiere={cantiere} fir={modifica === "nuovo" ? undefined : modifica} onChiudi={() => setModifica(null)} />}
    </>
  );
}

export function TabellaFir({ fir, onApri, cantieri }: { fir: Fir[]; onApri?: (f: Fir) => void; cantieri?: Cantiere[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Formulario</th>
          <th>Data</th>
          {cantieri && <th>Cantiere</th>}
          <th>EER</th>
          <th>Peso</th>
          <th>Costo</th>
          <th>Destinazione</th>
          <th>RENTRI</th>
        </tr>
      </thead>
      <tbody>
        {fir.map((f) => (
          <tr key={f.id} className={onApri ? "cliccabile" : ""} onClick={() => onApri?.(f)}>
            <td>{f.numeroFormulario}</td>
            <td>{dataIt(f.data)}</td>
            {cantieri && <td>{cantieri.find((c) => c.id === f.cantiereId)?.nome}</td>}
            <td>{f.codiceEer}</td>
            <td>{f.quantitaKg.toLocaleString("it-IT")} kg</td>
            <td>{euro(f.costoConferimento)}</td>
            <td>{f.destinatario}</td>
            <td>{f.inviatoRentri ? <Etichetta tono="ok">caricato</Etichetta> : <Etichetta tono="attenzione">da caricare</Etichetta>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------- Pagina cantiere ----------

const SCHEDE = ["risorse", "giornale", "fir", "ddt"] as const;
const TITOLI_SCHEDE: Record<(typeof SCHEDE)[number], string> = {
  risorse: "Risorse",
  giornale: "Giornale dei lavori",
  fir: "FIR (rifiuti)",
  ddt: "DDT",
};

export function DettaglioCantiere() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const cantieri = useCollezione("cantieri");
  const progetti = useCollezione("progetti") ?? [];
  const allocazioni = useCollezione("allocazioni") ?? [];
  const risorse = useCollezione("risorse") ?? [];
  const fir = useCollezione("fir") ?? [];
  const giornale = useCollezione("giornale") ?? [];
  const cantiere = cantieri?.find((c) => c.id === id);
  if (!cantieri) return null;
  if (!cantiere) return <Vuoto>Cantiere non trovato.</Vuoto>;
  const scheda = (SCHEDE as readonly string[]).includes(params.get("s") ?? "") ? (params.get("s") as (typeof SCHEDE)[number]) : "risorse";
  const progetto = progetti.find((p) => p.id === cantiere.progettoId);
  const costi = riepilogoCosti(
    allocazioni.filter((a) => a.cantiereId === cantiere.id),
    risorse,
    fir.filter((f) => f.cantiereId === cantiere.id),
  );
  const ultimo = giornale.filter((v) => v.cantiereId === cantiere.id).sort((a, b) => b.data.localeCompare(a.data))[0];
  const capo = risorse.find((r) => r.id === cantiere.capocantiereId);

  return (
    <Pagina titolo={cantiere.nome}>
      <p>
        <EtichettaCantiere stato={cantiere.stato} /> {progetto && <Link to={`/progetti/${progetto.id}`}>{progetto.codice} · {progetto.nome}</Link>} ·{" "}
        {cantiere.indirizzo} · {dataIt(cantiere.dataInizio)} – {dataIt(cantiere.dataFinePrevista)}
        {capo && <> · Capocantiere: {capo.nome}</>}
      </p>
      <div className="indicatori">
        <div>
          <span>Avanzamento</span>
          <strong>{ultimo ? `${ultimo.avanzamento}%` : "—"}</strong>
        </div>
        <div>
          <span>Costo risorse stimato</span>
          <strong>{euro(costi.risorse)}</strong>
        </div>
        <div>
          <span>Smaltimento (FIR)</span>
          <strong>{euro(costi.smaltimento)}</strong>
        </div>
      </div>
      <nav className="schede-filtro">
        {SCHEDE.map((s) => (
          <button key={s} className={scheda === s ? "attivo" : ""} onClick={() => setParams({ s })}>
            {TITOLI_SCHEDE[s]}
          </button>
        ))}
      </nav>
      {scheda === "risorse" && <Risorse cantiere={cantiere} />}
      {scheda === "giornale" && <Giornale cantiere={cantiere} />}
      {scheda === "fir" && <ElencoFirCantiere cantiere={cantiere} />}
      {scheda === "ddt" && <ElencoDdt cantiereId={cantiere.id} />}
    </Pagina>
  );
}
