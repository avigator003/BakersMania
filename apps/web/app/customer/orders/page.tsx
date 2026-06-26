import { ClipboardList } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { ModulePage } from "../../../components/module-page";

export default function CustomerOrdersPage() {
  return (
    <AppShell title="Customer Portal" subtitle="Your orders, status, and bakery updates" surface="customer">
      <ModulePage
        eyebrow="My orders"
        title="Order history"
        description="View placed orders, due dates, production state, delivery status, and order notes."
        icon={ClipboardList}
        stats={[["Open orders", "2"], ["Completed", "8"], ["Next due", "Tomorrow"]]}
        actions={["Place repeat order", "View order details", "Contact bakery", "Download order summary"]}
      />
    </AppShell>
  );
}
