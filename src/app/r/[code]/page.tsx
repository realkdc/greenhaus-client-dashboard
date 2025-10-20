import ReferralRedirect from "./referral-redirect";

type ReferralPageProps = {
  params: { code: string };
  searchParams?: { landing?: string };
};

function normalizeLanding(input?: string): string {
  if (!input) return "/";
  try {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) {
      return "/";
    }
    return trimmed || "/";
  } catch {
    return "/";
  }
}

export default function ReferralPage({ params, searchParams }: ReferralPageProps) {
  const rawCode = params.code ?? "";
  const code = decodeURIComponent(rawCode).trim();
  const landing = normalizeLanding(searchParams?.landing);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      {code ? (
        <ReferralRedirect code={code} landing={landing} />
      ) : (
        <div className="text-center text-sm text-slate-500">
          Missing referral code. Redirecting to the homepage…
        </div>
      )}
    </div>
  );
}
