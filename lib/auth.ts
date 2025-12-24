import crypto from "crypto";
import { DapatkanKoleksi } from "./mongodb";

type User = {
  _id?: any;
  email: string;
  passwordHash: string; // salt:hash
  createdAt?: Date;
};

export async function BuatUser(email: string, password: string) {
  const koleksi = await DapatkanKoleksi<User>("users");
  const exist = await koleksi.findOne({ email });
  if (exist) throw new Error("Email sudah terdaftar");

  const passwordHash = HashPassword(password);
  const res = await koleksi.insertOne({ email, passwordHash, createdAt: new Date() });
  return { id: res.insertedId, email };
}

export async function TemukanUserByEmail(email: string) {
  const koleksi = await DapatkanKoleksi<User>("users");
  return koleksi.findOne({ email });
}

export function HashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export function VerifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

// Sessions
export async function BuatSession(userId: any) {
  const koleksi = await DapatkanKoleksi("sessions");
  const token = crypto.randomBytes(32).toString("hex");
  const maxAge = Number(process.env.SESSION_MAX_AGE ?? 7 * 24 * 3600); // detik
  const now = Date.now();
  const doc = {
    token,
    userId,
    createdAt: new Date(now),
    expiresAt: new Date(now + maxAge * 1000),
  };
  await koleksi.insertOne(doc);
  return { token, expiresAt: doc.expiresAt };
}

export async function TemukanSession(token: string) {
  const koleksi = await DapatkanKoleksi("sessions");
  if (!token) return null;
  const sess = await koleksi.findOne({ token });
  if (!sess) return null;
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    await koleksi.deleteOne({ _id: sess._id });
    return null;
  }
  return sess;
}

export async function HapusSession(token: string) {
  if (!token) return;
  const koleksi = await DapatkanKoleksi("sessions");
  await koleksi.deleteOne({ token });
}

export async function AmbilEmailUserDariSesiAktif() {
  // Kembalikan daftar email unik dari sesi aktif (ungrouped)
  const koleksi = await DapatkanKoleksi("sessions");
  const usersCol = await DapatkanKoleksi<User>("users");
  const sekarang = new Date();
  const sesi = await koleksi.find({ expiresAt: { $gt: sekarang } }).toArray();
  const userIds = Array.from(new Set(sesi.map((s: any) => s.userId)));
  if (!userIds.length) return [];
  const users = await usersCol.find({ _id: { $in: userIds } }).toArray();
  return users.map((u) => u.email);
}

export async function AmbilUserDariToken(token: string) {
  // Ambil user singkat (email, id) berdasarkan token sesi (server-side helper)
  try {
    const sess = await TemukanSession(token);
    if (!sess) return null;
    const usersCol = await DapatkanKoleksi<User>("users");
    const user = await usersCol.findOne({ _id: sess.userId });
    if (!user) return null;
    return { id: user._id, email: user.email };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth] ambilUserDariToken error:", err);
    return null;
  }
}
