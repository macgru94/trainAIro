// Zamiana struktury treningu (bloki i segmenty w % FTP) na czytelny tekst.
// Wspólne dla serwera i przeglądarki.

export type Segment = {
  czas_s: number;
  moc_od_proc_ftp: number;
  moc_do_proc_ftp: number;
  narastajaco: boolean;
  kadencja: number | null;
};

export type Block = { powtorzenia: number; segmenty: Segment[] };

export function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function watts(pct: number, ftp: number | null) {
  return ftp ? Math.round((pct / 100) * ftp) : null;
}

export function formatSegment(seg: Segment, ftp: number | null) {
  const same = seg.moc_od_proc_ftp === seg.moc_do_proc_ftp;
  const pct = same ? `${seg.moc_od_proc_ftp}%` : `${seg.moc_od_proc_ftp}–${seg.moc_do_proc_ftp}%`;
  const lo = watts(seg.moc_od_proc_ftp, ftp);
  const hi = watts(seg.moc_do_proc_ftp, ftp);
  const w = lo == null ? "" : same ? ` (${lo} W)` : ` (${lo}–${hi} W)`;
  const ramp = seg.narastajaco ? "narastająco " : "";
  const cad = seg.kadencja ? `, ${seg.kadencja} rpm` : "";
  return `${formatSeconds(seg.czas_s)} ${ramp}@ ${pct}${w}${cad}`;
}

export function formatBlock(block: Block, ftp: number | null) {
  const parts = block.segmenty.map((s) => formatSegment(s, ftp));
  return block.powtorzenia > 1 ? `${block.powtorzenia}× [ ${parts.join(" + ")} ]` : parts.join(" → ");
}
