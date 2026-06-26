ALTER TABLE "Purchase" ADD COLUMN "itemId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "quantity" DECIMAL(12,3);
ALTER TABLE "Purchase" ADD COLUMN "unitPrice" DECIMAL(12,2);
ALTER TABLE "Purchase" ADD COLUMN "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Purchase" ADD COLUMN "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "PurchasePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentType" TEXT NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchasePayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Purchase_tenantId_purchasedAt_idx" ON "Purchase"("tenantId", "purchasedAt");
CREATE INDEX "Purchase_tenantId_supplierId_idx" ON "Purchase"("tenantId", "supplierId");
CREATE INDEX "Purchase_tenantId_itemId_idx" ON "Purchase"("tenantId", "itemId");
CREATE INDEX "PurchasePayment_tenantId_paidAt_idx" ON "PurchasePayment"("tenantId", "paidAt");
CREATE INDEX "PurchasePayment_tenantId_supplierId_idx" ON "PurchasePayment"("tenantId", "supplierId");
CREATE INDEX "PurchasePayment_tenantId_purchaseId_idx" ON "PurchasePayment"("tenantId", "purchaseId");

ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PurchasePayment" ADD CONSTRAINT "PurchasePayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
