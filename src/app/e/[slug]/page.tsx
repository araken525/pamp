"use client";

import { use, useEffect, useMemo, useState, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { 
  motion, 
  useScroll, 
  useTransform, 
  AnimatePresence,
  useInView
} from "framer-motion";
import {
  MapPin,
  Coffee,
  ChevronDown,
  Sparkles,
  Music,
  Loader2,
  Clock,
  Wind
} from "lucide-react";
import { Cinzel, Zen_Old_Mincho, Cormorant_Garamond } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts ---
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "600", "700"], style: ["normal", "italic"] });
const mincho = Zen_Old_Mincho({ subsets: ["latin"], weight: ["400", "700", "900"] });

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Theme Config ---
function getThemeColors(palette: any) {
  const accent = palette?.accent ?? "#B48E55"; // Classic Gold
  return {
    "--bg": "#F9F8F2", // 非常に淡いクリーム
    "--text": "#2A2A2A", // 墨色
    "--accent": accent,
    "--muted": "#888888",
    "--line": "#E5E5E5",
    // Dark Mode (Live)
    "--live-bg": "#0F172A", // Midnight Blue
    "--live-text": "#E2E8F0",
    "--live-accent": "#FCD34D", // Bright Gold
    "--live-line": "#334155",
  } as React.CSSProperties;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);

  // Load Data
  useEffect(() => {
    let channel: any;
    async function init() {
      setLoading(true);
      const { data: e } = await supabase.from("events").select("*").eq("slug", slug).single();
      if (!e) { setLoading(false); return; }
      setEvent(e);

      const fetchBlocks = async () => {
        const { data: b } = await supabase.from("blocks").select("*").eq("event_id", e.id).order("sort_order", { ascending: true });
        setBlocks(b ?? []);
      };
      await fetchBlocks();
      setLoading(false);

      channel = supabase.channel("viewer").on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload: any) => {
         if (payload.new.id === e.id) setEvent(payload.new);
      }).on("postgres_changes", { event: "*", schema: "public", table: "blocks" }, () => fetchBlocks()).subscribe();
    }
    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [slug]);

  const cssVars = useMemo(() => getThemeColors(event?.theme?.palette), [event]);

  if (loading) return <LoadingScreen />;
  if (!event) return notFound();

  return (
    <div 
      className={cn(
        "min-h-screen transition-colors duration-1000 ease-in-out selection:bg-accent/20",
        mincho.className,
        liveMode ? "bg-[var(--live-bg)] text-[var(--live-text)]" : "bg-[var(--bg)] text-[var(--text)]"
      )}
      style={cssVars}
    >
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-multiply" style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* Floating Controls */}
      <nav className="fixed top-6 right-6 z-50 flex items-center gap-3 mix-blend-difference text-white">
        <button 
          onClick={() => setLiveMode(!liveMode)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl border transition-all duration-500 shadow-2xl",
            liveMode 
              ? "bg-white/10 border-white/20 text-yellow-200 shadow-[0_0_30px_rgba(253,224,71,0.2)]" 
              : "bg-black/10 border-white/10 text-white/80 hover:bg-black/20"
          )}
        >
          <Music size={14} className={liveMode ? "animate-pulse" : ""} />
          <span className={cn("text-[10px] tracking-widest font-bold uppercase", cinzel.className)}>
            {liveMode ? "Live Mode" : "Program"}
          </span>
        </button>
      </nav>

      {/* Main Content */}
      <Hero event={event} liveMode={liveMode} />
      
      <main className="max-w-4xl mx-auto px-6 pb-40 space-y-32 relative z-10">
        {blocks.map((block, i) => (
          <BlockRenderer 
            key={block.id} 
            block={block} 
            index={i} 
            encoreRevealed={event.encore_revealed} 
            liveMode={liveMode}
          />
        ))}
      </main>

      <Footer event={event} />
    </div>
  );
}

// ------------------------------------------------------------------
// COMPONENTS
// ------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F9F8F2] z-[9999]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-[#B48E55]" size={30} />
        <span className={cn("text-xs tracking-[0.3em] uppercase text-[#B48E55]", cinzel.className)}>Loading</span>
      </div>
    </div>
  );
}

