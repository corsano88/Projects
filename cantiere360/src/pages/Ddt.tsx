import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CATEGORIE } from "../domain/anagrafiche";
import { attiveIl } from "../domain/allocazioni";
import { dataIt, oggi } from "../domain/formato";
import { puo } from "../domain/permessi";
import type { Cantiere, Ddt, RigaDdt } from "../domain/types";
import { UNITA } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import { AreaTesto, Errori, Etichetta, Firma, Foto, Scelta, Testo, useAzione, Vuoto } from "../ui/componenti";

/** Righe del DDT precompilate con le risorse allocate al cantiere in quel giorno. */
function righePrecompilate(
  cantiereId: string,
  giorno: string,
  allocazioni: ReturnType<typeof useCollezione<"allocazioni">>,
  risorse: ReturnType<typeof useCollezione<"risorse">>,
): RigaDdt[] {
  return attiveIl(allocazioni ?? [], cantiereId, giorno).flatMap((a) => {
    const r = (risorse ?? []).find((x) => x.id === a.risorsaId);
    if (!r) return [];
    return [
      {
        risorsaId: r.id,
        categoria: r.categoria,
        descrizione: [r.nome, r.codice, r.campi.targa].filter(Boolean).join(" · "),
        quantita: a.quantita,
        unita: r.categoria === "materiali" ? r.unita : "pezzo",
      },
    ];
  });
}

/**
 * Compilazione del DDT, pensata per il telefono: cantiere, righe precompilate, firma e foto.
 * Usata sia dalla webapp mobile sia dalla scheda cantiere.
 */
