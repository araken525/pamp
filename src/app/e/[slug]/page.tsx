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

// --- Theme Config (Pure Paper Style) ---
function getThemeColors(palette: any) {
  const accent = palette?.accent ?? "#8B7E66"; // Desaturated Gold/Brown for elegance
  return {
    "--bg": "#F9F8F2", // Warm Cream Paper
    "--text": "#2C2C2C", // Soft Ink Black
    "--accent": accent,
    "--muted": "#9ca3af",
    "--line": "#E0DED5", // Subtle paper crease line
  } as React.CSSProperties;
}

type Props = { params: Promise<{ slug: string }> };

export default function EventViewer({ params }: Props) {
  const { slug } = use(params);
  
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [footerLinks, setFooterLinks] = useState<{survey?: string, donation?: string}>({});
  const [activeBreak, setActiveBreak] = useState<{end: string, duration: string} | null>(null);

  useEffect(() => {
    let channel: any;
    async function init() {
      setLoading(true);
      const { data: e, error } = await supabase.from("events").select("*").eq("slug", slug).single();
      if (error || !e) { setLoading(false); return; }
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
        "min-h-screen bg-[var(--bg)] text-[var(--text)] selection:bg-[var(--accent)]/20 overflow-x-hidden touch-pan-y",
        mincho.className
      )}
      style={cssVars}
    >
      <style jsx global>{`
        body { overflow-x: hidden; touch-action: pan-y; }
      `}</style>

      {/* Real Paper Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] mix-blend-multiply opacity-40" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* Break Timer Float */}
      <AnimatePresence>
        {activeBreak && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             transition={{ type: "spring", stiffness: 200, damping: 20 }}
             className="fixed bottom-8 right-6 z-50 backdrop-blur-lg border border-[var(--accent)]/30 p-5 rounded-2xl shadow-xl flex flex-col items-center gap-1 bg-[#F9F8F2]/90 text-[var(--text)]"
           >
              <span className="text-[10px] font-bold tracking-widest flex items-center gap-1.5 animate-pulse text-[var(--accent)]">
                <Coffee size={12}/> 休憩中
              </span>
              <Countdown target={activeBreak.end} />
           </motion.div>
        )}
      </AnimatePresence>

      <Hero event={event} />
      
      <main className="max-w-3xl mx-auto px-6 pb-32 space-y-32 relative z-10">
        {blocks.map((block, i) => (
          <BlockRenderer 
            key={block.id} 
            block={block} 
            index={i} 
            encoreRevealed={event.encore_revealed} 
          />
        ))}
      </main>

      <div className="relative z-10">
        <FooterActions links={footerLinks} />
        <Footer event={event} />
      </div>
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
        <Loader2 className="animate-spin text-[#B48E55]" size={32} />
        <span className={cn("text-[10px] tracking-[0.4em] uppercase text-[#B48E55] animate-pulse", cinzel.className)}>Loading</span>
      </div>
    </div>
  );
}

