import TheaterShell from "./theater-shell";

export type Block = {
  id: string;
  event_id: string;
  type: "greeting" | "program" | "profile" | "image";
  sort_order: number;
  content: any;
};

export type EventData = {
  title: string;
  venue: string | null;
  starts_at: string | null;
  encore_revealed: boolean;
};

export default function EventView({
  event,
  blocks,
}: {
  event: EventData;
  blocks: Block[];
}) {
  return (
    <TheaterShell>
      <main className="min-h-screen">
        <header className="px-5 pt-8 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            {event.venue ?? ""}
            {event.starts_at
              ? ` / ${new Date(event.starts_at).toLocaleString("ja-JP")}`
              : ""}
          </p>
        </header>

        <div className="px-5 pb-16 space-y-6">
          {blocks.map((b) => (
            <BlockRenderer
              key={b.id}
              block={b}
              encoreRevealed={event.encore_revealed}
            />
          ))}
        </div>
      </main>
    </TheaterShell>
  );
}

function BlockRenderer({
  block,
  encoreRevealed,
}: {
  block: Block;
  encoreRevealed: boolean;
}) {
  const c = block.content ?? {};

  if (block.type === "greeting") {
    return (
      <Card title="ごあいさつ">
        <p className="whitespace-pre-wrap leading-7 text-zinc-700">{c.text ?? ""}</p>
      </Card>
    );
  }

  if (block.type === "program") {
    const items: Array<any> = c.items ?? [];
    const isEncore = c.isEncore === true;
    if (isEncore && !encoreRevealed) return null;

    return (
      <Card title={isEncore ? "アンコール" : "プログラム"}>
        <div className="space-y-3">
          {items.map((it, idx) => (
            <details
              key={idx}
              className="rounded-xl border border-zinc-200 px-4 py-3 bg-white"
            >
              <summary className="cursor-pointer select-none font-medium">
                {it.title ?? `曲目 ${idx + 1}`}
              </summary>
              {it.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                  {it.note}
                </p>
              ) : null}
            </details>
          ))}
          {items.length === 0 ? (
            <p className="text-sm text-zinc-600">曲目が未設定です</p>
          ) : null}
        </div>
      </Card>
    );
  }

  if (block.type === "profile") {
    const people: Array<any> = c.people ?? [];
    return (
      <Card title="プロフィール">
        <div className="space-y-4">
          {people.map((p, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-200 p-4 bg-white">
              <div className="font-medium">{p.name ?? "名前"}</div>
              {p.role ? <div className="mt-1 text-xs text-zinc-500">{p.role}</div> : null}
              <div className="mt-2 text-sm whitespace-pre-wrap leading-6 text-zinc-700">
                {p.bio ?? ""}
              </div>
              {p.links?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.links.map((l: any, i: number) => (
                    <a
                      key={i}
                      href={l.url}
                      className="text-sm underline text-zinc-700"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {l.label ?? l.url}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {people.length === 0 ? (
            <p className="text-sm text-zinc-600">出演者が未設定です</p>
          ) : null}
        </div>
      </Card>
    );
  }

    if (block.type === "image") {
    const url = block.content?.url;
    const caption = block.content?.caption;

    return (
      <section className="rounded-2xl bg-white shadow-sm p-5">
        {url ? (
          <img
            src={url}
            alt={caption ?? "image"}
            className="w-full rounded-xl border border-zinc-200"
          />
        ) : (
          <p className="text-sm text-zinc-600">画像が未設定です</p>
        )}
        {caption ? (
          <p className="mt-2 text-sm text-zinc-500">{caption}</p>
        ) : null}
      </section>
    );
  }

  return null;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white shadow-sm p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
