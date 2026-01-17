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
  Sparkles,
  Palette,
  User,
  Music,
  MessageSquare,
  GripVertical,
  Loader2,
  Layout as LayoutIcon,
  Image as ImageIcon,
  Wand2,
  Eye,
  Camera,
  Upload,
  Coffee,
  Play,
  Pause,
  Zap,
  Lock,
  Unlock,
} from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = { params: Promise<{ id: string }> };
type Tab = "content" | "design" | "live";

function safeParseTheme(raw: any) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function ensureVariants(t: any) {
  const v = (t && typeof t === "object" ? t.variants : null) ?? {};
  return {
    hero: v.hero ?? "poster",
    card: v.card ?? "glass",
    program: v.program ?? "timeline",
  };
}

// 超雑なタグ化（文章→単語）
function toTags(description: string) {
  return description
    .split(/[\s,、。．・]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function EventEdit({ params }: Props) {
  const { id } = use(params);

  const [event, setEvent] = useState<any>(null);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("content");

  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cover image
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverImageDraft, setCoverImageDraft] = useState<string | null>(null);
  const [isCoverDirty, setIsCoverDirty] = useState(false);

  // Live
  const [encoreRevealed, setEncoreRevealed] = useState(false);

  // AI theme
  const [aiDescription, setAiDescription] = useState("");
  const [aiStyle, setAiStyle] = useState<"classic" | "modern" | "pop">("classic");
  const [aiTheme, setAiTheme] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Drag refs
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

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

    const { data: e, error: e1 } = await supabase.from("events").select("*").eq("id", id).single();
    if (e1) {
      showMsg(e1.message, true);
      return;
    }

    setEvent(e);
    setCoverImageDraft(e.cover_image ?? null);
    setIsCoverDirty(false);
    setEncoreRevealed(e.encore_revealed ?? false);

    const t = safeParseTheme(e.theme);
    if (t) setAiTheme(t);

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

  async function toggleEncore() {
    const next = !encoreRevealed;
    setEncoreRevealed(next);

    const { error } = await supabase.from("events").update({ encore_revealed: next }).eq("id", id);
    if (error) {
      showMsg(`更新失敗: ${error.message}`, true);
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

    // optimistic
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, items: newItems } } : b))
    );

    const { error } = await supabase
      .from("blocks")
      .update({ content: { ...target.content, items: newItems } })
      .eq("id", blockId);

    if (error) {
      showMsg("操作に失敗しました", true);
      load();
    }
  }

  async function generateTheme() {
    if (!aiDescription.trim()) {
      showMsg("イメージを入力してください", true);
      return;
    }
    setIsGenerating(true);
    setIsError(false);
    setMsg(null);

    try {
      const tags = toTags(aiDescription);
      const res = await fetch("/api/ai/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, style: aiStyle }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setAiTheme(json.theme);
      showMsg("AIがデザインを提案しました");
    } catch (e: any) {
      showMsg(`生成エラー: ${e.message}`, true);
    } finally {
      setIsGenerating(false);
    }
  }

  async function applyTheme() {
    if (!aiTheme) return;
    setLoading(true);

    // Ensure Viewer side can react to "AIっぽい" layout changes via theme.variants
    const themeToSave = {
      ...aiTheme,
      variants: ensureVariants(aiTheme),
    };

    // events.theme は jsonb 推奨。textでもobjectで渡せばSupabase側がjsonとして保存できる構成が多い
    const { error } = await supabase.from("events").update({ theme: themeToSave }).eq("id", id);

    if (error) {
      showMsg(error.message, true);
    } else {
      setEvent((prev: any) => ({ ...prev, theme: themeToSave }));
      setAiTheme(themeToSave);
      showMsg("デザインを適用しました（Viewerに反映されます）");
    }
    setLoading(false);
  }

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

  function cancelCoverChange() {
    setCoverImageDraft(event?.cover_image ?? null);
    setIsCoverDirty(false);
  }

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
      setActiveTab("content");
    }
  }

  async function saveBlockContent(blockId: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
    const { error } = await supabase.from("blocks").update({ content }).eq("id", blockId);
    if (error) throw error;
  }

  async function deleteBlock(blockId: string) {
    if (!confirm("削除しますか？")) return;

    const { error } = await supabase.from("blocks").delete().eq("id", blockId);
    if (error) showMsg(error.message, true);
    else setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }

  // Drag reorder (UI)
  const handleDragStart = (_e: any, position: number) => {
    dragItem.current = position;
  };

  const handleDragEnter = (_e: any, position: number) => {
    dragOverItem.current = position;
    const dragIndex = dragItem.current;
    if (dragIndex === null || dragIndex === position) return;

    const newBlocks = [...blocks];
    const dragged = newBlocks[dragIndex];
    newBlocks.splice(dragIndex, 1);
    newBlocks.splice(position, 0, dragged);

    dragItem.current = position;
    setBlocks(newBlocks);
  };

  const handleDragEnd = async () => {
    dragItem.current = null;
    dragOverItem.current = null;

    const updates = blocks.map((b, index) => ({ id: b.id, sort_order: (index + 1) * 10 }));
    try {
      await Promise.all(
        updates.map((u) => supabase.from("blocks").update({ sort_order: u.sort_order }).eq("id", u.id))
      );
      showMsg("並び順を保存しました");
    } catch {
      showMsg("並び順の保存に失敗しました", true);
      load();
    }
  };

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

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-300" />
      </div>
    );
  }

  const displayCover = coverImageDraft ?? event.cover_image;

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b shadow-sm">
        <div className="px-6 py-4 flex justify-between items-center">
          <div>
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Event Edit</div>
            <h1 className="text-lg font-bold truncate max-w-[240px] md:max-w-md">{event.title}</h1>
          </div>

          <div className="flex gap-3 items-center">
            {msg && (
              <span
                className={`text-xs font-bold px-3 py-1 rounded-full ${
                  isError ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                }`}
              >
                {msg}
              </span>
            )}

            <Link
              href={`/e/${event.slug}`}
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-bold rounded-full hover:bg-zinc-800 transition-all shadow-lg"
            >
              プレビュー <Eye size={14} />
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-t border-zinc-100 overflow-x-auto">
          <button
            onClick={() => setActiveTab("content")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "content"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <LayoutIcon size={16} /> 編集
          </button>

          <button
            onClick={() => setActiveTab("design")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "design"
                ? "border-purple-500 text-purple-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Palette size={16} /> デザイン
          </button>

          <button
            onClick={() => setActiveTab("live")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "live"
                ? "border-yellow-500 text-yellow-600"
                : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
          >
            <Zap size={16} /> 本番モード
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* TAB: content */}
        {activeTab === "content" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <AddButton icon={MessageSquare} label="挨拶" onClick={() => addBlock("greeting")} />
              <AddButton icon={ImageIcon} label="画像" onClick={() => addBlock("image")} />
              <AddButton icon={Music} label="曲目" onClick={() => addBlock("program")} />
              <AddButton icon={User} label="人物" onClick={() => addBlock("profile")} />
            </div>

            <div className="space-y-6">
              {blocks.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400">
                  <p className="text-sm">コンテンツを追加してください</p>
                </div>
              )}

              {blocks.map((b, i) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragEnter={(e) => handleDragEnter(e, i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="transition-transform duration-200"
                >
                  <BlockEditor
                    block={b}
                    index={i}
                    total={blocks.length}
                    onSave={saveBlockContent}
                    onMove={moveBlock}
                    onDelete={deleteBlock}
                    supabaseClient={supabase}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: design */}
        {activeTab === "design" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Cover */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold">
                <ImageIcon className="text-pink-500" size={20} />
                <h2>カバー画像設定</h2>
              </div>

              <div className="p-1 bg-white border rounded-2xl shadow-sm">
                <div className="relative w-full aspect-video rounded-xl bg-zinc-100 overflow-hidden group">
                  {displayCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayCover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300">
                      <ImageIcon size={48} className="opacity-20" />
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all cursor-pointer">
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-white font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                      {uploadingCover ? <Loader2 className="animate-spin" /> : <Camera size={20} />}
                      <span>変更する</span>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleCoverUpload} />
                  </label>
                </div>
              </div>

              {isCoverDirty && (
                <div className="flex justify-end gap-2">
                  <button onClick={cancelCoverChange} className="px-4 py-2 text-xs font-bold text-zinc-500 bg-zinc-100 rounded-full">
                    元に戻す
                  </button>
                  <button
                    onClick={saveCoverImage}
                    disabled={loading}
                    className="px-4 py-2 text-xs font-bold text-white bg-black rounded-full shadow-lg"
                  >
                    {loading ? "保存中..." : "変更を保存"}
                  </button>
                </div>
              )}
            </section>

            <hr className="border-dashed border-zinc-200" />

            {/* AI Theme */}
            <section className="space-y-6">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Sparkles className="text-purple-500 fill-purple-500" size={20} />
                <h2>AIで全体を自動でデザインする</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-xs text-zinc-500">
                    雰囲気を文章で入力 → 簡易タグ化して AI に渡します。<br />
                    （あとでタグUIに置き換え可能）
                  </p>

                  <textarea
                    className="w-full h-32 rounded-xl border border-zinc-300 p-4 text-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none resize-none transition-all placeholder:text-zinc-300"
                    placeholder="例：星空のような背景で、落ち着いたクラシック。金のアクセント。"
                    value={aiDescription}
                    onChange={(e) => setAiDescription(e.target.value)}
                  />

                  <div className="flex gap-2">
                    <select
                      value={aiStyle}
                      onChange={(e) => setAiStyle(e.target.value as any)}
                      className="h-12 rounded-xl border border-zinc-300 px-3 text-sm font-bold"
                    >
                      <option value="classic">classic</option>
                      <option value="modern">modern</option>
                      <option value="pop">pop</option>
                    </select>

                    <button
                      className="flex-1 h-12 flex items-center justify-center gap-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-all shadow-md shadow-purple-200 active:scale-95 disabled:opacity-50"
                      onClick={generateTheme}
                      disabled={isGenerating || !aiDescription.trim()}
                    >
                      {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
                      AIにデザインしてもらう
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="relative aspect-[3/4] bg-zinc-100 rounded-xl overflow-hidden border shadow-inner flex flex-col">
                  {aiTheme ? (
                    <div
                      className="flex-1 flex flex-col"
                      style={{
                        backgroundColor: aiTheme.palette?.bg ?? "#f8fafc",
                        color: aiTheme.palette?.text ?? "#0f172a",
                        backgroundImage: aiTheme.background_pattern ? `url('${aiTheme.background_pattern}')` : undefined,
                        backgroundSize: aiTheme.background_pattern ? "140px" : undefined,
                        fontFamily:
                          aiTheme.typography?.heading === "serif"
                            ? '"Noto Serif JP", serif'
                            : aiTheme.typography?.heading === "rounded"
                            ? '"Zen Maru Gothic", system-ui'
                            : "system-ui",
                      }}
                    >
                      {aiTheme.custom_css ? <style>{aiTheme.custom_css}</style> : null}

                      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                        <div className="text-xs uppercase opacity-70 tracking-widest">Preview</div>
                        <div className="text-xl font-bold my-4">{event.title}</div>
                        <div className="mt-1 text-[10px] font-mono opacity-70">
                          hero:{ensureVariants(aiTheme).hero} / card:{ensureVariants(aiTheme).card} / program:{ensureVariants(aiTheme).program}
                        </div>

                        <div
                          className="p-4 w-full text-sm text-left border shadow-sm"
                          style={{
                            backgroundColor: aiTheme.palette?.card ?? "#fff",
                            borderColor: aiTheme.palette?.border ?? "#e2e8f0",
                            borderRadius: `${aiTheme.decoration?.radius ?? 16}px`,
                          }}
                        >
                          <div
                            className="font-bold mb-1"
                            style={{ color: aiTheme.palette?.accent ?? "#7c3aed" }}
                          >
                            Content Area
                          </div>
                          <div className="opacity-80">ここにコンテンツが表示されます。</div>
                        </div>

                        <button
                          onClick={applyTheme}
                          disabled={loading}
                          className="mt-8 px-6 py-2 bg-black text-white rounded-full text-xs font-bold shadow-lg hover:scale-105 transition-transform disabled:opacity-60"
                        >
                          このデザインを採用
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-zinc-400 text-xs font-bold text-center">
                      <div>
                        <Sparkles className="mx-auto mb-2 opacity-20" size={32} />
                        ここにプレビューが表示されます
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* TAB: live */}
        {activeTab === "live" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Encore */}
            <section className="p-6 rounded-3xl bg-gradient-to-br from-yellow-50 to-orange-50 border border-yellow-100 shadow-sm text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-xs font-bold uppercase tracking-widest">
                <Zap size={14} fill="currentColor" /> Stage Control
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-zinc-800">アンコール操作</h2>
                <p className="text-sm text-zinc-500">本番のアンコール時に使用してください。</p>
              </div>

              <div className="p-6 bg-white rounded-2xl border border-yellow-100 shadow-sm">
                <button
                  onClick={toggleEncore}
                  className={[
                    "w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95",
                    encoreRevealed
                      ? "bg-green-500 text-white shadow-green-200"
                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200",
                  ].join(" ")}
                >
                  {encoreRevealed ? <Unlock /> : <Lock />}
                  {encoreRevealed ? "現在公開されています" : "アンコールを公開する"}
                </button>
              </div>
            </section>

            <hr className="border-dashed border-zinc-200" />

            {/* Program control */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold">
                <Music className="text-blue-500" size={20} />
                <h2>演奏コントロール</h2>
              </div>

              <div className="space-y-4">
                {blocks
                  .filter((b) => b.type === "program")
                  .map((block) => (
                    <div key={block.id} className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                      <div className="bg-zinc-50 px-4 py-2 text-xs font-bold text-zinc-500 border-b uppercase">
                        Program List
                      </div>

                      <div>
                        {block.content.items?.map((item: any, i: number) => {
                          const isBreak = item.type === "break";
                          const isActive = item.active === true;

                          return (
                            <div
                              key={i}
                              className={`flex items-center gap-4 p-4 border-b last:border-0 transition-colors ${
                                isActive ? "bg-blue-50" : ""
                              }`}
                            >
                              {!isBreak ? (
                                <button
                                  onClick={() => toggleActiveItem(block.id, i)}
                                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                                    isActive
                                      ? "bg-blue-500 text-white shadow-md scale-105"
                                      : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                  }`}
                                >
                                  {isActive ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}
                                </button>
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300">
                                  <Coffee size={20} />
                                </div>
                              )}

                              <div className="flex-1">
                                <div className={`font-bold text-lg ${isActive ? "text-blue-900" : "text-zinc-700"} ${isBreak ? "text-zinc-400" : ""}`}>
                                  {item.title}
                                </div>
                                {!isBreak && item.composer && (
                                  <div className="text-xs text-zinc-400">{item.composer}</div>
                                )}
                              </div>

                              {isActive && (
                                <div className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full animate-pulse">
                                  NOW PLAYING
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function AddButton({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 bg-white hover:border-blue-400 hover:shadow-md transition-all active:scale-95"
    >
      <div className="p-2.5 rounded-full bg-zinc-50 text-zinc-600">
        <Icon size={20} />
      </div>
      <span className="text-xs font-bold text-zinc-700">{label}</span>
    </button>
  );
}

function BlockEditor({ block, index, total, onSave, onMove, onDelete, supabaseClient }: any) {
  const [content, setContent] = useState(block.content ?? {});
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setContent(block.content ?? {});
    setIsDirty(false);
  }, [block.id]);

  const type = block.type;

  const handleChange = (newContent: any) => {
    setContent(newContent);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(block.id, content);
      setIsDirty(false);
    } catch {
      alert("保存失敗");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (targetIndex: number) => {
    if (!content.items) return;
    const isAlready = content.items[targetIndex]?.active === true;
    const newItems = content.items.map((it: any, idx: number) => ({
      ...it,
      active: idx === targetIndex ? !isAlready : false,
    }));
    const newContent = { ...content, items: newItems };
    setContent(newContent);
    onSave(block.id, newContent);
  };

  const handleImageUpload = async (e: any, target: "profile" | "block", indexOrKey?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `uploads/${name}`;

      const { error } = await supabaseClient.storage.from("pamp-images").upload(path, file);
      if (error) throw error;

      const { data } = supabaseClient.storage.from("pamp-images").getPublicUrl(path);

      if (target === "profile" && typeof indexOrKey === "number") {
        const np = [...(content.people ?? [])];
        np[indexOrKey] = { ...np[indexOrKey], image: data.publicUrl };
        handleChange({ ...content, people: np });
      } else {
        handleChange({ ...content, url: data.publicUrl });
      }
    } catch {
      alert("Upload Error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`group relative rounded-2xl border bg-white shadow-sm transition-all ${isDirty ? "ring-2 ring-blue-500 border-blue-500" : "border-zinc-200"}`}>
      {/* header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-zinc-50/50 rounded-t-2xl cursor-move active:cursor-grabbing">
        <div className="flex items-center gap-3 text-zinc-400 group-hover:text-zinc-600">
          <GripVertical size={20} />
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            {type === "greeting" && <MessageSquare size={14} />}
            {type === "program" && <Music size={14} />}
            {type === "profile" && <User size={14} />}
            {type === "image" && <ImageIcon size={14} />}
            {type === "greeting" ? "ご挨拶" : type === "program" ? "曲目リスト" : type === "profile" ? "プロフィール" : "画像"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(block.id, "up")} disabled={index === 0} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-400 disabled:opacity-20">
            <ArrowUp size={16} />
          </button>
          <button onClick={() => onMove(block.id, "down")} disabled={index === total - 1} className="p-1.5 rounded hover:bg-zinc-200 text-zinc-400 disabled:opacity-20">
            <ArrowDown size={16} />
          </button>
          <div className="w-px h-3 bg-zinc-300 mx-2" />
          <button onClick={() => onDelete(block.id)} className="p-1.5 rounded hover:bg-red-100 text-zinc-400 hover:text-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* body */}
      <div className="p-5 space-y-3">
        {type === "greeting" && (
          <textarea
            className="w-full min-h-[100px] rounded-lg border p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="挨拶文を入力..."
            value={content.text || ""}
            onChange={(e) => handleChange({ ...content, text: e.target.value })}
          />
        )}

        {type === "image" && (
          <div className="space-y-3">
            <div className="relative w-full aspect-video bg-zinc-100 rounded-lg overflow-hidden border-2 border-dashed border-zinc-200 flex items-center justify-center group/img">
              {content.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={content.url} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="text-zinc-300" />
              )}
              <label className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center cursor-pointer transition-all">
                {uploading ? <Loader2 className="animate-spin text-white" /> : <Upload className="text-white opacity-0 group-hover/img:opacity-100" />}
                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "block")} />
              </label>
            </div>
            <input
              className="w-full text-xs border rounded p-2"
              placeholder="キャプション"
              value={content.caption || ""}
              onChange={(e) => handleChange({ ...content, caption: e.target.value })}
            />
          </div>
        )}

        {type === "program" && (
          <div className="space-y-4">
            {(content.items || []).map((item: any, i: number) => {
              const isBreak = item.type === "break";
              return (
                <div key={i} className={`flex gap-3 items-start p-3 rounded-xl border ${item.active ? "bg-blue-50 border-blue-200" : "bg-zinc-50 border-zinc-100"}`}>
                  {!isBreak ? (
                    <button onClick={() => toggleActive(i)} className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center ${item.active ? "bg-blue-500 text-white" : "bg-white border text-zinc-400"}`}>
                      {item.active ? <Pause size={12} /> : <Play size={12} className="ml-0.5" />}
                    </button>
                  ) : (
                    <div className="mt-1 w-8 h-8 flex items-center justify-center text-zinc-400">
                      <Coffee size={16} />
                    </div>
                  )}

                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-transparent text-sm font-bold placeholder:text-zinc-300 outline-none"
                        placeholder={isBreak ? "休憩タイトル" : "曲名"}
                        value={item.title || ""}
                        onChange={(e) => {
                          const newItems = [...content.items];
                          newItems[i].title = e.target.value;
                          handleChange({ ...content, items: newItems });
                        }}
                      />
                      {!isBreak && (
                        <label className={`text-[10px] font-bold px-2 py-1 rounded cursor-pointer select-none ${item.isEncore ? "bg-pink-100 text-pink-600" : "bg-zinc-100 text-zinc-300"}`}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={item.isEncore || false}
                            onChange={(e) => {
                              const newItems = [...content.items];
                              newItems[i].isEncore = e.target.checked;
                              handleChange({ ...content, items: newItems });
                            }}
                          />
                          Encore
                        </label>
                      )}
                    </div>

                    {isBreak ? (
                      <input
                        className="w-full text-xs bg-transparent outline-none text-zinc-500"
                        placeholder="15分"
                        value={item.duration || ""}
                        onChange={(e) => {
                          const newItems = [...content.items];
                          newItems[i].duration = e.target.value;
                          handleChange({ ...content, items: newItems });
                        }}
                      />
                    ) : (
                      <>
                        <input
                          className="w-full text-xs bg-transparent outline-none text-zinc-500"
                          placeholder="作曲者"
                          value={item.composer || ""}
                          onChange={(e) => {
                            const newItems = [...content.items];
                            newItems[i].composer = e.target.value;
                            handleChange({ ...content, items: newItems });
                          }}
                        />
                        <textarea
                          className="w-full text-xs border rounded p-2 h-16 resize-none"
                          placeholder="解説"
                          value={item.description || ""}
                          onChange={(e) => {
                            const newItems = [...content.items];
                            newItems[i].description = e.target.value;
                            handleChange({ ...content, items: newItems });
                          }}
                        />
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      const newItems = content.items.filter((_: any, idx: number) => idx !== i);
                      handleChange({ ...content, items: newItems });
                    }}
                    className="text-zinc-300 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            <div className="flex gap-2 justify-center">
              <button
                onClick={() =>
                  handleChange({
                    ...content,
                    items: [...(content.items || []), { type: "song", title: "", composer: "", description: "", isEncore: false, active: false }],
                  })
                }
                className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold"
              >
                + 曲を追加
              </button>
              <button
                onClick={() =>
                  handleChange({
                    ...content,
                    items: [...(content.items || []), { type: "break", title: "休憩", duration: "15分" }],
                  })
                }
                className="px-3 py-1 bg-zinc-100 text-zinc-600 rounded-full text-xs font-bold"
              >
                + 休憩を追加
              </button>
            </div>
          </div>
        )}

        {type === "profile" && (
          <div className="space-y-4">
            {(content.people || []).map((p: any, i: number) => (
              <div key={i} className="flex gap-3 border p-3 rounded-xl bg-zinc-50/50 relative">
                <div className="w-16 h-16 bg-zinc-200 rounded-full shrink-0 overflow-hidden relative group/icon">
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} className="w-full h-full object-cover" />
                  ) : (
                    <User className="m-auto mt-4 text-zinc-400" />
                  )}
                  <label className="absolute inset-0 bg-black/0 group-hover/icon:bg-black/30 flex items-center justify-center cursor-pointer">
                    {uploading ? (
                      <Loader2 className="animate-spin text-white" />
                    ) : (
                      <Upload size={16} className="text-white opacity-0 group-hover/icon:opacity-100" />
                    )}
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, "profile", i)} />
                  </label>
                </div>

                <div className="flex-1 space-y-2">
                  <input
                    className="w-full text-sm font-bold bg-transparent outline-none"
                    placeholder="名前"
                    value={p.name || ""}
                    onChange={(e) => {
                      const np = [...content.people];
                      np[i].name = e.target.value;
                      handleChange({ ...content, people: np });
                    }}
                  />
                  <input
                    className="w-full text-xs bg-transparent outline-none"
                    placeholder="役割 (例: Pf.)"
                    value={p.role || ""}
                    onChange={(e) => {
                      const np = [...content.people];
                      np[i].role = e.target.value;
                      handleChange({ ...content, people: np });
                    }}
                  />
                  <textarea
                    className="w-full text-xs border rounded p-2 h-16 resize-none"
                    placeholder="プロフィール"
                    value={p.bio || ""}
                    onChange={(e) => {
                      const np = [...content.people];
                      np[i].bio = e.target.value;
                      handleChange({ ...content, people: np });
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    const np = content.people.filter((_: any, idx: number) => idx !== i);
                    handleChange({ ...content, people: np });
                  }}
                  className="absolute top-2 right-2 text-zinc-300 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            <button
              onClick={() => handleChange({ ...content, people: [...(content.people || []), { name: "", role: "", bio: "", image: "" }] })}
              className="w-full py-2 bg-zinc-100 text-zinc-500 rounded-lg text-xs font-bold"
            >
              + 人物を追加
            </button>
          </div>
        )}
      </div>

      {/* footer save */}
      {isDirty && (
        <div className="absolute -bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <button
            onClick={handleSave}
            disabled={saving}
            className="pointer-events-auto shadow-lg bg-black text-white px-6 py-2 rounded-full text-sm font-bold flex items-center gap-2 hover:scale-105 transition-transform"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            このブロックを保存
          </button>
        </div>
      )}
    </div>
  );
}