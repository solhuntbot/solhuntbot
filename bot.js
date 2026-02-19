const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// filters (AGGRESSIVE MEME HUNTER)
const MIN_LIQUIDITY = 15000;
const MIN_VOLUME = 20000;
const MAX_AGE_MINUTES = 60;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 SOLANA MEME ENGINE PRO STARTED...");

let seen = new Set();

// ================= MAIN SCANNER =================
async function scan() {
  try {
    console.log("🔍 Scanning Solana meme pairs...");

    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana"
    );

    const pairs = res.data.pairs || [];

    for (const p of pairs) {
      try {
        const liquidity = p.liquidity?.usd || 0;
        const volume = p.volume?.h1 || 0;
        const ageMinutes =
          (Date.now() - new Date(p.pairCreatedAt).getTime()) / 60000;

        // STRICT MEME FILTER
        if (
          liquidity < MIN_LIQUIDITY ||
          volume < MIN_VOLUME ||
          ageMinutes > MAX_AGE_MINUTES
        )
          continue;

        if (seen.has(p.pairAddress)) continue;
        seen.add(p.pairAddress);

        const name = p.baseToken?.name || "Unknown";
        const symbol = p.baseToken?.symbol || "";
        const mc = p.fdv || 0;

        const msg = `
🔥 <b>${name} NEW TRENDING</b>

⏱ Age: ${ageMinutes.toFixed(1)}m
💰 MC: $${Math.round(mc).toLocaleString()}
💧 Liq: $${Math.round(liquidity).toLocaleString()}
📊 Vol(1h): $${Math.round(volume).toLocaleString()}

📜 CA:
<code>${p.baseToken?.address}</code>
`;

        await bot.sendMessage(CHAT_ID, msg, { parse_mode: "HTML" });
      } catch (e) {}
    }
  } catch (err) {
    console.log("Scan error:", err.message);
  }
}

// run every 30s
setInterval(scan, 30000);
scan();

// start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "✅ Solhunt engine is running.");
});
