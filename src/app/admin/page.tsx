"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  LogOut, 
  Loader2, 
  Edit3, 
  MonitorPlay, 
  Eye, 
  Calendar, 
  MapPin, 
  LayoutTemplate,
  Trash2,
  Sparkles,
  PenTool
} from "lucide-react";
import { Cinzel, Zen_Old_Mincho } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts ---
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] });
const mincho = Zen_Old_Mincho({ subsets: ["latin"], weight: ["400", "700", "900"] });

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Supabase Client ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.push("/login");
      return;
    }
    setUser(u.user);

    const { data } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    setEvents(data ?? []);
    setLoading(false);
  }

  function slugify(s: string) {
    const base = s.trim().toLowerCase()
      .replace(/[^\w\s-]/g, '') 
      .replace(/[\s_-]+/g, '-') 
      .replace(/^-+|-+$/g, '') || "event";
    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);

    const slug = slugify(newTitle);
    const { data, error } = await supabase
      .from("events")
      .insert({
        owner_id: user.id,
        slug,
        title: newTitle,
        status: "draft",
      })
      .select("*")
      .single();

    if (!error && data) {
      // 初期データの投入
      await supabase.from("blocks").insert([
        {
          event_id: data.id,
          type: "greeting",
          sort_order: 10,
          content: { text: "ご来場いただき、誠にありがとうございます。\n本日はごゆっくりお楽しみください。", author: "主催者", role: "Organizer" },
        },
        {
          event_id: data.id,
          type: "program",
          sort_order: 20,
          content: { items: [
            { type: "section", title: "第1部" },
            { type: "song", title: "曲名を入力してください", composer: "作曲者名", description: "曲の解説文をここに入力します。" }
          ]},
        },
        {
          event_id: data.id,
          type: "profile",
          sort_order: 30,
          content: { people: [{ name: "出演者名", role: "Part", bio: "プロフィール文を入力してください。" }] },
        },
      ]);
      router.push(`/admin/events/${data.id}`);
    } else {
      alert("作成に失敗しました");
      setCreating(false);
    }
  }

  // --- 削除機能 ---
  async function deleteEvent(eventId: string) {
    if (!confirm("本当にこの公演を削除しますか？\n※この操作は取り消せません")) return;

    // UIをキビキビ動かすために、サーバー完了を待たずにリストから消す
    setEvents((prev) => prev.filter((e) => e.id !== eventId));

    const { error } = await supabase.from("events").delete().eq("id", eventId);
    if (error) {
      alert("削除に失敗しました: " + error.message);
      load(); // 失敗したら念のためリロードして元に戻す
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F9F8F2] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#B48E55]" size={30} />
    </div>
  );

  return (
    <div className={cn(
      "min-h-screen bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 font-sans pb-32",
      mincho.className
    )}>
      {/* Paper Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F9F8F2]/90 backdrop-blur-md border-b border-[#2C2C2C]/5 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-[#2C2C2C] text-[#F9F8F2] rounded-full flex items-center justify-center shadow-sm">
              <LayoutTemplate size={14} />
           </div>
           <span className={cn("text-sm font-bold tracking-[0.1em]", cinzel.className)}>DASHBOARD</span>
        </div>
        <button onClick={signOut} className="w-8 h-8 flex items-center justify-center text-[#2C2C2C]/40 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title="Sign Out">
           <LogOut size={16} />
        </button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        
        {/* Welcome Text */}
        <section className="mb-10 text-center md:text-left">
           <h1 className="text-2xl font-bold mb-1">Welcome back.</h1>
           <p className="text-xs opacity-50 font-sans tracking-wide">あなたの手で、新しい音楽の時間を。</p>
        </section>

        {/* --- NEW CREATE SECTION (Invitation Style) --- */}
        <section className="mb-16">
          <div className="relative bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-[#2C2C2C]/5 p-8 md:p-12 overflow-hidden text-center max-w-2xl mx-auto">
            
            {/* Decoration Lines */}
            <div className="absolute top-3 left-3 w-4 h-4 border-t border-l border-[#B48E55]/30"></div>
            <div className="absolute top-3 right-3 w-4 h-4 border-t border-r border-[#B48E55]/30"></div>
            <div className="absolute bottom-3 left-3 w-4 h-4 border-b border-l border-[#B48E55]/30"></div>
            <div className="absolute bottom-3 right-3 w-4 h-4 border-b border-r border-[#B48E55]/30"></div>

            {/* Label */}
            <div className={cn("text-[10px] font-bold tracking-[0.3em] text-[#B48E55] mb-6 uppercase flex items-center justify-center gap-2", cinzel.className)}>
              <Sparkles size={10} />
              Create New Concert
              <Sparkles size={10} />
            </div>

            <form onSubmit={createEvent} className="relative z-10">
              <div className="mb-8">
                <input 
                  autoFocus
                  className="w-full text-center text-2xl md:text-3xl font-bold bg-transparent border-b border-[#2C2C2C]/10 pb-4 outline-none focus:border-[#B48E55] transition-colors placeholder:text-[#2C2C2C]/10 placeholder:font-normal"
                  placeholder="ここにタイトルを記す"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  disabled={creating}
                />
              </div>

              <button 
                type="submit" 
                disabled={creating || !newTitle.trim()}
                className="group relative inline-flex items-center justify-center px-8 py-3 bg-[#2C2C2C] text-[#F9F8F2] text-xs font-bold tracking-[0.2em] rounded-full overflow-hidden hover:bg-[#404040] transition-all disabled:opacity-50 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                {creating ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    <span className="relative z-10 flex items-center gap-2">
                      <PenTool size={12} />
                      パンフレットを作成する
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* --- PROJECTS GRID --- */}
        <div className="flex items-center gap-4 mb-6 opacity-30">
          <div className="h-px flex-1 bg-[#2C2C2C]"></div>
          <span className={cn("text-[10px] tracking-[0.2em]", cinzel.className)}>ARCHIVES</span>
          <div className="h-px flex-1 bg-[#2C2C2C]"></div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {events.map((e) => (
             <div key={e.id} className="group bg-white rounded-lg overflow-hidden border border-[#2C2C2C]/5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col relative">
                
                {/* 削除ボタン（ゴミ箱） */}
                <button 
                  onClick={() => deleteEvent(e.id)}
                  className="absolute top-2 right-2 z-20 w-8 h-8 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-[#2C2C2C]/30 hover:text-red-500 hover:bg-white transition-all opacity-100 md:opacity-0 group-hover:opacity-100 shadow-sm"
                  title="この公演を削除"
                >
                   <Trash2 size={14} />
                </button>

                {/* Card Header */}
                <div className="h-32 bg-[#F2F0E9] relative overflow-hidden group-hover:opacity-90 transition-opacity">
                   {e.cover_image ? (
                      <img src={e.cover_image} className="w-full h-full object-cover" alt="" />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-10">
                         <LayoutTemplate size={28} />
                      </div>
                   )}
                   {/* Preview Button */}
                   <Link href={`/e/${e.slug}`} target="_blank" className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-[#2C2C2C] hover:text-[#B48E55] transition-colors shadow-sm z-10">
                      <Eye size={14} />
                   </Link>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                   <h3 className="text-base font-bold mb-3 line-clamp-2 leading-relaxed group-hover:text-[#B48E55] transition-colors">{e.title}</h3>
                   
                   <div className="mt-auto space-y-4">
                      {/* Meta Info */}
                      <div className="flex flex-col gap-1.5 text-[10px] text-[#2C2C2C]/40 font-sans border-b border-[#2C2C2C]/5 pb-3">
                         <div className="flex items-center gap-2">
                            <Calendar size={10} />
                            {e.date ? new Date(e.date).toLocaleDateString() : "No Date"}
                         </div>
                         <div className="flex items-center gap-2">
                            <MapPin size={10} />
                            {e.location || "No Location"}
                         </div>
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-2 gap-2">
                         <Link href={`/admin/events/${e.id}`} className="py-2.5 bg-[#F9F8F2] border border-[#2C2C2C]/5 text-[#2C2C2C] rounded text-[10px] font-bold flex items-center justify-center gap-1.5 hover:border-[#B48E55]/50 transition-colors">
                            <Edit3 size={10} /> 編集画面
                         </Link>
                         <Link href={`/admin/events/${e.id}/live`} className="py-2.5 bg-[#2C2C2C] text-white rounded text-[10px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#404040] transition-colors shadow-sm">
                            <MonitorPlay size={10} /> 本番モード
                         </Link>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {/* Empty State */}
           {events.length === 0 && !loading && (
              <div className="col-span-full py-24 text-center">
                 <p className="text-sm opacity-20 font-sans mb-2">まだ公演の記録はありません</p>
              </div>
           )}
        </section>

      </main>
    </div>
  );
}