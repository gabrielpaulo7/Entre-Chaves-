/**
 * ENTRE CHAVES — Gestão de Episódios
 * ─────────────────────────────────────────────────────────────────
 * Sistema de gestão de episódios com integração Supabase.
 * ─────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  addDays, format, isValid,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth,
  addMonths, subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, Reorder, useDragControls } from "motion/react";

// ─── Supabase ────────────────────────────────────────────────────
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const url = (import.meta as any).env.VITE_SUPABASE_URL;
    const key = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase configuration missing (VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY). Please check your environment variables.");
    }
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

// ─── Constantes & tipos ──────────────────────────────────────────
const FORMATS = ["EPISÓDIO", "CORTE", "SNIPPET", "ENTRE CASES"];
const STATUSES = ["publicado", "editado", "gravado", "em gravação", "em agendamento", "pendente"];
const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const DEFAULT_RULES = [
  { format: "EPISÓDIO",     dayOfWeek: 2 },
  { format: "ENTRE CASES",  dayOfWeek: 2 },
  { format: "SNIPPET",      dayOfWeek: 4 },
  { format: "CORTE",        dayOfWeek: 5 },
];

const FORMAT_COLORS: Record<string, { bg: string; light: string; text: string }> = {
  "EPISÓDIO":    { bg: "#3b82f6", light: "rgba(59,130,246,0.15)", text: "#93c5fd" },
  "CORTE":       { bg: "#f59e0b", light: "rgba(245,158,11,0.15)", text: "#fcd34d" },
  "SNIPPET":     { bg: "#10b981", light: "rgba(16,185,129,0.15)", text: "#6ee7b7" },
  "ENTRE CASES": { bg: "#8b5cf6", light: "rgba(139,92,246,0.15)", text: "#c4b5fd" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "publicado":      { bg: "rgba(16,185,129,0.15)", text: "#6ee7b7",  dot: "#10b981" },
  "editado":        { bg: "rgba(59,130,246,0.15)", text: "#93c5fd",  dot: "#3b82f6" },
  "gravado":        { bg: "rgba(139,92,246,0.15)", text: "#c4b5fd",  dot: "#8b5cf6" },
  "em gravação":    { bg: "rgba(245,158,11,0.15)", text: "#fcd34d",  dot: "#f59e0b" },
  "em agendamento": { bg: "rgba(236,72,153,0.15)", text: "#f9a8d4",  dot: "#ec4899" },
  "pendente":       { bg: "rgba(100,116,139,0.15)", text: "#94a3b8", dot: "#64748b" },
};

const INITIAL_EPISODES = [
  { number: "259", format: "EPISÓDIO",    title: "Avaliando o potencial e os desafios do A2A na prática",       guests: "Francis Costa + Ana Carolina",                  hosts: "Fernandinha + Pedro Dantas", recordingDate: "2026-02-25", publishDate: "2026-03-10", status: "publicado",      notes: "" },
  { number: "",    format: "CORTE",       title: "Por que A2A não substitui o MCP como você pensa",            guests: "Francis Costa + Ana Carolina",                  hosts: "",                          recordingDate: null,         publishDate: "2026-03-12", status: "publicado",      notes: "" },
  { number: "260", format: "EPISÓDIO",    title: "Google Antigravity: primeiras impressões, vantagens e desafios", guests: "Joao Felipe Soares, Rodrigo Assis",          hosts: "Dudu + Fernandinha",         recordingDate: null,         publishDate: "2026-03-17", status: "publicado",      notes: "" },
  { number: "",    format: "CORTE",       title: "Antigravity inaugura uma nova forma de desenvolver?",        guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-03-19", status: "publicado",      notes: "" },
  { number: "261", format: "EPISÓDIO",    title: "O preço da dependência de IA para os desenvolvedores",       guests: "hosts",                                         hosts: "Fernandinha + Luiz + Dudu + Pedro Dantas", recordingDate: "2026-02-25", publishDate: "2026-03-24", status: "publicado", notes: "" },
  { number: "",    format: "CORTE",       title: "A IA não pode ultrapassar a capacidade do dev de pensar",    guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-03-26", status: "publicado",      notes: "" },
  { number: "24",  format: "ENTRE CASES", title: "Liquid Glass: estratégias para desenvolvimento iOS",         guests: "Leonardo Modro + Taissa Ferreira",              hosts: "Dudu + Luiz",               recordingDate: "2026-03-03", publishDate: "2026-03-31", status: "editado",        notes: "" },
  { number: "",    format: "CORTE",       title: "O que realmente muda quando se adota o Liquid Glass",        guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-04-02", status: "editado",        notes: "" },
  { number: "262", format: "EPISÓDIO",    title: "OWASP Top 10 (Parte 1)",                                     guests: "Lucas Assunção + Tales de Oliveira",            hosts: "Pedro Dantas + Rafa",       recordingDate: "2026-03-11", publishDate: "2026-04-07", status: "gravado",        notes: "" },
  { number: "11",  format: "SNIPPET",     title: "Event Loop em Javascript",                                   guests: "Júlia de Castro",                               hosts: "",                          recordingDate: null,         publishDate: "2026-04-09", status: "gravado",        notes: "" },
  { number: "",    format: "CORTE",       title: "",                                                           guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-04-10", status: "pendente",       notes: "" },
  { number: "263", format: "EPISÓDIO",    title: "OWASP Top 10 (Parte 2)",                                     guests: "Lucas Assunção + Tales de Oliveira",            hosts: "Pedro Dantas + Rafa",       recordingDate: null,         publishDate: "2026-04-14", status: "gravado",        notes: "" },
  { number: "12",  format: "SNIPPET",     title: "Arquitetura e organização de APIs no back-end",              guests: "Artur Colen",                                   hosts: "",                          recordingDate: null,         publishDate: "2026-04-16", status: "gravado",        notes: "" },
  { number: "",    format: "CORTE",       title: "",                                                           guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-04-17", status: "pendente",       notes: "" },
  { number: "264", format: "EPISÓDIO",    title: "Engenharia de Contexto vs Engenharia de Prompt",             guests: "Hammer + Givaldo",                              hosts: "Fernandinha + Rafa",        recordingDate: null,         publishDate: "2026-04-21", status: "gravado",        notes: "" },
  { number: "13",  format: "SNIPPET",     title: "Microsoft writing style guide",                              guests: "Sandro Renzzo",                                 hosts: "",                          recordingDate: null,         publishDate: "2026-04-23", status: "gravado",        notes: "" },
  { number: "",    format: "CORTE",       title: "",                                                           guests: "",                                              hosts: "",                          recordingDate: null,         publishDate: "2026-04-24", status: "pendente",       notes: "" },
  { number: "265", format: "EPISÓDIO",    title: "A nova era do JavaScript",                                   guests: "Elaine Cruz, Lucas Vilas Boas",                 hosts: "Luiz + Dudu",               recordingDate: "2026-03-23", publishDate: "2026-04-28", status: "gravado",        notes: "" },
  { number: "14",  format: "SNIPPET",     title: "Shift Left no contexto de QA",                               guests: "Henrique Oliveira",                             hosts: "",                          recordingDate: null,         publishDate: "2026-04-30", status: "em gravação",    notes: "" },
  { number: "266", format: "EPISÓDIO",    title: "Crafty Round - engenharia + produto",                        guests: "Clesio Silva, Henrique Machado, Anna Souza",    hosts: "Fernandinha + Dudu",        recordingDate: "2026-03-31", publishDate: "2026-05-05", status: "em gravação",    notes: "" },
  { number: "15",  format: "SNIPPET",     title: "Git + AI para Troubleshooting de Incidentes",               guests: "Thiago Vieira",                                 hosts: "",                          recordingDate: null,         publishDate: "2026-05-07", status: "gravado",        notes: "" },
  { number: "267", format: "EPISÓDIO",    title: "Novidades do Claude Code",                                   guests: "Breno Barbosa, Maycon Douglas",                 hosts: "Dantas + Fernandinha",      recordingDate: "2026-04-01", publishDate: "2026-05-12", status: "em gravação",    notes: "" },
  { number: "25",  format: "ENTRE CASES", title: "Ecossistema Digital Multi-Marcas (Pardini/Fleury)",          guests: "Rodrigo Meyer",                                 hosts: "Fernandinha",               recordingDate: "2026-04-01", publishDate: "2026-05-19", status: "em agendamento", notes: "" },
  { number: "268", format: "EPISÓDIO",    title: "Architecture Decision Record",                               guests: "Sandro Renzzo, Jéssica Rocha",                  hosts: "Dudu + Rafa",               recordingDate: "2026-04-06", publishDate: "2026-05-26", status: "em gravação",    notes: "" },
  { number: "269", format: "EPISÓDIO",    title: "Ferramentas de IA do Google",                                guests: "hosts",                                         hosts: "",                          recordingDate: null,         publishDate: "2026-06-02", status: "pendente",       notes: "" },
  { number: "270", format: "EPISÓDIO",    title: "2026 Agentic Coding Trends Report",                          guests: "hosts",                                         hosts: "",                          recordingDate: null,         publishDate: "2026-06-09", status: "pendente",       notes: "" },
  { number: "271", format: "EPISÓDIO",    title: "Harness Design/Engineering",                                 guests: "hosts",                                         hosts: "",                          recordingDate: null,         publishDate: "2026-06-16", status: "pendente",       notes: "" },
];

// ─── Helpers ─────────────────────────────────────────────────────
function parseDate(str: string | null) {
  if (!str) return null;
  const d = new Date(str + "T00:00:00");
  return isValid(d) ? d : null;
}
function fmtDisplay(str: string | null) {
  const d = parseDate(str);
  return d ? format(d, "dd/MM/yyyy") : "—";
}
function genId() { return crypto.randomUUID(); }

function recalcDates(episodes: any[], fromIdx: number, rules: any[]) {
  if (fromIdx <= 0 || !episodes.length) return episodes;
  const updated = [...episodes];
  const ruleMap = new Map(rules.map(r => [r.format, r.dayOfWeek]));
  for (let i = fromIdx; i < updated.length; i++) {
    const prev = parseDate(updated[i - 1].publishDate);
    if (!prev) continue;
    const target = ruleMap.get(updated[i].format);
    if (target === undefined) continue;
    let next = addDays(prev, 1);
    while (next.getDay() !== target) next = addDays(next, 1);
    updated[i] = { ...updated[i], publishDate: format(next, "yyyy-MM-dd") };
  }
  return updated;
}

function applyDayRule(episodes: any[], fmt: string, newDay: number, fromDate: Date) {
  const updated = [...episodes];
  let last: Date | null = null;
  for (let i = 0; i < updated.length; i++) {
    if (updated[i].format !== fmt) continue;
    const d = parseDate(updated[i].publishDate);
    if (!d || d < fromDate) { last = d; continue; }
    let base = last ? addDays(last, 1) : fromDate;
    let next = base;
    while (next.getDay() !== newDay) next = addDays(next, 1);
    while (next < fromDate) next = addDays(next, 7);
    updated[i] = { ...updated[i], publishDate: format(next, "yyyy-MM-dd") };
    last = next;
  }
  return updated;
}

// ─── DB helpers ──────────────────────────────────────────────────
function toDb(ep: any) {
  return {
    id: ep.id,
    number: ep.number || "",
    format: ep.format,
    title: ep.title || "",
    guests: ep.guests || "",
    hosts: ep.hosts || "",
    recording_date: ep.recordingDate || null,
    publish_date: ep.publishDate || null,
    status: ep.status,
    notes: ep.notes || "",
    sort_order: ep.sortOrder ?? 0,
  };
}
function fromDb(row: any) {
  return {
    id: row.id,
    number: row.number || "",
    format: row.format,
    title: row.title || "",
    guests: row.guests || "",
    hosts: row.hosts || "",
    recordingDate: row.recording_date || null,
    publishDate: row.publish_date || "",
    status: row.status,
    notes: row.notes || "",
    sortOrder: row.sort_order ?? 0,
  };
}
async function logHistory(episodeId: string, field: string, oldVal: any, newVal: any) {
  try {
    await getSupabase().from("episode_history").insert({
      episode_id: episodeId,
      field_changed: field,
      old_value: oldVal != null ? String(oldVal) : null,
      new_value: newVal != null ? String(newVal) : null,
      changed_by: "equipe",
    });
  } catch (e) {
    console.error("Failed to log history:", e);
  }
}

// ─── Context ─────────────────────────────────────────────────────
interface EpisodeContextType {
  episodes: any[];
  rules: any[];
  loading: boolean;
  error: string | null;
  addEpisode: (ep: any) => Promise<void>;
  updateEpisode: (id: string, updates: any) => Promise<void>;
  deleteEpisode: (id: string) => Promise<void>;
  updatePublishDate: (id: string, date: string) => Promise<void>;
  reorderEpisode: (from: number, to: number) => Promise<void>;
  updateFormatRule: (fmt: string, day: number) => void;
}

const Ctx = createContext<EpisodeContextType | null>(null);
function useEpisodes() {
  const c = useContext(Ctx);
  if (!c) throw new Error("missing provider");
  return c;
}

function Provider({ children }: { children: React.ReactNode }) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [rules, setRules] = useState(() => {
    try { return JSON.parse(localStorage.getItem("podcast-rules") || "") || DEFAULT_RULES; }
    catch { return DEFAULT_RULES; }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skipIds = useRef(new Set());

  // Load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await getSupabase()
          .from("episodes").select("*").order("sort_order", { ascending: true });
        if (error) { setError(error.message); setLoading(false); return; }
        if (data.length === 0) {
          // Seed initial data on first load
          const seeded = INITIAL_EPISODES.map((ep, i) => ({
            ...toDb({ ...ep, id: genId(), sortOrder: i }),
          }));
          await getSupabase().from("episodes").insert(seeded);
          setEpisodes(seeded.map(fromDb));
        } else {
          setEpisodes(data.map(fromDb));
        }
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Persist rules
  useEffect(() => {
    localStorage.setItem("podcast-rules", JSON.stringify(rules));
  }, [rules]);

  // Realtime
  useEffect(() => {
    let ch: any = null;
    try {
      ch = getSupabase().channel("ep-rt")
        .on("postgres_changes", { event: "*", schema: "public", table: "episodes" }, (payload: any) => {
          const id = payload.new?.id || payload.old?.id;
          if (skipIds.current.has(id)) { skipIds.current.delete(id); return; }
          if (payload.eventType === "INSERT") {
            setEpisodes(p => [...p, fromDb(payload.new)].sort((a, b) => a.sortOrder - b.sortOrder));
          } else if (payload.eventType === "UPDATE") {
            const up = fromDb(payload.new);
            setEpisodes(p => p.map(e => e.id === up.id ? up : e).sort((a, b) => a.sortOrder - b.sortOrder));
          } else if (payload.eventType === "DELETE") {
            setEpisodes(p => p.filter(e => e.id !== payload.old.id));
          }
        }).subscribe();
    } catch (e) {
      console.error("Realtime subscription failed:", e);
    }
    return () => { if (ch) getSupabase().removeChannel(ch); };
  }, []);

  const addEpisode = useCallback(async (ep: any) => {
    const newEp = { ...ep, id: genId(), sortOrder: episodes.length };
    skipIds.current.add(newEp.id);
    setEpisodes(p => [...p, newEp]);
    try {
      const { error } = await getSupabase().from("episodes").insert(toDb(newEp));
      if (error) { setError(error.message); setEpisodes(p => p.filter(e => e.id !== newEp.id)); }
    } catch (e: any) {
      setError(e.message);
      setEpisodes(p => p.filter(e => e.id !== newEp.id));
    }
  }, [episodes.length]);

  const updateEpisode = useCallback(async (id: string, updates: any) => {
    const prev = episodes.find(e => e.id === id);
    if (!prev) return;
    const next = { ...prev, ...updates };
    skipIds.current.add(id);
    setEpisodes(p => p.map(e => e.id === id ? next : e));
    try {
      const { error } = await getSupabase().from("episodes").update(toDb(next)).eq("id", id);
      if (error) { setError(error.message); setEpisodes(p => p.map(e => e.id === id ? prev : e)); return; }
      for (const [f, v] of Object.entries(updates)) {
        if (prev[f] !== v) logHistory(id, f, prev[f], v);
      }
    } catch (e: any) {
      setError(e.message);
      setEpisodes(p => p.map(e => e.id === id ? prev : e));
    }
  }, [episodes]);

  const deleteEpisode = useCallback(async (id: string) => {
    const prev = episodes.find(e => e.id === id);
    skipIds.current.add(id);
    setEpisodes(p => p.filter(e => e.id !== id));
    try {
      const { error } = await getSupabase().from("episodes").delete().eq("id", id);
      if (error) { setError(error.message); if (prev) setEpisodes(p => [...p, prev].sort((a,b)=>a.sortOrder-b.sortOrder)); }
    } catch (e: any) {
      setError(e.message);
      if (prev) setEpisodes(p => [...p, prev].sort((a,b)=>a.sortOrder-b.sortOrder));
    }
  }, [episodes]);

  const updatePublishDate = useCallback(async (id: string, date: string) => {
    const idx = episodes.findIndex(e => e.id === id);
    if (idx === -1) return;
    const updated = [...episodes];
    updated[idx] = { ...updated[idx], publishDate: date };
    const recalc = recalcDates(updated, idx + 1, rules);
    setEpisodes(recalc);
    try {
      for (const ep of recalc.slice(idx)) {
        skipIds.current.add(ep.id);
        await getSupabase().from("episodes").update(toDb(ep)).eq("id", ep.id);
      }
      logHistory(id, "publishDate", episodes[idx].publishDate, date);
    } catch (e: any) {
      setError(e.message);
    }
  }, [episodes, rules]);

  const reorderEpisode = useCallback(async (from: number, to: number) => {
    const updated = [...episodes];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    const recalc = recalcDates(updated, Math.min(from, to), rules).map((e, i) => ({ ...e, sortOrder: i }));
    setEpisodes(recalc);
    try {
      const { error } = await getSupabase().from("episodes").upsert(recalc.map(toDb));
      if (error) setError(error.message);
    } catch (e: any) {
      setError(e.message);
    }
  }, [episodes, rules]);

  const updateFormatRule = useCallback((fmt: string, day: number) => {
    setRules((p: any[]) => p.map(r => r.format === fmt ? { ...r, dayOfWeek: day } : r));
    setEpisodes(p => applyDayRule(p, fmt, day, new Date()));
  }, []);

  return (
    <Ctx.Provider value={{ episodes, rules, loading, error, addEpisode, updateEpisode, deleteEpisode, updatePublishDate, reorderEpisode, updateFormatRule }}>
      {children}
    </Ctx.Provider>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────
function MiniCal({ selected, onChange, onClose }: { selected: string | null; onChange: (d: string) => void; onClose: () => void }) {
  const [month, setMonth] = useState(selected ? parseDate(selected) || new Date() : new Date());
  const mStart = startOfMonth(month);
  const mEnd   = endOfMonth(month);
  const days   = eachDayOfInterval({ start: startOfWeek(mStart, { weekStartsOn: 1 }), end: endOfWeek(mEnd, { weekStartsOn: 1 }) });
  const today  = new Date();

  return (
    <div className="date-popover" onClick={e => e.stopPropagation()}>
      <div className="cal-header">
        <button className="cal-nav" onClick={() => setMonth(subMonths(month, 1))}>‹</button>
        <span>{format(month, "MMMM yyyy", { locale: ptBR })}</span>
        <button className="cal-nav" onClick={() => setMonth(addMonths(month, 1))}>›</button>
      </div>
      <div className="cal-grid">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}
        {days.map((day, i) => {
          const isOther = !isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          const isSel   = selected && isSameDay(day, parseDate(selected) as Date);
          return (
            <button
              key={i}
              className={`cal-day${isOther ? " other" : ""}${isToday ? " today" : ""}${isSel ? " selected" : ""}`}
              onClick={() => { onChange(format(day, "yyyy-MM-dd")); onClose(); }}
            >
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Episode Row ─────────────────────────────────────────────────
function EpRow({ episode, idx, reorderable = true }: { episode: any; idx: number; reorderable?: boolean; key?: any }) {
  const { updateEpisode, updatePublishDate, deleteEpisode } = useEpisodes();
  const [expanded, setExpanded] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [showRecCal, setShowRecCal] = useState(false);
  const controls = useDragControls();

  const fc = FORMAT_COLORS[episode.format] || FORMAT_COLORS["EPISÓDIO"];
  const sc = STATUS_COLORS[episode.status] || STATUS_COLORS["pendente"];

  useEffect(() => {
    if (!showCal && !showRecCal) return;
    const close = () => { setShowCal(false); setShowRecCal(false); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [showCal, showRecCal]);

  const rowContent = (
    <>
      <div className="ep-main">
        <div className={`col-drag ${reorderable ? "drag-handle" : ""}`} onPointerDown={reorderable ? (e) => controls.start(e) : undefined}>
          {reorderable && (
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <circle cx="5" cy="4" r="1.2"/><circle cx="5" cy="8" r="1.2"/><circle cx="5" cy="12" r="1.2"/>
              <circle cx="11" cy="4" r="1.2"/><circle cx="11" cy="8" r="1.2"/><circle cx="11" cy="12" r="1.2"/>
            </svg>
          )}
        </div>
        <div className="ep-num">{episode.number ? `#${episode.number}` : "—"}</div>
        <div className="ep-fmt-badge" style={{ background: fc.light, color: fc.text, borderColor: fc.bg + "40" }}>
          {episode.format}
        </div>
        <div className="ep-title-area">
          <div className="ep-title">{episode.title || <span style={{color:"var(--text3)",fontStyle:"italic"}}>Sem título</span>}</div>
          {episode.guests && <div className="ep-guests">🎙️ {episode.guests}</div>}
          {episode.hosts && <div className="ep-hosts">👤 {episode.hosts}</div>}
        </div>

        {/* Date picker */}
        <div className="popover-wrap" style={{ width: 90, textAlign: "right" }}>
          <button className="ep-date-btn" onClick={e => { e.stopPropagation(); setShowCal(v => !v); setShowRecCal(false); }}>
            📅 {fmtDisplay(episode.publishDate)}
          </button>
          {showCal && (
            <MiniCal
              selected={episode.publishDate}
              onChange={date => updatePublishDate(episode.id, date)}
              onClose={() => setShowCal(false)}
            />
          )}
        </div>

        <select
          className="status-select"
          value={episode.status}
          style={{ background: sc.bg, color: sc.text }}
          onChange={e => updateEpisode(episode.id, { status: e.target.value })}
        >
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <button className="icon-btn" onClick={() => setExpanded(v => !v)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {expanded
              ? <path d="M4 10l4-4 4 4"/>
              : <path d="M4 6l4 4 4-4"/>
            }
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="ep-expanded">
          <div className="field-group">
            <label>Hosts</label>
            <input className="field-input" value={episode.hosts} placeholder="Hosts..."
              onChange={e => updateEpisode(episode.id, { hosts: e.target.value })} />
          </div>
          <div className="field-group">
            <label>Convidados</label>
            <input className="field-input" value={episode.guests} placeholder="Convidados..."
              onChange={e => updateEpisode(episode.id, { guests: e.target.value })} />
          </div>
          <div className="field-group" style={{ position: "relative" }}>
            <label>Data de Gravação</label>
            <div className="popover-wrap">
              <button className="field-input" style={{ textAlign: "left", cursor: "pointer", background: "var(--surface2)" }}
                onClick={e => { e.stopPropagation(); setShowRecCal(v => !v); setShowCal(false); }}>
                {episode.recordingDate ? fmtDisplay(episode.recordingDate) : "Selecionar..."}
              </button>
              {showRecCal && (
                <MiniCal
                  selected={episode.recordingDate}
                  onChange={date => updateEpisode(episode.id, { recordingDate: date })}
                  onClose={() => setShowRecCal(false)}
                />
              )}
            </div>
          </div>
          <div className="field-group">
            <label>Observações</label>
            <input className="field-input" value={episode.notes} placeholder="Notas..."
              onChange={e => updateEpisode(episode.id, { notes: e.target.value })} />
          </div>
          <div className="col-span-2">
            <button className="delete-btn" onClick={() => deleteEpisode(episode.id)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" width="13" height="13">
                <path d="M3 4h10M6 4V2h4v2M5 4l.5 9h5L11 4"/>
              </svg>
              Remover
            </button>
          </div>
        </div>
      )}
    </>
  );

  if (!reorderable) {
    return (
      <div className="ep-row" style={{ animationDelay: `${idx * 0.018}s`, zIndex: (showCal || showRecCal) ? 100 : 1 }}>
        {rowContent}
      </div>
    );
  }

  return (
    <Reorder.Item
      as="div"
      value={episode}
      dragListener={false}
      dragControls={controls}
      className="ep-row"
      style={{ animationDelay: `${idx * 0.018}s`, zIndex: (showCal || showRecCal) ? 100 : 1 }}
    >
      {rowContent}
    </Reorder.Item>
  );
}

