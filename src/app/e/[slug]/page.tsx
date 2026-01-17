"use client";

import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import {
  Calendar,
  MapPin,
  Coffee,
  Play,
  ChevronDown,
  User,
  Image as ImageIcon,
  MessageSquare,
  Music,
  Loader2,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- helpers ----
function safeParseTheme(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}
function ensureVariants(t: any) {
  const v = (t && typeof t === "object" ? t.variants : null) ?? {};
  const hero = typeof v.hero === "string" ? v.hero : "poster";
  const card = typeof v.card === "string" ? v.card : "glass";
  const program = typeof v.program === "string" ? v.program : "timeline";

  const heroOk = hero === "poster" || hero === "simple";
  const cardOk = card === "glass" || card === "plain";
  const programOk = program === "timeline" || program === "list";

  return {
    hero: heroOk ? hero : "poster",
    card: cardOk ? card : "glass",
    program: programOk ? program : "timeline",
  };
}
function varCss(palette: any) {
  const p = palette ?? {};
  const bg = p.bg ?? "#ffffff";
  const card = p.card ?? "#f8fafc";
  const text = p.text ?? "#1e293b";
  const muted = p.muted ?? "#64748b";
  const accent = p.accent ?? "#3b82f6";
  const border = p.border ?? "#e2e8f0";

  return `
:root{
  --bg:${bg};
  --card:${card};
  --text:${text};
  --muted:${muted};
  --accent:${accent};
  --border:${border};
}
`;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- load + realtime ----
  useEffect(() => {
    let channel: any;

    async function run() {
      setLoading(true);

      const { data: e, error: eErr } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .single();

      if (eErr || !e) {
        setLoading(false);
        setEvent(null);
        return;
      }
      setEvent(e);

      const fetchBlocks = async () => {
        const { data: b } = await supabase
          .from("blocks")
          .select("*")
          .eq("event_id", e.id)
          .order("sort_order", { ascending: true });
        setBlocks(b ?? []);
      };
      await fetchBlocks();
      setLoading(false);

      channel = supabase
        .channel("viewer-updates")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${e.id}` },
          (payload) => setEvent((prev: any) => ({ ...(prev ?? {}), ...(payload.new ?? {}) }))
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "blocks", filter: `event_id=eq.${e.id}` },
          () => fetchBlocks()
        )
        .subscribe();
    }

    run();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [slug]);

  // ---- theme (hooks must run on every render) ----
  const themeRaw = event?.theme;
  const theme = useMemo(() => safeParseTheme(themeRaw) ?? {}, [themeRaw]);
  const variants = useMemo(() => ensureVariants(theme), [theme]);
  const cssVars = useMemo(() => varCss(theme.palette), [theme]);

  const themeDebug = useMemo(() => {
    const rawType = themeRaw === null || themeRaw === undefined ? String(themeRaw) : typeof themeRaw;
    const parsedKeys = theme && typeof theme === "object" ? Object.keys(theme) : [];
    const v = ensureVariants(theme);
    const pal = theme?.palette ?? {};
    return {
      rawType,
      parsedKeys,
      variants: v,
      palette: {
        bg: pal.bg,
        card: pal.card,
        text: pal.text,
        accent: pal.accent,
        border: pal.border,
      },
    };
  }, [themeRaw, theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#fff" }}>
        <Loader2 className="animate-spin opacity-50" />
      </div>
    );
  }
  if (!event) return notFound();

  const fontFamily =
    theme.typography?.body === "serif"
      ? `"Noto Serif JP", serif`
      : theme.typography?.body === "rounded"
      ? `"Zen Maru Gothic", system-ui`
      : "system-ui";

  const bgPattern = theme.background_pattern
    ? `url('${theme.background_pattern}')`
    : "none";

  const showDebug =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily,
        backgroundImage: bgPattern,
      }}
    >
      {/* theme vars + custom css */}
      <style>{cssVars + (theme.custom_css ?? "")}</style>

      {showDebug ? (
        <div
          className="fixed bottom-3 right-3 z-50 rounded-xl border px-3 py-2 text-[10px] font-mono shadow-sm"
          style={{
            background: "color-mix(in srgb, var(--card) 92%, transparent)",
            borderColor: "var(--border)",
            color: "var(--text)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <div className="font-bold" style={{ color: "var(--accent)" }}>
            theme debug
          </div>
          <div>raw: {themeDebug.rawType}</div>
          <div>
            hero: {themeDebug.variants.hero} / card: {themeDebug.variants.card} / program:{" "}
            {themeDebug.variants.program}
          </div>
          <div>
            bg: {themeDebug.palette.bg} card: {themeDebug.palette.card}
          </div>
        </div>
      ) : null}

      {/* HERO */}
      {variants.hero === "poster" ? (
        <HeroPoster event={event} />
      ) : (
        <HeroSimple event={event} />
      )}

      {/* CONTENT */}
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-10">
        {blocks.map((block) => (
          <BlockView
            key={block.id}
            block={block}
            cardVariant={variants.card}
            programVariant={variants.program}
            encoreRevealed={event.encore_revealed}
          />
        ))}
      </main>

      <footer className="py-12 text-center text-xs opacity-50">
        Program created with PAMP
      </footer>
    </div>
  );
}

// ---------------- HERO ----------------
function HeroPoster({ event }: any) {
  return (
    <header className="relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden">
      {event.cover_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.cover_image} alt="Cover" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center opacity-40">
          <ImageIcon />
        </div>
      )}
      <div
        className="absolute inset-0 flex flex-col justify-end p-6 md:p-10"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.25), rgba(0,0,0,0.05))",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <h1 className="text-3xl md:text-5xl font-extrabold text-white drop-shadow">
          {event.title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-3 text-white/90 text-sm">
          {event.date ? (
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur">
              <Calendar size={14} /> {event.date}
            </span>
          ) : null}
          {event.location ? (
            <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full backdrop-blur">
              <MapPin size={14} /> {event.location}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function HeroSimple({ event }: any) {
  return (
    <header className="mx-auto max-w-3xl px-6 pt-10">
      <section
        className="border shadow-sm"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
          borderRadius: 20,
          boxShadow: "0 12px 30px rgba(0,0,0,0.06)",
        }}
      >
        <div className="p-6 md:p-8">
          <div className="text-[10px] font-bold tracking-[0.28em] opacity-60">
            CONCERT
          </div>
          <h1 className="mt-2 text-3xl md:text-4xl font-black">{event.title}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm opacity-80">
            {event.date ? (
              <span className="inline-flex items-center gap-2">
                <Calendar size={16} /> {event.date}
              </span>
            ) : null}
            {event.location ? (
              <span className="inline-flex items-center gap-2">
                <MapPin size={16} /> {event.location}
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </header>
  );
}

// ---------------- BLOCKS ----------------
function Card({ children, variant }: any) {
  const radius = 16;
  if (variant === "glass") {
    return (
      <section
        className="border shadow-sm"
        style={{
          background: "color-mix(in srgb, var(--card) 78%, transparent)",
          borderColor: "color-mix(in srgb, var(--border) 55%, transparent)",
          borderRadius: radius,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        {children}
      </section>
    );
  }
  return (
    <section
      className="border shadow-sm"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderRadius: 12,
        boxShadow: "none",
      }}
    >
      {children}
    </section>
  );
}

function BlockView({ block, cardVariant, programVariant, encoreRevealed }: any) {
  const type = block.type;
  const content = block.content ?? {};

  if (type === "greeting") {
    if (!content.text) return null;
    return (
      <Card variant={cardVariant}>
        <div className="p-6 md:p-8">
          <div className="mb-3 flex items-center gap-2 text-[var(--accent)]">
            <MessageSquare size={16} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">Greeting</span>
          </div>
          <p className="whitespace-pre-wrap leading-7 opacity-90">{content.text}</p>
        </div>
      </Card>
    );
  }

  if (type === "image") {
    if (!content.url) return null;
    return (
      <Card variant={cardVariant}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.url} alt="" className="w-full h-auto rounded-t-[16px]" />
        {content.caption ? (
          <div className="p-4 text-xs text-center opacity-70">{content.caption}</div>
        ) : null}
      </Card>
    );
  }

  if (type === "profile") {
    const people = content.people ?? [];
    if (!people.length) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <User size={16} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase">Artists</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((p: any, i: number) => (
            <Card key={i} variant={cardVariant}>
              <div className="p-5 flex gap-4">
                <div
                  className="w-14 h-14 rounded-full overflow-hidden shrink-0 border"
                  style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.04)" }}
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name ?? ""} className="w-full h-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="font-black truncate">{p.name}</div>
                  <div className="text-xs mt-1 opacity-60 font-bold tracking-wider uppercase">
                    {p.role}
                  </div>
                  {p.bio ? (
                    <p className="mt-3 text-sm leading-6 opacity-85 whitespace-pre-wrap">
                      {p.bio}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (type === "program") {
    const items = content.items ?? [];
    if (!items.length) return null;

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[var(--accent)]">
          <Music size={16} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase">Program</span>
        </div>

        {programVariant === "timeline" ? (
          <div className="space-y-3">
            {items.map((it: any, idx: number) => (
              <ProgramItem
                key={idx}
                item={it}
                index={idx}
                cardVariant={cardVariant}
                encoreRevealed={encoreRevealed}
              />
            ))}
          </div>
        ) : (
          <Card variant={cardVariant}>
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {items.map((it: any, idx: number) => (
                <li key={idx} className="p-5">
                  <div className="flex items-center gap-2">
                    <div className="font-bold">{it.title}</div>
                    {it.isEncore ? (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                          color: "var(--accent)",
                        }}
                      >
                        ENCORE
                      </span>
                    ) : null}
                    {it.type === "break" ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full opacity-70">
                        BREAK
                      </span>
                    ) : null}
                  </div>
                  {it.composer ? (
                    <div className="text-xs opacity-60 mt-1">{it.composer}</div>
                  ) : null}
                  {it.description ? (
                    <p className="text-sm mt-3 leading-7 opacity-85 whitespace-pre-wrap">
                      {it.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  return null;
}

function ProgramItem({ item, index, cardVariant, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);

  if (item.isEncore && !encoreRevealed) return null;

  const isBreak = item.type === "break";
  const active = item.active === true;

  return (
    <Card variant={cardVariant}>
      <div
        className={isBreak ? "px-5 py-4" : "px-5 py-5 cursor-pointer"}
        onClick={() => (!isBreak ? setOpen((v) => !v) : null)}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: active ? "var(--accent)" : "rgba(0,0,0,0.05)",
              color: active ? "#fff" : "var(--text)",
            }}
          >
            {isBreak ? (
              <Coffee size={18} className="opacity-70" />
            ) : active ? (
              <Play size={16} className="ml-0.5" />
            ) : (
              <span className="text-xs font-black opacity-60">{index + 1}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className={`font-black truncate ${active ? "text-[var(--accent)]" : ""}`}>
                {item.title}
              </div>
              {item.isEncore ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }}
                >
                  ENCORE
                </span>
              ) : null}
            </div>

            {isBreak ? (
              <div className="text-xs opacity-60 mt-1">{item.duration}</div>
            ) : item.composer ? (
              <div className="text-xs opacity-60 mt-1 truncate">{item.composer}</div>
            ) : null}
          </div>

          {!isBreak ? (
            <ChevronDown size={18} className={`opacity-40 mt-1 transition-transform ${open ? "rotate-180" : ""}`} />
          ) : null}
        </div>

        {!isBreak ? (
          <div className={`overflow-hidden transition-all ${open ? "max-h-[800px] mt-4" : "max-h-0"}`}>
            <div className="pt-4 border-t" style={{ borderColor: "var(--border)" }}>
              <p className="text-sm leading-7 opacity-85 whitespace-pre-wrap">
                {item.description || "解説はありません。"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}