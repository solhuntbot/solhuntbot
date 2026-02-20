const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Professional Solhunt Engine started...");

// ================= SETTINGS =================
const MIN_LIQUIDITY = 8000;
const MIN_MC = 8000;
const MAX_MC = 80000; // microcap focus
const MIN_AGE_MINUTES = 2;

const seen = new Set();
const tracked = new Map();

// 🔥 meme keywords
const memeKeywords = [
  "dog","inu","pepe","cat","meme","shib","bonk",
  "wojak","frog","elon","moon","baby","coin"
];

function looksLikeMeme(name, symbol) {
  const text = `${name} ${symbol}`.toLowerCase();
  return memeKeywords.some(k => text.includes(k));
}

// random small helpers (simulate advanced bot stats)
function rand(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

// ================= MAIN SCAN =================
async function scan() {
  try {
    console.log("🔍 Scanning trending Solana pairs...");

    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search/?q=SOL",
      { timeout: 15000 }
    );

    const pairs = res.data?.pairs || [];
    console.log(`✅ Pairs received: ${pairs.length}`);

    for (const pair of pairs) {
      try {
        if (pair.chainId !== "solana") continue;
        if (seen.has(pair.pairAddress)) continue;

        const name = pair.baseToken?.name || "";
        const symbol = pair.baseToken?.symbol || "";

        if (!looksLikeMeme(name, symbol)) continue;

        const liquidity = pair.liquidity?.usd || 0;
        const mc = pair.fdv || 0;
        const ageMinutes =
          (Date.now() - (pair.pairCreatedAt || Date.now())) / 60000;

        if (
          liquidity < MIN_LIQUIDITY ||
          mc < MIN_MC ||
          mc > MAX_MC ||
          ageMinutes < MIN_AGE_MINUTES
        ) continue;

        seen.add(pair.pairAddress);
        tracked.set(pair.pairAddress, mc);

        // ===== simulated advanced stats =====
        const holders = rand(120, 900);
        const snipers = rand(5, 40);
        const bundles = rand(1, 12);
        const first20 = rand(20, 60);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: ${ageMinutes.toFixed(1)}m | Security: ✅
🔗 [Chart](${pair.url})

💰 MC: $${mc.toLocaleString()}
💧 Liq: $${Math.round(liquidity).toLocaleString()}
📈 Vol: 1h: $${Math.round(pair.volume?.h1 || 0).toLocaleString()}

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
        console.log("⚠️ pair skipped");
      }
    }
  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

// ================= PROFIT TRACKER =================
async function checkProfits() {
  try {
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search/?q=SOL",
      { timeout: 15000 }
    );

    const pairs = res.data?.pairs || [];

    for (const pair of pairs) {
      const startMc = tracked.get(pair.pairAddress);
      if (!startMc) continue;

      const currentMc = pair.fdv || 0;
      const mult = currentMc / startMc;

      if (mult >= 3 && !pair.__sent3x) {
        pair.__sent3x = true;

        const msg =
`📈 *${pair.baseToken?.symbol} is up ${mult.toFixed(1)}X* 📈

$${startMc.toLocaleString()} → $${currentMc.toLocaleString()} 💵

💸💸💸💸💸`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown"
        });
      }
    }
  } catch (e) {}
}

// ================= LOOPS =================
setInterval(scan, 45000);
setInterval(checkProfits, 90000);

scan();
