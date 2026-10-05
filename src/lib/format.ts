// Wspólne funkcje do ładnego wyświetlania liczb i dat.

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

// Krótki zapis czasu interwału, np. 4:30 albo 1:02:15.
export function formatClock(seconds?: number | null) {
  if (!seconds) return "–";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(meters?: number | null) {
  if (!meters) return null;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDate(value?: string, long = false) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(
    "pl-PL",
    long
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", day: "numeric", month: "short" },
  );
}
