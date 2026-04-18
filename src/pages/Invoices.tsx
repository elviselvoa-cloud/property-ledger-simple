import { Receipt } from "lucide-react";
import PlaceholderPage from "./PlaceholderPage";

export default function Invoices() {
  return (
    <PlaceholderPage
      title="Invoices"
      description="Generate and track rent invoices for your tenants."
      icon={Receipt}
    />
  );
}
