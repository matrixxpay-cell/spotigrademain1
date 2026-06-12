require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const AGENT_ID   = process.env.TELEGRAM_AGENT_ID; // your personal Telegram chat ID

if (!TOKEN || !AGENT_ID) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_AGENT_ID in .env");
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

const US_NAMES = [
  "James Wilson","Emily Johnson","Michael Brown","Sarah Davis","Chris Martinez",
  "Ashley Anderson","Matthew Taylor","Jessica Thomas","Daniel Harris","Ashley White",
  "Ryan Clark","Megan Lewis","Joshua Robinson","Brittany Walker","Andrew Hall",
];

// clientChatId -> { agentName, firstName }
const sessions = {};

function randomName() {
  return US_NAMES[Math.floor(Math.random() * US_NAMES.length)];
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    "👋 *Hi! Welcome to SpotiGrader.cc*\n\nPlease tell us your query and we'll connect you with a live support agent right away! 🎵",
    { parse_mode: "Markdown" }
  );
});

// ── Agent: /reply <chatId> <message> ──────────────────────────────────────────
bot.onText(/\/reply (\d+) (.+)/, (msg, match) => {
  if (msg.chat.id.toString() !== AGENT_ID) return;
  const targetId  = match[1];
  const text      = match[2];
  bot.sendMessage(targetId,
    `🎧 *Support Agent:* ${text}`,
    { parse_mode: "Markdown" }
  ).catch(() => {
    bot.sendMessage(AGENT_ID, `⚠️ Could not deliver to ${targetId} — they may have blocked the bot.`);
  });
});

// ── Agent: /close <chatId> ────────────────────────────────────────────────────
bot.onText(/\/close (\d+)/, (msg, match) => {
  if (msg.chat.id.toString() !== AGENT_ID) return;
  const targetId = match[1];
  delete sessions[targetId];
  bot.sendMessage(targetId,
    "✅ Your support session has been closed. Thank you for contacting *SpotiGrader.cc*!\n\nFor future queries, feel free to message us again.",
    { parse_mode: "Markdown" }
  );
  bot.sendMessage(AGENT_ID, `Session with ${targetId} closed.`);
});

// ── Agent: /sessions ──────────────────────────────────────────────────────────
bot.onText(/\/sessions/, (msg) => {
  if (msg.chat.id.toString() !== AGENT_ID) return;
  const list = Object.entries(sessions);
  if (list.length === 0) {
    bot.sendMessage(AGENT_ID, "No active sessions.");
    return;
  }
  const text = list.map(([id, s]) => `• ${s.firstName} (ID: \`${id}\`) — Agent: ${s.agentName}`).join("\n");
  bot.sendMessage(AGENT_ID, `*Active Sessions:*\n${text}`, { parse_mode: "Markdown" });
});

// ── Client messages ───────────────────────────────────────────────────────────
bot.on("message", (msg) => {
  // Ignore commands
  if (!msg.text || msg.text.startsWith("/")) return;

  const clientId   = msg.chat.id.toString();
  const firstName  = msg.from.first_name || "User";

  // If message is from agent, ignore (handled by /reply command)
  if (clientId === AGENT_ID) return;

  // First message — assign agent name and greet
  if (!sessions[clientId]) {
    const agentName = randomName();
    sessions[clientId] = { agentName, firstName };

    bot.sendMessage(clientId,
      `✅ You are now connected with *${agentName}*\n\n_Please wait for a response — our agent will be with you shortly._`,
      { parse_mode: "Markdown" }
    );
  }

  const { agentName } = sessions[clientId];

  // Forward to agent
  bot.sendMessage(AGENT_ID,
    `📩 *New message from ${firstName}*\n` +
    `🔗 Chat ID: \`${clientId}\`\n` +
    `👤 Agent assigned: ${agentName}\n\n` +
    `*Message:*\n${msg.text}\n\n` +
    `_Reply:_ \`/reply ${clientId} your message here\`\n` +
    `_Close:_ \`/close ${clientId}\``,
    { parse_mode: "Markdown" }
  );
});

bot.on("polling_error", (err) => console.error("Polling error:", err.message));

console.log("SpotiGrader support bot running...");
