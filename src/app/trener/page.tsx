import Link from "next/link";
import type { IntervalsActivityDetail } from "@/lib/intervals";
import { getActiveCycle, getCycleWeeks } from "@/lib/planning";
import { createClient } from "@/lib/supabase/server";
import { Chat, type ChatMessage } from "./chat";
import { PlanPanel } from "./plan-panel";

export default async function TrenerPage() {
  const supabase = await createClient();

  // Otwieramy ostatnią rozmowę (jeśli była), aktywny cykl i aktualne FTP.
  const [{ data: conversation }, cycle, { data: recentRides }] = await Promise.all([
    supabase
      .from("coach_conversations")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getActiveCycle(supabase),
    supabase
      .from("activities")
      .select("raw")
      .order("start_date_local", { ascending: false })
      .limit(20),
  ]);

  const weeks = cycle ? await getCycleWeeks(supabase, cycle.id) : [];
  const ftp =
    (recentRides ?? [])
      .map((r) => (r.raw as IntervalsActivityDetail).icu_ftp)
      .find((v) => v != null) ?? null;

  let messages: ChatMessage[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("coach_messages")
      .select("role, display_text")
      .eq("conversation_id", conversation.id)
      .order("id", { ascending: true });
    // Pomijamy wiadomości techniczne (wyniki narzędzi, same wywołania narzędzi).
    messages = (data ?? [])
      .filter((m) => m.display_text)
      .map((m) => ({
        role: m.role as ChatMessage["role"],
        text: m.display_text as string,
      }));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-zinc-50 px-4 pt-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Strona główna
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Trener</h1>
      <PlanPanel cycle={cycle} weeks={weeks} ftp={ftp} />
      <Chat
        key={conversation?.id ?? "new"}
        initialConversationId={conversation?.id ?? null}
        initialMessages={messages}
      />
    </main>
  );
}
