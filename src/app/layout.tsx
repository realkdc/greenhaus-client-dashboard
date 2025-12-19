import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter, Roboto_Mono } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import MainNav from "@/components/main-nav";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GreenHaus Dashboard",
  description: "Content creation and analytics dashboard for GreenHaus.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = headers();
  const nextUrl = headersList.get("next-url");
  const fallbackPath =
    headersList.get("x-invoke-path") ?? headersList.get("x-matched-path") ?? "/";

  let pathname = fallbackPath;
  if (nextUrl) {
    try {
      pathname = new URL(nextUrl, "https://greenhaus.local").pathname;
    } catch {
      pathname = fallbackPath;
    }
  }

  const hideNav = pathname.startsWith("/legal") || pathname.startsWith("/auth");
  const currentYear = new Date().getFullYear();

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${robotoMono.variable} min-h-screen bg-white text-slate-900 antialiased`}
      >
        <AuthProvider>
          <div
            className={`flex min-h-screen flex-col ${
              hideNav
                ? "bg-white"
                : "bg-gradient-to-br from-white via-white to-[#73A6330d]"
            }`}
          >
            {!hideNav && (
              <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
                <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
                  <span className="text-lg font-semibold tracking-tight text-slate-900">
                    GreenHaus Dashboard
                  </span>
                  <MainNav />
                </div>
              </header>
            )}
            <main className="flex-1">{children}</main>
            {!hideNav && (
              <footer className="border-t border-slate-200/80 bg-white/95 py-4">
                <div className="mx-auto flex w-full max-w-6xl justify-center px-6 text-xs text-slate-500">
                  © {currentYear} GreenHaus. All rights reserved.
                </div>
              </footer>
            )}
          </div>
        </AuthProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
