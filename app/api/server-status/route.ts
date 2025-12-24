import { NextResponse } from "next/server";
import { PemantauServerSingleton } from "../../../services/pemantauServer";
import type { NextRequest } from "next/server";

// Endpoint GET /api/server-status
// Mengembalikan struktur yang konsisten untuk Chart.js / Recharts
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 120;

    const terbaru = PemantauServerSingleton.ambilStatusTerbaru();
    const riwayat = PemantauServerSingleton.ambilRiwayat(limit);
    const alertTerakhir = PemantauServerSingleton.ambilAlertTerakhir();

    return NextResponse.json(
      {
        sukses: true,
        data: {
          terbaru,
          riwayat,
          alertTerakhir,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error di /api/server-status:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal mengambil status server" }, { status: 500 });
  }
}
