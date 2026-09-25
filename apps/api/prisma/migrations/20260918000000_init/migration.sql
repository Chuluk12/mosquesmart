-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER');
CREATE TYPE "ContentType" AS ENUM ('ANNOUNCEMENT', 'QURAN', 'HADITH', 'IMAGE', 'VIDEO', 'RUNNING_TEXT');
CREATE TYPE "AudioCategory" AS ENUM ('ANNOUNCEMENT', 'MUROTTAL', 'ADHAN', 'PRAYER_REMINDER', 'GENERAL');
CREATE TYPE "ScheduleType" AS ENUM ('FIXED_TIME', 'PRAYER_RELATIVE');
CREATE TYPE "PlayerStatus" AS ENUM ('ONLINE', 'OFFLINE', 'PLAYING', 'ERROR');
CREATE TYPE "TriggerType" AS ENUM ('MANUAL', 'SCHEDULE', 'PRAYER');
CREATE TYPE "PrayerName" AS ENUM ('FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA');
CREATE TYPE "PlaybackStatus" AS ENUM ('LOADING', 'PLAYING', 'FINISHED', 'STOPPED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "email" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Mosque" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "city" TEXT,
  "province" TEXT,
  "latitude" DECIMAL(65,30),
  "longitude" DECIMAL(65,30),
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  "logo" TEXT,
  "runningText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Mosque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerSetting" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "calculationMethod" TEXT NOT NULL DEFAULT 'MWL',
  "fajrOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "dhuhrOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "asrOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "maghribOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "ishaOffsetMin" INTEGER NOT NULL DEFAULT 0,
  "fajrIqomahMin" INTEGER NOT NULL DEFAULT 10,
  "dhuhrIqomahMin" INTEGER NOT NULL DEFAULT 10,
  "asrIqomahMin" INTEGER NOT NULL DEFAULT 10,
  "maghribIqomahMin" INTEGER NOT NULL DEFAULT 5,
  "ishaIqomahMin" INTEGER NOT NULL DEFAULT 10,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrayerSetting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrayerSetting_mosqueId_key" ON "PrayerSetting"("mosqueId");

-- CreateTable
CREATE TABLE "PrayerSchedule" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "fajr" TEXT NOT NULL,
  "sunrise" TEXT,
  "dhuhr" TEXT NOT NULL,
  "asr" TEXT NOT NULL,
  "maghrib" TEXT NOT NULL,
  "isha" TEXT NOT NULL,
  "source" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrayerSchedule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrayerSchedule_mosqueId_date_key" ON "PrayerSchedule"("mosqueId", "date");
CREATE INDEX "PrayerSchedule_mosqueId_date_idx" ON "PrayerSchedule"("mosqueId", "date");

-- CreateTable
CREATE TABLE "Agenda" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "location" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Agenda_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Agenda_mosqueId_isActive_idx" ON "Agenda"("mosqueId", "isActive");

-- CreateTable
CREATE TABLE "Content" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "type" "ContentType" NOT NULL,
  "title" TEXT,
  "content" TEXT,
  "mediaUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Content_mosqueId_type_isActive_idx" ON "Content"("mosqueId", "type", "isActive");

-- CreateTable
CREATE TABLE "Audio" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "AudioCategory" NOT NULL,
  "filePath" TEXT NOT NULL,
  "duration" INTEGER,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Audio_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Audio_mosqueId_category_isActive_idx" ON "Audio"("mosqueId", "category", "isActive");

-- CreateTable
CREATE TABLE "AudioSchedule" (
  "id" TEXT NOT NULL,
  "audioId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Schedule',
  "scheduleType" "ScheduleType" NOT NULL,
  "prayerName" "PrayerName",
  "offsetMinutes" INTEGER,
  "fixedTime" TEXT,
  "daysOfWeek" INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6]::INTEGER[],
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "volume" INTEGER NOT NULL DEFAULT 80,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudioSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AudioSchedule_isActive_scheduleType_idx" ON "AudioSchedule"("isActive", "scheduleType");

-- CreateTable
CREATE TABLE "ScheduleExecution" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "plannedDate" DATE NOT NULL,
  "plannedTime" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScheduleExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScheduleExecution_scheduleId_plannedDate_key" ON "ScheduleExecution"("scheduleId", "plannedDate");

-- CreateTable
CREATE TABLE "AudioPlayer" (
  "id" TEXT NOT NULL,
  "mosqueId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "location" TEXT,
  "ipAddress" TEXT,
  "status" "PlayerStatus" NOT NULL DEFAULT 'OFFLINE',
  "volume" INTEGER NOT NULL DEFAULT 80,
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AudioPlayer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AudioPlayer_deviceId_key" ON "AudioPlayer"("deviceId");
CREATE INDEX "AudioPlayer_mosqueId_idx" ON "AudioPlayer"("mosqueId");

-- CreateTable
CREATE TABLE "PlaybackHistory" (
  "id" TEXT NOT NULL,
  "playerId" TEXT,
  "playerDeviceId" TEXT,
  "audioId" TEXT,
  "audioName" TEXT,
  "scheduleId" TEXT,
  "triggerType" "TriggerType" NOT NULL,
  "status" "PlaybackStatus" NOT NULL DEFAULT 'LOADING',
  "plannedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "triggeredByUserId" TEXT,
  CONSTRAINT "PlaybackHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlaybackHistory_startedAt_idx" ON "PlaybackHistory"("startedAt");
CREATE INDEX "PlaybackHistory_playerDeviceId_idx" ON "PlaybackHistory"("playerDeviceId");

-- AddForeignKey
ALTER TABLE "PrayerSetting" ADD CONSTRAINT "PrayerSetting_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerSchedule" ADD CONSTRAINT "PrayerSchedule_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agenda" ADD CONSTRAINT "Agenda_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Content" ADD CONSTRAINT "Content_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Audio" ADD CONSTRAINT "Audio_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioSchedule" ADD CONSTRAINT "AudioSchedule_audioId_fkey" FOREIGN KEY ("audioId") REFERENCES "Audio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleExecution" ADD CONSTRAINT "ScheduleExecution_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AudioSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AudioPlayer" ADD CONSTRAINT "AudioPlayer_mosqueId_fkey" FOREIGN KEY ("mosqueId") REFERENCES "Mosque"("id") ON DELETE CASCADE ON UPDATE CASCADE;