// === 1. HERO: The "Fit-Text" Title ===
function Hero({ event }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <motion.header 
      ref={ref}
      className="relative h-[95vh] w-full overflow-hidden flex flex-col justify-end items-center text-center px-4 pb-20 mb-24"
    >
      {/* Background Image */}
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover brightness-90" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-300" />
        )}
        
        {/* Natural Blend: Transparent -> Paper Color */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/70 to-transparent" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto text-[var(--text)]">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-col items-center space-y-4 w-full"
        >
          {/* Label */}
          <div className="flex flex-col items-center gap-3 opacity-60 mb-2">
             <span className={cn("text-[10px] tracking-[0.4em] uppercase font-bold", cinzel.className)}>
               Digital Pamphlet
             </span>
             <div className="h-px w-8 bg-current"></div>
          </div>

          {/* Title: 1-Line Fit Logic using Container Queries */}
          <div className="w-full" style={{ containerType: 'inline-size' }}>
             <h1 className={cn(
               "font-bold leading-none tracking-tight text-slate-900 drop-shadow-sm whitespace-nowrap text-center", 
               mincho.className
             )} style={{ fontSize: '11cqi' }}>
               {event.title}
             </h1>
          </div>

          {/* Info Block */}
          <div className="flex flex-col items-center gap-6 pt-8 border-t border-black/10 w-full max-w-lg mt-6">
             <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                {event.date && (
                    <div className={cn("text-base sm:text-lg tracking-widest flex items-center gap-2 border-b border-transparent pb-1", cormorant.className)}>
                       <Calendar size={14} className="text-[var(--accent)]"/>
                       {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                       <span className="opacity-40 mx-1">|</span>
                       {new Date(event.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
                {event.location && (
                    <div className="text-sm sm:text-base font-serif flex items-center gap-2 tracking-widest uppercase opacity-80 border-b border-transparent pb-1">
                       <MapPin size={14} className="text-[var(--accent)]"/> <span>{event.location}</span>
                    </div>
                )}
             </div>
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}

function BlockRenderer({ block, index, encoreRevealed }: any) {
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
    // === 2. GREETING: Refreshed "Letter" Layout ===
    case "greeting":
      return (
        <Wrapper>
          <SectionHeader title="Greeting" subtitle="ご挨拶" />
          <div className="max-w-2xl mx-auto bg-white/40 p-8 rounded-sm shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-[var(--line)]">
             {/* Header Area */}
             <div className="flex flex-col items-center text-center mb-8">
               {content.image && (
                 <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-[var(--bg)] shadow-md mb-4 sepia-[0.2]">
                    <img src={content.image} className="w-full h-full object-cover" alt="Author" />
                 </div>
               )}
               <h3 className="text-xl font-bold font-serif tracking-widest text-[var(--text)]">{content.author}</h3>
               <p className={cn("text-[10px] opacity-60 uppercase tracking-widest mt-1", cinzel.className)}>{content.role}</p>
               <div className="w-8 h-px bg-[var(--accent)] mt-4 opacity-50"></div>
             </div>
             
             {/* Body */}
             <div className="prose prose-stone prose-p:font-serif prose-p:text-[var(--text)] prose-p:opacity-90 prose-p:leading-loose text-justify">
                <p className="whitespace-pre-wrap">{content.text}</p>
             </div>
          </div>
        </Wrapper>
      );

    // === 3. PROGRAM: Center Focus & "Playing" Refreshed ===
    case "program":
      return (
        <Wrapper>
          <SectionHeader title="Program" subtitle="プログラム" />
          <div className="relative space-y-16">
            {/* Center Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--line)] -translate-x-1/2 opacity-50 hidden md:block"></div>
            
            {(content.items || []).map((item: any, i: number) => (
              <ProgramItem key={i} item={item} index={i} encoreRevealed={encoreRevealed} />
            ))}
          </div>
        </Wrapper>
      );

    // === 5. ARTIST: Refreshed Elegant Style ===
    case "profile":
      return (
        <Wrapper>
          <SectionHeader title="Artists" subtitle="出演者" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
            {(content.people || []).map((p: any, i: number) => (
              <ProfileItem key={i} p={p} />
            ))}
          </div>
        </Wrapper>
      );

    // === 4. GALLERY: Mincho & Elegant Grid ===
    case "gallery":
      return (
        <Wrapper>
          <div className="py-10 border-t border-b border-[var(--line)]/50">
             <div className="text-center mb-10">
                <h3 className={cn("text-2xl font-bold tracking-[0.2em] font-serif text-[var(--text)]")}>{content.title || "追憶"}</h3>
                <p className={cn("text-[10px] opacity-50 tracking-widest mt-2 uppercase", cinzel.className)}>Gallery</p>
                {content.caption && <p className="text-sm font-serif mt-4 opacity-70 max-w-md mx-auto">{content.caption}</p>}
             </div>

             <div className="grid grid-cols-2 md:grid-cols-3 gap-6 px-2">
                {(content.images || []).map((url: string, i: number) => (
                   <div key={i} className={cn(
                     "relative aspect-[3/4] overflow-hidden shadow-sm bg-white p-2",
                     i % 2 === 0 ? "rotate-1" : "-rotate-1" // Slight organic tilt
                   )}>
                      <div className="w-full h-full overflow-hidden grayscale-[0.1] hover:grayscale-0 transition-all duration-700">
                        <img src={url} className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000" alt="" />
                      </div>
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
             <h3 className={cn("text-xl font-bold tracking-widest font-serif", "text-[var(--accent)]")}>
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

function SectionHeader({ title, subtitle }: any) {
  return (
    <div className="text-center mb-24">
      <h2 className={cn("text-3xl font-normal tracking-[0.2em] uppercase mb-2 text-[var(--accent)]", cinzel.className)}>
        {title}
      </h2>
      <span className="text-xs tracking-[0.1em] font-serif opacity-60 block border-b border-[var(--accent)]/30 w-12 mx-auto pb-2">{subtitle}</span>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  // --- Section Divider ---
  if (isSection) {
    return (
      <div className="relative py-10 flex justify-center">
        <div className="absolute inset-x-0 top-1/2 h-px bg-[var(--line)] -z-10 opacity-60"></div>
        <div className="bg-[var(--bg)] px-6 py-1 border border-[var(--line)] rounded-full">
          <span className="text-sm font-bold tracking-[0.2em] font-serif text-[var(--text)]">
            {item.title}
          </span>
        </div>
      </div>
    );
  }

  // --- Memo ---
  if (item.type === "memo") {
    return (
      <div className="text-center py-2 opacity-50">
        <span className={cn("text-xs italic tracking-wider", cormorant.className)}>* {item.title}</span>
      </div>
    );
  }

  // --- Break ---
  if (isBreak) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center py-8 gap-3 transition-opacity duration-500",
        active ? "opacity-100" : "opacity-60"
      )}>
        <div className="h-8 w-px bg-[var(--line)] mb-2"></div>
        <span className="text-sm font-bold tracking-[0.3em] font-serif border-y border-[var(--text)]/20 py-2 px-8">休 憩</span>
        {active && item.timerEnd ? (
           <span className="text-xs font-serif animate-pulse text-[var(--accent)]">（只今 休憩中）</span>
        ) : (
           <span className={cn("text-xs italic opacity-60", cormorant.className)}>{item.duration}</span>
        )}
        <div className="h-8 w-px bg-[var(--line)] mt-2"></div>
      </div>
    );
  }

  // --- Song Item (Center Focus) ---
  return (
    <div className="relative group">
      <div 
        className="cursor-pointer px-4 text-center"
        onClick={() => item.description && setIsOpen(!isOpen)}
      >
        {/* Playing Indicator: Japanese Vertical Style */}
        {active && (
          <div className="absolute top-0 right-2 md:right-1/4 animate-pulse flex flex-col items-center">
             <div className="writing-vertical-rl text-[10px] font-bold tracking-widest text-[var(--accent)] border border-[var(--accent)]/30 px-1 py-2 rounded-sm bg-white/50">
               演奏中
             </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
           {/* Title: Big Center */}
           <h3 className={cn(
             "text-2xl md:text-3xl font-bold font-serif leading-tight transition-colors duration-500 text-slate-800", 
             active ? "text-[var(--accent)] scale-105" : ""
           )}>
             {item.title}
           </h3>
           
           <div className="w-full max-w-lg flex flex-col md:flex-row items-center justify-center md:justify-between gap-2 md:gap-8 opacity-80">
              {/* Composer (Below Title) */}
              <div className={cn("text-sm opacity-70 italic order-2 md:order-1", cormorant.className)}>
                {item.composer}
              </div>
              
              {/* Performer (Right, Mincho, Decorated) */}
              {item.performer && (
                 <div className="text-sm font-serif font-medium flex items-center gap-2 order-1 md:order-2">
                    <span className="opacity-30">—</span> {item.performer}
                 </div>
              )}
           </div>
           
           {item.isEncore && (
             <span className={cn("text-[9px] opacity-40 uppercase tracking-widest border border-current px-2 py-0.5 rounded-full mt-2", cinzel.className)}>Encore</span>
           )}
        </div>

        {/* Description Accordion */}
        <div className={cn("grid transition-all duration-500 ease-out overflow-hidden", isOpen ? "grid-rows-[1fr] opacity-100 mt-6" : "grid-rows-[0fr] opacity-0")}>
           <div className="overflow-hidden min-h-0 px-6 py-6 bg-[#F2F0E9] rounded-sm max-w-xl mx-auto shadow-inner">
              <p className="text-sm leading-8 text-justify opacity-80 font-serif">
                {item.description}
              </p>
           </div>
        </div>
        
        {item.description && (
           <div className="flex justify-center mt-4 opacity-10 group-hover:opacity-40 transition-opacity">
              <ChevronDown size={14} className={cn("transition-transform duration-300", isOpen ? "rotate-180" : "")} />
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
  return <div className="text-2xl font-mono font-bold tracking-widest text-slate-800">{left}</div>;
}

function ProfileItem({ p }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5 text-center group">
      {/* Portrait Style (No Border, Soft) */}
      <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-lg grayscale-[0.3] group-hover:grayscale-0 transition-all duration-700">
        {p.image ? (
          <img src={p.image} className="w-full h-full object-cover" alt={p.name} />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-200 opacity-20"><User size={32}/></div>
        )}
      </div>
      
      <div className="space-y-2">
        <h3 className="text-xl font-bold font-serif tracking-widest">{p.name}</h3>
        <p className={cn("text-[10px] tracking-[0.2em] uppercase opacity-50", cinzel.className)}>{p.role}</p>
        
        <div className="flex justify-center gap-4 pt-1 opacity-40 group-hover:opacity-80 transition-opacity">
           {p.sns?.twitter && <a href={p.sns.twitter} target="_blank" rel="noopener noreferrer"><Twitter size={14}/></a>}
           {p.sns?.instagram && <a href={p.sns.instagram} target="_blank" rel="noopener noreferrer"><Instagram size={14}/></a>}
           {p.sns?.website && <a href={p.sns.website} target="_blank" rel="noopener noreferrer"><Globe size={14}/></a>}
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div className={cn("overflow-hidden transition-all duration-500", isOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
           <p className="text-sm leading-7 text-justify opacity-80 font-serif pt-4 pb-2 border-t border-[var(--line)] mt-4">
             {p.bio}
           </p>
        </div>
        {p.bio && (
          <button onClick={() => setIsOpen(!isOpen)} className="text-[9px] uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center justify-center gap-1 mt-4 mx-auto w-full">
             {isOpen ? "Close Profile" : "View Profile"} <ChevronDown size={10} className={isOpen ? "rotate-180" : ""}/>
          </button>
        )}
      </div>
    </div>
  );
}

function FooterActions({ links }: { links: { survey?: string, donation?: string } }) {
  if (!links.survey && !links.donation) return null;
  return (
    <div className="max-w-md mx-auto px-6 mb-20 space-y-4">
      {links.survey && (
        <a href={links.survey} target="_blank" rel="noopener noreferrer" className={cn(
          "flex items-center justify-center gap-3 w-full py-4 rounded-sm transition-opacity hover:opacity-90 shadow-sm",
          "bg-[#2C2C2C] text-[#F9F8F2]"
        )}>
           <MessageCircle size={18} />
           <span className="text-xs font-bold tracking-widest uppercase">アンケートに回答する</span>
        </a>
      )}
      {links.donation && (
        <a href={links.donation} target="_blank" rel="noopener noreferrer" className={cn(
          "flex items-center justify-center gap-3 w-full py-4 border border-[#8B7E66] rounded-sm transition-colors",
          "text-[#8B7E66] hover:bg-[#8B7E66]/5"
        )}>
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