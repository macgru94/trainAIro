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
  icu_rpe?: number | null;
  session_rpe?: number | null; // RPE × minuty (obciążenie sesji), nie skala 1–10
  feel?: number | null;
};

// Typy aktywności intervals.icu, które traktujemy jako jazdę na rowerze.
const CYCLING_TYPES = new Set([
  "Ride",
  "VirtualRide",
  "GravelRide",
  "MountainBikeRide",
  "EBikeRide",
  "EMountainBikeRide",
  "TrackRide",
  "Velomobile",
  "Handcycle",
]);

export function isCycling(activity: Pick<IntervalsActivity, "type">) {
  return activity.type != null && CYCLING_TYPES.has(activity.type);
}

export type IntervalsInterval = {
  id: number;
  type?: string; // np. WORK, RECOVERY
  label?: string | null;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  max_watts?: number;
  intensity?: number;
  zone?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
};

// Pełne dane jednego treningu (tylko pola, których używamy).
export type IntervalsActivityDetail = IntervalsActivity & {
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_heartrate?: number;
  average_cadence?: number;
  calories?: number;
  icu_joules?: number;
  icu_ftp?: number;
  lthr?: number;
  icu_weight?: number;
  icu_intensity?: number;
  icu_variability_index?: number;
  icu_efficiency_factor?: number;
  decoupling?: number;
  polarization_index?: number;
  icu_power_zones?: number[] | null; // górne granice stref w % FTP
  icu_hr_zones?: number[] | null; // górne granice stref w bpm
  icu_zone_times?: { id: string; secs: number }[] | null;
  icu_hr_zone_times?: number[] | null;
  icu_intervals?: IntervalsInterval[] | null;
};

export type IntervalsMessage = {
  id: number;
  name?: string;
  created?: string;
  content?: string;
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

async function intervalsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey } = getConfig();
  // intervals.icu używa logowania Basic: użytkownik "API_KEY", hasło = klucz.
  const auth = Buffer.from(`API_KEY:${apiKey}`).toString("base64");

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
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

// Dane jednego dnia (wellness). id to data w formacie RRRR-MM-DD.
export type IntervalsWellness = {
  id: string;
  ctl?: number | null; // fitness (forma długoterminowa)
  atl?: number | null; // zmęczenie (ostatnie dni)
  rampRate?: number | null;
  weight?: number | null;
  restingHR?: number | null;
  hrv?: number | null;
  sleepSecs?: number | null;
  sleepScore?: number | null;
  sleepQuality?: number | null;
  steps?: number | null;
  vo2max?: number | null;
  soreness?: number | null;
  fatigue?: number | null;
  stress?: number | null;
  mood?: number | null;
  motivation?: number | null;
  comments?: string | null;
};

export async function getWellness(days = 30) {
  const { athleteId } = getConfig();
  const newest = new Date();
  const oldest = new Date();
  oldest.setDate(newest.getDate() - days);

  return intervalsFetch<IntervalsWellness[]>(
    `/athlete/${athleteId}/wellness?oldest=${isoDate(oldest)}&newest=${isoDate(newest)}`,
  );
}

// Wydarzenie z kalendarza intervals.icu (np. zaplanowany trening).
export type IntervalsEvent = {
  id: number;
  category?: string; // WORKOUT, NOTE, RACE_A …
  start_date_local?: string;
  name?: string;
  description?: string | null;
  type?: string;
  moving_time?: number;
  icu_training_load?: number;
  indoor?: boolean;
};

// Wydarzenia z kalendarza w zakresie dat (RRRR-MM-DD, włącznie).
export async function getEvents(oldest: string, newest: string) {
  const { athleteId } = getConfig();
  return intervalsFetch<IntervalsEvent[]>(
    `/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`,
  );
}

export type NewWorkoutEvent = {
  category: "WORKOUT";
  start_date_local: string; // RRRR-MM-DDT00:00:00
  type: string; // Ride / VirtualRide
  name: string;
  description: string;
  moving_time: number; // sekundy
  indoor: boolean;
};

// Tworzy zaplanowane treningi w kalendarzu (jednym zapytaniem).
export async function createEvents(events: NewWorkoutEvent[]) {
  const { athleteId } = getConfig();
  return intervalsFetch<IntervalsEvent[]>(`/athlete/${athleteId}/events/bulk`, {
    method: "POST",
    body: JSON.stringify(events),
  });
}

// Usuwa wydarzenie z kalendarza. Brak wydarzenia (już usunięte ręcznie) nie jest błędem.
export async function deleteEvent(eventId: number) {
  const { athleteId } = getConfig();
  try {
    await intervalsFetch<unknown>(`/athlete/${athleteId}/events/${eventId}`, { method: "DELETE" });
  } catch (e) {
    if (!(e instanceof Error && e.message.includes("404"))) throw e;
  }
}

export async function getActivity(id: string) {
  return intervalsFetch<IntervalsActivityDetail>(
    `/activity/${encodeURIComponent(id)}?intervals=true`,
  );
}

export type ActivityFeelings = {
  icu_rpe: number | null; // 1–10
  feel: number | null; // 1 = bardzo dobrze … 5 = bardzo słabo
  description: string | null;
};

// Zapisuje odczucia po treningu w intervals.icu.
export async function updateActivityFeelings(id: string, feelings: ActivityFeelings) {
  return intervalsFetch<IntervalsActivityDetail>(
    `/activity/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(feelings) },
  );
}

// Czy trening ma uzupełnione odczucia (RPE lub samopoczucie)?
export function hasFeelings(a: Pick<IntervalsActivity, "icu_rpe" | "feel">) {
  return a.icu_rpe != null || a.feel != null;
}

export async function getActivityMessages(id: string) {
  return intervalsFetch<IntervalsMessage[]>(
    `/activity/${encodeURIComponent(id)}/messages`,
  );
}
