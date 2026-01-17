"use client";

import React, { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import QRCode from "qrcode";
import {
  Save,
  Trash2,
  Plus,
  User,
  Music,
  MessageSquare,
  Loader2,
  Image as ImageIcon,
  Eye,
  Camera,
  Upload,
  Coffee,
  Play,
  Pause,
  Lock,
  Unlock,
  Edit3,
  MonitorPlay,
  Share2,
  Grid,
  X,
  ChevronDown,
  LayoutTemplate,
  Type,
  List,
  Star,
  StopCircle,
  Copy,
  Mail,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Twitter,
  Instagram,
  Globe,
  Heart,
  MessageCircle,
  Settings2
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { params: Promise<{ id: string }> };
type Tab = "edit" | "live";

// --- Utility Components ---
function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <label className="block text-[10px] font-bold text-slate-400 mb-1 ml-1 tracking-wider uppercase">{label}</label>
      {children}
    </div>
  );
}

export default function EventEdit({ params }: Props) {
  const { id } = use(params);

  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("edit");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Share & QR
  const [showShareModal, setShowShareModal] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>("");

  // UI State
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Cover Image & Footer Links
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [footerLinks, setFooterLinks] = useState<{survey?: string, donation?: string}>({});
  const [isEventDirty, setIsEventDirty] = useState(false);

  // Live Mode
  const [encoreRevealed, setEncoreRevealed] = useState(false);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [customBreakTime, setCustomBreakTime] = useState("15");

  const pageRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function showMsg(text: string, isError = false) {
    setMsg({ text, isError });
    setTimeout(() => setMsg(null), 3000);
  }

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data: e, error: e1 } = await supabase.from("events").select("*").eq("id", id).single();
    if (e1) { showMsg(e1.message, true); return; }
    setEvent(e);
    setCoverImageDraft(e.cover_image ?? null);
    
    // Load footer links from theme (using theme as a JSON store for extras)
    const theme = typeof e.theme === 'string' ? JSON.parse(e.theme) : (e.theme || {});
    setFooterLinks(theme.footer_links || {});

    setIsEventDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);
    const { data: b } = await supabase.from("blocks").select("*").eq("event_id", id).order("sort_order", { ascending: true });
    setBlocks(b ?? []);

    if (e?.slug && typeof window !== 'undefined') {
      const url = `${window.location.origin}/e/${e.slug}`;
      QRCode.toDataURL(url, { width: 400, margin: 2 }, (err: any, url: string) => {
        if (!err) setQrCodeData(url);
      });
    }
  }

  // --- Sorting ---
  async function moveBlock(blockId: string, dir: "up" | "down") {
    const idx = blocks.findIndex((b) => b.id === blockId);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || to < 0 || to >= blocks.length) return;
    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[to]] = [newBlocks[to], newBlocks[idx]];
    setBlocks(newBlocks);
    await Promise.all([
      supabase.from("blocks").update({ sort_order: (idx + 1) * 10 }).eq("id", newBlocks[idx].id),
      supabase.from("blocks").update({ sort_order: (to + 1) * 10 }).eq("id", newBlocks[to].id),
    ]);
  }

  // --- Actions ---
  async function handleCoverUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `cover_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("pamp-images").upload(`covers/${fileName}`, file);
      if (error) throw error;
      const { data } = supabase.storage.from("pamp-images").getPublicUrl(`covers/${fileName}`);
      setCoverImageDraft(data.publicUrl);
      setIsEventDirty(true);
    } catch { showMsg("失敗しました", true); }
    finally { setUploadingCover(false); }
  }

  async function saveEventMeta() {
    if (!isEventDirty) return;
    setLoading(true);
    
    // Save Links to Theme
    const currentTheme = typeof event.theme === 'string' ? JSON.parse(event.theme) : (event.theme || {});
    const newTheme = { ...currentTheme, footer_links: footerLinks };

    const { error } = await supabase.from("events").update({ 
      cover_image: coverImageDraft,
      theme: newTheme
    }).eq("id", id);

    if (!error) {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft, theme: newTheme }));
      setIsEventDirty(false);
      showMsg("設定を保存しました✨");
    }
    setLoading(false);
  }

  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);
    await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
    showMsg(next ? "アンコール公開🎉" : "アンコール非公開🔒");
  }

  async function toggleActiveItem(blockId: string, itemIndex: number) {
    if (!blocks || blocks.length === 0) return;
    const targetBlockIndex = blocks.findIndex((b) => b.id === blockId);
    if (targetBlockIndex === -1) return;
    const targetBlock = blocks[targetBlockIndex];
    if (!targetBlock?.content?.items || !targetBlock.content.items[itemIndex]) return;

    const items = [...targetBlock.content.items];
    const targetId = `${blockId}-${itemIndex}`;
    const isCurrentlyActive = playingItemId === targetId;
    const nextState = !isCurrentlyActive;
    setPlayingItemId(nextState ? targetId : null);
    items.forEach((it, idx) => {
        if (idx === itemIndex) it.active = nextState;
        else it.active = false; 
    });
    const newBlocks = [...blocks];
    newBlocks[targetBlockIndex] = { ...targetBlock, content: { ...targetBlock.content, items } };
    setBlocks(newBlocks);
    await supabase.from("blocks").update({ content: { ...targetBlock.content, items } }).eq("id", blockId);
  }

  // --- Break Logic ---
  async function startBreak(minutes: number) {
    let targetBlockId = null;
    let targetItemIndex = -1;
    // Find break block
    if (playingItemId) {
       const active = getActiveItemInfo();
       if (active?.item.type === "break") {
          targetBlockId = active.block.id;
          targetItemIndex = active.index;
       }
    }
    if (!targetBlockId) {
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
    }
    if (!targetBlockId) return showMsg("プログラム内に「休憩」項目を追加してください", true);

    const targetIndex = blocks.findIndex(b => b.id === targetBlockId);
    const target = blocks[targetIndex];
    const end = new Date(Date.now() + minutes * 60000).toISOString();
    const newItems = [...target.content.items];
    newItems[targetItemIndex] = { ...newItems[targetItemIndex], timerEnd: end, duration: `${minutes}分`, active: true };
    setPlayingItemId(`${targetBlockId}-${targetItemIndex}`);
    const newBlocks = [...blocks];
    newBlocks[targetIndex] = { ...target, content: { ...target.content, items: newItems } };
    setBlocks(newBlocks);
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", targetBlockId);
    showMsg(`${minutes}分の休憩を開始しました⏳`);
  }

  async function stopBreak() {
    if (!playingItemId) return;
    const active = getActiveItemInfo();
    if (!active || active.item.type !== "break") return;
    const targetIndex = blocks.findIndex(b => b.id === active.block.id);
    const target = blocks[targetIndex];
    const newItems = [...target.content.items];
    newItems[active.index] = { ...newItems[active.index], timerEnd: null, active: false };
    setPlayingItemId(null);
    const newBlocks = [...blocks];
    newBlocks[targetIndex] = { ...target, content: { ...target.content, items: newItems } };
    setBlocks(newBlocks);
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", active.block.id);
    showMsg("休憩を終了しました");
  }

  // --- Block Ops ---
  async function addBlock(type: string) {
    setIsAddMenuOpen(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    let content = {};
    if (type === "greeting") content = { text: "", author: "", role: "", image: "" };
    if (type === "program") content = { items: [{ type: "song", title: "", composer: "", performer: "", description: "" }] };
    if (type === "profile") content = { people: [{ name: "", role: "", bio: "", image: "", sns: {} }] };
    if (type === "gallery") content = { title: "", images: [], caption: "" };
    if (type === "free") content = { title: "", text: "" };

    const { data, error } = await supabase.from("blocks").insert({
      event_id: id, owner_id: u.user.id, type, sort_order: maxOrder + 10, content
    }).select().single();

    if (!error && data) {
      await load();
      setExpandedBlockId(data.id);
      setTimeout(() => pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    }
  }

  async function saveBlockContent(blockId: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    const { error } = await supabase.from("blocks").update({ content }).eq("id", blockId);
    if (error) throw error;
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("削除してよろしいですか？")) return;
    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (!error) {
       setBlocks((prev) => prev.filter((b) => b.id !== blockId));
       if (expandedBlockId === blockId) setExpandedBlockId(null);
       showMsg("削除しました");
    }
  }

  // --- Share Logic ---
  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
        const url = `${window.location.origin}/e/${event.slug}`;
        navigator.clipboard.writeText(url);
        showMsg("URLをコピーしました📋");
    }
  };
  const handleShareLine = () => {
    if (typeof window !== 'undefined') {
        const url = `${window.location.origin}/e/${event.slug}`;
        window.open(`https://line.me/R/msg/text/?${encodeURIComponent(event.title + " " + url)}`, '_blank');
    }
  };
  const handleShareMail = () => {
    if (typeof window !== 'undefined') {
        const url = `${window.location.origin}/e/${event.slug}`;
        window.open(`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(url)}`);
    }
  };

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
  const displayCover = coverImageDraft ?? event?.cover_image;

  if (!event) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900" ref={pageRef}>
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex justify-between items-center safe-top shadow-sm h-14">
        <h1 className="text-sm font-bold truncate max-w-[180px] text-slate-800">{event.title}</h1>
        <div className="flex gap-2">
           <button onClick={() => setShowShareModal(true)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
              <Share2 size={16}/> <span className="text-xs font-bold">配布</span>
           </button>
           <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-slate-900 text-white rounded-full shadow-md active:scale-95 transition-transform"><Eye size={18} /></Link>
        </div>
      </header>

      {/* TOAST */}
      <div className={`fixed top-16 inset-x-0 flex justify-center pointer-events-none z-[60] transition-all ${msg ? 'opacity-100 translate-y-2' : 'opacity-0 -translate-y-4'}`}>
        {msg && <div className={`px-4 py-2.5 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 backdrop-blur-md ${msg.isError ? 'bg-red-500/90 text-white' : 'bg-slate-800/90 text-white'}`}>{msg.text}</div>}
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowShareModal(false)}>
           <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="bg-slate-50 p-8 flex flex-col items-center text-center">
                 <h3 className="font-bold text-lg text-slate-800 mb-6">プログラムを配布</h3>
                 {qrCodeData && <img src={qrCodeData} alt="QR" className="w-48 h-48 mb-6 mix-blend-multiply border rounded-xl" />}
                 <div className="grid grid-cols-3 gap-3 w-full">
                    <button onClick={handleShareLine} className="flex flex-col items-center gap-2 p-3 bg-[#06C755]/10 rounded-2xl hover:bg-[#06C755]/20 active:scale-95 transition-all">
                       <div className="w-10 h-10 bg-[#06C755] rounded-full flex items-center justify-center text-white"><ExternalLink size={20}/></div>
                       <span className="text-[10px] font-bold text-slate-600">LINE</span>
                    </button>
                    <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 active:scale-95 transition-all">
                       <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600"><Copy size={20}/></div>
                       <span className="text-[10px] font-bold text-slate-600">コピー</span>
                    </button>
                    <button onClick={handleShareMail} className="flex flex-col items-center gap-2 p-3 bg-blue-50 rounded-2xl hover:bg-blue-100 active:scale-95 transition-all">
                       <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white"><Mail size={20}/></div>
                       <span className="text-[10px] font-bold text-slate-600">メール</span>
                    </button>
                 </div>
              </div>
              <div className="p-4 bg-white border-t border-slate-100">
                 <button className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl active:scale-95 transition-transform" onClick={() => setShowShareModal(false)}>閉じる</button>
              </div>
           </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="h-[calc(100dvh-7.5rem)] bg-slate-100 overflow-hidden">
        
        {/* === EDIT TAB === */}
        {activeTab === "edit" && (
          <div className="h-full overflow-y-auto pb-32 p-4 space-y-6">
            <div className="pt-4 text-center">
               <h2 className="text-lg font-bold text-slate-800">パンフレット編集画面</h2>
               <div className="w-12 h-1 bg-indigo-500 rounded-full mx-auto mt-2 opacity-20"></div>
            </div>

            {/* Event Settings (Cover & Footer Links) */}
            <section className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 space-y-6">
               <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-2 ml-1 tracking-wider uppercase">表紙カバー画像</label>
                  <div className="relative aspect-[16/9] bg-slate-50 rounded-xl overflow-hidden border border-slate-200 group">
                     {displayCover ? (
                     // eslint-disable-next-line @next/next/no-img-element
                     <img src={displayCover} className="w-full h-full object-cover" alt="" />
                     ) : (
                     <div className="flex flex-col items-center justify-center h-full text-slate-300"><ImageIcon size={32} className="mb-1"/><span className="text-xs font-bold">画像なし</span></div>
                     )}
                     <label className="absolute bottom-3 right-3 z-10 cursor-pointer">
                     <div className="bg-white/90 text-slate-900 px-4 py-2 rounded-full text-xs font-bold shadow-sm flex items-center gap-2 hover:bg-white transition-all active:scale-95">
                        {uploadingCover ? <Loader2 className="animate-spin" size={14}/> : <Camera size={14}/>} 変更
                     </div>
                     <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                     </label>
                  </div>
               </div>

               <div>
                 <label className="block text-[10px] font-bold text-slate-400 mb-2 ml-1 tracking-wider uppercase">アクションボタン設定 (任意)</label>
                 <div className="space-y-3">
                   <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                     <MessageCircle size={18} className="text-slate-400"/>
                     <input 
                       className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300"
                       placeholder="アンケートURL (Google Formなど)" 
                       value={footerLinks.survey || ""}
                       onChange={(e) => { setFooterLinks({...footerLinks, survey: e.target.value}); setIsEventDirty(true); }}
                     />
                   </div>
                   <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                     <Heart size={18} className="text-slate-400"/>
                     <input 
                       className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-300"
                       placeholder="寄付・支援URL" 
                       value={footerLinks.donation || ""}
                       onChange={(e) => { setFooterLinks({...footerLinks, donation: e.target.value}); setIsEventDirty(true); }}
                     />
                   </div>
                 </div>
               </div>

               {isEventDirty && (
                 <div className="flex justify-end pt-2">
                   <button onClick={saveEventMeta} disabled={loading} className="bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow active:scale-95 transition-transform">設定を保存</button>
                 </div>
               )}
            </section>

            {/* Blocks */}
            <div className="space-y-4">
                {blocks.map((b, i) => (
                    <BlockCard 
                        key={b.id} block={b} index={i} total={blocks.length} 
                        isExpanded={expandedBlockId === b.id}
                        onToggle={() => setExpandedBlockId(expandedBlockId === b.id ? null : b.id)}
                        onSave={saveBlockContent} onDelete={deleteBlock} onMove={moveBlock} supabaseClient={supabase} 
                    />
                ))}
            </div>

            {blocks.length === 0 && (
              <div className="text-center py-16 text-slate-400 bg-white rounded-[2rem] border border-dashed border-slate-200">
                <p className="text-sm font-bold">コンテンツがありません</p>
                <p className="text-xs mt-1">「＋」ボタンで追加してください</p>
              </div>
            )}
            <div className="h-24" />
          </div>
        )}

        {/* === LIVE TAB === */}
        {activeTab === "live" && (
          <div className="h-full flex flex-col relative bg-slate-50">
            {/* 1. Status */}
            <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm z-30">
               <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${encoreRevealed ? 'bg-pink-500 animate-pulse' : 'bg-slate-300'}`}></div>
                     <span className={`text-xs font-bold ${encoreRevealed ? 'text-pink-600' : 'text-slate-400'}`}>アンコール: {encoreRevealed ? "公開中" : "非公開"}</span>
                  </div>
                  <button onClick={toggleEncore} className={`px-4 py-1.5 rounded-full font-bold text-[10px] border active:scale-95 transition-all ${encoreRevealed?'bg-pink-500 text-white border-pink-500':'bg-white text-slate-500 border-slate-200'}`}>切り替え</button>
               </div>
               <div className="p-4 bg-slate-50/50">
                  {activeInfo?.item.type === "break" ? (
                     <div className="flex items-center gap-4 bg-orange-50 border border-orange-100 p-3 rounded-2xl animate-in slide-in-from-top-1">
                        <div className="flex-1">
                           <div className="text-[10px] font-bold text-orange-400 uppercase tracking-widest flex items-center gap-1"><Coffee size={10}/> 休憩中</div>
                           <div className="text-3xl font-black text-slate-800 tabular-nums font-mono leading-none mt-1">
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
                        <button onClick={stopBreak} className="h-10 px-5 bg-red-500 text-white rounded-xl font-bold text-xs shadow active:scale-95 flex items-center gap-1"><StopCircle size={14} /> 終了</button>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">休憩コントロール</div>
                        <div className="flex gap-2 h-10">
                           <button onClick={() => startBreak(10)} className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold active:scale-95">10分</button>
                           <button onClick={() => startBreak(15)} className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold active:scale-95">15分</button>
                           <button onClick={() => startBreak(20)} className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold active:scale-95">20分</button>
                           <div className="w-px bg-slate-300 mx-1"></div>
                           <input type="number" className="w-12 bg-white border border-slate-200 rounded-lg text-center text-xs font-bold" placeholder="分" value={customBreakTime} onChange={e=>setCustomBreakTime(e.target.value)} />
                           <button onClick={() => startBreak(parseInt(customBreakTime)||15)} className="px-4 bg-slate-800 text-white rounded-lg text-xs font-bold active:scale-95">開始</button>
                        </div>
                     </div>
                  )}
               </div>
            </div>

            {/* 2. Program List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-1">プログラム</h3>
               {blocks.filter(b => b.type === "program").map(block => (
                  <div key={block.id}>
                     {block.content.items?.map((item: any, i: number) => {
                        const isActive = playingItemId === `${block.id}-${i}`;
                        const isBreak = item.type === "break";
                        if (item.type === "section") return <div key={i} className="pt-6 pb-2 pl-2 text-sm font-bold text-slate-500 border-b border-slate-200 mb-2">{item.title}</div>;
                        if (item.type === "memo") return <div key={i} className="my-2 mx-1 p-2 bg-yellow-50 text-yellow-800 text-xs rounded border border-yellow-200">📝 {item.title}</div>;
                        return (
                           <div key={i} className={`p-3 flex items-center gap-3 transition-colors rounded-lg ${isActive ? 'bg-indigo-50' : 'bg-transparent'}`}>
                              <div className="shrink-0 w-8 flex justify-center">
                                 {isActive ? (isBreak ? <Coffee size={18} className="text-orange-500"/> : <MonitorPlay size={18} className="text-indigo-600 animate-pulse"/>) : (<div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>)}
                              </div>
                              <div className="flex-1 min-w-0" onClick={() => !isBreak && toggleActiveItem(block.id, i)}>
                                 <div className={`text-sm ${isActive ? 'font-bold text-indigo-900' : 'font-medium text-slate-700'}`}>{item.title}</div>
                                 <div className="text-xs text-slate-400 mt-0.5">{isBreak ? `休憩 ${item.duration}` : item.composer}</div>
                              </div>
                              {!isBreak && (
                                 <button onClick={() => toggleActiveItem(block.id, i)} className={`shrink-0 p-2 rounded-full ${isActive ? 'bg-indigo-200 text-indigo-700' : 'text-slate-300 hover:bg-slate-100'}`}>
                                    {isActive ? <Pause size={16} fill="currentColor"/> : <Play size={16} fill="currentColor"/>}
                                 </button>
                              )}
                              {isBreak && isActive && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-1 rounded">進行中</span>}
                           </div>
                        )
                     })}
                  </div>
               ))}
               <div className="h-20"/>
            </div>
          </div>
        )}
      </main>

      {/* FAB */}
      {activeTab === "edit" && (
        <>
          <div className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity duration-300 ${isAddMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsAddMenuOpen(false)}>
            <div className={`fixed bottom-24 inset-x-4 max-w-xl mx-auto bg-white/90 backdrop-blur-md border border-white/50 rounded-[2rem] p-6 transition-transform duration-300 shadow-2xl ${isAddMenuOpen ? 'translate-y-0' : 'translate-y-10 opacity-0'}`} onClick={e => e.stopPropagation()}>
              <h3 className="text-center font-bold text-sm mb-6 text-slate-500">コンテンツを追加</h3>
              <div className="grid grid-cols-3 gap-4">
                <AddMenuBtn label="ご挨拶" icon={MessageSquare} color="text-orange-500 bg-orange-50" onClick={() => addBlock("greeting")} />
                <AddMenuBtn label="プログラム" icon={Music} color="text-blue-500 bg-blue-50" onClick={() => addBlock("program")} />
                <AddMenuBtn label="出演者" icon={User} color="text-green-500 bg-green-50" onClick={() => addBlock("profile")} />
                <AddMenuBtn label="ギャラリー" icon={Grid} color="text-pink-500 bg-pink-50" onClick={() => addBlock("gallery")} />
                <AddMenuBtn label="フリー" icon={Type} color="text-indigo-500 bg-indigo-50" onClick={() => addBlock("free")} />
              </div>
            </div>
          </div>
          <button onClick={() => setIsAddMenuOpen(true)} className="fixed bottom-20 right-6 z-40 w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl shadow-slate-500/50 flex items-center justify-center transition-transform active:scale-90 hover:scale-105">
            <Plus size={28} />
          </button>
        </>
      )}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-slate-200 pb-safe flex justify-around items-center h-16">
        <NavBtn active={activeTab === "edit"} onClick={() => setActiveTab("edit")} icon={Edit3} label="編集" />
        <NavBtn active={activeTab === "live"} onClick={() => setActiveTab("live")} icon={MonitorPlay} label="本番モード" />
      </nav>

    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${active ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-500'}`}>
      <Icon size={22} strokeWidth={active?2.5:2} className={`mb-1 transition-transform ${active?'scale-110':''}`} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-2xl active:scale-95 transition-all hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 ${color}`}>
      <Icon size={24} />
      <span className="text-[10px] font-bold text-slate-600">{label}</span>
    </button>
  );
}

function BlockCard({ block, index, total, isExpanded, onToggle, onSave, onDelete, onMove, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => { setContent(block.content ?? {}); setIsDirty(false); }, [block.id, isExpanded]);
  const handleChange = (nc: any) => { setContent(nc); setIsDirty(true); };

  const handleSave = async (e?: any) => {
    e?.stopPropagation();
    setSaving(true);
    try { await onSave(block.id, content); setIsDirty(false); } catch { alert("エラー"); } finally { setSaving(false); }
  };

  const handleUpload = async (e: any, target: 'single' | 'gallery' | 'profile', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const ext = file.name.split(".").pop();
      const path = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabaseClient.storage.from("pamp-images").upload(path, file);
      if (error) throw error;
      const { data } = supabaseClient.storage.from("pamp-images").getPublicUrl(path);
      if (target === 'single') handleChange({ ...content, image: data.publicUrl });
      if (target === 'profile' && typeof index === 'number') {
        const np = [...content.people]; np[index].image = data.publicUrl; handleChange({ ...content, people: np });
      }
      if (target === 'gallery') {
         const current = content.images ?? (content.url ? [content.url] : []);
         handleChange({ ...content, images: [...current, data.publicUrl] });
      }
    } catch { alert("アップロード失敗"); }
  };

  const labels: any = { greeting: "ご挨拶", program: "プログラム", profile: "出演者", gallery: "ギャラリー", free: "フリーテキスト" };
  const badgeColors: any = { greeting: "text-orange-500 bg-orange-50", program: "text-blue-500 bg-blue-50", profile: "text-green-500 bg-green-50", gallery: "text-pink-500 bg-pink-50", free: "text-indigo-500 bg-indigo-50" };
  const TypeIcon = { greeting: MessageSquare, program: Music, profile: User, gallery: Grid, free: Type }[block.type as string] || Edit3;

  return (
    <div className={`bg-white rounded-[2rem] shadow-sm transition-all duration-300 overflow-hidden border border-slate-100 ${isExpanded ? 'ring-2 ring-indigo-500/20 shadow-xl scale-[1.01] my-4' : 'hover:shadow-md'}`}>
      <div className="flex items-center justify-between p-5 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center gap-4">
           {!isExpanded && (
             <div className="flex flex-col gap-1 -ml-1" onClick={e=>e.stopPropagation()}>
               <button onClick={() => onMove(block.id, 'up')} disabled={index===0} className="text-slate-300 hover:text-indigo-500 disabled:opacity-0"><ArrowUp size={16}/></button>
               <button onClick={() => onMove(block.id, 'down')} disabled={index===total-1} className="text-slate-300 hover:text-indigo-500 disabled:opacity-0"><ArrowDown size={16}/></button>
             </div>
           )}
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${badgeColors[block.type] || 'bg-slate-100'}`}>
             <TypeIcon size={20} />
           </div>
           <div>
             <div className="text-sm font-bold text-slate-800">{labels[block.type]}</div>
             {!isExpanded && <div className="text-[10px] text-slate-400 truncate max-w-[150px] mt-0.5 font-medium">
                {block.type === 'free' ? content.title : block.type === 'greeting' ? content.author : 'タップして編集'}
             </div>}
           </div>
        </div>
        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-slate-300'}`}><ChevronDown size={20} /></div>
      </div>

      {isExpanded && (
        <div className="p-5 pt-0 animate-in slide-in-from-top-2 cursor-auto" onClick={e => e.stopPropagation()}>
           <div className="py-6 space-y-6 border-t border-slate-50">
              {block.type === "greeting" && (
                <>
                  <div className="flex gap-4">
                    <div className="relative w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-200 group">
                      {content.image ? <img src={content.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-8 text-slate-300"/>}
                      <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 cursor-pointer transition-colors z-10"><Camera size={20} className="text-white opacity-0 group-hover:opacity-100"/><input type="file" className="hidden" onChange={e => handleUpload(e, 'single')} /></label>
                    </div>
                    <div className="flex-1 space-y-3">
                      <InputField label="お名前"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl text-base font-bold outline-none" placeholder="氏名" value={content.author||""} onChange={e => handleChange({...content, author: e.target.value})} /></InputField>
                      <InputField label="肩書き"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl text-sm outline-none" placeholder="例: 主催者" value={content.role||""} onChange={e => handleChange({...content, role: e.target.value})} /></InputField>
                    </div>
                  </div>
                  <InputField label="挨拶文"><textarea className="w-full bg-slate-50 p-4 rounded-xl text-base h-40 outline-none resize-none" placeholder="本文..." value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} /></InputField>
                </>
              )}
              {block.type === "free" && (
                  <>
                    <InputField label="タイトル"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl text-base font-bold outline-none" placeholder="タイトル" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} /></InputField>
                    <InputField label="本文"><textarea className="w-full bg-slate-50 p-4 rounded-xl text-base h-40 outline-none resize-none" placeholder="本文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} /></InputField>
                  </>
              )}
              {block.type === "gallery" && (
                  <>
                    <InputField label="タイトル"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl text-base font-bold outline-none" placeholder="Memories" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} /></InputField>
                    <div className="grid grid-cols-3 gap-3">
                      {(content.images || (content.url ? [content.url] : [])).map((url:string, i:number) => (
                          <div key={i} className="relative aspect-square bg-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                            <button onClick={() => handleChange({...content, images: (content.images||[content.url]).filter((_:any,idx:number)=>idx!==i)})} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1.5"><X size={12}/></button>
                          </div>
                       ))}
                       <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-400 cursor-pointer"><Plus /><input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'gallery')} /></label>
                    </div>
                    <InputField label="キャプション"><input className="w-full bg-slate-50 px-4 py-3 rounded-xl text-sm outline-none" placeholder="説明..." value={content.caption||""} onChange={e => handleChange({...content, caption: e.target.value})} /></InputField>
                  </>
              )}
              {block.type === "profile" && (
                <div className="space-y-6">
                  {(content.people || []).map((p: any, i: number) => (
                    <div key={i} className="flex gap-4 p-4 bg-slate-50 rounded-[1.5rem] relative border border-slate-100">
                      <div className="relative w-20 h-20 bg-white rounded-2xl overflow-hidden shrink-0 border border-slate-100 group">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-6 text-slate-300"/>}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 cursor-pointer z-10"><Upload size={16} className="text-white opacity-0 group-hover:opacity-100"/><input type="file" className="hidden" onChange={e => handleUpload(e, 'profile', i)} /></label>
                      </div>
                      <div className="flex-1 space-y-2 pr-8">
                        <input className="w-full bg-white px-3 py-2 rounded-lg text-base font-bold outline-none" placeholder="名前" value={p.name} onChange={e => {const np=[...content.people]; np[i].name=e.target.value; handleChange({...content, people:np})}} />
                        <input className="w-full bg-white px-3 py-2 rounded-lg text-sm outline-none" placeholder="役割" value={p.role} onChange={e => {const np=[...content.people]; np[i].role=e.target.value; handleChange({...content, people:np})}} />
                        {/* SNS Inputs */}
                        <div className="flex gap-2">
                           <div className="flex-1 flex items-center bg-white px-2 rounded-lg border border-slate-200">
                              <Twitter size={14} className="text-slate-400 mr-2"/>
                              <input className="w-full py-1.5 text-xs outline-none" placeholder="X (Twitter) URL" value={p.sns?.twitter||""} onChange={e=>{const np=[...content.people]; np[i].sns={...p.sns, twitter:e.target.value}; handleChange({...content, people:np})}}/>
                           </div>
                           <div className="flex-1 flex items-center bg-white px-2 rounded-lg border border-slate-200">
                              <Instagram size={14} className="text-slate-400 mr-2"/>
                              <input className="w-full py-1.5 text-xs outline-none" placeholder="Insta URL" value={p.sns?.instagram||""} onChange={e=>{const np=[...content.people]; np[i].sns={...p.sns, instagram:e.target.value}; handleChange({...content, people:np})}}/>
                           </div>
                           <div className="flex-1 flex items-center bg-white px-2 rounded-lg border border-slate-200">
                              <Globe size={14} className="text-slate-400 mr-2"/>
                              <input className="w-full py-1.5 text-xs outline-none" placeholder="Web URL" value={p.sns?.website||""} onChange={e=>{const np=[...content.people]; np[i].sns={...p.sns, website:e.target.value}; handleChange({...content, people:np})}}/>
                           </div>
                        </div>
                        <textarea className="w-full bg-white px-3 py-2 rounded-lg text-sm h-20 outline-none resize-none" placeholder="紹介文" value={p.bio} onChange={e => {const np=[...content.people]; np[i].bio=e.target.value; handleChange({...content, people:np})}} />
                      </div>
                      <button onClick={() => handleChange({...content, people: content.people.filter((_:any,idx:number)=>idx!==i)})} className="absolute top-3 right-3 p-2 bg-slate-100 rounded-full text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                    </div>
                  ))}
                  <button onClick={() => handleChange({...content, people: [...(content.people||[]), {name:"",role:"",bio:"",image:"", sns:{}}]})} className="w-full py-4 bg-white border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl font-bold text-sm">+ 出演者を追加</button>
                </div>
              )}
              {block.type === "program" && (
                  <div className="space-y-4">
                    {(content.items || []).map((item: any, i: number) => (
                        <div key={i} className="group relative">
                            {item.type === "section" && (
                              <div className="flex gap-2 items-center mt-6 mb-2">
                                <div className="flex-1 border-b border-indigo-200"><input className="w-full bg-transparent py-2 text-indigo-700 font-bold text-sm outline-none" placeholder="セクション見出し" value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} /></div>
                                <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                            )}
                            {item.type === "memo" && (
                              <div className="relative p-3 bg-yellow-50 rounded-xl border border-yellow-100 flex gap-2">
                                 <textarea className="flex-1 bg-transparent text-sm text-yellow-900 outline-none resize-none" rows={2} placeholder="メモ" value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} />
                                 <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-1 text-yellow-400 hover:text-red-500"><X size={14}/></button>
                              </div>
                            )}
                            {(item.type === "song" || item.type === "break") && (
                                <div className={`p-4 bg-slate-50 rounded-[1.5rem] relative space-y-3 border border-slate-100 ${item.isEncore ? 'ring-2 ring-pink-100 bg-pink-50/30' : ''}`}>
                                    <div className="flex gap-3 items-start">
                                        <div className="flex flex-col mt-2 gap-1">
                                           <button onClick={() => {if(i>0){const ni=[...content.items]; [ni[i],ni[i-1]]=[ni[i-1],ni[i]]; handleChange({...content, items:ni})}}} className="p-1 text-slate-300 hover:text-slate-600 text-[10px]">▲</button>
                                           <button onClick={() => {if(i<content.items.length-1){const ni=[...content.items]; [ni[i],ni[i+1]]=[ni[i+1],ni[i]]; handleChange({...content, items:ni})}}} className="p-1 text-slate-300 hover:text-slate-600 text-[10px]">▼</button>
                                        </div>
                                        <div className="flex-1 space-y-3">
                                            <div className="flex gap-2">
                                                <InputField label={item.type==="break" ? "休憩名" : "曲名"}><input className="w-full bg-white px-3 py-3 rounded-xl text-base font-bold outline-none" placeholder={item.type==="break"?"休憩":"曲タイトル"} value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} /></InputField>
                                                <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="mt-6 p-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                                            </div>
                                            {item.type === "break" ? (
                                                <InputField label="目安時間"><input className="w-full bg-white px-3 py-3 rounded-xl text-sm outline-none" placeholder="例: 15分" value={item.duration} onChange={e => { const ni=[...content.items]; ni[i].duration=e.target.value; handleChange({...content, items:ni}); }} /></InputField>
                                            ) : (
                                                <>
                                                  <div className="grid grid-cols-2 gap-3">
                                                      <InputField label="作曲者"><input className="w-full bg-white px-3 py-3 rounded-xl text-sm outline-none" placeholder="Artist" value={item.composer} onChange={e => { const ni=[...content.items]; ni[i].composer=e.target.value; handleChange({...content, items:ni}); }} /></InputField>
                                                      <InputField label="演奏者"><input className="w-full bg-white px-3 py-3 rounded-xl text-sm outline-none" placeholder="Performer" value={item.performer||""} onChange={e => { const ni=[...content.items]; ni[i].performer=e.target.value; handleChange({...content, items:ni}); }} /></InputField>
                                                  </div>
                                                  <div className="flex justify-end pt-1">
                                                      <button onClick={() => { const ni=[...content.items]; ni[i].isEncore=!ni[i].isEncore; handleChange({...content, items:ni}); }} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all ${item.isEncore ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-slate-200 text-slate-300 grayscale'}`}><Star size={14} fill={item.isEncore ? "currentColor" : "none"} /><span className="text-[10px] font-bold">アンコール</span></button>
                                                  </div>
                                                </>
                                            )}
                                            {item.type !== "break" && <InputField label="曲解説"><textarea className="w-full bg-white px-3 py-3 rounded-xl text-sm h-20 outline-none resize-none" placeholder="解説..." value={item.description} onChange={e => { const ni=[...content.items]; ni[i].description=e.target.value; handleChange({...content, items:ni}); }} /></InputField>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"song",title:"",composer:"",description:"",isEncore:false}]})} className="py-3 bg-indigo-50 text-indigo-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-indigo-100">+ 曲</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"break",title:"休憩",duration:"15分"}]})} className="py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-slate-200">+ 休憩</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"section",title:"新しいセクション"}]})} className="py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2">+ 見出し</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"memo",title:""}]})} className="py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl text-xs flex items-center justify-center gap-2">+ メモ</button>
                    </div>
                  </div>
              )}
           </div>
           <div className="flex items-center justify-between pt-4 border-t border-slate-100">
             <button onClick={() => onDelete(block.id)} className="text-red-400 hover:text-red-600 p-2 text-xs font-bold flex items-center gap-1"><Trash2 size={16}/> 削除</button>
             {isDirty && (<button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all hover:bg-slate-800">{saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 保存</button>)}
           </div>
        </div>
      )}
    </div>
  );
}