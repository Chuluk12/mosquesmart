ALTER TABLE "Content" ADD COLUMN "durationSeconds" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Content" ADD CONSTRAINT "Content_durationSeconds_check" CHECK ("durationSeconds" BETWEEN 1 AND 3600);
