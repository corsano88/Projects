import { useState } from "react";
import { useParams } from "react-router-dom";
import { CATEGORIE, scadenzeVicine } from "../domain/anagrafiche";
import { euro, oggi, dataIt } from "../domain/formato";
import { puo } from "../domain/permessi";
import type { CampoCustom, CategoriaRisorsa, Cliente, Risorsa, TipoCampo } from "../domain/types";
import { CATEGORIE_RISORSA, UNITA } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import type { DatiNuovi } from "../data/store";
import {
  AreaTesto,
  Errori,
  Etichetta,
  Importo,
  Modale,
  Pagina,
  Scelta,
  Testo,
  useAzione,
  Vuoto,
} from "../ui/componenti";

// ---------- Campi extra creati dall'utente ----------

function CampiExtra({
  categoria,
  valori,
  onCambia,
}: {
  categoria: CategoriaRisorsa | "clienti";
  valori: Record<string, string>;
  onCambia: (v: Record<string, string>) => void;
}) {
  const campi = (useCollezione("campiCustom") ?? []).filter((c) => c.categoria === categoria);
  if (!campi.length) return null;
  return (
    <>
      {campi.map((c) => (
        <Testo
          key={c.id}
          etichetta={c.etichetta}
          tipo={c.tipo === "numero" ? "number" : c.tipo === "data" ? "date" : "text"}
          valore={valori[c.id] ?? ""}
          onCambia={(v) => onCambia({ ...valori, [c.id]: v })}
        />
      ))}
    </>
  );
}

function GestioneCampiExtra({ categoria, onChiudi }: { categoria: CategoriaRisorsa | "clienti"; onChiudi: () => void }) {
  const { db } = useSessione();
  const campi = (useCollezione("campiCustom") ?? []).filter((c) => c.categoria === categoria);
  const [etichetta, setEtichetta] = useState("");
  const [tipo, setTipo] = useState<TipoCampo>("testo");
  const { errori, esegui } = useAzione();
  return (
    <Modale titolo="Campi extra" onChiudi={onChiudi}>
      <p className="nota">Aggiungi i campi che ti servono e che non sono già previsti. Compaiono nella scheda di ogni voce.</p>
      <ul className="elenco">
        {campi.map((c: CampoCustom) => (
          <li key={c.id}>
            {c.etichetta} <Etichetta>{c.tipo}</Etichetta>
            <button className="link" onClick={() => void esegui(() => db.elimina("campiCustom", c.id))}>
              Elimina
            </button>
          </li>
        ))}
      </ul>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          if (!etichetta.trim()) return;
          void esegui(() => db.crea("campiCustom", { categoria, etichetta: etichetta.trim(), tipo })).then(
            (ok) => ok && setEtichetta(""),
          );
        }}
      >
        <Testo etichetta="Nome del campo" valore={etichetta} onCambia={setEtichetta} />
        <Scelta
          etichetta="Tipo"
          valore={tipo}
          onCambia={setTipo}
          opzioni={[
            { valore: "testo", etichetta: "Testo" },
            { valore: "numero", etichetta: "Numero" },
            { valore: "data", etichetta: "Data" },
          ]}
        />
        <Errori errori={errori} />
        <div className="piede">
          <button className="primario" type="submit">
            Aggiungi campo
          </button>
        </div>
      </form>
    </Modale>
  );
}

// ---------- Clienti ----------

const CLIENTE_VUOTO: DatiNuovi<"clienti"> = {
  ragioneSociale: "",
  partitaIva: "",
  codiceFiscale: "",
  indirizzo: "",
  email: "",
  telefono: "",
  referente: "",
  note: "",
};

