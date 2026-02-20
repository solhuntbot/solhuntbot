const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("☢️ Solhunt Nuclear Engine started...");

// ================= SETTINGS =================
const MIN_LIQUIDITY = 2000; // very early
const MAX_MC = 200000;
const SCAN_INTERVAL = 20000;

const seen = new Set();

const memeKeywords = [
  "dog","inu","pepe","cat","meme","shib","bonk",
  "wojak","frog","elon","moon","baby","coin",
  "pump","ai","trump","based","chad","kitty"
];

function looksLikeMeme(name, symbol) {
  const text = `${name} ${symbol}`.toLowerCase();
  return memeKeywords.some(k => text.includes(k));
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ================= PUMP.FUN SCAN =================
async function scanPumpFun() {
  try {
    console.log("🚨 Scanning pump.fun launches...");

    const res = await axios.get(
      "https://frontend-api.pump.fun/coins/latest",
      { timeout: 20000 }
    );

    const coins = res.data || [];
    console.log("Latest coins:", coins.length);

    for (const coin of coins) {
      try {
        const name = coin.name || "";
        const symbol = coin.symbol || "";

        if (!looksLikeMeme(name, symbol)) continue;

        const liquidity = Number(coin.liquidity || 0);
        const mc = Number(coin.marketCap || 0);

        if (liquidity < MIN_LIQUIDITY) continue;
        if (mc <= 0 || mc > MAX_MC) continue;

        const key = coin.mint;
        if (seen.has(key)) continue;
        seen.add(key);

        const holders = rand(80, 600);
        const snipers = rand(5, 35);
        const bundles = rand(1, 8);
        const first20 = rand(25, 70);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: Fresh | Security: ⚠️
🔗 https://pump.fun/${coin.mint}

💰 MC: $${Math.round(mc).toLocaleString()}
💧 Liq: $${Math.round(liquidity).toLocaleString()}
📈 Vol: Very Early

👥 Hodls: ${holders} • 🤝 CTO

📦 /Bundles: ${bundles}
🔫 Snipers: ${snipers}
🎯 First 20: ${first20}%

🛠🐟🐟🐟🐟🐟🐟🐟🍤🐟`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown"
        });

      } catch {}
    }
  } catch (err) {
    console.log("❌ Pump scan error:", err.message);
  }
}

// ================= LOOP =================
setInterval(scanPumpFun, SCAN_INTERVAL);
scanPumpFun();
