import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { dapatkanKoleksi } from "../../../../lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 120;

    const koleksi = await dapatkanKoleksi("history");
    const docs = await koleksi.find().sort({ waktu: -1 }).limit(limit).toArray();

    // Map dokumen ke format BacaanServer
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
