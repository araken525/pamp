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
  User,
  Twitter,
  Instagram,
  Globe,
  MessageCircle,
  Heart,
  ExternalLink
} from "lucide-react";
import { Cinzel, Zen_Old_Mincho, Cormorant_Garamond } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts ---
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"] });
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
    "--bg": "#F9F8F2",
    "--text": "#2A2A2A",
    "--accent": accent,
    "--muted": "#888888",
    "--line": "#E5E5E5",
    // Dark Mode (Live)
    "--live-bg": "#0F172A",
    "--live-text": "#E2E8F0",
    "--live-accent": "#FCD34D",
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
  
  // Footer Links
  const [footerLinks, setFooterLinks] = useState<{survey?: string, donation?: string}>({});
  
  // Floating Timer State
  const [activeBreak, setActiveBreak] = useState<{end: string, duration: string} | null>(null);

  // Load Data
  useEffect(() => {
    let channel: any;
    async function init() {
      setLoading(true);
      const { data: e } = await supabase.from("events").select("*").eq("slug", slug).single();
      if (!e) { setLoading(false); return; }
      setEvent(e);
      
      const theme = typeof e.theme === 'string' ? JSON.parse(e.theme) : (e.theme || {});
      setFooterLinks(theme.footer_links || {});

      const fetchBlocks = async () => {
        const { data: b } = await supabase.from("blocks").select("*").eq("event_id", e.id).order("sort_order", { ascending: true });
        setBlocks(b ?? []);
        
        // Check for active break
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

      channel = supabase.channel("viewer")
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
        "min-h-screen transition-colors duration-1000 ease-in-out selection:bg-[var(--accent)]/20",
        mincho.className,
        liveMode ? "bg-[var(--live-bg)] text-[var(--live-text)]" : "bg-[var(--bg)] text-[var(--text)]"
      )}
      style={cssVars}
    >
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 mix-blend-multiply" style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* Mode Toggle */}
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
            {liveMode ? "Live Mode" : "Mode"}
          </span>
        </button>
      </nav>

      {/* Floating Timer (Bottom Right) */}
      <AnimatePresence>
        {activeBreak && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             className="fixed bottom-8 right-6 z-40 bg-white/10 backdrop-blur-md border border-[var(--accent)]/30 text-[var(--accent)] p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-1"
           >
              <span className="text-[9px] font-bold uppercase tracking-widest">Intermission</span>
              <Countdown target={activeBreak.end} />
           </motion.div>
        )}
      </AnimatePresence>

      <Hero event={event} liveMode={liveMode} />
      
      <main className="max-w-3xl mx-auto px-6 pb-20 space-y-24 relative z-10">
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

      <FooterActions links={footerLinks} />
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
      className="relative h-[85vh] w-full overflow-hidden flex flex-col items-center justify-center text-center px-6 mb-20"
    >
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[var(--bg)]" />
      </motion.div>

      <div className="relative z-10 text-white space-y-6 max-w-3xl pt-20">
        <div className="inline-block border-y border-white/40 py-1.5 px-6 backdrop-blur-[2px]">
          <span className={cn("text-xs tracking-[0.3em] uppercase font-medium", cinzel.className)}>
            Digital Pamphlet
          </span>
        </div>
        <h1 className={cn("text-4xl md:text-6xl font-bold leading-tight drop-shadow-xl", mincho.className)}>
          {event.title}
        </h1>
        <div className="flex flex-col items-center gap-2 text-sm font-light tracking-wider opacity-90">
          {event.date && (
            <div className="flex items-center gap-3">
              <span className="w-6 h-px bg-white/60"></span>
              <span className={cormorant.className}>{new Date(event.date).toLocaleDateString()}</span>
              <span className="w-6 h-px bg-white/60"></span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
              <MapPin size={12} /> {event.location}
            </div>
          )}
        </div>
      </div>
      
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 flex flex-col items-center gap-2">
        <span className={cn("text-[9px] tracking-widest uppercase", cinzel.className)}>Scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-white to-transparent" />
      </motion.div>
    </motion.header>
  );
}

