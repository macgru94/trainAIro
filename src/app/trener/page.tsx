import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Chat, type ChatMessage } from "./chat";

export default async function TrenerPage() {
  const supabase = await createClient();

  // Otwieramy ostatnią rozmowę (jeśli była).
  const { data: conversation } = await supabase
    .from("coach_conversations")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: ChatMessage[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("coach_messages")
      .select("role, display_text")
      .eq("conversation_id", conversation.id)
      .order("id", { ascending: true });
    messages = (data ?? []).map((m) => ({
      role: m.role as ChatMessage["role"],
      text: m.display_text ?? "",
    }));
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-zinc-50 px-4 pt-8">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Strona główna
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-900">Trener</h1>
      <Chat
        key={conversation?.id ?? "new"}
        initialConversationId={conversation?.id ?? null}
        initialMessages={messages}
      />
    </main>
  );
}
