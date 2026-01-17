"use client";

import { useEffect, useMemo, useState } from "react";

const KEY = "pamp_theater_mode_v1";

export default function TheaterShell({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);

  // 初回：保存値を読む
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "1") setOn(true);
  }, []);

  // 変更：保存
  useEffect(() => {
    localStorage.setItem(KEY, on ? "1" : "0");
  }, [on]);

  const shellClass = useMemo(() => {
    if (!on) return "bg-zinc-50 text-zinc-900";
    // Theater ON: 完全黒 + 低輝度グレー
    return "bg-black text-zinc-300";
  }, [on]);

  return (
    <div className={shellClass}>
      {/* トグルは常設（sticky） */}
      <div className="sticky top-0 z-20 border-b border-zinc-200/20 bg-inherit/80 backdrop-blur">
        <div className="mx-auto max-w-3xl px-5 py-3 flex items-center gap-3">
          <button
            onClick={() => setOn((v) => !v)}
            className={[
              "rounded-full px-4 py-2 text-sm border",
              on ? "border-zinc-500 text-zinc-200" : "border-zinc-300 text-zinc-700 bg-white",
            ].join(" ")}
            aria-pressed={on}
          >
            {on ? "シアターモード ON" : "シアターモード OFF"}
          </button>

          <span className={["text-xs", on ? "text-zinc-400" : "text-zinc-500"].join(" ")}>
            演奏中の光害を抑える表示
          </span>
        </div>
      </div>

      {/* ONの時だけノイズ要素を抑制するための data 属性 */}
      <div data-theater={on ? "1" : "0"}>{children}</div>
    </div>
  );
}
