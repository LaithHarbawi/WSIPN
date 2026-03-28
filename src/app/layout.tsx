import type { Metadata, Viewport } from "next";
import "./globals.css";

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
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg-primary text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
