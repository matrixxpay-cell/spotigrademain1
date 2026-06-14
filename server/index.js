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

function censorKey(key) {
  if (!key) return "—";
  const parts = key.split("-");
  return parts.map((p, i) => i < 2 ? p : "*".repeat(p.length)).join("-");
}

function buildEmail({ headerBg, accentColor, icon, heading, body, rows, ctaHref, ctaLabel, ctaColor, ctaBg, key }) {
  const censored = censorKey(key);
  const rowsHtml = rows.filter(Boolean).map(([label, val]) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;color:#888;font-size:13px;width:130px;vertical-align:top">${label}</td>
      <td style="padding:10px 0;border-bottom:1px solid #2a2a2a;color:#f0f0f0;font-size:13px;font-family:monospace;word-break:break-all">${val}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
        <tr><td style="padding-bottom:28px;text-align:center">
          <span style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.5px">🎵 Spotigrader</span>
        </td></tr>
        <tr><td style="background:#141414;border-radius:16px;overflow:hidden;border:1px solid #222">
          <div style="background:${headerBg};padding:32px 32px 28px;text-align:center">
            <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:50%;display:inline-block;font-size:26px;font-weight:900;color:#fff;margin-bottom:14px;line-height:56px;text-align:center">${icon}</div>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:800;line-height:1.3">${heading}</h1>
          </div>
          <div style="padding:28px 32px">
            ${body}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">${rowsHtml}</table>
            <div style="text-align:center;margin-bottom:8px">
              <a href="${ctaHref}" style="display:inline-block;padding:13px 32px;background:${ctaBg};color:${ctaColor};text-decoration:none;border-radius:50px;font-weight:700;font-size:14px;letter-spacing:0.04em">${ctaLabel}</a>
            </div>
          </div>
          <div style="padding:18px 32px;border-top:1px solid #222;text-align:center">
            <p style="margin:0;color:#555;font-size:12px;line-height:1.6">
              This email was sent by <strong style="color:#888">Spotigrader</strong> regarding license key <span style="font-family:monospace;color:#777">${censored}</span>.<br>
              If you did not submit this request, please <a href="https://t.me/spotigradersupportbot" style="color:${accentColor};text-decoration:none">contact support</a> immediately.
            </p>
          </div>
        </td></tr>
        <tr><td style="padding-top:20px;text-align:center">
          <p style="margin:0;color:#444;font-size:11px">© 2026 Spotigrader · <a href="https://spotigrader.cc" style="color:${accentColor};text-decoration:none">spotigrader.cc</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function upgradeApprovedEmail({ email, key, plan, upgradeType }) {
  const planLabel = plan ? plan.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
  const typeLabel = upgradeType === "family" ? "Family / Platinum" : upgradeType === "individual" ? "Individual" : null;
  return buildEmail({
    headerBg: "linear-gradient(135deg,#1DB954 0%,#158a3e 100%)",
    accentColor: "#1DB954", icon: "✓",
    heading: "Your Spotify Premium Upgrade is Live!",
    body: `<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 20px">
      Your Spotify account has been successfully upgraded to <strong style="color:#1DB954">Premium</strong>.
      Your account is now fully active and ready to use — enjoy your music! 🎶
    </p>`,
    rows: [
      ["Spotify Account", email],
      planLabel && ["Plan", planLabel],
      typeLabel && ["Type", typeLabel],
      ["License Key", censorKey(key)],
    ],
    ctaHref: "https://spotigrader.cc", ctaLabel: "Visit Spotigrader →", ctaBg: "#1DB954", ctaColor: "#000",
    key,
  });
}

function upgradeDeclinedEmail({ email, key, reason }) {
  return buildEmail({
    headerBg: "linear-gradient(135deg,#e53e3e 0%,#9b2c2c 100%)",
    accentColor: "#e53e3e", icon: "✕",
    heading: "Upgrade Request — Unable to Process",
    body: `<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px">
        We regret to inform you that your Spotify Premium upgrade request for <strong style="color:#f0f0f0">${email}</strong> could not be processed at this time.
      </p>
      ${reason ? `<div style="background:#1a0a0a;border-left:3px solid #e53e3e;padding:14px 16px;border-radius:6px;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#fc8181;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em">Reason for Decline</p>
        <p style="margin:0;color:#fed7d7;font-size:14px;line-height:1.6">${reason}</p>
      </div>` : ""}
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 20px">
        If you believe this is an error or require further assistance, our support team is available to help.
      </p>`,
    rows: [
      ["Spotify Account", email],
      ["License Key", censorKey(key)],
    ],
    ctaHref: "https://t.me/spotigradersupportbot", ctaLabel: "Contact Support →", ctaBg: "#e53e3e", ctaColor: "#fff",
    key,
  });
}

function renewTransferEmail({ oldEmail, newEmail, newUsername, key, plan, upgradeType }) {
  const planLabel = plan ? plan.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
  const typeLabel = upgradeType === "family" ? "Family / Platinum" : upgradeType === "individual" ? "Individual" : null;
  return buildEmail({
    headerBg: "linear-gradient(135deg,#7C3AED 0%,#4C1D95 100%)",
    accentColor: "#7C3AED", icon: "↗",
    heading: "Your Premium Has Been Transferred",
    body: `<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px">
        Your Spotify Premium subscription has been successfully <strong style="color:#A78BFA">transferred</strong> from this account to a new account as per your renewal request.
      </p>
      <div style="background:#1a1228;border-left:3px solid #7C3AED;padding:14px 16px;border-radius:6px;margin-bottom:20px">
        <p style="margin:0 0 4px;color:#A78BFA;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em">Transferred To</p>
        <p style="margin:0;color:#E9D5FF;font-size:15px;font-weight:700">${newEmail}${newUsername ? ` &nbsp;·&nbsp; @${newUsername}` : ""}</p>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.6;margin:0 0 20px">
        If you did not authorise this transfer, please contact our support team immediately. Do not share your account credentials with anyone.
      </p>`,
    rows: [
      ["Old Account", oldEmail],
      ["New Account", newEmail],
      newUsername && ["New Username", "@" + newUsername],
      planLabel && ["Plan", planLabel],
      typeLabel && ["Type", typeLabel],
      ["License Key", censorKey(key)],
    ],
    ctaHref: "https://t.me/spotigradersupportbot", ctaLabel: "Contact Support →", ctaBg: "#7C3AED", ctaColor: "#fff",
    key,
  });
}

function renewSuccessEmail({ newEmail, newUsername, key, plan, upgradeType }) {
  const planLabel = plan ? plan.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : null;
  const typeLabel = upgradeType === "family" ? "Family / Platinum" : upgradeType === "individual" ? "Individual" : null;
  return buildEmail({
    headerBg: "linear-gradient(135deg,#1DB954 0%,#158a3e 100%)",
    accentColor: "#1DB954", icon: "✓",
    heading: "Your Spotify Premium Renewal is Active!",
    body: `<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 20px">
        Congratulations! Your Spotify Premium renewal has been successfully processed. Your account is now active and ready to enjoy — welcome back! 🎶
      </p>`,
    rows: [
      ["Spotify Account", newEmail],
      newUsername && ["Spotify Username", "@" + newUsername],
      planLabel && ["Plan", planLabel],
      typeLabel && ["Type", typeLabel],
      ["License Key", censorKey(key)],
    ],
    ctaHref: "https://spotigrader.cc", ctaLabel: "Visit Spotigrader →", ctaBg: "#1DB954", ctaColor: "#000",
    key,
  });
}

function renewDeclinedEmail({ oldEmail, key, reason }) {
  return buildEmail({
    headerBg: "linear-gradient(135deg,#e53e3e 0%,#9b2c2c 100%)",
    accentColor: "#e53e3e", icon: "✕",
    heading: "Renewal Request — Unable to Process",
    body: `<p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 16px">
        We regret to inform you that your Spotify Premium renewal request could not be processed at this time.
      </p>
      ${reason ? `<div style="background:#1a0a0a;border-left:3px solid #e53e3e;padding:14px 16px;border-radius:6px;margin-bottom:20px">
        <p style="margin:0 0 6px;color:#fc8181;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em">Reason for Decline</p>
        <p style="margin:0;color:#fed7d7;font-size:14px;line-height:1.6">${reason}</p>
      </div>` : ""}
      <p style="color:#ccc;font-size:15px;line-height:1.7;margin:0 0 20px">
        If you believe this is an error or need further assistance, please do not hesitate to reach out to our support team.
      </p>`,
    rows: [
      ["Spotify Account", oldEmail],
      ["License Key", censorKey(key)],
    ],
    ctaHref: "https://t.me/spotigradersupportbot", ctaLabel: "Contact Support →", ctaBg: "#e53e3e", ctaColor: "#fff",
    key,
  });
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
          subject: "🎵 Your Spotify Premium Upgrade is Live!",
          html: upgradeApprovedEmail({ email: r.email, key: r.key, plan: r.plan, upgradeType: r.upgradeType }),
        });
      } else if (newStatus === "declined") {
        await sendEmail({
          to: r.email,
          subject: "Your Spotigrader Upgrade Request — Update",
          html: upgradeDeclinedEmail({ email: r.email, key: r.key, reason: req.body.declineReason || r.declineReason }),
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
    const newUsername = req.body.newUsername || r.newUsername;
    if (newStatus && newStatus !== prev?.status) {
      if (newStatus === "approved") {
        // Notify old email: premium transferred away
        if (r.oldEmail && r.newEmail && r.oldEmail !== r.newEmail) {
          await sendEmail({
            to: r.oldEmail,
            subject: "Your Spotify Premium Has Been Transferred — Spotigrader",
            html: renewTransferEmail({ oldEmail: r.oldEmail, newEmail: r.newEmail, newUsername, key: r.key, plan: r.plan, upgradeType: r.upgradeType }),
          });
        }
        // Notify new email (or old if same): renewal success
        const successTo = r.newEmail || r.oldEmail;
        if (successTo) {
          await sendEmail({
            to: successTo,
            subject: "🎵 Your Spotify Premium Renewal is Active!",
            html: renewSuccessEmail({ newEmail: successTo, newUsername, key: r.key, plan: r.plan, upgradeType: r.upgradeType }),
          });
        }
      } else if (newStatus === "declined") {
        // Only notify old email on decline
        if (r.oldEmail) {
          await sendEmail({
            to: r.oldEmail,
            subject: "Your Spotigrader Renewal Request — Update",
            html: renewDeclinedEmail({ oldEmail: r.oldEmail, key: r.key, reason: req.body.declineReason || r.declineReason }),
          });
        }
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
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Connection timed out after 10s")), 10000)
  );
  try {
    const s = await getSettings();
    if (!s.smtpHost || !s.smtpUser) return res.status(400).json({ error: "SMTP not configured." });
    const transporter = require("nodemailer").createTransport({
      host: s.smtpHost, port: s.smtpPort, secure: s.smtpPort === 465,
      auth: { user: s.smtpUser, pass: s.smtpPass },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 8000,
    });
    await Promise.race([transporter.verify(), timeout]);
    await Promise.race([transporter.sendMail({
      from: s.smtpFrom || s.smtpUser,
      to: s.smtpUser,
      subject: "Spotigrader SMTP Test",
      html: "<p>✅ Your SMTP configuration is working correctly.</p>",
    }), timeout]);
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
