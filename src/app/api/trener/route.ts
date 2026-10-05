import type Anthropic from "@anthropic-ai/sdk";
import { streamCoachChat } from "@/lib/claude";
import { buildCoachSnapshot } from "@/lib/coach-context";
import { CHAT_SYSTEM } from "@/lib/prompts";
import { createClient } from "@/lib/supabase/server";

type Body = { conversationId?: string | null; message?: string };

const MAX_MESSAGE_LENGTH = 4000;

// Wysłanie wiadomości do trenera. Odpowiedź wraca jako strumień tekstu,
// a identyfikator rozmowy w nagłówku X-Conversation-Id.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    return new Response("Musisz być zalogowany.", { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const message = String(body.message ?? "").trim();
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return new Response("Wiadomość jest pusta albo za długa.", { status: 400 });
  }

  // Istniejąca rozmowa albo nowa.
  let conversationId = body.conversationId ?? null;
  if (conversationId) {
    const { data } = await supabase
      .from("coach_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await supabase
      .from("coach_conversations")
      .insert({ user_id: userId, title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error || !data) {
      return new Response(`Nie udało się utworzyć rozmowy: ${error?.message}`, { status: 500 });
    }
    conversationId = data.id as string;
  }

  const { data: historyRows, error: historyError } = await supabase
    .from("coach_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("id", { ascending: true });
  if (historyError) {
    return new Response(`Nie udało się wczytać rozmowy: ${historyError.message}`, { status: 500 });
  }

  const history = (historyRows ?? []).map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content as Anthropic.Beta.BetaContentBlockParam[],
  }));

  // Pierwsza wiadomość w rozmowie dostaje na początek aktualne dane zawodnika.
  // Później ich nie podmieniamy – historia rozmowy musi zostać niezmieniona.
  const userContent: Anthropic.Beta.BetaContentBlockParam[] =
    history.length === 0
      ? [
          { type: "text", text: await buildCoachSnapshot(supabase) },
          { type: "text", text: message },
        ]
      : [{ type: "text", text: message }];

  const { error: insertError } = await supabase.from("coach_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: "user",
    content: userContent,
    display_text: message,
  });
  if (insertError) {
    return new Response(`Nie udało się zapisać wiadomości: ${insertError.message}`, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = streamCoachChat(CHAT_SYSTEM, [
          ...history,
          { role: "user", content: userContent },
        ]);
        claudeStream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));

        const final = await claudeStream.finalMessage();
        let text = final.content
          .flatMap((b) => (b.type === "text" ? [b.text] : []))
          .join("");

        if (final.stop_reason === "refusal") {
          const note = "\n\n_Trener nie mógł odpowiedzieć na tę wiadomość._";
          controller.enqueue(encoder.encode(note));
          text += note;
        }

        // Zapisujemy pełną odpowiedź (także bloki myślenia) – przy kolejnej
        // wiadomości odtworzymy ją dokładnie w tej postaci.
        await supabase.from("coach_messages").insert({
          conversation_id: conversationId,
          user_id: userId,
          role: "assistant",
          content: final.content,
          display_text: text,
        });
        await supabase
          .from("coach_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Nieznany błąd";
        controller.enqueue(encoder.encode(`\n\n⚠️ Błąd: ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId,
    },
  });
}
