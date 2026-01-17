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
  QrCode
} from "lucide-react";

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

  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Cover Image
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  // Live Mode
  const [encoreRevealed, setEncoreRevealed] = useState(false);

  // UI State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function showMsg(message: string, error = false) {
    setMsg(message);
    setIsError(error);
    if (!error) setTimeout(() => setMsg(null), 2500);
  }

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return; // 簡易ログインチェック

    const { data: e, error: e1 } = await supabase.from("events").select("*").eq("id", id).single();
    if (e1) { showMsg(e1.message, true); return; }
    setEvent(e);
    setCoverImageDraft(e.cover_image ?? null);
    setIsCoverDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);

    const { data: b, error: e2 } = await supabase.from("blocks").select("*").eq("event_id", id).order("sort_order", { ascending: true });
    if (!e2) setBlocks(b ?? []);
  }

  // --- Cover Image ---
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
    } catch (err: any) { showMsg("アップロード失敗", true); } 
    finally { setUploadingCover(false); }
  }

  async function saveCoverImage() {
    if (!isCoverDirty) return;
    setLoading(true);
    const { error } = await supabase.from("events").update({ cover_image: coverImageDraft }).eq("id", id);
    if (error) showMsg("エラー", true);
    else {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft }));
      setIsCoverDirty(false);
      showMsg("カバー画像を保存しました");
    }
    setLoading(false);
  }

  // --- Live Actions ---
  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);
    await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
    showMsg(next ? "アンコール公開" : "アンコール非公開");
  }

  async function toggleActiveItem(blockId: string, itemIndex: number) {
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;
    const items = target.content.items;
    const isCurrentlyActive = items[itemIndex]?.active === true;
    const newItems = items.map((it: any, idx: number) => ({ ...it, active: idx === itemIndex ? !isCurrentlyActive : false }));
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b)));
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", blockId);
  }

  // 休憩タイマー開始
  async function startBreakTimer(blockId: string, itemIndex: number, minutes: number) {
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;
    
    // 現在時刻 + 指定分
    const end = new Date(Date.now() + minutes * 60000).toISOString();
    
    const newItems = [...target.content.items];
    newItems[itemIndex] = { ...newItems[itemIndex], timerEnd: end };
    
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b)));
    await supabase.from("blocks").update({ content: { ...target.content, items: newItems } }).eq("id", blockId);
    showMsg(`休憩タイマー開始 (${minutes}分)`);
  }

  // --- Block Actions ---
  function nextSortOrder() {
    const max = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    return max + 10;
  }

  async function addBlock(type: string) {
    setIsAddMenuOpen(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // デフォルトコンテンツ定義
    let content = {};
    if (type === "greeting") content = { text: "", author: "", role: "", image: "" };
    if (type === "program") content = { items: [{ type: "song", title: "", composer: "", description: "" }] };
    if (type === "profile") content = { people: [{ name: "", role: "", bio: "", image: "" }] };
    if (type === "gallery") content = { title: "Gallery", images: [], caption: "" };
    if (type === "free") content = { title: "", text: "" };

    const { error } = await supabase.from("blocks").insert({
      event_id: id,
      owner_id: u.user.id,
      type,
      sort_order: nextSortOrder(),
      content,
    });

    if (error) showMsg("追加失敗", true);
    else await load();
  }

  async function saveBlockContent(blockId: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    const { error } = await supabase.from("blocks").update({ content }).eq("id", blockId);
    if (error) throw error;
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (!error) setBlocks((prev) => prev.filter((b) => b.id !== blockId));
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

  if (!event) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const displayCover = coverImageDraft ?? event.cover_image;
  const viewerUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${event.slug}` : '';

  return (
    <div className="min-h-screen bg-zinc-100 font-sans text-zinc-900 pb-32">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b px-4 py-3 flex justify-between items-center shadow-sm">
        <h1 className="text-sm font-bold truncate max-w-[150px]">{event.title}</h1>
        <div className="flex gap-2 items-center">
           {msg && <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${isError ? 'bg-red-100 text-red' : 'bg-green-100 text-green-600'}`}>{msg}</span>}
           <button onClick={() => setShowShareModal(true)} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-full"><Share2 size={18}/></button>
           <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-black text-white rounded-full shadow-md"><Eye size={18} /></Link>
        </div>
      </header>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowShareModal(false)}>
           <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-lg">プログラムを配布</h3>
              
              {/* QR Code (using API for simplicity) */}
              <div className="bg-white p-2 border rounded-xl inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(viewerUrl)}`} alt="QR" className="w-32 h-32" />
              </div>
              
              <div className="bg-zinc-50 p-3 rounded-lg text-xs break-all border select-all">
                {viewerUrl}
              </div>
              <button className="w-full py-3 bg-black text-white font-bold rounded-xl" onClick={() => setShowShareModal(false)}>閉じる</button>
           </div>
        </div>
      )}

      {/* MAIN */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* EDIT TAB */}
        {activeTab === "edit" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Cover Image */}
            <section className="bg-white rounded-2xl border overflow-hidden shadow-sm">
               <div className="bg-zinc-50 px-4 py-2 border-b text-xs font-bold text-zinc-500 flex justify-between items-center">
                 <span>表紙画像</span>
                 {isCoverDirty && <span className="text-orange-500">保存されていません</span>}
               </div>
               <div className="relative aspect-[3/2] bg-zinc-100 group">
                 {displayCover ? <img src={displayCover} className="w-full h-full object-cover" alt="" /> : <div className="flex flex-col items-center justify-center h-full text-zinc-300"><ImageIcon size={32}/><span className="text-xs mt-1">未設定</span></div>}
                 <label className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center cursor-pointer transition-all">
                    <div className="bg-white/90 px-4 py-2 rounded-full text-xs font-bold shadow flex gap-2"><Camera size={14}/>変更する</div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                 </label>
               </div>
               {isCoverDirty && <div className="p-3 bg-orange-50 flex justify-end"><button onClick={saveCoverImage} disabled={loading} className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold">{loading?"保存中":"画像を保存"}</button></div>}
            </section>

            {/* Blocks */}
            <div className="space-y-4">
               {blocks.map((b, i) => (
                  <BlockEditor key={b.id} block={b} index={i} total={blocks.length} onSave={saveBlockContent} onMove={moveBlock} onDelete={deleteBlock} supabaseClient={supabase} />
               ))}
            </div>
            <div className="h-20" />
          </div>
        )}

        {/* LIVE TAB */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-in fade-in">
            <section className="bg-white rounded-3xl p-6 border shadow-sm text-center">
              <h2 className="text-lg font-bold mb-4">アンコール管理</h2>
              <button onClick={toggleEncore} className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 ${encoreRevealed ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                {encoreRevealed ? <Unlock /> : <Lock />} {encoreRevealed ? "公開中" : "非公開"}
              </button>
            </section>

            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2"><Music className="text-blue-500" size={18}/><h2 className="font-bold">演奏コントロール</h2></div>
              {blocks.filter(b => b.type === "program").map(block => (
                <div key={block.id} className="bg-white rounded-2xl border overflow-hidden">
                  <div className="bg-zinc-50 border-b px-4 py-2 text-xs font-bold text-zinc-400">PROGRAM</div>
                  {block.content.items?.map((item: any, i: number) => {
                     const isBreak = item.type === "break";
                     const isActive = item.active === true;
                     return (
                       <div key={i} className={`p-4 border-b last:border-0 ${isActive ? 'bg-blue-50' : ''}`}>
                         <div className="flex items-center gap-4">
                           {!isBreak ? (
                             <button onClick={() => toggleActiveItem(block.id, i)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-zinc-100 text-zinc-400'}`}>
                               {isActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1"/>}
                             </button>
                           ) : <div className="w-12 h-12 flex items-center justify-center text-zinc-300"><Coffee /></div>}
                           
                           <div className="flex-1">
                             <div className={`font-bold ${isActive ? 'text-blue-700' : 'text-zinc-700'}`}>{item.title}</div>
                             {isActive && <span className="text-[10px] text-blue-500 font-bold animate-pulse">NOW PLAYING</span>}
                             
                             {/* 休憩タイマー操作 */}
                             {isBreak && (
                               <div className="mt-2 flex gap-2">
                                 <button onClick={() => startBreakTimer(block.id, i, 15)} className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1"><Clock size={12}/> 15分開始</button>
                                 <button onClick={() => startBreakTimer(block.id, i, 20)} className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-xs font-bold rounded-lg flex items-center gap-1"><Clock size={12}/> 20分開始</button>
                               </div>
                             )}
                           </div>
                         </div>
                       </div>
                     )
                  })}
                </div>
              ))}
            </div>
            <div className="h-20" />
          </div>
        )}
      </main>

      {/* FAB & MENU */}
      {activeTab === "edit" && (
        <>
          {isAddMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-end p-6" onClick={() => setIsAddMenuOpen(false)}>
              <div className="flex flex-col gap-3 mb-20 animate-in slide-in-from-bottom-5">
                <AddMenuBtn label="ご挨拶" icon={MessageSquare} color="bg-orange-500" onClick={() => addBlock("greeting")} />
                <AddMenuBtn label="フリートピック" icon={Info} color="bg-indigo-500" onClick={() => addBlock("free")} />
                <AddMenuBtn label="ギャラリー" icon={Grid} color="bg-pink-500" onClick={() => addBlock("gallery")} />
                <AddMenuBtn label="出演者" icon={User} color="bg-green-500" onClick={() => addBlock("profile")} />
                <AddMenuBtn label="プログラム" icon={Music} color="bg-blue-500" onClick={() => addBlock("program")} />
              </div>
            </div>
          )}
          <button onClick={() => setIsAddMenuOpen(!isAddMenuOpen)} className={`fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all active:scale-90 ${isAddMenuOpen ? 'bg-zinc-800 rotate-45' : 'bg-black'}`}>
            <Plus size={28} />
          </button>
        </>
      )}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t px-6 py-2 flex justify-around pb-safe">
        <NavBtn active={activeTab === "edit"} onClick={() => setActiveTab("edit")} icon={Edit3} label="編集" />
        <NavBtn active={activeTab === "live"} onClick={() => setActiveTab("live")} icon={MonitorPlay} label="本番" />
      </nav>
    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 w-20 rounded-xl transition-colors ${active ? 'text-black' : 'text-zinc-300'}`}>
      <Icon size={24} strokeWidth={active?2.5:2} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="flex items-center gap-3 bg-white p-3 pr-6 rounded-full shadow-lg active:scale-95">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${color}`}><Icon size={16} /></div>
      <span className="text-sm font-bold text-zinc-700">{label}</span>
    </button>
  );
}

