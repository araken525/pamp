"use client";

import React, { use, useEffect, useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Loader2,
  Coffee,
  Play,
  StopCircle,
  ChevronLeft,
  Music,
  Mic2,
  Clock,
  Radio,
  Activity
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

type Props = { params: Promise<{ id: string }> };

export default function EventLiveCockpit({ params }: Props) {
  const { id } = use(params);

  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [encoreRevealed, setEncoreRevealed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [customBreakTime, setCustomBreakTime] = useState("15");

  // Auto-scroll ref
  const activeItemRef = useRef<HTMLDivElement>(null);

  // --- Timer ---
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Init ---
  useEffect(() => {
    async function load() {
      const { data: e } = await supabase.from("events").select("*").eq("id", id).single();
      if (!e) return;
      setEvent(e);
      setEncoreRevealed(e.encore_revealed ?? false);

      const { data: b } = await supabase.from("blocks").select("*").eq("event_id", id).order("sort_order", { ascending: true });
      setBlocks(b ?? []);
      setLoading(false);

      // Find playing item
      b?.forEach((block: any) => {
         if (block.type === 'program' && block.content.items) {
            block.content.items.forEach((item: any, idx: number) => {
               if (item.active) setPlayingItemId(`${block.id}-${idx}`);
            });
         }
      });
    }
    load();
  }, [id]);

  // Scroll to active item on change
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [playingItemId]);

  // --- Actions ---
  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);
    await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
  }

  async function toggleActiveItem(blockId: string, itemIndex: number) {
    if (!blocks || blocks.length === 0) return;
    const targetBlockIndex = blocks.findIndex((b) => b.id === blockId);
    const targetBlock = blocks[targetBlockIndex];
    if (!targetBlock?.content?.items) return;

    const items = [...targetBlock.content.items];
    const targetId = `${blockId}-${itemIndex}`;
    const isCurrentlyActive = playingItemId === targetId;
    
    setPlayingItemId(isCurrentlyActive ? null : targetId);
    items.forEach((it, idx) => {
        if (idx === itemIndex) it.active = !isCurrentlyActive;
        else it.active = false; 
    });
    const newBlocks = [...blocks];
    newBlocks[targetBlockIndex] = { ...targetBlock, content: { ...targetBlock.content, items } };
    setBlocks(newBlocks);

    await supabase.from("blocks").update({ content: { ...targetBlock.content, items } }).eq("id", blockId);
  }

  async function startBreak(minutes: number) {
    let targetBlockId = null;
    let targetItemIndex = -1;

    for (const b of blocks) {
        if (b.type === "program" && b.content?.items) {
            const idx = b.content.items.findIndex((it:any) => it.type === "break");
            if (idx !== -1) {
                targetBlockId = b.id;
                targetItemIndex = idx;
                break;
            }
        }
    }

    if (!targetBlockId) return alert("休憩項目が見つかりません。編集画面で追加してください。");

    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    const target = blocks[targetIndex];
    const end = new Date(Date.now() + minutes * 60000).toISOString();
    const newItems = [...target.content.items];
    
    newItems.forEach(it => it.active = false);
    newItems[targetItemIndex] = { ...newItems[targetItemIndex], timerEnd: end, duration: `${minutes}分`, active: true };
    
    setPlayingItemId(`${targetBlockId}-${targetItemIndex}`);
    const newBlocks = [...blocks];
    newBlocks[targetIndex] = { ...target, content: { ...target.content, items: newItems } };
    setBlocks(newBlocks);

    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", targetBlockId);
  }

  async function stopBreak() {
    if (!playingItemId) return;
    const [bId, iIdxStr] = playingItemId.split("-");
    const iIdx = parseInt(iIdxStr);
    
    const targetIndex = blocks.findIndex(b => b.id === bId);
    const target = blocks[targetIndex];
    const newItems = [...target.content.items];
    
    if (newItems[iIdx].type !== "break") return;

    newItems[iIdx] = { ...newItems[iIdx], timerEnd: null, active: false };
    setPlayingItemId(null);
    
    const newBlocks = [...blocks];
    newBlocks[targetIndex] = { ...target, content: { ...target.content, items: newItems } };
    setBlocks(newBlocks);

    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", bId);
  }

  const getActiveItemInfo = () => {
      if (!playingItemId) return null;
      const [bId, iIdxStr] = playingItemId.split("-");
      const iIdx = parseInt(iIdxStr);
      const block = blocks.find(b => b.id === bId);
      if (!block || !block.content?.items) return null;
      const item = block.content.items[iIdx];
      if (!item) return null;
      return { block, item, index: iIdx };
  };
  const activeInfo = getActiveItemInfo();

  if (loading) return <div className="min-h-screen bg-[#F9F8F2] flex items-center justify-center"><Loader2 className="animate-spin text-[#B48E55]"/></div>;

  return (
    <div className={cn(
      "min-h-dvh bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 font-sans flex flex-col",
      mincho.className
    )}>
      {/* Paper Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#F9F8F2]/90 backdrop-blur-xl border-b border-[#2C2C2C]/5 h-16 flex items-center justify-between px-4 shadow-sm">
         <Link href={`/admin/events/${id}`} className="flex items-center gap-2 text-[#2C2C2C]/60 hover:text-[#2C2C2C] transition-colors p-2 -ml-2">
            <ChevronLeft size={20}/>
            <span className={cn("text-xs font-bold tracking-widest", cinzel.className)}>BACK</span>
         </Link>
         
         <div className="flex items-center gap-2 bg-[#F9F8F2] py-1.5 px-4 rounded-full border border-[#2C2C2C]/5 shadow-sm">
            {playingItemId ? (
               <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className={cn("text-[10px] font-bold text-emerald-600 tracking-widest", cinzel.className)}>ON AIR</span>
               </>
            ) : (
               <>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#2C2C2C]/20"></div>
                  <span className={cn("text-[10px] font-bold text-[#2C2C2C]/40 tracking-widest", cinzel.className)}>STANDBY</span>
               </>
            )}
         </div>
      </header>

      {/* SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-48 relative z-10">
         
         {/* 1. Global Controls (Encore) */}
         <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-[#2C2C2C]/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className={cn("p-2 rounded-full border", encoreRevealed ? 'bg-[#F9F8F2] text-[#B48E55] border-[#B48E55]/20' : 'bg-[#F9F8F2] text-[#2C2C2C]/20 border-transparent')}>
                  <Mic2 size={18}/>
               </div>
               <div>
                  <div className="text-sm font-bold text-[#2C2C2C] font-serif">アンコール表示</div>
                  <div className="text-[10px] text-[#2C2C2C]/40 font-sans tracking-wider">VISIBILITY CONTROL</div>
               </div>
            </div>
            <button onClick={toggleEncore} className={`w-12 h-7 rounded-full transition-all duration-300 relative border ${encoreRevealed ? 'bg-[#B48E55] border-[#B48E55]' : 'bg-[#2C2C2C]/10 border-transparent'}`}>
               <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${encoreRevealed ? 'left-[1.35rem]' : 'left-0.5'}`}></div>
            </button>
         </div>

         {/* 2. Timeline */}
         <div className="space-y-3">
            <div className="flex items-center gap-2 px-2 mb-2">
               <Radio size={14} className="text-[#B48E55]"/>
               <h2 className={cn("text-xs font-bold text-[#2C2C2C]/40 uppercase tracking-widest", cinzel.className)}>RUNNING ORDER</h2>
            </div>
            
            {blocks.filter(b => b.type === "program").map(block => (
               <div key={block.id}>
                  {block.content.items?.map((item: any, i: number) => {
                     const isActive = playingItemId === `${block.id}-${i}`;
                     const isBreak = item.type === "break";
                     
                     if (item.type === "section") return (
                        <div key={i} className="mt-8 mb-4 flex items-center gap-4 opacity-50">
                           <div className="h-px bg-[#2C2C2C]/20 flex-1"></div>
                           <span className="text-xs font-bold font-serif text-[#2C2C2C]">{item.title}</span>
                           <div className="h-px bg-[#2C2C2C]/20 flex-1"></div>
                        </div>
                     );
                     
                     if (item.type === "memo") return (
                        <div key={i} className="my-2 p-3 bg-yellow-50/50 text-[#B48E55] text-xs font-medium rounded-xl border border-yellow-200/30 flex items-center gap-2">
                           <span className="font-serif">📝 {item.title}</span>
                        </div>
                     );
                     
                     return (
                        <div 
                          key={i}
                          ref={isActive ? activeItemRef : null}
                          onClick={() => !isBreak && toggleActiveItem(block.id, i)}
                          className={cn(
                             "relative p-4 flex items-center gap-4 rounded-2xl transition-all duration-300 border cursor-pointer",
                             isActive 
                               ? (isBreak ? 'bg-orange-50 border-orange-200 shadow-lg scale-[1.02] z-10' : 'bg-white border-[#B48E55]/50 shadow-[0_10px_30px_-10px_rgba(180,142,85,0.2)] scale-[1.02] z-10 ring-1 ring-[#B48E55]/20') 
                               : 'bg-white/40 border-transparent hover:bg-white hover:border-[#2C2C2C]/5 hover:shadow-sm'
                          )}
                        >
                           <div className="shrink-0">
                              {isActive ? (
                                 isBreak ? <Coffee className="text-orange-500 animate-bounce" size={20}/> : <div className="flex items-center justify-center w-8 h-8 bg-[#B48E55]/10 text-[#B48E55] rounded-full"><Activity size={16} className="animate-pulse"/></div>
                              ) : (
                                 <div className={cn("w-8 h-8 rounded-full border border-[#2C2C2C]/10 flex items-center justify-center font-bold text-[10px]", cormorant.className)}>{i+1}</div>
                              )}
                           </div>
                           
                           <div className="flex-1 min-w-0">
                              <div className={cn("text-base leading-tight mb-1 font-serif", isActive ? 'font-bold text-[#2C2C2C]' : 'font-medium text-[#2C2C2C]/80')}>
                                 {item.title}
                              </div>
                              <div className={cn("text-xs flex items-center gap-2", cormorant.className, isActive ? "text-[#B48E55]" : "text-[#2C2C2C]/40")}>
                                 {isBreak ? (
                                    <span className="flex items-center gap-1"><Clock size={10}/> {item.duration}</span>
                                 ) : (
                                    <span>{item.composer}</span>
                                 )}
                              </div>
                           </div>

                           {isActive && !isBreak && (
                              <div className="shrink-0 bg-[#2C2C2C] text-[#F9F8F2] text-[10px] font-bold px-3 py-1 rounded-full shadow-sm animate-pulse tracking-widest font-sans">NOW</div>
                           )}
                           {isActive && isBreak && (
                              <div className="shrink-0 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm animate-pulse tracking-widest font-sans">BREAK</div>
                           )}
                        </div>
                     )
                  })}
               </div>
            ))}
         </div>
      </div>

      {/* 3. BREAK CONTROL FOOTER (Fixed) */}
      <div className="fixed bottom-0 inset-x-0 bg-[#F9F8F2]/95 backdrop-blur-md border-t border-[#2C2C2C]/5 p-4 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
         {activeInfo?.item.type === "break" ? (
            // ACTIVE BREAK MODE
            <div className="flex items-center justify-between gap-4 max-w-xl mx-auto">
               <div className="flex-1 bg-orange-50 rounded-[1.5rem] p-4 border border-orange-100 flex items-center gap-5 shadow-inner">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm shrink-0 border border-orange-50">
                     <Coffee size={24} className="animate-bounce"/>
                  </div>
                  <div>
                     <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mb-0.5 font-sans">INTERMISSION</div>
                     <div className={cn("text-4xl font-bold text-[#2C2C2C] tabular-nums leading-none tracking-tight", cormorant.className)}>
                        {(() => {
                           if (!activeInfo.item.timerEnd) return "--:--";
                           const diff = new Date(activeInfo.item.timerEnd).getTime() - now;
                           if (diff <= 0) return "00:00";
                           const m = Math.floor(diff / 60000);
                           const s = Math.floor((diff % 60000) / 1000);
                           return `${m}:${s.toString().padStart(2, '0')}`;
                        })()}
                     </div>
                  </div>
               </div>
               <button onClick={stopBreak} className="h-20 w-24 rounded-[1.5rem] bg-red-500 text-white flex flex-col items-center justify-center gap-1 shadow-xl active:scale-95 transition-transform hover:bg-red-600 border border-red-400">
                  <StopCircle size={28} />
                  <span className="text-[10px] font-bold tracking-widest">STOP</span>
               </button>
            </div>
         ) : (
            // IDLE MODE
            <div className="flex flex-col gap-3 max-w-xl mx-auto">
               <div className="flex items-center justify-between text-[10px] font-bold text-[#2C2C2C]/30 uppercase tracking-widest px-2 font-sans">
                  <span>Break Timer</span>
                  <span>Manual</span>
               </div>
               <div className="flex items-stretch gap-3 h-14">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                     {[10, 15, 20].map(min => (
                        <button key={min} onClick={() => startBreak(min)} className={cn("bg-white border border-[#2C2C2C]/5 text-[#2C2C2C] rounded-2xl font-bold text-xl hover:bg-[#F9F8F2] hover:border-[#B48E55]/30 active:scale-95 transition-all shadow-sm", cormorant.className)}>
                           {min}<span className="text-xs ml-0.5 opacity-40 font-sans">m</span>
                        </button>
                     ))}
                  </div>
                  <div className="w-px bg-[#2C2C2C]/10 my-2"></div>
                  <div className="flex items-center gap-2 bg-white border border-[#2C2C2C]/5 rounded-2xl px-2 pl-3 shadow-sm">
                     <input 
                        type="number" 
                        className={cn("w-10 bg-transparent text-center font-bold text-xl text-[#2C2C2C] outline-none placeholder:text-[#2C2C2C]/10", cormorant.className)}
                        placeholder="15" 
                        value={customBreakTime} 
                        onChange={e=>setCustomBreakTime(e.target.value)} 
                     />
                     <button onClick={() => startBreak(parseInt(customBreakTime)||15)} className="w-10 h-10 bg-[#2C2C2C] text-[#F9F8F2] rounded-xl flex items-center justify-center shadow-md active:scale-90 transition-transform hover:bg-[#404040]">
                        <Play size={14} fill="currentColor"/>
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}