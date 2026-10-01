# Audio dari teks: eSpeak NG

Menu: Audio Library > Buat Audio dari Teks. Isi teks, pilih suara dan kecepatan, klik Buat Suara, dengarkan preview, lalu Simpan ke Audio Library. File WAV dapat langsung dipilih di Jadwal Audio. Tidak perlu API key, akun Azure, atau koneksi internet untuk sintesis. Suara sintetis lebih robotik daripada layanan neural.

## Windows lokal

Project ini mencari executable di `.local/espeak/portable/eSpeak NG/espeak-ng.exe`, lalu lokasi instalasi Windows standar. Installer resmi yang telah diekstrak ada di `.local/espeak`; folder ini tidak masuk Git.

Di komputer lain, unduh installer dari https://github.com/espeak-ng/espeak-ng/releases dan pasang eSpeak NG. Jika memakai lokasi lain, isi `apps/api/.env`:

```dotenv
ESPEAK_PATH="C:/Program Files/eSpeak NG/espeak-ng.exe"
```

Folder `espeak-ng-data` harus berada di sebelah executable untuk instalasi Windows portable. Restart API lalu klik Cek Layanan. Variabel AZURE_SPEECH_KEY dan AZURE_SPEECH_REGION tidak digunakan lagi.

## Deployment

Dockerfile API memasang `espeak-ng` melalui `apk add --no-cache espeak-ng`. Build ulang image API dan admin saat nanti melakukan deployment. Instalasi binary lokal Windows tidak ikut diunggah. Jangan menetapkan ESPEAK_PATH ke lokasi Windows di hosting Linux; biarkan kosong untuk memakai executable dalam PATH container. Tidak perlu migrasi database baru. Docker belum diuji pada mesin lokal ini.

Audio dibuat di server API dan disimpan melalui alur upload Audio Library. Suara terdengar melalui browser/player pada perangkat speaker. Preview belum disimpan akan hilang saat refresh. Teks dibatasi 3000 karakter, proses memiliki timeout 60 detik dan satu permintaan sintesis bersamaan per proses API.

## Uji

Setelah build API dan memasang eSpeak: `node apps/api/tests/speech.test.cjs`. Tes membuat suara asli tanpa layanan eksternal dan menaruh contoh WAV di `.local/espeak-preview.wav`.