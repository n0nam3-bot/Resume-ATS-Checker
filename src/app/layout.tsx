import type { Metadata, Viewport } from "next";
import { Source_Serif_4, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Resume ATS Checker — will your resume pass the filter?",
  description:
    "Upload your resume and a job posting to get an ATS compatibility score, specific feedback, and an auto-fixed version you can download.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1C2321",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sourceSerif.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
