import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { DapatkanKoleksi } from "../../../lib/mongodb";

// Endpoint POST /api/email
// Body: { email: string }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    // Validasi email sederhana
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ sukses: false, pesan: "Email tidak valid" }, { status: 400 });
    }

    const koleksi = await DapatkanKoleksi("emails");
    await koleksi.insertOne({ email, dibuatPada: new Date() });

    return NextResponse.json({ sukses: true, pesan: "Email disimpan" }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error di /api/email:", err);
    return NextResponse.json({ sukses: false, pesan: "Gagal menyimpan email" }, { status: 500 });
  }
}
