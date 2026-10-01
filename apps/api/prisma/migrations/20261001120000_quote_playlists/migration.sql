CREATE TABLE "QuotePlaylist" (
  "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL,
  "audioIds" TEXT[] NOT NULL, "times" TEXT[] NOT NULL, "daysOfWeek" INTEGER[] NOT NULL,
  "volume" INTEGER NOT NULL DEFAULT 80 CHECK ("volume" BETWEEN 0 AND 100),
  "isActive" BOOLEAN NOT NULL DEFAULT false, "cycle" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "QuoteRun" (
  "id" TEXT NOT NULL PRIMARY KEY, "playlistId" TEXT NOT NULL, "cycle" INTEGER NOT NULL,
  "slot" TEXT NOT NULL, "audioId" TEXT, "selectedAudioId" TEXT NOT NULL,
  "audioName" TEXT NOT NULL, "deviceId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'LOADING',
  "playedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteRun_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "QuotePlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuoteRun_playlistId_slot_key" ON "QuoteRun"("playlistId", "slot");
CREATE UNIQUE INDEX "QuoteRun_playlistId_cycle_audioId_key" ON "QuoteRun"("playlistId", "cycle", "audioId");
CREATE TABLE "QuoteApproval" (
  "id" TEXT NOT NULL PRIMARY KEY, "playlistId" TEXT NOT NULL, "cycle" INTEGER NOT NULL,
  "approvedBy" TEXT NOT NULL, "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuoteApproval_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "QuotePlaylist"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "QuoteApproval_playlistId_cycle_key" ON "QuoteApproval"("playlistId", "cycle");