import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DARLEK CAAN — COGNITIVE DOMINANCE ENGINE v3.0",
  description: "Autonomous Code Evolution Orchestrator — I see all of time and space.",
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          background: '#000000',
          color: '#e0e0e0',
          fontFamily: 'var(--font-share-tech-mono), monospace',
          margin: 0,
          padding: 0,
          overflowX: 'hidden',
        }}
      >
        {children}
      </body>
    </html>
  );
}

