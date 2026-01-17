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
  X,
  ChevronRight,
} from "lucide-react";

// ▼ Supabaseクライアント
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { params: Promise<{ id: string }> };
type Tab = "edit" | "live"; // デザインタブは削除

export default function EventEdit({ params }: Props) {
  const { id } = use(params);

  // --- State ---
  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("edit");

  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cover Image (Designタブから移動)
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  // Live Mode
  const [encoreRevealed, setEncoreRevealed] = useState(false);

  // UI State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Drag refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // --- Init ---
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
    if (!u.user) {
      showMsg("未ログインです", true);
      return;
    }

    // Load Event
    const { data: e, error: e1 } = await supabase.from("events").select("*").eq("id", id).single();
    if (e1) {
      showMsg(e1.message, true);
      return;
    }
    setEvent(e);
    setCoverImageDraft(e.cover_image ?? null);
    setIsCoverDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);

    // Load Blocks
    const { data: b, error: e2 } = await supabase
      .from("blocks")
      .select("*")
      .eq("event_id", id)
      .order("sort_order", { ascending: true });

    if (e2) {
      showMsg(e2.message, true);
      return;
    }
    setBlocks(b ?? []);
  }

  // --- Actions: Cover Image ---
  async function handleCoverUpload(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `cover_${Date.now()}.${ext}`;
      const filePath = `covers/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("pamp-images").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("pamp-images").getPublicUrl(filePath);
      setCoverImageDraft(data.publicUrl);
      setIsCoverDirty(true);
    } catch (err: any) {
      showMsg(`アップロード失敗: ${err.message}`, true);
    } finally {
      setUploadingCover(false);
    }
  }

  async function saveCoverImage() {
    if (!isCoverDirty) return;
    setLoading(true);

    const { error } = await supabase.from("events").update({ cover_image: coverImageDraft }).eq("id", id);
    if (error) {
      showMsg(`保存失敗: ${error.message}`, true);
    } else {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft }));
      setIsCoverDirty(false);
      showMsg("カバー画像を保存しました");
    }
    setLoading(false);
  }

  // --- Actions: Live Mode ---
  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);
    const { error } = await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
    if (error) {
      showMsg("エラーが発生しました", true);
      setEncoreRevealed(!next);
    } else {
      showMsg(next ? "アンコールを公開しました" : "アンコールを非公開にしました");
    }
  }

  async function toggleActiveItem(blockId: string, itemIndex: number) {
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;

    const items = target.content.items;
    const isCurrentlyActive = items[itemIndex]?.active === true;
    const newItems = items.map((it: any, idx: number) => ({
      ...it,
      active: idx === itemIndex ? !isCurrentlyActive : false,
    }));

    // optimistic update
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b))
    );

    const { error } = await supabase
      .from("blocks")
      .update({ content: { ...target.content, items: newItems } })
      .eq("id", blockId);
      
    if (error) load(); // revert on error
  }

  // --- Actions: Blocks ---
  function nextSortOrder() {
    const max = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    return max + 10;
  }

  function defaultContent(type: string) {
    if (type === "greeting") return { text: "" };
    if (type === "program")
      return { items: [{ type: "song", title: "", composer: "", description: "", isEncore: false, active: false }] };
    if (type === "profile") return { people: [{ name: "", role: "", bio: "", image: "" }] };
    if (type === "image") return { url: "", caption: "" };
    return {};
  }

  async function addBlock(type: string) {
    setIsAddMenuOpen(false); // Close menu
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    const { error } = await supabase.from("blocks").insert({
      event_id: id,
      owner_id: u.user.id,
      type,
      sort_order: nextSortOrder(),
      content: defaultContent(type),
    });

    if (error) {
      showMsg(error.message, true);
    } else {
      await load();
      // Scroll to bottom logic could be added here
    }
  }

  async function saveBlockContent(blockId: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    const { error } = await supabase.from("blocks").update({ content }).eq("id", blockId);
    if (error) throw error;
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("本当に削除しますか？")) return;
    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (error) showMsg(error.message, true);
    else setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  async function moveBlock(blockId: string, dir: "up" | "down") {
    const idx = blocks.findIndex((b) => b.id === blockId);
    const to = dir === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || to < 0 || to >= blocks.length) return;

    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[to]] = [newBlocks[to], newBlocks[idx]];
    setBlocks(newBlocks);

    const u1 = { id: newBlocks[idx].id, sort_order: (idx + 1) * 10 };
    const u2 = { id: newBlocks[to].id, sort_order: (to + 1) * 10 };

    await Promise.all([
      supabase.from("blocks").update({ sort_order: u1.sort_order }).eq("id", u1.id),
      supabase.from("blocks").update({ sort_order: u2.sort_order }).eq("id", u2.id),
    ]);
  }

  // --- Render ---

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-zinc-400" />
      </div>
    );
  }

  const displayCover = coverImageDraft ?? event.cover_image;

  return (
    <div className="min-h-screen bg-zinc-100 font-sans text-zinc-900 pb-32 md:pb-24">
      {/* HEADER (Floating) */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-4 py-3 flex justify-between items-center shadow-sm">
        <h1 className="text-sm font-bold truncate max-w-[200px]">{event.title}</h1>
        <div className="flex gap-2 items-center">
           {msg && (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full animate-pulse ${isError ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                {msg}
              </span>
           )}
           <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-black text-white rounded-full shadow-lg active:scale-95 transition-transform">
             <Eye size={18} />
           </Link>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* --- TAB: EDIT --- */}
        {activeTab === "edit" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* 1. Cover Image Editor (Moved here!) */}
            <section className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
              <div className="relative aspect-[3/2] w-full bg-zinc-100 group">
                {displayCover ? (
                   // eslint-disable-next-line @next/next/no-img-element
                   <img src={displayCover} className="w-full h-full object-cover" alt="Cover" />
                ) : (
                   <div className="flex flex-col items-center justify-center h-full text-zinc-300">
                     <ImageIcon size={48} />
                     <span className="text-xs font-bold mt-2">カバー画像なし</span>
                   </div>
                )}
                
                {/* Upload Overlay */}
                <label className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center cursor-pointer transition-all">
                   <div className="bg-white/90 backdrop-blur text-black px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     {uploadingCover ? <Loader2 className="animate-spin" size={14}/> : <Camera size={14}/>}
                     <span>変更する</span>
                   </div>
                   <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                </label>
              </div>

              {/* Save Button for Cover */}
              {isCoverDirty && (
                <div className="p-3 bg-zinc-50 border-t flex justify-between items-center animate-in slide-in-from-top-2">
                  <span className="text-xs font-bold text-zinc-500">変更されています</span>
                  <button 
                    onClick={saveCoverImage} 
                    disabled={loading}
                    className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold shadow-md"
                  >
                    {loading ? "保存中..." : "画像を保存"}
                  </button>
                </div>
              )}
            </section>

            {/* 2. Block List */}
            <div className="space-y-4">
              {blocks.length === 0 && (
                <div className="text-center py-10 border-2 border-dashed border-zinc-300 rounded-2xl text-zinc-400">
                  <p className="text-sm font-bold mb-1">コンテンツがありません</p>
                  <p className="text-xs">右下のボタンから追加してください</p>
                </div>
              )}

              {blocks.map((b, i) => (
                 <BlockEditor 
                    key={b.id} 
                    block={b} 
                    index={i} 
                    total={blocks.length} 
                    onSave={saveBlockContent}
                    onMove={moveBlock}
                    onDelete={deleteBlock}
                    supabaseClient={supabase}
                 />
              ))}
            </div>
            
            {/* Spacer for FAB */}
            <div className="h-20" />
          </div>
        )}

        {/* --- TAB: LIVE --- */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            
            {/* Encore Control */}
            <section className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm text-center">
              <div className="inline-block p-3 bg-yellow-100 text-yellow-700 rounded-full mb-4">
                <Zap size={24} fill="currentColor" />
              </div>
              <h2 className="text-xl font-bold mb-1">アンコール管理</h2>
              <p className="text-xs text-zinc-500 mb-6">本番のアンコール時に公開してください</p>
              
              <button
                onClick={toggleEncore}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg active:scale-95 ${
                  encoreRevealed ? "bg-green-500 text-white" : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {encoreRevealed ? <Unlock /> : <Lock />}
                {encoreRevealed ? "公開中" : "非公開"}
              </button>
            </section>

            {/* Program Control */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 px-2">
                 <Music className="text-blue-500" size={18}/>
                 <h2 className="font-bold text-zinc-700">演奏コントロール</h2>
               </div>

               {blocks.filter(b => b.type === "program").map(block => (
                 <div key={block.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                   <div className="bg-zinc-50 border-b px-4 py-2 text-xs font-bold text-zinc-400">PROGRAM LIST</div>
                   {block.content.items?.map((item: any, i: number) => {
                      const isActive = item.active === true;
                      const isBreak = item.type === "break";
                      return (
                        <div key={i} className={`flex items-center gap-4 p-4 border-b last:border-0 ${isActive ? 'bg-blue-50' : ''}`}>
                          {!isBreak ? (
                            <button 
                              onClick={() => toggleActiveItem(block.id, i)}
                              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-blue-500 text-white shadow-lg scale-105' : 'bg-zinc-100 text-zinc-400'}`}
                            >
                              {isActive ? <Pause fill="currentColor" /> : <Play fill="currentColor" className="ml-1"/>}
                            </button>
                          ) : (
                            <div className="w-12 h-12 flex items-center justify-center text-zinc-300"><Coffee /></div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                             <div className={`font-bold truncate ${isActive ? 'text-blue-700' : 'text-zinc-700'} ${isBreak ? 'opacity-50' : ''}`}>
                               {item.title}
                             </div>
                             {!isBreak && <div className="text-xs text-zinc-400 truncate">{item.composer}</div>}
                          </div>
                          
                          {isActive && (
                            <div className="px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded animate-pulse">
                              NOW
                            </div>
                          )}
                        </div>
                      )
                   })}
                 </div>
               ))}
            </div>
            
            {/* Spacer */}
            <div className="h-20" />
          </div>
        )}

      </main>

      {/* --- FLOATING ACTION BUTTON (Only in Edit) --- */}
      {activeTab === "edit" && (
        <>
          {/* Menu Overlay */}
          {isAddMenuOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-end p-6" onClick={() => setIsAddMenuOpen(false)}>
              <div className="flex flex-col gap-3 mb-20 animate-in slide-in-from-bottom-5 duration-200">
                <AddMenuBtn label="挨拶を追加" icon={MessageSquare} color="bg-orange-500" onClick={() => addBlock("greeting")} />
                <AddMenuBtn label="画像を追加" icon={ImageIcon} color="bg-pink-500" onClick={() => addBlock("image")} />
                <AddMenuBtn label="プロフィールを追加" icon={User} color="bg-green-500" onClick={() => addBlock("profile")} />
                <AddMenuBtn label="プログラムを追加" icon={Music} color="bg-blue-500" onClick={() => addBlock("program")} />
              </div>
            </div>
          )}
          
          {/* Main FAB */}
          <button 
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className={`fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white transition-all active:scale-90 ${isAddMenuOpen ? 'bg-zinc-800 rotate-45' : 'bg-black hover:bg-zinc-800'}`}
          >
            <Plus size={28} />
          </button>
        </>
      )}

      {/* --- BOTTOM NAVIGATION --- */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-zinc-200 px-6 py-2 flex justify-around pb-safe">
        <NavBtn 
          active={activeTab === "edit"} 
          onClick={() => setActiveTab("edit")} 
          icon={Edit3} 
          label="編集" 
        />
        <NavBtn 
          active={activeTab === "live"} 
          onClick={() => setActiveTab("live")} 
          icon={MonitorPlay} 
          label="本番" 
        />
      </nav>

    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 w-20 rounded-xl transition-colors ${active ? 'text-black' : 'text-zinc-300 hover:text-zinc-500'}`}>
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="flex items-center gap-3 bg-white p-3 pr-6 rounded-full shadow-lg active:scale-95 transition-transform">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${color}`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-bold text-zinc-700">{label}</span>
    </button>
  );
}

