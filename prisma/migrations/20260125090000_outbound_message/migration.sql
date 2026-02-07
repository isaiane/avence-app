-- CreateEnum
CREATE TYPE "OutboundMessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "outbound_message" (
    "id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "status" "OutboundMessageStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "business_id" TEXT,
    "phone_number_id" TEXT,
    "conversation_id" TEXT,
    "to_wa_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_message_idempotency_key_key" ON "outbound_message"("idempotency_key");

-- CreateIndex
CREATE INDEX "outbound_message_domain_status_created_at_idx" ON "outbound_message"("domain", "status", "created_at");


