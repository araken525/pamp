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
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  MoreVertical
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
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  
  // UI State
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // Cover Image
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  // Live Mode
  const [encoreRevealed, setEncoreRevealed] = useState(false);
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);

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
    setIsCoverDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);
    const { data: b } = await supabase.from("blocks").select("*").eq("event_id", id).order("sort_order", { ascending: true });
    setBlocks(b ?? []);
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
    } catch { showMsg("失敗しました", true); }
    finally { setUploadingCover(false); }
  }

  async function saveCoverImage() {
    if (!isCoverDirty) return;
    setLoading(true);
    const { error } = await supabase.from("events").update({ cover_image: coverImageDraft }).eq("id", id);
    if (!error) {
      setEvent((prev: any) => ({ ...prev, cover_image: coverImageDraft }));
      setIsCoverDirty(false);
      showMsg("表紙を保存しました✨");
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
    const target = blocks.find((b) => b.id === blockId);
    if (!target?.content?.items) return;
    const items = target.content.items;
    const isCurrentlyActive = items[itemIndex]?.active === true;
    
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
    showMsg(`${minutes}分のタイマー開始⏳`);
  }

  async function addBlock(type: string) {
    setIsAddMenuOpen(false);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    
    const maxOrder = blocks.reduce((m, b) => Math.max(m, b.sort_order ?? 0), 0);
    let content = {};
    if (type === "greeting") content = { text: "", author: "", role: "", image: "" };
    if (type === "program") content = { items: [{ type: "song", title: "", composer: "", description: "" }] };
    if (type === "profile") content = { people: [{ name: "", role: "", bio: "", image: "" }] };
    if (type === "gallery") content = { title: "", images: [], caption: "" };
    if (type === "free") content = { title: "", text: "" };

    const { data, error } = await supabase.from("blocks").insert({
      event_id: id,
      owner_id: u.user.id,
      type,
      sort_order: maxOrder + 10,
      content
    }).select().single();

    if (!error && data) {
      await load();
      setExpandedBlockId(data.id); // 追加したブロックを即開く
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

  if (!event) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400" /></div>;

  const displayCover = coverImageDraft ?? event.cover_image;
  const viewerUrl = typeof window !== 'undefined' ? `${window.location.origin}/e/${event.slug}` : '';

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-32" ref={pageRef}>
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex justify-between items-center safe-top">
        <h1 className="text-sm font-bold truncate max-w-[180px] text-slate-700">{event.title}</h1>
        <div className="flex gap-2">
           <button onClick={() => setShowShareModal(true)} className="p-2 bg-slate-100 rounded-full text-slate-600 hover:bg-slate-200"><Share2 size={20}/></button>
           <Link href={`/e/${event.slug}`} target="_blank" className="p-2 bg-slate-900 text-white rounded-full shadow-md active:scale-95"><Eye size={20} /></Link>
        </div>
      </header>

      {/* TOAST */}
      <div className={`fixed top-16 inset-x-0 flex justify-center pointer-events-none z-50 transition-all ${msg ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        {msg && <div className={`px-4 py-2 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 backdrop-blur-md ${msg.isError ? 'bg-red-500/90 text-white' : 'bg-slate-800/90 text-white'}`}>{msg.isError?<AlertCircle size={16}/>:<CheckCircle2 size={16}/>}{msg.text}</div>}
      </div>

      {/* SHARE MODAL */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowShareModal(false)}>
           <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm text-center space-y-6 shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-xl">プログラムを配布</h3>
              <div className="bg-white p-4 border rounded-3xl inline-block shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(viewerUrl)}`} alt="QR" className="w-40 h-40" />
              </div>
              <div className="bg-slate-100 p-3 rounded-xl text-xs break-all select-all font-mono text-slate-600">{viewerUrl}</div>
              <button className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl active:scale-95" onClick={() => setShowShareModal(false)}>閉じる</button>
           </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <main className="max-w-xl mx-auto p-4 space-y-6">
        
        {/* EDIT TAB */}
        {activeTab === "edit" && (
          <div className="space-y-6 animate-in fade-in">
            
            {/* COVER IMAGE */}
            <section className="bg-white rounded-[1.5rem] overflow-hidden shadow-sm">
               <div className="relative aspect-[16/9] bg-slate-50 group">
                 {displayCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayCover} className="w-full h-full object-cover" alt="" />
                 ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300">
                      <ImageIcon size={32} className="mb-1"/>
                      <span className="text-xs font-bold">表紙画像なし</span>
                    </div>
                 )}
                 <label className="absolute bottom-3 right-3">
                    <div className="bg-white/90 text-slate-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 cursor-pointer hover:bg-white transition-colors">
                      {uploadingCover ? <Loader2 className="animate-spin" size={14}/> : <Camera size={14}/>} 変更
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                 </label>
               </div>
               {isCoverDirty && (
                 <div className="p-3 bg-orange-50 flex justify-end">
                   <button onClick={saveCoverImage} disabled={loading} className="bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold shadow active:scale-95">保存する</button>
                 </div>
               )}
            </section>

            {/* BLOCKS LIST (Accordion Style) */}
            <div className="space-y-3">
               {blocks.map((b, i) => (
                  <BlockCard 
                    key={b.id} 
                    block={b} 
                    index={i} 
                    total={blocks.length} 
                    isExpanded={expandedBlockId === b.id}
                    onToggle={() => setExpandedBlockId(expandedBlockId === b.id ? null : b.id)}
                    onSave={saveBlockContent} 
                    onMove={moveBlock} 
                    onDelete={deleteBlock} 
                    supabaseClient={supabase} 
                  />
               ))}
            </div>

            {blocks.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-sm font-bold">コンテンツがありません</p>
                <p className="text-xs mt-1">右下の「＋」で追加してください</p>
              </div>
            )}
            <div className="h-20" />
          </div>
        )}

        {/* LIVE TAB */}
        {activeTab === "live" && (
          <div className="space-y-6 animate-in fade-in">
            {/* Encore Toggle */}
            <section className="bg-white rounded-[2rem] p-6 shadow-sm text-center">
              <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center justify-center gap-2">
                <Zap className="text-yellow-500" size={20}/> アンコール管理
              </h2>
              <button
                onClick={toggleEncore}
                className={`w-full py-5 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-sm transition-all active:scale-95 ${
                  encoreRevealed ? "bg-green-500 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {encoreRevealed ? <Unlock size={24}/> : <Lock size={24}/>}
                {encoreRevealed ? "公開中" : "非公開"}
              </button>
            </section>

            {/* Play Control */}
            <div className="space-y-4">
              <h2 className="font-bold text-slate-700 px-2 flex items-center gap-2"><Music size={18} className="text-blue-500"/> 演奏コントロール</h2>
              {blocks.filter(b => b.type === "program").map(block => (
                <div key={block.id} className="bg-white rounded-[2rem] overflow-hidden shadow-sm">
                  <div className="bg-slate-50 border-b px-5 py-3 text-xs font-bold text-slate-400">PROGRAM LIST</div>
                  <div className="divide-y divide-slate-100">
                  {block.content.items?.map((item: any, i: number) => {
                     const isBreak = item.type === "break";
                     const isActive = item.active === true;
                     return (
                       <div key={i} className={`p-4 transition-colors ${isActive ? 'bg-blue-50/50' : ''}`}>
                         <div className="flex items-center gap-4">
                           {!isBreak ? (
                             <button onClick={() => toggleActiveItem(block.id, i)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${isActive ? 'bg-blue-500 text-white shadow-blue-200 scale-105' : 'bg-slate-100 text-slate-400'}`}>
                               {isActive ? <Pause fill="currentColor" size={20} /> : <Play fill="currentColor" className="ml-1" size={20}/>}
                             </button>
                           ) : (
                             <div className="w-14 h-14 flex items-center justify-center text-slate-300 bg-slate-50 rounded-full"><Coffee size={24} /></div>
                           )}
                           
                           <div className="flex-1 min-w-0">
                             <div className={`font-bold text-base ${isActive ? 'text-blue-900' : 'text-slate-900'} ${isBreak?'opacity-60':''}`}>{item.title}</div>
                             {!isBreak && <div className="text-xs text-slate-500 mt-0.5">{item.composer}</div>}
                             {isBreak && (
                               <div className="mt-2 flex gap-2 overflow-x-auto">
                                 <button onClick={() => startBreakTimer(block.id, i, 15)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full flex gap-1 whitespace-nowrap"><Clock size={12}/> 15分</button>
                                 <button onClick={() => startBreakTimer(block.id, i, 20)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full flex gap-1 whitespace-nowrap"><Clock size={12}/> 20分</button>
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

      {/* FAB & MENU */}
      {activeTab === "edit" && (
        <>
          <div className={`fixed inset-0 z-50 bg-black/20 backdrop-blur-sm transition-opacity ${isAddMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsAddMenuOpen(false)}>
            <div className={`fixed bottom-0 inset-x-0 bg-white rounded-t-[2rem] p-6 pb-safe transition-transform duration-300 ${isAddMenuOpen ? 'translate-y-0' : 'translate-y-full'}`} onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <h3 className="text-center font-bold text-lg mb-6 text-slate-800">コンテンツを追加</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <AddMenuBtn label="ご挨拶" icon={MessageSquare} color="text-orange-600 bg-orange-50" onClick={() => addBlock("greeting")} />
                <AddMenuBtn label="プログラム" icon={Music} color="text-blue-600 bg-blue-50" onClick={() => addBlock("program")} />
                <AddMenuBtn label="出演者" icon={User} color="text-green-600 bg-green-50" onClick={() => addBlock("profile")} />
                <AddMenuBtn label="ギャラリー" icon={Grid} color="text-pink-600 bg-pink-50" onClick={() => addBlock("gallery")} />
                <AddMenuBtn label="フリーテキスト" icon={Info} color="text-indigo-600 bg-indigo-50" onClick={() => addBlock("free")} />
              </div>
            </div>
          </div>
          <button onClick={() => setIsAddMenuOpen(true)} className="fixed bottom-24 right-6 z-40 w-16 h-16 bg-slate-900 text-white rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-90 hover:scale-105">
            <Plus size={32} />
          </button>
        </>
      )}

      {/* BOTTOM NAV */}
      <nav className="fixed bottom-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-200 pb-safe flex justify-around items-center h-[3.5rem]">
        <NavBtn active={activeTab === "edit"} onClick={() => setActiveTab("edit")} icon={Edit3} label="編集" />
        <NavBtn active={activeTab === "live"} onClick={() => setActiveTab("live")} icon={MonitorPlay} label="本番" />
      </nav>

    </div>
  );
}

// --- SUB COMPONENTS ---

function NavBtn({ active, onClick, icon: Icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${active ? 'text-slate-900' : 'text-slate-400'}`}>
      <Icon size={24} strokeWidth={active?2.5:2} className={`transition-transform ${active?'scale-110':'scale-100'}`} />
      <span className="text-[10px] font-bold mt-1">{label}</span>
    </button>
  );
}

function AddMenuBtn({ label, icon: Icon, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-3 p-4 rounded-3xl active:scale-95 transition-transform hover:bg-slate-50 border border-transparent ${color}`}>
      <Icon size={28} />
      <span className="text-xs font-bold text-slate-700">{label}</span>
    </button>
  );
}

// --- ACCORDION BLOCK CARD ---
function BlockCard({ block, index, total, isExpanded, onToggle, onSave, onMove, onDelete, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Sync content when block changes or expands
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

  // Icons & Labels
  const iconMap: any = { greeting: MessageSquare, program: Music, profile: User, gallery: Grid, free: Info };
  const TypeIcon = iconMap[block.type] || Edit3;
  const labels: any = { greeting: "ご挨拶", program: "プログラム", profile: "出演者", gallery: "ギャラリー", free: "フリーテキスト" };
  const badgeColors: any = { greeting: "text-orange-500 bg-orange-50", program: "text-blue-500 bg-blue-50", profile: "text-green-500 bg-green-50", gallery: "text-pink-500 bg-pink-50", free: "text-indigo-500 bg-indigo-50" };

  return (
    <div className={`bg-white rounded-[1.5rem] shadow-sm transition-all duration-300 overflow-hidden ${isExpanded ? 'ring-2 ring-slate-900 shadow-lg' : 'hover:shadow-md'}`}>
      
      {/* HEADER (Always Visible) */}
      <div className="flex items-center justify-between p-4 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center gap-3">
           <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badgeColors[block.type] || 'bg-slate-100'}`}>
             <TypeIcon size={18} />
           </div>
           <div>
             <div className="text-sm font-bold text-slate-800">{labels[block.type]}</div>
             {!isExpanded && <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                {block.type === 'free' ? content.title : block.type === 'greeting' ? content.author : 'タップして編集'}
             </div>}
           </div>
        </div>
        
        {/* Actions (Only Sort when collapsed, or basic actions) */}
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
           {!isExpanded && (
             <>
               <button onClick={() => onMove(block.id, "up")} disabled={index===0} className="p-2 text-slate-300 hover:text-slate-600 disabled:opacity-0"><ArrowUp size={20}/></button>
               <button onClick={() => onMove(block.id, "down")} disabled={index===total-1} className="p-2 text-slate-300 hover:text-slate-600 disabled:opacity-0"><ArrowDown size={20}/></button>
             </>
           )}
           <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''} text-slate-300 ml-2`}>
             <ChevronDown size={20} />
           </div>
        </div>
      </div>

      {/* BODY (Expanded Only) */}
      {isExpanded && (
        <div className="p-5 pt-0 border-t border-slate-50 animate-in slide-in-from-top-2">
           <div className="py-4 space-y-5">
              
              {/* === Greeting === */}
              {block.type === "greeting" && (
                <>
                  <div className="flex gap-4">
                    <div className="relative w-20 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                      {content.image ? <img src={content.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-8 text-slate-300"/>}
                      <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 cursor-pointer"><Upload size={16} className="text-white"/></label>
                      <input type="file" className="hidden" onChange={e => handleUpload(e, 'single')} />
                    </div>
                    <div className="flex-1 space-y-3">
                      <input className="w-full bg-slate-50 p-3 rounded-xl text-base outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all" placeholder="お名前" value={content.author||""} onChange={e => handleChange({...content, author: e.target.value})} />
                      <input className="w-full bg-slate-50 p-3 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all" placeholder="肩書き" value={content.role||""} onChange={e => handleChange({...content, role: e.target.value})} />
                    </div>
                  </div>
                  <textarea className="w-full bg-slate-50 p-3 rounded-xl text-base h-32 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 transition-all resize-none" placeholder="挨拶文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
                </>
              )}

              {/* === Free Text === */}
              {block.type === "free" && (
                 <>
                   <input className="w-full bg-slate-50 p-3 rounded-xl text-base font-bold outline-none focus:bg-white focus:ring-2 focus:ring-slate-900" placeholder="タイトル" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
                   <textarea className="w-full bg-slate-50 p-3 rounded-xl text-base h-32 outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 resize-none" placeholder="本文" value={content.text||""} onChange={e => handleChange({...content, text: e.target.value})} />
                 </>
              )}

              {/* === Gallery === */}
              {block.type === "gallery" && (
                 <>
                   <input className="w-full bg-slate-50 p-3 rounded-xl text-base font-bold outline-none focus:bg-white focus:ring-2 focus:ring-slate-900" placeholder="タイトル" value={content.title||""} onChange={e => handleChange({...content, title: e.target.value})} />
                   <div className="grid grid-cols-3 gap-3">
                      {(content.images || (content.url ? [content.url] : [])).map((url:string, i:number) => (
                         <div key={i} className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden">
                           <img src={url} className="w-full h-full object-cover" alt="" />
                           <button onClick={() => handleChange({...content, images: (content.images||[content.url]).filter((_:any,idx:number)=>idx!==i)})} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1"><X size={12}/></button>
                         </div>
                      ))}
                      <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 cursor-pointer">
                         {uploading ? <Loader2 className="animate-spin"/> : <Plus />}
                         <input type="file" className="hidden" accept="image/*" onChange={e => handleUpload(e, 'gallery')} />
                      </label>
                   </div>
                   <input className="w-full bg-slate-50 p-3 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-slate-900" placeholder="キャプション" value={content.caption||""} onChange={e => handleChange({...content, caption: e.target.value})} />
                 </>
              )}

              {/* === Profile === */}
              {block.type === "profile" && (
                <div className="space-y-4">
                  {(content.people || []).map((p: any, i: number) => (
                    <div key={i} className="flex gap-4 p-3 bg-slate-50 rounded-2xl relative">
                      <div className="relative w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0">
                        {p.image ? <img src={p.image} className="w-full h-full object-cover" alt=""/> : <User className="m-auto mt-4 text-slate-300"/>}
                        <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 cursor-pointer"><Upload size={14} className="text-white"/><input type="file" className="hidden" onChange={e => handleUpload(e, 'profile', i)} /></label>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input className="w-full bg-white px-3 py-2 rounded-lg text-base font-bold outline-none focus:ring-1 focus:ring-slate-900" placeholder="名前" value={p.name} onChange={e => {const np=[...content.people]; np[i].name=e.target.value; handleChange({...content, people:np})}} />
                        <input className="w-full bg-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-1 focus:ring-slate-900" placeholder="役割" value={p.role} onChange={e => {const np=[...content.people]; np[i].role=e.target.value; handleChange({...content, people:np})}} />
                        <textarea className="w-full bg-white px-3 py-2 rounded-lg text-sm h-20 outline-none focus:ring-1 focus:ring-slate-900 resize-none" placeholder="詳細" value={p.bio} onChange={e => {const np=[...content.people]; np[i].bio=e.target.value; handleChange({...content, people:np})}} />
                      </div>
                      <button onClick={() => handleChange({...content, people: content.people.filter((_:any,idx:number)=>idx!==i)})} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => handleChange({...content, people: [...(content.people||[]), {name:"",role:"",bio:"",image:""}]})} className="w-full py-3 bg-white border border-slate-200 text-slate-500 rounded-xl font-bold text-sm">+ 出演者を追加</button>
                </div>
              )}

              {/* === Program (Vertical Stack for Mobile) === */}
              {block.type === "program" && (
                 <div className="space-y-3">
                   {(content.items || []).map((item: any, i: number) => {
                     const isBreak = item.type === "break";
                     return (
                       <div key={i} className="p-3 bg-slate-50 rounded-2xl relative space-y-3">
                         <div className="flex gap-2">
                            <input className="flex-1 bg-white px-3 py-2 rounded-lg text-base font-bold outline-none focus:ring-1 focus:ring-slate-900" placeholder={isBreak?"休憩名":"曲名"} value={item.title} onChange={e => { const ni=[...content.items]; ni[i].title=e.target.value; handleChange({...content, items:ni}); }} />
                            <button onClick={() => { const ni=content.items.filter((_:any,idx:number)=>idx!==i); handleChange({...content, items:ni}); }} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={18}/></button>
                         </div>
                         {isBreak ? (
                            <input className="w-full bg-white px-3 py-2 rounded-lg text-sm outline-none" placeholder="時間 (例: 15分)" value={item.duration} onChange={e => { const ni=[...content.items]; ni[i].duration=e.target.value; handleChange({...content, items:ni}); }} />
                         ) : (
                           <>
                             <div className="flex gap-2 items-center">
                                <input className="flex-1 bg-white px-3 py-2 rounded-lg text-sm outline-none" placeholder="作曲者" value={item.composer} onChange={e => { const ni=[...content.items]; ni[i].composer=e.target.value; handleChange({...content, items:ni}); }} />
                                <button onClick={() => { const ni=[...content.items]; ni[i].isEncore=!ni[i].isEncore; handleChange({...content, items:ni}); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${item.isEncore?'bg-pink-500 text-white':'bg-white text-slate-400 border'}`}>Encore</button>
                             </div>
                             <textarea className="w-full bg-white px-3 py-2 rounded-lg text-sm h-16 outline-none resize-none" placeholder="曲解説" value={item.description} onChange={e => { const ni=[...content.items]; ni[i].description=e.target.value; handleChange({...content, items:ni}); }} />
                           </>
                         )}
                       </div>
                     )
                   })}
                   <div className="flex gap-2 pt-2">
                     <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"song",title:"",composer:"",description:"",isEncore:false}]})} className="flex-1 py-3 bg-white border border-blue-200 text-blue-600 font-bold rounded-xl text-sm">+ 曲</button>
                     <button onClick={() => handleChange({...content, items: [...(content.items||[]), {type:"break",title:"休憩",duration:"15分"}]})} className="flex-1 py-3 bg-white border border-slate-200 text-slate-500 font-bold rounded-xl text-sm">+ 休憩</button>
                   </div>
                 </div>
              )}

           </div>

           {/* FOOTER ACTIONS */}
           <div className="flex items-center justify-between pt-4 border-t border-slate-100">
             <button onClick={() => onDelete(block.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={20}/></button>
             {isDirty && (
                <button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold shadow-lg flex items-center gap-2 active:scale-95 transition-transform">
                  {saving ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} 保存
                </button>
             )}
           </div>
        </div>
      )}
    </div>
  );
}