ALTER TABLE "Tenant" ADD COLUMN "orderPipelineEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "orderPipelineStages" JSONB;

ALTER TABLE "Order" ADD COLUMN "pipelineStageKey" TEXT;
ALTER TABLE "Order" ADD COLUMN "pipelineStageActor" TEXT;
ALTER TABLE "Order" ADD COLUMN "pipelineCompletedAt" TIMESTAMP(3);

CREATE TABLE "OrderStageHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStageHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Order_tenantId_pipelineStageActor_idx" ON "Order"("tenantId", "pipelineStageActor");
CREATE INDEX "Order_tenantId_pipelineStageKey_idx" ON "Order"("tenantId", "pipelineStageKey");
CREATE INDEX "OrderStageHistory_tenantId_orderId_idx" ON "OrderStageHistory"("tenantId", "orderId");
CREATE INDEX "OrderStageHistory_tenantId_stageKey_idx" ON "OrderStageHistory"("tenantId", "stageKey");
CREATE INDEX "OrderStageHistory_tenantId_actorType_idx" ON "OrderStageHistory"("tenantId", "actorType");
CREATE INDEX "OrderStageHistory_tenantId_createdAt_idx" ON "OrderStageHistory"("tenantId", "createdAt");

ALTER TABLE "OrderStageHistory" ADD CONSTRAINT "OrderStageHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
