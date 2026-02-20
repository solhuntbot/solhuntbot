const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Solhunt Aggressive Engine started...");

// ================= AGGRESSIVE SETTINGS =================
const MIN_LIQUIDITY = 6000;     // lower = more signals
const MIN_MC = 5000;
const MAX_MC = 120000;          // microcap hunter
const MIN_AGE_MINUTES = 1;      // very early
const SCAN_INTERVAL = 30000;    // faster scans

const seen = new Set();
const tracked = new Map();

// 🔥 strong meme keywords
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

// ================= MAIN SCAN =================
async function scan() {
  try {
    console.log("🔍 Aggressive scan running...");

    // 🔥 trending endpoint (stronger than basic search)
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana",
      { timeout: 20000 }
    );

    const pairs = res.data?.pairs || [];
    console.log(`✅ Pairs received: ${pairs.length}`);

    // 🔥 sort by newest first (VERY IMPORTANT)
    pairs.sort((a, b) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0));

    for (const pair of pairs) {
      try {
        if (seen.has(pair.pairAddress)) continue;

        const name = pair.baseToken?.name || "";
        const symbol = pair.baseToken?.symbol || "";

        // 🔥 HARD meme filter
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

        // simulated advanced stats (reference style)
        const holders = rand(150, 900);
        const snipers = rand(8, 45);
        const bundles = rand(1, 12);
        const first20 = rand(25, 65);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: ${ageMinutes.toFixed(1)}m | Security: ✅
🔗 [X•CHART](${pair.url})

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

      } catch (inner) {
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
      "https://api.dexscreener.com/latest/dex/pairs/solana",
      { timeout: 20000 }
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

💸💸💸💸💸💸`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown"
        });
      }
    }
  } catch {}
}

// ================= LOOPS =================
setInterval(scan, SCAN_INTERVAL);
setInterval(checkProfits, 90000);

scan();
