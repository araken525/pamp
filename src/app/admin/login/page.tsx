"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function signIn() {
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setMsg(error ? error.message : "ログインしました。/admin を開いてください。");
  }

  async function signUp() {
    setMsg(null);
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    setMsg(
      error
        ? error.message
        : "登録しました。確認メールが来る設定の場合は承認後にログインできます。"
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Pamp Admin Login</h1>

        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="w-full rounded-xl border p-3"
            placeholder="password"
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />

          <div className="flex gap-2">
            <button
              onClick={signIn}
              className="flex-1 rounded-xl bg-black text-white py-3"
            >
              Sign in
            </button>
            <button onClick={signUp} className="flex-1 rounded-xl border py-3">
              Sign up
            </button>
          </div>

          {msg ? <p className="text-sm text-zinc-600">{msg}</p> : null}

          <div className="pt-2">
            <Link className="text-sm underline" href="/admin">
              Adminへ
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
