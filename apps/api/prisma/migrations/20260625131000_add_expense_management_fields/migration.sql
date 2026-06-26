ALTER TABLE "Expense" ADD COLUMN "routeId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'MISCELLANEOUS';
ALTER TABLE "Expense" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING';

CREATE INDEX "Expense_tenantId_type_idx" ON "Expense"("tenantId", "type");
CREATE INDEX "Expense_tenantId_status_idx" ON "Expense"("tenantId", "status");
CREATE INDEX "Expense_tenantId_routeId_idx" ON "Expense"("tenantId", "routeId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;
