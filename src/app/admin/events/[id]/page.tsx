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
  Edit3,
  MonitorPlay,
  Share2,
  Grid,
  X,
  ChevronDown,
  Type,
  Star,
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
  Settings,
  Link as LinkIcon,
  GripVertical,
  Calendar,
  MapPin,
  ChevronLeft
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
import { Cinzel, Zen_Old_Mincho, Cormorant_Garamond } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts ---
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });
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

// --- Utility Components ---
function InputField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      <label className={cn("block text-[10px] font-bold text-[#2C2C2C]/40 mb-1.5 ml-1 tracking-widest uppercase font-sans")}>{label}</label>
      {children}
    </div>
  );
}

function NoZoomInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("w-full bg-[#F9F8F2] px-4 py-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#B48E55]/20 transition-all placeholder:text-[#2C2C2C]/20 text-[#2C2C2C] font-sans border border-[#2C2C2C]/5", props.className || '')} />;
}
function NoZoomTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("w-full bg-[#F9F8F2] p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#B48E55]/20 transition-all resize-none placeholder:text-[#2C2C2C]/20 text-[#2C2C2C] leading-relaxed font-sans border border-[#2C2C2C]/5", props.className || '')} />;
}

export default function EventEdit({ params }: Props) {
  const { id } = use(params);

  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
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

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const pageRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => { load(); }, [id]);

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
    
    const theme = typeof e.theme === 'string' ? JSON.parse(e.theme) : (e.theme || {});
    setFooterLinks(theme.footer_links || {});

    setIsEventDirty(false);
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

  async function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      setBlocks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        const updates = newItems.map((b, i) => ({ id: b.id, sort_order: (i + 1) * 10 }));
        Promise.all(updates.map(u => supabase.from("blocks").update({ sort_order: u.sort_order }).eq("id", u.id)));
        return newItems;
      });
    }
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
    const currentTheme = typeof event.theme === 'string' ? JSON.parse(event.theme) : (event.theme || {});
    const newTheme = { ...currentTheme, footer_links: footerLinks };

    const { error } = await supabase.from("events").update({ 
      cover_image: coverImageDraft,
      theme: newTheme,
      date: event.date,
      location: event.location
    }).eq("id", id);

    if (!error) {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft, theme: newTheme }));
      setIsEventDirty(false);
      showMsg("設定を保存しました✨");
    } else {
        showMsg("保存に失敗しました", true);
    }
    setLoading(false);
  }

  // --- Add/Edit/Delete ---
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

  // ★ select を付ける：更新できた行が返る
  const { data, error } = await supabase
    .from("blocks")
    .update({ content })
    .eq("id", blockId)
    .select("id");

  if (error) throw error;

  // ★ data が空なら「更新0件」= RLS or 条件不一致が濃厚
  if (!data || data.length === 0) {
    throw new Error("保存できていません（更新0件）。RLS/owner_id/条件を確認してください。");
  }
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
        window.open(`https://line.me/R/msg/text/?${encodeURIComponent(event.title + " " + `${window.location.origin}/e/${event.slug}`)}`, '_blank');
    }
  };
  const handleShareMail = () => {
    if (typeof window !== 'undefined') {
        window.open(`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(`${window.location.origin}/e/${event.slug}`)}`);
    }
  };

  const displayCover = coverImageDraft ?? event?.cover_image;

  if (!event) return <div className="min-h-screen flex items-center justify-center bg-[#F9F8F2]"><Loader2 className="animate-spin text-[#B48E55]" /></div>;

  return (
    <div className={cn("min-h-screen bg-[#F9F8F2] font-sans text-[#2C2C2C] selection:bg-[#B48E55]/20", mincho.className)} ref={pageRef}>
      
      {/* Paper Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-[#F9F8F2]/90 backdrop-blur-md border-b border-[#2C2C2C]/5 safe-top shadow-sm">
        <div className="flex justify-between items-center px-4 h-16 max-w-2xl mx-auto">
           {/* Left: Back & Title */}
           <div className="flex items-center gap-3 overflow-hidden">
             <Link href="/admin" className="p-2 -ml-2 text-[#2C2C2C]/50 hover:text-[#2C2C2C] transition-colors"><ChevronLeft size={20}/></Link>
             <h1 className="text-sm font-bold truncate text-[#2C2C2C] font-serif tracking-wide">
               {event.title}
             </h1>
           </div>
           
           {/* Right: Actions */}
           <div className="flex items-center gap-2">
              {/* 1. Distribute */}
              <button 
                onClick={() => setShowShareModal(true)} 
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2C2C2C]/5 text-[#2C2C2C] rounded-full text-xs font-bold hover:bg-[#2C2C2C]/10 transition-colors active:scale-95"
              >
                 <Share2 size={14}/>
                 <span className="hidden xs:inline">配布</span>
              </button>

              {/* 2. Preview */}
              <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-[#2C2C2C]/5 text-[#2C2C2C] rounded-full hover:bg-[#2C2C2C]/10 transition-colors active:scale-95">
                 <Eye size={16} />
              </Link>

              {/* 3. Live Cockpit */}
              <Link 
                href={`/admin/events/${id}/live`} 
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2C] text-[#F9F8F2] rounded-full text-xs font-bold shadow-md hover:bg-[#404040] active:scale-95 transition-all"
              >
                 <MonitorPlay size={14} className="text-[#B48E55]" />
                 <span>本番</span>
              </Link>
           </div>
        </div>
      </header>

      {/* TOAST */}
      <div className={`fixed top-20 inset-x-0 flex justify-center pointer-events-none z-[60] transition-all ${msg ? 'opacity-100 translate-y-2' : 'opacity-0 -translate-y-4'}`}>
        {msg && <div className={`px-4 py-2.5 rounded-full shadow-xl font-bold text-sm flex items-center gap-2 backdrop-blur-md ${msg.isError ? 'bg-red-500/90 text-white' : 'bg-[#2C2C2C]/90 text-[#F9F8F2]'}`}>{msg.text}</div>}
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-[#2C2C2C]/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowShareModal(false)}>
           <div className="bg-[#F9F8F2] rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="p-8 flex flex-col items-center text-center">
                 <h3 className="font-bold text-lg text-[#2C2C2C] mb-6 tracking-widest font-serif">プログラムを配布</h3>
                 <div className="bg-white p-4 rounded-2xl border border-[#2C2C2C]/10 shadow-inner mb-6">
                    {qrCodeData && <img src={qrCodeData} alt="QR" className="w-40 h-40 mix-blend-multiply opacity-90" />}
                 </div>
                 <div className="grid grid-cols-3 gap-3 w-full">
                    <button onClick={handleShareLine} className="flex flex-col items-center gap-2 p-3 bg-[#06C755]/10 rounded-2xl hover:bg-[#06C755]/20 active:scale-95 transition-all"><div className="w-10 h-10 bg-[#06C755] rounded-full flex items-center justify-center text-white"><ExternalLink size={20}/></div><span className="text-[10px] font-bold text-[#2C2C2C]/60">LINE</span></button>
                    <button onClick={handleCopyLink} className="flex flex-col items-center gap-2 p-3 bg-white border border-[#2C2C2C]/10 rounded-2xl hover:bg-[#2C2C2C]/5 active:scale-95 transition-all"><div className="w-10 h-10 bg-[#2C2C2C]/10 rounded-full flex items-center justify-center text-[#2C2C2C]"><Copy size={20}/></div><span className="text-[10px] font-bold text-[#2C2C2C]/60">コピー</span></button>
                    <button onClick={handleShareMail} className="flex flex-col items-center gap-2 p-3 bg-blue-50 rounded-2xl hover:bg-blue-100 active:scale-95 transition-all"><div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white"><Mail size={20}/></div><span className="text-[10px] font-bold text-[#2C2C2C]/60">メール</span></button>
                 </div>
              </div>
              <div className="p-4 border-t border-[#2C2C2C]/5 bg-white/50">
                 <button className="w-full py-3.5 bg-[#2C2C2C]/5 text-[#2C2C2C] font-bold rounded-xl active:scale-95 transition-transform hover:bg-[#2C2C2C]/10" onClick={() => setShowShareModal(false)}>閉じる</button>
              </div>
           </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="relative z-10 h-[calc(100dvh-4rem)] overflow-y-auto pb-32 p-4 space-y-6 max-w-2xl mx-auto">
        
        {/* SETTINGS CARD 1: COVER & INFO */}
        <section className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 shadow-sm border border-[#2C2C2C]/5 mt-4">
            <div className="flex items-center gap-2 mb-4 border-b border-[#2C2C2C]/5 pb-2">
                <Settings size={16} className="text-[#B48E55]"/>
                <h3 className={cn("text-sm font-bold text-[#2C2C2C] tracking-widest", cinzel.className)}>BASIC SETTINGS</h3>
            </div>
            
            <div className="space-y-6">
                <div>
                <label className="block text-[10px] font-bold text-[#2C2C2C]/40 mb-2 ml-1 tracking-widest uppercase">Cover Image</label>
                <div className="relative aspect-[16/9] bg-[#F9F8F2] rounded-xl overflow-hidden border border-[#2C2C2C]/10 group shadow-inner">
                    {displayCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayCover} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" alt="" />
                    ) : (
                    <div className="flex flex-col items-center justify-center h-full text-[#2C2C2C]/20"><ImageIcon size={32} className="mb-1"/><span className="text-xs font-bold font-sans">No Image</span></div>
                    )}
                    <label className="absolute bottom-3 right-3 z-10 cursor-pointer">
                    <div className="bg-white/90 text-[#2C2C2C] px-4 py-2 rounded-full text-xs font-bold shadow-md flex items-center gap-2 hover:bg-white transition-all active:scale-95 border border-[#2C2C2C]/5">
                        {uploadingCover ? <Loader2 className="animate-spin" size={14}/> : <Camera size={14}/>} 変更
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                    </label>
                </div>
                </div>

                {/* Date & Location Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-[#2C2C2C]/40 mb-1 ml-1 tracking-widest uppercase">Date</label>
                    <div className="flex items-center gap-3 bg-[#F9F8F2] px-3 py-1 rounded-xl border border-[#2C2C2C]/5 focus-within:ring-2 focus-within:ring-[#B48E55]/20 transition-all">
                        <Calendar size={16} className="text-[#2C2C2C]/40 shrink-0"/>
                        <NoZoomInput 
                        type="datetime-local" 
                        className="!bg-transparent !px-0 !py-2 border-none focus:ring-0 placeholder:text-[#2C2C2C]/20 !border-0"
                        value={event?.date ? new Date(event.date).toISOString().slice(0, 16) : ""}
                        onChange={(e) => { setEvent({...event, date: e.target.value}); setIsEventDirty(true); }}
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-[#2C2C2C]/40 mb-1 ml-1 tracking-widest uppercase">Location</label>
                    <div className="flex items-center gap-3 bg-[#F9F8F2] px-3 py-1 rounded-xl border border-[#2C2C2C]/5 focus-within:ring-2 focus-within:ring-[#B48E55]/20 transition-all">
                        <MapPin size={16} className="text-[#2C2C2C]/40 shrink-0"/>
                        <NoZoomInput 
                        className="!bg-transparent !px-0 !py-2 border-none focus:ring-0 placeholder:text-[#2C2C2C]/20 !border-0"
                        placeholder="会場名"
                        value={event?.location || ""}
                        onChange={(e) => { setEvent({...event, location: e.target.value}); setIsEventDirty(true); }}
                        />
                    </div>
                </div>
                </div>
            </div>

            {isEventDirty && (
                <div className="flex justify-end pt-6">
                <button onClick={saveEventMeta} disabled={loading} className="bg-[#2C2C2C] text-[#F9F8F2] px-6 py-3 rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all hover:bg-[#404040]">設定を保存</button>
                </div>
            )}
        </section>

        {/* SETTINGS CARD 2: ACTIONS */}
        <section className="bg-white/80 backdrop-blur-sm rounded-[2rem] p-6 shadow-sm border border-[#2C2C2C]/5">
            <div className="flex items-center gap-2 mb-4 border-b border-[#2C2C2C]/5 pb-2">
                <LinkIcon size={16} className="text-[#B48E55]"/>
                <h3 className={cn("text-sm font-bold text-[#2C2C2C] tracking-widest", cinzel.className)}>LINKS</h3>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="block text-[10px] font-bold text-[#2C2C2C]/40 mb-1 ml-1 tracking-widest uppercase">Survey URL</label>
                    <div className="flex items-center gap-3 bg-[#F9F8F2] px-3 py-1 rounded-xl border border-[#2C2C2C]/5">
                    <MessageCircle size={16} className="text-[#2C2C2C]/40 shrink-0"/>
                    <NoZoomInput className="!bg-transparent !px-0 !py-2 border-none focus:ring-0 placeholder:text-[#2C2C2C]/20 !border-0" placeholder="https://forms.google.com/..." value={footerLinks.survey || ""} onChange={(e) => { setFooterLinks({...footerLinks, survey: e.target.value}); setIsEventDirty(true); }} />
                    </div>
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-[#2C2C2C]/40 mb-1 ml-1 tracking-widest uppercase">Donation URL</label>
                    <div className="flex items-center gap-3 bg-[#F9F8F2] px-3 py-1 rounded-xl border border-[#2C2C2C]/5">
                    <Heart size={16} className="text-[#2C2C2C]/40 shrink-0"/>
                    <NoZoomInput className="!bg-transparent !px-0 !py-2 border-none focus:ring-0 placeholder:text-[#2C2C2C]/20 !border-0" placeholder="https://..." value={footerLinks.donation || ""} onChange={(e) => { setFooterLinks({...footerLinks, donation: e.target.value}); setIsEventDirty(true); }} />
                    </div>
                </div>
            </div>
            {isEventDirty && (
                <div className="flex justify-end pt-6">
                <button onClick={saveEventMeta} disabled={loading} className="bg-[#2C2C2C] text-[#F9F8F2] px-6 py-3 rounded-full text-xs font-bold shadow-lg active:scale-95 transition-all hover:bg-[#404040]">設定を保存</button>
                </div>
            )}
        </section>

        {/* BLOCKS (DnD) */}
        <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 mb-2 px-2">
                <Grid size={14} className="text-[#B48E55]"/>
                <span className={cn("text-xs font-bold tracking-widest opacity-50", cinzel.className)}>CONTENTS</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map((b, i) => (
                    <div key={b.id} className="relative">
                        <BlockCard 
                        block={b} index={i} total={blocks.length} 
                        isExpanded={expandedBlockId === b.id}
                        onToggle={() => setExpandedBlockId(expandedBlockId === b.id ? null : b.id)}
                        onSave={saveBlockContent} onDelete={deleteBlock} onMove={moveBlock} supabaseClient={supabase} 
                    />
                    </div>
                ))}
                </SortableContext>
            </DndContext>
        </div>

        {blocks.length === 0 && (
            <div className="text-center py-16 text-[#2C2C2C]/40 bg-white/50 rounded-[2rem] border-2 border-dashed border-[#2C2C2C]/10">
            <p className="text-sm font-bold font-sans tracking-widest">NO CONTENTS</p>
            <p className="text-xs mt-2 font-sans opacity-60">「＋」ボタンで追加してください</p>
            </div>
        )}
        <div className="h-24" />
      </main>

      {/* FAB */}
      <>
        <div className={`fixed inset-0 z-50 bg-[#2C2C2C]/20 backdrop-blur-sm transition-opacity duration-300 ${isAddMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsAddMenuOpen(false)}>
        <div className={`fixed bottom-28 inset-x-4 max-w-xl mx-auto bg-[#F9F8F2]/95 backdrop-blur-md border border-[#2C2C2C]/5 rounded-[2rem] p-6 transition-transform duration-300 shadow-2xl ${isAddMenuOpen ? 'translate-y-0' : 'translate-y-10 opacity-0'}`} onClick={e => e.stopPropagation()}>
            <h3 className="text-center font-bold text-sm mb-6 text-[#2C2C2C]/50 tracking-widest font-sans">ADD CONTENT</h3>
            <div className="grid grid-cols-3 gap-4">
            <AddMenuBtn label="ご挨拶" icon={MessageSquare} color="text-orange-600 bg-orange-50/50 border-orange-100" onClick={() => addBlock("greeting")} />
            <AddMenuBtn label="プログラム" icon={Music} color="text-blue-600 bg-blue-50/50 border-blue-100" onClick={() => addBlock("program")} />
            <AddMenuBtn label="出演者" icon={User} color="text-emerald-600 bg-emerald-50/50 border-emerald-100" onClick={() => addBlock("profile")} />
            <AddMenuBtn label="ギャラリー" icon={Grid} color="text-pink-600 bg-pink-50/50 border-pink-100" onClick={() => addBlock("gallery")} />
            <AddMenuBtn label="フリー" icon={Type} color="text-indigo-600 bg-indigo-50/50 border-indigo-100" onClick={() => addBlock("free")} />
            </div>
        </div>
        </div>
        <button onClick={() => setIsAddMenuOpen(true)} className="fixed bottom-8 right-6 z-40 w-14 h-14 bg-[#2C2C2C] text-[#F9F8F2] rounded-full shadow-xl shadow-[#2C2C2C]/20 flex items-center justify-center transition-transform active:scale-90 hover:scale-105 border border-[#2C2C2C]/5">
        <Plus size={28} />
        </button>
      </>

    </div>
  );
}

// --- SUB COMPONENTS (AddMenuBtn, BlockCard, ProfileEditor, ProgramItemEditor) ---

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl active:scale-95 transition-all hover:bg-white hover:shadow-md border ${color}`}>
      <Icon size={24} />
      <span className="text-[10px] font-bold text-[#2C2C2C]/80 font-sans tracking-wide">{label}</span>
    </button>
  );
}

function BlockCard({ block, index, total, isExpanded, onToggle, onSave, onDelete, onMove, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isExpanded ? 50 : 'auto', position: 'relative' as 'relative' };

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
  const badgeColors: any = { 
    greeting: "text-orange-600 bg-orange-50", 
    program: "text-blue-600 bg-blue-50", 
    profile: "text-emerald-600 bg-emerald-50", 
    gallery: "text-pink-600 bg-pink-50", 
    free: "text-indigo-600 bg-indigo-50" 
  };
  const TypeIcon = { greeting: MessageSquare, program: Music, profile: User, gallery: Grid, free: Type }[block.type as string] || Edit3;

  return (
    <div ref={setNodeRef} style={style} className={`bg-white rounded-[2rem] shadow-sm transition-all duration-300 overflow-hidden border border-[#2C2C2C]/5 ${isExpanded ? 'ring-2 ring-[#B48E55]/20 shadow-xl scale-[1.01] my-4' : 'hover:shadow-md'}`}>
      <div className="flex items-center justify-between p-5 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center gap-4">
           {!isExpanded && (
             <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col gap-0.5 mr-1">
                   <button onClick={() => onMove(block.id, 'up')} disabled={index===0} className="text-[#2C2C2C]/30 hover:text-[#B48E55] disabled:opacity-0 p-0.5 transition-colors"><ArrowUp size={12}/></button>
                   <button onClick={() => onMove(block.id, 'down')} disabled={index===total-1} className="text-[#2C2C2C]/30 hover:text-[#B48E55] disabled:opacity-0 p-0.5 transition-colors"><ArrowDown size={12}/></button>
                </div>
                {/* REMOVED: GripVertical div */}
             </div>
           )}
           
           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${badgeColors[block.type] || 'bg-slate-100'}`}>
             <TypeIcon size={20} />
           </div>
           <div>
             <div className="text-sm font-bold text-[#2C2C2C] font-serif tracking-wide">{labels[block.type]}</div>
             {!isExpanded && <div className="text-[10px] text-[#2C2C2C]/40 truncate max-w-[150px] mt-0.5 font-sans">
                {block.type === 'free' ? content.title : block.type === 'greeting' ? content.author : 'タップして編集'}
             </div>}
           </div>
        </div>
        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#B48E55]' : 'text-[#2C2C2C]/20'}`}><ChevronDown size={20} /></div>
      </div>

      {isExpanded && (
        <div className="p-5 pt-0 animate-in slide-in-from-top-2 cursor-auto" onClick={e => e.stopPropagation()}>
           <div className="py-6 space-y-6 border-t border-[#2C2C2C]/5">
              {block.type === "greeting" && (
                <>
                  <div className="flex gap-4">
                    <div className="relative w-24 h-24 bg-[#F9F8F2] rounded-2xl overflow-hidden shrink-0 border border-[#2C2C2C]/10 group">
                      {content.image ? <img src={content.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-8 text-[#2C2C2C]/20"/>}
                      <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 cursor-pointer transition-colors z-10"><Camera size={20} className="text-white opacity-0 group-hover:opacity-100"/><input type="file" className="hidden" onChange={e => handleUpload(e, 'single')} /></label>
                    </div>
                    <div className="flex-1 space-y-3">
                      <InputField label="お名前"><NoZoomInput placeholder="氏名" value={content.author||""} onChange={e => handleChange({...content, author: e.target.value})} /></InputField>
                      <InputField label="肩書き"><NoZoomInput placeholder="例: 主催者" value={content.role||""} onChange={e => handleChange({...content, role: e.target.value})} /></InputField>
                    </div>
                  </div>
                  <InputField label="挨拶文"><NoZoomTextArea className="h-40" placeholder="本文..." value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} /></InputField>
                </>
              )}
              {block.type === "free" && (
                  <>
                    <InputField label="タイトル"><NoZoomInput placeholder="タイトル" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} /></InputField>
                    <InputField label="本文"><NoZoomTextArea className="h-40" placeholder="本文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} /></InputField>
                  </>
              )}
              {block.type === "gallery" && (
                  <>
                    <InputField label="タイトル"><NoZoomInput placeholder="Memories" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} /></InputField>
                    <div className="grid grid-cols-3 gap-3">
                      {(content.images || (content.url ? [content.url] : [])).map((url:string, i:number) => (
                          <div key={i} className="relative aspect-square bg-[#F9F8F2] rounded-2xl overflow-hidden shadow-sm border border-[#2C2C2C]/5">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                            <button onClick={() => handleChange({...content, images: (content.images||[content.url]).filter((_:any,idx:number)=>idx!==i)})} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1.5"><X size={12}/></button>
                          </div>
                       ))}
                       <label className="aspect-square bg-[#F9F8F2] border-2 border-dashed border-[#2C2C2C]/10 rounded-2xl flex flex-col items-center justify-center text-[#2C2C2C]/20 cursor-pointer hover:bg-white transition-colors"><Plus /><input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'gallery')} /></label>
                    </div>
                    <InputField label="キャプション"><NoZoomInput placeholder="説明..." value={content.caption||""} onChange={e => handleChange({...content, caption: e.target.value})} /></InputField>
                  </>
              )}
              
              {block.type === "profile" && (
                <div className="space-y-4">
                  {(content.people || []).map((p: any, i: number) => (
                    <ProfileEditor key={i} p={p} 
                      onChange={(newP:any) => {const np=[...content.people]; np[i]=newP; handleChange({...content, people:np})}}
                      onDelete={() => handleChange({...content, people: content.people.filter((_:any,idx:number)=>idx!==i)})}
                      onUpload={(e:any) => handleUpload(e, 'profile', i)}
                    />
                  ))}
                  <button onClick={() => handleChange({...content, people: [...(content.people||[]), {name:"",role:"",bio:"",image:"", sns:{}}]})} className="w-full py-4 bg-white border-2 border-dashed border-[#2C2C2C]/10 text-[#2C2C2C]/40 rounded-2xl font-bold text-xs hover:text-[#2C2C2C]/60 transition-colors">+ 出演者を追加</button>
                </div>
              )}

              {block.type === "program" && (
                  <div className="space-y-4">
                    {(content.items || []).map((item: any, i: number) => (
                        <div key={i} className="group relative">
                            {item.type === "section" && (
                              <div className="flex gap-2 items-center mt-6 mb-2">
                                <div className="flex flex-col gap-1 mr-1">
                                   <button onClick={() => {if(i>0){const ni=[...content.items]; [ni[i],ni[i-1]]=[ni[i-1],ni[i]]; handleChange({...content, items:ni})}}} className="p-1 text-[#2C2C2C]/30 hover:text-[#B48E55]"><ArrowUp size={14}/></button>
                                   <button onClick={() => {if(i<content.items.length-1){const ni=[...content.items]; [ni[i],ni[i+1]]=[ni[i+1],ni[i]]; handleChange({...content, items:ni})}}} className="p-1 text-[#2C2C2C]/30 hover:text-[#B48E55]"><ArrowDown size={14}/></button>
                                </div>
                                <div className="flex-1 border-b border-[#2C2C2C]/10"><NoZoomInput className="!bg-transparent !py-2 text-[#2C2C2C] font-bold text-sm !border-none !ring-0 !px-0 font-serif" placeholder="セクション見出し" value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} /></div>
                                <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-2 text-[#2C2C2C]/30 hover:text-red-500"><Trash2 size={16}/></button>
                              </div>
                            )}
                            
                            {item.type === "memo" && (
                              <div className="relative p-3 bg-yellow-50 rounded-xl border border-yellow-100 flex gap-2 items-center">
                                 <div className="flex flex-col gap-1 mr-1">
                                   <button onClick={() => {if(i>0){const ni=[...content.items]; [ni[i],ni[i-1]]=[ni[i-1],ni[i]]; handleChange({...content, items:ni})}}} className="p-0.5 text-yellow-300 hover:text-yellow-600"><ArrowUp size={12}/></button>
                                   <button onClick={() => {if(i<content.items.length-1){const ni=[...content.items]; [ni[i],ni[i+1]]=[ni[i+1],ni[i]]; handleChange({...content, items:ni})}}} className="p-0.5 text-yellow-300 hover:text-yellow-600"><ArrowDown size={12}/></button>
                                 </div>
                                 <NoZoomTextArea className="!h-auto !p-0 !bg-transparent text-sm text-yellow-900 !ring-0 !placeholder-yellow-400/50" rows={1} placeholder="メモを入力..." value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} />
                                 <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-1 text-yellow-400 hover:text-red-500"><X size={14}/></button>
                              </div>
                            )}

                            {(item.type === "song" || item.type === "break") && (
                                <ProgramItemEditor 
                                  item={item} 
                                  index={i} 
                                  total={content.items.length}
                                  onChange={(newItem:any) => {const ni=[...content.items]; ni[i]=newItem; handleChange({...content, items:ni})}}
                                  onDelete={() => {const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni})}}
                                  onMove={(dir: 'up'|'down') => {
                                     const ni=[...content.items];
                                     const to = dir==='up' ? i-1 : i+1;
                                     if(to>=0 && to<ni.length) { [ni[i],ni[to]]=[ni[to],ni[i]]; handleChange({...content, items:ni}); }
                                  }}
                                />
                            )}
                        </div>
                    ))}
                    
                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"song",title:"",composer:"",performer:"",description:"",isEncore:false}]})} className="py-3 bg-[#B48E55]/10 text-[#B48E55] font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-[#B48E55]/20 font-sans tracking-wide">+ 曲</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"break",title:"休憩",duration:"15分"}]})} className="py-3 bg-[#F9F8F2] text-[#2C2C2C]/60 font-bold rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-[#E5E5E5]">+ 休憩</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"section",title:"新しいセクション"}]})} className="py-3 bg-white border border-[#2C2C2C]/10 text-[#2C2C2C]/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2">+ 見出し</button>
                      <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"memo",title:""}]})} className="py-3 bg-white border border-[#2C2C2C]/10 text-[#2C2C2C]/40 font-bold rounded-xl text-xs flex items-center justify-center gap-2">+ メモ</button>
                    </div>
                  </div>
              )}
           </div>
           
           <div className="flex items-center justify-between pt-4 border-t border-[#2C2C2C]/5">
             <button onClick={() => onDelete(block.id)} className="text-red-400 hover:text-red-600 p-2 text-xs font-bold flex items-center gap-1"><Trash2 size={16}/> 削除</button>
             {isDirty && (<button onClick={handleSave} disabled={saving} className="bg-[#2C2C2C] text-[#F9F8F2] px-6 py-3 rounded-full font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-all hover:bg-[#404040]">{saving ? <Loader2 className="animate-spin" size={18}/> : <Save size={18}/>} 保存</button>)}
           </div>
        </div>
      )}
    </div>
  );
}

