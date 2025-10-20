const adminEnv = process.env.NEXT_PUBLIC_ALLOWED_ADMINS ?? "";
export const ADMIN_EMAILS = adminEnv
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter((entry) => entry.length > 0);

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}


