import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { dataIt, euro } from "../domain/formato";
import { puo } from "../domain/permessi";
import { CON_MOTIVO, ETICHETTE_STATO, FLUSSO, statiSuccessivi } from "../domain/trattative";
import type { StatoTrattativa, Trattativa } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import type { DatiNuovi } from "../data/store";
import { AreaTesto, Errori, Etichetta, Importo, Modale, Pagina, Scelta, Testo, useAzione, Vuoto } from "../ui/componenti";
import { FormCliente } from "./Anagrafiche";

const TONO: Partial<Record<StatoTrattativa, string>> = {
  contratto_firmato: "ok",
  in_corso: "info",
  chiuso: "neutro",
  perso: "male",
  stand_by: "attenzione",
};

export function EtichettaStato({ stato }: { stato: StatoTrattativa }) {
  return <Etichetta tono={TONO[stato] ?? "neutro"}>{ETICHETTE_STATO[stato]}</Etichetta>;
}

const VUOTA: DatiNuovi<"trattative"> = {
  clienteId: "",
  titolo: "",
  descrizione: "",
  indirizzoLavori: "",
  stato: "potenziale",
  motivo: "",
  valoreStimato: 0,
  sopralluogo: { data: "", note: "" },
  preventivo: { numero: "", data: "", importo: 0, computoMetrico: "" },
  contratto: { dataFirma: "", importo: 0 },
  storico: [],
};

