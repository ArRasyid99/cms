"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const MIME_TYPES = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
};
const PUBLIC_ACTIONS = [
    'api::article.article.find',
    'api::article.article.findOne',
    'api::category.category.find',
    'api::category.category.findOne',
    'api::tag.tag.find',
    'api::tag.tag.findOne',
    'api::author.author.find',
    'api::author.author.findOne',
    'api::city.city.find',
    'api::city.city.findOne',
    'api::office-space.office-space.find',
    'api::office-space.office-space.findOne',
    'api::activity.activity.find',
    'api::activity.activity.findOne',
];
const CITY_NAMES = [
    'Jakarta Pusat',
    'Jakarta Selatan',
    'Tangerang',
    'Jakarta Barat',
    'Jakarta Timur',
    'Jakarta Utara',
    'Semarang',
    'Bandung',
    'Surabaya',
    'Yogyakarta',
    'Medan',
    'Bali',
];
const paragraph = (text) => ({
    type: 'paragraph',
    children: [{ type: 'text', text }],
});
const heading = (text, level = 2) => ({
    type: 'heading',
    level,
    children: [{ type: 'text', text }],
});
async function uploadSeedFile(strapi, relativePath, name, alternativeText) {
    var _a;
    const filepath = node_path_1.default.join(process.cwd(), 'seed-assets', relativePath);
    if (!node_fs_1.default.existsSync(filepath)) {
        strapi.log.warn(`[seed] File tidak ditemukan, dilewati: ${filepath}`);
        return undefined;
    }
    const extension = node_path_1.default.extname(filepath).toLowerCase();
    const stats = node_fs_1.default.statSync(filepath);
    const uploadService = strapi.plugin('upload').service('upload');
    const [file] = await uploadService.upload({
        data: {
            fileInfo: {
                name,
                alternativeText,
            },
        },
        files: {
            filepath,
            originalFilename: node_path_1.default.basename(filepath),
            mimetype: (_a = MIME_TYPES[extension]) !== null && _a !== void 0 ? _a : 'application/octet-stream',
            size: stats.size,
        },
    });
    return file;
}
async function setupPublicPermissions(strapi) {
    const publicRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' } });
    if (!publicRole) {
        strapi.log.warn('[permissions] Role public tidak ditemukan.');
        return;
    }
    const permissionQuery = strapi.db.query('plugin::users-permissions.permission');
    const existingPermissions = await permissionQuery.findMany({
        where: { role: publicRole.id },
    });
    // Headless CMS ini tidak memakai autentikasi end-user, jadi matikan
    // endpoint register/login users-permissions untuk role public.
    for (const permission of existingPermissions) {
        if (permission.action.startsWith('plugin::users-permissions.auth.') ||
            permission.action.startsWith('plugin::users-permissions.user.')) {
            await permissionQuery.delete({ where: { id: permission.id } });
        }
    }
    for (const action of PUBLIC_ACTIONS) {
        const exists = existingPermissions.find((permission) => permission.action === action);
        if (!exists) {
            await permissionQuery.create({
                data: {
                    action,
                    role: publicRole.id,
                },
            });
        }
    }
    strapi.log.info(`[permissions] ${PUBLIC_ACTIONS.length} permission baca publik disiapkan.`);
}
async function seedData(strapi) {
    const existingCities = await strapi.documents('api::city.city').count({});
    if (existingCities > 0) {
        strapi.log.info('[seed] Data sudah ada, seed dilewati.');
        return;
    }
    strapi.log.info('[seed] Mengisi data awal...');
    const images = {};
    const cityImages = await Promise.all([
        uploadSeedFile(strapi, 'office/thumbnails-1.png', 'city-jakarta', 'Office space Jakarta'),
        uploadSeedFile(strapi, 'office/thumbnails-2.png', 'city-semarang', 'Office space Semarang'),
        uploadSeedFile(strapi, 'office/thumbnails-3.png', 'city-bandung', 'Office space Bandung'),
    ]);
    const officeCover = await uploadSeedFile(strapi, 'office/thumbnails-1.png', 'office-senayan', 'Senayan Office Space');
    const officeCover2 = await uploadSeedFile(strapi, 'office/thumbnails-2.png', 'office-hetero', 'Hetero Space Semarang');
    const officeGallery = await Promise.all([
        uploadSeedFile(strapi, 'office/thumbnail-details-1.png', 'office-detail-1', 'Detail office 1'),
        uploadSeedFile(strapi, 'office/thumbnail-details-2.png', 'office-detail-2', 'Detail office 2'),
    ]);
    const salesPhotos = await Promise.all([
        uploadSeedFile(strapi, 'office/photo-1.png', 'sales-1', 'Foto sales 1'),
        uploadSeedFile(strapi, 'office/photo-2.png', 'sales-2', 'Foto sales 2'),
    ]);
    const blogCovers = await Promise.all([
        uploadSeedFile(strapi, 'blog/img-header.webp', 'blog-shalat', 'Ilustrasi shalat berjamaah'),
        uploadSeedFile(strapi, 'blog/img-header2.webp', 'blog-wakaf', 'Ilustrasi wakaf'),
        uploadSeedFile(strapi, 'blog/ppdb.webp', 'blog-pendidikan', 'Ilustrasi pendidikan'),
        uploadSeedFile(strapi, 'blog/program-wakaf.png', 'blog-program', 'Ilustrasi program masjid'),
    ]);
    const users = await Promise.all([
        uploadSeedFile(strapi, 'office/photo-1.png', 'author-1', 'Foto penulis 1'),
        uploadSeedFile(strapi, 'office/photo-2.png', 'author-2', 'Foto penulis 2'),
    ]);
    const reportFile = await uploadSeedFile(strapi, 'reports/laporan-keuangan-contoh.pdf', 'laporan-keuangan-oktober-2023', 'Laporan Keuangan Oktober 2023');
    const cities = {};
    for (let index = 0; index < CITY_NAMES.length; index += 1) {
        const name = CITY_NAMES[index];
        const slug = name.toLowerCase().replace(/ /g, '-');
        const image = cityImages[index % cityImages.length];
        cities[name] = await strapi.documents('api::city.city').create({
            data: {
                name,
                slug,
                description: `Lokasi office space di ${name}.`,
                ...(image ? { image: image.id } : {}),
            },
        });
    }
    strapi.log.info(`[seed] ${CITY_NAMES.length} kota dibuat.`);
    const salesContact = [
        {
            name: 'Aisyah',
            role: 'Sales Manager',
            ...(salesPhotos[0] ? { photo: salesPhotos[0].id } : {}),
        },
        {
            name: 'Maryam',
            role: 'Sales Executive',
            ...(salesPhotos[1] ? { photo: salesPhotos[1].id } : {}),
        },
    ];
    await strapi.documents('api::office-space.office-space').create({
        data: {
            title: 'Senayan Office Space',
            slug: 'senayan-office-space',
            price: 2500000,
            duration: '28 days',
            about: 'A modern office space with all the amenities you need for a productive work environment.',
            address: 'Senayan City, Panin Tower, Jl. Asia Afrika No.Lot. 19 15th Floor, Gelora, Kecamatan Tanah Abang, Kota Jakarta Pusat, Daerah Khusus Ibukota Jakarta 10270, Indonesia',
            rating: 4.5,
            tags: ['modern'],
            ...(officeCover ? { image: officeCover.id } : {}),
            images: officeGallery.filter(Boolean).map((file) => file.id),
            features: [
                'Global Event',
                'Extras Snacks',
                'Free Move',
                'Privacy',
                'Sustainbility',
                'Compact',
            ].map((label) => ({ label })),
            salesContact,
            isFullBooked: false,
            city: cities['Jakarta Pusat'].documentId,
        },
        status: 'published',
    });
    await strapi.documents('api::office-space.office-space').create({
        data: {
            title: 'Hetero Space Semarang',
            slug: 'hetero-space-semarang',
            price: 1200000,
            duration: '28 days',
            about: 'A modern office space with all the amenities you need for a productive work environment.',
            address: 'UMKM Center, Jl. Setia Budi No.192 lantai 2, Srondol Wetan, Banyumanik, Semarang City, Central Java 50263, Indonesia',
            rating: 4.5,
            tags: ['Cheaper'],
            ...(officeCover2 ? { image: officeCover2.id } : {}),
            images: officeGallery.filter(Boolean).map((file) => file.id),
            features: ['Global Event', 'Extras Snacks', 'Free Move', 'Privacy', 'Sustainbility', 'Wifi'].map((label) => ({ label })),
            salesContact: [
                {
                    name: 'Abdullah',
                    role: 'Sales Manager',
                    ...(salesPhotos[0] ? { photo: salesPhotos[0].id } : {}),
                },
                {
                    name: 'Umar',
                    role: 'Sales Executive',
                    ...(salesPhotos[1] ? { photo: salesPhotos[1].id } : {}),
                },
            ],
            isFullBooked: true,
            city: cities.Semarang.documentId,
        },
        status: 'published',
    });
    strapi.log.info('[seed] 2 office space dibuat.');
    await strapi.documents('api::transaction.transaction').create({
        data: {
            tanggal: '2023-10-25',
            tipe: 'pemasukan',
            sumber_kategori: 'Infaq Jumat',
            nominal: 1500000,
            keterangan: 'Hasil kotak amal jumat',
        },
    });
    await strapi.documents('api::transaction.transaction').create({
        data: {
            tanggal: '2023-10-26',
            tipe: 'pengeluaran',
            sumber_kategori: 'Listrik',
            nominal: 450000,
            keterangan: 'Tagihan PLN Oktober',
        },
    });
    await strapi.documents('api::transaction.transaction').create({
        data: {
            tanggal: '2023-10-27',
            tipe: 'pemasukan',
            sumber_kategori: 'Donasi Pembangunan',
            nominal: 5000000,
            keterangan: 'Hamba Allah',
        },
    });
    await strapi.documents('api::activity.activity').create({
        data: {
            nama: 'Kajian Rutin Maghrib',
            tanggal: '2023-10-30',
            waktu: '18:15',
            penanggungJawab: 'Ust. Abdullah',
            status: 'terjadwal',
        },
    });
    await strapi.documents('api::activity.activity').create({
        data: {
            nama: 'Gotong Royong Kebersihan',
            tanggal: '2023-11-01',
            waktu: '08:00',
            penanggungJawab: 'Bapak Ahmad',
            status: 'terjadwal',
        },
    });
    await strapi.documents('api::staff.staff').create({
        data: {
            nama: 'H. Sulaiman',
            jabatan: 'Ketua DKM',
            kontak: '0812345678',
            role: 'admin',
        },
    });
    await strapi.documents('api::staff.staff').create({
        data: {
            nama: 'M. Rizky',
            jabatan: 'Bendahara',
            kontak: '0857891234',
            role: 'admin',
        },
    });
    await strapi.documents('api::staff.staff').create({
        data: {
            nama: 'Siti Aminah',
            jabatan: 'Sekretaris',
            kontak: '0899123456',
            role: 'viewer',
        },
    });
    await strapi.documents('api::financial-report.financial-report').create({
        data: {
            title: 'Laporan Keuangan Oktober 2023',
            periode: 'Oktober 2023',
            reportType: 'laba-rugi',
            summary: 'Contoh laporan keuangan bulanan untuk data awal.',
            ...(reportFile ? { file: reportFile.id } : {}),
        },
        status: 'published',
    });
    strapi.log.info('[seed] Transaksi, kegiatan, pengurus, dan laporan dibuat.');
    const categoryKajian = await strapi.documents('api::category.category').create({
        data: {
            name: 'Kajian',
            slug: 'kajian',
            description: 'Artikel seputar kajian dan ilmu agama.',
        },
    });
    const categoryBerita = await strapi.documents('api::category.category').create({
        data: {
            name: 'Berita',
            slug: 'berita',
            description: 'Kabar dan informasi terbaru.',
        },
    });
    const categoryProgram = await strapi.documents('api::category.category').create({
        data: {
            name: 'Program',
            slug: 'program',
            description: 'Program dan kegiatan masjid.',
        },
    });
    const tagKajian = await strapi.documents('api::tag.tag').create({
        data: { name: 'Kajian', slug: 'kajian' },
    });
    const tagMasjid = await strapi.documents('api::tag.tag').create({
        data: { name: 'Masjid', slug: 'masjid' },
    });
    const tagWakaf = await strapi.documents('api::tag.tag').create({
        data: { name: 'Wakaf', slug: 'wakaf' },
    });
    const tagPendidikan = await strapi.documents('api::tag.tag').create({
        data: { name: 'Pendidikan', slug: 'pendidikan' },
    });
    const tagKeluarga = await strapi.documents('api::tag.tag').create({
        data: { name: 'Keluarga', slug: 'keluarga' },
    });
    const author = await strapi.documents('api::author.author').create({
        data: {
            name: 'Admin Masjid',
            slug: 'admin-masjid',
            bio: 'Tim redaksi Masjid Muhammad Al Qosim.',
            role: 'Editor',
            ...(users[0] ? { avatar: users[0].id } : {}),
        },
    });
    const author2 = await strapi.documents('api::author.author').create({
        data: {
            name: 'Tim Kajian',
            slug: 'tim-kajian',
            bio: 'Tim kajian Yayasan Boja Mengaji.',
            role: 'Penulis',
            ...(users[1] ? { avatar: users[1].id } : {}),
        },
    });
    const articles = [
        {
            title: 'Keutamaan Shalat Berjamaah di Masjid',
            slug: 'keutamaan-shalat-berjamaah-di-masjid',
            excerpt: 'Shalat berjamaah memiliki keutamaan yang besar. Simak penjelasan singkat berikut ini.',
            category: categoryKajian.documentId,
            tags: [tagKajian.documentId, tagMasjid.documentId],
            author: author.documentId,
            cover: blogCovers[0],
            content: [
                heading('Keutamaan Shalat Berjamaah'),
                paragraph('Shalat berjamaah di masjid memiliki keutamaan yang sangat besar dibandingkan shalat sendirian.'),
                paragraph('Rasulullah shallallahu alaihi wa sallam menjelaskan bahwa shalat berjamaah dilipatgandakan pahalanya.'),
                heading('Menjaga Shaf dan Kekhusyukan', 3),
                paragraph('Datang lebih awal, merapikan shaf, dan menjaga kekhusyukan adalah bagian dari adab shalat berjamaah.'),
            ],
        },
        {
            title: 'Program Wakaf Pembangunan Masjid Al Qosim',
            slug: 'program-wakaf-pembangunan-masjid-al-qosim',
            excerpt: 'Dukung program wakaf pembangunan dan pengembangan sarana ibadah Masjid Muhammad Al Qosim.',
            category: categoryProgram.documentId,
            tags: [tagWakaf.documentId, tagMasjid.documentId],
            author: author.documentId,
            cover: blogCovers[1],
            content: [
                heading('Wakaf untuk Kemaslahatan Umat'),
                paragraph('Program wakaf ini ditujukan untuk pembangunan dan perawatan sarana ibadah serta kegiatan sosial masjid.'),
                paragraph('Setiap kontribusi akan dikelola secara amanah dan dilaporkan secara berkala kepada para donatur.'),
            ],
        },
        {
            title: 'Jadwal Kajian Rutin Bulan November',
            slug: 'jadwal-kajian-rutin-bulan-november',
            excerpt: 'Jadwal kajian rutin harian dan mingguan di Masjid Muhammad Al Qosim.',
            category: categoryKajian.documentId,
            tags: [tagKajian.documentId, tagKeluarga.documentId],
            author: author2.documentId,
            cover: blogCovers[3],
            content: [
                heading('Kajian Harian'),
                paragraph('Kajian rutin dilaksanakan setelah shalat Maghrib setiap hari dengan tema yang berganti-ganti.'),
                paragraph('Jadwal dapat berubah, silakan pantau informasi terbaru dari pengurus masjid.'),
            ],
        },
        {
            title: 'Pendidikan Diniyah untuk Anak-Anak',
            slug: 'pendidikan-diniyah-untuk-anak-anak',
            excerpt: 'Madrasah diniyah membantu anak-anak mempelajari dasar-dasar agama dengan cara yang menyenangkan.',
            category: categoryProgram.documentId,
            tags: [tagPendidikan.documentId, tagKeluarga.documentId],
            author: author2.documentId,
            cover: blogCovers[2],
            content: [
                heading('Belajar Agama Sejak Dini'),
                paragraph('Program pendidikan diniyah dirancang untuk membangun fondasi agama yang kuat sejak usia dini.'),
                paragraph('Kelas dilakukan secara interaktif dengan materi tajwid, hafalan, dan akhlak.'),
            ],
        },
        {
            title: 'Menjaga Kebersihan dan Kenyamanan Masjid',
            slug: 'menjaga-kebersihan-dan-kenyamanan-masjid',
            excerpt: 'Kebersihan masjid adalah tanggung jawab bersama seluruh jamaah.',
            category: categoryBerita.documentId,
            tags: [tagMasjid.documentId],
            author: author.documentId,
            cover: blogCovers[1],
            content: [
                heading('Masjid yang Bersih, Ibadah yang Nyaman'),
                paragraph('Kebersihan masjid merupakan bagian dari syiar Islam dan kenyamanan seluruh jamaah.'),
                paragraph('Mari bersama-sama menjaga kebersihan area masjid, tempat wudhu, dan halaman.'),
            ],
        },
    ];
    for (const article of articles) {
        await strapi.documents('api::article.article').create({
            data: {
                title: article.title,
                slug: article.slug,
                excerpt: article.excerpt,
                content: article.content,
                category: article.category,
                tags: article.tags,
                author: article.author,
                ...(article.cover ? { cover: article.cover.id } : {}),
                featured: article === articles[0],
                seo: {
                    metaTitle: article.title,
                    metaDescription: article.excerpt,
                },
            },
            status: 'published',
        });
    }
    strapi.log.info('[seed] 3 kategori, 5 tag, 2 penulis, dan 5 artikel dibuat.');
    strapi.log.info('[seed] Selesai.');
}
exports.default = {
    register() { },
    async bootstrap({ strapi }) {
        await setupPublicPermissions(strapi);
        if (process.env.SEED_DATA === 'true') {
            await seedData(strapi);
        }
    },
};
