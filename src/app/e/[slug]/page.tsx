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
  Clock,
  Sparkles,
} from "lucide-react";

// ▼ Supabaseクライアント（変更なし）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- helpers (変更なし) ----
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
  // デフォルト値をよりリッチなものに設定
  const hero = typeof v.hero === "string" ? v.hero : "poster";
  const card = typeof v.card === "string" ? v.card : "glass";
  const program = typeof v.program === "string" ? v.program : "timeline";
  return { hero, card, program };
}
function varCss(palette: any) {
  const p = palette ?? {};
  // デフォルト色を少しモダンに調整
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
/* フェードインアニメーション定義 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-enter {
  animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
/* パルスアニメーション */
@keyframes softPulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent); }
  70% { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.animate-pulse-ring {
  animation: softPulse 2s infinite;
}
`;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ---- load + realtime (コア機能：変更なし) ----
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

  // ---- theme ----
  const themeRaw = event?.theme;
  const theme = useMemo(() => safeParseTheme(themeRaw) ?? {}, [themeRaw]);
  const variants = useMemo(() => ensureVariants(theme), [theme]);
  const cssVars = useMemo(() => varCss(theme.palette), [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white text-slate-400">
        <Loader2 className="animate-spin" size={32} />
        <div className="text-xs font-medium tracking-widest uppercase">Loading Program...</div>
      </div>
    );
  }
  if (!event) return notFound();

  // フォント設定の強化
  const fontFamily =
    theme.typography?.body === "serif"
      ? `"Times New Roman", "Noto Serif JP", "Hiragino Mincho ProN", serif`
      : theme.typography?.body === "rounded"
      ? `"Zen Maru Gothic", "Hiragino Maru Gothic Pro", system-ui`
      : `"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif`;

  const bgPattern = theme.background_pattern
    ? `url('${theme.background_pattern}')`
    : "none";

  return (
    <div
      className="min-h-screen overflow-x-hidden selection:bg-[var(--accent)] selection:text-white"
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily,
        backgroundImage: bgPattern,
        backgroundAttachment: "fixed", // 背景固定で高級感
        backgroundSize: "cover",
      }}
    >
      <style>{cssVars + (theme.custom_css ?? "")}</style>

      {/* HERO */}
      <div className="animate-enter" style={{ animationDelay: "0ms" }}>
        {variants.hero === "poster" ? (
          <HeroPoster event={event} />
        ) : (
          <HeroSimple event={event} />
        )}
      </div>

      {/* CONTENT */}
      <main className="mx-auto max-w-2xl px-5 py-12 space-y-12 pb-32">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="animate-enter"
            style={{ animationDelay: `${(i + 1) * 100}ms` }} // 順番にふわっと表示
          >
            <BlockView
              block={block}
              cardVariant={variants.card}
              programVariant={variants.program}
              encoreRevealed={event.encore_revealed}
            />
          </div>
        ))}
      </main>

      {/* FOOTER */}
      <footer className="py-12 text-center space-y-2 opacity-40 mix-blend-multiply dark:mix-blend-screen">
        <div className="flex justify-center items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          <Sparkles size={12} />
          Digital Program
        </div>
        <div className="text-[10px]">
          © {new Date().getFullYear()} {event.title}
        </div>
      </footer>
    </div>
  );
}

// ---------------- UI COMPONENTS ----------------

// 美しい日本語レイアウトのためのSectionヘッダー
function SectionHeader({ icon: Icon, title, subtitle }: any) {
  return (
    <div className="flex items-center gap-3 mb-5 px-1">
      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/30">
        <Icon size={14} />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--accent)] uppercase leading-none">
          {subtitle}
        </span>
        <h2 className="text-lg font-bold leading-none mt-1">{title}</h2>
      </div>
    </div>
  );
}

