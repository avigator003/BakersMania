import { CreditCard } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { ModulePage } from "../../../components/module-page";

export default function CustomerBillingPage() {
  return (
    <AppShell title="Customer Portal" subtitle="Invoices, payments, and balances" surface="customer">
      <ModulePage
        eyebrow="My invoices"
        title="Billing"
        description="Review invoices, payment status, balances, and downloadable receipts for your bakery orders."
        icon={CreditCard}
        stats={[["Unpaid", "₹1,250"], ["Paid invoices", "7"], ["Credits", "₹0"]]}
        actions={["View invoice", "Download receipt", "Share payment proof", "Contact bakery"]}
      />
    </AppShell>
  );
}
