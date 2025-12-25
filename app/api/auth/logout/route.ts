// Route logout: menghapus sesi di server dan menghapus cookie session di browser.
// Server memastikan token session dihapus dari koleksi 'sessions' sehingga tidak bisa dipakai lagi.
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { HapusSession } from "../../../../lib/auth";

// Handler POST untuk logout: ambil cookie session dan hapus sesi dari DB lalu clear cookie.
// Mengembalikan sukses jika sesi berhasil dihapus atau pesan error jika gagal.
export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get("session")?.value;
    if (cookie) await HapusSession(cookie);
    const res = NextResponse.json({ sukses: true });
    res.headers.set("Set-Cookie", "session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax;");
    return res;
  } catch (err) {
    console.error("[/api/auth/logout]", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal logout" }, { status: 500 });
  }
}