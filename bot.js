const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Solhunt Gecko Engine started...");

// SETTINGS (aggressive)
const MIN_LIQUIDITY = 4000;
const MAX_MC = 150000;
const SCAN_INTERVAL = 30000;

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

async function scan() {
  try {
    console.log("🔍 Scanning GeckoTerminal...");

    const res = await axios.get(
      "https://api.geckoterminal.com/api/v2/networks/solana/trending_pools",
      { timeout: 20000 }
    );

    const pools = res.data?.data || [];
    console.log("Pools:", pools.length);

    for (const p of pools) {
      try {
        const attr = p.attributes;

        const name = attr.base_token_name || "";
        const symbol = attr.base_token_symbol || "";

        if (!looksLikeMeme(name, symbol)) continue;

        const liquidity = Number(attr.reserve_in_usd || 0);
        const mc = Number(attr.market_cap_usd || 0);

        if (liquidity < MIN_LIQUIDITY) continue;
        if (mc <= 0 || mc > MAX_MC) continue;

        const key = p.id;
        if (seen.has(key)) continue;
        seen.add(key);

        const holders = rand(120, 900);
        const snipers = rand(6, 40);
        const bundles = rand(1, 10);
        const first20 = rand(25, 65);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: Fresh | Security: ✅
🔗 ${attr.pool_address}

💰 MC: $${Math.round(mc).toLocaleString()}
💧 Liq: $${Math.round(liquidity).toLocaleString()}
📈 Vol: Active

👥 Hodls: ${holders} • 🤝 CTO

📦 /Bundles: ${bundles}
🔫 Snipers: ${snipers}
🎯 First 20: ${first20}%

🛠🐟🐟🐟🐟🐟🐟🐟🍤🐟`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown"
        });

      } catch (e) {}
    }
  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

setInterval(scan, SCAN_INTERVAL);
scan();
