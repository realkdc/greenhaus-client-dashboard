import type { Timestamp } from "firebase/firestore";

export type Promo = {
  id: string;
  title: string;
  body: string;
  storeId: "greenhaus-tn-cookeville" | "greenhaus-tn-crossville";
  deepLinkUrl?: string;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  status: "draft" | "scheduled" | "live" | "ended";
  createdBy: string;
  createdAt: Timestamp | null;
};
