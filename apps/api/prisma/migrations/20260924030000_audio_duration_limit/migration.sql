ALTER TABLE "AudioSchedule" ADD COLUMN "maxDurationMinutes" INTEGER;
ALTER TABLE "AudioSchedule" ADD CONSTRAINT "AudioSchedule_maxDurationMinutes_check"
CHECK ("maxDurationMinutes" IS NULL OR "maxDurationMinutes" BETWEEN 1 AND 1440);
