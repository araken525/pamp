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

// --- Theme Config ---
function getThemeColors(palette: any) {
  const accent = palette?.accent ?? "#B48E55"; // Classic Antique Gold
  return {
    "--bg": "#F9F8F2", 
    "--text": "#2A2A2A", 
    "--accent": accent,
    "--muted": "#888888",
    "--line": "#E5E5E5",
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

      // --- Realtime Connection ---
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

      {/* Paper Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* Break Timer Float */}
      <AnimatePresence>
        {activeBreak && (
           <motion.div 
             initial={{ y: 100, opacity: 0 }}
             animate={{ y: 0, opacity: 1 }}
             exit={{ y: 100, opacity: 0 }}
             transition={{ type: "spring", stiffness: 200, damping: 20 }}
             className="fixed bottom-8 right-6 z-50 backdrop-blur-lg border border-[var(--accent)]/30 p-5 rounded-[1.5rem] shadow-2xl flex flex-col items-center gap-1.5 bg-white/80 text-[var(--accent)]"
           >
              <span className="text-[9px] font-bold tracking-widest flex items-center gap-1.5 animate-pulse">
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

// === 1. HERO: Smart Title Sizing Update ===
function Hero({ event }: any) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  // ★ タイトルの長さ判定ロジック
  const titleLen = event.title?.length || 0;
  let fontSize = '11cqi'; // デフォルト（特大）
  if (titleLen > 10) fontSize = '8cqi'; // 少し小さく
  if (titleLen > 20) fontSize = '5cqi'; // 長い場合はさらに小さく

  return (
    <motion.header 
      ref={ref}
      className="relative h-[95vh] w-full overflow-hidden flex flex-col justify-end items-center text-center px-6 pb-24 mb-24"
    >
      <motion.div style={{ y, opacity }} className="absolute inset-0 z-0">
        {event.cover_image ? (
          <img src={event.cover_image} className="w-full h-full object-cover" alt="cover" />
        ) : (
          <div className="w-full h-full bg-stone-200" />
        )}
        {/* White Fog Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg)]/60 to-[var(--bg)]" />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl w-full mx-auto text-[var(--text)]">
        <motion.div 
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="flex flex-col items-center space-y-10"
        >
          {/* Label */}
          <div className="flex flex-col items-center gap-3 opacity-60">
             <span className={cn("text-xs tracking-[0.3em] uppercase font-bold", cinzel.className)}>
               Digital Pamphlet
             </span>
             <div className="h-px w-8 bg-current"></div>
          </div>

          {/* Title: Smart Sizing & Balance */}
          <div className="w-full" style={{ containerType: 'inline-size' }}>
             <h1 className={cn(
               "font-bold leading-none tracking-tight text-slate-900 drop-shadow-sm text-center mx-auto", 
               mincho.className
             )} style={{ 
               fontSize: fontSize, 
               textWrap: 'balance',     // バランスの良い位置で改行
               lineHeight: 1.2,         // 複数行になった時の行間
               wordBreak: 'keep-all',   // 単語の途中での改行を防ぐ
               maxWidth: '100%'
             }}>
               {event.title}
             </h1>
          </div>

          {/* Info Block */}
          <div className="flex flex-col items-center gap-6 pt-6 border-t border-black/10 w-full max-w-lg">
             <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                {event.date && (
                    <div className={cn("text-lg tracking-wide flex items-center gap-2", cormorant.className)}>
                       <Calendar size={16} className="text-[var(--accent)]"/>
                       {new Date(event.date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                       <span className="opacity-50 mx-1">/</span>
                       {new Date(event.date).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                )}
                {event.location && (
                    <div className="text-base font-serif flex items-center gap-2 tracking-wider uppercase opacity-80">
                       <MapPin size={16} className="text-[var(--accent)]"/> <span>{event.location}</span>
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
    case "greeting":
      return (
        <Wrapper>
          <SectionHeader title="Greeting" subtitle="ご挨拶" />
          <div className="max-w-2xl mx-auto bg-white/40 p-8 rounded-sm shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-[var(--line)]">
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
             
             <div className="prose prose-stone prose-p:font-serif prose-p:text-[var(--text)] prose-p:opacity-90 prose-p:leading-loose text-justify">
                <p className="whitespace-pre-wrap">{content.text}</p>
             </div>
          </div>
        </Wrapper>
      );

    case "program":
      return (
        <Wrapper>
          <SectionHeader title="Program" subtitle="プログラム" />
          <div className="relative pl-6 md:pl-8 border-l border-[var(--line)] space-y-12">
            {(content.items || []).map((item: any, i: number) => (
              <ProgramItem key={i} item={item} index={i} encoreRevealed={encoreRevealed} />
            ))}
          </div>
        </Wrapper>
      );

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

    case "gallery":
      return (
        <Wrapper>
          <div className="relative py-12">
             {/* Watermark Background */}
             <div className={cn(
               "absolute top-0 left-1/2 -translate-x-1/2 text-[15vw] font-bold opacity-[0.03] select-none pointer-events-none whitespace-nowrap z-0",
               cinzel.className
             )}>
               GALLERY
             </div>
             
             {/* Header */}
             <div className="text-center mb-10 relative z-10">
                <h3 className={cn("text-lg font-bold tracking-widest uppercase mb-2 text-[var(--accent)]")}>{content.title || "Memories"}</h3>
                {content.caption && <p className="text-xs opacity-60 font-serif max-w-md mx-auto leading-relaxed">{content.caption}</p>}
             </div>

             {/* Grid Layout */}
             <div className="grid grid-cols-2 md:grid-cols-3 gap-2 relative z-10">
                {(content.images || []).map((url: string, i: number) => (
                   <div key={i} className="aspect-square relative overflow-hidden group bg-stone-100 shadow-sm">
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
    <div className="text-center mb-20">
      <h2 className={cn("text-3xl font-normal tracking-[0.2em] uppercase mb-2 text-[var(--accent)]", cinzel.className)}>
        {title}
      </h2>
      <span className="text-[10px] tracking-[0.3em] opacity-40 uppercase block">{subtitle}</span>
    </div>
  );
}

function ProgramItem({ item, index, encoreRevealed }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const isBreak = item.type === "break";
  const isSection = item.type === "section";
  const active = item.active === true;

  if (item.isEncore && !encoreRevealed) return null;

  if (isSection) {
    return (
      <div className="relative -ml-6 md:-ml-8 pt-8 pb-4">
        <div className="absolute left-0 top-1/2 w-4 md:w-6 h-px bg-[var(--line)]"></div>
        <span className={cn(
          "ml-8 md:ml-10 text-sm font-bold tracking-[0.2em] uppercase font-serif block text-[var(--accent)]"
        )}>
          {item.title}
        </span>
      </div>
    );
  }

  if (item.type === "memo") {
    return (
      <div className="pl-4 py-2 opacity-50">
        <span className={cn("text-xs italic tracking-wider", cormorant.className)}>* {item.title}</span>
      </div>
    );
  }

  if (isBreak) {
    return (
      <div className={cn(
        "relative pl-6 py-6 transition-all duration-500",
        active ? "opacity-100" : "opacity-50"
      )}>
        <div className={cn(
           "absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 bg-[var(--bg)] z-10",
           active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--line)]"
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

  // --- Song Item (Vertical Line Style) ---
  return (
    <div className="relative group pl-4">
      {/* Timeline Node */}
      <div className={cn(
         "absolute -left-[5px] top-6 w-2.5 h-2.5 rounded-full border-2 transition-all duration-500 z-10 bg-[var(--bg)]",
         active ? "border-[var(--accent)] bg-[var(--accent)] scale-125" : "border-[var(--line)]"
      )}></div>

      <div 
        className="cursor-pointer"
        onClick={() => item.description && setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-1">
           {/* Active Indicator: "演奏中" */}
           {active && (
              <span className="text-[10px] font-bold tracking-widest flex items-center gap-1.5 mb-1 animate-pulse text-[var(--accent)]">
                <Sparkles size={10}/> 演奏中
              </span>
           )}

           {/* Row 1: Title & Composer */}
           <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1 md:gap-8">
              <h3 className={cn(
                "text-xl md:text-2xl font-bold leading-snug font-serif transition-colors duration-500", 
                active ? "text-[var(--accent)]" : "text-[var(--text)]"
              )}>
                {item.title}
              </h3>
              <span className={cn("text-sm opacity-60 italic shrink-0", cormorant.className)}>{item.composer}</span>
           </div>
           
           {/* Row 2: Performer */}
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

function ProfileItem({ p }: any) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-col items-center gap-5 text-center group">
      {/* Portrait Style */}
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