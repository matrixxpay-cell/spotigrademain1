require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const path       = require("path");
const fs         = require("fs");
const multer     = require("multer");
const nodemailer = require("nodemailer");
const { Key, UpgradeRequest, RenewRequest, MakerKey, Payout, AppSettings } = require("./models");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const DIST    = path.join(__dirname, "../dist");
const UPLOADS = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

// Serve uploaded files
app.use("/uploads", express.static(UPLOADS));

// Multer config — store with original extension, max 50MB
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// Upload endpoint
app.post("/api/upload", upload.array("files", 10), (req, res) => {
  const urls = req.files.map(f => `/uploads/${f.filename}`);
  res.json({ urls });
});
app.use(express.static(DIST));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected — SpotigraderSagar"))
  .catch(err => { console.error("MongoDB error:", err.message); process.exit(1); });

// ── Helpers ───────────────────────────────────────────────────────────────────
function genKey() {
  const s = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${s()}-${s()}-${s()}-${s()}`;
}

async function getSettings() {
  let s = await AppSettings.findOne();
  if (!s) s = await AppSettings.create({});
  return s;
}

async function sendEmail({ to, subject, html }) {
  try {
    const s = await getSettings();
    if (!s.smtpHost || !s.smtpUser) return;
    const transporter = nodemailer.createTransport({
      host: s.smtpHost, port: s.smtpPort, secure: s.smtpPort === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    });
    await transporter.sendMail({ from: s.smtpFrom || s.smtpUser, to, subject, html });
  } catch (e) { console.error("Email error:", e.message); }
}

// ── Auth: check key type ──────────────────────────────────────────────────────
app.get("/api/auth/check-key/:keyStr", async (req, res) => {
  try {
    const k = req.params.keyStr.trim();
    // Admin key from env
    if (process.env.ADMIN_KEY && k === process.env.ADMIN_KEY) {
      return res.json({ type: "admin" });
    }
    // Maker key
    const maker = await MakerKey.findOne({ key: k, status: "active" });
    if (maker) return res.json({ type: "maker", maker });
    // License key
    const licKey = await Key.findOne({ key: k });
    if (licKey) return res.json({ type: "license", key: licKey });
    return res.json({ type: "unknown" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  KEYS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/keys", async (req, res) => {
  try { res.json(await Key.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/keys/by-key/:keyStr", async (req, res) => {
  try {
    const k = await Key.findOne({ key: req.params.keyStr });
    if (!k) return res.status(404).json({ error: "Key not found" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/keys/by-username/:username", async (req, res) => {
  try {
    const k = await Key.findOne({ usedByUsername: req.params.username });
    if (!k) return res.status(404).json({ error: "No key found for this username" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/keys/generate", async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 500);
    const docs  = Array.from({ length: count }, () => ({ key: genKey() }));
    res.json(await Key.insertMany(docs));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/keys/:id", async (req, res) => {
  try {
    const k = await Key.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!k) return res.status(404).json({ error: "Key not found" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/keys", async (req, res) => {
  try {
    const { ids } = req.body;
    await Key.deleteMany({ _id: { $in: ids } });
    res.json({ deleted: ids.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  UPGRADE REQUESTS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/upgrade-requests", async (req, res) => {
  try { res.json(await UpgradeRequest.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/upgrade-requests", async (req, res) => {
  try { res.json(await UpgradeRequest.create(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/upgrade-requests/:id", async (req, res) => {
  try {
    const prev = await UpgradeRequest.findById(req.params.id);
    const r = await UpgradeRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "Request not found" });

    // Send email on status change
    const newStatus = req.body.status;
    if (newStatus && newStatus !== prev?.status && r.email) {
      if (newStatus === "approved") {
        await sendEmail({
          to: r.email,
          subject: "✅ Your Spotify Upgrade is Complete!",
          html: `<h2>Upgrade Successful!</h2><p>Your Spotify account <b>${r.email}</b> has been upgraded to Premium.</p><p>Key: <code>${r.key}</code></p><p>Thank you for using upgrader.cc!</p>`,
        });
      } else if (newStatus === "declined") {
        await sendEmail({
          to: r.email,
          subject: "❌ Your Spotify Upgrade Request was Declined",
          html: `<h2>Upgrade Request Declined</h2><p>Your upgrade request for <b>${r.email}</b> was declined.</p>${r.declineReason ? `<p><b>Reason:</b> ${r.declineReason}</p>` : ""}<p>Contact support if you need help.</p>`,
        });
      }
    }

    // Credit maker earnings on approval
    if (newStatus === "approved" && req.body.processedBy && prev?.status !== "approved") {
      const settings = await getSettings();
      await MakerKey.findByIdAndUpdate(req.body.processedBy, { $inc: { earnings: settings.makerRate } });
    }

    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  RENEW REQUESTS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/renew-requests", async (req, res) => {
  try { res.json(await RenewRequest.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/renew-requests", async (req, res) => {
  try { res.json(await RenewRequest.create(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/renew-requests/:id", async (req, res) => {
  try {
    const prev = await RenewRequest.findById(req.params.id);
    const r = await RenewRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "Request not found" });

    const newStatus = req.body.status;
    const emailTo = r.newEmail || r.oldEmail;
    if (newStatus && newStatus !== prev?.status && emailTo) {
      if (newStatus === "approved") {
        await sendEmail({
          to: emailTo,
          subject: "✅ Your Spotify Renewal is Complete!",
          html: `<h2>Renewal Successful!</h2><p>Your Spotify account has been renewed to Premium.</p><p>Key: <code>${r.key}</code></p><p>Thank you for using upgrader.cc!</p>`,
        });
      } else if (newStatus === "declined") {
        await sendEmail({
          to: emailTo,
          subject: "❌ Your Spotify Renewal Request was Declined",
          html: `<h2>Renewal Request Declined</h2><p>Your renewal request was declined.</p>${r.declineReason ? `<p><b>Reason:</b> ${r.declineReason}</p>` : ""}<p>Contact support if you need help.</p>`,
        });
      }
    }

    if (newStatus === "approved" && req.body.processedBy && prev?.status !== "approved") {
      const settings = await getSettings();
      await MakerKey.findByIdAndUpdate(req.body.processedBy, { $inc: { earnings: settings.makerRate } });
    }

    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  MAKERS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/makers", async (req, res) => {
  try { res.json(await MakerKey.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/makers", async (req, res) => {
  try {
    const { name } = req.body;
    const key = genKey();
    res.json(await MakerKey.create({ key, name: name || "Maker" }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/makers/:id", async (req, res) => {
  try {
    const m = await MakerKey.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!m) return res.status(404).json({ error: "Maker not found" });
    res.json(m);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/makers/:id", async (req, res) => {
  try {
    await MakerKey.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  PAYOUTS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/payouts", async (req, res) => {
  try { res.json(await Payout.find().sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/payouts/maker/:makerId", async (req, res) => {
  try { res.json(await Payout.find({ makerId: req.params.makerId }).sort({ createdAt: -1 })); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/payouts", async (req, res) => {
  try { res.json(await Payout.create(req.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/payouts/:id", async (req, res) => {
  try {
    const p = await Payout.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!p) return res.status(404).json({ error: "Payout not found" });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/settings", async (req, res) => {
  try { res.json(await getSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/settings", async (req, res) => {
  try {
    let s = await AppSettings.findOne();
    if (!s) s = await AppSettings.create(req.body);
    else { Object.assign(s, req.body); await s.save(); }
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/settings/test-smtp", async (req, res) => {
  try {
    const s = await getSettings();
    if (!s.smtpHost || !s.smtpUser) return res.status(400).json({ error: "SMTP not configured." });
    const transporter = require("nodemailer").createTransport({
      host: s.smtpHost, port: s.smtpPort, secure: s.smtpPort === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
    });
    await transporter.verify();
    await transporter.sendMail({
      from: s.smtpFrom || s.smtpUser,
      to: s.smtpUser,
      subject: "Spotigrader SMTP Test",
      html: "<p>✅ Your SMTP configuration is working correctly.</p>",
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Public support status (for bot) ──────────────────────────────────────────
app.get("/api/support-status", async (req, res) => {
  try {
    const s = await getSettings();
    const hour = new Date().getUTCHours();
    const inHours = hour >= s.supportStartHour && hour < s.supportEndHour;
    res.json({
      enabled: s.supportEnabled !== false,
      startHour: s.supportStartHour ?? 0,
      endHour: s.supportEndHour ?? 24,
      inHours,
    });
  } catch { res.json({ enabled: true, inHours: true, startHour: 0, endHour: 24 }); }
});

// ── Health / Status ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/status", async (req, res) => {
  const start = Date.now();
  const dbState = mongoose.connection.readyState;
  const dbStateMap = { 0:"down", 1:"operational", 2:"degraded", 3:"degraded" };
  let dbPing = null, dbLatency = null;
  if (dbState === 1) {
    try {
      const t0 = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - t0;
      dbPing = "operational";
    } catch { dbPing = "down"; }
  }
  let stats = null;
  try {
    const [keys, upgrades, renewals] = await Promise.all([
      Key.countDocuments(), UpgradeRequest.countDocuments(), RenewRequest.countDocuments(),
    ]);
    stats = { keys, upgrades, renewals };
  } catch { /* non-fatal */ }

  res.json({
    api:      { status: "operational", latency: Date.now() - start },
    database: { status: dbPing || dbStateMap[dbState] || "down", latency: dbLatency },
    service:  { status: "operational" },
    stats,
    timestamp: new Date().toISOString(),
  });
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
