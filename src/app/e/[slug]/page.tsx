"use client";

import { use, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import {
  Calendar,
  MapPin,
  Coffee,
  ChevronDown,
  User,
  Sparkles,
  Music,
  Loader2,
} from "lucide-react";

// ▼ Supabaseクライアント
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

// デザイン設定（クラシック・紙 + リッチエフェクト）
function varCss(palette: any) {
  const p = palette ?? {};
  const accent = p.accent ?? "#B48E55"; // 金・茶系
  
  return `
:root {
  --bg: #F5F2E8;
  --card: #F5F2E8;
  --text: #2C241B;
  --muted: #8c8273;
  --accent: ${accent};
  --border: #E6DCC3;
  
  /* 演奏中モード（ダーク） */
  --theater-bg: #1a1614;
  --theater-text: #e6e0d4;
  --theater-card: #2c241f;
  --theater-border: rgba(255,255,255,0.1);
}

[data-theater-mode="true"] {
  --bg: var(--theater-bg) !important;
  --text: var(--theater-text) !important;
  --card: var(--theater-card) !important;
  --border: var(--theater-border) !important;
}

/* アニメーション定義 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes breathe {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); text-shadow: 0 0 10px var(--accent); }
}
@keyframes goldPulse {
  0%, 100% { box-shadow: 0 0 0px var(--accent); }
  50% { box-shadow: 0 0 20px var(--accent); }
}
@keyframes firefly {
  0%, 100% { opacity: 0.5; transform: translate(0, 0) scale(1); }
  50% { opacity: 1; transform: translate(2px, -2px) scale(1.2); }
}

.animate-enter {
  animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}
.animate-breathe {
  animation: breathe 3s ease-in-out infinite;
}
.animate-firefly {
  animation: firefly 2s ease-in-out infinite;
}

.bg-paper-texture {
  background-image: url("https://www.transparenttextures.com/patterns/cream-paper.png");
  background-attachment: fixed;
}

/* 隠しスクロールバー */
.scrollbar-hide::-webkit-scrollbar {
    display: none;
}
.scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
`;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);

  // ---- Load + Realtime ----
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

  const theme = useMemo(() => safeParseTheme(event?.theme) ?? {}, [event?.theme]);
  const cssVars = useMemo(() => varCss(theme.palette), [theme]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F2E8] text-[#B48E55]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }
  if (!event) return notFound();

  const fontFamily = `"Times New Roman", "Noto Serif JP", "Hiragino Mincho ProN", serif`;

  return (
    <div
      className="min-h-screen overflow-x-hidden transition-colors duration-700 ease-in-out bg-paper-texture"
      data-theater-mode={theaterMode}
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily,
      }}
    >
      <style>{cssVars + (theme.custom_css ?? "")}</style>

      {/* Mode Toggle */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setTheaterMode(!theaterMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border transition-all shadow-lg active:scale-95 duration-500 ${
            theaterMode 
              ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/50 shadow-[0_0_15px_var(--accent)]" 
              : "bg-white/40 text-[var(--text)] border-[var(--border)]"
          }`}
        >
          <Music size={14} className={theaterMode ? "animate-firefly" : ""} />
          <span className="text-[10px] font-bold tracking-wider uppercase">
            {theaterMode ? "演奏中モード" : "通常モード"}
          </span>
        </button>
      </div>

      {/* HERO */}
      <div className="animate-enter">
        <HeroFixed event={event} />
      </div>

      {/* CONTENT */}
      <main className="mx-auto max-w-3xl px-5 py-12 space-y-16 pb-40">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="animate-enter"
            style={{ animationDelay: `${(i + 1) * 100}ms` }}
          >
            <BlockViewFixed
              block={block}
              encoreRevealed={event.encore_revealed}
            />
          </div>
        ))}
      </main>

      {/* FOOTER */}
      <footer className="py-12 text-center space-y-2 opacity-40 mix-blend-multiply dark:mix-blend-screen">
        <div className="w-12 h-[1px] bg-current mx-auto mb-4 opacity-50"></div>
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase">
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

function SectionTitle({ title, subtitle }: any) {
  return (
    <div className="flex items-center justify-center gap-4 mb-8 opacity-90">
      <div className="h-[1px] w-8 bg-[var(--accent)]/50" />
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--accent)]">{title}</h2>
        <span className="text-[10px] tracking-[0.3em] uppercase opacity-60 block mt-1">{subtitle}</span>
      </div>
      <div className="h-[1px] w-8 bg-[var(--accent)]/50" />
    </div>
  );
}

function HeroFixed({ event }: any) {
  return (
    <header className="relative w-full aspect-[3/4] md:aspect-[21/9] overflow-hidden">
      {event.cover_image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.cover_image}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Paper Blend Gradient Mask */}
          <div
            className="absolute inset-0"
            style={{ 
              background: "linear-gradient(to bottom, rgba(0,0,0,0) 50%, var(--bg) 100%)",
              mixBlendMode: "normal"
            }}
          />
        </>
      ) : (
        <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
           <div className="text-center opacity-30 p-10">
              <div className="text-4xl font-serif mb-4 tracking-widest">{event.title}</div>
              <div className="w-16 h-[1px] bg-current mx-auto"></div>
           </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-8 pb-12 flex flex-col items-center text-center z-10">
        <div className="px-6 py-1.5 border-[0.5px] border-[var(--text)]/30 backdrop-blur-md bg-white/10 mb-8 rounded-sm shadow-sm">
          <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-[var(--text)] opacity-90">
            Concert Program
          </span>
        </div>
        
        <h1 className="text-3xl md:text-5xl font-medium leading-tight tracking-tight drop-shadow-sm mb-4 text-[var(--text)] break-words w-full max-w-2xl">
          {event.title}
        </h1>
        
        <div className="flex flex-col items-center gap-2 text-sm text-[var(--text)]/80">
          {event.date && (
             <div className="flex items-center gap-2">
               <span className="w-6 h-[1px] bg-[var(--accent)]"></span>
               <span>{event.date}</span>
               <span className="w-6 h-[1px] bg-[var(--accent)]"></span>
             </div>
          )}
          {event.location && (
            <div className="text-xs tracking-wider uppercase opacity-70 mt-1">
              <MapPin size={12} className="inline mr-1 mb-0.5"/>
              {event.location}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BlockViewFixed({ block, encoreRevealed }: any) {
  const type = block.type;
  const content = block.content ?? {};

  // --- Greeting ---
  if (type === "greeting") {
    if (!content.text) return null;
    return (
      <div className="py-4">
        <SectionTitle title="ご挨拶" subtitle="Greeting" />
        <div className="flex flex-col md:flex-row gap-6 items-start">
           {content.image && (
             <div className="shrink-0 mx-auto md:mx-0">
                <div className="w-32 h-40 bg-[var(--muted)]/10 rounded-sm overflow-hidden border border-[var(--border)] shadow-md rotate-1">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={content.image} className="w-full h-full object-cover" alt="Speaker"/>
                </div>
             </div>
           )}
           <div className="flex-1 w-full">
              {(content.author || content.role) && (
                <div className="mb-4 text-center md:text-left">
                   <div className="text-sm font-bold tracking-widest">{content.author}</div>
                   <div className="text-[10px] opacity-60 uppercase tracking-widest mt-1">{content.role}</div>
                </div>
              )}
              <div className="h-[1px] w-full bg-[var(--border)] mb-4 opacity-50"/>
              <p className="text-[15px] leading-8 text-justify whitespace-pre-wrap opacity-90 font-serif">
                {content.text}
              </p>
              <div className="h-[1px] w-full bg-[var(--border)] mt-4 opacity-50"/>
           </div>
        </div>
      </div>
    );
  }

  // --- Free Topic ---
  if (type === "free") {
    if (!content.text && !content.title) return null;
    return (
      <div className="py-4">
        <SectionTitle title={content.title || "Information"} subtitle="Topic" />
        <div className="px-4">
           <p className="text-[15px] leading-8 text-justify whitespace-pre-wrap opacity-90 font-serif">
             {content.text}
           </p>
        </div>
      </div>
    );
  }

  // --- Gallery (横スライド) ---
  if (type === "gallery") {
    const images = content.images ?? (content.url ? [content.url] : []);
    if (!images.length) return null;

    return (
      <div className="py-4 overflow-hidden -mx-5 px-5"> {/* 画面端まで広げる */}
        {content.title && <SectionTitle title={content.title} subtitle="Gallery" />}
        
        {/* 横スクロールコンテナ */}
        <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory scrollbar-hide px-4">
          {images.map((url: string, idx: number) => (
             <div key={idx} className="shrink-0 snap-center first:pl-4 last:pr-4">
               <figure className="relative w-64 md:w-80 aspect-[4/3] overflow-hidden bg-white p-2 shadow-lg rotate-1 even:-rotate-1 border border-gray-100">
                 {/* eslint-disable-next-line @next/next/no-img-element */}
                 <img src={url} alt="" className="w-full h-full object-cover" />
                 {idx === images.length - 1 && content.caption && (
                   <div className="absolute bottom-2 left-0 right-0 text-center">
                     <span className="bg-white/80 px-2 py-1 text-[10px] tracking-wider italic text-black">
                       {content.caption}
                     </span>
                   </div>
                 )}
               </figure>
             </div>
          ))}
        </div>
      </div>
    );
  }

  // --- Profile (Accordion) ---
  if (type === "profile") {
    const people = content.people ?? [];
    if (!people.length) return null;

    return (
      <div>
        <SectionTitle title="出演者" subtitle="Artists" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {people.map((p: any, i: number) => (
            <ProfileCard key={i} p={p} />
          ))}
        </div>
      </div>
    );
  }

  // --- Program ---
  if (type === "program") {
    const items = content.items ?? [];
    if (!items.length) return null;

    return (
      <div>
        <SectionTitle title="プログラム" subtitle="Program" />
        <div className="space-y-1">
          {items.map((it: any, idx: number) => (
            <ProgramItemFixed
              key={idx}
              item={it}
              encoreRevealed={encoreRevealed}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// プロフィールアコーディオン
function ProfileCard({ p }: any) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col bg-[var(--card)] border border-[var(--border)] shadow-sm overflow-hidden group">
      {/* 画像がある場合のみ表示 */}
      {p.image && (
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
           {/* eslint-disable-next-line @next/next/no-img-element */}
           <img src={p.image} alt={p.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        </div>
      )}
      
      <div 
        className="p-5 flex-1 flex flex-col justify-center text-center cursor-pointer hover:bg-[var(--accent)]/5 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <h3 className="text-lg font-bold text-[var(--accent)] flex items-center justify-center gap-2">
          {p.name}
          <ChevronDown size={14} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}/>
        </h3>
        <div className="text-[10px] font-bold tracking-[0.2em] uppercase opacity-50 mb-1">
          {p.role}
        </div>

        {/* Accordion Content */}
        <div className={`grid transition-all duration-500 ease-in-out ${open ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
             {p.bio && (
               <p className="text-sm leading-7 opacity-80 whitespace-pre-wrap text-justify border-t border-[var(--border)] pt-4">
                 {p.bio}
               </p>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

// アイテム描画（セクション・メモ・休憩・曲）
function ProgramItemFixed({ item, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  
  // --- Section (アンティーク仕切り) ---
  if (item.type === "section") {
    return (
      <div className="pt-12 pb-8 flex items-center justify-center animate-enter">
        <div className="h-[1px] w-12 bg-[var(--accent)] opacity-40 border-t border-b border-[var(--accent)] h-1" />
        <h3 className="mx-6 text-lg font-bold text-[var(--accent)] tracking-[0.2em] uppercase font-serif text-center">
          {item.title}
        </h3>
        <div className="h-[1px] w-12 bg-[var(--accent)] opacity-40 border-t border-b border-[var(--accent)] h-1" />
      </div>
    );
  }

  // --- Memo (手書き風注釈) ---
  if (item.type === "memo") {
    return (
      <div className="py-2 text-center animate-enter">
        <span className="text-sm opacity-60 tracking-wider font-serif italic text-[var(--muted)]">
          * {item.title}
        </span>
      </div>
    );
  }
  
  // Encore Check
  if (item.isEncore && !encoreRevealed) return null;
  
  const isBreak = item.type === "break";
  const active = item.active === true;
  
  // 休憩タイマー（ブレスアニメーション）
  const TimerDisplay = () => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);

    useEffect(() => {
      if (!item.timerEnd) return;
      const interval = setInterval(() => {
        const end = new Date(item.timerEnd).getTime();
        const now = new Date().getTime();
        const diff = end - now;

        if (diff <= 0) {
           setTimeLeft(null); 
           clearInterval(interval);
        } else {
           const m = Math.floor(diff / 60000);
           const s = Math.floor((diff % 60000) / 1000);
           setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }, []);

    if (!timeLeft) return <span className="text-[10px]">{item.duration}</span>;

    return (
      <div className="flex flex-col items-center animate-breathe">
         <div className="text-[10px] font-bold text-[var(--accent)] mb-1">再開まで</div>
         <div className="text-2xl font-bold font-mono tracking-widest text-[var(--accent)] drop-shadow-sm">{timeLeft}</div>
      </div>
    );
  };

  // --- Break (休憩) ---
  if (isBreak) {
    return (
      <div className={`py-12 flex items-center justify-center gap-6 transition-all duration-1000 ${active ? 'opacity-100 scale-105' : 'opacity-60'}`}>
        <div className="h-[1px] w-8 bg-[var(--text)] opacity-20" />
        <div className="flex flex-col items-center gap-3 min-w-[120px]">
          <div className={`p-2 rounded-full border border-[var(--text)]/20 ${active ? 'bg-[var(--accent)]/10 animate-pulse' : ''}`}>
             <Coffee size={16} className="opacity-70"/>
          </div>
          <span className="text-sm font-bold tracking-[0.3em] uppercase">
             休 憩
          </span>
          {item.timerEnd && new Date(item.timerEnd).getTime() > Date.now() ? (
             <TimerDisplay />
          ) : (
             item.duration && <span className="text-[10px] font-serif italic opacity-60">{item.duration}</span>
          )}
        </div>
        <div className="h-[1px] w-8 bg-[var(--text)] opacity-20" />
      </div>
    );
  }

  // --- Song (曲・リッチエフェクト) ---
  return (
    <div className={`group transition-all duration-700`}>
      <div 
        onClick={() => setOpen(!open)}
        className={`cursor-pointer py-5 px-4 rounded-sm transition-all duration-700
          ${active 
            ? "bg-gradient-to-r from-[var(--accent)]/10 via-[var(--accent)]/5 to-transparent border-l-2 border-[var(--accent)] shadow-[0_0_30px_rgba(180,142,85,0.1)]" 
            : "hover:bg-[var(--accent)]/5 border-l-2 border-transparent"
          }`}
      >
        <div className="flex items-baseline gap-4">
          {/* Active Dot / Number */}
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 transform translate-y-[-2px] transition-all duration-500
            ${active ? "bg-[var(--accent)] animate-firefly shadow-[0_0_8px_var(--accent)] scale-125" : "bg-[var(--accent)]/40"}`} 
          />
          
          <div className="flex-1">
             <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
               <h3 className={`text-lg font-medium leading-snug transition-all duration-700
                 ${active ? "text-[var(--accent)] font-bold drop-shadow-[0_0_10px_rgba(180,142,85,0.3)] scale-[1.02] origin-left" : "text-[var(--text)]"}
               `}>
                 {item.title}
               </h3>
               
               {active && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/30 backdrop-blur-sm border border-[var(--accent)]/30 text-[9px] font-bold text-[var(--accent)] animate-pulse uppercase tracking-wider shadow-sm">
                    <Sparkles size={10} /> 演奏中
                  </span>
               )}
               {item.isEncore && (
                 <span className="text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)] px-2 py-0.5 rounded-full self-start md:self-auto opacity-80">
                   Encore
                 </span>
               )}
             </div>
             
             {item.composer && (
               <div className="text-sm opacity-60 italic mt-1 font-serif">{item.composer}</div>
             )}
          </div>

          <ChevronDown size={16} className={`opacity-30 transition-transform duration-500 ${open ? "rotate-180" : ""}`} />
        </div>

        <div className={`grid transition-all duration-500 ease-out ${open ? "grid-rows-[1fr] mt-4 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
             <div className="pl-6 border-l border-[var(--border)] ml-2">
               <p className="text-sm leading-7 text-justify opacity-80 whitespace-pre-wrap font-serif">
                 {item.description || "解説はありません。"}
               </p>
             </div>
          </div>
        </div>
      </div>
      
      {/* Separator */}
      {!active && <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[var(--border)] to-transparent opacity-30 mt-1" />}
    </div>
  );
}