export function FormDdt({ cantieri, cantiereIniziale, onFatto }: { cantieri: Cantiere[]; cantiereIniziale?: string; onFatto: (ddt: Ddt) => void }) {
  const { db, utente } = useSessione();
  const allocazioni = useCollezione("allocazioni");
  const risorse = useCollezione("risorse");
  const [cantiereId, setCantiereId] = useState(cantiereIniziale ?? (cantieri.length === 1 ? cantieri[0].id : ""));
  const [data, setData] = useState(oggi());
  const cantiere = cantieri.find((c) => c.id === cantiereId);
  const [causale, setCausale] = useState("Trasferimento a cantiere");
  const [destinazione, setDestinazione] = useState(cantiere?.indirizzo ?? "");
  const [righe, setRighe] = useState<RigaDdt[] | null>(null);
  const [note, setNote] = useState("");
  const [firmatario, setFirmatario] = useState(utente.nome);
  const [firma, setFirma] = useState("");
  const [foto, setFoto] = useState<string[]>([]);
  const { errori, setErrori, esegui, inCorso } = useAzione();

  // Finché l'utente non tocca le righe, restano allineate alle allocazioni del giorno.
  const righeMostrate = righe ?? (cantiereId && allocazioni && risorse ? righePrecompilate(cantiereId, data, allocazioni, risorse) : []);
  const setRiga = (i: number, r: Partial<RigaDdt>) => setRighe(righeMostrate.map((x, j) => (j === i ? { ...x, ...r } : x)));

  const salva = () => {
    const err: string[] = [];
    if (!cantiere) err.push("Scegli il cantiere.");
    const valide = righeMostrate.filter((r) => r.descrizione.trim() && r.quantita > 0);
    if (!valide.length) err.push("Aggiungi almeno una riga.");
    if (firma && !firmatario.trim()) err.push("Scrivi il nome di chi firma.");
    if (err.length) return setErrori(err);
    void esegui(async () => {
      const ddt = await db.nuovoDdt({
        cantiereId: cantiere!.id,
        progettoId: cantiere!.progettoId,
        data,
        causale,
        destinazione,
        righe: valide,
        note,
        firmatario: "",
        firma: "",
        foto: [],
        stato: "bozza",
      });
      if (firma) await db.firmaDdt(ddt, firmatario, firma, foto);
      else await db.aggiungiFotoDdt(ddt, foto);
      onFatto(ddt);
    });
  };

  return (
    <form
      className="griglia form-ddt"
      onSubmit={(e) => {
        e.preventDefault();
        salva();
      }}
    >
      <Scelta
        etichetta="Cantiere"
        valore={cantiereId}
        onCambia={(id) => {
          setCantiereId(id);
          setRighe(null);
          setDestinazione(cantieri.find((c) => c.id === id)?.indirizzo ?? "");
        }}
        vuota="Scegli…"
        opzioni={cantieri.map((c) => ({ valore: c.id, etichetta: c.nome }))}
      />
      <Testo
        etichetta="Data"
        tipo="date"
        valore={data}
        onCambia={(v) => {
          setData(v);
          setRighe(null);
        }}
      />
      <Testo etichetta="Causale" valore={causale} onCambia={setCausale} />
      <Testo etichetta="Destinazione" valore={destinazione} onCambia={setDestinazione} />

      <fieldset className="largo righe-ddt">
        <legend>Risorse e attrezzature</legend>
        {cantiereId && !righeMostrate.length && <p className="nota">Nessuna risorsa allocata oggi: aggiungi le righe a mano.</p>}
        {righeMostrate.map((r, i) => (
          <div className="riga-ddt" key={i}>
            <input aria-label="Descrizione" placeholder="Descrizione" value={r.descrizione} onChange={(e) => setRiga(i, { descrizione: e.target.value })} />
            <input aria-label="Quantità" type="number" inputMode="decimal" value={r.quantita} onChange={(e) => setRiga(i, { quantita: Number(e.target.value) })} />
            <select aria-label="Unità" value={r.unita} onChange={(e) => setRiga(i, { unita: e.target.value as RigaDdt["unita"] })}>
              {UNITA.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
            <button type="button" aria-label="Togli riga" onClick={() => setRighe(righeMostrate.filter((_, j) => j !== i))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setRighe([...righeMostrate, { descrizione: "", quantita: 1, unita: "pezzo" }])}>
          + Riga
        </button>
      </fieldset>

      <AreaTesto etichetta="Note" valore={note} onCambia={setNote} />

      <fieldset className="largo">
        <legend>Foto</legend>
        <Foto foto={foto} onCambia={setFoto} />
      </fieldset>

      <fieldset className="largo">
        <legend>Firma</legend>
        <Testo etichetta="Nome di chi firma" valore={firmatario} onCambia={setFirmatario} />
        <Firma onCambia={setFirma} />
        <p className="nota">Senza firma il DDT resta in bozza e si può firmare dopo.</p>
      </fieldset>

      <Errori errori={errori} />
      <div className="piede">
        <button className="primario grande" type="submit" disabled={inCorso}>
          {inCorso ? "Salvataggio…" : firma ? "Salva e firma DDT" : "Salva bozza"}
        </button>
      </div>
    </form>
  );
}

/** Firma di un DDT rimasto in bozza. */
export function FirmaDdt({ ddt, onFatto }: { ddt: Ddt; onFatto: () => void }) {
  const { db, utente } = useSessione();
  const [firmatario, setFirmatario] = useState(utente.nome);
  const [firma, setFirma] = useState("");
  const [foto, setFoto] = useState<string[]>([]);
  const { errori, esegui, inCorso } = useAzione();
  return (
    <div className="griglia">
      <fieldset className="largo">
        <legend>Foto</legend>
        <Foto foto={foto} onCambia={setFoto} />
      </fieldset>
      <Testo etichetta="Nome di chi firma" valore={firmatario} onCambia={setFirmatario} />
      <Firma onCambia={setFirma} />
      <Errori errori={errori} />
      <div className="piede">
        <button
          type="button"
          className="primario grande"
          disabled={inCorso}
          onClick={() => void esegui(() => db.firmaDdt(ddt, firmatario, firma, foto)).then((ok) => ok && onFatto())}
        >
          Firma DDT
        </button>
      </div>
    </div>
  );
}

export function ElencoDdt({ cantiereId }: { cantiereId?: string }) {
  const { utente } = useSessione();
  const ddt = (useCollezione("ddt") ?? []).filter((d) => !cantiereId || d.cantiereId === cantiereId).sort((a, b) => b.numero.localeCompare(a.numero));
  const cantieri = useCollezione("cantieri") ?? [];
  const aperti = cantieri.filter((c) => c.stato !== "chiuso");
  const [nuovo, setNuovo] = useState(false);
  const scrive = puo(utente.ruolo, "ddt", "scrivi");
  return (
    <>
      {scrive && !nuovo && (
        <p>
          <button className="primario" onClick={() => setNuovo(true)}>
            + Nuovo DDT
          </button>{" "}
          <span className="nota">In cantiere usa la webapp: <Link to="/m">/m</Link></span>
        </p>
      )}
      {nuovo && (
        <section className="riquadro">
          <h3>Nuovo DDT</h3>
          <FormDdt cantieri={aperti} cantiereIniziale={cantiereId} onFatto={() => setNuovo(false)} />
          <button onClick={() => setNuovo(false)}>Annulla</button>
        </section>
      )}
      {!ddt.length && <Vuoto>Nessun DDT.</Vuoto>}
      {!!ddt.length && (
        <table>
          <thead>
            <tr>
              <th>Numero</th>
              <th>Data</th>
              {!cantiereId && <th>Cantiere</th>}
              <th>Righe</th>
              <th>Foto</th>
              <th>Stato</th>
            </tr>
          </thead>
          <tbody>
            {ddt.map((d) => (
              <tr key={d.id}>
                <td>
                  <Link to={`/ddt/${d.id}`}>{d.numero}</Link>
                </td>
                <td>{dataIt(d.data)}</td>
                {!cantiereId && <td>{cantieri.find((c) => c.id === d.cantiereId)?.nome}</td>}
                <td>{d.righe.length}</td>
                <td>{d.foto.length}</td>
                <td>{d.stato === "firmato" ? <Etichetta tono="ok">firmato</Etichetta> : <Etichetta tono="attenzione">bozza</Etichetta>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

/** Vista del DDT pronta per la stampa o il salvataggio in PDF dal browser. */
export function StampaDdt() {
  const { id } = useParams();
  const ddt = useCollezione("ddt");
  const cantieri = useCollezione("cantieri") ?? [];
  const clienti = useCollezione("clienti") ?? [];
  const [firmando, setFirmando] = useState(false);
  const d = ddt?.find((x) => x.id === id);
  if (!ddt) return null;
  if (!d) return <Vuoto>DDT non trovato.</Vuoto>;
  const cantiere = cantieri.find((c) => c.id === d.cantiereId);
  const cliente = clienti.find((c) => c.id === cantiere?.clienteId);
  return (
    <div className="stampa">
      <div className="non-stampare azioni">
        <button onClick={() => history.back()}>← Indietro</button>
        {d.stato === "bozza" && !firmando && <button onClick={() => setFirmando(true)}>Firma</button>}
        <button className="primario" onClick={() => window.print()}>
          Stampa / PDF
        </button>
      </div>
      <h1>Documento di trasporto n. {d.numero}</h1>
      <p>
        Data: <strong>{dataIt(d.data)}</strong> · Causale: {d.causale}
      </p>
      <p>
        Cantiere: <strong>{cantiere?.nome}</strong> · Cliente: {cliente?.ragioneSociale}
        <br />
        Destinazione: {d.destinazione}
      </p>
      <table>
        <thead>
          <tr>
            <th>Descrizione</th>
            <th>Tipo</th>
            <th>Quantità</th>
          </tr>
        </thead>
        <tbody>
          {d.righe.map((r, i) => (
            <tr key={i}>
              <td>{r.descrizione}</td>
              <td>{r.categoria ? CATEGORIE[r.categoria].singolare : ""}</td>
              <td>
                {r.quantita} {r.unita}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {d.note && <p>Note: {d.note}</p>}
      <div className="firma-stampa">
        <p>Firma: {d.firmatario}</p>
        {d.firma ? <img src={d.firma} alt="Firma" /> : <p className="nota">Non firmato</p>}
      </div>
      {!!d.foto.length && (
        <div className="foto-stampa">
          {d.foto.map((f, i) => (
            <img key={i} src={f} alt={`Foto ${i + 1}`} />
          ))}
        </div>
      )}
      {firmando && (
        <section className="riquadro non-stampare">
          <FirmaDdt ddt={d} onFatto={() => setFirmando(false)} />
        </section>
      )}
    </div>
  );
}
