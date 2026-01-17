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
  Calendar
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
    "--live-bg": "#0f172a",
    "--live-text": "#e2e8f0",
    "--live-accent": "#fcd34d",
    "--live-line": "#1e293b",
    "--live-glow": "rgba(252, 211, 77, 0.15)",
  } as React.CSSProperties;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [liveMode, setLiveMode] = useState(false);
  const [footerLinks, setFooterLinks] = useState<{survey?: string, donation?: string}>({});
  const [activeBreak, setActiveBreak] = useState<{end: string, duration: string} | null>(null);

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
        "min-h-screen transition-colors duration-1000 ease-in-out selection:bg-[var(--accent)]/20 overflow-x-hidden touch-pan-y",
        mincho.className,
        liveMode ? "bg-[var(--live-bg)] text-[var(--live-text)]" : "bg-[var(--bg)] text-[var(--text)]"
      )}
      style={cssVars}
    >
      <style jsx global>{`
        body { overflow-x: hidden; touch-action: pan-y; }
      `}</style>

      <div className={cn(
        "fixed inset-0 pointer-events-none z-50 mix-blend-multiply transition-opacity duration-1000",
        liveMode ? "opacity-0" : "opacity-[0.03]"
      )} style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      <nav className="fixed top-6 right-6 z-50 flex items-center gap-3 mix-blend-difference text-white">
        <button 
          onClick={() => setLiveMode(!liveMode)}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-full backdrop-blur-xl border transition-all duration-500 shadow-2xl",
            liveMode 
              ? "bg-white/10 border-white/20 text-[var(--live-accent)] shadow-[0_0_20px_rgba(252,211,77,0.3)]" 
              : "bg-black/10 border-white/10 text-white/80 hover:bg-black/20"
          )}
        >
          <Music size={14} className={liveMode ? "animate-pulse" : ""} />
          <span className={cn("text-[10px] tracking-widest font-bold uppercase", cinzel.className)}>
            {liveMode ? "Live Mode" : "View"}
          </span>
        </button>
      </nav>

      <AnimatePresence>
        {activeBreak && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             className={cn(
               "fixed bottom-8 right-6 z-40 backdrop-blur-md border p-4 rounded-2xl shadow-2xl flex flex-col items-center gap-1",
               liveMode ? "bg-white/5 border-[var(--live-accent)]/30 text-[var(--live-accent)]" : "bg-white/40 border-[var(--accent)]/30 text-[var(--accent)]"
             )}
           >
              <span className="text-[10px] font-bold tracking-widest flex items-center gap-1"><Coffee size={12}/> 休憩中</span>
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

      <FooterActions links={footerLinks} liveMode={liveMode} />
      <Footer event={event} liveMode={liveMode} />
    </div>
  );
}

