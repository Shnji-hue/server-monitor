import crypto from "crypto";
import { dapatkanKoleksi } from "./mongodb";

type User = {
  _id?: any;
  email: string;
  passwordHash: string; // salt:hash
  createdAt?: Date;
};

export async function buatUser(email: string, password: string) {
  const koleksi = await dapatkanKoleksi<User>("users");
  const exist = await koleksi.findOne({ email });
  if (exist) throw new Error("Email sudah terdaftar");

  const passwordHash = hashPassword(password);
  const res = await koleksi.insertOne({ email, passwordHash, createdAt: new Date() });
  return { id: res.insertedId, email };
}

export async function temukanUserByEmail(email: string) {
  const koleksi = await dapatkanKoleksi<User>("users");
  return koleksi.findOne({ email });
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
}

// Sessions
export async function buatSession(userId: any) {
  const koleksi = await dapatkanKoleksi("sessions");
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

export async function temukanSession(token: string) {
  const koleksi = await dapatkanKoleksi("sessions");
  if (!token) return null;
  const sess = await koleksi.findOne({ token });
  if (!sess) return null;
  if (new Date(sess.expiresAt).getTime() < Date.now()) {
    await koleksi.deleteOne({ _id: sess._id });
    return null;
  }
  return sess;
}

export async function hapusSession(token: string) {
  if (!token) return;
  const koleksi = await dapatkanKoleksi("sessions");
  await koleksi.deleteOne({ token });
}

export async function ambilEmailUserDariSesiAktif() {
  // Kembalikan daftar email unik dari sesi aktif (ungrouped)
  const koleksi = await dapatkanKoleksi("sessions");
  const usersCol = await dapatkanKoleksi<User>("users");
  const sekarang = new Date();
  const sesi = await koleksi.find({ expiresAt: { $gt: sekarang } }).toArray();
  const userIds = Array.from(new Set(sesi.map((s: any) => s.userId)));
  if (!userIds.length) return [];
  const users = await usersCol.find({ _id: { $in: userIds } }).toArray();
  return users.map((u) => u.email);
}

export async function ambilUserDariToken(token: string) {
  // Ambil user singkat (email, id) berdasarkan token sesi (server-side helper)
  try {
    const sess = await temukanSession(token);
    if (!sess) return null;
    const usersCol = await dapatkanKoleksi<User>("users");
    const user = await usersCol.findOne({ _id: sess.userId });
    if (!user) return null;
    return { id: user._id, email: user.email };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth] ambilUserDariToken error:", err);
    return null;
  }
}