// ─── Episode List ─────────────────────────────────────────────────
function EpisodeList() {
  const { episodes, loading, error, reorderEpisode } = useEpisodes();
  const [filter, setFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [isPublishedMinimized, setIsPublishedMinimized] = useState(false);

  const baseFiltered = episodes.filter(e => {
    const matchesFormat = filter === "ALL" || e.format === filter;
    const date = parseDate(e.publishDate);
    const matchesStart = !startDate || (date && date >= parseDate(startDate)!);
    const matchesEnd = !endDate || (date && date <= parseDate(endDate)!);
    return matchesFormat && matchesStart && matchesEnd;
  });

  const production = baseFiltered.filter(e => e.status !== "publicado");
  const published = baseFiltered.filter(e => e.status === "publicado");

  const handleReorder = (newOrder: any[]) => {
    if (filter === "ALL") {
      // Find what moved in the production list
      const movedIdx = production.findIndex((ep, i) => ep.id !== newOrder[i].id);
      if (movedIdx === -1) return;
      
      // Find the global index in the original episodes array
      const fromGlobal = episodes.findIndex(e => e.id === production[movedIdx].id);
      const toGlobal = episodes.findIndex(e => e.id === newOrder[movedIdx].id);
      
      if (fromGlobal !== -1 && toGlobal !== -1) {
        reorderEpisode(fromGlobal, toGlobal);
      }
    }
  };

  if (loading) return (
    <div className="loading-state">
      <div className="spinner" />
      <span>Carregando episódios...</span>
    </div>
  );

  if (error) return (
    <div className="error-state">
      <span style={{ fontSize: 28 }}>⚠️</span>
      <span className="error-msg">Erro ao conectar: {error}</span>
      <button className="btn-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="filter-bar">
        <div className="filter-chips">
          {["ALL", ...FORMATS].map(f => (
            <button key={f} className={`chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
              {f === "ALL" ? "Todos" : f}
            </button>
          ))}
        </div>

        <div className="date-filters">
          <div className="date-input-group">
            <label>De:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="date-input-group">
            <label>Até:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          {(startDate || endDate) && (
            <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => { setStartDate(""); setEndDate(""); }}>Limpar</button>
          )}
        </div>

        <button className="add-btn" onClick={() => setShowAdd(true)}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          Novo Episódio
        </button>
      </div>

      <div className="list-columns">
        {/* Production Column */}
        <div className="list-column">
          <div className="column-header">
            <h3>Em Produção</h3>
            <span className="column-count">{production.length}</span>
          </div>
          <div className="table-head">
            <div className="col-drag" />
            <div className="col-num">Nº</div>
            <div className="col-fmt">Formato</div>
            <div className="col-title">Título / Convidados</div>
            <div className="col-date">Publicação</div>
            <div className="col-status">Status</div>
            <div className="col-expand" />
          </div>
          <div className="episodes-scroll">
            <Reorder.Group as="div" axis="y" values={production} onReorder={handleReorder}>
              {production.map((ep, i) => <EpRow key={ep.id} episode={ep} idx={i} />)}
            </Reorder.Group>
            {production.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "var(--text3)", fontSize: 13 }}>
                Nenhum episódio em produção.
              </div>
            )}
          </div>
        </div>

        {/* Published Column */}
        <div 
          className={`list-column ${isPublishedMinimized ? "minimized" : ""}`} 
          style={{ borderLeft: "1px solid var(--border)" }}
          onClick={() => isPublishedMinimized && setIsPublishedMinimized(false)}
        >
          <div className="column-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: isPublishedMinimized ? "column" : "row" }}>
              <button className="minimize-btn" onClick={() => setIsPublishedMinimized(!isPublishedMinimized)} title={isPublishedMinimized ? "Expandir" : "Minimizar"}>
                {isPublishedMinimized ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                    <path d="M11 4l-4 4 4 4M7 4l-4 4 4 4"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                    <path d="M5 4l4 4-4 4M9 4l4 4-4 4"/>
                  </svg>
                )}
              </button>
              <h3>Publicados</h3>
            </div>
            <span className="column-count">{published.length}</span>
          </div>
          <div className="table-head">
            <div className="col-drag" />
            <div className="col-num">Nº</div>
            <div className="col-fmt">Formato</div>
            <div className="col-title">Título / Convidados</div>
            <div className="col-date">Publicação</div>
            <div className="col-status">Status</div>
            <div className="col-expand" />
          </div>
          <div className="episodes-scroll">
            {published.map((ep, i) => <EpRow key={ep.id} episode={ep} idx={i} reorderable={false} />)}
            {published.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "var(--text3)", fontSize: 13 }}>
                Nenhum episódio publicado encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────
function AddModal({ onClose }: { onClose: () => void }) {
  const { addEpisode } = useEpisodes();
  const [form, setForm] = useState({
    number: "", format: "EPISÓDIO", title: "", guests: "", hosts: "",
    publishDate: format(new Date(), "yyyy-MM-dd"), status: "pendente",
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    addEpisode({ ...form, recordingDate: null, notes: "" });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>Novo Episódio</h3>
        <form onSubmit={submit}>
          <div className="form-grid">
            <div className="form-field">
              <label>Número</label>
              <input value={form.number} onChange={e => set("number", e.target.value)} placeholder="Ex: 272" />
            </div>
            <div className="form-field">
              <label>Formato</label>
              <select value={form.format} onChange={e => set("format", e.target.value)}>
                {FORMATS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div className="form-field full">
              <label>Título</label>
              <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="Título do episódio..." />
            </div>
            <div className="form-field">
              <label>Convidados</label>
              <input value={form.guests} onChange={e => set("guests", e.target.value)} placeholder="Convidados..." />
            </div>
            <div className="form-field">
              <label>Hosts</label>
              <input value={form.hosts} onChange={e => set("hosts", e.target.value)} placeholder="Hosts..." />
            </div>
            <div className="form-field">
              <label>Data de Publicação</label>
              <input type="date" value={form.publishDate} onChange={e => set("publishDate", e.target.value)} />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary">Adicionar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────
function CalendarView() {
  const { episodes } = useEpisodes();
  const [month, setMonth] = useState(new Date());

  const mStart = startOfMonth(month);
  const mEnd   = endOfMonth(month);
  const days   = eachDayOfInterval({ start: startOfWeek(mStart, { weekStartsOn: 1 }), end: endOfWeek(mEnd, { weekStartsOn: 1 }) });
  const today  = new Date();

  const byDate = new Map<string, any[]>();
  episodes.forEach(ep => {
    const d = parseDate(ep.publishDate);
    if (!d) return;
    const k = format(d, "yyyy-MM-dd");
    if (!byDate.has(k)) byDate.set(k, []);
    byDate.get(k)?.push(ep);
  });

  return (
    <div className="calendar-view">
      <div className="cal-view-header">
        <h2>{format(month, "MMMM yyyy", { locale: ptBR })}</h2>
        <div className="cal-view-nav">
          <button className="icon-btn" onClick={() => setMonth(subMonths(month, 1))}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
          </button>
          <button className="btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setMonth(new Date())}>Hoje</button>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
          </button>
        </div>
      </div>

      <div className="cal-view-grid">
        {["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map(d => (
          <div key={d} className="cal-view-head">{d}</div>
        ))}
        {days.map((day, i) => {
          const key = format(day, "yyyy-MM-dd");
          const dayEps = byDate.get(key) || [];
          const isOther = !isSameMonth(day, month);
          const isToday = isSameDay(day, today);
          return (
            <div key={i} className={`cal-view-cell${isOther ? " other-month" : ""}${isToday ? " is-today" : ""}`}>
              <div className={`cal-day-num${isToday ? " today-num" : ""}`}>{format(day, "d")}</div>
              {dayEps.map(ep => {
                const fc = FORMAT_COLORS[ep.format] || FORMAT_COLORS["EPISÓDIO"];
                return (
                  <div key={ep.id} className="cal-ep-pill" title={`${ep.format}: ${ep.title}`}>
                    <div className="cal-ep-dot" style={{ background: fc.bg }} />
                    <span className="cal-ep-text">{ep.number ? `#${ep.number} ` : ""}{ep.title || ep.format}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="cal-legend">
        {FORMATS.map(f => (
          <div key={f} className="legend-item">
            <div className="legend-dot" style={{ background: FORMAT_COLORS[f].bg }} />
            {f}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Format Settings ──────────────────────────────────────────────
function FormatSettings() {
  const { rules, updateFormatRule } = useEpisodes();
  return (
    <div className="settings-view">
      <h2>Regras de Publicação</h2>
      <p>Configure o dia da semana de publicação para cada formato. Ao alterar, todos os episódios futuros desse formato terão suas datas ajustadas automaticamente.</p>
      {FORMATS.map(f => {
        const rule = rules.find(r => r.format === f);
        const day = rule?.dayOfWeek ?? 2;
        return (
          <div key={f} className="rule-card">
            <span>{f}</span>
            <select
              className="rule-select"
              value={String(day)}
              style={{ background: "var(--surface)", color: "var(--text)" }}
              onChange={e => updateFormatRule(f, parseInt(e.target.value))}
            >
              {DAY_NAMES.map((name, i) => <option key={i} value={String(i)}>{name}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sidebar Stats ───────────────────────────────────────────────
function SidebarStats() {
  const { episodes } = useEpisodes();
  const total      = episodes.length;
  const publicado  = episodes.filter(e => e.status === "publicado").length;
  const producao   = episodes.filter(e => e.status !== "publicado").length;
  return (
    <div className="sidebar-stats">
      <div className="stat-row"><span className="label">Total</span><span className="val">{total}</span></div>
      <div className="stat-row"><span className="label">Publicados</span><span className="val green">{publicado}</span></div>
      <div className="stat-row"><span className="label">Em produção</span><span className="val blue">{producao}</span></div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("list");

  return (
    <Provider>
      <div className="app">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-icon">🎙️</div>
            <div className="logo-text">
              <h1>Entre Chaves</h1>
              <p>Gestão de Episódios</p>
            </div>
          </div>
          <nav className="sidebar-nav">
            {[
              { id: "list",     label: "Episódios",     icon: "☰" },
              { id: "calendar", label: "Calendário",    icon: "📅" },
              { id: "settings", label: "Configurações", icon: "⚙️" },
            ].map(item => (
              <button
                key={item.id}
                className={`nav-btn${view === item.id ? " active" : ""}`}
                onClick={() => setView(item.id)}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <SidebarStats />
        </aside>

        {/* Main */}
        <main className="main">
          <header className="main-header">
            <h2>
              {view === "list" && "Episódios"}
              {view === "calendar" && "Calendário"}
              {view === "settings" && "Configurações"}
            </h2>
            <div className="realtime-badge">
              <div className="realtime-dot" />
              tempo real
            </div>
          </header>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {view === "list"     && <EpisodeList />}
            {view === "calendar" && <CalendarView />}
            {view === "settings" && <FormatSettings />}
          </div>
        </main>
      </div>
    </Provider>
  );
}