function Hero({ event, liveMode }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <motion.header 
      ref={ref}
      className="relative h-[90vh] w-full overflow-hidden flex flex-col items-center justify-center text-center px-6 mb-20"
    >
      {/* Background Image with Parallax */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
        <div className={cn(
          "absolute inset-0 transition-colors duration-1000",
          liveMode ? "bg-slate-900/80" : "bg-black/20"
        )} />
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent to-transparent",
          liveMode ? "from-[var(--live-bg)]" : "from-[var(--bg)]"
        )} />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-white space-y-8 max-w-3xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 1, delay: 0.2 }}
          className="inline-block border-t border-b border-white/30 py-2 px-6 backdrop-blur-sm"
        >
          <span className={cn("text-xs md:text-sm tracking-[0.4em] uppercase font-bold", cinzel.className)}>
            Concert Program
          </span>
        </motion.div>

        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          transition={{ duration: 1, delay: 0.4 }}
          className={cn("text-4xl md:text-7xl font-bold leading-tight drop-shadow-lg", mincho.className)}
        >
          {event.title}
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          transition={{ duration: 1, delay: 0.8 }}
          className="flex flex-col items-center gap-3 text-sm md:text-base font-light tracking-wider opacity-90"
        >
          {event.date && (
            <div className="flex items-center gap-3">
              <span className="w-8 h-px bg-white/50"></span>
              <span className={cormorant.className}>{new Date(event.date).toLocaleDateString()}</span>
              <span className="w-8 h-px bg-white/50"></span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
              <MapPin size={12} /> {event.location}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2"
      >
        <span className={cn("text-[10px] tracking-widest uppercase", cinzel.className)}>Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-white to-transparent" />
      </motion.div>
    </motion.header>
  );
}

function BlockRenderer({ block, index, encoreRevealed, liveMode }: any) {
  const content = block.content || {};
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const Wrapper = ({ children, className }: any) => (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={cn("w-full", className)}
    >
      {children}
    </motion.section>
  );

  switch (block.type) {
    case "greeting":
      return (
        <Wrapper>
          <SectionHeader title="Greeting" subtitle="ご挨拶" />
          <div className="flex flex-col md:flex-row gap-12 items-center">
            {content.image && (
              <div className="shrink-0 w-full md:w-1/3 aspect-[3/4] relative">
                <div className="absolute inset-0 border border-[var(--text)] opacity-20 translate-x-3 translate-y-3"></div>
                <img src={content.image} className="w-full h-full object-cover grayscale-[20%]" alt="Speaker" />
              </div>
            )}
            <div className="flex-1 space-y-8 text-center md:text-left">
              <div className="space-y-2">
                <h3 className="text-xl font-bold tracking-widest">{content.author}</h3>
                <p className={cn("text-sm opacity-60 uppercase tracking-widest", cinzel.className)}>{content.role}</p>
              </div>
              <p className="text-base md:text-lg leading-loose text-justify opacity-80 whitespace-pre-wrap font-serif">
                {content.text}
              </p>
            </div>
          </div>
        </Wrapper>
      );

    case "program":
      return (
        <Wrapper>
          <SectionHeader title="Program" subtitle="プログラム" />
          <div className="relative border-l border-[var(--line)] ml-4 md:ml-0 md:border-l-0">
             {/* Timeline Line for Desktop */}
             <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-[var(--line)] -translate-x-1/2"></div>
             
             <div className="space-y-12">
                {(content.items || []).map((item: any, i: number) => (
                  <ProgramItem key={i} item={item} index={i} encoreRevealed={encoreRevealed} liveMode={liveMode} />
                ))}
             </div>
          </div>
        </Wrapper>
      );

    case "profile":
      return (
        <Wrapper>
          <SectionHeader title="Artists" subtitle="出演者" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-20">
            {(content.people || []).map((p: any, i: number) => (
              <ProfileItem key={i} p={p} />
            ))}
          </div>
        </Wrapper>
      );

    case "gallery":
      return (
        <Wrapper className="!max-w-none w-screen relative left-1/2 -translate-x-1/2">
          <div className="max-w-4xl mx-auto px-6 mb-10"><SectionHeader title="Gallery" subtitle="ギャラリー" /></div>
          <div className="flex overflow-x-auto gap-8 px-6 md:px-[20vw] pb-16 snap-x snap-mandatory scrollbar-hide">
            {(content.images || []).map((url: string, i: number) => (
              <div key={i} className="shrink-0 snap-center relative">
                <div className="w-[80vw] md:w-[400px] aspect-[4/3] bg-white p-3 shadow-2xl rotate-1 even:-rotate-1 transition-transform hover:rotate-0 hover:scale-105 duration-500">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                </div>
              </div>
            ))}
          </div>
        </Wrapper>
      );

    case "free":
      return (
        <Wrapper>
          <SectionHeader title={content.title || "Information"} subtitle="お知らせ" />
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-base leading-loose whitespace-pre-wrap opacity-90">{content.text}</p>
          </div>
        </Wrapper>
      );

    default: return null;
  }
}

