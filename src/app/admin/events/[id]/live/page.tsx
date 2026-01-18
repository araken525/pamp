"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Loader2,
  Coffee,
  Play,
  MonitorPlay,
  StopCircle,
  ExternalLink,
  ChevronLeft,
  Music
} from "lucide-react";

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
    
    // Optimistic Update
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

    // Find break block
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

    if (!targetBlockId) return alert("休憩項目が見つかりません");

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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-slate-500"/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 safe-top shadow-md h-14 flex items-center justify-between px-4">
         <div className="flex items-center gap-3">
            <Link href={`/admin/events/${id}`} className="text-slate-400 hover:text-white transition-colors">
               <ChevronLeft />
            </Link>
            <h1 className="text-sm font-bold text-white tracking-widest uppercase">Live Cockpit</h1>
         </div>
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${playingItemId ? 'bg-green-500 animate-pulse' : 'bg-slate-600'}`}></div>
            <span className="text-[10px] font-bold text-slate-500">{playingItemId ? "ON AIR" : "STANDBY"}</span>
         </div>
      </header>

      {/* MAIN COCKPIT */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
         
         {/* 1. Encore Switch */}
         <div className="shrink-0 bg-slate-900/50 border-b border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className={`w-3 h-3 rounded-full ${encoreRevealed ? 'bg-pink-500 shadow-[0_0_10px_#ec4899]' : 'bg-slate-700'}`}></div>
               <span className="text-xs font-bold tracking-widest uppercase text-slate-400">Encore Mode</span>
            </div>
            <button onClick={toggleEncore} className={`w-14 h-8 rounded-full border transition-all relative ${encoreRevealed ? 'bg-pink-600 border-pink-500' : 'bg-slate-800 border-slate-700'}`}>
               <div className={`absolute top-1 bottom-1 w-6 bg-white rounded-full transition-all ${encoreRevealed ? 'left-7' : 'left-1'}`}></div>
            </button>
         </div>

         {/* 2. Timeline */}
         <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {blocks.filter(b => b.type === "program").map(block => (
               <div key={block.id}>
                  {block.content.items?.map((item: any, i: number) => {
                     const isActive = playingItemId === `${block.id}-${i}`;
                     const isBreak = item.type === "break";
                     if (item.type === "section") return <div key={i} className="pt-8 pb-2 pl-2 text-xs font-bold text-slate-600 border-b border-slate-800 mb-2 uppercase tracking-widest">{item.title}</div>;
                     if (item.type === "memo") return <div key={i} className="my-2 mx-1 p-2 bg-yellow-900/20 text-yellow-500 border border-yellow-700/30 text-xs rounded">📝 {item.title}</div>;
                     return (
                        <div 
                          key={i} 
                          onClick={() => !isBreak && toggleActiveItem(block.id, i)}
                          className={`p-4 flex items-center gap-4 transition-all rounded-xl cursor-pointer border ${isActive ? 'bg-indigo-900/20 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]' : 'bg-slate-900/40 border-slate-800 opacity-60 hover:opacity-100'}`}
                        >
                           <div className="shrink-0">
                              {isActive ? (
                                 isBreak ? <Coffee className="text-orange-400 animate-pulse"/> : <div className="w-3 h-3 bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8] animate-pulse"></div>
                              ) : (
                                 <div className="w-2 h-2 rounded-full bg-slate-600"></div>
                              )}
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className={`text-base ${isActive ? 'font-bold text-white' : 'font-medium text-slate-400'}`}>{item.title}</div>
                              <div className="text-xs text-slate-500 mt-1">{isBreak ? item.duration : item.composer}</div>
                           </div>
                           {isActive && !isBreak && <span className="text-[10px] font-bold text-indigo-400 border border-indigo-500/50 px-2 py-1 rounded uppercase tracking-wider">Playing</span>}
                           {isBreak && isActive && <span className="text-[10px] font-bold text-orange-400 border border-orange-500/50 px-2 py-1 rounded uppercase tracking-wider">Break</span>}
                        </div>
                     )
                  })}
               </div>
            ))}
            <div className="h-40"/>
         </div>

         {/* 3. Break Controller */}
         <div className="shrink-0 bg-slate-900 border-t border-slate-800 p-5 pb-8 relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            {activeInfo?.item.type === "break" ? (
               <div className="flex items-center gap-6">
                  <div className="flex-1">
                     <div className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1 flex items-center gap-2"><Coffee size={12}/> Intermission</div>
                     <div className="text-5xl font-black text-white tabular-nums font-mono leading-none tracking-tight" style={{textShadow: "0 0 30px rgba(249,115,22,0.4)"}}>
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
                  <button onClick={stopBreak} className="h-16 w-16 rounded-full bg-red-600/20 border border-red-500 text-red-500 flex flex-col items-center justify-center active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                     <StopCircle size={24} />
                     <span className="text-[9px] font-bold mt-1">STOP</span>
                  </button>
               </div>
            ) : (
               <div className="flex items-center gap-4 justify-between">
                  {[10, 15, 20].map(min => (
                     <button key={min} onClick={() => startBreak(min)} className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center hover:bg-slate-700 hover:border-slate-500 hover:text-white transition-all active:scale-90">
                        {min}m
                     </button>
                  ))}
                  <div className="h-10 w-px bg-slate-800"></div>
                  <div className="flex flex-col items-center gap-1">
                     <input type="number" className="w-16 bg-slate-800 border border-slate-700 rounded-lg text-center text-white font-bold text-sm py-1 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600" placeholder="分" value={customBreakTime} onChange={e=>setCustomBreakTime(e.target.value)} />
                     <button onClick={() => startBreak(parseInt(customBreakTime)||15)} className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-full shadow-lg active:scale-95 flex items-center gap-1 hover:bg-indigo-500 transition-colors">
                        <Play size={10} fill="currentColor"/> Start
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}