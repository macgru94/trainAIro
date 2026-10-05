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
- [x] Etap 3: dane z intervals.icu – lista + szczegóły treningu, filtr rowerowy, synchronizacja roku danych do bazy, wellness (`/forma`), edycja odczuć (RPE, samopoczucie, notatka) z zapisem do intervals.icu
- [ ] Etap 4: analizy przez Claude – D2 analiza dzienna (zrobione), D3 podsumowanie tygodnia
- [ ] Etap 5: cykl treningowy (4 tygodnie) – wywiad (dostępność, jazdy na dworze/trenażer, cel), plan od Opus, wysyłka do intervals.icu, test co miesiąc
- [ ] Etap 6: czat z Claude znającym dane treningowe
- [ ] Etap 7: PWA i wdrożenie na Vercel

## Architektura trenera AI (ustalona z użytkownikiem)
Każdy poziom pracuje na ZAPISANYCH w bazie wynikach poziomu niżej – droższe modele dostają krótkie podsumowania zamiast surowych danych (oszczędność).
| Poziom | Model (`MODELS` w `src/lib/claude.ts`) | Wejście | Wynik |
|---|---|---|---|
| Dzienny (po treningu) | `claude-haiku-4-5` | surowe dane treningu, 21 dni wellness, 28 dni aktywności, plan na 7 dni z kalendarza intervals.icu | tabela `activity_analyses`: mocne/słabe strony, ocena odczuć, werdykt (`bez_zmian`/`drobna_korekta`/`zmiana_planu`/`odpoczynek`), rekomendacja |
| Tygodniowy | `claude-sonnet-5-5` | analizy dzienne z tygodnia + statystyki tygodnia | podsumowanie tygodnia (do zrobienia) |
| Cykl (4 tygodnie) | `claude-opus-5-5` | podsumowania 4 ostatnich tygodni + wywiad | plan cyklu → intervals.icu (do zrobienia) |
- Odpowiedzi Claude w stałym formacie: structured outputs (`zod` + `zodOutputFormat`, schematy w `src/lib/analysis-schemas.ts`).
- Sonnet/Opus: myślenie adaptacyjne + `fallbacks: "default"` (zapasowy model przy odmowie). Haiku: bez myślenia i bez fallbacku.
- Brak odczuć (RPE/samopoczucie) → analiza prosi o ich uzupełnienie; w UI zachęta + przycisk „Analizuj mimo to”.
- Strona `/trener`: rozmowa na `claude-sonnet-5-5` (endpoint `src/app/api/trener/route.ts`, streaming, pętla narzędzi). Narzędzia (`src/lib/coach-tools.ts`, logika w `src/lib/planning.ts`, zapis do `training_cycles` / `planned_weeks`):
  - `przesun_trening` – przesunięcie/zamiana/usunięcie dnia, czysty kod (0 zł),
  - `popraw_tydzien` – Sonnet (`MODELS.edit`), 7 dni danych, zwraca tylko zmienione dni (`WeekEditSchema`),
  - `zaplanuj_tydzien`, `zaplanuj_cykl` – Opus, effort high, „teczka” jako blok z `cache_control`.
  Zasada od użytkownika: Opus tylko do dużych zadań (pełny tydzień, cykl, analiza cyklu); proste poprawki – Sonnet albo kod.
- Karty planu: `src/app/trener/plan-panel.tsx`; wysyłka do intervals.icu: `src/app/trener/actions.ts` (usuwa poprzednie eventy tygodnia, tworzy nowe przez `/events/bulk`; format kroków w `src/lib/workout-format.ts`). Odświeżanie kart po odpowiedzi trenera – akcja serwerowa `refreshTrener` (`router.refresh()` nie działało).
- Licznik kosztów: każde wywołanie Claude zapisuje zużycie do `ai_usage` (`src/lib/ai-usage.ts`, `askCoach({ log })`), podgląd na `/koszty`.
- Historia rozmowy jest append-only: wiadomości (`coach_messages.content`) odtwarzamy bez zmian (wymóg modeli z myśleniem). Dane zawodnika trafiają tylko do pierwszej wiadomości rozmowy; świeże dane = „Nowa rozmowa”. Zmiana narzędzi lub CHAT_SYSTEM → zalecić nową rozmowę.
- Plan tygodnia: moc w % FTP (bloki × powtórzenia × segmenty), dni jako `pon`…`nd` – daty liczy aplikacja (`week_start` + dzień).

## Przydatne polecenia
- `npm run dev` – uruchamia stronę lokalnie pod adresem http://localhost:3000
- `npm run build` – sprawdza, czy projekt się buduje (jak przed wdrożeniem)
- `npm run lint` – sprawdza jakość kodu

## Uwagi techniczne
- Nazwa paczki w `package.json` to `trainairo` (npm nie pozwala na wielkie litery).
- Next.js 16: plik `middleware.ts` nazywa się teraz `proxy.ts` (funkcja `proxy`).
- Klient Supabase po stronie serwera: `src/lib/supabase/server.ts`. Zmienne: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Baza: skrypty SQL w `supabase/migrations/` – użytkownik uruchamia je ręcznie w Supabase → SQL Editor. Każda tabela ma RLS (dostęp tylko dla `auth.uid() = user_id`).
- Tabela `activities` przechowuje WSZYSTKIE aktywności (kolumna `raw` = pełny JSON z intervals.icu); filtr rowerowy (`isCycling` w `src/lib/intervals.ts`) działa przy wyświetlaniu.
- Edycja plików z polskimi znakami: używaj narzędzi Edit/Write, nie `Get-Content | Set-Content` w PowerShell 5.1 (psuje UTF-8).
- Nie uruchamiaj `npm audit fix --force` bez konsultacji – może zepsuć zależności.
