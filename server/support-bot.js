require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs    = require("fs");
const path  = require("path");
const https = require("https");
const http  = require("http");

const API_BASE = process.env.API_BASE || "http://localhost:3001";

function getSupportStatus() {
  return new Promise((resolve) => {
    const mod = API_BASE.startsWith("https") ? https : http;
    mod.get(`${API_BASE}/api/support-status`, res => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch { resolve({ enabled: true, inHours: true }); } });
    }).on("error", () => resolve({ enabled: true, inHours: true }));
  });
}

const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const AGENT_ID = process.env.TELEGRAM_AGENT_ID;

if (!TOKEN || !AGENT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_AGENT_ID in .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const US_NAMES = [
  "James Wilson","Emily Johnson","Michael Brown","Sarah Davis","Chris Martinez",
  "Ashley Anderson","Matthew Taylor","Jessica Thomas","Daniel Harris","Ryan Clark",
];

const SESSIONS_FILE = path.join(__dirname, "bot-sessions.json");

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8")); } catch { return {}; }
}
function saveSessions(s) {
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(s, null, 2)); } catch {}
}

const sessions = loadSessions();

function randomName() {
  return US_NAMES[Math.floor(Math.random() * US_NAMES.length)];
}

function offHoursMessage(status) {
  const pad = n => String(n).padStart(2, "0");
  const endDisplay = status.endHour === 24 ? "00" : pad(status.endHour);
  return (
    `🕐 *Our support team is currently offline.*\n\n` +
    `Our live agents are available between *${pad(status.startHour)}:00 UTC* and *${endDisplay}:00 UTC*.\n\n` +
    `To help us assist you as quickly as possible once we're back online:\n\n` +
    `📝 Please *describe your issue* in brief below\n` +
    `📸 *Attach a screenshot or screen recording* that illustrates the problem\n\n` +
    `Your message has been noted and our team will respond as soon as support goes live. We appreciate your patience! 🙏`
  );
}

async function handleNewSession(chatId, firstName, status) {
  if (!status.enabled) {
    await bot.sendMessage(chatId, "⚠️ *Support is currently disabled.* Please try again later.", { parse_mode: "Markdown" });
    return false;
  }
  if (!status.inHours) {
    await bot.sendMessage(chatId, offHoursMessage(status), { parse_mode: "Markdown" });
    // Create offline session so future messages/media are still queued for agent
    sessions[chatId] = { agentName: null, firstName, history: [], offline: true };
    saveSessions(sessions);
    return false;
  }
  // Live session — random connecting delay 5–30s
  await bot.sendMessage(chatId, "⏳ Please wait, connecting you to a Live Agent...");
  const delay = Math.floor(Math.random() * 26000) + 5000;
  await new Promise(r => setTimeout(r, delay));
  const agentName = randomName();
  sessions[chatId] = { agentName, firstName, history: [], offline: false };
  saveSessions(sessions);
  await bot.sendMessage(chatId,
    `✅ You are now connected with *${agentName}*\n\n_Please wait — our agent will respond shortly._`,
    { parse_mode: "Markdown" }
  );
  return true;
}

