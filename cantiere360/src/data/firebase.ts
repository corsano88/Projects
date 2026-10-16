import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  collection,
  deleteDoc,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  runTransaction,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString, type FirebaseStorage } from "firebase/storage";
import type { Collezioni, DatiNuovi, Modifica, NomeCollezione, Store } from "./store";
import { nuovoId } from "./store";

export interface ConfigFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export function leggiConfig(): ConfigFirebase | null {
  const env = import.meta.env;
  const c = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: env.VITE_FIREBASE_APP_ID ?? "",
  };
  return c.apiKey && c.projectId ? c : null;
}

let app: FirebaseApp | null = null;
export function appFirebase(config: ConfigFirebase): FirebaseApp {
  app ??= initializeApp(config);
  return app;
}

/**
 * Store su Firestore. Ogni azienda ha i suoi dati sotto `tenants/{tenantId}`, così il passaggio
 * a più aziende (SaaS multi-tenant del documento di strategia) non richiede di spostare i dati.
 * La cache locale persistente permette di lavorare in cantiere anche senza rete.
 */
export class StoreFirebase implements Store {
  readonly modalita = "firebase" as const;
  private db: Firestore;
  private storage: FirebaseStorage;

  constructor(
    firebaseApp: FirebaseApp,
    private tenantId: string,
  ) {
    this.db = initializeFirestore(firebaseApp, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
    this.storage = getStorage(firebaseApp);
  }

  private col(nome: NomeCollezione) {
    return collection(this.db, "tenants", this.tenantId, nome);
  }

  ascolta<K extends NomeCollezione>(col: K, cb: (docs: Collezioni[K][]) => void, errore?: (e: Error) => void) {
    return onSnapshot(
      this.col(col),
      (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Collezioni[K])),
      (e) => errore?.(e),
    );
  }

  async crea<K extends NomeCollezione>(col: K, dati: DatiNuovi<K>, utente: string, id?: string) {
    const ora = new Date().toISOString();
    const nuovo = { ...dati, id: id ?? nuovoId(), createdAt: ora, updatedAt: ora, createdBy: utente } as Collezioni[K];
    await setDoc(doc(this.col(col), nuovo.id), nuovo);
    return nuovo;
  }

  async aggiorna<K extends NomeCollezione>(col: K, id: string, modifica: Modifica<K>) {
    await updateDoc(doc(this.col(col), id), { ...modifica, updatedAt: new Date().toISOString() });
  }

  async elimina(col: NomeCollezione, id: string) {
    await deleteDoc(doc(this.col(col), id));
  }

  async prossimoNumero(chiave: string) {
    const rif = doc(this.db, "tenants", this.tenantId, "contatori", chiave);
    return runTransaction(this.db, async (tx) => {
      const snap = await tx.get(rif);
      const n = ((snap.data()?.valore as number | undefined) ?? 0) + 1;
      tx.set(rif, { valore: n });
      return n;
    });
  }

  async caricaImmagine(percorso: string, dataUrl: string) {
    const r = ref(this.storage, `tenants/${this.tenantId}/${percorso}`);
    await uploadString(r, dataUrl, "data_url");
    return getDownloadURL(r);
  }
}
