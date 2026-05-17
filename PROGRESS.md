# 🚀 VibeNongky - Progress Tracker & Checkpoint

Dokumen ini berfungsi sebagai "ingatan" atau *checkpoint* agar kita bisa langsung melanjutkan proyek ini di sesi berikutnya tanpa harus mengulang penjelasan dari awal.

## 🎯 Status Arsitektur Saat Ini
- **Frontend:** React + Vite + Tailwind CSS (di dalam `src/App.tsx`).
- **Database:** Supabase (PostgreSQL) dengan ekstensi PostGIS.
- **Peta & Lokasi:** Google Maps API (V1 REST API untuk pencarian & `@vis.gl/react-google-maps` untuk UI).
- **Kecerdasan Buatan (AI):** Google Gemini AI (`@google/genai`) untuk analisis *Vibe Check* secara otomatis.

## ✅ Apa yang Sudah Diselesaikan Hari Ini?
1. **Fungsionalitas Dashboard:**
   - Menghidupkan semua filter (Cafe WFC, Live Ramai, dll) di *frontend*.
   - Menyempurnakan logika filter, pencarian, dan slider harga di `App.tsx` dan menanamkan simulasi JS di `jelajah.html`.
2. **Infrastruktur "On-Demand Database" (Database Berkembang Otomatis):**
   - Menginisiasi koneksi Supabase di `src/lib/supabase.ts`.
   - Membuat algoritma cerdas di `src/lib/onDemandDatabase.ts` yang otomatis menarik data jika database kosong di sebuah kota.
3. **Penyelesaian Bug & Integrasi:**
   - Memperbaiki masalah tipe data `import.meta.env` di TypeScript.
   - Mengatasi masalah nama kolom *snake_case* dari Supabase (`image_urls`) agar bisa terbaca oleh React (*camelCase*).
   - Membuka blokir *Row Level Security (RLS)* di Supabase agar AI bisa bebas menyimpan data.
4. **Upgrade Data Asli (Real-Time Google Maps):**
   - Mengubah *mock data* menjadi panggilan API sungguhan ke `https://places.googleapis.com/v1/places:searchNearby`.
   - Menarik foto-foto HD asli dari Google Maps Places.

## 🚧 Langkah Selanjutnya (To-Do List Besok)
1. **Verifikasi Data Asli:** 
   - Memastikan bahwa setelah Anda menghapus data lama (`delete from spots;`) di Supabase, AI berhasil menarik dan menampilkan tempat-tempat *real* di Kediri beserta fotonya tanpa cacat.
2. **Penyempurnaan Tampilan (UI/UX):**
   - Memastikan foto asli dari Google Maps ter-*render* dengan proporsional di dalam kartu (karena dimensi foto asli bisa berbeda-beda).
3. **Penyempurnaan Fitur Detail & Bookmark:**
   - Menautkan tombol "Lihat Detail" agar halaman detail membaca data asli dari Supabase.
   - Menyimpan *Bookmark* (tempat favorit) ke dalam *Local Storage* atau Supabase khusus pengguna.
4. **Geolokasi Canggih:**
   - Memoles sistem deteksi lokasi agar lebih halus saat *user* menolak akses GPS.

---
*Catatan untuk AI: Saat membaca dokumen ini besok, langsung cek `src/lib/onDemandDatabase.ts` dan tanyakan hasil tarikan data Google Maps terakhir kepada user.*
