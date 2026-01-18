"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  LogOut, 
  Loader2, 
  Edit3, 
  MonitorPlay, 
  Eye, 
  Calendar, 
  MapPin, 
  MoreVertical,
  LayoutTemplate
} from "lucide-react";
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
      .replace(/[^\w\s-]/g, '') // Remove non-word chars
      .replace(/[\s_-]+/g, '-') // Replace spaces with -
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
      // Default Blocks
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
      "min-h-screen bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 font-sans pb-20",
      mincho.className
    )}>
      {/* Paper Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F9F8F2]/90 backdrop-blur-md border-b border-[#2C2C2C]/5 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 bg-[#2C2C2C] text-[#F9F8F2] rounded-full flex items-center justify-center">
              <LayoutTemplate size={16} />
           </div>
           <span className={cn("text-lg font-bold tracking-widest", cinzel.className)}>Dashboard</span>
        </div>
        <button onClick={signOut} className="text-xs font-bold opacity-40 hover:opacity-100 flex items-center gap-2 hover:text-red-500 transition-colors">
           <LogOut size={14} /> <span>Sign Out</span>
        </button>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        
        {/* Welcome Section */}
        <section className="mb-12">
           <h1 className="text-3xl md:text-4xl font-bold mb-2">Welcome back.</h1>
           <p className="text-sm opacity-60 font-sans">作成したパンフレットの管理・編集</p>
        </section>

        {/* Create New Bar */}
        <section className="mb-16">
           <div className="bg-white p-2 rounded-full shadow-sm border border-[#2C2C2C]/5 flex items-center max-w-2xl">
              <div className="pl-4 pr-2">
                 <Plus className="text-[#B48E55]" size={20}/>
              </div>
              <form onSubmit={createEvent} className="flex-1 flex gap-2">
                 <input 
                   className="flex-1 bg-transparent border-none outline-none text-sm font-sans placeholder:text-[#2C2C2C]/30 h-12"
                   placeholder="新しい公演タイトルを入力..."
                   value={newTitle}
                   onChange={(e) => setNewTitle(e.target.value)}
                   disabled={creating}
                 />
                 <button 
                   type="submit" 
                   disabled={creating || !newTitle.trim()}
                   className="bg-[#2C2C2C] text-white px-6 rounded-full text-xs font-bold tracking-wider hover:bg-[#404040] disabled:opacity-50 transition-colors h-10 my-auto"
                 >
                   {creating ? <Loader2 className="animate-spin" size={14}/> : "作成"}
                 </button>
              </form>
           </div>
        </section>

        {/* Projects Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {events.map((e) => (
             <div key={e.id} className="group bg-white rounded-xl overflow-hidden border border-[#2C2C2C]/5 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col">
                
                {/* Card Header (Image Placeholder or Cover) */}
                <div className="h-32 bg-stone-100 relative overflow-hidden">
                   {e.cover_image ? (
                      <img src={e.cover_image} className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-700" alt="" />
                   ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-10">
                         <LayoutTemplate size={32} />
                      </div>
                   )}
                   <div className="absolute top-3 right-3">
                      <Link href={`/e/${e.slug}`} target="_blank" className="w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center text-[#2C2C2C] hover:bg-[#B48E55] hover:text-white transition-colors shadow-sm" title="プレビュー">
                         <Eye size={14} />
                      </Link>
                   </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                   <h3 className="text-lg font-bold mb-2 line-clamp-2 leading-snug group-hover:text-[#B48E55] transition-colors">{e.title}</h3>
                   
                   <div className="mt-auto space-y-3 pt-4">
                      {/* Meta Info */}
                      <div className="flex flex-col gap-1.5 text-[10px] text-[#2C2C2C]/50 font-sans border-b border-[#2C2C2C]/5 pb-3">
                         <div className="flex items-center gap-1.5">
                            <Calendar size={10} />
                            {e.date ? new Date(e.date).toLocaleDateString() : "日付未定"}
                         </div>
                         <div className="flex items-center gap-1.5">
                            <MapPin size={10} />
                            {e.location || "場所未定"}
                         </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                         <Link href={`/admin/events/${e.id}`} className="flex-1 py-2 bg-[#2C2C2C] text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#404040] transition-colors">
                            <Edit3 size={12} /> 編集
                         </Link>
                         <Link href={`/admin/events/${e.id}/live`} className="flex-1 py-2 border border-[#2C2C2C]/10 text-[#2C2C2C] rounded-md text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#F2F0E9] transition-colors">
                            <MonitorPlay size={12} className="text-[#B48E55]" /> 本番
                         </Link>
                      </div>
                   </div>
                </div>
             </div>
           ))}

           {/* Empty State */}
           {events.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-[#2C2C2C]/10 rounded-2xl">
                 <p className="text-sm opacity-40 font-sans">作成されたパンフレットはありません</p>
                 <p className="text-xs opacity-30 mt-2">上のフォームから新しい公演を作成してください</p>
              </div>
           )}
        </section>

      </main>
    </div>
  );
}