// ------------------------------------------------------------------
// COMPONENTS
// ------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F9F8F2] z-[9999]">
      <Loader2 className="animate-spin text-[#B48E55]" size={30} />
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
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-b from-black/20 via-transparent",
          liveMode ? "to-[var(--live-bg)]" : "to-[var(--bg)]"
        )} />
      </motion.div>

      <div className="relative z-10 text-white space-y-6 max-w-3xl pt-20">
        <div className="inline-block border-y border-white/60 py-2 px-6 backdrop-blur-[2px] shadow-sm mb-4">
          <span className={cn("text-xs tracking-[0.3em] uppercase font-bold drop-shadow-md block -mt-0.5", cinzel.className)}>
            Digital Pamphlet
          </span>
        </div>
        
        <h1 className={cn("text-4xl md:text-6xl font-bold leading-tight drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)]", mincho.className)}>
          {event.title}
        </h1>
        
        <div className="flex flex-col items-center gap-2 text-sm font-medium tracking-wider drop-shadow-md">
          {event.date && (
            <div className="flex items-center gap-3">
              <span className="w-6 h-px bg-white/80 box-shadow-sm"></span>
              <span className={cormorant.className}>
                 {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="w-6 h-px bg-white/80 box-shadow-sm"></span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest">
              <MapPin size={12} /> {event.location}
            </div>
          )}
        </div>
      </div>
      
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 flex flex-col items-center gap-2 drop-shadow-md">
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
          <SectionHeader title="Greeting" subtitle="ご挨拶" liveMode={liveMode} />
          {content.image ? (
             <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
               {/* Mobile Layout: Photo + Name side-by-side */}
               <div className="w-full md:w-auto flex items-center gap-5 md:block">
                  <div className={cn(
                    "w-24 h-24 md:w-64 md:h-auto md:aspect-[3/4] shrink-0 relative p-1 bg-white shadow-sm rotate-1 border border-stone-100 rounded-sm overflow-hidden",
                    liveMode ? "bg-white/5 border-white/10" : ""
                  )}>
                      <img src={content.image} className="w-full h-full object-cover filter contrast-[1.05]" alt="Speaker" />
                  </div>
                  <div className="block md:hidden flex-1">
                      <h3 className="text-lg font-bold tracking-widest mb-1">{content.author}</h3>
                      <p className={cn("text-[10px] opacity-60 uppercase tracking-widest", cinzel.className)}>{content.role}</p>
                  </div>
               </div>
               
               <div className="flex-1 space-y-6 md:pt-4">
                 <div className="hidden md:block text-left">
                   <h3 className="text-xl font-bold tracking-widest">{content.author}</h3>
                   <p className={cn("text-xs opacity-60 uppercase tracking-widest mt-1", cinzel.className)}>{content.role}</p>
                 </div>
                 <p className="text-sm md:text-base leading-8 text-justify opacity-90 whitespace-pre-wrap font-serif">
                   {content.text}
                 </p>
               </div>
             </div>
          ) : (
             <div className="max-w-xl mx-auto text-center space-y-8 py-8">
                <p className="text-base md:text-lg leading-9 font-serif whitespace-pre-wrap opacity-90">
                  {content.text}
                </p>
                <div className="pt-4">
                   <div className="text-lg font-bold tracking-widest">{content.author}</div>
                   <div className={cn("text-xs opacity-50 uppercase tracking-widest", cinzel.className)}>{content.role}</div>
                </div>
             </div>
          )}
        </Wrapper>
      );

    case "program":
      return (
        <Wrapper>
          <SectionHeader title="Program" subtitle="プログラム" liveMode={liveMode} />
          <div className="space-y-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
            {(content.people || []).map((p: any, i: number) => (
              <ProfileItem key={i} p={p} liveMode={liveMode} />
            ))}
          </div>
        </Wrapper>
      );

    case "gallery":
      return (
        <Wrapper>
          <div className="relative">
             <div className={cn(
               "absolute -top-10 left-1/2 -translate-x-1/2 text-[15vw] font-bold opacity-[0.03] select-none pointer-events-none whitespace-nowrap",
               cinzel.className
             )}>
               GALLERY
             </div>
             
             <div className="text-center mb-8 relative z-10">
                <h3 className={cn("text-lg font-bold tracking-widest uppercase mb-2", liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}>{content.title || "Memories"}</h3>
                {content.caption && <p className="text-xs opacity-60 font-serif max-w-md mx-auto">{content.caption}</p>}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-2">
                {(content.images || []).map((url: string, i: number) => (
                   <div key={i} className="aspect-square relative overflow-hidden group bg-stone-100">
                      <img src={url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                   </div>
                ))}
             </div>
          </div>
        </Wrapper>
      );

    case "free":
      return (
        <Wrapper>
          <div className="mb-8 pl-4 border-l-2 border-[var(--accent)]/50">
             <h3 className={cn("text-xl font-bold tracking-widest font-serif", liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}>
               {content.title || "Information"}
             </h3>
          </div>
          <div className="max-w-2xl px-4">
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
    <div className="text-center mb-16 relative">
      <div className="flex items-center justify-center gap-4 mb-2">
         <div className={cn("h-px w-8", liveMode ? "bg-[var(--live-line)]" : "bg-[var(--line)]")}></div>
         <h2 className={cn("text-2xl font-normal tracking-widest uppercase", cinzel.className, liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}>
           {title}
         </h2>
         <div className={cn("h-px w-8", liveMode ? "bg-[var(--live-line)]" : "bg-[var(--line)]")}></div>
      </div>
      <span className="text-[10px] tracking-[0.2em] opacity-40 uppercase">{subtitle}</span>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed, liveMode }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  if (isSection) {
    return (
      <div className="pt-10 pb-6 flex items-center justify-center relative z-10">
        <div className={cn("h-px w-full absolute top-1/2 left-0 -z-10", liveMode ? "bg-[var(--live-line)]" : "bg-[var(--line)]")}></div>
        <span className={cn(
          "px-6 text-sm font-bold tracking-[0.2em] uppercase font-serif",
          liveMode ? "bg-[var(--live-bg)] text-[var(--live-accent)]" : "bg-[var(--bg)] text-[var(--accent)]"
        )}>
          {item.title}
        </span>
      </div>
    );
  }

  if (item.type === "memo") {
    return (
      <div className="flex justify-center py-2 opacity-50">
        <span className={cn("text-xs italic tracking-wider", cormorant.className)}>* {item.title}</span>
      </div>
    );
  }

  if (isBreak) {
    return (
      <div className={cn(
        "py-8 flex flex-col items-center justify-center gap-2 transition-all duration-700 border-y border-[var(--line)] my-4",
        active ? "opacity-100 scale-105" : "opacity-60"
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

  return (
    <div className="relative group">
      {active && liveMode && (
         <div className="absolute -inset-4 rounded-xl bg-[var(--live-glow)] blur-xl opacity-50 animate-pulse pointer-events-none"></div>
      )}
      
      <div 
        className={cn(
           "py-4 px-3 md:px-6 cursor-pointer transition-colors duration-500 rounded-sm",
           active 
             ? (liveMode ? "bg-white/5 border-l-2 border-[var(--live-accent)]" : "bg-[var(--accent)]/5 border-l-2 border-[var(--accent)]")
             : "hover:bg-[var(--text)]/5 border-l-2 border-transparent"
        )}
        onClick={() => item.description && setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-4">
             <h3 className={cn(
               "text-base md:text-lg font-bold leading-snug font-serif", 
               active ? (liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]") : ""
             )}>
               {item.title}
             </h3>
             <span className={cn("text-sm opacity-60 italic shrink-0", cormorant.className)}>{item.composer}</span>
        </div>
          
          <div className="flex items-center justify-between mt-1">
             <div className="flex items-center gap-2">
                {active && <span className={cn("text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse", liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]")}><Sparkles size={8}/> Playing</span>}
                {item.performer && (
                   <span className={cn("text-xs opacity-80 font-serif", active ? (liveMode ? "text-[var(--live-accent)]" : "text-[var(--accent)]") : "")}>
                     {item.performer}
                   </span>
                )}
             </div>
             {item.isEncore && <span className={cn("text-[9px] px-1.5 py-0.5 border border-[var(--text)]/20 rounded-full opacity-50", cinzel.className)}>Encore</span>}
          </div>
        </div>

        <div className={cn("grid transition-all duration-300 ease-out overflow-hidden", isOpen ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0")}>
           <div className="overflow-hidden min-h-0">
              <p className="text-sm leading-7 text-justify opacity-70 font-serif border-t border-[var(--line)] pt-2">
                {item.description}
              </p>
           </div>
        </div>
        
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

function ProfileItem({ p, liveMode }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className={cn(
        "relative w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border shadow-sm",
        liveMode ? "border-[var(--live-line)] bg-white/5" : "border-stone-200 bg-stone-100"
      )}>
        {p.image ? (
          <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20"><User size={32}/></div>
        )}
      </div>
      
      <div className="space-y-1.5 w-full">
        <h3 className="text-lg font-bold font-serif">{p.name}</h3>
        <p className={cn("text-[10px] tracking-[0.2em] uppercase opacity-50", cinzel.className)}>{p.role}</p>
        
        <div className="flex justify-center gap-4 pt-1 opacity-60">
           {p.sns?.twitter && <a href={p.sns.twitter} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity"><Twitter size={14}/></a>}
           {p.sns?.instagram && <a href={p.sns.instagram} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity"><Instagram size={14}/></a>}
           {p.sns?.website && <a href={p.sns.website} target="_blank" rel="noopener noreferrer" className="hover:opacity-100 transition-opacity"><Globe size={14}/></a>}
        </div>
      </div>

      <div className="relative w-full">
        <div className={cn("overflow-hidden transition-all duration-500", isOpen ? "max-h-[1000px]" : "max-h-0")}>
           <p className={cn("text-sm leading-7 text-justify opacity-80 font-serif px-2 pt-2 pb-4 rounded-xl", liveMode ? "bg-white/5" : "bg-[var(--text)]/5")}>
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