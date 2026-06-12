require("dotenv").config();
const express  = require("express");
const mongoose = require("mongoose");
const cors     = require("cors");
const path     = require("path");
const { Key, UpgradeRequest, RenewRequest } = require("./models");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ── Serve React frontend ─────────────────────────────────────────────────────
const DIST = path.join(__dirname, "../dist");
app.use(express.static(DIST));

// ── DB connect ───────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected — SpotigraderSagar"))
  .catch(err => { console.error("MongoDB error:", err.message); process.exit(1); });

// ── Key format helper ────────────────────────────────────────────────────────
function genKey() {
  const s = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${s()}-${s()}-${s()}-${s()}`;
}

// ════════════════════════════════════════════════════════════════════════════
//  KEYS
// ════════════════════════════════════════════════════════════════════════════
// GET all keys
app.get("/api/keys", async (req, res) => {
  try {
    const keys = await Key.find().sort({ createdAt: -1 });
    res.json(keys);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single key by key string
app.get("/api/keys/by-key/:keyStr", async (req, res) => {
  try {
    const k = await Key.findOne({ key: req.params.keyStr });
    if (!k) return res.status(404).json({ error: "Key not found" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET key by username
app.get("/api/keys/by-username/:username", async (req, res) => {
  try {
    const k = await Key.findOne({ usedByUsername: req.params.username });
    if (!k) return res.status(404).json({ error: "No key found for this username" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST generate keys
app.post("/api/keys/generate", async (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.body.count) || 1, 1), 500);
    const docs  = Array.from({ length: count }, () => ({ key: genKey() }));
    const keys  = await Key.insertMany(docs);
    res.json(keys);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH update key by id
app.patch("/api/keys/:id", async (req, res) => {
  try {
    const k = await Key.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!k) return res.status(404).json({ error: "Key not found" });
    res.json(k);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE keys by ids
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
  try {
    const reqs = await UpgradeRequest.find().sort({ createdAt: -1 });
    res.json(reqs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/upgrade-requests", async (req, res) => {
  try {
    const r = await UpgradeRequest.create(req.body);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/upgrade-requests/:id", async (req, res) => {
  try {
    const r = await UpgradeRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "Request not found" });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
//  RENEW REQUESTS
// ════════════════════════════════════════════════════════════════════════════
app.get("/api/renew-requests", async (req, res) => {
  try {
    const reqs = await RenewRequest.find().sort({ createdAt: -1 });
    res.json(reqs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/renew-requests", async (req, res) => {
  try {
    const r = await RenewRequest.create(req.body);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch("/api/renew-requests/:id", async (req, res) => {
  try {
    const r = await RenewRequest.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!r) return res.status(404).json({ error: "Request not found" });
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Health / Status ───────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ── Catch-all: serve React for any non-API route ─────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.get("/api/status", async (req, res) => {
  const start = Date.now();

  // DB status
  const dbState = mongoose.connection.readyState;
  // 0=disconnected 1=connected 2=connecting 3=disconnecting
  const dbStateMap = { 0:"down", 1:"operational", 2:"degraded", 3:"degraded" };
  let dbPing = null;
  let dbLatency = null;
  if (dbState === 1) {
    try {
      const t0 = Date.now();
      await mongoose.connection.db.admin().ping();
      dbLatency = Date.now() - t0;
      dbPing = "operational";
    } catch { dbPing = "down"; }
  }

  // Key/request counts
  let stats = null;
  try {
    const [keys, upgrades, renewals] = await Promise.all([
      Key.countDocuments(),
      UpgradeRequest.countDocuments(),
      RenewRequest.countDocuments(),
    ]);
    stats = { keys, upgrades, renewals };
  } catch { /* non-fatal */ }

  const apiLatency = Date.now() - start;

  res.json({
    api:      { status: "operational", latency: apiLatency },
    database: { status: dbPing || dbStateMap[dbState] || "down", latency: dbLatency },
    service:  { status: "operational" },
    stats,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
