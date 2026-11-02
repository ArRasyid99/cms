# CMS Masjid Muhammad Al Qosim

Headless CMS berbasis **Strapi 5.60** (TypeScript + MySQL) untuk melayani:

- `C:\Next\web-alqosim` — website masjid (artikel, kategori, tag, penulis)
- `C:\Dev\office` — katalog office space dan dashboard keuangan (transaksi, kegiatan, pengurus, laporan)

Admin panel: `http://localhost:1337/admin`
REST API: `http://localhost:1337/api`
GraphQL: `http://localhost:1337/graphql`

---

## 1. Prasyarat

| Kebutuhan | Versi |
|---|---|
| Node.js | 20 – 26 (teruji di 24.22.2) |
| npm | 6+ |
| MySQL | 8.0 (Laragon) |

> **Penting (mesin ini):** direktori `C:\` memiliki ACL `Everyone: FullControl` sehingga
> `@swc/core` menolak cache default. Workaround sudah diatur di `.env`:
> `SWC_NATIVE_BINDING_CACHE=D:\swc-cache`. Jika folder itu belum ada, buat dengan ACL
> hanya untuk user Anda, atau hapus baris tersebut di mesin lain.

---

## 2. Setup database

Jalankan MySQL (Laragon → Start All), lalu:

```sql
CREATE DATABASE IF NOT EXISTS strapi_cms
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER 'strapi'@'localhost' IDENTIFIED BY 'ganti-password';
CREATE USER 'strapi'@'127.0.0.1' IDENTIFIED BY 'ganti-password';

GRANT ALL PRIVILEGES ON strapi_cms.* TO 'strapi'@'localhost';
GRANT ALL PRIVILEGES ON strapi_cms.* TO 'strapi'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Sesuaikan `DATABASE_*` di `.env`. Database lain di MySQL **tidak** disentuh.

---

## 3. Instalasi & menjalankan

```bash
npm install
npm run develop     # mode pengembangan (hot reload), http://localhost:1337
npm run build       # build admin panel untuk produksi
npm run start       # jalankan hasil build
```

Saat pertama dibuka, Strapi meminta pembuatan **akun admin** di `/admin`.

### Seed data

Seed berjalan otomatis saat bootstrap jika `SEED_DATA=true` (lihat `.env`) dan tabel
`cities` masih kosong. Data yang dibuat:

- 12 kota
- 2 office space + galeri + kontak sales
- 3 transaksi, 2 kegiatan, 3 pengurus
- 1 laporan keuangan PDF contoh
- 3 kategori, 5 tag, 2 penulis, 5 artikel

Seed bersifat idempotent (dilewati jika data sudah ada). Setelah selesai, ubah
`SEED_DATA=false`. Aset sumber ada di `seed-assets/`.

### Akun admin & API token

```bash
npm run setup:admin   # buat admin pertama + token read-only "office-frontend"
npm run setup:roles   # buat role "Editor Konten" dan "Finance"
```

Hasilnya:

- `.strapi-admin-credentials.txt` — kredensial admin (jangan di-commit)
- `.strapi-api-token` — API token read-only untuk finance (jangan di-commit)

Kedua file sudah masuk `.gitignore`. Jika DB di-reset, jalankan ulang kedua perintah.

---

## 4. Struktur konten

### Blog

| Content type | Field utama |
|---|---|
| **Article** | `title`, `slug`, `excerpt`, `content` (Blocks), `cover`, `author`, `category`, `tags`, `featured`, `seo` |
| **Category** | `name`, `slug`, `description`, `articles` |
| **Tag** | `name`, `slug`, `articles` |
| **Author** | `name`, `slug`, `avatar`, `bio`, `role`, `articles` |

### Produk / layanan

| Content type | Field utama |
|---|---|
| **City** | `name`, `slug`, `image`, `description`, `officeSpaces`, `officeCount` (dihitung otomatis) |
| **Office Space** | `title`, `slug`, `price`, `duration`, `about`, `address`, `rating`, `tags` (JSON), `image`, `images`, `features`, `salesContact`, `isFullBooked`, `city` |

### Keuangan & operasional

| Content type | Field utama |
|---|---|
| **Transaction** | `tanggal`, `tipe` (`pemasukan`/`pengeluaran`), `sumber_kategori`, `nominal`, `keterangan`, `lampiran` |
| **Financial Report** | `title`, `periode`, `reportType` (`neraca`/`laba-rugi`/`arus-kas`/`lainnya`), `file` (PDF), `summary` |
| **Activity** | `nama`, `tanggal`, `waktu`, `penanggungJawab`, `status` (`terjadwal`/`berjalan`/`selesai`) |
| **Staff** | `nama`, `jabatan`, `kontak`, `role` (`admin`/`viewer`) |

---

## 5. Hak akses

### Public (tanpa token)

Hanya **baca** untuk: `article`, `category`, `tag`, `author`, `city`, `office-space`,
`activity`. Permission ini diatur otomatis saat bootstrap.

Registrasi/login end-user `users-permissions` **dinonaktifkan** untuk role public.

### Finance (wajib API token)

`transaction`, `financial-report`, dan `staff` **tidak** dapat diakses publik.

Buat token di **Admin Panel → Settings → API Tokens**:

