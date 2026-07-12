CREATE TYPE "VehicleOrderStatus" AS ENUM ('PENDING', 'ACCEPTED');

ALTER TABLE "Order" ADD COLUMN "vehicleStatus" "VehicleOrderStatus" NOT NULL DEFAULT 'PENDING';

CREATE INDEX "Order_tenantId_vehicleStatus_idx" ON "Order"("tenantId", "vehicleStatus");