// ------------------------------------------------------------------
// SUB COMPONENTS
// ------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string, subtitle: string }) {
  return (
    <div className="text-center mb-16 space-y-2">
      <h2 className={cn("text-3xl md:text-4xl font-normal tracking-wider text-[var(--accent)]", cinzel.className)}>
        {title}
      </h2>
      <div className="flex items-center justify-center gap-3 opacity-40">
        <div className="h-px w-8 bg-current"></div>
        <span className="text-xs tracking-[0.2em]">{subtitle}</span>
        <div className="h-px w-8 bg-current"></div>
      </div>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed, liveMode }: any) {
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  // --- Section ---
  if (isSection) {
    return (
      <div className="py-12 flex items-center justify-center relative z-10">
        <div className="bg-[var(--bg)] px-6 py-2 border-y border-[var(--accent)] text-[var(--accent)] transition-colors duration-1000">
          <span className="text-sm font-bold tracking-[0.3em] uppercase">{item.title}</span>
        </div>
      </div>
    );
  }

  // --- Memo ---
  if (item.type === "memo") {
    return (
      <div className="flex justify-center py-2 opacity-60">
        <span className={cn("text-xs italic tracking-wider", cormorant.className)}>{item.title}</span>
      </div>
    );
  }

  // --- Break ---
  if (isBreak) {
    return (
      <div className={cn(
        "py-10 flex flex-col items-center justify-center gap-3 transition-all duration-700",
        active ? "opacity-100 scale-110" : "opacity-50"
      )}>
        <Coffee size={20} className={active ? "text-[var(--accent)] animate-bounce" : ""} />
        <span className="text-xs font-bold tracking-[0.2em] uppercase">休 憩</span>
        
        {item.timerEnd && new Date(item.timerEnd).getTime() > Date.now() ? (
           <Countdown target={item.timerEnd} />
        ) : (
           <span className={cn("text-xl italic", cormorant.className)}>{item.duration}</span>
        )}
      </div>
    );
  }

  // --- Song ---
  return (
    <motion.div 
      className={cn(
        "relative flex flex-col md:flex-row items-center md:justify-between gap-4 md:gap-12 p-6 md:p-8 transition-all duration-700 rounded-sm",
        active 
          ? "bg-[var(--accent)]/5 border-y border-[var(--accent)]/20 shadow-[0_0_40px_-10px_rgba(var(--accent),0.1)] scale-[1.02]" 
          : "hover:bg-[var(--text)]/5"
      )}
    >
      {/* Connector Line (Mobile) */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--accent)] opacity-0 transition-opacity duration-500 md:hidden" style={{ opacity: active ? 1 : 0 }} />

      <div className="flex-1 text-center md:text-left space-y-2 w-full">
        <div className="flex items-center justify-center md:justify-start gap-3">
          {active && <Sparkles size={14} className="text-[var(--accent)] animate-pulse" />}
          <h3 className={cn(
            "text-xl md:text-2xl font-medium leading-snug transition-colors duration-500",
            active ? "text-[var(--accent)] font-bold" : ""
          )}>
            {item.title}
          </h3>
          {item.isEncore && <span className={cn("text-[10px] px-2 py-0.5 border rounded-full opacity-60", cinzel.className)}>Encore</span>}
        </div>
        <p className={cn("text-lg opacity-60 italic", cormorant.className)}>{item.composer}</p>
      </div>

      {/* Description (Visible if active or hover) */}
      <div className="w-full md:w-1/3 text-sm leading-relaxed opacity-70 text-justify md:text-right font-serif">
        {item.description}
      </div>
    </motion.div>
  );
}

function Countdown({ target }: { target: string }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const i = setInterval(() => {
      const d = new Date(target).getTime() - Date.now();
      if (d <= 0) { setLeft(""); clearInterval(i); return; }
      setLeft(`${Math.floor(d/60000)}:${Math.floor((d%60000)/1000).toString().padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(i);
  }, [target]);
  if(!left) return null;
  return <div className="text-3xl font-mono font-bold text-[var(--accent)] tracking-widest animate-pulse">{left}</div>;
}

function ProfileItem({ p }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 group">
      <div className="relative w-full aspect-[3/4] overflow-hidden bg-stone-200">
        {p.image ? (
          <img src={p.image} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20"><User size={48}/></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
           <span className="text-white text-xs tracking-widest uppercase">View Profile</span>
        </div>
      </div>
      
      <div className="text-center space-y-1">
        <h3 className="text-2xl font-bold font-serif">{p.name}</h3>
        <p className={cn("text-xs tracking-[0.2em] uppercase opacity-50", cinzel.className)}>{p.role}</p>
      </div>

      <div className="relative">
        <p className={cn(
          "text-sm leading-7 text-justify opacity-80 font-serif overflow-hidden transition-all duration-500",
          isOpen ? "max-h-[1000px]" : "max-h-[4.5em]" // 3 lines visible approx
        )}>
          {p.bio}
        </p>
        {!isOpen && p.bio && p.bio.length > 100 && (
          <div className="absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[var(--bg)] to-transparent flex items-end justify-center transition-colors duration-1000">
             <button onClick={() => setIsOpen(true)} className="text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 flex items-center gap-1 bg-[var(--bg)] px-2">
                Read More <ChevronDown size={10}/>
             </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Footer({ event }: any) {
  return (
    <footer className="py-20 text-center opacity-40 space-y-4">
      <div className="w-px h-16 bg-current mx-auto"></div>
      <h2 className={cn("text-2xl font-bold", mincho.className)}>{event.title}</h2>
      <p className="text-[10px] uppercase tracking-widest">Official Digital Program</p>
      <p className="text-[10px]">© {new Date().getFullYear()} All Rights Reserved.</p>
    </footer>
  );
}