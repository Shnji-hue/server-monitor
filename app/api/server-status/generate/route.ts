import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { pemantauServer } from "../../../../services/pemantauServer";

export async function POST(_req: NextRequest) {
  try {
    const bacaan = await pemantauServer.buatBacaanSekali();
    return NextResponse.json({ sukses: true, data: bacaan }, { status: 200 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/server-status/generate] Error:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal membuat bacaan" }, { status: 500 });
  }
}