bot.on("message", async (msg) => {
  const chatId    = String(msg.chat.id);
  const text      = msg.text || "";
  const firstName = msg.from.first_name || "User";

  // ── Agent commands ────────────────────────────────────────────────────────
  if (chatId === String(AGENT_ID)) {
    if (!text) return;
    if (text.startsWith("/reply ")) {
      const parts    = text.split(" ");
      const targetId = parts[1];
      const reply    = parts.slice(2).join(" ");
      if (!targetId || !reply) { bot.sendMessage(AGENT_ID, "Usage: /reply <chatId> <message>"); return; }
      try {
        await bot.sendMessage(targetId, `🎧 *Support:* ${reply}`, { parse_mode: "Markdown" });
        if (sessions[targetId]) {
          if (!sessions[targetId].history) sessions[targetId].history = [];
          sessions[targetId].history.push({ from: "agent", text: reply, time: new Date().toISOString() });
          saveSessions(sessions);
        }
        bot.sendMessage(AGENT_ID, `✓ Sent to ${sessions[targetId]?.firstName || targetId}`);
      } catch { bot.sendMessage(AGENT_ID, `⚠️ Could not deliver to ${targetId}`); }
      return;
    }
    if (text.startsWith("/close ")) {
      const targetId = text.split(" ")[1];
      delete sessions[targetId];
      saveSessions(sessions);
      bot.sendMessage(targetId,
        "✅ Your support session has been closed.\n\nThank you for contacting *SpotiGrader.cc*! Feel free to message us again anytime. 🎵",
        { parse_mode: "Markdown" }
      );
      bot.sendMessage(AGENT_ID, `Session with ${targetId} closed.`);
      return;
    }
    if (text === "/sessions") {
      const list = Object.entries(sessions);
      if (list.length === 0) { bot.sendMessage(AGENT_ID, "No active sessions."); return; }
      const out = list.map(([id, s]) => `• ${s.firstName} (ID: ${id}) — ${s.offline ? "⏸ offline" : s.agentName}`).join("\n");
      bot.sendMessage(AGENT_ID, `*Active sessions:*\n${out}`, { parse_mode: "Markdown" });
      return;
    }
    return;
  }

  // ── Client: /start ────────────────────────────────────────────────────────
  if (text === "/start") {
    bot.sendMessage(chatId,
      "👋 *Hi! Welcome to SpotiGrader.cc* 🎵\n\nPlease tell us your query and we'll connect you with a live support agent right away!",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Client: media ─────────────────────────────────────────────────────────
  if (!text) {
    if (!sessions[chatId]) {
      const status = await getSupportStatus();
      await handleNewSession(chatId, firstName, status);
    }
    if (!sessions[chatId]) return;
    const caption = `📎 *${firstName}* (ID: \`${chatId}\`)${sessions[chatId].offline ? " ⏸ offline" : ""}`;
    if (msg.photo)    bot.sendPhoto(AGENT_ID, msg.photo[msg.photo.length-1].file_id, { caption, parse_mode: "Markdown" });
    else if (msg.video)    bot.sendVideo(AGENT_ID, msg.video.file_id, { caption, parse_mode: "Markdown" });
    else if (msg.document) bot.sendDocument(AGENT_ID, msg.document.file_id, { caption, parse_mode: "Markdown" });
    else if (msg.voice)    bot.sendVoice(AGENT_ID, msg.voice.file_id, { caption, parse_mode: "Markdown" });
    else if (msg.sticker)  bot.sendMessage(AGENT_ID, `${caption}\n[Sticker]`, { parse_mode: "Markdown" });
    return;
  }

  // ── Client: text message ──────────────────────────────────────────────────
  console.log(`MSG from ${chatId}: ${text}`);

  if (!sessions[chatId]) {
    const status = await getSupportStatus();
    const ok = await handleNewSession(chatId, firstName, status);
    // If offline session created, still forward the message to agent
    if (!ok && !sessions[chatId]) return;
  }

  // Save to history
  if (!sessions[chatId].history) sessions[chatId].history = [];
  sessions[chatId].history.push({ from: "client", text, time: new Date().toISOString() });
  if (sessions[chatId].history.length > 20) sessions[chatId].history = sessions[chatId].history.slice(-20);
  saveSessions(sessions);

  // Forward to agent
  const { agentName, history, offline } = sessions[chatId];
  const prevMsgs = history.slice(0, -1).slice(-9);
  const historyStr = prevMsgs.length > 0
    ? "\n\n📜 *Chat History:*\n" + prevMsgs.map(m => `${m.from === "client" ? "👤" : "🎧"} ${m.text}`).join("\n")
    : "";

  bot.sendMessage(AGENT_ID,
    `📩 *${firstName}* (ID: \`${chatId}\`)${offline ? " ⏸ *[Offline message]*" : ""}\n` +
    `Agent: ${agentName || "—"}${historyStr}\n\n` +
    `💬 *New:* ${text}\n\n` +
    `→ \`/reply ${chatId} your message\`\n` +
    `→ \`/close ${chatId}\``,
    { parse_mode: "Markdown" }
  );
});

bot.on("polling_error", (err) => console.error("Poll error:", err.message));
console.log("SpotiGrader support bot running...");
