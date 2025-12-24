import { MongoClient, Db, Document, Collection } from "mongodb";

// Util koneksi MongoDB (nama fungsi dan variabel berbahasa Indonesia)
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/monitoring";
let klien: MongoClient | null = null;
let dbInstansi: Db | null = null;

export async function SambungkanMongo(): Promise<Db> {
  if (dbInstansi) return dbInstansi;
  if (!klien) klien = new MongoClient(MONGODB_URI);
  if (!klien) throw new Error("Gagal membuat MongoClient");
  await klien.connect();
  dbInstansi = klien.db(); // akan mengambil nama DB dari URI atau default 'monitoring'
  return dbInstansi;
}

export async function DapatkanKoleksi<T extends Document = Document>(namaKoleksi: string): Promise<Collection<T>> {
  const db = await SambungkanMongo();
  return db.collection<T>(namaKoleksi);
}
