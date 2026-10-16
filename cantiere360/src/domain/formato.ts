/** Centesimi → "1.234,56 €" (o "1234,56" senza simbolo, per gli export). */
export function euro(centesimi: number, simbolo = true): string {
  const v = (centesimi || 0) / 100;
  if (!simbolo) return v.toFixed(2).replace(".", ",");
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

/** "1.234,56" o "1234.56" → centesimi. Restituisce 0 se il testo non è un numero. */
export function centesimi(testo: string): number {
  const pulito = testo.trim().replace(/\s|€/g, "");
  const normalizzato = pulito.includes(",") ? pulito.replace(/\./g, "").replace(",", ".") : pulito;
  const n = Number(normalizzato);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function oggi(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function dataIt(iso: string): string {
  if (!iso) return "";
  const [a, m, g] = iso.slice(0, 10).split("-");
  return `${g}/${m}/${a}`;
}
