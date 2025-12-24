import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { HapusSession } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
  try {
    const cookie = req.cookies.get("session")?.value;
    if (cookie) await HapusSession(cookie);
    const res = NextResponse.json({ sukses: true });
    // Clear cookie
    res.headers.set("Set-Cookie", "session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax;");
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/auth/logout]", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal logout" }, { status: 500 });
  }
}