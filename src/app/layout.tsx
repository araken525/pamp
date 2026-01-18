import type { Metadata, Viewport } from "next";
import { Zen_Old_Mincho } from "next/font/google"; // 明朝体をここに移動して全体適用もアリですが、今回はメタデータのみ変更
import "./globals.css";

// フォント設定（もしlayoutで読み込んでいるなら）
const mincho = Zen_Old_Mincho({ subsets: ["latin"], weight: ["400", "700", "900"], display: "swap" });

export const metadata: Metadata = {
  title: "Tenote | 手のひらの演奏会プログラム",
  description: "紙の温もりを、デジタルの手軽さで。次世代のデジタルパンフレット作成サービス。",
};

export const viewport: Viewport = {
  themeColor: "#F9F8F2",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={mincho.className}>{children}</body>
    </html>
  );
}