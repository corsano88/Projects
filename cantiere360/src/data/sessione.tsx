import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import type { Ruolo, Utente } from "../domain/types";
import { ETICHETTE_RUOLO } from "../domain/permessi";
import { Db } from "./db";
import { StoreLocale } from "./locale";
import { appFirebase, leggiConfig, StoreFirebase } from "./firebase";
import type { Collezioni, NomeCollezione, Store } from "./store";

interface Sessione {
  db: Db;
  utente: Utente;
  esci: () => void;
}

const Ctx = createContext<Sessione | null>(null);

export function useSessione(): Sessione {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSessione fuori dalla sessione");
  return s;
}

/** Documenti di una collezione, aggiornati in tempo reale. `null` finché non arrivano. */
export function useCollezione<K extends NomeCollezione>(col: K): Collezioni[K][] | null {
  const { db } = useSessione();
  const [docs, setDocs] = useState<Collezioni[K][] | null>(null);
  useEffect(() => db.store.ascolta(col, setDocs, (e) => console.error(col, e)), [db, col]);
  return docs;
}

const config = leggiConfig();
const tenant = import.meta.env.VITE_TENANT_ID || "mk-service";

const store: Store = config
  ? new StoreFirebase(appFirebase(config), tenant)
  : new StoreLocale(window.localStorage);

export function ProviderSessione({ children }: { children: ReactNode }) {
  return config ? <SessioneFirebase>{children}</SessioneFirebase> : <SessioneDemo>{children}</SessioneDemo>;
}

// ---------- Modalità Firebase ----------

function SessioneFirebase({ children }: { children: ReactNode }) {
  const auth = useMemo(() => getAuth(appFirebase(config!)), []);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [utente, setUtente] = useState<Utente | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(auth, setUser), [auth]);

  useEffect(() => {
    if (!user) {
      setUtente(user === null ? null : undefined);
      return;
    }
    return store.ascolta(
      "utenti",
      (docs) => setUtente(docs.find((d) => d.id === user.uid && d.attivo) ?? null),
      () => setUtente(null),
    );
  }, [user]);

  const sessione = useMemo(
    () => (user && utente ? { db: new Db(store, user.uid), utente, esci: () => void signOut(auth) } : null),
    [user, utente, auth],
  );

  if (user === undefined || (user && utente === undefined)) return <div className="caricamento">Caricamento…</div>;
  if (!user)
    return (
      <Accesso
        onAccedi={(e, p) => signInWithEmailAndPassword(auth, e, p).then(() => undefined)}
        onRegistra={async (nome, e, p) => {
          const cred = await createUserWithEmailAndPassword(auth, e, p);
          // Il nuovo account nasce non attivo, con ruolo operaio: lo abilita l'amministratore.
          await store.crea("utenti", { nome, email: e, ruolo: "operaio", attivo: false }, cred.user.uid, cred.user.uid);
        }}
      />
    );
  if (!sessione)
    return (
      <div className="accesso">
        <div className="scheda">
          <h1>Cantiere360</h1>
          <p>
            Il tuo account ({user.email}) non è ancora abilitato. Chiedi all'amministratore di assegnarti un ruolo, poi
            ricarica la pagina.
          </p>
          <button onClick={() => void signOut(auth)}>Esci</button>
        </div>
      </div>
    );
  return <Ctx.Provider value={sessione}>{children}</Ctx.Provider>;
}

function Accesso({
  onAccedi,
  onRegistra,
}: {
  onAccedi: (email: string, password: string) => Promise<void>;
  onRegistra: (nome: string, email: string, password: string) => Promise<void>;
}) {
  const [registra, setRegistra] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errore, setErrore] = useState("");
  return (
    <div className="accesso">
      <form
        className="scheda"
        onSubmit={(e) => {
          e.preventDefault();
          setErrore("");
          if (registra) {
            if (!nome.trim()) return setErrore("Scrivi nome e cognome.");
            if (password.length < 8) return setErrore("La password deve avere almeno 8 caratteri.");
            onRegistra(nome.trim(), email, password).catch(() => setErrore("Registrazione non riuscita. L'email è già usata?"));
          } else onAccedi(email, password).catch(() => setErrore("Email o password non corretti."));
        }}
      >
        <h1>Cantiere360</h1>
        {registra && (
          <label>
            Nome e cognome
            <input autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={registra ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {errore && <p className="errore">{errore}</p>}
        <button className="primario" type="submit">
          {registra ? "Crea account" : "Accedi"}
        </button>
        <button type="button" className="link" onClick={() => setRegistra(!registra)}>
          {registra ? "Ho già un account" : "Crea un account"}
        </button>
      </form>
    </div>
  );
}

// ---------- Modalità demo ----------

const CHIAVE_RUOLO_DEMO = "c360:ruoloDemo";

function SessioneDemo({ children }: { children: ReactNode }) {
  const [ruolo, setRuolo] = useState<Ruolo | null>(() => {
    try {
      return (localStorage.getItem(CHIAVE_RUOLO_DEMO) as Ruolo | null) ?? null;
    } catch {
      return null;
    }
  });

  const sessione = useMemo<Sessione | null>(() => {
    if (!ruolo) return null;
    const ora = new Date().toISOString();
    const utente: Utente = {
      id: `demo-${ruolo}`,
      nome: `Utente demo (${ETICHETTE_RUOLO[ruolo]})`,
      email: `${ruolo}@demo.local`,
      ruolo,
      attivo: true,
      createdAt: ora,
      updatedAt: ora,
      createdBy: "demo",
    };
    return {
      db: new Db(store, utente.id),
      utente,
      esci: () => {
        localStorage.removeItem(CHIAVE_RUOLO_DEMO);
        setRuolo(null);
      },
    };
  }, [ruolo]);

  if (!sessione)
    return (
      <div className="accesso">
        <div className="scheda">
          <h1>Cantiere360</h1>
          <p>
            Modalità demo: Firebase non è configurato, i dati restano in questo browser. Scegli con quale ruolo
            entrare.
          </p>
          <div className="pulsanti-verticali">
            {(Object.keys(ETICHETTE_RUOLO) as Ruolo[]).map((r) => (
              <button
                key={r}
                onClick={() => {
                  localStorage.setItem(CHIAVE_RUOLO_DEMO, r);
                  setRuolo(r);
                }}
              >
                {ETICHETTE_RUOLO[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  return <Ctx.Provider value={sessione}>{children}</Ctx.Provider>;
}
