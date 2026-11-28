# EduSmart

Aplikasi sekolah berbasis Express, HTML, CSS, dan JavaScript. Data akun, sesi, posting, komentar, tugas, pengaturan sekolah, dan kehadiran disimpan di MySQL. File unggahan disimpan di folder `DATA_DIR` (default `./data`).

## Menjalankan
1. Jalankan `npm install`.
2. Salin `.env.example` menjadi `.env`, lalu atur koneksi MySQL, password admin, dan rahasia sesi.
3. Jalankan `npm start`, lalu buka `http://localhost:3000`.

Server membuat database dan tabel yang diperlukan saat startup. MySQL harus berjalan dan pengguna database harus memiliki izin membuat database serta tabel.

Pada startup pertama tanpa `.env`, server membuat admin lokal `admin@edusmart.example` dan mencetak password sementara satu kali di terminal. Jika admin sudah ada di database, server tidak membuat ulang password.

Pendaftaran email membutuhkan nama, email, password, dan peran. Nomor induk opsional; siswa juga memilih kelas, sedangkan guru memilih satu atau lebih mata pelajaran yang disediakan admin. Default `AUTO_ACTIVATE_ACCOUNTS=false`: akun menunggu aktivasi admin. Set `true` hanya untuk pengembangan atau deployment tertutup yang memang mengizinkan aktivasi otomatis. Login baru membatalkan sesi lama akun yang sama, dan login menggunakan sesi server dengan cookie `httpOnly`.

Jalankan tes integrasi dengan `npm test`.

## Cara Cek Database
Untuk melihat tabel, akun, dan jumlah data di database MySQL yang dikonfigurasi, jalankan:

```powershell
npm run db:inspect
```

Perintah ini hanya menjalankan query baca. Hasilnya mencakup nama dan email akun, jadi jangan membagikan output tersebut. Foto kehadiran dan file unggahan disimpan di folder `data/`, terpisah dari folder publik; jangan bagikan atau commit folder itu.

## Login Google
Login Google aktif setelah sekolah mengisi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` dari Google Cloud OAuth Web Client. Keduanya wajib saat `NODE_ENV=production`; pada pengembangan lokal, keduanya boleh kosong. Atur `APP_URL`, authorized origin, dan callback `${APP_URL}/auth/google/callback`. Akun Google baru mengikuti `AUTO_ACTIVATE_ACCOUNTS`. Kamera, geolokasi, dan OAuth di deployment publik memerlukan HTTPS.

## Foto Kehadiran
Pengguna mengaktifkan kamera, menyetujui pengiriman, memeriksa lokasi, lalu mengirim foto ke server. Server memeriksa format dan ukuran foto, akurasi GPS, radius sekolah, jam absen, serta kecocokan awal deskriptor wajah dengan data akun. Template wajah disimpan terenkripsi AES-256-GCM dan tidak dikirim kembali ke browser. Template format lama dienkripsi otomatis saat startup; template rusak dibuang. Gunakan `BIOMETRIC_KEY` yang acak dan rahasia; jika kosong, `SESSION_SECRET` digunakan sebagai kunci, sehingga mengganti session secret membuat template lama tidak terbaca. Satu catatan disimpan per akun per hari, dan pengiriman ulang memperbarui catatan tersebut. Foto disimpan privat dan hanya dapat dibuka pemilik atau admin. Kehadiran selalu berstatus `MENUNGGU` sampai disetujui atau ditolak admin. Pemeriksaan awal belum mencegah replay deskriptor/foto dan bukan verifikasi identitas manusia; tinjau foto secara manual.

## Batas Deployment
Belum siap dipakai publik tanpa konfigurasi dan pemeriksaan tambahan: domain/HTTPS, kredensial Google, secret production, backup dan pemulihan MySQL/foto, kebijakan retensi foto, audit log, serta uji keamanan. Laporan dan beberapa ringkasan UI masih berupa data turunan/demo; tinjau alur dan privasi sekolah sebelum memasukkan data siswa asli.
