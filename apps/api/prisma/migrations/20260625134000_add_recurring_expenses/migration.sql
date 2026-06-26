ALTER TABLE "Expense" ADD COLUMN "recurring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "recurringRootId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "recurringActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Expense" ADD COLUMN "periodMonth" TEXT;

UPDATE "Expense"
SET "periodMonth" = to_char("spentAt", 'YYYY-MM')
WHERE "periodMonth" IS NULL;

CREATE INDEX "Expense_tenantId_recurring_idx" ON "Expense"("tenantId", "recurring");
CREATE INDEX "Expense_tenantId_recurringRootId_idx" ON "Expense"("tenantId", "recurringRootId");
CREATE INDEX "Expense_tenantId_periodMonth_idx" ON "Expense"("tenantId", "periodMonth");
