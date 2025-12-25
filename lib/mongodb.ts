import { MongoClient, Db, Document, Collection } from "mongodb";

// Ambil URI MongoDB dari variabel lingkungan `MONGODB_URI`, atau gunakan alamat lokal default.
// Nilai ini dipakai saat membuat MongoClient untuk terhubung ke database.
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/monitoring";

// Simpan `MongoClient` dan `Db` sebagai singleton supaya koneksi bisa dipakai ulang oleh seluruh proses.
// Cara ini mengurangi overhead membuat koneksi berulang dan menjaga performa.
let klien: MongoClient | null = null;
let dbInstansi: Db | null = null;

// Kembalikan instance `Db` yang sudah terhubung atau buat koneksi baru jika belum ada.
// Fungsi ini membuat `MongoClient`, memanggil `connect()` dan menyimpan `Db` untuk dipakai selanjutnya.
export async function SambungkanMongo(): Promise<Db> {
  if (dbInstansi) return dbInstansi;
  if (!klien) klien = new MongoClient(MONGODB_URI);
  if (!klien) throw new Error("Gagal membuat MongoClient");
  await klien.connect();
  dbInstansi = klien.db();
  return dbInstansi;
}

// Pastikan ada koneksi ke database lalu kembalikan koleksi yang diminta.
// Gunakan helper ini untuk operasi baca/tulis ke koleksi tertentu.
export async function DapatkanKoleksi<T extends Document = Document>(namaKoleksi: string): Promise<Collection<T>> {
  const db = await SambungkanMongo();
  return db.collection<T>(namaKoleksi);
}
