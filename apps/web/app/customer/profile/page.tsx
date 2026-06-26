import { Settings } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { ModulePage } from "../../../components/module-page";

export default function CustomerProfilePage() {
  return (
    <AppShell title="Customer Portal" subtitle="Profile, contact details, and preferences" surface="customer">
      <ModulePage
        eyebrow="Profile"
        title="Customer settings"
        description="Manage your name, phone, delivery preferences, saved notes, and bakery communication settings."
        icon={Settings}
        stats={[["Saved addresses", "1"], ["Phone", "Verified"], ["Preferences", "3"]]}
        actions={["Edit profile", "Update phone", "Manage addresses", "Communication settings"]}
      />
    </AppShell>
  );
}
