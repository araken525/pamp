import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PAMP",
  description: "Webパンフレットを、爆速で。",
};

// ▼ ここが重要です！スマホのバーの色と、ズーム設定を制御します
export const viewport: Viewport = {
  // アドレスバーの色を「紙の色」に合わせて一体感を出します
  // 真っ白がいい場合は "#ffffff" に変えてください
  themeColor: "#F9F8F2", 
  
  // スマホでの表示設定（ズーム禁止など）
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}