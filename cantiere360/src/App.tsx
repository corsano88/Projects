import { useState, type ReactNode } from "react";
import { BrowserRouter, Navigate, NavLink, Route, Routes } from "react-router-dom";
import { CATEGORIE } from "./domain/anagrafiche";
import { ETICHETTE_RUOLO, puo, soloMobile, type Area } from "./domain/permessi";
import { CATEGORIE_RISORSA } from "./domain/types";
import { ProviderSessione, useSessione } from "./data/sessione";
import { Clienti, Risorse } from "./pages/Anagrafiche";
import { DettaglioCantiere } from "./pages/Cantiere";
import { ElencoDdt, StampaDdt } from "./pages/Ddt";
import { Mobile } from "./pages/Mobile";
import { Cantieri, DettaglioProgetto, Progetti } from "./pages/Progetti";
import { Trattative } from "./pages/Trattative";
import { Cruscotto, PaginaFir, Registro, Utenti } from "./pages/Varie";
import { Pagina } from "./ui/componenti";

function Voce({ a, children, area }: { a: string; children: ReactNode; area?: Area }) {
  const { utente } = useSessione();
  if (area && !puo(utente.ruolo, area)) return null;
  return (
    <NavLink to={a} end={a === "/"}>
      {children}
    </NavLink>
  );
}

/** Layout del gestionale: barra laterale con flusso di lavoro in alto e anagrafiche sotto, come nel PDF. */
function Gestionale() {
  const { utente, esci, db } = useSessione();
  const [menu, setMenu] = useState(false);
  if (soloMobile(utente.ruolo)) return <Navigate to="/m" replace />;
  return (
    <div className={`gestionale ${menu ? "menu-aperto" : ""}`}>
      <aside onClick={() => setMenu(false)}>
        <div className="marchio">Cantiere360</div>
        <nav>
          <Voce a="/">Cruscotto</Voce>
          <Voce a="/trattative" area="trattative">
            Trattative
          </Voce>
          <Voce a="/progetti" area="progetti">
            Progetti
          </Voce>
          <Voce a="/cantieri" area="progetti">
            Cantieri
          </Voce>
          <Voce a="/ddt" area="ddt">
            DDT
          </Voce>
          <Voce a="/fir" area="fir">
            FIR e RENTRI
          </Voce>
          <Voce a="/m">Webapp cantiere</Voce>
          <h4>Anagrafiche</h4>
          <Voce a="/anagrafiche/clienti" area="anagrafiche">
            Clienti
          </Voce>
          {CATEGORIE_RISORSA.map((c) => (
            <Voce key={c} a={`/anagrafiche/${c}`} area="anagrafiche">
              {CATEGORIE[c].titolo}
            </Voce>
          ))}
          <h4>Amministrazione</h4>
          <Voce a="/registro" area="audit">
            Registro modifiche
          </Voce>
          <Voce a="/utenti" area="utenti">
            Utenti
          </Voce>
        </nav>
        <div className="utente">
          <span>{utente.nome}</span>
          <span className="nota">
            {ETICHETTE_RUOLO[utente.ruolo]}
            {db.store.modalita === "demo" && " · demo"}
          </span>
          <button className="link" onClick={esci}>
            Esci
          </button>
        </div>
      </aside>
      <div className="contenuto">
        <button className="apri-menu" onClick={() => setMenu(true)} aria-label="Menu">
          ☰
        </button>
        <Routes>
          <Route path="/" element={<Cruscotto />} />
          <Route path="/trattative" element={<Trattative />} />
          <Route path="/progetti" element={<Progetti />} />
          <Route path="/progetti/:id" element={<DettaglioProgetto />} />
          <Route path="/cantieri" element={<Cantieri />} />
          <Route path="/cantieri/:id" element={<DettaglioCantiere />} />
          <Route
            path="/ddt"
            element={
              <Pagina titolo="DDT">
                <ElencoDdt />
              </Pagina>
            }
          />
          <Route path="/fir" element={<PaginaFir />} />
          <Route path="/anagrafiche/clienti" element={<Clienti />} />
          <Route path="/anagrafiche/:categoria" element={<Risorse />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/utenti" element={<Utenti />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ProviderSessione>
      <BrowserRouter>
        <Routes>
          <Route path="/m" element={<Mobile />} />
          <Route path="/ddt/:id" element={<StampaDdt />} />
          <Route path="/*" element={<Gestionale />} />
        </Routes>
      </BrowserRouter>
    </ProviderSessione>
  );
}