export function FormCliente({ cliente, onChiudi }: { cliente?: Cliente; onChiudi: (id?: string) => void }) {
  const { db } = useSessione();
  const [d, setD] = useState<DatiNuovi<"clienti"> & { extra?: Record<string, string> }>(
    cliente ? { ...cliente } : { ...CLIENTE_VUOTO },
  );
  const { errori, setErrori, esegui, inCorso } = useAzione();
  const set = <K extends keyof typeof d>(k: K) => (v: (typeof d)[K]) => setD({ ...d, [k]: v });
  return (
    <Modale titolo={cliente ? "Modifica cliente" : "Nuovo cliente"} onChiudi={() => onChiudi()}>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          if (!d.ragioneSociale.trim()) return setErrori(["Inserisci la ragione sociale o il nome."]);
          void esegui(async () => {
            if (cliente) {
              await db.aggiorna("clienti", cliente.id, d);
              onChiudi(cliente.id);
            } else onChiudi((await db.crea("clienti", d)).id);
          });
        }}
      >
        <Testo etichetta="Ragione sociale / nome" obbligatorio largo valore={d.ragioneSociale} onCambia={set("ragioneSociale")} />
        <Testo etichetta="Partita IVA" valore={d.partitaIva} onCambia={set("partitaIva")} />
        <Testo etichetta="Codice fiscale" valore={d.codiceFiscale} onCambia={set("codiceFiscale")} />
        <Testo etichetta="Indirizzo" largo valore={d.indirizzo} onCambia={set("indirizzo")} />
        <Testo etichetta="Email" tipo="email" valore={d.email} onCambia={set("email")} />
        <Testo etichetta="Telefono" tipo="tel" valore={d.telefono} onCambia={set("telefono")} />
        <Testo etichetta="Referente" valore={d.referente} onCambia={set("referente")} />
        <CampiExtra categoria="clienti" valori={d.extra ?? {}} onCambia={(extra) => setD({ ...d, extra })} />
        <AreaTesto etichetta="Note" valore={d.note} onCambia={set("note")} />
        <Errori errori={errori} />
        <div className="piede">
          <button type="button" onClick={() => onChiudi()}>
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

