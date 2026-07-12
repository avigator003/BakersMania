"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredTenantSlug } from "../../lib/api";

export default function VehiclePage() {
  const router = useRouter();

  useEffect(() => {
    const tenantSlug = getStoredTenantSlug();
    router.replace(tenantSlug ? `/${tenantSlug}/vehicle/routes` : "/vehicle/routes");
  }, [router]);

  return null;
}
