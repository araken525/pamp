import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold text-zinc-600">
            Pamp (prototype)
          </div>
          <h1 className="text-4xl font-black tracking-tight md:text-5xl">
            Webパンフレットを、爆速で。
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 md:text-lg">
            変更に強い・見やすい・アクセシブル。演奏会プログラムをURLで配れる
            “次世代パンフレット” を作るための試作です。
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/admin"
              className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-bold text-white shadow hover:bg-zinc-800"
            >
              管理画面へ
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-3 text-sm font-bold text-zinc-900 hover:bg-zinc-100"
            >
              ログイン
            </Link>
          </div>
        </header>

        {/* Feature cards */}
        <section className="mt-12 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-xs font-bold text-zinc-500">Viewer</div>
            <div className="mt-1 text-lg font-black">見やすいプログラム</div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              スマホ前提で曲目・解説・プロフィールをカード表示。終演までアンコール非表示も可能。
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-xs font-bold text-zinc-500">Theater Mode</div>
            <div className="mt-1 text-lg font-black">光害を抑える</div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              演奏中は暗い表示へ切替。必要な情報だけ残して“眩しさ”を減らします。
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="text-xs font-bold text-zinc-500">AI Design</div>
            <div className="mt-1 text-lg font-black">雰囲気を自動生成</div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              配色・タイポ・Hero/カード/ProgramのバリエーションをJSONで提案して即適用。
            </p>
          </div>
        </section>

        {/* Viewer demo */}
        <section className="mt-10 rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-500">Quick Viewer</div>
              <h2 className="mt-1 text-xl font-black">slug を入れて開く</h2>
              <p className="mt-2 text-sm text-zinc-600">
                例：<span className="font-mono">test</span> →
                <span className="font-mono"> /e/test</span>
              </p>
            </div>
            <div className="text-xs text-zinc-500">
              右下デバッグは <span className="font-mono">?debug=1</span>
            </div>
          </div>

          <form
            className="mt-4 flex flex-col gap-3 md:flex-row"
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
              placeholder="slug (例: test)"
              className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
            <button
              type="submit"
              className="h-12 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow hover:bg-blue-700"
            >
              Viewer を開く
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="text-sm font-bold text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
            >
              イベントを作成/編集する →
            </Link>
            <span className="text-sm text-zinc-400">/admin</span>
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-zinc-400">
          © Pamp (prototype)
        </footer>
      </div>
    </main>
  );
}