# Mosque Information & Audio System

Sistem display + audio announcement masjid. Monorepo: Admin Web, Display TV,
NestJS backend, PostgreSQL/Prisma, Socket.IO realtime, Node.js audio player
service.

## Stack
- Admin Web: React + TypeScript + Vite + React Router
- Display TV: React + TypeScript + Vite
- Backend: NestJS + TypeScript + Prisma + PostgreSQL
- Realtime: Socket.IO (`/realtime` untuk admin+display, `/player` untuk player fisik)
- Audio Player: Node.js TypeScript service (ffplay atau Windows Media Player)
- Shared types: `packages/shared-types`

## Status implementasi (lihat juga laporan lengkap di riwayat chat)
Semua modul backend, admin web, display TV, dan audio player service sudah
diimplementasikan dan sebagian besar **teruji nyata** (lihat bagian
"Apa yang sudah teruji" di bawah). Satu hal yang **belum bisa diverifikasi
end-to-end**: menjalankan backend NestJS sungguhan, karena lingkungan
development tempat kode ini ditulis tidak punya akses jaringan ke
`binaries.prisma.sh` (dipakai `prisma generate`/`migrate` untuk mengunduh
query engine). Ini **bukan masalah di kode** — di komputer Anda yang punya
akses internet normal, langkah di bawah akan berjalan seperti biasa.

## Menjalankan (development)

1. `cp .env.example .env` lalu sesuaikan (minimal `JWT_SECRET`,
   `SEED_SUPER_ADMIN_PASSWORD`).
2. `docker compose up -d` (PostgreSQL).
3. `npm install` di root (workspace-aware, akan install semua `apps/*` dan `packages/*`).
4. `npm run prisma:generate -w apps/api`
5. `npm run prisma:migrate -w apps/api` — akan mendeteksi migration yang
   sudah ada di `apps/api/prisma/migrations/20260918000000_init/` dan
   menerapkannya (migration ini sudah divalidasi jalan 100% di PostgreSQL
   asli selama pengembangan).
6. `npm run prisma:seed -w apps/api` — membuat akun SUPER_ADMIN pertama dari
   `SEED_SUPER_ADMIN_USERNAME`/`SEED_SUPER_ADMIN_PASSWORD` di `.env`, plus
   profil masjid & prayer settings default.
7. Terminal 1: `npm run dev:api` (http://localhost:3000/api)
8. Terminal 2: `npm run dev:admin` (http://localhost:5173)
9. Terminal 3: `npm run dev:display` (http://localhost:5174)
10. Terminal 4 (di mini-PC player, boleh mesin berbeda):
    `npm run dev:player` — set `PLAYER_SOCKET_URL` ke alamat backend.

Login pertama kali di Admin Web pakai kredensial dari langkah 6.

## Audio playback di Windows (Player Service)

Player Service otomatis memilih engine terbaik yang tersedia:

1. **ffplay (disarankan)** — kalau `ffmpeg` ter-install dan ada di PATH
   (termasuk di Windows), dipakai otomatis. Ini adalah jalur yang paling
   teruji selama pengembangan (lihat laporan testing). Unduh dari
   https://www.gyan.dev/ffmpeg/builds/ dan tambahkan folder `bin`-nya ke PATH.
2. **Windows Media Player (fallback)** — kalau ffmpeg tidak ada dan OS-nya
   Windows, dipakai otomatis lewat PowerShell + WMP ActiveX (tanpa install
   tambahan). **Belum bisa diuji langsung** di lingkungan pengembangan ini
   (Linux-only sandbox) — validasikan di mini-PC Windows sungguhan sebelum
   dipakai produksi.
3. Kalau keduanya tidak tersedia, service tetap jalan (tidak crash) tapi
   melaporkan status `ERROR` setiap kali diminta memutar audio.

## Struktur

```
apps/
  admin-web/       Panel admin (login, dashboard, settings, audio, jadwal, player, history)
  display-web/     Layar TV masjid (state machine NORMAL/PRE_PRAYER/ADHAN/IQOMAH_COUNTDOWN/PRAYER)
  api/             Backend NestJS + Prisma
  audio-player/    Service Node.js yang berjalan di PC/mini-PC dekat amplifier
packages/
  shared-types/    Tipe TypeScript yang dipakai lintas app (PrayerName, DisplayState, dst)
```

## Catatan arsitektur penting

- **Prayer Engine** memakai abstraksi `PrayerProvider` (lihat
  `apps/api/src/prayer/providers/`) sehingga sumber jadwal sholat bisa
  diganti tanpa menyentuh scheduler/display. Implementasi default memakai
  Aladhan API dengan timeout+retry, di-cache ke PostgreSQL, dan fallback ke
  jadwal tersimpan terakhir kalau internet mati.
- **Scheduler** memakai idempotency lock di level database (unique
  constraint `(scheduleId, plannedDate)` di tabel `ScheduleExecution`) agar
  audio terjadwal tidak pernah terputar dua kali akibat tick yang tumpang
  tindih atau restart server.
- Audio terjadwal (FIXED_TIME/PRAYER_RELATIVE) saat ini disiarkan ke
  **semua player yang sedang online** — skema data belum mengaitkan jadwal
  ke player tertentu. Kalau Anda butuh penjadwalan per-zona/per-player,
  tambahkan kolom `playerId` opsional di model `AudioSchedule`.
