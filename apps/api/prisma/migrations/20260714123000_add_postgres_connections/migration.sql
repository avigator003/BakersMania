CREATE TABLE "PostgresConnection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "databaseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostgresConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostgresConnection_name_key" ON "PostgresConnection"("name");

ALTER TABLE "Tenant" ADD COLUMN "postgresConnectionId" TEXT;
CREATE UNIQUE INDEX "Tenant_postgresConnectionId_key" ON "Tenant"("postgresConnectionId");
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_postgresConnectionId_fkey" FOREIGN KEY ("postgresConnectionId") REFERENCES "PostgresConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
