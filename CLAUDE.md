@AGENTS.md

# trainAIro – osobisty trener kolarski z AI

## Użytkownik
- Zupełny początkujący, nie umie programować. Windows + VS Code (terminal PowerShell).
- Komunikacja **po polsku, prostym językiem**, krok po kroku.
- Każde nowe pojęcie wyjaśniaj jednym zdaniem.
- Przed każdą większą zmianą powiedz, co robisz i po co.
- Nie rób kilku rzeczy naraz – po każdym etapie zatrzymaj się i poczekaj na zgodę.

## Cel projektu
Prywatna strona (na razie tylko dla właściciela), działająca jak osobisty trener kolarski:
- pobiera dane z konta **intervals.icu** przez API (treningi, wellness, odczucia/notatki),
- automatycznie generuje komentarze i analizy każdego treningu za pomocą **Claude (Anthropic API)**,
- ma wbudowany **czat z Claude**, który zna dane treningowe,
- jest dostępna z internetu, z **logowaniem tylko dla właściciela**,
- na podstawie odczuć i wyników **generuje treningi kolarskie** i automatycznie wrzuca je do intervals.icu jako zaplanowane.

## Stos technologiczny
- **Next.js** (TypeScript, App Router, folder `src/`) + **Tailwind CSS**
- **Supabase** – baza danych i logowanie
- **Vercel** – hosting
- Strona ma dobrze działać na telefonie (**PWA**)

## Zasady (obowiązkowe)
1. Klucze API (Anthropic, intervals.icu, Supabase) **tylko w pliku `.env.local`**, który jest w `.gitignore`.
   Nigdy w kodzie ani na GitHubie. Użytkownik wpisuje klucze sam – poinstruuj go jak.
   Sekretne klucze używane wyłącznie po stronie serwera (bez prefiksu `NEXT_PUBLIC_`).
2. Publiczna rejestracja **wyłączona**; dane dostępne wyłącznie po zalogowaniu.
3. Małe kroki; po każdym działającym kroku zaproponuj commit.
4. Nowe pojęcia wyjaśniaj jednym zdaniem.

## Plan etapów
- [x] Etap 1: środowisko, projekt Next.js + Tailwind, CLAUDE.md, uruchomienie lokalne
- [x] Etap 2: logowanie (Supabase, bez publicznej rejestracji) – `src/proxy.ts` chroni wszystkie strony poza `/login`
- [ ] Pobieranie danych z intervals.icu
- [ ] Analizy treningów przez Claude
- [ ] Czat z Claude znającym dane treningowe
- [ ] Generowanie treningów i wysyłanie ich do intervals.icu
- [ ] PWA i wdrożenie na Vercel

## Przydatne polecenia
- `npm run dev` – uruchamia stronę lokalnie pod adresem http://localhost:3000
- `npm run build` – sprawdza, czy projekt się buduje (jak przed wdrożeniem)
- `npm run lint` – sprawdza jakość kodu

## Uwagi techniczne
- Nazwa paczki w `package.json` to `trainairo` (npm nie pozwala na wielkie litery).
- Next.js 16: plik `middleware.ts` nazywa się teraz `proxy.ts` (funkcja `proxy`).
- Klient Supabase po stronie serwera: `src/lib/supabase/server.ts`. Zmienne: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Nie uruchamiaj `npm audit fix --force` bez konsultacji – może zepsuć zależności.
