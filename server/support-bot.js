require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs   = require("fs");
const path = require("path");

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

bot.on("message", async (msg) => {
  const chatId    = String(msg.chat.id);
  const text      = msg.text || "";
  const firstName = msg.from.first_name || "User";

  // Forward media from clients to agent
  if (chatId !== String(AGENT_ID) && !text) {
    if (!sessions[chatId]) {
      const agentName = randomName();
      sessions[chatId] = { agentName, firstName };
      saveSessions(sessions);
      await bot.sendMessage(chatId,
        `✅ You are now connected with *${agentName}*\n\n_Please wait — our agent will respond shortly._`,
        { parse_mode: "Markdown" }
      );
    }
    const caption = `📎 *${firstName}* (ID: \`${chatId}\`)`;
    if (msg.photo) {
      const fileId = msg.photo[msg.photo.length - 1].file_id;
      bot.sendPhoto(AGENT_ID, fileId, { caption, parse_mode: "Markdown" });
    } else if (msg.video) {
      bot.sendVideo(AGENT_ID, msg.video.file_id, { caption, parse_mode: "Markdown" });
    } else if (msg.document) {
      bot.sendDocument(AGENT_ID, msg.document.file_id, { caption, parse_mode: "Markdown" });
    } else if (msg.voice) {
      bot.sendVoice(AGENT_ID, msg.voice.file_id, { caption, parse_mode: "Markdown" });
    } else if (msg.sticker) {
      bot.sendMessage(AGENT_ID, `${caption}\n[Sticker]`, { parse_mode: "Markdown" });
    }
    return;
  }

  if (!text) return;

  console.log(`MSG from ${chatId}: ${text}`);

  // ── Agent commands ──────────────────────────────────────────────────────────
  if (chatId === String(AGENT_ID)) {
    if (text.startsWith("/reply ")) {
      const parts     = text.split(" ");
      const targetId  = parts[1];
      const reply     = parts.slice(2).join(" ");
      if (!targetId || !reply) {
        bot.sendMessage(AGENT_ID, "Usage: /reply <chatId> <message>");
        return;
      }
      try {
        await bot.sendMessage(targetId, `🎧 *Support:* ${reply}`, { parse_mode: "Markdown" });
        if (sessions[targetId]) {
          if (!sessions[targetId].history) sessions[targetId].history = [];
          sessions[targetId].history.push({ from: "agent", text: reply, time: new Date().toISOString() });
          saveSessions(sessions);
        }
        bot.sendMessage(AGENT_ID, `✓ Sent to ${sessions[targetId]?.firstName || targetId}`);
      } catch {
        bot.sendMessage(AGENT_ID, `⚠️ Could not deliver to ${targetId}`);
      }
      return;
    }
    if (text.startsWith("/close ")) {
      const targetId = text.split(" ")[1];
      delete sessions[targetId];
      saveSessions(sessions);
      bot.sendMessage(targetId,
        "✅ Your support session has been closed. Thank you for contacting *SpotiGrader.cc*! Feel free to message us again anytime.",
        { parse_mode: "Markdown" }
      );
      bot.sendMessage(AGENT_ID, `Session with ${targetId} closed.`);
      return;
    }
    if (text === "/sessions") {
      const list = Object.entries(sessions);
      if (list.length === 0) { bot.sendMessage(AGENT_ID, "No active sessions."); return; }
      const out = list.map(([id, s]) => `• ${s.firstName} (ID: ${id}) — ${s.agentName}`).join("\n");
      bot.sendMessage(AGENT_ID, `*Active sessions:*\n${out}`, { parse_mode: "Markdown" });
      return;
    }
    // Ignore other agent messages
    return;
  }

  // ── Client: /start ──────────────────────────────────────────────────────────
  if (text === "/start") {
    bot.sendMessage(chatId,
      "👋 *Hi! Welcome to SpotiGrader.cc* 🎵\n\nPlease tell us your query and we'll connect you with a live support agent right away!",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // ── Client: first message — assign agent ────────────────────────────────────
  if (!sessions[chatId]) {
    const agentName = randomName();
    sessions[chatId] = { agentName, firstName, history: [] };
    saveSessions(sessions);
    await bot.sendMessage(chatId,
      `✅ You are now connected with *${agentName}*\n\n_Please wait — our agent will respond shortly._`,
      { parse_mode: "Markdown" }
    );
  }

  // Save message to history
  if (!sessions[chatId].history) sessions[chatId].history = [];
  sessions[chatId].history.push({ from: "client", text, time: new Date().toISOString() });
  // Keep last 20 messages
  if (sessions[chatId].history.length > 20) sessions[chatId].history = sessions[chatId].history.slice(-20);
  saveSessions(sessions);

  // ── Forward to agent with history ───────────────────────────────────────────
  const { agentName, history } = sessions[chatId];

  // Build history string (last 10 messages excluding current)
  const prevMsgs = history.slice(0, -1).slice(-9);
  const historyStr = prevMsgs.length > 0
    ? "\n\n📜 *Chat History:*\n" + prevMsgs.map(m =>
        `${m.from === "client" ? "👤" : "🎧"} ${m.text}`
      ).join("\n")
    : "";

  bot.sendMessage(AGENT_ID,
    `📩 *${firstName}* (ID: \`${chatId}\`)\n` +
    `Agent: ${agentName}${historyStr}\n\n` +
    `💬 *New:* ${text}\n\n` +
    `→ \`/reply ${chatId} your message\`\n` +
    `→ \`/close ${chatId}\``,
    { parse_mode: "Markdown" }
  );
});

bot.on("polling_error", (err) => console.error("Poll error:", err.message));
console.log("SpotiGrader support bot running...");
