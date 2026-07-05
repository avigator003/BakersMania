ALTER TABLE "Vehicle" ADD COLUMN "userId" TEXT;

CREATE INDEX "Vehicle_tenantId_userId_idx" ON "Vehicle"("tenantId", "userId");

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
