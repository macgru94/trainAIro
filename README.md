# trainAIro

Prywatny, osobisty trener kolarski oparty na AI.

## Co robi (docelowo)
- Pobiera treningi, wellness i notatki z [intervals.icu](https://intervals.icu)
- Automatycznie analizuje każdy trening za pomocą Claude (Anthropic)
- Udostępnia czat z trenerem AI, który zna moje dane treningowe
- Generuje plany treningowe i wysyła je do intervals.icu jako zaplanowane
- Działa na telefonie (PWA), dostęp tylko po zalogowaniu

## Technologie
Next.js (TypeScript, App Router) · Tailwind CSS · Supabase · Vercel

## Uruchomienie lokalne
```bash
npm install
npm run dev
```
Następnie otwórz http://localhost:3000

## Klucze API
Klucze trzymamy wyłącznie w pliku `.env.local` (nie trafia do Gita).
