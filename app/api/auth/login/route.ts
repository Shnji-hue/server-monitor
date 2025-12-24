import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { TemukanUserByEmail, VerifyPassword, BuatSession } from "../../../../lib/auth";

function BuildCookieHeader(token: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === "production";
  const sameSite = "Lax";
  return `session=${token}; Path=/; HttpOnly; Max-Age=${maxAgeSeconds}; SameSite=${sameSite}; ${secure ? "Secure;" : ""}`;
}

export async function POST(req: NextRequest) {
  try {
    const { email = "", password = "" } = await req.json();
    const user = await TemukanUserByEmail(email.toLowerCase().trim());
    if (!user) return NextResponse.json({ sukses: false, pesan: "Email atau password salah" }, { status: 401 });

    if (!VerifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ sukses: false, pesan: "Email atau password salah" }, { status: 401 });
    }

    const sess = await BuatSession(user._id);
    const maxAge = Number(process.env.SESSION_MAX_AGE ?? 7 * 24 * 3600);
    const res = NextResponse.json({ sukses: true, data: { email: user.email } });
    res.headers.set("Set-Cookie", BuildCookieHeader(sess.token, maxAge));
    return res;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[/api/auth/login]", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal melakukan login" }, { status: 500 });
  }
}