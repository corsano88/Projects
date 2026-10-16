import { useEffect, useRef, useState, type ReactNode } from "react";
import { centesimi, euro } from "../domain/formato";

export function Pagina({ titolo, azioni, children }: { titolo: string; azioni?: ReactNode; children: ReactNode }) {
  return (
    <section className="pagina">
      <header className="testata">
        <h1>{titolo}</h1>
        <div className="azioni">{azioni}</div>
      </header>
      {children}
    </section>
  );
}

export function Modale({
  titolo,
  onChiudi,
  children,
  largo,
}: {
  titolo: string;
  onChiudi: () => void;
  children: ReactNode;
  largo?: boolean;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onChiudi();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onChiudi]);
  return (
    <div className="sfondo-modale" onMouseDown={(e) => e.target === e.currentTarget && onChiudi()}>
      <div className={`modale ${largo ? "largo" : ""}`} role="dialog" aria-label={titolo}>
        <header>
          <h2>{titolo}</h2>
          <button className="chiudi" onClick={onChiudi} aria-label="Chiudi">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Campo({ etichetta, children, largo }: { etichetta: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`campo ${largo ? "largo" : ""}`}>
      <span>{etichetta}</span>
      {children}
    </label>
  );
}

export function Testo({
  etichetta,
  valore,
  onCambia,
  tipo = "text",
  largo,
  obbligatorio,
}: {
  etichetta: string;
  valore: string;
  onCambia: (v: string) => void;
  tipo?: "text" | "date" | "email" | "tel" | "number";
  largo?: boolean;
  obbligatorio?: boolean;
}) {
  return (
    <Campo etichetta={etichetta + (obbligatorio ? " *" : "")} largo={largo}>
      <input type={tipo} value={valore} required={obbligatorio} onChange={(e) => onCambia(e.target.value)} />
    </Campo>
  );
}

export function AreaTesto({
  etichetta,
  valore,
  onCambia,
}: {
  etichetta: string;
  valore: string;
  onCambia: (v: string) => void;
}) {
  return (
    <Campo etichetta={etichetta} largo>
      <textarea rows={3} value={valore} onChange={(e) => onCambia(e.target.value)} />
    </Campo>
  );
}

/** Importo in euro: si scrive "1.234,56", si salva in centesimi. */
export function Importo({
  etichetta,
  valore,
  onCambia,
}: {
  etichetta: string;
  valore: number;
  onCambia: (centesimi: number) => void;
}) {
  const [testo, setTesto] = useState(valore ? euro(valore, false) : "");
  return (
    <Campo etichetta={etichetta + " (€)"}>
      <input
        inputMode="decimal"
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value);
          onCambia(centesimi(e.target.value));
        }}
      />
    </Campo>
  );
}

export function Scelta<T extends string>({
  etichetta,
  valore,
  onCambia,
  opzioni,
  vuota,
}: {
  etichetta: string;
  valore: T | "";
  onCambia: (v: T) => void;
  opzioni: { valore: T; etichetta: string }[];
  vuota?: string;
}) {
  return (
    <Campo etichetta={etichetta}>
      <select value={valore} onChange={(e) => onCambia(e.target.value as T)}>
        {vuota !== undefined && <option value="">{vuota}</option>}
        {opzioni.map((o) => (
          <option key={o.valore} value={o.valore}>
            {o.etichetta}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function Errori({ errori }: { errori: string[] }) {
  if (!errori.length) return null;
  return (
    <ul className="errori" role="alert">
      {errori.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

export function Vuoto({ children }: { children: ReactNode }) {
  return <p className="vuoto">{children}</p>;
}

export function Etichetta({ children, tono = "neutro" }: { children: ReactNode; tono?: string }) {
  return <span className={`etichetta ${tono}`}>{children}</span>;
}

/** Esegue un'azione asincrona mostrando l'eventuale errore. */
export function useAzione() {
  const [errori, setErrori] = useState<string[]>([]);
  const [inCorso, setInCorso] = useState(false);
  async function esegui(f: () => Promise<unknown>): Promise<boolean> {
    setErrori([]);
    setInCorso(true);
    try {
      await f();
      return true;
    } catch (e) {
      setErrori([e instanceof Error ? e.message : String(e)]);
      return false;
    } finally {
      setInCorso(false);
    }
  }
  return { errori, setErrori, inCorso, esegui };
}

// ---------- Firma e foto (webapp DDT) ----------

/** Riquadro su cui firmare con il dito o il mouse. Restituisce un PNG come data URL. */
export function Firma({ onCambia }: { onCambia: (dataUrl: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const disegnando = useRef(false);
  const vuoto = useRef(true);

  useEffect(() => {
    const c = canvas.current!;
    const scala = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * scala;
    c.height = c.offsetHeight * scala;
    const ctx = c.getContext("2d")!;
    ctx.scale(scala, scala);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
  }, []);

  const punto = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="firma">
      <canvas
        ref={canvas}
        onPointerDown={(e) => {
          canvas.current!.setPointerCapture(e.pointerId);
          disegnando.current = true;
          const ctx = canvas.current!.getContext("2d")!;
          ctx.beginPath();
          ctx.moveTo(...punto(e));
        }}
        onPointerMove={(e) => {
          if (!disegnando.current) return;
          const ctx = canvas.current!.getContext("2d")!;
          ctx.lineTo(...punto(e));
          ctx.stroke();
          vuoto.current = false;
        }}
        onPointerUp={() => {
          disegnando.current = false;
          if (!vuoto.current) onCambia(canvas.current!.toDataURL("image/png"));
        }}
      />
      <button
        type="button"
        onClick={() => {
          const c = canvas.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          vuoto.current = true;
          onCambia("");
        }}
      >
        Cancella firma
      </button>
    </div>
  );
}

/** Riduce una foto a max 1600 px di lato in JPEG, per non pesare sulla rete di cantiere. */
export async function comprimiFoto(file: File, lato = 1600, qualita = 0.75): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, lato / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bitmap.width * k);
  c.height = Math.round(bitmap.height * k);
  c.getContext("2d")!.drawImage(bitmap, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", qualita);
}

export function Foto({ foto, onCambia }: { foto: string[]; onCambia: (foto: string[]) => void }) {
  const { errori, esegui } = useAzione();
  return (
    <div className="foto">
      <div className="miniature">
        {foto.map((f, i) => (
          <figure key={i}>
            <img src={f} alt={`Foto ${i + 1}`} />
            <button type="button" onClick={() => onCambia(foto.filter((_, j) => j !== i))} aria-label="Togli foto">
              ×
            </button>
          </figure>
        ))}
      </div>
      <label className="pulsante">
        + Aggiungi foto
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            void esegui(async () => onCambia([...foto, ...(await Promise.all(files.map((f) => comprimiFoto(f))))]));
          }}
        />
      </label>
      <Errori errori={errori} />
    </div>
  );
}
