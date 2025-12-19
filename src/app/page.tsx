"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import WelcomeScreen from "@/components/welcome-screen";

export default function Home(): JSX.Element {
  const [showWelcome, setShowWelcome] = useState(true);

  useEffect(() => {
    // Check if user has entered in the last 24 hours
    // Uses localStorage with timestamp to show welcome screen once per day
    const lastEntered = localStorage.getItem("greenhaus-entered-timestamp");
    
    if (lastEntered) {
      const lastEnteredTime = parseInt(lastEntered, 10);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      
      // If less than 24 hours have passed, don't show welcome screen
      if (now - lastEnteredTime < twentyFourHours) {
        setShowWelcome(false);
        document.body.classList.remove("welcome-active");
        return;
      }
    }
    
    // Show welcome screen if never entered or more than 24 hours have passed
    document.body.classList.add("welcome-active");
  }, []);

  useEffect(() => {
    if (showWelcome) {
      document.body.classList.add("welcome-active");
    } else {
      document.body.classList.remove("welcome-active");
    }
  }, [showWelcome]);

  const handleEnter = () => {
    // Store timestamp in localStorage (persists across browser sessions)
    localStorage.setItem("greenhaus-entered-timestamp", Date.now().toString());
    setShowWelcome(false);
  };

  if (showWelcome) {
    return <WelcomeScreen onEnter={handleEnter} />;
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-12 px-6 py-16">
      <section className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
        <span className="accent-pill">GreenHaus Dashboard</span>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          GreenHaus Content & Analytics Dashboard
        </h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Create content, monitor app performance, and track ambassador activity from one streamlined dashboard.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {[
          {
            name: "Analytics Dashboard",
            href: "/analytics",
            description:
              "Keep tabs on adoption, retention, and engagement across the app.",
          },
          {
            name: "Ambassadors Dashboard",
            href: "/ambassadors",
            description:
              "Track ambassador performance and manage QR codes for GreenHaus crew members.",
          },
          {
            name: "Tools Dashboard",
            href: "/tools",
            description:
              "Access content creation tools including AI caption generation to streamline your workflow.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:border-accent hover:shadow-lg"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {item.name}
              </h2>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent transition group-hover:bg-accent group-hover:text-white">
                Open
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
