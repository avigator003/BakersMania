import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { platformPrisma } from "./db/prisma.js";
import { preloadTenantPrismaClients } from "./db/tenant-prisma-registry.js";
import { ordersService } from "./modules/orders/orders.service.js";

const app = createApp();
const pendingOrderCleanupIntervalMs = 60 * 60 * 1000;

async function cleanupExpiredPendingOrders() {
  try {
    const result = await ordersService.cleanupExpiredPendingOrders();
    if (result.deleted) {
      console.log(`Deleted ${result.deleted} expired pending order${result.deleted === 1 ? "" : "s"}`);
    }
  } catch (error) {
    console.error("Pending order cleanup failed", error);
  }
}

async function startServer() {
  const preload = await preloadTenantPrismaClients(platformPrisma);
  console.log(`Loaded ${preload.loaded} tenant database client${preload.loaded === 1 ? "" : "s"} into memory`);

  app.listen(env.API_PORT, () => {
    console.log(`BakersMania API listening on http://localhost:${env.API_PORT}`);
    void cleanupExpiredPendingOrders();
    const cleanupTimer = setInterval(() => {
      void cleanupExpiredPendingOrders();
    }, pendingOrderCleanupIntervalMs);
    cleanupTimer.unref?.();
  });
}

void startServer().catch((error) => {
  console.error("Failed to start BakersMania API", error);
  process.exit(1);
});
