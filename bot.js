const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SCAN_INTERVAL = Number(process.env.SCAN_INTERVAL) || 60000;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const seen = new Set();

// 🔥 Dexscreener scanner (FIXED ENDPOINT)
async function scanDexscreener() {
  try {
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search?q=solana",
      { timeout: 15000 }
    );

    const pairs = res.data?.pairs || [];

    // pick newest looking pairs
    const fresh = pairs.slice(0, 10);

    for (const p of fresh) {
      if (!p?.pairAddress) continue;
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);

      const mc = Math.floor(p.fdv || 0);
      const liq = Math.floor(p.liquidity?.usd || 0);
      const vol = Math.floor(p.volume?.h24 || 0);

      const message = `🔥 ${p.baseToken.name} New Trending
🕒 Age: New | Security: ✅
🔗 X•CHART

💰 MC: $${mc.toLocaleString()}
💧 Liq: $${liq.toLocaleString()}
📈 Vol: 24h: $${vol.toLocaleString()}

👥 Hodls: — • 🤝

📦 /Bundles: —
🔫 Snipers: —
🎯 First 20: —

📈 ${p.baseToken.symbol} is moving 📈

🔗 https://dexscreener.com/solana/${p.pairAddress}

💸💸💸💸💸💸`;

      await bot.sendMessage(CHAT_ID, message, {
        disable_web_page_preview: true,
      });

      // small delay to avoid Telegram flood
      await new Promise(r => setTimeout(r, 1500));
    }
  } catch (err) {
    console.log(
      "❌ Dex scan error:",
      err.response?.status || "",
      err.message
    );
  }
}

// ⏱ main loop
async function runScanner() {
  await scanDexscreener();
}

setInterval(runScanner, SCAN_INTERVAL);

console.log("🚀 Solhunt bot running...");
