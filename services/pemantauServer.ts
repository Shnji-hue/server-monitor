import { DapatkanKoleksi } from "../lib/mongodb";
import { AmbilEmailUserDariSesiAktif } from "../lib/auth";
import { KirimEmail } from "../lib/email";

// Service pemantau server (simulasi) yang membuat bacaan berkala dan menyimpannya ke DB.
// Juga mengirim alert via email ke user aktif dengan pembatasan frekuensi sederhana.
export type BacaanServer = {
  waktu: number;
  cpu: number;
  mem: number;
  disk: number;
  suhu: number;
  alert?: boolean;
  pesanAlert?: string | null;
};

// Menyimpan riwayat bacaan di memori untuk respons cepat ke klien.
// Riwayat dibatasi agar tidak memakai terlalu banyak memori.
class PemantauServer {
  private riwayat: BacaanServer[] = [];
  private batasRiwayat = 300;
  private pembuatInterval: NodeJS.Timeout | null = null;
  private alertTerakhir: BacaanServer | null = null;
  private terakhirPembersihan = 0;

  // Menyimpan timestamp terakhir kirim email untuk rate-limiting sederhana.
  // Nilai minimal jeda bisa diatur lewat env `EMAIL_MIN_INTERVAL_MS`.
  private terakhirEmailAt = 0;
  private emailMinInterval = Number(process.env.EMAIL_MIN_INTERVAL_MS ?? 3 * 60 * 1000); // default 3 minutes

  // Saat kelas dibuat, persiapkan index DB dan mulai simulasi bacaan.
  // Ini memastikan koleksi siap sebelum mulai menyimpan data.
  constructor() {
    console.info("[PemantauServer] Inisialisasi PemantauServer, mempersiapkan koleksi dan memulai simulasi...");
    void this.setupKoleksiDanMulai();
  }

  // Buat index pada koleksi (TTL untuk history dan index waktu untuk alerts).
  // Setelah index dibuat, mulai loop simulasi.
  private async setupKoleksiDanMulai() {
    try {
      const koleksiRiwayat = await DapatkanKoleksi("history");
      // Buat TTL index agar dokumen lebih dari 1 hari otomatis dihapus (86400 detik)
      await koleksiRiwayat.createIndex({ waktu: 1 }, { expireAfterSeconds: 86400 });

      // Index waktu pada alerts juga berguna untuk query terbaru
      const koleksiAlerts = await DapatkanKoleksi("alerts");
      await koleksiAlerts.createIndex({ waktu: 1 });
    } catch (err) {
      console.error("[PemantauServer] Gagal membuat index koleksi:", err);
    }

    this.mulaiSimulasi();
  }

  // Mulai simulasi: buat bacaan awal lalu jalankan loop setiap 2 detik.
  // Jika simulasi sudah berjalan, jangan mulai ulang.
  public mulaiSimulasi() {
    if (this.pembuatInterval) return;
    void this.buatBacaan().catch((err) => {
      console.error("[PemantauServer] Gagal membuat bacaan awal:", err);
    });

    this.pembuatInterval = setInterval(() => {
      void this.buatBacaan();
    }, 2000);
  }

  // Hentikan simulasi dan bersihkan interval (digunakan saat shutdown atau testing).
  // Ini mencegah proses tetap berjalan setelah dihentikan.
  public hentikanSimulasi() {
    if (this.pembuatInterval) {
      clearInterval(this.pembuatInterval);
      this.pembuatInterval = null;
    }
  }

  // Buat satu bacaan secara sinkron dan kembalikan status terbaru.
  // Berguna untuk endpoint yang butuh data on-demand.
  public async buatBacaanSekali(): Promise<BacaanServer> {
    await this.buatBacaan();
    const terbaru = this.ambilStatusTerbaru();
    if (!terbaru) throw new Error("Gagal membuat bacaan");
    return terbaru;
  }

