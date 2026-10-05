import "server-only";

// Klient API intervals.icu – działa wyłącznie na serwerze (klucz nie trafia do przeglądarki).
// Dokumentacja: https://intervals.icu/api-docs.html

const BASE_URL = "https://intervals.icu/api/v1";

export type IntervalsActivity = {
  id: string;
  start_date_local?: string;
  name?: string;
  type?: string;
  moving_time?: number; // sekundy
  distance?: number; // metry
  icu_training_load?: number;
  icu_average_watts?: number;
  icu_weighted_avg_watts?: number;
  average_heartrate?: number;
  description?: string | null;
  source?: string;
};

function getConfig() {
  const apiKey = process.env.INTERVALS_API_KEY;
  const athleteId = process.env.INTERVALS_ATHLETE_ID;
  if (!apiKey || !athleteId) {
    throw new Error(
      "Brak INTERVALS_API_KEY lub INTERVALS_ATHLETE_ID w pliku .env.local",
    );
  }
  return { apiKey, athleteId };
}

async function intervalsFetch<T>(path: string): Promise<T> {
  const { apiKey } = getConfig();
  // intervals.icu używa logowania Basic: użytkownik "API_KEY", hasło = klucz.
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString("base64");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`intervals.icu odpowiedziało błędem ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Data w formacie RRRR-MM-DD.
function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getActivities(days = 30) {
  const { athleteId } = getConfig();
  const newest = new Date();
  const oldest = new Date();
  oldest.setDate(newest.getDate() - days);

  const activities = await intervalsFetch<IntervalsActivity[]>(
    `/athlete/${athleteId}/activities?oldest=${isoDate(oldest)}&newest=${isoDate(newest)}`,
  );

  // Najnowsze na górze.
  return activities.sort((a, b) =>
    (b.start_date_local ?? "").localeCompare(a.start_date_local ?? ""),
  );
}
