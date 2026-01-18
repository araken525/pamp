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
  User,
  Twitter,
  Instagram,
  Globe,
  MessageCircle,
  Heart,
  ExternalLink,
  Calendar,
  Clock
} from "lucide-react";
import { Cinzel, Zen_Old_Mincho, Cormorant_Garamond } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts Setup ---
const cinzel = Cinzel({ 
  subsets: ["latin"], 
  weight: ["400", "700"],
  display: 'swap'
});
const cormorant = Cormorant_Garamond({ 
  subsets: ["latin"], 
  weight: ["400", "500", "600", "700"], 
  style: ["normal", "italic"],
  display: 'swap'
});
const mincho = Zen_Old_Mincho({ 
  subsets: ["latin"], 
  weight: ["400", "700", "900"],
  display: 'swap'
});

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// --- Theme & Style Configuration ---
function getThemeColors(palette: any) {
  const accent = palette?.accent ?? "#B48E55"; // Classic Antique Gold
  return {
    // Standard Mode (Paper)
    "--bg": "#F9F8F2", 
    "--text": "#2A2A2A", 
    "--accent": accent,
    "--muted": "#888888",
    "--line": "#E5E5E5",
    
    // Live Mode (Midnight Blue Velvet)
    "--live-bg": "#0f172a", // Deep Midnight Blue
    "--live-text": "#e2e8f0", // Silver Grey
    "--live-accent": "#fcd34d", // Champagne Gold
    "--live-line": "#334155",
    "--live-glow": "rgba(252, 211, 77, 0.4)",
  } as React.CSSProperties;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);
  
  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [footerLinks, setFooterLinks] = useState<{survey?: string, donation?: string}>({});
  const [activeBreak, setActiveBreak] = useState<{end: string, duration: string} | null>(null);

  // --- Initialization ---
  useEffect(() => {
    let channel: any;
    async function init() {
      setLoading(true);
      const { data: e, error } = await supabase.from("events").select("*").eq("slug", slug).single();
      if (error || !e) { 
        setLoading(false); 
        return; 
      }
      setEvent(e);
      
      const theme = typeof e.theme === 'string' ? JSON.parse(e.theme) : (e.theme || {});
      setFooterLinks(theme.footer_links || {});

      const fetchBlocks = async () => {
        const { data: b } = await supabase.from("blocks").select("*").eq("event_id", e.id).order("sort_order", { ascending: true });
        setBlocks(b ?? []);
        
        let foundBreak = null;
        b?.forEach((block: any) => {
           if(block.type === 'program') {
             block.content?.items?.forEach((item: any) => {
               if(item.type === 'break' && item.active && item.timerEnd && new Date(item.timerEnd).getTime() > Date.now()) {
                 foundBreak = { end: item.timerEnd, duration: item.duration };
               }
             });
           }
        });
        setActiveBreak(foundBreak);
      };
      await fetchBlocks();
      setLoading(false);

      channel = supabase.channel("viewer-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `id=eq.${e.id}` }, (payload: any) => {
            const ne = payload.new;
            setEvent(ne);
            const nth = typeof ne.theme === 'string' ? JSON.parse(ne.theme) : (ne.theme || {});
            setFooterLinks(nth.footer_links || {});
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "blocks", filter: `event_id=eq.${e.id}` }, async () => {
             await fetchBlocks();
        })
        .subscribe();
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
        "min-h-screen transition-colors duration-1000 ease-in-out selection:bg-[var(--accent)]/20 overflow-x-hidden touch-pan-y",
        mincho.className,
        liveMode ? "bg-[var(--live-bg)] text-[var(--live-text)]" : "bg-[var(--bg)] text-[var(--text)]"
      )}
      style={cssVars}
    >
      <style jsx global>{`
        body { overflow-x: hidden; touch-action: pan-y; }
      `}</style>

      {/* Paper Texture */}
      <div className={cn(
        "fixed inset-0 pointer-events-none z-0 mix-blend-multiply transition-opacity duration-1000",
        liveMode ? "opacity-0" : "opacity-[0.04]"
      )} style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* Live Mode Toggle */}
      <nav className="fixed top-6 right-6 z-50 flex items-center gap-3 mix-blend-difference text-white">
        <button 
          onClick={() => setLiveMode(!liveMode)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl border transition-all duration-700 shadow-2xl group",
            liveMode 
              ? "bg-white/10 border-white/20 text-[var(--live-accent)] shadow-[0_0_25px_rgba(252,211,77,0.2)]" 
              : "bg-black/10 border-white/10 text-white/80 hover:bg-black/20"
          )}
        >
          <Music size={14} className={liveMode ? "animate-pulse" : "group-hover:scale-110 transition-transform"} />
          <span className={cn("text-[10px] tracking-widest font-bold uppercase", cinzel.className)}>
            {liveMode ? "Live Mode" : "View"}
          </span>
        </button>
      </nav>

      {/* Break Timer */}
      <AnimatePresence>
        {activeBreak && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             transition={{ type: "spring", stiffness: 200, damping: 20 }}
             className={cn(
               "fixed bottom-8 right-6 z-50 backdrop-blur-lg border p-5 rounded-[1.5rem] shadow-2xl flex flex-col items-center gap-1.5",
               liveMode 
                 ? "bg-white/5 border-[var(--live-accent)]/30 text-[var(--live-accent)] shadow-[0_0_30px_rgba(0,0,0,0.5)]" 
                 : "bg-white/60 border-[var(--accent)]/30 text-[var(--accent)]"
             )}
           >
              <span className="text-[9px] font-bold tracking-widest flex items-center gap-1.5 animate-pulse">
                <Coffee size={12}/> 休憩中
              </span>
              <Countdown target={activeBreak.end} />
           </motion.div>
        )}
      </AnimatePresence>

      <Hero event={event} liveMode={liveMode} />
      
      <main className="max-w-3xl mx-auto px-6 pb-32 space-y-32 relative z-10">
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

      <div className="relative z-10">
        <FooterActions links={footerLinks} liveMode={liveMode} />
        <Footer event={event} liveMode={liveMode} />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// CORE COMPONENTS
