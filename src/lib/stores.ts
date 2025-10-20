export const STORES = [
  { id: "cookeville", label: "Cookeville, TN" },
  { id: "crossville", label: "Crossville, TN" },
] as const;

export type StoreId = (typeof STORES)[number]["id"];
