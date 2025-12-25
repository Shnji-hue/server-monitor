import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PemantauServerSingleton } from "../../../../services/pemantauServer";

export async function POST(_req: NextRequest) {
  try {
    const bacaan = await PemantauServerSingleton.buatBacaanSekali();
    return NextResponse.json({ sukses: true, data: bacaan }, { status: 200 });
  } catch (err) {
    console.error("[/api/server-status/generate] Error:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal membuat bacaan" }, { status: 500 });
  }
}