// ------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F9F8F2] z-[9999]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="animate-spin text-[#B48E55]" size={32} />
        <span className={cn("text-[10px] tracking-[0.4em] uppercase text-[#B48E55] animate-pulse", cinzel.className)}>Loading</span>
      </div>
    </div>
  );
}

// === 1. HERO REFRESH: Centered Elegant Style ===
function Hero({ event, liveMode }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <motion.header 
      ref={ref}
      className="relative h-[90vh] w-full overflow-hidden flex flex-col justify-end items-center text-center px-6 pb-24 mb-24"
    >
      {/* Background */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover brightness-[0.85]" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-800" />
        )}
        {/* Gradient Overlay for Text Readability */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t via-transparent",
          liveMode 
            ? "from-[var(--live-bg)] via-[var(--live-bg)]/40 to-black/40" 
            : "from-black/60 via-black/20 to-black/30"
        )} />
      </motion.div>

      {/* Content: Centered & Elegant */}
      <div className="relative z-10 max-w-4xl w-full mx-auto text-white">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex flex-col items-center space-y-8"
        >
          {/* Label */}
          <div className="flex flex-col items-center gap-3">
             <span className={cn("text-xs tracking-[0.3em] uppercase font-bold text-white/90", cinzel.className)}>
               Digital Pamphlet
             </span>
             <div className="h-px w-12 bg-white/80"></div>
          </div>

          {/* Title: Big, Bold, Elegant */}
          <h1 className={cn(
            "text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]", 
            mincho.className
          )}>
            {event.title}
          </h1>

          {/* Info Block: Date & Location (Centered) */}
          <div className="flex flex-col items-center gap-4 text-white/90 pt-4">
             {event.date && (
                <div className={cn("text-lg font-medium tracking-wide", cormorant.className)}>
                   {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                   <span className="mx-2">/</span>
                   <span>{new Date(event.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
             )}
             {event.location && (
                <div className="text-base font-serif flex items-center justify-center gap-2 tracking-wider uppercase opacity-90">
                   <MapPin size={14} className="opacity-80"/> <span>{event.location}</span>
                </div>
             )}
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}

function BlockRenderer({ block, index, encoreRevealed, liveMode }: any) {
  const content = block.content || {};
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const Wrapper = ({ children }: any) => (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className="w-full"
    >
      {children}
    </motion.section>
  );

  switch (block.type) {
    // === 2. GREETING: Text Focused Layout ===
    case "greeting":
      return (
        <Wrapper>
          <SectionHeader title="Greeting" subtitle="ご挨拶" liveMode={liveMode} />
          <div className="max-w-xl mx-auto">
             {/* Header: Photo & Name (Subtle) */}
             <div className="flex items-center gap-5 mb-8 pb-4 border-b border-[var(--line)]/50">
               {content.image && (
                 <div className="w-16 h-16 rounded-full overflow-hidden border border-[var(--line)] shadow-sm shrink-0">
                    <img src={content.image} className="w-full h-full object-cover" alt="Author" />
                 </div>
               )}
               <div>
                  <h3 className="text-lg font-bold font-serif tracking-widest">{content.author}</h3>
                  <p className={cn("text-[10px] opacity-60 uppercase tracking-widest mt-0.5", cinzel.className)}>{content.role}</p>
               </div>
             </div>
             
             {/* Body: Pure Text */}
             <div className="space-y-6">
                <p className="text-base leading-[2.2] text-justify font-serif opacity-90">
                  {content.text}
                </p>
             </div>
          </div>
        </Wrapper>
      );

    // === 2 (Program). TIMELINE: Vertical Line & Humble Active State ===
    case "program":
      return (
        <Wrapper>
          <SectionHeader title="Program" subtitle="プログラム" liveMode={liveMode} />
          {/* Vertical Timeline Container */}
          <div className="relative pl-6 md:pl-8 border-l border-[var(--line)] space-y-12">
            {(content.items || []).map((item: any, i: number) => (
              <ProgramItem key={i} item={item} index={i} encoreRevealed={encoreRevealed} liveMode={liveMode} />
            ))}
          </div>
        </Wrapper>
      );

    case "profile":
      return (
        <Wrapper>
          <SectionHeader title="Artists" subtitle="出演者" liveMode={liveMode} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-16">
            {(content.people || []).map((p: any, i: number) => (
              <ProfileItem key={i} p={p} liveMode={liveMode} />
            ))}
          </div>
        </Wrapper>
      );

    // === 3 (Gallery). GALLERY: Art Book Style ===
    case "gallery":
      return (
        <Wrapper>
          <div className="py-8">
             <div className="flex items-end justify-between mb-8 px-2 border-b border-[var(--line)] pb-4">
                <div>
                   <h3 className={cn("text-xl font-bold tracking-widest uppercase", cinzel.className)}>{content.title || "Memories"}</h3>
                   <span className="text-[10px] opacity-50 tracking-[0.2em] uppercase">Photo Gallery</span>
                </div>
                {content.caption && <p className="text-xs opacity-60 font-serif max-w-[200px] text-right leading-tight">{content.caption}</p>}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(content.images || []).map((url: string, i: number) => (
                   <div key={i} className={cn(
                     "relative aspect-[4/5] overflow-hidden bg-stone-100 shadow-sm",
                     i % 3 === 0 ? "md:col-span-2 md:aspect-[16/10]" : "" // Variation
                   )}>
                      <img src={url} className="w-full h-full object-cover transition-transform duration-1000 hover:scale-105" alt="" />
                   </div>
                ))}
             </div>
          </div>
        </Wrapper>
      );

    case "free":
      return (
        <Wrapper>
          <div className="mb-6 pl-4 border-l-2 border-[var(--accent)]/50">
             <h3 className={cn("text-xl font-bold tracking-widest font-serif", liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}>
               {content.title || "Information"}
             </h3>
          </div>
          <div className="max-w-2xl px-2">
            <p className="text-sm md:text-base leading-8 whitespace-pre-wrap opacity-90 font-serif">
              {content.text}
            </p>
          </div>
        </Wrapper>
      );

    default: return null;
  }
}

// ------------------------------------------------------------------
// SUB COMPONENTS
// ------------------------------------------------------------------

function SectionHeader({ title, subtitle, liveMode }: any) {
  return (
    <div className="text-center mb-20">
      <h2 className={cn("text-3xl font-normal tracking-[0.2em] uppercase mb-2", cinzel.className, liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}>
        {title}
      </h2>
      <span className="text-[10px] tracking-[0.3em] opacity-40 uppercase block">{subtitle}</span>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed, liveMode }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  // --- Section Divider ---
  if (isSection) {
    return (
      <div className="relative -ml-6 md:-ml-8 pt-8 pb-4">
        <div className={cn("absolute left-0 top-1/2 w-4 md:w-6 h-px", liveMode ? "bg-[var(--live-line)]" : "bg-[var(--line)]")}></div>
        <span className={cn(
          "ml-8 md:ml-10 text-sm font-bold tracking-[0.2em] uppercase font-serif block",
          liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]"
        )}>
          {item.title}
        </span>
      </div>
    );
  }

  // --- Memo ---
  if (item.type === "memo") {
    return (
      <div className="pl-4 py-2 opacity-50">
        <span className={cn("text-xs italic tracking-wider", cormorant.className)}>* {item.title}</span>
      </div>
    );
  }

  // --- Break ---
  if (isBreak) {
    return (
      <div className={cn(
        "relative pl-6 py-6 transition-all duration-500",
        active ? "opacity-100" : "opacity-50"
      )}>
        <div className={cn(
           "absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-[var(--bg)] z-10",
           liveMode 
             ? (active ? "border-[var(--live-accent)] bg-[var(--live-accent)] shadow-[0_0_10px_var(--live-accent)]" : "border-[var(--live-line)]")
             : (active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)]")
        )}></div>
        
        <div className="flex items-center gap-3">
           <span className="text-xs font-bold tracking-[0.2em] uppercase">休 憩</span>
           {active && item.timerEnd ? (
              <span className="text-xs font-mono animate-pulse text-[var(--accent)]">Running</span>
           ) : (
              <span className={cn("text-xs italic opacity-60", cormorant.className)}>{item.duration}</span>
           )}
        </div>
      </div>
    );
  }

  // --- Song Item (Timeline) ---
  return (
    <div className="relative group pl-4">
      {/* Timeline Node (Dot) */}
      <div className={cn(
         "absolute -left-[5px] top-6 w-2.5 h-2.5 rounded-full border-2 transition-all duration-500 z-10",
         liveMode 
           ? (active ? "border-[var(--live-accent)] bg-[var(--live-accent)] shadow-[0_0_15px_var(--live-accent)] scale-125" : "border-[var(--live-line)] bg-[var(--live-bg)]")
           : (active ? "border-[var(--accent)] bg-[var(--accent)] scale-125" : "border-[var(--line)] bg-[var(--bg)]")
      )}></div>

      <div 
        className="cursor-pointer"
        onClick={() => item.description && setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1">
           {/* Humble "Now Playing" Indicator */}
           {active && (
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1 animate-pulse", 
                liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]"
              )}>
                <Sparkles size={8}/> Now Playing
              </span>
           )}

           {/* Title & Composer */}
           <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-8">
              <h3 className={cn(
                "text-lg font-bold leading-snug font-serif transition-colors duration-500", 
                active ? (liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]") : ""
              )}>
                {item.title}
              </h3>
              <span className={cn("text-sm opacity-60 italic", cormorant.className)}>{item.composer}</span>
           </div>
           
           {/* Performer */}
           {item.performer && (
              <div className="text-xs font-serif opacity-70 mt-1">
                {item.performer}
              </div>
           )}
           
           {item.isEncore && <span className={cn("text-[9px] mt-1 inline-block opacity-50 uppercase tracking-widest", cinzel.className)}>Encore</span>}
        </div>

        {/* Description Accordion */}
        <div className={cn("grid transition-all duration-500 ease-out overflow-hidden", isOpen ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0")}>
           <div className="overflow-hidden min-h-0 pl-2 border-l-2 border-[var(--line)]/50">
              <p className="text-sm leading-7 text-justify opacity-80 font-serif">
                {item.description}
              </p>
           </div>
        </div>
        
        {item.description && (
           <div className="flex justify-start mt-2 opacity-20">
              <ChevronDown size={12} className={cn("transition-transform duration-300", isOpen ? "rotate-180" : "")} />
           </div>
        )}
      </div>
    </div>
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
  return <div className="text-2xl font-mono font-bold tracking-widest">{left}</div>;
}

function ProfileItem({ p, liveMode }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Minimal Card */}
      <div className="flex items-center gap-5">
         <div className={cn(
           "relative w-20 h-24 rounded-sm overflow-hidden bg-stone-200 shrink-0",
           liveMode ? "opacity-90" : ""
         )}>
           {p.image ? (
             <img src={p.image} className="w-full h-full object-cover grayscale-[20%]" alt={p.name} />
           ) : (
             <div className="w-full h-full flex items-center justify-center opacity-20"><User size={24}/></div>
           )}
         </div>
         <div className="flex-1">
            <h3 className="text-lg font-bold font-serif">{p.name}</h3>
            <p className={cn("text-[10px] tracking-[0.2em] uppercase opacity-50 mb-2", cinzel.className)}>{p.role}</p>
            <div className="flex gap-3 opacity-60">
               {p.sns?.twitter && <a href={p.sns.twitter} target="_blank" rel="noopener noreferrer" className="hover:opacity-100"><Twitter size={14}/></a>}
               {p.sns?.instagram && <a href={p.sns.instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-100"><Instagram size={14}/></a>}
               {p.sns?.website && <a href={p.sns.website} target="_blank" rel="noopener noreferrer" className="hover:opacity-100"><Globe size={14}/></a>}
            </div>
         </div>
      </div>

      <div className="relative">
        <div className={cn("overflow-hidden transition-all duration-500", isOpen ? "max-h-[1000px]" : "max-h-0")}>
           <p className={cn("text-xs md:text-sm leading-6 opacity-70 font-serif whitespace-pre-wrap pl-1 border-l-2", liveMode ? "border-white/20" : "border-black/10")}>
             {p.bio}
           </p>
        </div>
        {p.bio && (
          <button onClick={() => setIsOpen(!isOpen)} className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1 mt-2 ml-1">
             {isOpen ? "Close" : "Bio"} <ChevronDown size={10} className={isOpen ? "rotate-180" : ""}/>
          </button>
        )}
      </div>
    </div>
  );
}

function FooterActions({ links, liveMode }: { links: { survey?: string, donation?: string }, liveMode: boolean }) {
  if (!links.survey && !links.donation) return null;
  return (
    <div className="max-w-md mx-auto px-6 mb-20 space-y-4">
      {links.survey && (
        <a href={links.survey} target="_blank" rel="noopener noreferrer" className={cn(
          "flex items-center justify-center gap-3 w-full py-4 rounded-sm transition-opacity hover:opacity-90",
          liveMode ? "bg-[var(--live-text)] text-[var(--live-bg)]" : "bg-[var(--text)] text-[var(--bg)]"
        )}>
           <MessageCircle size={18} />
           <span className="text-xs font-bold tracking-widest uppercase">アンケートに回答する</span>
        </a>
      )}
      {links.donation && (
        <a href={links.donation} target="_blank" rel="noopener noreferrer" className={cn(
          "flex items-center justify-center gap-3 w-full py-4 border rounded-sm transition-colors",
          liveMode ? "border-[var(--live-accent)] text-[var(--live-accent)] hover:bg-[var(--live-accent)]/10" : "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/5"
        )}>
           <Heart size={18} />
           <span className="text-xs font-bold tracking-widest uppercase">活動を支援する</span>
           <ExternalLink size={12} className="opacity-50"/>
        </a>
      )}
    </div>
  );
}

function Footer({ event, liveMode }: any) {
  return (
    <footer className="py-20 text-center opacity-40 space-y-4">
      <div className="w-px h-12 bg-current mx-auto"></div>
      <h2 className={cn("text-xl font-medium", mincho.className)}>{event.title}</h2>
      <p className="text-[10px] uppercase tracking-widest">Official Digital Pamphlet</p>
      <p className="text-[10px]">© {new Date().getFullYear()} All Rights Reserved.</p>
    </footer>
  );
}