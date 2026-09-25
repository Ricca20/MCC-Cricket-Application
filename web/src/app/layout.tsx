import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MCC - Village Cricket Club",
  description: "Live scoring, player stats, and tournament draws for our village cricket club.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col antialiased bg-slate-900 text-slate-50`}>
        {children}
      </body>
    </html>
  );
}
