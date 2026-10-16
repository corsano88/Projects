import { useState } from "react";
import { Link } from "react-router-dom";
import { dataIt } from "../domain/formato";
import { soloMobile } from "../domain/permessi";
import type { Ddt } from "../domain/types";
import { useCollezione, useSessione } from "../data/sessione";
import { Etichetta, Vuoto } from "../ui/componenti";
import { FirmaDdt, FormDdt } from "./Ddt";

/**
 * Webapp per i dipendenti in cantiere ("Webapp per dipendenti compilazione DDT" nel PDF).
 * Schermo semplice, pulsanti grandi: nuovo DDT, firma delle bozze, elenco degli ultimi DDT.
 */
export function Mobile() {
  const { utente, esci } = useSessione();
  const cantieri = (useCollezione("cantieri") ?? []).filter((c) => c.stato !== "chiuso");
  const ddt = useCollezione("ddt") ?? [];
  const [vista, setVista] = useState<"home" | "nuovo" | { firma: Ddt }>("home");
  const [ok, setOk] = useState("");
  const miei = ddt
    .filter((d) => d.createdBy === utente.id || !soloMobile(utente.ruolo))
    .sort((a, b) => b.numero.localeCompare(a.numero))
    .slice(0, 20);
  const nomeCantiere = (id: string) => cantieri.find((c) => c.id === id)?.nome ?? "";

  return (
    <div className="mobile">
      <header>
        {vista === "home" ? <strong>Cantiere360</strong> : <button onClick={() => setVista("home")}>← Indietro</button>}
        <span className="nota">{utente.nome}</span>
        {soloMobile(utente.ruolo) ? <button onClick={esci}>Esci</button> : <Link to="/">Gestionale</Link>}
      </header>
      <main>
        {vista === "home" && (
          <>
            {ok && <p className="conferma">{ok}</p>}
            <button className="primario grande" onClick={() => (setOk(""), setVista("nuovo"))} disabled={!cantieri.length}>
              + Nuovo DDT
            </button>
            {!cantieri.length && <Vuoto>Nessun cantiere aperto.</Vuoto>}
            <h2>Ultimi DDT</h2>
            {!miei.length && <Vuoto>Nessun DDT.</Vuoto>}
            <ul className="lista-mobile">
              {miei.map((d) => (
                <li key={d.id}>
                  <div>
                    <strong>{d.numero}</strong> · {dataIt(d.data)}
                    <br />
                    <span className="nota">{nomeCantiere(d.cantiereId)}</span>
                  </div>
                  {d.stato === "bozza" ? (
                    <button onClick={() => setVista({ firma: d })}>Firma</button>
                  ) : (
                    <Etichetta tono="ok">firmato</Etichetta>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {vista === "nuovo" && (
          <FormDdt
            cantieri={cantieri}
            onFatto={(d) => {
              setOk(`DDT ${d.numero} salvato.`);
              setVista("home");
            }}
          />
        )}
        {typeof vista === "object" && (
          <>
            <h2>Firma DDT {vista.firma.numero}</h2>
            <FirmaDdt
              ddt={vista.firma}
              onFatto={() => {
                setOk(`DDT ${vista.firma.numero} firmato.`);
                setVista("home");
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
