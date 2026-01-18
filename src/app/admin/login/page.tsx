"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, Mail, Lock } from "lucide-react";
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

  // --- ソーシャルログイン処理 ---
  async function handleOAuth(provider: 'google') {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        // ログイン後に戻ってくるURL
        redirectTo: `${window.location.origin}/admin`,
      },
    });

    if (error) {
      setMsg(error.message);
      setLoading(false);
    }
  }

  // --- メールログイン処理 ---
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setMsg(error.message);
      else setMsg("確認メールを送信しました。");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("ログインに失敗しました。");
      else router.push("/admin");
    }
    setLoading(false);
  }

  return (
    <div className={cn(
      "min-h-screen bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 flex items-center justify-center p-6",
      mincho.className
    )}>
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      <div className="relative z-10 w-full max-w-md">
        
        <Link href="/" className="absolute -top-16 left-0 flex items-center gap-2 text-[#2C2C2C]/40 hover:text-[#2C2C2C] transition-colors">
           <ArrowLeft size={20}/>
           <span className="text-xs font-bold tracking-widest font-sans">BACK TO HOME</span>
        </Link>

        <div className="bg-white/80 backdrop-blur-md rounded-[2rem] p-8 shadow-xl border border-[#2C2C2C]/5">
           <div className="text-center mb-8">
              <h1 className={cn("text-3xl font-bold mb-2 tracking-[0.1em]", cinzel.className)}>Tenote</h1>
              <p className="text-xs text-[#2C2C2C]/50 font-sans tracking-widest">DIGITAL PAMPHLET SERVICE</p>
           </div>

           {/* --- OAuth Buttons (Google Only) --- */}
           <div className="space-y-3 mb-8">
             <button 
               onClick={() => handleOAuth('google')}
               className="w-full h-12 bg-white border border-[#2C2C2C]/10 rounded-xl flex items-center justify-center gap-3 hover:bg-[#F9F8F2] hover:border-[#B48E55]/30 transition-all shadow-sm text-sm font-bold tracking-wide group"
             >
               {/* Google Icon SVG */}
               <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                 <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                 <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                 <path d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" fill="#FBBC05" />
                 <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
               </svg>
               Googleで続ける
             </button>
           </div>

           <div className="flex items-center gap-4 mb-8">
             <div className="h-px flex-1 bg-[#2C2C2C]/10"></div>
             <span className="text-[10px] text-[#2C2C2C]/40 font-bold tracking-widest">OR EMAIL</span>
             <div className="h-px flex-1 bg-[#2C2C2C]/10"></div>
           </div>

           <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-4 text-[#2C2C2C]/30"/>
                <input 
                  type="email" 
                  required
                  className="w-full bg-[#F9F8F2] pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#B48E55] transition-all font-sans border border-[#2C2C2C]/5"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-4 top-4 text-[#2C2C2C]/30"/>
                <input 
                  type="password" 
                  required
                  className="w-full bg-[#F9F8F2] pl-12 pr-4 py-3.5 rounded-xl text-sm outline-none focus:ring-1 focus:ring-[#B48E55] transition-all font-sans border border-[#2C2C2C]/5"
                  placeholder="パスワード"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {msg && <p className="text-center text-xs text-red-500 font-bold">{msg}</p>}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 border border-[#2C2C2C] text-[#2C2C2C] hover:bg-[#2C2C2C] hover:text-white rounded-xl text-sm font-bold tracking-widest transition-all flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18}/> : (isSignUp ? "メールで登録" : "メールでログイン")}
              </button>
           </form>

           <div className="mt-6 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setMsg(""); }}
                className="text-[10px] text-[#2C2C2C]/50 hover:text-[#B48E55] transition-colors font-bold underline underline-offset-4"
              >
                {isSignUp ? "すでにアカウントをお持ちの方はこちら" : "メールアドレスで新規登録する"}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}