function HeroPoster({ event }: any) {
  return (
    <header className="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden shadow-2xl">
      {event.cover_image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover scale-105"
            style={{ filter: "brightness(0.9)" }}
          />
          {/* グラデーションオーバーレイ（文字を読みやすくする） */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.9) 100%)",
            }}
          />
        </>
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
           <ImageIcon className="opacity-20 w-24 h-24" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-8 flex flex-col justify-end text-white">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.3em] uppercase opacity-80 mb-3 text-white/90">
          <span className="w-8 h-[1px] bg-white/70"></span>
          Concert Program
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight drop-shadow-md mb-4">
          {event.title}
        </h1>
        
        <div className="flex flex-col gap-2 text-sm font-medium text-white/90">
          {event.date && (
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-white/70" />
              <span>{event.date}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-white/70" />
              <span>{event.location}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function HeroSimple({ event }: any) {
  return (
    <header className="mx-auto max-w-2xl px-5 pt-16 pb-6 text-center">
      <div className="inline-block px-3 py-1 mb-6 rounded-full border border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-sm">
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase opacity-60">
          Concert Program
        </span>
      </div>
      <h1 className="text-3xl md:text-5xl font-black mb-6 leading-tight tracking-tight text-[var(--text)]">
        {event.title}
      </h1>
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm opacity-70">
        {event.date && (
          <span className="flex items-center gap-2">
            <Calendar size={15} /> {event.date}
          </span>
        )}
        <span className="w-1 h-1 rounded-full bg-[var(--text)] opacity-30" />
        {event.location && (
          <span className="flex items-center gap-2">
            <MapPin size={15} /> {event.location}
          </span>
        )}
      </div>
      <div className="mt-8 mx-auto w-12 h-1 rounded-full bg-[var(--accent)] opacity-50" />
    </header>
  );
}

// ---------------- BLOCKS ----------------
function Card({ children, variant, className = "" }: any) {
  const baseStyle = "overflow-hidden transition-all duration-300 " + className;
  
  if (variant === "glass") {
    return (
      <section
        className={`${baseStyle} border border-white/20 shadow-xl`}
        style={{
          background: "rgba(255, 255, 255, 0.7)", // フォールバック
          backgroundColor: "color-mix(in srgb, var(--card) 85%, transparent)",
          borderColor: "color-mix(in srgb, var(--border) 60%, transparent)",
          borderRadius: 24,
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.04)",
        }}
      >
        {children}
      </section>
    );
  }
  // Plain variant
  return (
    <section
      className={`${baseStyle} border`}
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        borderRadius: 20,
        boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
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
      <div>
        <SectionHeader icon={MessageSquare} title="ご挨拶" subtitle="Greeting" />
        <Card variant={cardVariant}>
          <div className="p-6 md:p-8">
            <p className="text-[15px] leading-8 text-justify whitespace-pre-wrap opacity-90 font-serif">
              {content.text}
            </p>
            {content.author && (
              <div className="mt-6 text-right font-bold text-sm opacity-80">
                {content.author}
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (type === "image") {
    if (!content.url) return null;
    return (
      <figure className="relative rounded-[24px] overflow-hidden shadow-lg my-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.url} alt="" className="w-full h-auto object-cover" />
        {content.caption && (
          <figcaption className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm text-white p-3 text-xs text-center font-medium">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  if (type === "profile") {
    const people = content.people ?? [];
    if (!people.length) return null;

    return (
      <div>
        <SectionHeader icon={User} title="出演者" subtitle="Artists" />
        <div className="grid grid-cols-1 gap-6">
          {people.map((p: any, i: number) => (
            <Card key={i} variant={cardVariant}>
              <div className="flex flex-col md:flex-row">
                <div className="relative w-full md:w-48 aspect-[4/3] md:aspect-auto shrink-0 overflow-hidden bg-gray-100">
                   {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={40} /></div>
                  )}
                </div>
                <div className="p-6 flex-1">
                  <div className="flex items-baseline justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-bold">{p.name}</h3>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--accent)] border border-[var(--accent)] px-2 py-1 rounded-full opacity-80">
                      {p.role}
                    </span>
                  </div>
                  {p.bio && (
                    <p className="mt-4 text-sm leading-7 opacity-80 text-justify whitespace-pre-wrap">
                      {p.bio}
                    </p>
                  )}
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
      <div>
        <SectionHeader icon={Music} title="プログラム" subtitle="Program" />
        
        {programVariant === "timeline" ? (
          <div className="relative pl-4 space-y-6">
            {/* タイムラインの線 */}
            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-[var(--border)] opacity-60 rounded-full" />
            
            {items.map((it: any, idx: number) => (
              <ProgramTimelineItem
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
            <ul className="divide-y divide-[var(--border)]">
              {items.map((it: any, idx: number) => (
                <ProgramListItem
                  key={idx}
                  item={it}
                  index={idx}
                  encoreRevealed={encoreRevealed}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  return null;
}

// タイムライン形式のプログラム項目
function ProgramTimelineItem({ item, index, cardVariant, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  
  if (item.isEncore && !encoreRevealed) return null;

  const isBreak = item.type === "break";
  const active = item.active === true;

  // 演奏中の場合の特別なスタイル
  const activeGlow = active ? "animate-pulse-ring ring-1 ring-[var(--accent)]" : "";
  const activeBg = active ? "bg-[var(--card)]" : "";

  return (
    <div className={`relative flex gap-4 ${active ? "z-10" : ""}`}>
      {/* Timeline Node */}
      <div 
        className={`shrink-0 w-6 h-6 rounded-full border-[3px] z-10 mt-5 bg-[var(--bg)] transition-colors duration-500
          ${active ? "border-[var(--accent)] scale-125" : isBreak ? "border-[var(--muted)] opacity-50" : "border-[var(--border)]"}
        `}
      />

      <div className="flex-1 min-w-0">
        <Card variant={cardVariant} className={`${activeGlow} ${activeBg}`}>
          <div
            className={`cursor-pointer ${isBreak ? "py-3 px-5 bg-[var(--muted)]/5" : "p-5"}`}
            onClick={() => (!isBreak ? setOpen((v) => !v) : null)}
          >
            {/* Header part */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  {active && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--accent)] text-white shadow-sm animate-pulse">
                      <Sparkles size={10} />
                      NOW PLAYING
                    </span>
                  )}
                  {item.isEncore && (
                     <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold border border-[var(--accent)] text-[var(--accent)]">
                      ENCORE
                    </span>
                  )}
                  {isBreak && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--muted)]/20 text-[var(--muted)]">
                      BREAK
                    </span>
                  )}
                </div>
                
                <h3 className={`text-base font-bold leading-snug ${active ? "text-[var(--accent)] text-lg" : ""}`}>
                  {item.title}
                </h3>
                
                {!isBreak && item.composer && (
                  <div className="text-xs font-medium opacity-60 tracking-wide uppercase">
                    {item.composer}
                  </div>
                )}
                 {isBreak && item.duration && (
                   <div className="text-xs opacity-60 flex items-center gap-1">
                     <Clock size={12}/> {item.duration}
                   </div>
                 )}
              </div>

              {!isBreak && (
                <div className={`mt-1 text-[var(--accent)] transition-transform duration-300 ${open ? "rotate-180" : "opacity-30"}`}>
                   <ChevronDown size={20} />
                </div>
              )}
            </div>

            {/* Expanded Content */}
            <div 
              className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-[var(--border)]" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="overflow-hidden">
                <p className="text-sm leading-7 opacity-85 text-justify whitespace-pre-wrap">
                  {item.description || "解説はありません。"}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// リスト形式のプログラム項目
function ProgramListItem({ item, index, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  if (item.isEncore && !encoreRevealed) return null;
  
  const isBreak = item.type === "break";
  const active = item.active === true;

  return (
    <li className={`transition-colors duration-300 ${active ? "bg-[var(--accent)]/5" : ""}`}>
      <div 
        className="p-5 cursor-pointer"
        onClick={() => !isBreak && setOpen(!open)}
      >
        <div className="flex items-center gap-4">
           {/* Number / Icon */}
           <div className={`shrink-0 w-8 text-center font-bold text-sm ${active ? "text-[var(--accent)]" : "opacity-30"}`}>
             {isBreak ? <Coffee size={18} className="mx-auto"/> : active ? <Play size={18} className="mx-auto fill-current"/> : index + 1}
           </div>

           <div className="flex-1 min-w-0">
              {active && (
                <div className="text-[10px] font-bold text-[var(--accent)] mb-1 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
                  </span>
                  演奏中
                </div>
              )}
              <div className="font-bold truncate">{item.title}</div>
              {item.composer && <div className="text-xs opacity-60 truncate">{item.composer}</div>}
           </div>
           
           {!isBreak && <ChevronDown size={16} className={`opacity-30 transition-transform ${open ? "rotate-180" : ""}`} />}
        </div>
        
        {/* Detail */}
        {!isBreak && open && (
          <div className="mt-4 pl-12 pr-2 animate-enter" style={{animationDuration: '0.3s'}}>
             <p className="text-sm leading-relaxed opacity-80 text-justify whitespace-pre-wrap">
               {item.description}
             </p>
          </div>
        )}
      </div>
    </li>
  );
}