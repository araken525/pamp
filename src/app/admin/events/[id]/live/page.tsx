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
  Radio
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

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-slate-400"/></div>;

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800 font-sans flex flex-col">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 h-16 flex items-center justify-between px-4 shadow-sm">
         <Link href={`/admin/events/${id}`} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors p-2 -ml-2">
            <ChevronLeft size={20}/>
            <span className="text-xs font-bold">戻る</span>
         </Link>
         
         <div className="flex items-center gap-2 bg-slate-100 py-1.5 px-4 rounded-full border border-slate-200">
            {playingItemId ? (
               <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                  <span className="text-[10px] font-black text-green-600 tracking-wider">公開中</span>
               </>
            ) : (
               <>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400"></div>
                  <span className="text-[10px] font-black text-slate-500 tracking-wider">待機中</span>
               </>
            )}
         </div>
      </header>

      {/* SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-44">
         
         {/* 1. Global Controls (Encore) */}
         <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className={`p-2 rounded-full ${encoreRevealed ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-400'}`}>
                  <Mic2 size={18}/>
               </div>
               <div>
                  <div className="text-sm font-bold text-slate-800">アンコール表示</div>
                  <div className="text-[10px] text-slate-400">客席への公開設定</div>
               </div>
            </div>
            <button onClick={toggleEncore} className={`w-12 h-7 rounded-full transition-all relative ${encoreRevealed ? 'bg-pink-500' : 'bg-slate-200'}`}>
               <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${encoreRevealed ? 'left-6' : 'left-1'}`}></div>
            </button>
         </div>

         {/* 2. Timeline */}
         <div className="space-y-3">
            <div className="flex items-center gap-2 px-2">
               <Radio size={14} className="text-slate-400"/>
               <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">進行リスト</h2>
            </div>
            
            {blocks.filter(b => b.type === "program").map(block => (
               <div key={block.id}>
                  {block.content.items?.map((item: any, i: number) => {
                     const isActive = playingItemId === `${block.id}-${i}`;
                     const isBreak = item.type === "break";
                     if (item.type === "section") return <div key={i} className="mt-6 mb-2 px-2 text-xs font-bold text-slate-400 border-b-2 border-slate-200 pb-1">{item.title}</div>;
                     if (item.type === "memo") return <div key={i} className="my-2 p-3 bg-yellow-50 text-yellow-700 text-xs font-medium rounded-xl border border-yellow-200/50 flex items-center gap-2">📝 {item.title}</div>;
                     
                     return (
                        <div 
                          key={i}
                          ref={isActive ? activeItemRef : null}
                          onClick={() => !isBreak && toggleActiveItem(block.id, i)}
                          className={`relative p-4 flex items-center gap-4 rounded-2xl transition-all duration-300 ${
                             isActive 
                               ? (isBreak ? 'bg-orange-50 border-2 border-orange-400 shadow-lg scale-[1.02] z-10' : 'bg-indigo-50 border-2 border-indigo-500 shadow-lg scale-[1.02] z-10') 
                               : 'bg-white border border-slate-100 hover:border-slate-300 opacity-90'
                          }`}
                        >
                           <div className="shrink-0">
                              {isActive ? (
                                 isBreak ? <Coffee className="text-orange-500 animate-bounce" size={24}/> : <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full"><Music size={20} className="animate-pulse"/></div>
                              ) : (
                                 <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 text-slate-300 flex items-center justify-center font-bold text-xs">{i+1}</div>
                              )}
                           </div>
                           
                           <div className="flex-1 min-w-0">
                              <div className={`text-base leading-tight mb-1 ${isActive ? 'font-bold text-slate-900' : 'font-medium text-slate-600'}`}>
                                 {item.title}
                              </div>
                              <div className="text-xs text-slate-400 flex items-center gap-2">
                                 {isBreak ? (
                                    <span className="flex items-center gap-1"><Clock size={10}/> {item.duration}</span>
                                 ) : (
                                    <span>{item.composer}</span>
                                 )}
                              </div>
                           </div>

                           {isActive && !isBreak && (
                              <div className="shrink-0 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm animate-pulse">演奏中</div>
                           )}
                           {isActive && isBreak && (
                              <div className="shrink-0 bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-sm animate-pulse">休憩中</div>
                           )}
                        </div>
                     )
                  })}
               </div>
            ))}
         </div>
      </div>

      {/* 3. BREAK CONTROL FOOTER (Fixed) */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 p-4 pb-safe z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
         {activeInfo?.item.type === "break" ? (
            // ACTIVE BREAK MODE
            <div className="flex items-center justify-between gap-4 max-w-xl mx-auto">
               <div className="flex-1 bg-orange-50 rounded-2xl p-4 border border-orange-200 flex items-center gap-5 shadow-inner">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-orange-500 shadow-sm shrink-0">
                     <Coffee size={24} className="animate-bounce"/>
                  </div>
                  <div>
                     <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-0.5">現在 休憩中</div>
                     <div className="text-4xl font-black text-slate-800 tabular-nums leading-none tracking-tight">
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
               <button onClick={stopBreak} className="h-20 w-24 rounded-2xl bg-red-500 text-white flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 transition-transform hover:bg-red-600 border-b-4 border-red-700">
                  <StopCircle size={28} />
                  <span className="text-xs font-bold">終了する</span>
               </button>
            </div>
         ) : (
            // IDLE MODE
            <div className="flex flex-col gap-2 max-w-xl mx-auto">
               <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                  <span>休憩タイマー</span>
                  <span>手動入力</span>
               </div>
               <div className="flex items-stretch gap-2 h-14">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                     {[10, 15, 20].map(min => (
                        <button key={min} onClick={() => startBreak(min)} className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl font-bold text-lg hover:bg-slate-100 hover:border-slate-300 active:scale-95 transition-all">
                           {min}分
                        </button>
                     ))}
                  </div>
                  <div className="w-px bg-slate-200 my-2"></div>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2">
                     <input 
                        type="number" 
                        className="w-10 bg-transparent text-center font-bold text-lg text-slate-800 outline-none" 
                        placeholder="15" 
                        value={customBreakTime} 
                        onChange={e=>setCustomBreakTime(e.target.value)} 
                     />
                     <button onClick={() => startBreak(parseInt(customBreakTime)||15)} className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md active:scale-90 transition-transform">
                        <Play size={16} fill="currentColor"/>
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div>
    </div>
  );
}