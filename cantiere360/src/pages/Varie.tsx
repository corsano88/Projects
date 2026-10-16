import { useState } from "react";
import { Link } from "react-router-dom";
import { CATEGORIE, scadenzeVicine } from "../domain/anagrafiche";
import { dataIt, euro, oggi } from "../domain/formato";
import { ETICHETTE_RUOLO, puo } from "../domain/permessi";
import { esportaRentriCsv } from "../domain/rentri";
import { ETICHETTE_STATO, FLUSSO } from "../domain/trattative";
import type { Fir, Ruolo } from "../domain/types";
import { RUOLI } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import { caricaDatiEsempio } from "../data/esempio";
import { Etichetta, Modale, Pagina, useAzione, Errori, Vuoto } from "../ui/componenti";
import { FormFir, TabellaFir } from "./Cantiere";

// ---------- Cruscotto ----------

export function Cruscotto() {
  const { db, utente } = useSessione();
  const trattative = useCollezione("trattative") ?? [];
  const cantieri = useCollezione("cantieri") ?? [];
  const risorse = useCollezione("risorse") ?? [];
  const fir = useCollezione("fir") ?? [];
  const ddt = useCollezione("ddt") ?? [];
  const clienti = useCollezione("clienti");
  const { errori, esegui, inCorso } = useAzione();
  const g = oggi();
  const scadenze = risorse
    .filter((r) => r.attiva)
    .flatMap((r) => scadenzeVicine(r.campi, r.certificazioni, CATEGORIE[r.categoria], g).map((s) => ({ ...s, risorsa: r })))
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const vuoto = clienti !== null && clienti.length === 0 && trattative.length === 0;

  return (
    <Pagina titolo="Cruscotto">
      {vuoto && db.store.modalita === "demo" && puo(utente.ruolo, "anagrafiche", "scrivi") && (
        <section className="riquadro">
          <p>Non ci sono ancora dati. Vuoi caricare qualche dato di esempio per provare il flusso?</p>
          <button className="primario" disabled={inCorso} onClick={() => void esegui(() => caricaDatiEsempio(db))}>
            Carica dati di esempio
          </button>
          <Errori errori={errori} />
        </section>
      )}
      {puo(utente.ruolo, "trattative") && <h2>Trattative</h2>}
      <div className="indicatori" hidden={!puo(utente.ruolo, "trattative")}>
        {FLUSSO.slice(0, 5).map((s) => {
          const qui = trattative.filter((t) => t.stato === s);
          return (
            <Link to="/trattative" key={s}>
              <span>{ETICHETTE_STATO[s]}</span>
              <strong>{qui.length}</strong>
              <span className="nota">{euro(qui.reduce((n, t) => n + (t.contratto.importo || t.preventivo.importo || t.valoreStimato), 0))}</span>
            </Link>
          );
        })}
      </div>
      <h2>Operatività</h2>
      <div className="indicatori">
        <Link to="/cantieri">
          <span>Cantieri aperti</span>
          <strong>{cantieri.filter((c) => c.stato === "aperto").length}</strong>
        </Link>
        <Link to="/ddt">
          <span>DDT in bozza</span>
          <strong>{ddt.filter((d) => d.stato === "bozza").length}</strong>
        </Link>
        <Link to="/fir">
          <span>FIR da caricare su RENTRI</span>
          <strong>{fir.filter((f) => !f.inviatoRentri).length}</strong>
        </Link>
      </div>
      <h2>Scadenze entro 30 giorni</h2>
      {!scadenze.length && <Vuoto>Nessuna scadenza vicina.</Vuoto>}
      {!!scadenze.length && (
        <table>
          <tbody>
            {scadenze.map((s, i) => (
              <tr key={i}>
                <td>
                  <Link to={`/anagrafiche/${s.risorsa.categoria}`}>{s.risorsa.nome}</Link>
                </td>
                <td>{s.nome}</td>
                <td>
                  <Etichetta tono={s.scaduta ? "male" : "attenzione"}>{dataIt(s.scadenza)}</Etichetta>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pagina>
  );
}

// ---------- FIR ed export RENTRI ----------

export function PaginaFir() {
  const { db, utente } = useSessione();
  const fir = useCollezione("fir");
  const cantieri = useCollezione("cantieri") ?? [];
  const [solo, setSolo] = useState(true);
  const [aperto, setAperto] = useState<Fir | null>(null);
  const { errori, esegui } = useAzione();
  const scrive = puo(utente.ruolo, "fir", "scrivi");
  const elenco = (fir ?? []).filter((f) => !solo || !f.inviatoRentri).sort((a, b) => b.data.localeCompare(a.data));
  const totKg = elenco.reduce((n, f) => n + f.quantitaKg, 0);
  const totCosto = elenco.reduce((n, f) => n + f.costoConferimento, 0);

  const esporta = () => {
    const csv = esportaRentriCsv(elenco, cantieri);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rentri-fir-${oggi()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Pagina
      titolo="FIR e RENTRI"
      azioni={
        <>
          <button disabled={!elenco.length} onClick={esporta}>
            Scarica file per RENTRI ({elenco.length})
          </button>
          {scrive && solo && (
            <button
              disabled={!elenco.length}
              onClick={() =>
                confirm(`Segnare ${elenco.length} FIR come caricati su RENTRI?`) &&
                void esegui(async () => {
                  for (const f of elenco) await db.aggiorna("fir", f.id, { inviatoRentri: true }, "caricato su RENTRI");
                })
              }
            >
              Segna come caricati
            </button>
          )}
        </>
      }
    >
      <p className="nota">
        I FIR si inseriscono dalla scheda di ogni cantiere. Qui scarichi il file da caricare sul portale RENTRI e, dopo il caricamento,
        li segni come caricati.
      </p>
      <div className="schede-filtro">
        <button className={solo ? "attivo" : ""} onClick={() => setSolo(true)}>
          Da caricare
        </button>
        <button className={!solo ? "attivo" : ""} onClick={() => setSolo(false)}>
          Tutti
        </button>
      </div>
      <Errori errori={errori} />
      {fir && !elenco.length && <Vuoto>Nessun FIR {solo ? "da caricare" : ""}.</Vuoto>}
      {!!elenco.length && (
        <>
          <p>
            Totale: <strong>{totKg.toLocaleString("it-IT")} kg</strong> · costo di conferimento <strong>{euro(totCosto)}</strong>
          </p>
          <TabellaFir fir={elenco} cantieri={cantieri} onApri={scrive ? setAperto : undefined} />
        </>
      )}
      {aperto && (
        <FormFir cantiere={cantieri.find((c) => c.id === aperto.cantiereId)!} fir={aperto} onChiudi={() => setAperto(null)} />
      )}
    </Pagina>
  );
}

// ---------- Registro modifiche ----------

export function Registro() {
  const audit = useCollezione("audit");
  const utenti = useCollezione("utenti") ?? [];
  const [limite, setLimite] = useState(100);
  const elenco = (audit ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Pagina titolo="Registro modifiche">
      <p className="nota">Ogni creazione, modifica e cambio di stato resta qui: chi, cosa, quando. Non si può modificare né cancellare.</p>
      {audit && !elenco.length && <Vuoto>Nessuna modifica registrata.</Vuoto>}
      {!!elenco.length && (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Chi</th>
              <th>Cosa</th>
              <th>Azione</th>
              <th>Dettagli</th>
            </tr>
          </thead>
          <tbody>
            {elenco.slice(0, limite).map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.createdAt).toLocaleString("it-IT")}</td>
                <td>{utenti.find((u) => u.id === e.createdBy)?.nome ?? e.createdBy}</td>
                <td>{e.entita}</td>
                <td>{e.azione}</td>
                <td>{e.dettagli}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {elenco.length > limite && <button onClick={() => setLimite(limite + 100)}>Mostra altri</button>}
    </Pagina>
  );
}

// ---------- Utenti (solo Firebase) ----------

export function Utenti() {
  const { db, utente } = useSessione();
  const utenti = useCollezione("utenti");
  const dipendenti = (useCollezione("risorse") ?? []).filter((r) => r.categoria === "dipendenti");
  const [info, setInfo] = useState(false);
  const { errori, esegui } = useAzione();
  return (
    <Pagina titolo="Utenti" azioni={<button onClick={() => setInfo(true)}>Come aggiungo un utente?</button>}>
      {db.store.modalita === "demo" && <p className="avviso">In modalità demo gli utenti non servono: il ruolo si sceglie all'accesso.</p>}
      <Errori errori={errori} />
      {utenti && !utenti.length && <Vuoto>Nessun utente.</Vuoto>}
      {!!utenti?.length && (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Email</th>
              <th>Ruolo</th>
              <th>Dipendente collegato</th>
              <th>Attivo</th>
            </tr>
          </thead>
          <tbody>
            {utenti.map((u) => (
              <tr key={u.id}>
                <td>{u.nome}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    value={u.ruolo}
                    disabled={u.id === utente.id}
                    aria-label="Ruolo"
                    onChange={(e) => void esegui(() => db.aggiorna("utenti", u.id, { ruolo: e.target.value as Ruolo }, `ruolo ${e.target.value}`))}
                  >
                    {RUOLI.map((r) => (
                      <option key={r} value={r}>
                        {ETICHETTE_RUOLO[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={u.dipendenteId ?? ""}
                    aria-label="Dipendente collegato"
                    onChange={(e) => void esegui(() => db.aggiorna("utenti", u.id, { dipendenteId: e.target.value || undefined }))}
                  >
                    <option value="">—</option>
                    {dipendenti.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="Attivo"
                    checked={u.attivo}
                    disabled={u.id === utente.id}
                    onChange={(e) => void esegui(() => db.aggiorna("utenti", u.id, { attivo: e.target.checked }, e.target.checked ? "attivato" : "disattivato"))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {info && (
        <Modale titolo="Aggiungere un utente" onChiudi={() => setInfo(false)}>
          <ol>
            <li>La persona apre l'app e sceglie "Crea un account" con la sua email.</li>
            <li>Compare qui come non attiva, con ruolo Operaio.</li>
            <li>Scegli il ruolo giusto e spunta "Attivo".</li>
          </ol>
        </Modale>
      )}
    </Pagina>
  );
}
