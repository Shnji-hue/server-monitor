// Route pendaftaran: menerima email dan password lalu membuat user baru bila data valid.
// Jika berhasil, server menyimpan user ke koleksi 'users' dan mengembalikan id serta email.
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { BuatUser, TemukanUserByEmail } from "../../../../lib/auth";

// Handler POST untuk register: validasi input, cek email unik, lalu buat user baru.
// Mengembalikan 201 saat berhasil atau kode error bila input salah atau email sudah terdaftar.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";
    if (!email || !password) return NextResponse.json({ sukses: false, pesan: "Email dan password diperlukan" }, { status: 400 });

    const exist = await TemukanUserByEmail(email);
    if (exist) return NextResponse.json({ sukses: false, pesan: "Email sudah terdaftar" }, { status: 409 });

    const user = await BuatUser(email, password);
    return NextResponse.json({ sukses: true, data: { id: user.id, email: user.email } }, { status: 201 });
  } catch (err: any) {
    console.error("[/api/auth/register]", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal mendaftar" }, { status: 500 });
  }
}