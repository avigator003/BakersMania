import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const schemaPath = "apps/api/prisma/schema.prisma";

function redact(value, secrets) {
  return secrets.reduce((text, secret) => {
    if (!secret) return text;
    return text.split(secret).join("[redacted]");
  }, value || "");
}

async function main() {
  const connections = await prisma.postgresConnection.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      databaseUrl: true,
      tenant: { select: { slug: true, status: true } }
    }
  });

  const activeConnections = connections.filter((connection) => connection.tenant?.status !== "SUSPENDED");
  if (!activeConnections.length) {
    console.log("No tenant databases to sync.");
    return;
  }

  for (const connection of activeConnections) {
    const label = connection.tenant?.slug || connection.name || connection.id;
    console.log(`Syncing tenant database: ${label}`);
    const result = spawnSync("npx", ["prisma", "db", "push", "--schema", schemaPath, "--skip-generate"], {
      env: { ...process.env, DATABASE_URL: connection.databaseUrl },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });

    if (result.status !== 0) {
      const output = redact(`${result.stdout}\n${result.stderr}`, [connection.databaseUrl]);
      throw new Error(`Tenant database sync failed for ${label}\n${output.trim()}`);
    }
  }

  console.log(`Synced ${activeConnections.length} tenant database${activeConnections.length === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
