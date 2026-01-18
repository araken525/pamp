"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Sparkles,
  AlertCircle,
  CheckCircle2
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

// --- Supabase Client (Defined locally for safety) ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  async function signIn() {
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    
    if (error) {
      setMsg({ type: 'error', text: error.message });
      setLoading(false);
    } else {
      setMsg({ type: 'success', text: "ログイン成功。管理画面へ移動します..." });
      setTimeout(() => router.push('/admin'), 1000);
    }
  }

  async function signUp() {
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: "確認メールを送信しました。承認後にログインしてください。" });
    }
    setLoading(false);
  }

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center bg-[#F9F8F2] p-6 text-[#2C2C2C] selection:bg-[#B48E55]/20",
      mincho.className
    )}>
      {/* Paper Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      <div className="w-full max-w-md relative z-10">
        
        {/* Card Container */}
        <div className="bg-white/60 backdrop-blur-md rounded-3xl p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-[#2C2C2C]/5">
          
          {/* Header */}
          <div className="text-center mb-10 space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#2C2C2C] text-[#B48E55] mb-4 shadow-md">
               <Sparkles size={20} />
            </div>
            <h1 className={cn("text-2xl font-bold tracking-[0.2em]", cinzel.className)}>
              Admin Login
            </h1>
            <p className="text-xs opacity-50 font-sans tracking-wide">PAMP 管理画面へサインイン</p>
          </div>

          {/* Form */}
          <div className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2C2C2C]/30 group-focus-within:text-[#B48E55] transition-colors" size={18} />
                <input
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white border border-[#2C2C2C]/10 outline-none focus:border-[#B48E55] transition-all font-sans text-sm shadow-sm"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#2C2C2C]/30 group-focus-within:text-[#B48E55] transition-colors" size={18} />
                <input
                  className="w-full h-12 pl-12 pr-4 rounded-xl bg-white border border-[#2C2C2C]/10 outline-none focus:border-[#B48E55] transition-all font-sans text-sm shadow-sm"
                  placeholder="••••••••"
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 space-y-3">
              <button
                onClick={signIn}
                disabled={loading}
                className="w-full h-12 rounded-full bg-[#2C2C2C] text-[#F9F8F2] text-sm font-bold tracking-widest shadow-lg hover:bg-[#4a4a4a] active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={18}/> : <>Sign In <ArrowRight size={16}/></>}
              </button>
              
              <button 
                onClick={signUp} 
                disabled={loading}
                className="w-full py-2 text-xs font-bold text-[#2C2C2C]/50 hover:text-[#B48E55] transition-colors underline decoration-transparent hover:decoration-[#B48E55]"
              >
                アカウントをお持ちでない方は登録 (Sign Up)
              </button>
            </div>
          </div>

          {/* Feedback Message */}
          {msg && (
            <div className={cn(
              "mt-6 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed animate-in slide-in-from-top-2",
              msg.type === 'error' ? "bg-red-50 text-red-600 border border-red-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
            )}>
              {msg.type === 'error' ? <AlertCircle size={16} className="shrink-0 mt-0.5"/> : <CheckCircle2 size={16} className="shrink-0 mt-0.5"/>}
              <p>{msg.text}</p>
            </div>
          )}

        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <Link href="/" className="text-xs font-bold opacity-30 hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
             Top Page
          </Link>
        </div>

      </div>
    </div>
  );
}