function SchedaTrattativa({ trattativa, onChiudi }: { trattativa?: Trattativa; onChiudi: () => void }) {
  const { db, utente } = useSessione();
  const navigate = useNavigate();
  const clienti = useCollezione("clienti") ?? [];
  const [d, setD] = useState<DatiNuovi<"trattative">>(trattativa ? { ...trattativa } : { ...VUOTA });
  const [nuovoCliente, setNuovoCliente] = useState(false);
  const [motivo, setMotivo] = useState("");
  const { errori, setErrori, esegui, inCorso } = useAzione();
  const scrive = puo(utente.ruolo, "trattative", "scrivi");

  const verifica = () => {
    const e: string[] = [];
    if (!d.clienteId) e.push("Scegli il cliente.");
    if (!d.titolo.trim()) e.push("Inserisci un titolo.");
    setErrori(e);
    return !e.length;
  };

  const salva = () =>
    esegui(async () => {
      if (trattativa) {
        // Lo stato cambia solo con i pulsanti dedicati, che controllano i passaggi.
        const { stato: _s, storico: _st, motivo: _m, statoPrecedente: _p, progettoId: _pr, ...campi } = d;
        await db.aggiorna("trattative", trattativa.id, campi);
      } else {
        await db.crea("trattative", {
          ...d,
          storico: [{ da: null, a: "potenziale", data: new Date().toISOString(), utente: utente.id }],
        });
      }
    });

  const cambia = (a: StatoTrattativa) =>
    esegui(async () => {
      if (!trattativa) return;
      // Prima salva i campi (es. importo del contratto), poi cambia stato con i dati aggiornati.
      const { stato: _s, storico: _st, motivo: _m, statoPrecedente: _p, progettoId: _pr, ...campi } = d;
      await db.aggiorna("trattative", trattativa.id, campi);
      const progettoId = await db.cambiaStatoTrattativa({ ...trattativa, ...campi }, a, motivo);
      onChiudi();
      if (a === "contratto_firmato" && progettoId) navigate(`/progetti/${progettoId}`);
    });

  const set = <K extends keyof typeof d>(k: K) => (v: (typeof d)[K]) => setD({ ...d, [k]: v });
  const successivi = trattativa ? statiSuccessivi(trattativa) : [];

  return (
    <Modale titolo={trattativa ? trattativa.titolo : "Nuova trattativa"} onChiudi={onChiudi} largo>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          if (verifica()) void salva().then((ok) => ok && onChiudi());
        }}
      >
        <fieldset disabled={!scrive} className="largo griglia">
          <Scelta
            etichetta="Cliente *"
            valore={d.clienteId}
            onCambia={(v) => (v === "__nuovo" ? setNuovoCliente(true) : setD({ ...d, clienteId: v }))}
            vuota="Scegli…"
            opzioni={[
              ...clienti
                .sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale))
                .map((c) => ({ valore: c.id, etichetta: c.ragioneSociale })),
              { valore: "__nuovo", etichetta: "+ Nuovo cliente…" },
            ]}
          />
          <Testo etichetta="Titolo" obbligatorio valore={d.titolo} onCambia={set("titolo")} />
          <Testo etichetta="Indirizzo dei lavori" largo valore={d.indirizzoLavori} onCambia={set("indirizzoLavori")} />
          <Importo etichetta="Valore stimato" valore={d.valoreStimato} onCambia={set("valoreStimato")} />
          <AreaTesto etichetta="Descrizione" valore={d.descrizione} onCambia={set("descrizione")} />

          <h3 className="largo">Sopralluogo</h3>
          <Testo etichetta="Data" tipo="date" valore={d.sopralluogo.data} onCambia={(data) => setD({ ...d, sopralluogo: { ...d.sopralluogo, data } })} />
          <AreaTesto etichetta="Note del sopralluogo" valore={d.sopralluogo.note} onCambia={(note) => setD({ ...d, sopralluogo: { ...d.sopralluogo, note } })} />

          <h3 className="largo">Preventivo e computo metrico</h3>
          <Testo etichetta="Numero" valore={d.preventivo.numero} onCambia={(numero) => setD({ ...d, preventivo: { ...d.preventivo, numero } })} />
          <Testo etichetta="Data" tipo="date" valore={d.preventivo.data} onCambia={(data) => setD({ ...d, preventivo: { ...d.preventivo, data } })} />
          <Importo etichetta="Importo" valore={d.preventivo.importo} onCambia={(importo) => setD({ ...d, preventivo: { ...d.preventivo, importo } })} />
          <AreaTesto
            etichetta="Computo metrico (voci, quantità, prezzi)"
            valore={d.preventivo.computoMetrico}
            onCambia={(computoMetrico) => setD({ ...d, preventivo: { ...d.preventivo, computoMetrico } })}
          />

          <h3 className="largo">Contratto</h3>
          <Testo etichetta="Data firma" tipo="date" valore={d.contratto.dataFirma} onCambia={(dataFirma) => setD({ ...d, contratto: { ...d.contratto, dataFirma } })} />
          <Importo etichetta="Importo contratto" valore={d.contratto.importo} onCambia={(importo) => setD({ ...d, contratto: { ...d.contratto, importo } })} />
        </fieldset>

        {trattativa && (
          <div className="largo stato-trattativa">
            <h3>
              Stato: <EtichettaStato stato={trattativa.stato} />
              {trattativa.motivo && <span className="nota"> ({trattativa.motivo})</span>}
            </h3>
            {trattativa.progettoId && (
              <p>
                <Link to={`/progetti/${trattativa.progettoId}`} onClick={onChiudi}>
                  Apri il progetto →
                </Link>
              </p>
            )}
            {scrive && successivi.length > 0 && (
              <>
                {successivi.some((s) => CON_MOTIVO.includes(s)) && (
                  <Testo etichetta='Motivo (per "perso" o "stand by")' largo valore={motivo} onCambia={setMotivo} />
                )}
                <div className="pulsanti">
                  {successivi.map((s) => (
                    <button key={s} type="button" disabled={inCorso} className={s === "perso" ? "pericolo" : ""} onClick={() => void cambia(s)}>
                      → {ETICHETTE_STATO[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
            <details>
              <summary>Storico</summary>
              <ul className="elenco">
                {trattativa.storico.map((c, i) => (
                  <li key={i}>
                    {dataIt(c.data)} · {c.da ? `${ETICHETTE_STATO[c.da]} → ` : ""}
                    {ETICHETTE_STATO[c.a]}
                    {c.motivo ? ` (${c.motivo})` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        <Errori errori={errori} />
        <div className="piede">
          <button type="button" onClick={onChiudi}>
            Chiudi
          </button>
          {scrive && (
            <button className="primario" type="submit" disabled={inCorso}>
              Salva
            </button>
          )}
        </div>
      </form>
      {nuovoCliente && (
        <FormCliente
          onChiudi={(id) => {
            setNuovoCliente(false);
            if (id) setD((x) => ({ ...x, clienteId: id }));
          }}
        />
      )}
    </Modale>
  );
}

export function Trattative() {
  const { utente } = useSessione();
  const trattative = useCollezione("trattative");
  const clienti = useCollezione("clienti") ?? [];
  const [aperta, setAperta] = useState<Trattativa | "nuova" | null>(null);
  const [mostra, setMostra] = useState<"attive" | "perso" | "stand_by">("attive");
  const nomeCliente = (id: string) => clienti.find((c) => c.id === id)?.ragioneSociale ?? "—";

  const colonne: StatoTrattativa[] = mostra === "attive" ? FLUSSO : [mostra];
  const tutte = trattative ?? [];

  return (
    <Pagina
      titolo="Trattative"
      azioni={
        puo(utente.ruolo, "trattative", "scrivi") && (
          <button className="primario" onClick={() => setAperta("nuova")}>
            + Nuova trattativa
          </button>
        )
      }
    >
      <div className="schede-filtro">
        {(["attive", "stand_by", "perso"] as const).map((m) => (
          <button key={m} className={mostra === m ? "attivo" : ""} onClick={() => setMostra(m)}>
            {m === "attive" ? "Flusso" : ETICHETTE_STATO[m]} ({m === "attive" ? tutte.filter((t) => FLUSSO.includes(t.stato)).length : tutte.filter((t) => t.stato === m).length})
          </button>
        ))}
      </div>
      {trattative && !tutte.length && <Vuoto>Nessuna trattativa. Inizia con "Nuova trattativa".</Vuoto>}
      <div className="kanban">
        {colonne.map((s) => {
          const qui = tutte.filter((t) => t.stato === s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          return (
            <div className="colonna" key={s}>
              <h3>
                {ETICHETTE_STATO[s]} <span className="nota">{qui.length}</span>
              </h3>
              <p className="nota">{euro(qui.reduce((n, t) => n + (t.contratto.importo || t.preventivo.importo || t.valoreStimato), 0))}</p>
              {qui.map((t) => (
                <button className="carta" key={t.id} onClick={() => setAperta(t)}>
                  <strong>{t.titolo}</strong>
                  <span>{nomeCliente(t.clienteId)}</span>
                  <span className="nota">
                    {euro(t.contratto.importo || t.preventivo.importo || t.valoreStimato)}
                    {t.motivo && ` · ${t.motivo}`}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {aperta && <SchedaTrattativa trattativa={aperta === "nuova" ? undefined : aperta} onChiudi={() => setAperta(null)} />}
    </Pagina>
  );
}
