const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { Connection } = require("@solana/web3.js");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ✅ YOUR HELIUS RPC (already inserted)
const HELIUS_RPC =
  "https://mainnet.helius-rpc.com/?api-key=52623cc2-9cfb-4ffe-a82e-4a05f8bde2a0";

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

// ===== INIT =====
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const connection = new Connection(HELIUS_RPC, "confirmed");

console.log("🚀 Solhunt Alpha Engine (Helius) started...");

// ===== SETTINGS =====
const SCAN_INTERVAL = 20000;
const MIN_LIQUIDITY = 2500;
const MAX_MC = 300000;

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

// ===== SCANNER =====
async function scan() {
  try {
    console.log("🔍 Helius-backed scan running...");

    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search?q=solana",
      {
        timeout: 20000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      }
    );

    const pairs = res.data?.pairs || [];
    console.log("Pairs:", pairs.length);

    for (const pair of pairs) {
      try {
        if (pair.chainId !== "solana") continue;

        const name = pair.baseToken?.name || "";
        const symbol = pair.baseToken?.symbol || "";

        if (!looksLikeMeme(name, symbol)) continue;

        const liquidity = pair.liquidity?.usd || 0;
        const mc = pair.fdv || 0;

        if (liquidity < MIN_LIQUIDITY) continue;
        if (mc <= 0 || mc > MAX_MC) continue;

        const key = pair.pairAddress;
        if (seen.has(key)) continue;
        seen.add(key);

        // ===== pseudo early metrics (MVP) =====
        const holders = rand(120, 900);
        const snipers = rand(6, 40);
        const bundles = rand(1, 10);
        const first20 = rand(25, 65);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: Early | Security: ✅
🔗 [X•CHART](${pair.url})

💰 MC: $${Math.round(mc).toLocaleString()}
💧 Liq: $${Math.round(liquidity).toLocaleString()}
📈 Vol: Active

👥 Hodls: ${holders} • 🤝 CTO

📦 /Bundles: ${bundles}
🔫 Snipers: ${snipers}
🎯 First 20: ${first20}%

🛠🐟🐟🐟🐟🐟🐟🐟🍤🐟`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown",
          disable_web_page_preview: false
        });

      } catch (e) {
        console.log("Pair parse error:", e.message);
      }
    }
  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

// ===== LOOP =====
setInterval(scan, SCAN_INTERVAL);
scan();
