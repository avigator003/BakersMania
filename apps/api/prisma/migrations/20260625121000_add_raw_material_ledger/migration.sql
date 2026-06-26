ALTER TABLE "InventoryItem" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'General';
ALTER TABLE "InventoryItem" ADD COLUMN "description" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "unitPrice" DECIMAL(12,2);

CREATE TABLE "InventoryLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unitPrice" DECIMAL(12,2),
    "totalAmount" DECIMAL(12,2),
    "note" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_tenantId_category_idx" ON "InventoryItem"("tenantId", "category");
CREATE INDEX "InventoryLedger_tenantId_happenedAt_idx" ON "InventoryLedger"("tenantId", "happenedAt");
CREATE INDEX "InventoryLedger_tenantId_itemId_idx" ON "InventoryLedger"("tenantId", "itemId");

ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLedger" ADD CONSTRAINT "InventoryLedger_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