  // Inti: buat bacaan acak, tentukan apakah ini alert, simpan ke DB, dan kirim notifikasi jika perlu.
  // Alert dicatat di koleksi 'alerts' dan email dikirim ke user aktif dengan pembatasan frekuensi.
  private async buatBacaan() {
    const bacaan: BacaanServer = {
      waktu: Date.now(),
      cpu: this.acakDalamRentang(5, 100),
      mem: this.acakDalamRentang(10, 95),
      disk: this.acakDalamRentang(5, 95),
      suhu: this.acakDalamRentang(18, 95),
      alert: false,
      pesanAlert: null,
    };

    // Logika alert sederhana: CPU > 90% atau suhu > 80°C
    if (bacaan.cpu > 90) {
      bacaan.alert = true;
      bacaan.pesanAlert = `CPU tinggi: ${bacaan.cpu.toFixed(1)}%`;
    }
    if (bacaan.suhu > 80) {
      bacaan.alert = true;
      const pesan = `Suhu tinggi: ${bacaan.suhu.toFixed(1)}°C`;
      bacaan.pesanAlert = bacaan.pesanAlert ? `${bacaan.pesanAlert}; ${pesan}` : pesan;
    }

    // Debug: ringkasan singkat bacaan
    console.debug("[PemantauServer] Bacaan baru:", {
      waktu: bacaan.waktu,
      cpu: +bacaan.cpu.toFixed(1),
      suhu: +bacaan.suhu.toFixed(1),
      alert: bacaan.alert,
    });

    // Simpan ke riwayat lokal (in-memory)
    this.riwayat.push(bacaan);
    if (this.riwayat.length > this.batasRiwayat) this.riwayat.shift();

    // Persist ke MongoDB collection 'history' (dokumen menyimpan waktu sebagai Date)
    try {
      const koleksiRiwayat = await DapatkanKoleksi("history");
      await koleksiRiwayat.insertOne({
        waktu: new Date(bacaan.waktu),
        cpu: bacaan.cpu,
        mem: bacaan.mem,
        disk: bacaan.disk,
        suhu: bacaan.suhu,
        alert: bacaan.alert ?? false,
        pesan: bacaan.pesanAlert ?? null,
      });
    } catch (err) {
      console.error("[PemantauServer] Gagal menyimpan riwayat ke DB:", err);
    }

    // Jika ada alert, simpan juga ke koleksi 'alerts' dan kirim notifikasi (rate-limited)
    if (bacaan.alert) {
      const isNewAlert = !this.alertTerakhir || this.alertTerakhir.waktu !== bacaan.waktu;
      // Simpan ke DB
      try {
        const koleksi = await DapatkanKoleksi("alerts");
        await koleksi.insertOne({
          waktu: new Date(bacaan.waktu),
          cpu: bacaan.cpu,
          suhu: bacaan.suhu,
          pesan: bacaan.pesanAlert,
        });
      } catch (err) {
        console.error("[PemantauServer] Gagal menyimpan alert ke DB:", err);
      }

      // Hanya kirim email sekali per alert baru, dan batasi frekuensi (rate limit)
      if (isNewAlert) {
        this.alertTerakhir = bacaan;
        try {
          const now = Date.now();
          const sinceLast = now - this.terakhirEmailAt;
          if (sinceLast < this.emailMinInterval) {
            console.info(
              `[PemantauServer] Lewati pengiriman email (terakhir ${sinceLast}ms lalu < ${this.emailMinInterval}ms)`
            );
          } else {
            // Ambil email user dari sesi aktif (hanya kirim ke penerima pertama sebagai quick-fix)
            const emails = (await AmbilEmailUserDariSesiAktif()).slice(0, 1);
            if (emails.length) {
              // perbarui timestamp hanya jika kita benar-benar akan mengirim
              this.terakhirEmailAt = now;
              // Kirim email tanpa menahan loop (fire & forget)
              void Promise.all(
                emails.map((to) =>
                  KirimEmail(
                    to,
                    `ALERT: ${bacaan.pesanAlert}`,
                    `Terdeteksi alert pada server:\n${bacaan.pesanAlert}\nWaktu: ${new Date(bacaan.waktu).toLocaleString()}`
                  )
                )
              );
            }
          }
        } catch (err) {
          console.error("[PemantauServer] Gagal mengirim notifikasi email:", err);
        }
      }
    }

    // Pembersihan manual sebagai fallback: setiap jam, hapus dokumen > 1 hari
    try {
      const sekarang = Date.now();
      if (sekarang - this.terakhirPembersihan > 1000 * 60 * 60) {
        const koleksiRiwayat = await DapatkanKoleksi("history");
        const cutoff = new Date(sekarang - 24 * 60 * 60 * 1000);
        await koleksiRiwayat.deleteMany({ waktu: { $lt: cutoff } });
        this.terakhirPembersihan = sekarang;
        console.info("[PemantauServer] Pembersihan riwayat: dokumen lebih dari 1 hari dihapus (fallback)");
      }
    } catch (err) {
      console.error("[PemantauServer] Gagal menjalankan pembersihan fallback:", err);
    }
  }

  private acakDalamRentang(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Ambil status terbaru (objek tunggal)
  public ambilStatusTerbaru(): BacaanServer | null {
    return this.riwayat.length ? this.riwayat[this.riwayat.length - 1] : null;
  }

  // Ambil riwayat (terbaru dulu). limit opsional
  public ambilRiwayat(limit = 120): BacaanServer[] {
    if (limit <= 0) return [];
    const mulai = Math.max(0, this.riwayat.length - limit);
    return this.riwayat.slice(mulai);
  }

  // Ambil alert terakhir jika ada
  public ambilAlertTerakhir(): BacaanServer | null {
    return this.alertTerakhir;
  }
}

// Ekspor singleton sehingga simulasi berjalan sekali di server
export const PemantauServerSingleton = new PemantauServer();
export default PemantauServer;