function ProfileEditor({ p, onChange, onDelete, onUpload }: any) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#F9F8F2] rounded-2xl border border-[#2C2C2C]/5 overflow-hidden">
       <div className="flex items-center gap-3 p-3 bg-white cursor-pointer select-none" onClick={() => setOpen(!open)}>
          <div className="w-10 h-10 rounded-full bg-[#F9F8F2] overflow-hidden border border-[#2C2C2C]/5 shrink-0">
             {p.image ? <img src={p.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-2 text-[#2C2C2C]/20" size={20}/>}
          </div>
          <div className="flex-1 min-w-0">
             <div className="text-sm font-bold truncate text-[#2C2C2C] font-serif">{p.name || "名称未設定"}</div>
             {!open && <div className="text-[10px] text-[#2C2C2C]/40 truncate font-sans">{p.role}</div>}
          </div>
          <ChevronDown size={16} className={`text-[#2C2C2C]/20 transition-transform ${open?'rotate-180':''}`}/>
       </div>

       {open && (
         <div className="p-4 space-y-4 border-t border-[#2C2C2C]/5 animate-in slide-in-from-top-1">
            <div className="flex gap-4">
               <div className="relative w-20 h-20 bg-white rounded-xl border border-[#2C2C2C]/10 shrink-0 group">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover rounded-xl" alt=""/> : <User className="m-auto mt-6 text-[#2C2C2C]/20"/>}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 cursor-pointer z-10"><Upload size={16} className="text-white opacity-0 group-hover:opacity-100"/><input type="file" className="hidden" onChange={onUpload} /></label>
               </div>
               <div className="flex-1 space-y-2">
                  <InputField label="名前"><NoZoomInput placeholder="氏名" value={p.name} onChange={e => onChange({...p, name: e.target.value})} /></InputField>
                  <InputField label="役割"><NoZoomInput placeholder="例: Violin" value={p.role} onChange={e => onChange({...p, role: e.target.value})} /></InputField>
               </div>
            </div>
            
            <div className="space-y-2">
               <label className="text-[10px] font-bold text-[#2C2C2C]/40 font-sans tracking-widest">SNS LINK</label>
               <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-[#2C2C2C]/5">
                  <span className="text-xs font-bold text-[#2C2C2C]/40 w-4">X</span>
                  <NoZoomInput className="!bg-transparent !py-1.5 !px-0 !border-none !ring-0 text-xs !border-0" placeholder="https://x.com/..." value={p.sns?.twitter||""} onChange={e=>onChange({...p, sns:{...p.sns, twitter:e.target.value}})}/>
               </div>
               <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-[#2C2C2C]/5">
                  <Instagram size={14} className="text-[#2C2C2C]/40 w-4"/>
                  <NoZoomInput className="!bg-transparent !py-1.5 !px-0 !border-none !ring-0 text-xs !border-0" placeholder="https://instagram.com/..." value={p.sns?.instagram||""} onChange={e=>onChange({...p, sns:{...p.sns, instagram:e.target.value}})}/>
               </div>
               <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border border-[#2C2C2C]/5">
                  <Globe size={14} className="text-[#2C2C2C]/40 w-4"/>
                  <NoZoomInput className="!bg-transparent !py-1.5 !px-0 !border-none !ring-0 text-xs !border-0" placeholder="https://..." value={p.sns?.website||""} onChange={e=>onChange({...p, sns:{...p.sns, website:e.target.value}})}/>
               </div>
            </div>

            <InputField label="プロフィール本文">
               <NoZoomTextArea className="h-24 bg-white" placeholder="経歴などを入力..." value={p.bio} onChange={e => onChange({...p, bio: e.target.value})} />
            </InputField>
            
            <div className="flex justify-end">
               <button onClick={onDelete} className="text-red-400 text-xs font-bold flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded"><Trash2 size={14}/> 削除</button>
            </div>
         </div>
       )}
    </div>
  );
}

function ProgramItemEditor({ item, index, total, onChange, onDelete, onMove }: any) {
  const [open, setOpen] = useState(false);
  const isBreak = item.type === "break";

  return (
    <div className={`bg-[#F9F8F2] rounded-2xl border border-[#2C2C2C]/5 overflow-hidden ${item.isEncore ? 'ring-2 ring-pink-100 bg-pink-50/20' : ''}`}>
       <div className="flex items-center p-3 gap-3 bg-white cursor-pointer select-none" onClick={() => setOpen(!open)}>
          <div className="flex flex-col gap-0.5" onClick={e=>e.stopPropagation()}>
             <button onClick={() => onMove('up')} disabled={index===0} className="text-[#2C2C2C]/20 hover:text-[#B48E55] disabled:opacity-0 p-0.5"><ArrowUp size={12}/></button>
             <button onClick={() => onMove('down')} disabled={index===total-1} className="text-[#2C2C2C]/20 hover:text-[#B48E55] disabled:opacity-0 p-0.5"><ArrowDown size={12}/></button>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#F9F8F2] flex items-center justify-center shrink-0 text-[#2C2C2C]/40">
             {isBreak ? <Coffee size={16}/> : <Music size={16}/>}
          </div>
          <div className="flex-1 min-w-0">
             <div className="text-sm font-bold truncate text-[#2C2C2C] font-serif">{item.title || (isBreak ? "休憩" : "曲名未設定")}</div>
             <div className="text-[10px] text-[#2C2C2C]/40 truncate font-sans">{isBreak ? item.duration : item.composer}</div>
          </div>
          {item.isEncore && <Star size={14} className="text-pink-400 fill-pink-400"/>}
          <ChevronDown size={16} className={`text-[#2C2C2C]/20 transition-transform ${open?'rotate-180':''}`}/>
       </div>

       {open && (
         <div className="p-4 space-y-4 border-t border-[#2C2C2C]/5 animate-in slide-in-from-top-1">
            <div className="flex gap-2">
                <div className="flex-1">
                   <InputField label={isBreak ? "休憩名" : "曲名"}>
                      <NoZoomInput className="bg-white font-bold" placeholder={isBreak?"休憩":"曲タイトル"} value={item.title} onChange={e => onChange({...item, title:e.target.value})} />
                   </InputField>
                </div>
            </div>
            
            {isBreak ? (
                <InputField label="目安時間"><NoZoomInput className="bg-white" placeholder="例: 15分" value={item.duration} onChange={e => onChange({...item, duration:e.target.value})} /></InputField>
            ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                      <InputField label="作曲者"><NoZoomInput className="bg-white" placeholder="Artist" value={item.composer} onChange={e => onChange({...item, composer:e.target.value})} /></InputField>
                      <InputField label="演奏者"><NoZoomInput className="bg-white" placeholder="Performer" value={item.performer||""} onChange={e => onChange({...item, performer:e.target.value})} /></InputField>
                  </div>
                  <InputField label="曲解説"><NoZoomTextArea className="bg-white h-24" placeholder="解説..." value={item.description} onChange={e => onChange({...item, description:e.target.value})} /></InputField>
                  
                  <div className="flex justify-between items-center pt-2">
                      <button onClick={() => onChange({...item, isEncore: !item.isEncore})} className={`flex items-center gap-1 px-3 py-1.5 rounded-full border transition-all text-xs font-bold ${item.isEncore ? 'bg-pink-50 border-pink-200 text-pink-600' : 'bg-white border-[#2C2C2C]/10 text-[#2C2C2C]/40 grayscale'}`}>
                         <Star size={14} fill={item.isEncore ? "currentColor" : "none"} /> アンコール
                      </button>
                      <button onClick={onDelete} className="text-red-400 text-xs font-bold flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded"><Trash2 size={14}/> 削除</button>
                  </div>
                </>
            )}
            {isBreak && (
                <div className="flex justify-end">
                   <button onClick={onDelete} className="text-red-400 text-xs font-bold flex items-center gap-1 px-2 py-1 hover:bg-red-50 rounded"><Trash2 size={14}/> 削除</button>
                </div>
            )}
         </div>
       )}
    </div>
  );
}