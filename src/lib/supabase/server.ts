import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Klient Supabase do użycia na serwerze (strony, akcje serwerowe).
// Tworzymy nowy przy każdym żądaniu – nie współdzielimy go między użytkownikami.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Wywołane ze strony (Server Component), gdzie nie można zapisać
            // ciasteczek – odświeżaniem sesji zajmie się proxy.ts.
          }
        },
      },
    },
  );
}
