/*
  Warnings:

  - You are about to drop the `AuditEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Business` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `InboundMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PhoneNumberRoute` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('START', 'PRO', 'PAY');

-- CreateEnum
CREATE TYPE "B2BConversationState" AS ENUM ('ONBOARDING', 'MANAGEMENT', 'SUPPORT', 'FALLBACK');

-- DropForeignKey
ALTER TABLE "PhoneNumberRoute" DROP CONSTRAINT "PhoneNumberRoute_businessId_fkey";

-- DropTable
DROP TABLE "AuditEvent";

-- DropTable
DROP TABLE "Business";

-- DropTable
DROP TABLE "InboundMessage";

-- DropTable
DROP TABLE "PhoneNumberRoute";

-- CreateTable
CREATE TABLE "business" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'START',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mei_contact" (
    "id" TEXT NOT NULL,
    "wa_id" TEXT NOT NULL,
    "display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "mei_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_number_route" (
    "id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "business_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_number_route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER,
    "duration_min" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rule" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_min" INTEGER NOT NULL,
    "end_min" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "business_id" TEXT NOT NULL,

    CONSTRAINT "availability_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "state_b2b" "B2BConversationState",
    "business_id" TEXT,
    "phone_number_id" TEXT,
    "from_wa_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_message" (
    "id" TEXT NOT NULL,
    "provider_message_id" TEXT NOT NULL,
    "phone_number_id" TEXT NOT NULL,
    "from_wa_id" TEXT,
    "message_type" TEXT,
    "text_body" TEXT,
    "provider_timestamp" TEXT,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "business_id" TEXT,
    "phone_number_id" TEXT,
    "conversation_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mei_contact_wa_id_key" ON "mei_contact"("wa_id");

-- CreateIndex
CREATE UNIQUE INDEX "phone_number_route_phone_number_id_key" ON "phone_number_route"("phone_number_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_business_id_name_key" ON "service"("business_id", "name");

-- CreateIndex
CREATE INDEX "availability_rule_business_id_weekday_idx" ON "availability_rule"("business_id", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_message_provider_message_id_key" ON "inbound_message"("provider_message_id");

-- AddForeignKey
ALTER TABLE "mei_contact" ADD CONSTRAINT "mei_contact_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_number_route" ADD CONSTRAINT "phone_number_route_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service" ADD CONSTRAINT "service_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rule" ADD CONSTRAINT "availability_rule_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
