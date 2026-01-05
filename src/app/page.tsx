"use client";

import { useEffect } from "react";
import DeprecationScreen from "@/components/deprecation-screen";

export default function Home(): JSX.Element {
  useEffect(() => {
    // Hide header and footer when deprecation screen is active
    document.body.classList.add("welcome-active");
    
    return () => {
      document.body.classList.remove("welcome-active");
    };
  }, []);

  return <DeprecationScreen />;
}
