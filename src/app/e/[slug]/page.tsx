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
  Glasses, // シアターモード用アイコン
  X,
} from "lucide-react";

// ▼ Supabaseクライアント（変更なし）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ---- helpers (拡張) ----
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

  // ▼ ここで新しい選択肢を追加しています
  // hero: "layered" (画像のような重ね文字スタイル)
  // card: "paper" (羊皮紙風の質感)
  // program: "ornament" (装飾的なリスト)
  
  const hero = ["poster", "simple", "layered"].includes(v.hero) ? v.hero : "poster";
  const card = ["glass", "plain", "paper"].includes(v.card) ? v.card : "glass";
  const program = ["timeline", "list", "ornament"].includes(v.program) ? v.program : "timeline";

  return { hero, card, program };
}

function varCss(palette: any) {
  const p = palette ?? {};
  // デフォルト色
  const bg = p.bg ?? "#ffffff";
  const card = p.card ?? "#f8fafc";
  const text = p.text ?? "#1e293b";
  const muted = p.muted ?? "#64748b";
  const accent = p.accent ?? "#3b82f6";
  const border = p.border ?? "#e2e8f0";

  return `
:root {
  --bg: ${bg};
  --card: ${card};
  --text: ${text};
  --muted: ${muted};
  --accent: ${accent};
  --border: ${border};
  
  /* シアターモード用のデフォルト変数（JSで制御） */
  --theater-bg: #1a1614;
  --theater-text: #e6e0d4;
  --theater-card: #2c241f;
  --theater-accent: ${accent}; /* アクセントは維持 */
}

/* シアターモード有効時の上書き */
[data-theater-mode="true"] {
  --bg: var(--theater-bg) !important;
  --text: var(--theater-text) !important;
  --card: var(--theater-card) !important;
  --border: rgba(255,255,255,0.1) !important;
}

/* アニメーション定義 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-enter {
  animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes softPulse {
  0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 40%, transparent); }
  70% { box-shadow: 0 0 0 10px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.animate-pulse-ring {
  animation: softPulse 2s infinite;
}

/* 紙の質感（Paperバリアント用） */
.bg-paper-texture {
  background-image: url("https://www.transparenttextures.com/patterns/cream-paper.png");
  background-blend-mode: multiply;
}
[data-theater-mode="true"] .bg-paper-texture {
  background-blend-mode: soft-light;
  opacity: 0.1; /* 暗闇ではテクスチャを弱める */
}
`;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ★ シアターモードの状態管理
  const [theaterMode, setTheaterMode] = useState(false);

  // ---- load + realtime (コア機能：維持) ----
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F5F2E8] text-[#8B5A2B]">
        <Loader2 className="animate-spin" size={32} />
        <div className="text-xs font-serif tracking-widest uppercase">Loading Program...</div>
      </div>
    );
  }
  if (!event) return notFound();

  // フォント設定（明朝体に対応）
  const fontFamily =
    theme.typography?.body === "serif"
      ? `"Times New Roman", "Noto Serif JP", "Hiragino Mincho ProN", serif`
      : theme.typography?.body === "rounded"
      ? `"Zen Maru Gothic", "Hiragino Maru Gothic Pro", system-ui`
      : `"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif`;

  // 背景パターン
  const bgPattern = theme.background_pattern
    ? `url('${theme.background_pattern}')`
    : variants.card === "paper" 
      ? `url("https://www.transparenttextures.com/patterns/cream-paper.png")` // Paperモードのデフォルト
      : "none";

  return (
    <div
      className="min-h-screen overflow-x-hidden selection:bg-[var(--accent)] selection:text-white transition-colors duration-700 ease-in-out"
      data-theater-mode={theaterMode}
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily,
        backgroundImage: bgPattern,
        backgroundAttachment: "fixed",
      }}
    >
      <style>{cssVars + (theme.custom_css ?? "")}</style>

      {/* シアターモード切り替えスイッチ (右上に固定) */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setTheaterMode(!theaterMode)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border transition-all duration-300 shadow-lg ${
            theaterMode 
              ? "bg-white/10 text-white border-white/20 hover:bg-white/20" 
              : "bg-black/5 text-[var(--text)] border-[var(--border)] hover:bg-black/10"
          }`}
        >
          {theaterMode ? <Sparkles size={14} /> : <Glasses size={14} />}
          <span className="text-[10px] font-bold tracking-wider uppercase">
            {theaterMode ? "Normal" : "Theater Mode"}
          </span>
        </button>
      </div>

      {/* HERO SECTION */}
      <div className="animate-enter" style={{ animationDelay: "0ms" }}>
        {variants.hero === "layered" ? (
          <HeroLayered event={event} />
        ) : variants.hero === "poster" ? (
          <HeroPoster event={event} />
        ) : (
          <HeroSimple event={event} />
        )}
      </div>

      {/* CONTENT BLOCKS */}
      <main className="mx-auto max-w-3xl px-5 py-12 space-y-16 pb-40">
        {blocks.map((block, i) => (
          <div
            key={block.id}
            className="animate-enter"
            style={{ animationDelay: `${(i + 1) * 150}ms` }}
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
        <div className="w-12 h-[1px] bg-current mx-auto mb-4 opacity-50"></div>
        <div className="flex justify-center items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase">
          Digital Program
        </div>
        <div className="text-[10px] font-serif">
          © {new Date().getFullYear()} {event.title}
        </div>
      </footer>
    </div>
  );
}

// ---------------- UI COMPONENTS ----------------

function SectionTitle({ title, subtitle, variant }: any) {
  if (variant === "paper" || variant === "ornament") {
    return (
      <div className="flex items-center justify-center gap-4 mb-8 opacity-90">
        <div className="h-[1px] w-8 bg-[var(--accent)]/50" />
        <div className="text-center">
          <h2 className="text-2xl font-serif font-bold text-[var(--accent)]">{title}</h2>
          <span className="text-[10px] tracking-[0.3em] uppercase opacity-60 block mt-1">{subtitle}</span>
        </div>
        <div className="h-[1px] w-8 bg-[var(--accent)]/50" />
      </div>
    );
  }
  
  // Default Modern Style
  return (
    <div className="flex items-center gap-3 mb-5 px-1">
      <div className="w-1 h-6 bg-[var(--accent)] rounded-full" />
      <div className="flex flex-col">
        <span className="text-[10px] font-bold tracking-[0.25em] text-[var(--accent)] uppercase leading-none">
          {subtitle}
        </span>
        <h2 className="text-lg font-bold leading-none mt-1">{title}</h2>
      </div>
    </div>
  );
}

// --- Hero Components ---

function HeroLayered({ event }: any) {
  // 画像[1]のような「写真＋下部ぼかし＋重ね文字」のスタイル
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
          {/* 下部へのグラデーション（背景色に溶け込ませる） */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0) 40%, var(--bg) 95%)",
            }}
          />
        </>
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
          <ImageIcon className="opacity-20 w-24 h-24" />
        </div>
      )}

      {/* テキストコンテンツ */}
      <div className="absolute inset-x-0 bottom-0 p-8 pb-12 flex flex-col items-center text-center">
        <div className="px-6 py-2 border-y border-[var(--text)]/20 backdrop-blur-sm mb-6">
          <span className="text-[11px] font-serif italic tracking-[0.2em] uppercase opacity-80">
            Concert Program
          </span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-serif font-medium leading-tight tracking-tight drop-shadow-sm mb-4 text-[var(--text)]">
          {event.title}
        </h1>
        
        <div className="flex flex-col items-center gap-2 text-sm font-serif text-[var(--text)]/80">
          {event.date && (
             <div className="flex items-center gap-2">
               <span className="w-8 h-[1px] bg-[var(--accent)]"></span>
               <span>{event.date}</span>
               <span className="w-8 h-[1px] bg-[var(--accent)]"></span>
             </div>
          )}
          {event.location && (
            <div className="text-xs tracking-wider uppercase opacity-70 mt-1">
              {event.location}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function HeroPoster({ event }: any) {
  return (
    <header className="relative w-full aspect-[4/5] md:aspect-[21/9] overflow-hidden shadow-2xl">
      {event.cover_image ? (
        <>
          <img src={event.cover_image} alt="Cover" className="absolute inset-0 w-full h-full object-cover scale-105 filter brightness-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        </>
      ) : (
        <div className="w-full h-full bg-slate-200 flex items-center justify-center">
           <ImageIcon className="opacity-20 w-24 h-24" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-8 text-white">
        <h1 className="text-3xl md:text-5xl font-extrabold mb-4">{event.title}</h1>
        <div className="flex gap-4 text-sm opacity-90">
          {event.date && <div className="flex gap-2"><Calendar size={16}/>{event.date}</div>}
          {event.location && <div className="flex gap-2"><MapPin size={16}/>{event.location}</div>}
        </div>
      </div>
    </header>
  );
}

function HeroSimple({ event }: any) {
  return (
    <header className="mx-auto max-w-2xl px-5 pt-16 pb-6 text-center">
      <h1 className="text-3xl font-black mb-6">{event.title}</h1>
      <div className="h-1 w-20 bg-[var(--accent)] mx-auto opacity-50"/>
    </header>
  );
}

// --- Card Wrapper ---

function Card({ children, variant, className = "" }: any) {
  const baseStyle = "overflow-hidden transition-all duration-300 " + className;
  
  // 画像[1]のような「紙」スタイル
  if (variant === "paper") {
    return (
      <section
        className={`${baseStyle} bg-paper-texture`}
        style={{
          backgroundColor: "var(--card)", // 背景色
          borderTop: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
          // 紙の場合は角丸をあえて小さく、影も控えめに
          borderRadius: 2, 
          boxShadow: "0 2px 4px rgba(0,0,0,0.03)",
        }}
      >
        {children}
      </section>
    );
  }

  if (variant === "glass") {
    return (
      <section
        className={`${baseStyle} border border-white/20 shadow-xl`}
        style={{
          background: "rgba(255, 255, 255, 0.7)", 
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

  // Plain
  return (
    <section className={`${baseStyle} border rounded-xl`} style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      {children}
    </section>
  );
}

// --- Block Controller ---

function BlockView({ block, cardVariant, programVariant, encoreRevealed }: any) {
  const type = block.type;
  const content = block.content ?? {};

  // --- Greeting Block ---
  if (type === "greeting") {
    if (!content.text) return null;
    
    // Paperモードの場合、画像左・テキスト右の雑誌レイアウトにする
    if (cardVariant === "paper") {
      return (
        <div className="py-4">
          <SectionTitle title="ご挨拶" subtitle="Greeting" variant={cardVariant} />
          <div className="flex flex-col md:flex-row gap-6 items-start">
             {/* 著者の写真がある場合（APIレスポンスに含まれる想定、なければプレースホルダ） */}
             <div className="shrink-0 mx-auto md:mx-0">
                <div className="w-32 h-40 bg-[var(--muted)]/10 rounded-lg overflow-hidden border border-[var(--border)] shadow-sm">
                   {/* ここで著者画像があれば表示。なければアイコン */}
                   {content.image ? (
                      <img src={content.image} className="w-full h-full object-cover" alt="Speaker"/>
                   ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--muted)]"><User size={40}/></div>
                   )}
                </div>
                {content.author && (
                  <div className="mt-2 text-center text-xs font-serif font-bold tracking-wider">{content.author}</div>
                )}
             </div>
             
             <div className="flex-1">
                {/* 飾り罫線 */}
                <div className="h-[2px] w-full bg-[var(--border)] mb-4 opacity-50"/>
                <p className="text-[15px] leading-8 text-justify whitespace-pre-wrap font-serif opacity-90">
                  {content.text}
                </p>
                <div className="h-[2px] w-full bg-[var(--border)] mt-4 opacity-50"/>
             </div>
          </div>
        </div>
      );
    }

    // Default Layout
    return (
      <div>
        <SectionTitle icon={MessageSquare} title="ご挨拶" subtitle="Greeting" variant={cardVariant} />
        <Card variant={cardVariant}>
          <div className="p-6 md:p-8">
            <p className="text-[15px] leading-8 whitespace-pre-wrap opacity-90">
              {content.text}
            </p>
            {content.author && <div className="mt-6 text-right font-bold text-sm">{content.author}</div>}
          </div>
        </Card>
      </div>
    );
  }

  // --- Image Block ---
  if (type === "image") {
    if (!content.url) return null;
    return (
      <figure className={`relative overflow-hidden my-8 ${cardVariant === 'paper' ? 'rounded-sm shadow-md' : 'rounded-[24px] shadow-lg'}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={content.url} alt="" className="w-full h-auto object-cover" />
        {content.caption && (
          <figcaption className="bg-black/60 text-white p-3 text-xs text-center font-serif tracking-wider">
            {content.caption}
          </figcaption>
        )}
      </figure>
    );
  }

  // --- Profile Block ---
  if (type === "profile") {
    const people = content.people ?? [];
    if (!people.length) return null;

    return (
      <div>
        <SectionTitle icon={User} title="出演者" subtitle="Profiles" variant={cardVariant} />
        
        {/* Paperモード: 画像下部のようなカードレイアウト */}
        <div className={`grid gap-6 ${cardVariant === 'paper' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
          {people.map((p: any, i: number) => (
            <Card key={i} variant={cardVariant}>
              <div className={`${cardVariant === 'paper' ? 'flex flex-col' : 'flex flex-col md:flex-row'}`}>
                {/* 画像エリア */}
                <div className={`relative overflow-hidden bg-gray-100 ${cardVariant === 'paper' ? 'w-full aspect-[4/3]' : 'w-full md:w-48 aspect-[4/3] md:aspect-auto'}`}>
                   {p.image ? (
                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><User size={40} /></div>
                  )}
                </div>
                {/* テキストエリア */}
                <div className="p-5 flex-1 flex flex-col justify-center">
                  <h3 className="text-lg font-serif font-bold text-[var(--accent)]">{p.name}</h3>
                  <div className="text-xs font-bold tracking-widest uppercase opacity-60 mb-3 border-b border-[var(--border)] pb-2 inline-block">
                    {p.role}
                  </div>
                  {p.bio && (
                    <p className="text-sm leading-6 opacity-80 text-justify whitespace-pre-wrap font-serif">
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

  // --- Program Block ---
  if (type === "program") {
    const items = content.items ?? [];
    if (!items.length) return null;

    return (
      <div>
        <SectionTitle icon={Music} title="プログラム" subtitle="Program" variant={cardVariant} />
        
        {programVariant === "ornament" ? (
          // 画像のような装飾リスト（新しいデザイン）
          <div className="space-y-2">
            {items.map((it: any, idx: number) => (
              <ProgramOrnamentItem
                key={idx}
                item={it}
                index={idx}
                encoreRevealed={encoreRevealed}
              />
            ))}
          </div>
        ) : programVariant === "timeline" ? (
          // タイムライン（テック風）
          <div className="relative pl-4 space-y-6">
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
          // リスト（シンプル）
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

// --- Program Item Variants ---

// New! クラシック・オーナメント形式（画像のようなデザイン）
function ProgramOrnamentItem({ item, index, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  
  if (item.isEncore && !encoreRevealed) return null;
  
  const isBreak = item.type === "break";
  const active = item.active === true;
  
  // 休憩（Intermission）の特別表示
  if (isBreak) {
    return (
      <div className="py-8 flex items-center justify-center gap-4 opacity-70">
        <div className="h-[1px] w-12 bg-[var(--border)]" />
        <div className="flex flex-col items-center gap-1 text-[var(--accent)]">
          <Coffee size={20} />
          <span className="text-xs font-serif font-bold tracking-[0.2em] uppercase">Intermission</span>
          {item.duration && <span className="text-[10px] opacity-80">{item.duration}</span>}
        </div>
        <div className="h-[1px] w-12 bg-[var(--border)]" />
      </div>
    );
  }

  // アンコールヘッダー（最初のアンコール曲の前に表示するなどのロジックが必要だが、ここではシンプルに曲自体にラベルをつける）
  
  return (
    <div className={`group transition-all duration-500 ${active ? "scale-[1.02]" : ""}`}>
      <div 
        onClick={() => setOpen(!open)}
        className="cursor-pointer py-4 px-2 hover:bg-[var(--accent)]/5 rounded-lg transition-colors"
      >
        <div className="flex items-baseline gap-3">
          {/* 金色のドット装飾 */}
          <div className={`w-2 h-2 rounded-full shrink-0 transform translate-y-[-2px] 
            ${active ? "bg-[var(--accent)] animate-pulse shadow-[0_0_8px_var(--accent)]" : "bg-[#C5A065]"}`} 
          />
          
          <div className="flex-1">
             <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-4">
               <h3 className={`text-lg font-serif font-medium leading-snug 
                 ${active ? "text-[var(--accent)] font-bold" : "text-[var(--text)]"}
               `}>
                 {item.title}
               </h3>
               {/* 演奏中バッジ */}
               {active && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--accent)] animate-pulse">
                    <Sparkles size={10} /> Now Playing
                  </span>
               )}
               {item.isEncore && (
                 <span className="text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)] px-2 rounded-full self-start md:self-auto">
                   Encore
                 </span>
               )}
             </div>
             
             {item.composer && (
               <div className="text-sm opacity-60 font-serif italic mt-1">{item.composer}</div>
             )}
          </div>

          <ChevronDown size={16} className={`opacity-30 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>

        {/* 解説展開 */}
        <div className={`grid transition-all duration-300 ${open ? "grid-rows-[1fr] mt-4 opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
          <div className="overflow-hidden">
             <div className="pl-5 border-l-2 border-[var(--border)] ml-1">
               <p className="text-sm leading-7 font-serif text-justify opacity-80 whitespace-pre-wrap">
                 {item.description || "解説はありません。"}
               </p>
             </div>
          </div>
        </div>
      </div>
      
      {/* 区切り線（最後の要素以外） */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-[var(--border)] to-transparent opacity-40 mt-2" />
    </div>
  );
}

// タイムライン形式（既存維持）
function ProgramTimelineItem({ item, index, cardVariant, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  if (item.isEncore && !encoreRevealed) return null;
  const isBreak = item.type === "break";
  const active = item.active === true;
  const activeGlow = active ? "animate-pulse-ring ring-1 ring-[var(--accent)]" : "";

  return (
    <div className={`relative flex gap-4 ${active ? "z-10" : ""}`}>
      <div className={`shrink-0 w-6 h-6 rounded-full border-[3px] z-10 mt-5 bg-[var(--bg)] transition-colors duration-500
          ${active ? "border-[var(--accent)] scale-125" : isBreak ? "border-[var(--muted)] opacity-50" : "border-[var(--border)]"}
        `}
      />
      <div className="flex-1 min-w-0">
        <Card variant={cardVariant} className={`${activeGlow} ${active ? "bg-[var(--card)]" : ""}`}>
          <div className={`cursor-pointer ${isBreak ? "py-3 px-5 bg-[var(--muted)]/5" : "p-5"}`} onClick={() => (!isBreak ? setOpen((v) => !v) : null)}>
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  {active && <span className="text-[10px] font-bold text-[var(--accent)] flex gap-1"><Sparkles size={10}/> PLAYING</span>}
                  {item.isEncore && <span className="text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)] px-1 rounded">ENCORE</span>}
                  {isBreak && <span className="text-[10px] font-bold text-[var(--muted)]">BREAK</span>}
                </div>
                <h3 className={`text-base font-bold leading-snug ${active ? "text-[var(--accent)]" : ""}`}>{item.title}</h3>
                {!isBreak && item.composer && <div className="text-xs font-medium opacity-60 uppercase">{item.composer}</div>}
              </div>
              {!isBreak && <ChevronDown size={20} className={`mt-1 text-[var(--accent)] transition-transform ${open ? "rotate-180" : "opacity-30"}`} />}
            </div>
            {!isBreak && open && (
               <div className="mt-4 pt-4 border-t border-[var(--border)] animate-enter">
                  <p className="text-sm leading-7 opacity-85 text-justify whitespace-pre-wrap">{item.description}</p>
               </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// リスト形式（既存維持）
function ProgramListItem({ item, index, encoreRevealed }: any) {
  const [open, setOpen] = useState(false);
  if (item.isEncore && !encoreRevealed) return null;
  const isBreak = item.type === "break";
  const active = item.active === true;

  return (
    <li className={`transition-colors duration-300 ${active ? "bg-[var(--accent)]/5" : ""}`}>
      <div className="p-5 cursor-pointer" onClick={() => !isBreak && setOpen(!open)}>
        <div className="flex items-center gap-4">
           <div className={`shrink-0 w-8 text-center font-bold text-sm ${active ? "text-[var(--accent)]" : "opacity-30"}`}>
             {isBreak ? <Coffee size={18} className="mx-auto"/> : active ? <Play size={18} className="mx-auto fill-current"/> : index + 1}
           </div>
           <div className="flex-1 min-w-0">
              {active && <div className="text-[10px] font-bold text-[var(--accent)] mb-1">演奏中</div>}
              <div className="font-bold truncate">{item.title}</div>
              {item.composer && <div className="text-xs opacity-60 truncate">{item.composer}</div>}
           </div>
           {!isBreak && <ChevronDown size={16} className={`opacity-30 transition-transform ${open ? "rotate-180" : ""}`} />}
        </div>
        {!isBreak && open && (
          <div className="mt-4 pl-12 pr-2 animate-enter">
             <p className="text-sm leading-relaxed opacity-80 text-justify whitespace-pre-wrap">{item.description}</p>
          </div>
        )}
      </div>
    </li>
  );
}