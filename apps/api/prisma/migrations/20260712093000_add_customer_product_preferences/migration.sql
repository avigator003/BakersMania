CREATE TABLE "CustomerProductPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProductPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerProductPreference_tenantId_productId_customerId_key" ON "CustomerProductPreference"("tenantId", "productId", "customerId");
CREATE INDEX "CustomerProductPreference_tenantId_customerId_idx" ON "CustomerProductPreference"("tenantId", "customerId");
CREATE INDEX "CustomerProductPreference_tenantId_productId_idx" ON "CustomerProductPreference"("tenantId", "productId");
CREATE INDEX "CustomerProductPreference_tenantId_customerId_productId_idx" ON "CustomerProductPreference"("tenantId", "customerId", "productId");

ALTER TABLE "CustomerProductPreference" ADD CONSTRAINT "CustomerProductPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPreference" ADD CONSTRAINT "CustomerProductPreference_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPreference" ADD CONSTRAINT "CustomerProductPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
