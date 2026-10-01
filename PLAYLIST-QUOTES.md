# Playlist Quotes

Menu admin: **Playlist Quotes** (/quote-playlists).

1. Upload beberapa MP3/WAV atau pilih audio aktif dari Audio Library.
2. Tentukan hari, jam (satu audio per jam pilihan), dan volume.
   Form awal berisi delapan jam Senin-Jumat; ubah sesuai kebutuhan.
3. Simpan dan aktifkan playlist. Aktifkan satu player pada perangkat speaker.
4. Pantau stok dan riwayat. Setelah stok habis, ADMIN / SUPER_ADMIN menekan
   **Setujui Putar Ulang**, lalu mengonfirmasi putaran baru.

Setiap playlist memiliki kumpulan audio dan riwayat terpisah. Pengeditan jadwal
tidak mereset putaran; kumpulan audio ditetapkan saat pembuatan. Audio tidak aktif
atau dihapus dari Library tidak dipilih. Jangan membuat jadwal biasa/playlist lain
dengan audio yang sama jika aturan tanpa pengulangan harus berlaku untuk kumpulan ini.

## Perilaku

- Acak tanpa penggantian, dengan reservasi dan slot unik di PostgreSQL.
- Scheduler memeriksa setiap 20 detik, mengikuti zona waktu mushola.
- Memilih satu player online yang tidak sedang memutar audio, mengutamakan
  koneksi dengan heartbeat terbaru. Gunakan satu perangkat speaker aktif.
- Offline/sibuk: coba lagi selama menit jadwal; setelah menit berlalu dilewati,
  tidak mengejar seluruh jadwal lama. Audio yang belum dicadangkan tetap tersedia.
- Gagal sebelum PLAYING: audio kembali ke stok untuk slot berikutnya.
- Sudah PLAYING, selesai, atau dihentikan: terkunci sampai persetujuan putaran baru.
- Putus koneksi / hasil tidak diketahui: tetap dicadangkan. Admin dapat membuka
  riwayat dan memilih **Tangani koneksi terputus** setelah memastikan speaker
  berhenti. Hanya tersedia saat player offline; audio tetap ditandai terpakai.
- Persetujuan ulang hanya saat stok aktif habis dan tidak ada pemutaran tertunda.
  Persetujuan mencatat admin/waktu/putaran dan tidak mengulang slot yang sudah dikirim.
- Tidak mengaktifkan jadwal baru secara otomatis pada pembuatan form.
- Aturan berlaku per playlist, bukan deduplikasi isi berkas secara global.

## Validasi lokal

Migrasi: apps/api/prisma/migrations/20261001120000_quote_playlists/migration.sql.

Sebelum menjalankan versi ini pada lingkungan lain, jalankan:
npm run prisma:deploy --workspace @mosque/api
npm run prisma:generate --workspace @mosque/api

Build:
npm run build --workspace @mosque/api
npm run build --workspace @mosque/admin-web

Tes integrasi (hanya database localhost; fixture dibersihkan, tidak memutar speaker):
node apps/api/tests/quote-playlist.test.cjs

Arsitektur player mengikuti sistem yang ada: koneksi Socket.IO disimpan di
memori satu instance API. Menjalankan beberapa instance API perlu pengaturan
distribusi koneksi/scheduler tersendiri. Belum diuji pada hosting.