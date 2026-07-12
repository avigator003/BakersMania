WITH order_payment_totals AS (
  SELECT
    "tenantId",
    "orderId",
    MIN(id) AS "keepId",
    SUM(amount) AS "totalAmount",
    MAX("paidAt") AS "latestPaidAt"
  FROM "Payment"
  WHERE "orderId" IS NOT NULL
  GROUP BY "tenantId", "orderId"
  HAVING COUNT(*) > 1
)
UPDATE "Payment" p
SET
  amount = t."totalAmount",
  "paidAt" = t."latestPaidAt"
FROM order_payment_totals t
WHERE p.id = t."keepId";

WITH order_payment_totals AS (
  SELECT
    "tenantId",
    "orderId",
    MIN(id) AS "keepId"
  FROM "Payment"
  WHERE "orderId" IS NOT NULL
  GROUP BY "tenantId", "orderId"
  HAVING COUNT(*) > 1
)
DELETE FROM "Payment" p
USING order_payment_totals t
WHERE p."tenantId" = t."tenantId"
  AND p."orderId" = t."orderId"
  AND p.id <> t."keepId";

CREATE UNIQUE INDEX "Payment_tenantId_orderId_key" ON "Payment"("tenantId", "orderId");
