import type { TripEntity } from "../types/travel";
import { buildTrip, resolveAirport, resolveStation, type TripInput } from "./catalog";

const COLS = ["date", "type", "code", "from", "to", "notes", "aircraft", "registration", "cabin", "seat", "trainModel", "seatClass", "departTime", "durationMin"] as const;

const q = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tripsToCsv(trips: TripEntity[]): string {
  const rows = trips.map((t) => [
    t.date, t.type === "FLIGHT" ? "flight" : "hsr", t.code, t.originId, t.destId, t.notes || "",
    t.aircraft || "", t.registration || "", t.cabin || "", t.seat || "", t.trainModel || "", t.seatClass || "",
    t.departTime || "", t.durationEstimated ? "" : t.durationMin ?? "",
  ]);
  return "\ufeff" + [COLS.join(","), ...rows.map((r) => r.map(q).join(","))].join("\n") + "\n";
}

export function tripsToJson(trips: TripEntity[]): string {
  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), trips }, null, 2);
}

export function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 带引号的 CSV 解析 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cur = "", inQ = false;
  const src = text.replace(/^\ufeff/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQ) {
      if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export interface ImportResult {
  inputs: TripInput[];
  entities: TripEntity[];
  errors: string[];
}

function rowToInput(h: string[], r: string[]): TripInput | string {
  const g = (k: string) => (r[h.indexOf(k)] || "").trim();
  const t = g("type").toLowerCase();
  const type: "FLIGHT" | "HSR" = t === "flight" || t === "flights" || t === "航班" ? "FLIGHT" : "HSR";
  const from = g("from"), to = g("to");
  let f: string | undefined, d: string | undefined;
  if (type === "FLIGHT") { f = resolveAirport(from)?.id; d = resolveAirport(to)?.id; }
  else { f = resolveStation(from)?.n; d = resolveStation(to)?.n; }
  if (!f) return `无法识别出发地「${from}」`;
  if (!d) return `无法识别到达地「${to}」`;
  const dur = Number(g("durationMin"));
  return {
    type, date: g("date"), code: g("code"), from: f, to: d, notes: g("notes"),
    aircraft: g("aircraft"), registration: g("registration"), cabin: g("cabin") || undefined,
    seat: g("seat"), trainModel: g("trainModel"), seatClass: g("seatClass") || undefined,
    departTime: g("departTime"), durationMin: dur > 0 ? dur : undefined,
  };
}

/** 解析 CSV/JSON 文本为行程;未识别的行进入 errors */
export function parseImport(text: string, filename: string): ImportResult {
  const res: ImportResult = { inputs: [], entities: [], errors: [] };
  const isJson = /\.json$/i.test(filename) || /^\s*[\[{]/.test(text);
  if (isJson) {
    let data: any;
    try { data = JSON.parse(text); } catch { res.errors.push("JSON 解析失败"); return res; }
    const list: any[] = Array.isArray(data) ? data : data.trips || [];
    list.forEach((o, i) => {
      if (o && o.originCoords && o.destCoords) {
        res.entities.push({ ...o, id: o.id || `imp_${o.date}_${o.code}_${o.originId}_${o.destId}`, year: o.year || Number(String(o.date).slice(0, 4)) });
      } else if (o && o.from && o.to) {
        const type: "FLIGHT" | "HSR" = String(o.type).toLowerCase() === "flight" ? "FLIGHT" : "HSR";
        const f = type === "FLIGHT" ? resolveAirport(o.from)?.id : resolveStation(o.from)?.n;
        const d = type === "FLIGHT" ? resolveAirport(o.to)?.id : resolveStation(o.to)?.n;
        if (!f || !d) res.errors.push(`第 ${i + 1} 条:无法识别起止点`);
        else res.inputs.push({ ...o, type, from: f, to: d });
      } else res.errors.push(`第 ${i + 1} 条:缺少必要字段`);
    });
    return res;
  }
  const rows = parseCsv(text);
  if (!rows.length) { res.errors.push("文件为空"); return res; }
  const header = rows[0].map((x) => x.trim());
  rows.slice(1).forEach((r, i) => {
    const out = rowToInput(header, r);
    if (typeof out === "string") res.errors.push(`第 ${i + 2} 行:${out}`);
    else res.inputs.push(out);
  });
  return res;
}

/** 将 inputs 构建为实体并按 (日期,编号,起,止) 去重 */
export function materialize(res: ImportResult, existing: TripEntity[]): { trips: TripEntity[]; errors: string[]; skipped: number } {
  const key = (t: { date: string; code: string; originId: string; destId: string }) => `${t.date}|${t.code}|${t.originId}|${t.destId}`;
  const seen = new Set(existing.map(key));
  const errors = [...res.errors];
  const trips: TripEntity[] = [];
  let skipped = 0;
  const push = (t: TripEntity) => { if (seen.has(key(t))) skipped++; else { seen.add(key(t)); trips.push(t); } };
  res.inputs.forEach((inp, i) => {
    const b = buildTrip(inp);
    if (!b.trip) errors.push(`第 ${i + 1} 条记录:${b.error}`);
    else push(b.trip);
  });
  for (const e of res.entities) push(e);
  return { trips, errors, skipped };
}
