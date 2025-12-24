import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DapatkanKoleksi } from "../../../lib/mongodb";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 20;

    const koleksi = await DapatkanKoleksi("alerts");
    const docs = await koleksi.find().sort({ waktu: -1 }).limit(limit).toArray();

    const hasil = docs.map((d: any) => ({ pesan: d.pesan, waktu: d.waktu }));

    return NextResponse.json({ sukses: true, data: hasil }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/alerts] Error:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal mengambil alerts" }, { status: 500 });
  }
}
