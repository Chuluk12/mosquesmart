ALTER TABLE "AudioSchedule"
ADD COLUMN "resumePlayback" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "resumePositionSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("resumePositionSeconds" >= 0),
ADD COLUMN "resumeHistoryId" TEXT;