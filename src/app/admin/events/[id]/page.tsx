"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import {
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Plus,
  User,
  Music,
  MessageSquare,
  GripVertical,
  Loader2,
  Image as ImageIcon,
  Eye,
  Camera,
  Upload,
  Coffee,
  Play,
  Pause,
  Zap,
  Lock,
  Unlock,
  Edit3,
  MonitorPlay,
  Share2,
  Info,
  Grid,
  X,
  Clock,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles
} from "lucide-react";

// Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { params: Promise<{ id: string }> };
type Tab = "edit" | "live";

export default function EventEdit({ params }: Props) {
  const { id } = use(params);

  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("edit");
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Cover Image
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  // Live Mode
  const [encoreRevealed, setEncoreRevealed] = useState(false);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null); // For UI effect only

  // UI State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Show toast message with nicer UI
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
    setIsCoverDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);

    const { data: b, error: e2 } = await supabase.from("blocks").select("*").eq("event_id", id).order("sort_order", { ascending: true });
    if (!e2) setBlocks(b ?? []);
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
      setIsCoverDirty(true);
    } catch (err: any) { showMsg("アップロードに失敗しました", true); }
    finally { setUploadingCover(false); }
  }

  async function saveCoverImage() {
    if (!isCoverDirty) return;
    setLoading(true);
    const { error } = await supabase.from("events").update({ cover_image: coverImageDraft }).eq("id", id);
    if (error) showMsg("保存できませんでした", true);
    else {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft }));
      setIsCoverDirty(false);
      showMsg("カバー画像を保存しました✨");
    }
    setLoading(false);
  }

  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);
    await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
    showMsg(next ? "アンコールを公開しました🎉" : "アンコールを非公開にしました🔒");
  }

  async function toggleActiveItem(blockId: string, itemIndex: number) {
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;
    const items = target.content.items;
    const isCurrentlyActive = items[itemIndex]?.active === true;
    
    // UI effect
    if (!isCurrentlyActive) setPlayingItemId(`${blockId}-${itemIndex}`);
    else setPlayingItemId(null);

    const newItems = items.map((it: any, idx: number) => ({ ...it, active: idx === itemIndex ? !isCurrentlyActive : false }));
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b)));
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", blockId);
  }

  async function startBreakTimer(blockId: string, itemIndex: number, minutes: number) {
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;
    const end = new Date(Date.now() + minutes * 60000).toISOString();
    const newItems = [...target.content.items];
    newItems[itemIndex] = { ...newItems[itemIndex], timerEnd: end };
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b)));
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", blockId);
    showMsg(`${minutes}分の休憩タイマーを開始しました⏳`);
  }

  function nextSortOrder() {
    const max = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    return max + 10;
  }

  async function addBlock(type: string) {
    setIsAddMenuOpen(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    let content = {};
    if (type === "greeting") content = { text: "", author: "", role: "", image: "" };
    if (type === "program") content = { items: [{ type: "song", title: "", composer: "", description: "" }] };
    if (type === "profile") content = { people: [{ name: "", role: "", bio: "", image: "" }] };
    if (type === "gallery") content = { title: "", images: [], caption: "" };
    if (type === "free") content = { title: "", text: "" };
    const { error } = await supabase.from("blocks").insert({ event_id: id, owner_id: u.user.id, type, sort_order: nextSortOrder(), content });
    if (error) showMsg("追加できませんでした", true);
    else {
      await load();
      // Scroll to bottom
      setTimeout(() => pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
    }
  }

  async function saveBlockContent(blockId: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    const { error } = await supabase.from("blocks").update({ content }).eq("id", blockId);
    if (error) throw error;
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("本当に削除しますか？この操作は取り消せません。")) return;
    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (!error) {
       setBlocks((prev) => prev.filter((b) => b.id !== blockId));
       showMsg("ブロックを削除しました🗑️");
    }
  }

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

  if (!event) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-zinc-400" /></div>;

  const displayCover = coverImageDraft ?? event.cover_image;
  const viewerUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${event.slug}` : '';

  return (
    <div className="min-h-screen bg-[#F2F2F7] font-sans text-zinc-900 pb-32 md:pb-24" ref={pageRef}>
      {/* HEADER (Glassmorphism) */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-zinc-200/50 px-4 py-3 flex justify-between items-center">
        <h1 className="text-sm font-bold truncate max-w-[200px] opacity-80">{event.title}</h1>
        <div className="flex gap-3 items-center">
           <button onClick={() => setShowShareModal(true)} className="p-2 bg-zinc-100 text-zinc-600 hover:bg-zinc-200 rounded-full transition-colors active:scale-95">
             <Share2 size={20}/>
           </button>
           <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-black text-white rounded-full shadow-lg active:scale-95 transition-transform hover:bg-zinc-800">
             <Eye size={20} />
           </Link>
        </div>
      </header>

      {/* TOAST MESSAGE */}
      <div className={`fixed top-16 inset-x-0 flex justify-center pointer-events-none z-50 transition-all duration-300 ${msg ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {msg && (
          <div className={`px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 backdrop-blur-md ${msg.isError ? 'bg-red-500/90 text-white' : 'bg-black/80 text-white'}`}>
            {msg.isError ? <AlertCircle size={16}/> : <CheckCircle2 size={16}/>}
            {msg.text}
          </div>
        )}
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowShareModal(false)}>
           <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center space-y-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="space-y-2">
                <h3 className="font-bold text-xl">プログラムを配布</h3>
                <p className="text-xs text-zinc-500">観客の皆様にこのQRコードを読み取ってもらいましょう。</p>
              </div>
              <div className="bg-white p-4 border rounded-3xl inline-block shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(viewerUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <div className="bg-zinc-100 p-3 rounded-xl text-xs break-all select-all font-mono text-zinc-600">
                {viewerUrl}
              </div>
              <button className="w-full py-3.5 bg-zinc-900 text-white font-bold rounded-2xl active:scale-95 transition-transform" onClick={() => setShowShareModal(false)}>閉じる</button>
           </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* --- TAB: EDIT --- */}
        {activeTab === "edit" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Hero Section (カッコいい導入部) */}
            <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-zinc-800 to-black text-white p-6 shadow-xl">
              <div className="absolute top-0 right-0 -mt-8 -mr-8 text-white/5">
                <Sparkles size={120} />
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider mb-3 backdrop-blur-md">
                  <Edit3 size={10} /> パンフレット編集中
                </div>
                <h2 className="text-2xl font-bold leading-tight mb-1">{event.title}</h2>
                <p className="text-xs text-white/70 flex items-center gap-2">
                  <span>{blocks.length}個のブロック</span>
                  <span className="w-1 h-1 rounded-full bg-white/30"/>
                  <span>{event.date || '日付未設定'}</span>
                </p>
              </div>
            </section>

            {/* Cover Image Editor */}
            <section className="bg-white rounded-[2rem] overflow-hidden shadow-sm ring-1 ring-black/5">
               <div className="px-5 py-3 border-b border-zinc-100 flex justify-between items-center">
                 <h3 className="text-sm font-bold text-zinc-700 flex items-center gap-2"><ImageIcon size={16} className="text-indigo-500"/>表紙画像</h3>
                 {isCoverDirty && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full animate-pulse">未保存</span>}
               </div>
               <div className="relative aspect-[16/9] bg-zinc-50 group">
                 {displayCover ? (
                    <img src={displayCover} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" alt="" />
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-zinc-300 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGgyMHYyMEgweiIgZmlsbD0iI2YwZjBmMCIvPjxwYXRoIGQ9Ik0wIDBoMTB2MTBIMHoiIGZpbGw9IiNlN2U3ZTciLz48cGF0aCBkPSJNMTAgMTBoMTB2MTBIMTB6IiBmaWxpPSIjZTdlN2U3Ii8+PC9zdmc+')] bg-repeat opacity-50">
                      <ImageIcon size={40} className="mb-2 text-zinc-400"/>
                      <span className="text-xs font-bold text-zinc-400">画像が設定されていません</span>
                    </div>
                 )}
                 <label className="absolute bottom-4 right-4 cursor-pointer">
                    <div className="bg-black/80 hover:bg-black text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 backdrop-blur-md transition-all active:scale-95">
                      {uploadingCover ? <Loader2 className="animate-spin" size={16}/> : <Camera size={16}/>}
                      写真を変更
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                 </label>
               </div>
               {isCoverDirty && (
                 <div className="p-4 bg-orange-50/50 flex justify-end animate-in slide-in-from-top-2">
                   <button onClick={saveCoverImage} disabled={loading} className="bg-black text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-md active:scale-95 transition-transform flex items-center gap-2">
                     {loading ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                     表紙を保存
                   </button>
                 </div>
               )}
            </section>

            {/* Block List */}
            <div className="space-y-5">
               {blocks.map((b, i) => (
                  <BlockEditor key={b.id} block={b} index={i} total={blocks.length} onSave={saveBlockContent} onMove={moveBlock} onDelete={deleteBlock} supabaseClient={supabase} />
               ))}
            </div>
            
            {/* Empty State */}
            {blocks.length === 0 && (
              <div className="text-center py-16 border-2 border-dashed border-zinc-300/50 rounded-[2rem] text-zinc-400 bg-white/50">
                <Plus size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-bold mb-1">コンテンツがありません</p>
                <p className="text-xs">右下のボタンから追加しましょう</p>
              </div>
            )}
            <div className="h-24" />
          </div>
        )}

        {/* --- TAB: LIVE --- */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Encore Control (Big Toggle) */}
            <section className="bg-white rounded-[2rem] p-6 border shadow-sm text-center ring-1 ring-black/5">
              <div className="flex items-center justify-center gap-2 text-lg font-bold mb-6 text-zinc-700">
                <Sparkles className="text-yellow-500" size={20} /> アンコール管理
              </div>
              <button
                onClick={toggleEncore}
                className={`relative w-full py-6 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-md overflow-hidden transition-all duration-500 ${
                  encoreRevealed ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {/* 背景エフェクト */}
                {encoreRevealed && <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>}
                <div className={`p-2 rounded-full bg-white/20 transition-transform ${encoreRevealed ? 'rotate-0' : '-rotate-12'}`}>
                  {encoreRevealed ? <Unlock size={24} /> : <Lock size={24} />}
                </div>
                <span>{encoreRevealed ? "公開中" : "非公開"}</span>
              </button>
              <p className="text-xs text-zinc-400 mt-4">本番のアンコール時に「公開中」に切り替えてください。</p>
            </section>

            {/* Program Control (Music App Style) */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2"><Music className="text-blue-500" size={20}/><h2 className="font-bold text-lg">演奏コントロール</h2></div>
              {blocks.filter(b => b.type === "program").map(block => (
                <div key={block.id} className="bg-white rounded-[2rem] border shadow-sm ring-1 ring-black/5 overflow-hidden">
                  <div className="bg-zinc-50/80 backdrop-blur border-b px-5 py-3 text-xs font-bold text-zinc-400 uppercase tracking-wider sticky top-0 z-10">Program List</div>
                  <div className="divide-y divide-zinc-100">
                  {block.content.items?.map((item: any, i: number) => {
                     const isBreak = item.type === "break";
                     const isActive = item.active === true;
                     const itemId = `${block.id}-${i}`;
                     const isPlayingUI = playingItemId === itemId;

                     return (
                       <div key={i} className={`p-4 transition-colors ${isActive ? 'bg-blue-50/50' : 'hover:bg-zinc-50'}`}>
                         <div className="flex items-center gap-4">
                           {!isBreak ? (
                             <button onClick={() => toggleActiveItem(block.id, i)} className="relative group">
                               <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${isActive ? 'bg-blue-500 text-white shadow-blue-200 scale-105' : 'bg-zinc-100 text-zinc-400 group-hover:bg-zinc-200'}`}>
                                 {isActive ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" className="ml-1" size={20}/>}
                               </div>
                               {/* 波形アニメーション（再生時） */}
                               {isActive && (
                                 <div className="absolute inset-0 rounded-full animate-ping bg-blue-500 opacity-30 -z-10"></div>
                               )}
                             </button>
                           ) : (
                             <div className="w-14 h-14 flex items-center justify-center text-zinc-300 bg-zinc-50 rounded-full"><Coffee size={24} /></div>
                           )}
                           
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2">
                                {isActive && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span></span>}
                                <div className={`font-bold text-base truncate ${isActive ? 'text-blue-900' : 'text-zinc-900'} ${isBreak?'opacity-60':''}`}>{item.title}</div>
                             </div>
                             {!isBreak && <div className="text-xs text-zinc-500 truncate mt-0.5">{item.composer}</div>}
                             
                             {/* 休憩タイマー操作 (チップ型ボタン) */}
                             {isBreak && (
                               <div className="mt-3 flex gap-2">
                                 <button onClick={() => startBreakTimer(block.id, i, 15)} className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-full flex items-center gap-1 transition-colors active:scale-95"><Clock size={14}/> 15分タイマー</button>
                                 <button onClick={() => startBreakTimer(block.id, i, 20)} className="px-4 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold rounded-full flex items-center gap-1 transition-colors active:scale-95"><Clock size={14}/> 20分タイマー</button>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     )
                  })}
                  </div>
                </div>
              ))}
            </div>
            <div className="h-24" />
          </div>
        )}
      </main>

      {/* --- FAB & BOTTOM SHEET MENU --- */}
      {activeTab === "edit" && (
        <>
          <div className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isAddMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsAddMenuOpen(false)}>
            <div className={`fixed bottom-0 inset-x-0 bg-white rounded-t-[2rem] p-6 pb-safe transition-transform duration-300 ease-out ${isAddMenuOpen ? 'translate-y-0' : 'translate-y-full'}`} onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-zinc-200 rounded-full mx-auto mb-6"></div>
              <h3 className="text-center font-bold text-lg mb-6 text-zinc-800">コンテンツを追加</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <AddMenuBtn label="ご挨拶" icon={MessageSquare} color="text-orange-500 bg-orange-50" onClick={() => addBlock("greeting")} />
                <AddMenuBtn label="プログラム" icon={Music} color="text-blue-500 bg-blue-50" onClick={() => addBlock("program")} />
                <AddMenuBtn label="出演者" icon={User} color="text-green-500 bg-green-50" onClick={() => addBlock("profile")} />
                <AddMenuBtn label="ギャラリー" icon={Grid} color="text-pink-500 bg-pink-50" onClick={() => addBlock("gallery")} />
                <AddMenuBtn label="お知らせ" icon={Info} color="text-indigo-500 bg-indigo-50" onClick={() => addBlock("free")} />
              </div>
              <button className="w-full py-4 bg-zinc-100 text-zinc-500 font-bold rounded-2xl mt-2 active:scale-95" onClick={() => setIsAddMenuOpen(false)}>キャンセル</button>
            </div>
          </div>
          
          <button onClick={() => setIsAddMenuOpen(true)} className="fixed bottom-24 right-6 z-40 w-16 h-16 bg-black text-white rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 hover:scale-105 hover:bg-zinc-800">
            <Plus size={32} />
          </button>
        </>
      )}

      {/* --- BOTTOM NAVIGATION (iOS Style) --- */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-xl border-t border-zinc-200 pb-safe flex justify-around items-center h-[3.5rem] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavBtn active={activeTab === "edit"} onClick={() => setActiveTab("edit")} icon={Edit3} label="編集" activeColor="text-black" />
        <NavBtn active={activeTab === "live"} onClick={() => setActiveTab("live")} icon={MonitorPlay} label="本番" activeColor="text-red-600" />
      </nav>

    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon: Icon, label, activeColor }: any) {
  return (
    <button onClick={onClick} className={`relative flex flex-col items-center justify-center w-full h-full transition-colors ${active ? activeColor : 'text-zinc-400'}`}>
      <Icon size={26} strokeWidth={active? 2.5 : 2} className={`transition-transform ${active ? 'scale-110' : 'scale-100'}`} />
      <span className="text-[10px] font-bold mt-0.5">{label}</span>
      {/* Active Indicator */}
      {active && <div className={`absolute top-0 inset-x-0 h-0.5 rounded-full ${activeColor.replace('text', 'bg')}`}></div>}
    </button>
  );
}

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-3 p-4 rounded-3xl active:scale-95 transition-transform hover:bg-zinc-50 border border-transparent hover:border-zinc-200 ${color}`}>
      <Icon size={28} />
      <span className="text-xs font-bold text-zinc-700">{label}</span>
    </button>
  );
}

// Block Editor Component (Card Style)
function BlockEditor({ block, index, total, onSave, onMove, onDelete, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setContent(block.content ?? {}); setIsDirty(false); }, [block.id]);
  const handleChange = (nc: any) => { setContent(nc); setIsDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(block.id, content); setIsDirty(false); } catch { alert("エラー"); } finally { setSaving(false); }
  };

  const handleUpload = async (e: any, target: 'single' | 'gallery' | 'profile', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
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
    } catch { alert("アップロード失敗"); } finally { setUploading(false); }
  };

  const iconMap: any = { greeting: MessageSquare, program: Music, profile: User, gallery: Grid, free: Info };
  const TypeIcon = iconMap[block.type] || Edit3;
  const labels: any = { greeting: "ご挨拶", program: "プログラム", profile: "出演者", gallery: "ギャラリー", free: "お知らせ" };
  
  // カラーバッジのスタイル定義（ダサくないやつ）
  const badgeStyles: any = {
    greeting: "bg-orange-100 text-orange-600",
    program: "bg-blue-100 text-blue-600",
    profile: "bg-green-100 text-green-600",
    gallery: "bg-pink-100 text-pink-600",
    free: "bg-indigo-100 text-indigo-600",
  };
  const badgeStyle = badgeStyles[block.type] || "bg-zinc-100 text-zinc-600";

  return (
    <div className={`bg-white rounded-[2rem] border shadow-sm transition-all ring-1 ${isDirty ? 'ring-black border-transparent shadow-md' : 'ring-black/5 border-transparent'}`}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 bg-zinc-50/80 rounded-t-[2rem]">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${badgeStyle}`}><TypeIcon size={18} /></div>
          <span className="text-sm font-bold text-zinc-700">{labels[block.type]}</span>
        </div>
        <div className="flex items-center bg-white rounded-full border shadow-sm p-0.5">
           <button onClick={() => onMove(block.id, "up")} disabled={index===0} className="p-2 text-zinc-400 hover:text-black disabled:opacity-20 hover:bg-zinc-50 rounded-full transition-colors"><ArrowUp size={18}/></button>
           <button onClick={() => onMove(block.id, "down")} disabled={index===total-1} className="p-2 text-zinc-400 hover:text-black disabled:opacity-20 hover:bg-zinc-50 rounded-full transition-colors"><ArrowDown size={18}/></button>
           <div className="w-px h-4 bg-zinc-200 mx-1"/>
           <button onClick={() => onDelete(block.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18}/></button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* --- Greeting --- */}
        {block.type === "greeting" && (
          <>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative w-24 h-32 bg-zinc-100 rounded-xl overflow-hidden shrink-0 group ring-1 ring-black/5">
                {content.image ? <img src={content.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-10 text-zinc-300"/>}
                <label className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center cursor-pointer transition-all"><Camera className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={20}/><input type="file" className="hidden" onChange={e => handleUpload(e, 'single')} /></label>
              </div>
              <div className="flex-1 space-y-3">
                <input className="w-full text-base bg-zinc-100 p-3 rounded-xl border-0 focus:ring-2 focus:ring-black transition-shadow" placeholder="お名前 (例: 山田 太郎)" value={content.author||""} onChange={e => handleChange({...content, author: e.target.value})} />
                <input className="w-full text-sm bg-zinc-100 p-3 rounded-xl border-0 focus:ring-2 focus:ring-black transition-shadow" placeholder="肩書き (例: 主催)" value={content.role||""} onChange={e => handleChange({...content, role: e.target.value})} />
              </div>
            </div>
            <textarea className="w-full min-h-[150px] text-base bg-zinc-100 p-4 rounded-xl border-0 focus:ring-2 focus:ring-black transition-shadow resize-none" placeholder="ここに挨拶文を入力してください..." value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
          </>
        )}

        {/* --- Free Topic --- */}
        {block.type === "free" && (
           <>
             <input className="w-full text-lg font-bold bg-zinc-100 p-4 rounded-xl border-0 focus:ring-2 focus:ring-black" placeholder="タイトル (例: お知らせ)" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
             <textarea className="w-full min-h-[120px] text-base bg-zinc-100 p-4 rounded-xl border-0 focus:ring-2 focus:ring-black resize-none" placeholder="本文を入力..." value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
           </>
        )}

        {/* --- Gallery --- */}
        {block.type === "gallery" && (
           <>
             <input className="w-full text-lg font-bold bg-zinc-100 p-4 rounded-xl border-0 focus:ring-2 focus:ring-black" placeholder="ギャラリーのタイトル (任意)" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
             <div className="grid grid-cols-3 gap-3">
                {(content.images || (content.url ? [content.url] : [])).map((url:string, i:number) => (
                   <div key={i} className="relative aspect-square bg-zinc-100 rounded-xl overflow-hidden group shadow-sm ring-1 ring-black/5">
                     <img src={url} className="w-full h-full object-cover" alt="" />
                     <button onClick={() => { const ni = (content.images || [content.url]).filter((_:any, idx:number) => idx !== i); handleChange({...content, images: ni}); }} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1.5 shadow-sm active:scale-90"><X size={14}/></button>
                   </div>
                ))}
                <label className="aspect-square bg-zinc-50 border-2 border-dashed border-zinc-200 rounded-xl flex flex-col items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-100 hover:border-zinc-300 transition-colors">
                   {uploading ? <Loader2 className="animate-spin"/> : <Plus size={24} />}
                   <span className="text-xs font-bold mt-2">写真を追加</span>
                   <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'gallery')} />
                </label>
             </div>
             <input className="w-full text-sm bg-zinc-100 p-3 rounded-xl border-0 focus:ring-2 focus:ring-black" placeholder="キャプション (任意)" value={content.caption||""} onChange={e => handleChange({...content, caption: e.target.value})} />
           </>
        )}

        {/* --- Profile --- */}
        {block.type === "profile" && (
          <div className="space-y-4">
            {(content.people || []).map((p: any, i: number) => (
              <div key={i} className="flex gap-4 items-start border bg-zinc-50/50 p-3 rounded-2xl relative group/item">
                <div className="relative w-20 h-20 bg-zinc-100 rounded-2xl overflow-hidden shrink-0 group/img ring-1 ring-black/5 shadow-sm">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-6 text-zinc-300" size={32}/>}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 cursor-pointer transition-all"><Camera className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" size={20}/><input type="file" className="hidden" onChange={e => handleUpload(e, 'profile', i)} /></label>
                </div>
                <div className="flex-1 space-y-3">
                  <input className="w-full bg-white rounded-xl px-3 py-2 text-base font-bold border focus:ring-2 focus:ring-black" placeholder="お名前" value={p.name} onChange={e => { const np=[...content.people]; np[i].name=e.target.value; handleChange({...content, people:np}); }} />
                  <input className="w-full bg-white rounded-xl px-3 py-2 text-sm border focus:ring-2 focus:ring-black" placeholder="役割 (例: Pf, Vn)" value={p.role} onChange={e => { const np=[...content.people]; np[i].role=e.target.value; handleChange({...content, people:np}); }} />
                  <textarea className="w-full bg-white rounded-xl px-3 py-2 text-sm h-24 resize-none border focus:ring-2 focus:ring-black" placeholder="プロフィール文" value={p.bio} onChange={e => { const np=[...content.people]; np[i].bio=e.target.value; handleChange({...content, people:np}); }} />
                </div>
                <button onClick={() => { const np=content.people.filter((_:any,idx:number)=>idx!==i); handleChange({...content, people:np}); }} className="absolute top-3 right-3 text-zinc-300 hover:text-red-500 p-1.5 bg-white rounded-full shadow-sm opacity-0 group-hover/item:opacity-100 transition-opacity"><Trash2 size={16}/></button>
              </div>
            ))}
            <button onClick={() => handleChange({...content, people: [...(content.people||[]), {name:"",role:"",bio:"",image:""}]})} className="w-full py-3 bg-zinc-100 text-zinc-500 rounded-2xl font-bold hover:bg-zinc-200 transition-colors active:scale-95">+ 出演者を追加する</button>
          </div>
        )}

        {/* --- Program --- */}
        {block.type === "program" && (
           <div className="space-y-3">
             {(content.items || []).map((item: any, i: number) => {
               const isBreak = item.type === "break";
               return (
                 <div key={i} className="flex gap-3 items-start border p-3 rounded-2xl bg-zinc-50/50 relative group/item">
                   <div className="pt-3 text-zinc-300 cursor-grab active:cursor-grabbing"><GripVertical size={18}/></div>
                   <div className="flex-1 space-y-3">
                     <div className="flex gap-3">
                        <input className="flex-1 bg-white border rounded-xl px-3 py-2 font-bold text-base focus:ring-2 focus:ring-black" placeholder={isBreak?"休憩のタイトル":"曲名"} value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} />
                        {!isBreak && <button onClick={() => { const ni=[...content.items]; ni[i].isEncore=!ni[i].isEncore; handleChange({...content, items:ni}); }} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${item.isEncore?'bg-pink-500 text-white shadow-sm':'bg-zinc-100 text-zinc-400'}`}>Encore</button>}
                     </div>
                     {isBreak ? (
                        <input className="w-full bg-white border rounded-xl px-3 py-2 text-base text-zinc-500" placeholder="時間 (例: 15分)" value={item.duration} onChange={e => { const ni=[...content.items]; ni[i].duration=e.target.value; handleChange({...content, items:ni}); }} />
                     ) : (
                       <>
                         <input className="w-full bg-white border rounded-xl px-3 py-2 text-base text-zinc-500" placeholder="作曲者" value={item.composer} onChange={e => { const ni=[...content.items]; ni[i].composer=e.target.value; handleChange({...content, items:ni}); }} />
                         <textarea className="w-full bg-white border rounded-xl px-3 py-2 text-sm h-20 resize-none" placeholder="曲の解説" value={item.description} onChange={e => { const ni=[...content.items]; ni[i].description=e.target.value; handleChange({...content, items:ni}); }} />
                       </>
                     )}
                     <div className="absolute top-3 right-3 opacity-0 group-hover/item:opacity-100 transition-opacity"><button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-1.5 bg-white rounded-full shadow-sm text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button></div>
                   </div>
                 </div>
               )
             })}
             <div className="flex gap-3 pt-2">
               <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"song",title:"",composer:"",description:"",isEncore:false}]})} className="flex-1 py-3 bg-blue-50 text-blue-600 font-bold rounded-2xl hover:bg-blue-100 transition-colors active:scale-95">+ 曲を追加</button>
               <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"break",title:"休憩",duration:"15分"}]})} className="flex-1 py-3 bg-zinc-100 text-zinc-500 font-bold rounded-2xl hover:bg-zinc-200 transition-colors active:scale-95">+ 休憩を追加</button>
             </div>
           </div>
        )}
      </div>

      {isDirty && (
        <div className="p-4 border-t bg-zinc-50 rounded-b-[2rem] flex justify-end animate-in slide-in-from-bottom-2">
           <button onClick={handleSave} disabled={saving} className="bg-black text-white px-6 py-3 rounded-full font-bold shadow-lg active:scale-95 transition-transform flex items-center gap-2">
             {saving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>}
             {saving ? "保存中..." : "このブロックを保存"}
           </button>
        </div>
      )}
    </div>
  );
}