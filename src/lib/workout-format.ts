// Zamiana struktury treningu (bloki i segmenty w % FTP) na czytelny tekst
// oraz na format treningu intervals.icu. Wspólne dla serwera i przeglądarki.

export type Segment = {
  nazwa?: string;
  czas_s: number;
  moc_od_proc_ftp: number;
  moc_do_proc_ftp: number;
  narastajaco: boolean;
  kadencja_od?: number;
  kadencja_do?: number;
  kadencja?: number | null; // starsze plany (sprzed zakresów kadencji)
  odczucia?: string;
  wskazowki?: string;
};

export type Block = { powtorzenia: number; segmenty: Segment[] };

export type WorkoutDay = {
  nazwa: string;
  cel: string;
  czas_min: number;
  w_domu: boolean;
  bloki: Block[];
};

export function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function watts(pct: number, ftp: number | null) {
  return ftp ? Math.round((pct / 100) * ftp) : null;
}

function range(lo: number, hi: number, unit: string) {
  return lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`;
}

function cadenceRange(seg: Segment) {
  if (seg.kadencja_od && seg.kadencja_do) return [seg.kadencja_od, seg.kadencja_do] as const;
  if (seg.kadencja) return [seg.kadencja, seg.kadencja] as const;
  return null;
}

export function formatSegment(seg: Segment, ftp: number | null) {
  const pct = range(seg.moc_od_proc_ftp, seg.moc_do_proc_ftp, "%");
  const lo = watts(seg.moc_od_proc_ftp, ftp);
  const hi = watts(seg.moc_do_proc_ftp, ftp);
  const w = lo == null || hi == null ? "" : ` (${range(lo, hi, " W")})`;
  const ramp = seg.narastajaco ? "narastająco " : "";
  const cad = cadenceRange(seg);
  return `${formatSeconds(seg.czas_s)} ${ramp}@ ${pct}${w}${cad ? `, ${range(cad[0], cad[1], " rpm")}` : ""}`;
}

export function formatBlock(block: Block, ftp: number | null) {
  const parts = block.segmenty.map((s) => formatSegment(s, ftp));
  return block.powtorzenia > 1 ? `${block.powtorzenia}× [ ${parts.join(" + ")} ]` : parts.join(" → ");
}

// --- Format intervals.icu ---
// Linie zaczynające się od „-” to kroki treningu, „3x” to powtórzenia.
// Notatki piszemy z „•”, żeby intervals.icu nie wziął ich za kroki.

function intervalsDuration(secs: number) {
  return secs % 60 === 0 ? `${secs / 60}m` : `${secs}s`;
}

function intervalsStep(seg: Segment) {
  // Nazwa bez cyfr i znaków, które intervals.icu mógłby wziąć za parametry kroku.
  const name = (seg.nazwa ?? "").replace(/[0-9%x×-]/gi, " ").replace(/\s+/g, " ").trim();
  const power =
    seg.moc_od_proc_ftp === seg.moc_do_proc_ftp
      ? `${seg.moc_od_proc_ftp}%`
      : `${seg.narastajaco ? "ramp " : ""}${seg.moc_od_proc_ftp}-${seg.moc_do_proc_ftp}%`;
  const cad = cadenceRange(seg);
  const cadence = cad ? ` ${cad[0] === cad[1] ? cad[0] : `${cad[0]}-${cad[1]}`}rpm` : "";
  return `- ${name ? `${name} ` : ""}${intervalsDuration(seg.czas_s)} ${power}${cadence}`;
}

function segmentNote(seg: Segment, ftp: number | null) {
  const head = `${seg.nazwa ?? "Segment"} (${formatSegment(seg, ftp)})`;
  const tail = [seg.odczucia, seg.wskazowki].filter(Boolean).join(" ");
  return `• ${head}${tail ? `: ${tail}` : ""}`;
}

// Opis treningu dla intervals.icu: cel, komentarze do segmentów i struktura.
export function toIntervalsDescription(day: WorkoutDay, ftp: number | null) {
  const notes = day.bloki
    .map((b) => {
      const segs = b.segmenty.map((s) => segmentNote(s, ftp)).join("\n");
      return b.powtorzenia > 1 ? `Powtórz ${b.powtorzenia} razy:\n${segs}` : segs;
    })
    .join("\n");

  const structure = day.bloki
    .map((b) => {
      const steps = b.segmenty.map(intervalsStep).join("\n");
      return b.powtorzenia > 1 ? `${b.powtorzenia}x\n${steps}` : steps;
    })
    .join("\n\n");

  return `${day.cel}

Jak jechać:
${notes}

Plan z aplikacji trainAIro.

${structure}`;
}