export function Clienti() {
  const { utente } = useSessione();
  const clienti = useCollezione("clienti");
  const trattative = useCollezione("trattative") ?? [];
  const [modifica, setModifica] = useState<Cliente | "nuovo" | null>(null);
  const [extra, setExtra] = useState(false);
  const [cerca, setCerca] = useState("");
  const scrive = puo(utente.ruolo, "anagrafiche", "scrivi");
  const filtrati = (clienti ?? [])
    .filter((c) => (c.ragioneSociale + c.partitaIva + c.referente).toLowerCase().includes(cerca.toLowerCase()))
    .sort((a, b) => a.ragioneSociale.localeCompare(b.ragioneSociale));
  return (
    <Pagina
      titolo="Clienti"
      azioni={
        scrive && (
          <>
            <button onClick={() => setExtra(true)}>Campi extra</button>
            <button className="primario" onClick={() => setModifica("nuovo")}>
              + Nuovo cliente
            </button>
          </>
        )
      }
    >
      <input className="cerca" placeholder="Cerca…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      {clienti && !filtrati.length && <Vuoto>Nessun cliente.</Vuoto>}
      {!!filtrati.length && (
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>P. IVA</th>
              <th>Referente</th>
              <th>Contatti</th>
              <th>Trattative</th>
            </tr>
          </thead>
          <tbody>
            {filtrati.map((c) => (
              <tr key={c.id} className={scrive ? "cliccabile" : ""} onClick={() => scrive && setModifica(c)}>
                <td>{c.ragioneSociale}</td>
                <td>{c.partitaIva}</td>
                <td>{c.referente}</td>
                <td>{[c.telefono, c.email].filter(Boolean).join(" · ")}</td>
                <td>{trattative.filter((t) => t.clienteId === c.id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modifica && <FormCliente cliente={modifica === "nuovo" ? undefined : modifica} onChiudi={() => setModifica(null)} />}
      {extra && <GestioneCampiExtra categoria="clienti" onChiudi={() => setExtra(false)} />}
    </Pagina>
  );
}

// ---------- Mezzi, attrezzature, dipendenti, materiali, subappaltatori ----------

function risorsaVuota(categoria: CategoriaRisorsa): DatiNuovi<"risorse"> {
  return {
    categoria,
    nome: "",
    codice: "",
    costoUnitario: 0,
    unita: CATEGORIE[categoria].unitaPredefinita,
    attiva: true,
    campi: {},
    extra: {},
    certificazioni: [],
    ...(categoria === "dipendenti" ? { priorita: 2 as const } : {}),
  };
}

function FormRisorsa({ categoria, risorsa, onChiudi }: { categoria: CategoriaRisorsa; risorsa?: Risorsa; onChiudi: () => void }) {
  const { db } = useSessione();
  const def = CATEGORIE[categoria];
  const [d, setD] = useState<DatiNuovi<"risorse">>(risorsa ? { ...risorsa } : risorsaVuota(categoria));
  const { errori, setErrori, esegui, inCorso } = useAzione();
  return (
    <Modale titolo={risorsa ? `Modifica ${def.singolare.toLowerCase()}` : `Nuovo: ${def.singolare.toLowerCase()}`} onChiudi={onChiudi} largo>
      <form
        className="griglia"
        onSubmit={(e) => {
          e.preventDefault();
          if (!d.nome.trim()) return setErrori(["Inserisci il nome."]);
          void esegui(async () => {
            if (risorsa) await db.aggiorna("risorse", risorsa.id, d);
            else await db.crea("risorse", d);
            onChiudi();
          });
        }}
      >
        <Testo etichetta="Nome" obbligatorio valore={d.nome} onCambia={(nome) => setD({ ...d, nome })} />
        <Testo etichetta="Codice interno" valore={d.codice} onCambia={(codice) => setD({ ...d, codice })} />
        <Importo etichetta="Costo unitario" valore={d.costoUnitario} onCambia={(costoUnitario) => setD({ ...d, costoUnitario })} />
        <Scelta
          etichetta="Unità di costo"
          valore={d.unita}
          onCambia={(unita) => setD({ ...d, unita })}
          opzioni={UNITA.map((u) => ({ valore: u, etichetta: u }))}
        />
        {def.campi.map((c) => (
          <Testo
            key={c.chiave}
            etichetta={c.etichetta}
            tipo={c.tipo === "data" ? "date" : c.tipo === "numero" ? "number" : "text"}
            valore={d.campi[c.chiave] ?? ""}
            onCambia={(v) => setD({ ...d, campi: { ...d.campi, [c.chiave]: v } })}
          />
        ))}
        {categoria === "dipendenti" && (
          <>
            <Scelta
              etichetta="Priorità"
              valore={String(d.priorita ?? 2) as "1" | "2" | "3"}
              onCambia={(v) => setD({ ...d, priorita: Number(v) as 1 | 2 | 3 })}
              opzioni={[
                { valore: "1", etichetta: "Alta" },
                { valore: "2", etichetta: "Media" },
                { valore: "3", etichetta: "Bassa" },
              ]}
            />
            <fieldset className="largo">
              <legend>Certificazioni</legend>
              {d.certificazioni.map((c, i) => (
                <div className="riga-campi" key={i}>
                  <input
                    placeholder="Es. Patentino escavatore, Corso sicurezza 81/08"
                    value={c.nome}
                    onChange={(e) =>
                      setD({ ...d, certificazioni: d.certificazioni.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })
                    }
                  />
                  <input
                    type="date"
                    aria-label="Scadenza"
                    value={c.scadenza}
                    onChange={(e) =>
                      setD({ ...d, certificazioni: d.certificazioni.map((x, j) => (j === i ? { ...x, scadenza: e.target.value } : x)) })
                    }
                  />
                  <button type="button" onClick={() => setD({ ...d, certificazioni: d.certificazioni.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setD({ ...d, certificazioni: [...d.certificazioni, { nome: "", scadenza: "" }] })}>
                + Certificazione
              </button>
            </fieldset>
          </>
        )}
        <CampiExtra categoria={categoria} valori={d.extra} onCambia={(extra) => setD({ ...d, extra })} />
        <label className="spunta largo">
          <input type="checkbox" checked={d.attiva} onChange={(e) => setD({ ...d, attiva: e.target.checked })} />
          Attiva (si può assegnare ai cantieri)
        </label>
        <Errori errori={errori} />
        <div className="piede">
          {risorsa && (
            <button
              type="button"
              className="pericolo"
              onClick={() => confirm("Eliminare questa voce?") && void esegui(async () => (await db.elimina("risorse", risorsa.id), onChiudi()))}
            >
              Elimina
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

export function Risorse() {
  const categoria = useParams().categoria as CategoriaRisorsa;
  const { utente } = useSessione();
  const risorse = useCollezione("risorse");
  const allocazioni = useCollezione("allocazioni") ?? [];
  const cantieri = useCollezione("cantieri") ?? [];
  const [modifica, setModifica] = useState<Risorsa | "nuovo" | null>(null);
  const [extra, setExtra] = useState(false);
  const [cerca, setCerca] = useState("");
  if (!CATEGORIE_RISORSA.includes(categoria)) return <Vuoto>Anagrafica non trovata.</Vuoto>;
  const def = CATEGORIE[categoria];
  const scrive = puo(utente.ruolo, "anagrafiche", "scrivi");
  const g = oggi();
  const elenco = (risorse ?? [])
    .filter((r) => r.categoria === categoria && (r.nome + r.codice).toLowerCase().includes(cerca.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <Pagina
      key={categoria}
      titolo={def.titolo}
      azioni={
        scrive && (
          <>
            <button onClick={() => setExtra(true)}>Campi extra</button>
            <button className="primario" onClick={() => setModifica("nuovo")}>
              + {def.singolare}
            </button>
          </>
        )
      }
    >
      <input className="cerca" placeholder="Cerca…" value={cerca} onChange={(e) => setCerca(e.target.value)} />
      {risorse && !elenco.length && <Vuoto>Nessuna voce in {def.titolo.toLowerCase()}.</Vuoto>}
      {!!elenco.length && (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Codice</th>
              {def.campi.slice(0, 2).map((c) => (
                <th key={c.chiave}>{c.etichetta}</th>
              ))}
              <th>Costo</th>
              <th>Oggi</th>
              <th>Scadenze</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((r) => {
              const scad = scadenzeVicine(r.campi, r.certificazioni, def, g);
              const oggiIn = allocazioni.filter((a) => a.risorsaId === r.id && a.dal <= g && g <= a.al);
              return (
                <tr key={r.id} className={`${scrive ? "cliccabile" : ""} ${r.attiva ? "" : "spenta"}`} onClick={() => scrive && setModifica(r)}>
                  <td>
                    {r.nome}
                    {r.priorita === 1 && <Etichetta tono="info">priorità alta</Etichetta>}
                  </td>
                  <td>{r.codice}</td>
                  {def.campi.slice(0, 2).map((c) => (
                    <td key={c.chiave}>{c.tipo === "data" ? dataIt(r.campi[c.chiave] ?? "") : r.campi[c.chiave]}</td>
                  ))}
                  <td>
                    {euro(r.costoUnitario)}/{r.unita}
                  </td>
                  <td>
                    {oggiIn.length
                      ? oggiIn.map((a) => cantieri.find((c) => c.id === a.cantiereId)?.nome ?? "?").join(", ")
                      : categoria === "materiali" || categoria === "subappaltatori"
                        ? ""
                        : <Etichetta tono="ok">libero</Etichetta>}
                  </td>
                  <td>
                    {scad.map((s) => (
                      <Etichetta key={s.nome} tono={s.scaduta ? "male" : "attenzione"}>
                        {s.nome} {dataIt(s.scadenza)}
                      </Etichetta>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {modifica && (
        <FormRisorsa categoria={categoria} risorsa={modifica === "nuovo" ? undefined : modifica} onChiudi={() => setModifica(null)} />
      )}
      {extra && <GestioneCampiExtra categoria={categoria} onChiudi={() => setExtra(false)} />}
    </Pagina>
  );
}
