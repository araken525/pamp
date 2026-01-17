"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default function AdminHome() {
  const [events, setEvents] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setMsg("未ログインです。/admin/login へ");
      setEvents([]);
      return;
    }

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return setMsg(error.message);
    setEvents(data ?? []);
  }

  function slugify(s: string) {
    const base =
      s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "") || "event";
    return `${base}-${Math.random().toString(36).slice(2, 8)}`;
  }

  async function createEvent() {
    setMsg(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return setMsg("未ログインです");

    const slug = slugify(title || "pamp");
    const { data, error } = await supabase
      .from("events")
      .insert({
        owner_id: u.user.id,
        slug,
        title: title || "新しい公演",
        status: "draft",
      })
      .select("*")
      .single();

    if (error) return setMsg(error.message);

    // 最小ブロックを自動生成
    await supabase.from("blocks").insert([
      {
        event_id: data.id,
        type: "greeting",
        sort_order: 10,
        content: { text: "ご来場ありがとうございます。" },
      },
      {
        event_id: data.id,
        type: "program",
        sort_order: 20,
        content: { items: [{ title: "（曲目を入力）", note: "" }] },
      },
      {
        event_id: data.id,
        type: "profile",
        sort_order: 30,
        content: { people: [{ name: "（名前）", bio: "（経歴）" }] },
      },
    ]);

    setTitle("");
    await load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    await load();
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Admin</h1>
          <div className="flex gap-3">
            <Link className="text-sm underline" href="/admin/login">
              Login
            </Link>
            <button className="text-sm underline" onClick={signOut}>
              Logout
            </button>
          </div>
        </header>

        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-xl border p-3"
              placeholder="新規公演タイトル"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              className="rounded-xl bg-black text-white px-5"
              onClick={createEvent}
            >
              作成
            </button>
          </div>
          {msg ? <p className="mt-3 text-sm text-zinc-600">{msg}</p> : null}
        </div>

        <div className="space-y-3">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{e.title}</div>
                  <div className="text-sm text-zinc-600">
                    /e/{e.slug}（{e.status}）
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    className="underline text-sm"
                    href={`/e/${e.slug}`}
                    target="_blank"
                  >
                    Viewer
                  </Link>
                  <Link className="underline text-sm" href={`/admin/events/${e.id}`}>
                    Edit
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {events.length === 0 ? (
            <p className="text-sm text-zinc-600">公演がありません（ログイン要）</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
