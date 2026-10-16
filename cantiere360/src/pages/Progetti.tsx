import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { riepilogoCosti } from "../domain/costi";
import { dataIt, euro, oggi } from "../domain/formato";
import { puo } from "../domain/permessi";
import type { Cantiere, Fattura, Progetto, StatoCantiere, TipoFattura } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import type { DatiNuovi } from "../data/store";
import { Errori, Etichetta, Importo, Modale, Pagina, Scelta, Testo, useAzione, Vuoto } from "../ui/componenti";
import { EtichettaStato } from "./Trattative";

export const ETICHETTE_CANTIERE: Record<StatoCantiere, string> = {
  pianificato: "Pianificato",
  aperto: "Aperto",
  chiuso: "Chiuso",
};

export function EtichettaCantiere({ stato }: { stato: StatoCantiere }) {
  return <Etichetta tono={stato === "aperto" ? "ok" : stato === "pianificato" ? "info" : "neutro"}>{ETICHETTE_CANTIERE[stato]}</Etichetta>;
}

export function Progetti() {
  const progetti = useCollezione("progetti");
  const clienti = useCollezione("clienti") ?? [];
  const cantieri = useCollezione("cantieri") ?? [];
  const [chiusi, setChiusi] = useState(false);
  const elenco = (progetti ?? []).filter((p) => (chiusi ? p.stato === "chiuso" : p.stato === "attivo")).sort((a, b) => b.codice.localeCompare(a.codice));
  return (
    <Pagina titolo="Progetti">
      <p className="nota">I progetti nascono dalle trattative quando passano a "Contratto firmato".</p>
      <div className="schede-filtro">
        <button className={!chiusi ? "attivo" : ""} onClick={() => setChiusi(false)}>
          Attivi
        </button>
        <button className={chiusi ? "attivo" : ""} onClick={() => setChiusi(true)}>
          Chiusi
        </button>
      </div>
      {progetti && !elenco.length && <Vuoto>Nessun progetto.</Vuoto>}
      {!!elenco.length && (
        <table>
          <thead>
            <tr>
              <th>Codice</th>
              <th>Progetto</th>
              <th>Cliente</th>
              <th>Cantieri</th>
              <th>Contratto</th>
              <th>Fatturato</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/progetti/${p.id}`}>{p.codice}</Link>
                </td>
                <td>{p.nome}</td>
                <td>{clienti.find((c) => c.id === p.clienteId)?.ragioneSociale}</td>
                <td>{cantieri.filter((c) => c.progettoId === p.id).length}</td>
                <td>{euro(p.importoContratto)}</td>
                <td>{euro(p.fatture.reduce((n, f) => n + f.importo, 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pagina>
  );
}

function FormCantiere({
  progetto,
  cantiere,
  indirizzo,
  onChiudi,
}: {
  progetto: Progetto;
  cantiere?: Cantiere;
  /** Indirizzo dei lavori della trattativa, proposto per il nuovo cantiere. */
  indirizzo: string;
  onChiudi: () => void;
}) {
  const { db } = useSessione();
  const dipendenti = (useCollezione("risorse") ?? []).filter((r) => r.categoria === "dipendenti" && r.attiva);
  const [d, setD] = useState<DatiNuovi<"cantieri">>(
    cantiere
      ? { ...cantiere }
      : {
          progettoId: progetto.id,
          clienteId: progetto.clienteId,
          nome: "",
          indirizzo,
          dataInizio: oggi(),
          dataFinePrevista: "",
          stato: "pianificato",
        },
  );
  const { errori, setErrori, esegui, inCorso } = useAzione();
  return (
    <Modale titolo={cantiere ? "Modifica cantiere" : "Nuovo cantiere"} onChiudi={onChiudi}>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          const err = [];
          if (!d.nome.trim()) err.push("Inserisci il nome del cantiere.");
          if (d.dataFinePrevista && d.dataFinePrevista < d.dataInizio) err.push("La fine prevista è prima dell'inizio.");
          if (err.length) return setErrori(err);
          void esegui(async () => {
            if (cantiere) await db.aggiorna("cantieri", cantiere.id, d);
            else await db.crea("cantieri", d);
            onChiudi();
          });
        }}
      >
        <Testo etichetta="Nome" obbligatorio valore={d.nome} onCambia={(nome) => setD({ ...d, nome })} />
        <Scelta
          etichetta="Stato"
          valore={d.stato}
          onCambia={(stato) => setD({ ...d, stato })}
          opzioni={(Object.keys(ETICHETTE_CANTIERE) as StatoCantiere[]).map((s) => ({ valore: s, etichetta: ETICHETTE_CANTIERE[s] }))}
        />
        <Testo etichetta="Indirizzo" largo valore={d.indirizzo} onCambia={(indirizzo) => setD({ ...d, indirizzo })} />
        <Testo etichetta="Inizio" tipo="date" valore={d.dataInizio} onCambia={(dataInizio) => setD({ ...d, dataInizio })} />
        <Testo etichetta="Fine prevista" tipo="date" valore={d.dataFinePrevista} onCambia={(dataFinePrevista) => setD({ ...d, dataFinePrevista })} />
        <Scelta
          etichetta="Capocantiere"
          valore={d.capocantiereId ?? ""}
          onCambia={(capocantiereId) => setD({ ...d, capocantiereId: capocantiereId || undefined })}
          vuota="—"
          opzioni={dipendenti.map((r) => ({ valore: r.id, etichetta: r.nome }))}
        />
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

const ETICHETTE_FATTURA: Record<TipoFattura, string> = { acconto: "Acconto", sal: "SAL", saldo: "Saldo" };

function Fatture({ progetto, scrive }: { progetto: Progetto; scrive: boolean }) {
  const { db } = useSessione();
  const [nuova, setNuova] = useState<Fattura>({ numero: "", data: oggi(), tipo: "sal", importo: 0, pagata: false });
  const [chiave, setChiave] = useState(0);
  const { errori, setErrori, esegui } = useAzione();
  const salva = (fatture: Fattura[]) => esegui(() => db.aggiorna("progetti", progetto.id, { fatture }, "fatture"));
  const fatturato = progetto.fatture.reduce((n, f) => n + f.importo, 0);
  const incassato = progetto.fatture.filter((f) => f.pagata).reduce((n, f) => n + f.importo, 0);
  return (
    <section className="riquadro">
      <h2>Fatture</h2>
      <p className="nota">
        Contratto {euro(progetto.importoContratto)} · fatturato {euro(fatturato)} · incassato {euro(incassato)} · da fatturare{" "}
        {euro(progetto.importoContratto - fatturato)}
      </p>
      {!!progetto.fatture.length && (
        <table>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data</th>
              <th>Tipo</th>
              <th>Importo</th>
              <th>Pagata</th>
            </tr>
          </thead>
          <tbody>
            {progetto.fatture.map((f, i) => (
              <tr key={i}>
                <td>{f.numero}</td>
                <td>{dataIt(f.data)}</td>
                <td>{ETICHETTE_FATTURA[f.tipo]}</td>
                <td>{euro(f.importo)}</td>
                <td>
                  <input
                    type="checkbox"
                    disabled={!scrive}
                    checked={f.pagata}
                    aria-label="Pagata"
                    onChange={(e) => void salva(progetto.fatture.map((x, j) => (j === i ? { ...x, pagata: e.target.checked } : x)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {scrive && (
        <form
          className="riga-campi"
          key={chiave}
          onSubmit={(e) => {
            e.preventDefault();
            if (!nuova.numero.trim() || !(nuova.importo > 0)) return setErrori(["Inserisci numero e importo della fattura."]);
            void salva([...progetto.fatture, nuova]).then((ok) => {
              if (ok) {
                setNuova({ ...nuova, numero: "", importo: 0 });
                setChiave((k) => k + 1);
              }
            });
          }}
        >
          <Testo etichetta="Numero" valore={nuova.numero} onCambia={(numero) => setNuova({ ...nuova, numero })} />
          <Testo etichetta="Data" tipo="date" valore={nuova.data} onCambia={(data) => setNuova({ ...nuova, data })} />
          <Scelta
            etichetta="Tipo"
            valore={nuova.tipo}
            onCambia={(tipo) => setNuova({ ...nuova, tipo })}
            opzioni={(Object.keys(ETICHETTE_FATTURA) as TipoFattura[]).map((t) => ({ valore: t, etichetta: ETICHETTE_FATTURA[t] }))}
          />
          <Importo etichetta="Importo" valore={nuova.importo} onCambia={(importo) => setNuova({ ...nuova, importo })} />
          <button type="submit">+ Fattura</button>
        </form>
      )}
      <Errori errori={errori} />
    </section>
  );
}

export function DettaglioProgetto() {
  const { id } = useParams();
  const { utente } = useSessione();
  const progetti = useCollezione("progetti");
  const cantieri = useCollezione("cantieri") ?? [];
  const clienti = useCollezione("clienti") ?? [];
  const trattative = useCollezione("trattative") ?? [];
  const allocazioni = useCollezione("allocazioni") ?? [];
  const risorse = useCollezione("risorse") ?? [];
  const fir = useCollezione("fir") ?? [];
  const [modifica, setModifica] = useState<Cantiere | "nuovo" | null>(null);
  const progetto = progetti?.find((p) => p.id === id);
  if (!progetti) return null;
  if (!progetto) return <Vuoto>Progetto non trovato.</Vuoto>;
  const scrive = puo(utente.ruolo, "progetti", "scrivi");
  const suoiCantieri = cantieri.filter((c) => c.progettoId === progetto.id);
  const trattativa = trattative.find((t) => t.id === progetto.trattativaId);
  const costi = riepilogoCosti(
    allocazioni.filter((a) => a.progettoId === progetto.id),
    risorse,
    fir.filter((f) => suoiCantieri.some((c) => c.id === f.cantiereId)),
  );

  return (
    <Pagina
      titolo={`${progetto.codice} · ${progetto.nome}`}
      azioni={
        scrive && (
          <button className="primario" onClick={() => setModifica("nuovo")}>
            + Cantiere
          </button>
        )
      }
    >
      <p>
        Cliente: <strong>{clienti.find((c) => c.id === progetto.clienteId)?.ragioneSociale}</strong>
        {trattativa && (
          <>
            {" "}
            · Trattativa: <EtichettaStato stato={trattativa.stato} />
          </>
        )}
      </p>
      <div className="indicatori">
        <div>
          <span>Contratto</span>
          <strong>{euro(progetto.importoContratto)}</strong>
        </div>
        <div>
          <span>Costo risorse stimato</span>
          <strong>{euro(costi.risorse)}</strong>
        </div>
        <div>
          <span>Smaltimento (FIR)</span>
          <strong>{euro(costi.smaltimento)}</strong>
        </div>
        <div>
          <span>Margine stimato</span>
          <strong>{euro(progetto.importoContratto - costi.totale)}</strong>
        </div>
      </div>

      <section className="riquadro">
        <h2>Cantieri</h2>
        {!suoiCantieri.length && <Vuoto>Nessun cantiere. Il progetto si divide in cantieri: aggiungine uno per allocare le risorse.</Vuoto>}
        {!!suoiCantieri.length && (
          <table>
            <thead>
              <tr>
                <th>Cantiere</th>
                <th>Stato</th>
                <th>Indirizzo</th>
                <th>Periodo</th>
                <th>Risorse allocate</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {suoiCantieri.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/cantieri/${c.id}`}>{c.nome}</Link>
                  </td>
                  <td>
                    <EtichettaCantiere stato={c.stato} />
                  </td>
                  <td>{c.indirizzo}</td>
                  <td>
                    {dataIt(c.dataInizio)} – {dataIt(c.dataFinePrevista)}
                  </td>
                  <td>{allocazioni.filter((a) => a.cantiereId === c.id).length}</td>
                  <td>
                    {scrive && (
                      <button className="link" onClick={() => setModifica(c)}>
                        Modifica
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Fatture progetto={progetto} scrive={scrive} />

      {modifica && <FormCantiere
          progetto={progetto}
          cantiere={modifica === "nuovo" ? undefined : modifica}
          indirizzo={trattativa?.indirizzoLavori ?? ""}
          onChiudi={() => setModifica(null)}
        />}
    </Pagina>
  );
}

export function Cantieri() {
  const cantieri = useCollezione("cantieri");
  const progetti = useCollezione("progetti") ?? [];
  const clienti = useCollezione("clienti") ?? [];
  const [stato, setStato] = useState<StatoCantiere | "">("aperto");
  const elenco = (cantieri ?? []).filter((c) => !stato || c.stato === stato).sort((a, b) => a.nome.localeCompare(b.nome));
  return (
    <Pagina titolo="Cantieri">
      <div className="schede-filtro">
        {(["aperto", "pianificato", "chiuso", ""] as const).map((s) => (
          <button key={s} className={stato === s ? "attivo" : ""} onClick={() => setStato(s)}>
            {s ? ETICHETTE_CANTIERE[s] : "Tutti"}
          </button>
        ))}
      </div>
      {cantieri && !elenco.length && <Vuoto>Nessun cantiere. I cantieri si creano dalla scheda del progetto.</Vuoto>}
      {!!elenco.length && (
        <table>
          <thead>
            <tr>
              <th>Cantiere</th>
              <th>Stato</th>
              <th>Progetto</th>
              <th>Cliente</th>
              <th>Indirizzo</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/cantieri/${c.id}`}>{c.nome}</Link>
                </td>
                <td>
                  <EtichettaCantiere stato={c.stato} />
                </td>
                <td>{progetti.find((p) => p.id === c.progettoId)?.codice}</td>
                <td>{clienti.find((x) => x.id === c.clienteId)?.ragioneSociale}</td>
                <td>{c.indirizzo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pagina>
  );
}
