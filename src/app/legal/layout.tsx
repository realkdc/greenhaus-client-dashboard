import type { ReactNode } from "react";

export default function LegalLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <div className="bg-white">
      <main className="mx-auto flex min-h-screen w-full max-w-[780px] flex-col gap-10 px-6 py-16">
        {children}
      </main>
    </div>
  );
}
