-- CreateEnum
CREATE TYPE "AgentJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "agent_job" (
    "id" TEXT NOT NULL,
    "domain" "Domain" NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "AgentJobStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" TEXT,
    "phone_number_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "from_wa_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_job_provider_message_id_key" ON "agent_job"("provider_message_id");

-- CreateIndex
CREATE INDEX "agent_job_domain_status_created_at_idx" ON "agent_job"("domain", "status", "created_at");


