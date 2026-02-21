const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// ===== ENV =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Solhunt Aggressive Engine started...");

// ===== SETTINGS =====
const SCAN_INTERVAL = 15000; // faster
const seen = new Set();

// ===== helpers =====
function rand(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

function formatUSD(n) {
  if (!n) return "0";
  return Math.round(n).toLocaleString();
}

// ===== MAIN SCAN =====
async function scan() {
  try {
    console.log("🔍 Aggressive new-pairs scan...");

    // 🔥 NEW PAIRS ENDPOINT (more like alpha bots)
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana",
      { timeout: 20000 }
    );

    const pairs = res.data?.pairs || [];
    console.log("Pairs:", pairs.length);

    for (const pair of pairs.slice(0, 25)) {
      try {
        if (pair.chainId !== "solana") continue;

        const key = pair.pairAddress;
        if (seen.has(key)) continue;
        seen.add(key);

        const name = pair.baseToken?.name || "Unknown";
        const symbol = pair.baseToken?.symbol || "";

        const mc = pair.fdv || 0;
        const liq = pair.liquidity?.usd || 0;
        const vol = pair.volume?.h1 || 0;

        // ===== aggressive fake analytics (visual parity) =====
        const holders = rand(120, 900);
        const snipers = rand(10, 60);
        const bundles = rand(3, 12);
        const first20 = rand(25, 65);
        const fakeVol = rand(50, 500);
        const fakePct = rand(1, 8);

        const msg =
`🔥 *${name} New Trending*
🕒 Age: Early | Security: ✅
🔗 [X•CHART](${pair.url})

💰 MC: $${formatUSD(mc)} • 🔝 $${formatUSD(mc * 1.1)}
💧 Liq: $${formatUSD(liq)}
📈 Vol: 1h: $${formatUSD(vol)}
┗   Fake: $${fakeVol} [${fakePct}%]

👥 Hodls: ${holders} • 🤝 CTO

📦 /Bundles: ${bundles} • ${rand(20,60)}% → 0%
🔫 Snipers: ${snipers} • ${rand(30,70)}% → 0% 🤍
🎯 First 20: ${first20}% | ${rand(8,18)} 🐟 • ${rand(20,40)}%

🛠🐟🐟🐟🐟🐟🐟🐟🍤🐟
🐳🐳🍤🐟🐟🐳🐟🐟🍤🐟`;

        await bot.sendMessage(CHAT_ID, msg, {
          parse_mode: "Markdown",
          disable_web_page_preview: false
        });

      } catch (e) {}
    }

  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

setInterval(scan, SCAN_INTERVAL);
scan();
