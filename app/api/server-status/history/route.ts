// Route ini mengembalikan riwayat server yang tersimpan di koleksi 'history'.
// Gunakan query parameter `limit` untuk jumlah data dan `metric` untuk meminta satu metrik saja.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DapatkanKoleksi } from "../../../../lib/mongodb";

// Handler GET: baca query, ambil dokumen dari DB, lalu format hasil sesuai permintaan.
// Mengembalikan array objek lengkap atau pasangan {waktu, value} saat `metric` dipakai.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 120;
    const metric = url.searchParams.get("metric"); // optional: cpu|mem|disk|suhu

    const koleksi = await DapatkanKoleksi("history");
    const docs = await koleksi.find().sort({ waktu: -1 }).limit(limit).toArray();

    // Jika metric diberikan, periksa validitas dan ubah dokumen menjadi {waktu, value} yang terurut lama->baru.
    // Jika metric tidak valid, kembalikan status 400 dengan pesan error.
    if (metric) {
      const allowed = new Set(["cpu", "mem", "disk", "suhu"]);
      if (!allowed.has(metric)) {
        return NextResponse.json({ sukses: false, pesan: "Metric tidak valid" }, { status: 400 });
      }

      const hasilMetric = docs
        .map((d: any) => ({
          waktu: d.waktu instanceof Date ? d.waktu.getTime() : new Date(d.waktu).getTime(),
          value: metric === "cpu" ? d.cpu : metric === "mem" ? d.mem : metric === "disk" ? d.disk : d.suhu,
        }))
        .reverse();

      return NextResponse.json({ sukses: true, data: hasilMetric }, { status: 200 });
    }

    // Jika tidak ada metric, ubah dokumen menjadi format BacaanServer dan urutkan dari lama ke baru.
    // Format ini cocok untuk chart yang membutuhkan objek lengkap per bacaan.
    const hasil = docs
      .map((d: any) => ({
        waktu: d.waktu instanceof Date ? d.waktu.getTime() : new Date(d.waktu).getTime(),
        cpu: d.cpu,
        mem: d.mem,
        disk: d.disk,
        suhu: d.suhu,
        alert: d.alert ?? false,
        pesanAlert: d.pesan ?? null,
      }))
      .reverse(); // supaya terurut lama->baru untuk chart

    return NextResponse.json({ sukses: true, data: hasil }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/server-status/history] Error:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal mengambil history" }, { status: 500 });
  }
}
