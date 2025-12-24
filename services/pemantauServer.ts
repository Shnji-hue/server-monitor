import { DapatkanKoleksi } from "../lib/mongodb";
import { AmbilEmailUserDariSesiAktif } from "../lib/auth";
import { KirimEmail } from "../lib/email";

// Tipe data bacaan server (disesuaikan agar mudah dikonsumsi Chart.js/Recharts)
export type BacaanServer = {
  waktu: number; // timestamp (ms)
  cpu: number; // persentase 0-100
  mem: number; // persentase 0-100
  disk: number; // persentase 0-100
  suhu: number; // derajat Celcius
  alert?: boolean;
  pesanAlert?: string | null;
};

class PemantauServer {
  private riwayat: BacaanServer[] = [];
  private batasRiwayat = 300; // jumlah titik maksimum di memori (mis. 300 * 2s = 10 menit)
  private pembuatInterval: NodeJS.Timeout | null = null;
  private alertTerakhir: BacaanServer | null = null;
  private terakhirPembersihan = 0; // timestamp ms terakhir pembersihan manual

  // Email rate limiting: track last email sent time (ms) and minimum interval
  private terakhirEmailAt = 0; // timestamp ms terakhir email terkirim
  // Default minimum interval: 3 minutes (180000 ms). Can be overridden via env EMAIL_MIN_INTERVAL_MS
  private emailMinInterval = Number(process.env.EMAIL_MIN_INTERVAL_MS ?? 3 * 60 * 1000); // default 3 minutes

  constructor() {
    // Debug: konfirmasi inisialisasi
    // eslint-disable-next-line no-console
    console.info("[PemantauServer] Inisialisasi PemantauServer, mempersiapkan koleksi dan memulai simulasi...");
    // Pastikan koleksi/index siap, lalu mulai simulasi
    void this.setupKoleksiDanMulai();
  }

  private async setupKoleksiDanMulai() {
    try {
      const koleksiRiwayat = await DapatkanKoleksi("history");
      // Buat TTL index agar dokumen lebih dari 1 hari otomatis dihapus (86400 detik)
      await koleksiRiwayat.createIndex({ waktu: 1 }, { expireAfterSeconds: 86400 });

      // Index waktu pada alerts juga berguna
      const koleksiAlerts = await DapatkanKoleksi("alerts");
      await koleksiAlerts.createIndex({ waktu: 1 });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PemantauServer] Gagal membuat index koleksi:", err);
    }

    this.mulaiSimulasi();
  }

  // Mulai simulasi (setInterval tiap 2 detik)
  public mulaiSimulasi() {
    if (this.pembuatInterval) return;

    // Buat bacaan awal segera agar klien tidak mendapatkan data kosong
    void this.buatBacaan().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[PemantauServer] Gagal membuat bacaan awal:", err);
    });

    this.pembuatInterval = setInterval(() => {
      void this.buatBacaan();
    }, 2000);
  }

  // Hentikan (untuk keperluan test atau cleanup)
  public hentikanSimulasi() {
    if (this.pembuatInterval) {
      clearInterval(this.pembuatInterval);
      this.pembuatInterval = null;
    }
  }

  // expose untuk testing: buat satu bacaan secara manual
  public async buatBacaanSekali(): Promise<BacaanServer> {
    await this.buatBacaan();
    const terbaru = this.ambilStatusTerbaru();
    if (!terbaru) throw new Error("Gagal membuat bacaan");
    return terbaru;
  }

  // Menghasilkan bacaan acak dan memeriksa alert threshold
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

    // Logika alert: CPU > 90% atau suhu > 80°C
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
    // eslint-disable-next-line no-console
    console.debug("[PemantauServer] Bacaan baru:", {
      waktu: bacaan.waktu,
      cpu: +bacaan.cpu.toFixed(1),
      suhu: +bacaan.suhu.toFixed(1),
      alert: bacaan.alert,
    });

    // Simpan ke riwayat lokal
    this.riwayat.push(bacaan);
    if (this.riwayat.length > this.batasRiwayat) this.riwayat.shift();

    // Persist ke MongoDB collection 'history'
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
      // eslint-disable-next-line no-console
      console.error("[PemantauServer] Gagal menyimpan riwayat ke DB:", err);
    }

    // Jika ada alert, simpan juga ke koleksi 'alerts' dan simpan alertTerakhir
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
        // eslint-disable-next-line no-console
        console.error("[PemantauServer] Gagal menyimpan alert ke DB:", err);
      }

      // Hanya kirim email sekali per alert baru, dan batasi frekuensi (rate limit)
      if (isNewAlert) {
        this.alertTerakhir = bacaan;
        try {
          const now = Date.now();
          const sinceLast = now - this.terakhirEmailAt;
          if (sinceLast < this.emailMinInterval) {
            // eslint-disable-next-line no-console
            console.info(
              `[PemantauServer] Lewati pengiriman email (terakhir ${sinceLast}ms lalu < ${this.emailMinInterval}ms)`
            );
          } else {
            const emails = (await AmbilEmailUserDariSesiAktif()).slice(0, 1); // quick fix: send only to the first active session
            if (emails.length) {
              // perbarui timestamp hanya jika kita benar-benar akan mengirim
              this.terakhirEmailAt = now;
              // kirim email tanpa menahan loop (fire & forget) - only to the first recipient
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
          // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
        console.info("[PemantauServer] Pembersihan riwayat: dokumen lebih dari 1 hari dihapus (fallback)");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
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
