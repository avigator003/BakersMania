CREATE TABLE "RouteProductPrice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RouteProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RouteProductPrice_tenantId_productId_routeId_key" ON "RouteProductPrice"("tenantId", "productId", "routeId");
CREATE INDEX "RouteProductPrice_tenantId_routeId_idx" ON "RouteProductPrice"("tenantId", "routeId");
CREATE INDEX "RouteProductPrice_tenantId_productId_idx" ON "RouteProductPrice"("tenantId", "productId");
CREATE INDEX "RouteProductPrice_tenantId_routeId_productId_idx" ON "RouteProductPrice"("tenantId", "routeId", "productId");

ALTER TABLE "RouteProductPrice" ADD CONSTRAINT "RouteProductPrice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteProductPrice" ADD CONSTRAINT "RouteProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RouteProductPrice" ADD CONSTRAINT "RouteProductPrice_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