function BlockEditor({ block, index, total, onSave, onMove, onDelete, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setContent(block.content ?? {}); setIsDirty(false); }, [block.id]);
  const handleChange = (nc: any) => { setContent(nc); setIsDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(block.id, content); setIsDirty(false); } catch { alert("Error"); } finally { setSaving(false); }
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

      if (target === 'single') handleChange({ ...content, image: data.publicUrl }); // Greeting image
      if (target === 'profile' && typeof index === 'number') {
        const np = [...content.people]; np[index].image = data.publicUrl; handleChange({ ...content, people: np });
      }
      if (target === 'gallery') {
         // 配列に追加（旧仕様のurlがある場合はそれも維持）
         const current = content.images ?? (content.url ? [content.url] : []);
         handleChange({ ...content, images: [...current, data.publicUrl] });
      }
    } catch { alert("Upload Failed"); } finally { setUploading(false); }
  };

  const iconMap: any = { greeting: MessageSquare, program: Music, profile: User, gallery: Grid, free: Info };
  const TypeIcon = iconMap[block.type] || Edit3;
  const labels: any = { greeting: "ご挨拶", program: "プログラム", profile: "出演者", gallery: "ギャラリー", free: "フリートピック" };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${isDirty ? 'ring-2 ring-black' : 'border-zinc-200'}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-zinc-50 rounded-t-2xl">
        <div className="flex items-center gap-2 text-zinc-500 font-bold text-xs"><TypeIcon size={14} />{labels[block.type]}</div>
        <div className="flex items-center">
           <button onClick={() => onMove(block.id, "up")} disabled={index===0} className="p-2 text-zinc-300 hover:text-black"><ArrowUp size={16}/></button>
           <button onClick={() => onMove(block.id, "down")} disabled={index===total-1} className="p-2 text-zinc-300 hover:text-black"><ArrowDown size={16}/></button>
           <div className="w-px h-3 bg-zinc-200 mx-1"/>
           <button onClick={() => onDelete(block.id)} className="p-2 text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* --- Greeting --- */}
        {block.type === "greeting" && (
          <>
            <div className="flex gap-4">
              <div className="relative w-20 h-24 bg-zinc-100 border rounded overflow-hidden shrink-0 group">
                {content.image ? <img src={content.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-8 text-zinc-300"/>}
                <label className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center cursor-pointer"><Upload className="text-white opacity-0 group-hover:opacity-100" size={16}/><input type="file" className="hidden" onChange={e => handleUpload(e, 'single')} /></label>
              </div>
              <div className="flex-1 space-y-2">
                <input className="w-full text-base bg-zinc-50 p-2 rounded border-0" placeholder="名前 (例: 山田 太郎)" value={content.author||""} onChange={e => handleChange({...content, author: e.target.value})} />
                <input className="w-full text-base bg-zinc-50 p-2 rounded border-0" placeholder="肩書き (例: 主催)" value={content.role||""} onChange={e => handleChange({...content, role: e.target.value})} />
              </div>
            </div>
            <textarea className="w-full min-h-[120px] text-base bg-zinc-50 p-3 rounded resize-none" placeholder="挨拶文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
          </>
        )}

        {/* --- Free Topic --- */}
        {block.type === "free" && (
           <>
             <input className="w-full text-base font-bold bg-zinc-50 p-2 rounded" placeholder="タイトル (例: お知らせ)" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
             <textarea className="w-full min-h-[100px] text-base bg-zinc-50 p-3 rounded resize-none" placeholder="本文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
           </>
        )}

        {/* --- Gallery --- */}
        {block.type === "gallery" && (
           <>
             <input className="w-full text-base font-bold bg-zinc-50 p-2 rounded" placeholder="タイトル (例: リハーサル風景)" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
             <div className="grid grid-cols-3 gap-2">
                {(content.images || (content.url ? [content.url] : [])).map((url:string, i:number) => (
                   <div key={i} className="relative aspect-square bg-zinc-100 rounded overflow-hidden group">
                     <img src={url} className="w-full h-full object-cover" alt="" />
                     <button onClick={() => {
                        const ni = (content.images || [content.url]).filter((_:any, idx:number) => idx !== i);
                        handleChange({...content, images: ni});
                     }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12}/></button>
                   </div>
                ))}
                <label className="aspect-square bg-zinc-50 border-2 border-dashed rounded flex flex-col items-center justify-center text-zinc-400 cursor-pointer hover:bg-zinc-100">
                   {uploading ? <Loader2 className="animate-spin"/> : <Plus />}
                   <span className="text-[10px] mt-1">追加</span>
                   <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'gallery')} />
                </label>
             </div>
             <input className="w-full text-base bg-zinc-50 p-2 rounded" placeholder="キャプション (任意)" value={content.caption||""} onChange={e => handleChange({...content, caption: e.target.value})} />
           </>
        )}

        {/* --- Profile --- */}
        {block.type === "profile" && (
          <div className="space-y-4">
            {(content.people || []).map((p: any, i: number) => (
              <div key={i} className="flex gap-3 items-start border p-2 rounded-lg relative">
                <div className="relative w-16 h-16 bg-zinc-100 rounded overflow-hidden shrink-0 group">
                  {p.image ? <img src={p.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-4 text-zinc-300"/>}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 cursor-pointer"><Upload className="text-white opacity-0 group-hover:opacity-100" size={14}/><input type="file" className="hidden" onChange={e => handleUpload(e, 'profile', i)} /></label>
                </div>
                <div className="flex-1 space-y-2">
                  <input className="w-full bg-zinc-50 rounded px-2 py-1 text-base font-bold" placeholder="名前" value={p.name} onChange={e => { const np=[...content.people]; np[i].name=e.target.value; handleChange({...content, people:np}); }} />
                  <input className="w-full bg-zinc-50 rounded px-2 py-1 text-base" placeholder="役割" value={p.role} onChange={e => { const np=[...content.people]; np[i].role=e.target.value; handleChange({...content, people:np}); }} />
                  <textarea className="w-full bg-zinc-50 rounded px-2 py-1 text-base h-20 resize-none" placeholder="プロフィール" value={p.bio} onChange={e => { const np=[...content.people]; np[i].bio=e.target.value; handleChange({...content, people:np}); }} />
                </div>
                <button onClick={() => { const np=content.people.filter((_:any,idx:number)=>idx!==i); handleChange({...content, people:np}); }} className="absolute top-2 right-2 text-zinc-300 hover:text-red-500"><Trash2 size={14}/></button>
              </div>
            ))}
            <button onClick={() => handleChange({...content, people: [...(content.people||[]), {name:"",role:"",bio:"",image:""}]})} className="w-full py-2 bg-zinc-50 text-zinc-500 rounded font-bold">+ 出演者を追加</button>
          </div>
        )}

        {/* --- Program --- */}
        {block.type === "program" && (
           <div className="space-y-3">
             {(content.items || []).map((item: any, i: number) => {
               const isBreak = item.type === "break";
               return (
                 <div key={i} className="flex gap-2 items-start border p-2 rounded-lg bg-zinc-50">
                   <div className="pt-2 text-zinc-300 cursor-grab"><GripVertical size={14}/></div>
                   <div className="flex-1 space-y-2">
                     <div className="flex gap-2">
                        <input className="flex-1 bg-transparent font-bold text-base" placeholder={isBreak?"休憩名":"曲名"} value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} />
                        {!isBreak && <button onClick={() => { const ni=[...content.items]; ni[i].isEncore=!ni[i].isEncore; handleChange({...content, items:ni}); }} className={`px-2 rounded text-xs font-bold ${item.isEncore?'bg-black text-white':'bg-zinc-200 text-zinc-400'}`}>Encore</button>}
                     </div>
                     {isBreak ? (
                        <input className="w-full bg-transparent text-base text-zinc-500" placeholder="15分" value={item.duration} onChange={e => { const ni=[...content.items]; ni[i].duration=e.target.value; handleChange({...content, items:ni}); }} />
                     ) : (
                       <>
                         <input className="w-full bg-transparent text-base text-zinc-500" placeholder="作曲者" value={item.composer} onChange={e => { const ni=[...content.items]; ni[i].composer=e.target.value; handleChange({...content, items:ni}); }} />
                         <textarea className="w-full bg-white border border-zinc-100 rounded p-2 text-base h-20 resize-none" placeholder="解説" value={item.description} onChange={e => { const ni=[...content.items]; ni[i].description=e.target.value; handleChange({...content, items:ni}); }} />
                       </>
                     )}
                     <div className="text-right"><button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="text-xs text-red-400 font-bold">削除</button></div>
                   </div>
                 </div>
               )
             })}
             <div className="flex gap-2">
               <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"song",title:"",composer:"",description:"",isEncore:false}]})} className="flex-1 py-2 bg-blue-50 text-blue-600 font-bold rounded">+ 曲</button>
               <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"break",title:"休憩",duration:"15分"}]})} className="flex-1 py-2 bg-zinc-100 text-zinc-500 font-bold rounded">+ 休憩</button>
             </div>
           </div>
        )}
      </div>

      {isDirty && (
        <div className="p-3 border-t bg-zinc-50 rounded-b-2xl flex justify-end">
           <button onClick={handleSave} disabled={saving} className="bg-black text-white px-5 py-2 rounded-full font-bold shadow-lg active:scale-95">{saving ? <Loader2 className="animate-spin"/> : "保存"}</button>
        </div>
      )}
    </div>
  );
}