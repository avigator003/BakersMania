CREATE TYPE "BakeryLeadStatus" AS ENUM ('REJECTED', 'PENDING', 'IN_PROCESS', 'ACCEPTED');

CREATE TABLE "BakeryLead" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "bakeryName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "said" TEXT NOT NULL,
    "status" "BakeryLeadStatus" NOT NULL DEFAULT 'PENDING',
    "nextCallAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BakeryLead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BakeryLead_status_idx" ON "BakeryLead"("status");
CREATE INDEX "BakeryLead_nextCallAt_idx" ON "BakeryLead"("nextCallAt");
CREATE INDEX "BakeryLead_status_nextCallAt_idx" ON "BakeryLead"("status", "nextCallAt");
CREATE INDEX "BakeryLead_bakeryName_idx" ON "BakeryLead"("bakeryName");
CREATE INDEX "BakeryLead_phone_idx" ON "BakeryLead"("phone");
