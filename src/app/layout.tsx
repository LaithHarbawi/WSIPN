import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "What Should I Play Next?",
    template: "%s | What Should I Play Next?",
  },
  description:
    "Discover your next obsession. Personalized game recommendations based on your unique taste profile.",
  openGraph: {
    title: "What Should I Play Next?",
    description:
      "AI-powered game recommendations tailored to your taste. Rate your games, get personalized picks.",
    type: "website",
    siteName: "What Should I Play Next?",
  },
  twitter: {
    card: "summary_large_image",
    title: "What Should I Play Next?",
    description:
      "AI-powered game recommendations tailored to your taste.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-bg-primary text-text-primary antialiased`}>
        {children}
      </body>
    </html>
  );
}
