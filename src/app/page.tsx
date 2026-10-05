import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  // Druga linia obrony – proxy.ts i tak nie wpuści tu niezalogowanych.
  if (!data?.claims) {
    redirect("/login");
  }

  const email = data.claims.email as string | undefined;

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200">
        <h1 className="text-2xl font-semibold text-zinc-900">trainAIro</h1>
        <p className="mt-4 text-zinc-700">
          Witaj, <span className="font-medium text-zinc-900">{email}</span>!
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Tu wkrótce pojawią się Twoje treningi i analizy.
        </p>

        <Link
          href="/trener"
          className="mt-6 block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center font-medium text-white transition hover:bg-zinc-700"
        >
          Trener
        </Link>

        <Link
          href="/treningi"
          className="mt-3 block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center font-medium text-white transition hover:bg-zinc-700"
        >
          Treningi
        </Link>

        <Link
          href="/forma"
          className="mt-3 block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center font-medium text-white transition hover:bg-zinc-700"
        >
          Forma
        </Link>

        <form action={logout} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-900 transition hover:bg-zinc-100"
          >
            Wyloguj
          </button>
        </form>
      </div>
    </main>
  );
}
