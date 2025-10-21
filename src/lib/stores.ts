export const STORES = [
  { id: "greenhaus-tn-cookeville", label: "Cookeville, TN" },
  { id: "greenhaus-tn-crossville", label: "Crossville, TN" },
] as const;

export type StoreId = (typeof STORES)[number]["id"];
