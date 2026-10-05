import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const OPERATION_LABELS: Record<string, string> = {
  rozmowa: "Rozmowa z trenerem (Sonnet)",
  analiza_dzienna: "Analiza dzienna (Haiku)",
  poprawka_tygodnia: "Poprawka tygodnia (Sonnet)",
  plan_tygodnia: "Plan tygodnia (Opus)",
  plan_cyklu: "Plan cyklu (Opus)",
  podsumowanie_tygodnia: "Podsumowanie tygodnia (Sonnet)",
};

type Row = {
  id: number;
  operation: string;
  model: string;
  input_tokens: number;
  cache_write_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
};

const usd = (v: number) => `$${v.toFixed(v < 0.1 ? 3 : 2)}`;

export default async function KosztyPage() {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("ai_usage")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as Row[]).map((r) => ({ ...r, cost_usd: Number(r.cost_usd) }));
  const total = rows.reduce((s, r) => s + r.cost_usd, 0);

  const byOperation = new Map<string, { count: number; cost: number }>();
  for (const r of rows) {
    const agg = byOperation.get(r.operation) ?? { count: 0, cost: 0 };
    agg.count += 1;
    agg.cost += r.cost_usd;
    byOperation.set(r.operation, agg);
  }
  const operations = [...byOperation.entries()].sort((a, b) => b[1].cost - a[1].cost);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Strona główna
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Koszty AI</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Ostatnie 30 dni · szacunek na podstawie cennika Anthropic (dokładne kwoty w konsoli Anthropic)
      </p>

      {error && (
        <p className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-700" role="alert">
          Nie udało się pobrać danych: {error.message}
        </p>
      )}

      <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
        <p className="text-xs text-zinc-500">Razem</p>
        <p className="text-3xl font-semibold text-zinc-900">{usd(total)}</p>
        <p className="text-sm text-zinc-500">{rows.length} zapytań do Claude</p>
      </section>

      {operations.length > 0 && (
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-3 font-semibold text-zinc-900">Według rodzaju</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {operations.map(([op, agg]) => (
              <li key={op} className="flex justify-between gap-2">
                <span className="text-zinc-700">
                  {OPERATION_LABELS[op] ?? op} <span className="text-zinc-400">× {agg.count}</span>
                </span>
                <span className="shrink-0 text-zinc-900">
                  {usd(agg.cost)} <span className="text-zinc-400">(śr. {usd(agg.cost / agg.count)})</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <h2 className="mb-3 font-semibold text-zinc-900">Ostatnie zapytania</h2>
          <div className="-mx-4 overflow-x-auto px-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-2 font-normal">Kiedy</th>
                  <th className="py-2 font-normal">Co</th>
                  <th className="py-2 font-normal">Wejście</th>
                  <th className="py-2 font-normal">Z cache</th>
                  <th className="py-2 font-normal">Wyjście</th>
                  <th className="py-2 font-normal">Koszt</th>
                </tr>
              </thead>
              <tbody className="text-zinc-800">
                {rows.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t border-zinc-100">
                    <td className="py-2 text-zinc-500">
                      {new Date(r.created_at).toLocaleString("pl-PL", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2">{OPERATION_LABELS[r.operation] ?? r.operation}</td>
                    <td className="py-2">{(r.input_tokens + r.cache_write_tokens).toLocaleString("pl-PL")}</td>
                    <td className="py-2">{r.cache_read_tokens.toLocaleString("pl-PL")}</td>
                    <td className="py-2">{r.output_tokens.toLocaleString("pl-PL")}</td>
                    <td className="py-2 font-medium">{usd(r.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