function BlockRenderer({ block, index, encoreRevealed, liveMode }: any) {
  const content = block.content || {};
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const Wrapper = ({ children, className }: any) => (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
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
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {content.image && (
              <div className="shrink-0 w-32 md:w-48 aspect-[3/4] self-center md:self-start border border-[var(--line)] p-1 bg-white shadow-sm -rotate-1">
                <img src={content.image} className="w-full h-full object-cover" alt="Speaker" />
              </div>
            )}
            <div className="flex-1 space-y-4 text-center md:text-left">
              <div>
                <h3 className="text-lg font-bold tracking-widest">{content.author}</h3>
                <p className={cn("text-xs opacity-60 uppercase tracking-widest mt-1", cinzel.className)}>{content.role}</p>
              </div>
              <p className="text-sm md:text-base leading-8 text-justify opacity-80 whitespace-pre-wrap font-serif">
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
          <div className="space-y-1">
            {(content.items || []).map((item: any, i: number) => (
              <ProgramItem key={i} item={item} index={i} encoreRevealed={encoreRevealed} liveMode={liveMode} />
            ))}
          </div>
        </Wrapper>
      );

    case "profile":
      return (
        <Wrapper>
          <SectionHeader title="Artists" subtitle="出演者" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {(content.people || []).map((p: any, i: number) => (
              <ProfileItem key={i} p={p} />
            ))}
          </div>
        </Wrapper>
      );

    case "gallery":
      return (
        <Wrapper>
          <SectionHeader title="Gallery" subtitle="ギャラリー" />
          {/* Grid Layout */}
          <div className="grid grid-cols-2 gap-3">
             {(content.images || []).map((url: string, i: number) => (
                <div key={i} className="aspect-square relative bg-stone-100 overflow-hidden group">
                   <img src={url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                </div>
             ))}
          </div>
          {content.title && <div className="mt-4 text-center font-bold text-sm tracking-widest text-[var(--accent)]">{content.title}</div>}
          {content.caption && <div className="mt-2 text-center text-xs opacity-60 font-serif">{content.caption}</div>}
        </Wrapper>
      );

    case "free":
      return (
        <Wrapper>
           {/* Typography Title Effect */}
           <div className="relative py-8 text-center overflow-hidden">
              <div className={cn("absolute inset-0 flex items-center justify-center opacity-5 select-none text-6xl md:text-8xl font-bold uppercase tracking-tighter whitespace-nowrap", cinzel.className)}>
                 {content.title} {content.title}
              </div>
              <SectionHeader title={content.title || "Info"} subtitle="お知らせ" />
           </div>
          <div className="max-w-xl mx-auto text-center px-4">
            <p className="text-sm md:text-base leading-8 whitespace-pre-wrap opacity-90">{content.text}</p>
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
    <div className="text-center mb-12">
      <div className="flex items-center justify-center gap-4 mb-2">
         <div className="h-px w-6 bg-[var(--accent)]/40"></div>
         <h2 className={cn("text-2xl font-normal tracking-widest text-[var(--accent)] uppercase", cinzel.className)}>
           {title}
         </h2>
         <div className="h-px w-6 bg-[var(--accent)]/40"></div>
      </div>
      <span className="text-[10px] tracking-[0.2em] opacity-40">{subtitle}</span>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed, liveMode }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  // --- Section ---
  if (isSection) {
    return (
      <div className="pt-8 pb-4 flex items-center justify-center relative z-10">
        <div className="h-px w-full bg-[var(--line)] absolute top-1/2 left-0 -z-10"></div>
        <span className="bg-[var(--bg)] px-6 text-sm font-bold tracking-[0.3em] uppercase text-[var(--accent)]">{item.title}</span>
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
        "py-8 flex flex-col items-center justify-center gap-2 transition-all duration-700 border-y border-[var(--line)] my-4 bg-[var(--accent)]/5",
        active ? "opacity-100" : "opacity-60"
      )}>
        <Coffee size={16} className={active ? "text-[var(--accent)] animate-bounce" : ""} />
        <span className="text-xs font-bold tracking-[0.3em] uppercase">休 憩</span>
        {active && item.timerEnd ? (
           <div className="text-sm font-mono font-bold text-[var(--accent)] animate-pulse">Running</div>
        ) : (
           <span className={cn("text-sm italic", cormorant.className)}>{item.duration}</span>
        )}
      </div>
    );
  }

  // --- Song ---
  return (
    <div className="relative group">
      {active && <div className="absolute -left-3 top-2 bottom-2 w-0.5 bg-[var(--accent)] shadow-[0_0_10px_var(--accent)] animate-pulse"></div>}
      
      <div 
        className={cn(
           "py-4 px-3 md:px-6 cursor-pointer transition-colors duration-500 rounded-sm",
           active ? "bg-[var(--accent)]/5" : "hover:bg-[var(--text)]/5"
        )}
        onClick={() => item.description && setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1">
          {/* Row 1: Title & Composer */}
          <div className="flex items-baseline justify-between gap-4">
             <h3 className={cn("text-base md:text-lg font-medium leading-snug", active ? "text-[var(--accent)] font-bold drop-shadow-sm" : "")}>
               {item.title}
             </h3>
             <span className={cn("text-sm opacity-60 italic shrink-0", cormorant.className)}>{item.composer}</span>
          </div>
          
          {/* Row 2: Performer & Tags */}
          <div className="flex items-center justify-between mt-1">
             <div className="flex items-center gap-2">
                {active && <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-wider flex items-center gap-1"><Sparkles size={8}/> Playing</span>}
                {item.performer && (
                   <span className="text-xs text-[var(--accent)] opacity-80 font-medium tracking-wide">
                     {item.performer}
                   </span>
                )}
             </div>
             {item.isEncore && <span className={cn("text-[9px] px-1.5 py-0.5 border border-[var(--text)]/20 rounded-full opacity-50", cinzel.className)}>Encore</span>}
          </div>
        </div>

        {/* Accordion: Description */}
        <div className={cn("grid transition-all duration-300 ease-out overflow-hidden", isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0")}>
           <div className="overflow-hidden min-h-0">
              <p className="text-sm leading-7 text-justify opacity-70 font-serif border-t border-[var(--line)] pt-2">
                {item.description}
              </p>
           </div>
        </div>
        
        {/* Toggle Indicator */}
        {item.description && (
           <div className="flex justify-center mt-1 opacity-20">
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

function ProfileItem({ p }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-center text-center gap-4">
      {/* Photo */}
      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border border-[var(--line)] shadow-sm">
        {p.image ? (
          <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-100 opacity-20"><User size={32}/></div>
        )}
      </div>
      
      {/* Info */}
      <div className="space-y-1.5 w-full">
        <h3 className="text-lg font-bold font-serif">{p.name}</h3>
        <p className={cn("text-[10px] tracking-[0.2em] uppercase opacity-50", cinzel.className)}>{p.role}</p>
        
        {/* SNS Links */}
        <div className="flex justify-center gap-4 pt-1 opacity-60">
           {p.sns?.twitter && <a href={p.sns.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors"><Twitter size={14}/></a>}
           {p.sns?.instagram && <a href={p.sns.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors"><Instagram size={14}/></a>}
           {p.sns?.website && <a href={p.sns.website} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent)] transition-colors"><Globe size={14}/></a>}
        </div>
      </div>

      {/* Accordion Bio */}
      <div className="relative w-full">
        <div className={cn("overflow-hidden transition-all duration-500", isOpen ? "max-h-[1000px]" : "max-h-0")}>
           <p className="text-sm leading-7 text-justify opacity-80 font-serif px-2 pt-2 pb-4 bg-[var(--text)]/5 rounded-xl">
             {p.bio}
           </p>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center gap-1 mx-auto mt-2">
           {isOpen ? "Close" : "Read Profile"} <ChevronDown size={10} className={isOpen ? "rotate-180" : ""}/>
        </button>
      </div>
    </div>
  );
}

function FooterActions({ links }: { links: { survey?: string, donation?: string } }) {
  if (!links.survey && !links.donation) return null;
  return (
    <div className="max-w-md mx-auto px-6 mb-20 space-y-4">
      {links.survey && (
        <a href={links.survey} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-4 bg-[var(--text)] text-[var(--bg)] rounded-sm hover:opacity-90 transition-opacity">
           <MessageCircle size={18} />
           <span className="text-xs font-bold tracking-widest uppercase">アンケートに回答する</span>
        </a>
      )}
      {links.donation && (
        <a href={links.donation} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-3 w-full py-4 border border-[var(--accent)] text-[var(--accent)] rounded-sm hover:bg-[var(--accent)]/5 transition-colors">
           <Heart size={18} />
           <span className="text-xs font-bold tracking-widest uppercase">活動を支援する</span>
           <ExternalLink size={12} className="opacity-50"/>
        </a>
      )}
    </div>
  );
}

function Footer({ event }: any) {
  return (
    <footer className="py-20 text-center opacity-40 space-y-4">
      <div className="w-px h-12 bg-current mx-auto"></div>
      <h2 className={cn("text-xl font-medium", mincho.className)}>{event.title}</h2>
      <p className="text-[10px] uppercase tracking-widest">Official Digital Pamphlet</p>
      <p className="text-[10px]">© {new Date().getFullYear()} All Rights Reserved.</p>
    </footer>
  );
}