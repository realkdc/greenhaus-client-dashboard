import type { Metadata } from "next";
import PromoDashboard from "./_components/promo-dashboard";

export const metadata: Metadata = {
  title: "Promotions Dashboard | GreenHaus Admin",
  description:
    "Compose and publish GreenHaus push promotions directly from the admin dashboard.",
};

export default function PromotionsPage(): JSX.Element {
  return <PromoDashboard />;
}
