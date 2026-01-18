"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail, Lock, Sparkles } from "lucide-react";
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    if (isSignUp) {
      // Sign Up
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setMsg(error.message);
      } else {
        setMsg("確認メールを送信しました。");
      }
    } else {
      // Sign In
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMsg("ログインに失敗しました。");
      } else {
        router.push("/admin"); // ログイン成功で管理画面へ
      }
    }
    setLoading(false);
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 flex items-center justify-center p-6",
      mincho.className
    )}>
      {/* Paper Texture */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      <div className="relative z-10 w-full max-w-md">
        
        {/* Back Button */}
        <Link href="/" className="absolute -top-16 left-0 flex items-center gap-2 text-[#2C2C2C]/40 hover:text-[#2C2C2C] transition-colors">
           <ArrowLeft size={20}/>
           <span className="text-xs font-bold tracking-widest font-sans">BACK TO HOME</span>
        </Link>

        {/* Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-[#2C2C2C]/5">
           <div className="text-center mb-10">
              <h1 className={cn("text-3xl font-bold mb-2 tracking-[0.1em]", cinzel.className)}>Tenote</h1>
              <p className="text-xs text-[#2C2C2C]/50 font-sans tracking-widest">DIGITAL PAMPHLET SERVICE</p>
           </div>

           <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-[#2C2C2C]/40 tracking-widest ml-1 font-sans">EMAIL</label>
                 <div className="relative">
                    <Mail size={16} className="absolute left-4 top-4 text-[#2C2C2C]/30"/>
                    <input 
                      type="email" 
                      required
                      className="w-full bg-[#F9F8F2] pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#B48E55]/20 transition-all font-sans border border-[#2C2C2C]/5"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                 </div>
              </div>

              <div className="space-y-1">
                 <label className="text-[10px] font-bold text-[#2C2C2C]/40 tracking-widest ml-1 font-sans">PASSWORD</label>
                 <div className="relative">
                    <Lock size={16} className="absolute left-4 top-4 text-[#2C2C2C]/30"/>
                    <input 
                      type="password" 
                      required
                      className="w-full bg-[#F9F8F2] pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#B48E55]/20 transition-all font-sans border border-[#2C2C2C]/5"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                 </div>
              </div>

              {msg && <p className="text-center text-xs text-red-500 font-bold">{msg}</p>}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 bg-[#2C2C2C] text-[#F9F8F2] rounded-xl text-sm font-bold tracking-widest shadow-lg hover:bg-[#404040] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18}/> : (isSignUp ? "アカウント作成" : "ログイン")}
              </button>
           </form>

           <div className="mt-8 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setMsg(""); }}
                className="text-xs text-[#2C2C2C]/50 hover:text-[#B48E55] transition-colors font-bold underline underline-offset-4"
              >
                {isSignUp ? "すでにアカウントをお持ちの方はこちら" : "新しくアカウントを作成する"}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}