export const CANONICAL_STORE_IDS = [
  "greenhaus-tn-cookeville",
  "greenhaus-tn-crossville",
] as const;

export type CanonicalStoreId = (typeof CANONICAL_STORE_IDS)[number];

const STORE_ALIAS_GROUPS: Record<CanonicalStoreId, readonly string[]> = {
  "greenhaus-tn-cookeville": [
    "greenhaus-tn-cookeville",
    "cookeville",
  ],
  "greenhaus-tn-crossville": [
    "greenhaus-tn-crossville",
    "crossville",
    "store_123",
  ],
};

const NORMALIZED_LOOKUP = new Map<
  string,
  { canonical: CanonicalStoreId; aliases: readonly string[] }
>();

function normalize(id: string): string {
  return id.trim().toLowerCase();
}

for (const [canonical, aliases] of Object.entries(STORE_ALIAS_GROUPS) as Array<[
  CanonicalStoreId,
  readonly string[],
]>) {
  for (const alias of aliases) {
    NORMALIZED_LOOKUP.set(normalize(alias), {
      canonical,
      aliases,
    });
  }
}

export const DEFAULT_CANONICAL_STORE_ID: CanonicalStoreId =
  "greenhaus-tn-crossville";

export function resolveStoreAliases(
  storeId: string | null | undefined,
): { canonical: CanonicalStoreId; aliases: string[] } | null {
  if (!storeId) return null;
  const key = normalize(storeId);
  if (!key) return null;

  const match = NORMALIZED_LOOKUP.get(key);
  if (!match) return null;

  const uniqueAliases = Array.from(
    new Set(match.aliases.map((alias) => alias.trim())),
  );

  return {
    canonical: match.canonical,
    aliases: uniqueAliases,
  };
}

export function coerceCanonicalStoreId(
  storeId: string | null | undefined,
): CanonicalStoreId {
  return (
    resolveStoreAliases(storeId)?.canonical ?? DEFAULT_CANONICAL_STORE_ID
  );
}


