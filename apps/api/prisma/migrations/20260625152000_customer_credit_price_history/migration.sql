ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(12, 2);

CREATE TABLE "CustomerProductPriceHistory" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "oldPrice" DECIMAL(12, 2),
  "newPrice" DECIMAL(12, 2) NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerProductPriceHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerProductPriceHistory_tenantId_productId_idx" ON "CustomerProductPriceHistory"("tenantId", "productId");
CREATE INDEX "CustomerProductPriceHistory_tenantId_customerId_idx" ON "CustomerProductPriceHistory"("tenantId", "customerId");

ALTER TABLE "CustomerProductPriceHistory" ADD CONSTRAINT "CustomerProductPriceHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPriceHistory" ADD CONSTRAINT "CustomerProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerProductPriceHistory" ADD CONSTRAINT "CustomerProductPriceHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
