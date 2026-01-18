"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { 
  ArrowRight, 
  Sparkles, 
  Smartphone, 
  Zap,
  Music,
  Feather
} from "lucide-react";
import { Cinzel, Zen_Old_Mincho } from 'next/font/google';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Fonts ---
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "700"] });
const mincho = Zen_Old_Mincho({ subsets: ["latin"], weight: ["400", "700", "900"] });

// --- Utils (Defined Locally to avoid import errors) ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function LandingPage() {
  return (
    <div className={cn(
      "min-h-screen bg-[#F9F8F2] text-[#2C2C2C] selection:bg-[#B48E55]/20 overflow-x-hidden",
      mincho.className
    )}>
      {/* Paper Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply opacity-[0.04]" 
           style={{backgroundImage: `url("https://www.transparenttextures.com/patterns/cream-paper.png")`}}></div>

      {/* --- HERO SECTION --- */}
      <header className="relative z-10 px-6 pt-32 pb-20 md:pt-48 md:pb-32 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2C2C2C]/10 bg-white/50 backdrop-blur-sm">
            <span className={cn("text-[10px] tracking-[0.2em] font-bold uppercase opacity-60", cinzel.className)}>
              PAMP : Prototype
            </span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-[#2C2C2C]">
            紙の温もりを、<br className="md:hidden"/>デジタルの手軽さで。
          </h1>

          {/* Subtitle */}
          <p className="text-sm md:text-base leading-8 opacity-70 max-w-xl mx-auto font-sans">
            演奏会のプログラムを、もっと自由に、もっと美しく。<br/>
            URLひとつで届ける、次世代のデジタルパンフレット作成サービス。
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/login" className="w-full sm:w-auto px-8 py-4 bg-[#2C2C2C] text-[#F9F8F2] rounded-full text-sm font-bold tracking-widest shadow-lg hover:bg-[#4a4a4a] transition-all flex items-center justify-center gap-2 group">
              <Sparkles size={16} className="text-[#B48E55]"/>
              <span>はじめる</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
            </Link>
            <Link href="#viewer-input" className="w-full sm:w-auto px-8 py-4 bg-white border border-[#2C2C2C]/10 text-[#2C2C2C] rounded-full text-sm font-bold tracking-widest hover:bg-[#F2F0E9] transition-all">
              パンフレットを見る
            </Link>
          </div>
        </motion.div>
      </header>

      {/* --- FEATURES SECTION --- */}
      <section className="relative z-10 py-20 px-6 bg-white/40 border-t border-[#2C2C2C]/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={cn("text-2xl font-bold tracking-[0.2em] mb-2", cinzel.className)}>Why PAMP?</h2>
            <p className="text-xs opacity-50 font-sans">選ばれる3つの理由</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#F9F8F2] p-8 rounded-2xl border border-[#2C2C2C]/5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#2C2C2C] text-[#F9F8F2] rounded-full flex items-center justify-center mb-6">
                <Feather size={20}/>
              </div>
              <h3 className="text-lg font-bold mb-3">美しい質感</h3>
              <p className="text-sm leading-7 opacity-70 font-sans">
                まるで上質な紙のような手触りを感じさせるデザイン。
                明朝体を基調とした縦書き・横書きの美しい文字組みを自動で生成します。
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#F9F8F2] p-8 rounded-2xl border border-[#2C2C2C]/5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-[#B48E55] text-white rounded-full flex items-center justify-center mb-6">
                <Zap size={20}/>
              </div>
              <h3 className="text-lg font-bold mb-3">直前の変更も即座に</h3>
              <p className="text-sm leading-7 opacity-70 font-sans">
                印刷物と違い、曲順の変更や出演者の追加も一瞬で反映。
                「アンコール曲」を終演後まで隠しておく演出も可能です。
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#F9F8F2] p-8 rounded-2xl border border-[#2C2C2C]/5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-white border border-[#2C2C2C]/10 text-[#2C2C2C] rounded-full flex items-center justify-center mb-6">
                <Smartphone size={20}/>
              </div>
              <h3 className="text-lg font-bold mb-3">アプリ不要</h3>
              <p className="text-sm leading-7 opacity-70 font-sans">
                QRコードやリンクを共有するだけ。
                専用アプリのインストールは不要で、あらゆるスマホで快適に閲覧できます。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- VIEWER INPUT SECTION --- */}
      <section id="viewer-input" className="relative z-10 py-24 px-6 text-center">
        <div className="max-w-xl mx-auto space-y-8">
          <div>
            <Music size={32} className="mx-auto mb-4 opacity-30"/>
            <h2 className="text-2xl font-bold mb-2">パンフレットを開く</h2>
            <p className="text-sm opacity-60 font-sans">
              お手持ちのイベントID（Slug）を入力してください
            </p>
          </div>

          <form 
            className="flex flex-col sm:flex-row gap-3"
            action="/e"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget as HTMLFormElement;
              const fd = new FormData(form);
              const slug = String(fd.get("slug") ?? "").trim();
              if (!slug) return;
              window.location.href = `/e/${encodeURIComponent(slug)}`;
            }}
          >
            <input 
              name="slug"
              placeholder="Example: concert-2026" 
              className="flex-1 h-14 px-6 rounded-full bg-white border border-[#2C2C2C]/10 outline-none focus:border-[#B48E55] transition-colors font-sans text-sm"
            />
            <button type="submit" className="h-14 px-8 bg-[#2C2C2C] text-white rounded-full text-sm font-bold tracking-wider hover:bg-[#4a4a4a] transition-colors">
              開く
            </button>
          </form>
          
          <div className="pt-8 border-t border-[#2C2C2C]/10">
             <p className="text-xs opacity-50 font-sans mb-4">管理者の方はこちら</p>
             <Link href="/admin" className="text-sm font-bold border-b border-[#2C2C2C] pb-0.5 hover:opacity-60 transition-opacity">
                管理画面へログイン →
             </Link>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="relative z-10 py-12 text-center border-t border-[#2C2C2C]/5">
        <p className={cn("text-xs font-bold tracking-[0.2em] opacity-30", cinzel.className)}>
          PAMP - Digital Pamphlet Service
        </p>
        <p className="text-[10px] opacity-30 mt-2 font-sans">© 2026 PAMP Prototype. All Rights Reserved.</p>
      </footer>
    </div>
  );
}