- Name: `office-frontend`
- Token type: `Read-only` (atau custom yang dibatasi ke tipe finance)
- Duration: `Unlimited` untuk lokal

Simpan token **hanya di server** frontend (`.env.local`), jangan pernah dikirim ke browser.

```http
Authorization: Bearer <API_TOKEN>
```

> Catatan: API token read-only berlaku untuk semua content type. Jika perlu pembatasan
> lebih ketat, gunakan custom token dengan scope terbatas.

### Role admin

Role `Editor Konten` dan `Finance` dibuat otomatis oleh `npm run setup:roles`
(dengan menyalin permission role bawaan `Editor`, lalu membatasi content type-nya):

| Role | Akses |
|---|---|
| Super Admin | penuh (akun pertama) |
| Editor Konten | Article, Category, Tag, Author, City, Office Space, Activity |
| Finance | Transaction, Financial Report, Staff, Activity |
| Editor / Author | role bawaan Strapi |

Role tetap bisa diubah kapan saja di **Settings → Administration Roles**.
Script aman dijalankan ulang: role yang sudah ada akan dilewati.

---

## 6. Contoh query

### REST

```http
# Artikel publish + relasi
GET /api/articles?populate[cover]=true&populate[category]=true&populate[tags]=true&populate[author]=true&filters[slug][$eq]=keutamaan-shalat-berjamaah-di-masjid

# Daftar kota beserta jumlah office space
GET /api/cities?sort=name:asc

# Office space per kota
GET /api/office-spaces?filters[city][slug][$eq]=jakarta-pusat&populate=*

# Kegiatan
GET /api/activities?sort=tanggal:asc

# Finance (token wajib)
GET /api/transactions?sort=tanggal:desc
GET /api/financial-reports?populate=file
GET /api/staffs?sort=nama:asc
```

Media berada di `http://localhost:1337/uploads/...` (field media mengembalikan `url`).

### GraphQL

```graphql
query Articles {
  articles(filters: { slug: { eq: "keutamaan-shalat-berjamaah-di-masjid" } }) {
    documentId
    title
    slug
    excerpt
    content
    cover { url }
    category { name slug }
    tags { name slug }
    author { name slug }
  }
}

query Transactions {
  transactions(sort: "tanggal:desc") {
    documentId
    tanggal
    tipe
    sumber_kategori
    nominal
    keterangan
  }
}
```

GraphQL playground hanya aktif saat mode development.

---

## 7. Integrasi frontend

### `C:\Dev\office`

Field sengaja mengikuti tipe yang sudah ada:

| Tipe frontend | Endpoint Strapi |
|---|---|
| `City` | `/api/cities` (`officeCount` sudah tersedia) |
| `OfficeSpace` | `/api/office-spaces?populate=*` |
| `Transaction` | `/api/transactions` (token) |
| `Activity` | `/api/activities` |
| `Staff` | `/api/staffs` (token) |
| `FinancialReport` | `/api/financial-reports?populate=file` (token) |

Contoh:

```ts
const res = await fetch(`${process.env.STRAPI_URL}/api/cities`, {
  headers: { Authorization: `Bearer ${process.env.STRAPI_API_TOKEN}` },
  cache: "no-store",
});
```

### `C:\Next\web-alqosim`

- Artikel: `/api/articles?populate=*`
- Konten artikel memakai **Blocks JSON**, bukan HTML WordPress. Render di Next.js dengan
  `@strapi/blocks-react-renderer`.
- Gambar: tambahkan `localhost:1337` ke `images.remotePatterns` di `next.config.ts`.
- Untuk produksi, ganti redirect `/admin` WordPress ke `/admin` Strapi atau domain CMS.

---

## 8. Backup & restore MySQL

```bash
# Backup
mysqldump -u strapi -p strapi_cms > backup-strapi_cms.sql

# Restore
mysql -u strapi -p strapi_cms < backup-strapi_cms.sql
```

Untuk produksi, backup juga folder `public/uploads` (media lokal).

---

## 9. Catatan produksi

- Ganti semua secret di `.env` (`APP_KEYS`, `JWT_SECRET`, dll).
- Set `HOST=127.0.0.1` jika hanya diakses via reverse proxy, atau `0.0.0.0` bila perlu.
- Atur `CORS_ORIGINS` ke domain frontend.
- Gunakan HTTPS dan reverse proxy (Nginx/Caddy).
- Pertimbangkan object storage (S3/Cloudinary) untuk media.
- Nonaktifkan `SEED_DATA`.
- Backup database + uploads secara berkala.

---

## 10. Troubleshooting

| Masalah | Solusi |
|---|---|
| `Failed to load native binding` (@swc/core) | Pastikan `SWC_NATIVE_BINDING_CACHE` menunjuk folder aman, atau jalankan ulang `npm rebuild @swc/core` |
| `ECONNREFUSED 127.0.0.1:3306` | Nyalakan MySQL/Laragon |
| `Access denied for user 'strapi'` | Cek `DATABASE_USERNAME`/`DATABASE_PASSWORD`, pastikan user punya grant |
| CORS error | Tambahkan origin frontend ke `CORS_ORIGINS`, restart Strapi |
| Media 404 | Pastikan `public/uploads` ada dan tidak terhapus |
