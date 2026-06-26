import { BarChart3 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { ModulePage } from "../../../components/module-page";

export default function AdminReportsPage() {
  return (
    <AppShell title="Platform Admin" subtitle="Platform-wide usage and operating reports" surface="admin">
      <ModulePage
        eyebrow="Platform reports"
        title="SaaS performance"
        description="Track active bakeries, order volume, subscriptions, churn risk, and support activity."
        icon={BarChart3}
        stats={[["Total orders", "1,284"], ["Monthly revenue", "₹4.8L"], ["Support views", "7"]]}
        actions={["Export platform report", "View tenant activity", "Review churn risk", "Open audit logs"]}
      />
    </AppShell>
  );
}