// ブロック編集コンポーネント
function BlockEditor({ block, index, total, onSave, onMove, onDelete, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setContent(block.content ?? {}); setIsDirty(false); }, [block.id]);
  const handleChange = (nc: any) => { setContent(nc); setIsDirty(true); };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(block.id, content); setIsDirty(false); } 
    catch { alert("エラー"); } 
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: any, keyOrIndex: any, isProfile = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error } = await supabaseClient.storage.from("pamp-images").upload(path, file);
      if (error) throw error;
      const { data } = supabaseClient.storage.from("pamp-images").getPublicUrl(path);

      if (isProfile) {
        const np = [...content.people];
        np[keyOrIndex].image = data.publicUrl;
        handleChange({ ...content, people: np });
      } else {
        handleChange({ ...content, url: data.publicUrl });
      }
    } catch { alert("Upload failed"); } 
    finally { setUploading(false); }
  };

  const typeLabel: Record<string, string> = { greeting: "ご挨拶", program: "プログラム", profile: "出演者", image: "画像" };
  const TypeIcon = { greeting: MessageSquare, program: Music, profile: User, image: ImageIcon }[block.type] || Edit3;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm transition-all ${isDirty ? 'ring-2 ring-black border-transparent' : 'border-zinc-200'}`}>
      
      {/* Block Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-zinc-500">
          <TypeIcon size={16} />
          <span className="text-xs font-bold">{typeLabel[block.type]}</span>
        </div>
        <div className="flex items-center">
          <button onClick={() => onMove(block.id, "up")} disabled={index === 0} className="p-2 text-zinc-300 hover:text-black disabled:opacity-20"><ArrowUp size={16}/></button>
          <button onClick={() => onMove(block.id, "down")} disabled={index === total - 1} className="p-2 text-zinc-300 hover:text-black disabled:opacity-20"><ArrowDown size={16}/></button>
          <div className="w-px h-3 bg-zinc-200 mx-1"/>
          <button onClick={() => onDelete(block.id)} className="p-2 text-zinc-300 hover:text-red-500"><Trash2 size={16}/></button>
        </div>
      </div>

      {/* Block Body */}
      <div className="p-4 space-y-4">
        
        {block.type === "greeting" && (
          <textarea
            className="w-full min-h-[120px] p-3 rounded-xl bg-zinc-50 border-0 text-sm focus:ring-2 focus:ring-black outline-none resize-none"
            placeholder="ここに挨拶文を入力してください..."
            value={content.text || ""}
            onChange={(e) => handleChange({ ...content, text: e.target.value })}
          />
        )}

        {block.type === "image" && (
          <div className="space-y-3">
             <div className="relative w-full aspect-video bg-zinc-100 rounded-xl overflow-hidden group">
               {content.url ? (
                 // eslint-disable-next-line @next/next/no-img-element
                 <img src={content.url} className="w-full h-full object-cover" alt="" />
               ) : (
                 <div className="flex items-center justify-center h-full text-zinc-300"><ImageIcon /></div>
               )}
               <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-all cursor-pointer">
                  {uploading ? <Loader2 className="animate-spin text-white"/> : <Upload className="text-white opacity-0 group-hover:opacity-100"/>}
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, null)} />
               </label>
             </div>
             <input 
                className="w-full bg-zinc-50 p-2 rounded-lg text-xs outline-none" 
                placeholder="キャプション (任意)"
                value={content.caption || ""} 
                onChange={(e) => handleChange({ ...content, caption: e.target.value })}
             />
          </div>
        )}

        {block.type === "profile" && (
          <div className="space-y-4">
            {(content.people || []).map((p: any, i: number) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="relative w-16 h-16 bg-zinc-100 rounded-full overflow-hidden shrink-0 group">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} className="w-full h-full object-cover" alt=""/>
                  ) : <User className="m-auto mt-4 text-zinc-300"/>}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 cursor-pointer">
                    <Upload size={14} className="text-white opacity-0 group-hover:opacity-100" />
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, i, true)} />
                  </label>
                </div>
                <div className="flex-1 space-y-2">
                  <input className="w-full bg-zinc-50 rounded-lg px-3 py-2 text-sm font-bold outline-none" placeholder="名前" value={p.name} onChange={(e) => {
                    const np = [...content.people]; np[i].name = e.target.value; handleChange({ ...content, people: np });
                  }} />
                  <input className="w-full bg-zinc-50 rounded-lg px-3 py-2 text-xs outline-none" placeholder="役割 (Pf, Vnなど)" value={p.role} onChange={(e) => {
                    const np = [...content.people]; np[i].role = e.target.value; handleChange({ ...content, people: np });
                  }} />
                  <textarea className="w-full bg-zinc-50 rounded-lg px-3 py-2 text-xs h-20 outline-none resize-none" placeholder="プロフィール文" value={p.bio} onChange={(e) => {
                    const np = [...content.people]; np[i].bio = e.target.value; handleChange({ ...content, people: np });
                  }} />
                  <button onClick={() => {
                     const np = content.people.filter((_: any, idx: number) => idx !== i);
                     handleChange({ ...content, people: np });
                  }} className="text-xs text-red-400 font-bold hover:text-red-600">削除</button>
                </div>
              </div>
            ))}
            <button onClick={() => handleChange({ ...content, people: [...(content.people || []), { name: "", role: "", bio: "", image: "" }] })} className="w-full py-2 bg-zinc-50 text-zinc-400 text-xs font-bold rounded-lg hover:bg-zinc-100">
              + 人物を追加
            </button>
          </div>
        )}

        {block.type === "program" && (
           <div className="space-y-3">
             {(content.items || []).map((item: any, i: number) => {
               const isBreak = item.type === "break";
               return (
                 <div key={i} className="flex gap-2 items-start border p-2 rounded-xl bg-zinc-50/50">
                   <div className="pt-2 text-zinc-300 cursor-grab active:cursor-grabbing"><GripVertical size={14}/></div>
                   <div className="flex-1 space-y-2">
                     <div className="flex gap-2">
                        <input className="flex-1 bg-transparent font-bold text-sm outline-none" placeholder={isBreak ? "休憩名" : "曲名"} value={item.title} onChange={(e) => {
                          const ni = [...content.items]; ni[i].title = e.target.value; handleChange({...content, items: ni});
                        }} />
                        {!isBreak && (
                          <button onClick={() => {
                             const ni = [...content.items]; ni[i].isEncore = !ni[i].isEncore; handleChange({...content, items: ni});
                          }} className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isEncore ? 'bg-black text-white' : 'bg-zinc-200 text-zinc-400'}`}>Encore</button>
                        )}
                     </div>
                     {isBreak ? (
                        <input className="w-full bg-transparent text-xs outline-none text-zinc-500" placeholder="15分" value={item.duration} onChange={(e) => {
                          const ni = [...content.items]; ni[i].duration = e.target.value; handleChange({...content, items: ni});
                        }} />
                     ) : (
                       <>
                         <input className="w-full bg-transparent text-xs outline-none text-zinc-500" placeholder="作曲者" value={item.composer} onChange={(e) => {
                            const ni = [...content.items]; ni[i].composer = e.target.value; handleChange({...content, items: ni});
                          }} />
                         <textarea className="w-full bg-white border border-zinc-100 rounded p-2 text-xs h-16 resize-none outline-none" placeholder="曲解説" value={item.description} onChange={(e) => {
                            const ni = [...content.items]; ni[i].description = e.target.value; handleChange({...content, items: ni});
                          }} />
                       </>
                     )}
                     <div className="text-right">
                        <button onClick={() => {
                          const ni = content.items.filter((_: any, idx: number) => idx !== i);
                          handleChange({...content, items: ni});
                        }} className="text-[10px] text-red-400 font-bold">削除</button>
                     </div>
                   </div>
                 </div>
               )
             })}
             <div className="flex gap-2">
               <button onClick={() => handleChange({ ...content, items: [...(content.items||[]), {type:"song", title:"", composer:"", description:"", isEncore:false}]})} className="flex-1 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg">+ 曲</button>
               <button onClick={() => handleChange({ ...content, items: [...(content.items||[]), {type:"break", title:"休憩", duration:"15分"}]})} className="flex-1 py-2 bg-zinc-100 text-zinc-500 text-xs font-bold rounded-lg">+ 休憩</button>
             </div>
           </div>
        )}

      </div>
      
      {/* Save Button (Sticky) */}
      {isDirty && (
        <div className="p-3 bg-zinc-50 rounded-b-2xl border-t border-zinc-100 flex justify-end">
           <button onClick={handleSave} disabled={saving} className="bg-black text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
             {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
             保存する
           </button>
        </div>
      )}
    </div>
  );
}