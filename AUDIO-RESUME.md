# Kelanjutan audio per jadwal

Di Jadwal Audio, pilih audio, isi batas durasi, lalu centang
"Lanjutkan dari posisi terakhir" dan simpan.

Contoh: audio 2 jam, batas 60 menit. Jadwal pertama memutar menit 0-60,
jadwal berikutnya melanjutkan menit 60-120. Setelah audio selesai secara
alami, posisi kembali nol untuk jadwal selanjutnya. Tidak mengulang
langsung di sesi yang sama.

Posisi disimpan pada AudioSchedule, terpisah antarjadwal. Mengganti audio
atau mengubah opsi kelanjutan mereset posisi. Mengubah jam/volume/batas
durasi tetap mempertahankan posisi.

Player melaporkan posisi setiap 10 detik dan ketika berhenti/selesai.
Jika perangkat mati mendadak, pemutaran berikutnya mungkin mengulang
hingga sekitar 10 detik dari checkpoint terakhir yang diterima server.
Laporan pemutaran lama tidak menimpa checkpoint sesi baru.

Jadwal kelanjutan dikirim ke satu player online (koneksi pertama) supaya
hanya satu perangkat menjadi sumber posisi. Gunakan satu player aktif.
Jadwal tanpa kelanjutan tetap menggunakan perilaku sebelumnya.

Migrasi: 20261001140000_schedule_resume. Saat deploy nanti, jalankan
prisma:deploy dan prisma:generate pada workspace API. Restart API dan
Audio Player Service. Untuk browser, refresh halaman lalu aktifkan ulang
Audio Browser. Jangan gunakan versi player lama untuk fitur kelanjutan.

Validasi lokal:
- Build API, admin-web, audio-player.
- node apps/api/tests/schedule-resume.test.cjs
- node apps/api/tests/quote-playlist.test.cjs
- node apps/audio-player/tests/playback-limit.test.cjs
- node apps/audio-player/tests/resume-seek.test.cjs

Uji ffplay memakai WAV diam dengan SDL dummy (tidak mengeluarkan suara).
Uji speaker fisik, browser end-to-end, dan fallback Windows Media Player
belum dilakukan. Hosting tidak diubah.