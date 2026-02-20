const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Solhunt Meme Scanner started...");

// ===== SETTINGS =====
const MIN_LIQUIDITY = 8000;
const MIN_MC = 8000;
const MIN_AGE_MINUTES = 2;

const seen = new Set();

// ===== SCANNER =====
async function scanSolanaPairs() {
  try {
    console.log("🔍 Scanning Solana pairs...");

    // 🔥 stronger endpoint
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search/?q=SOL",
      { timeout: 15000 }
    );

    if (!res.data || !res.data.pairs) {
      console.log("⚠️ No pairs returned");
      return;
    }

    const pairs = res.data.pairs;
    console.log(`✅ Pairs received: ${pairs.length}`);

    for (const pair of pairs) {
      try {
        if (pair.chainId !== "solana") continue;
        if (seen.has(pair.pairAddress)) continue;

        const liquidity = pair.liquidity?.usd || 0;
        const mc = pair.fdv || 0;
        const ageMinutes =
          (Date.now() - (pair.pairCreatedAt || Date.now())) / 60000;

        if (
          liquidity >= MIN_LIQUIDITY &&
          mc >= MIN_MC &&
          ageMinutes >= MIN_AGE_MINUTES
        ) {
          seen.add(pair.pairAddress);

          const msg = `
🚀 *${pair.baseToken?.name || "Unknown"}*
💰 MC: $${Math.round(mc)}
💧 Liquidity: $${Math.round(liquidity)}
⏱ Age: ${ageMinutes.toFixed(1)} min
🔗 ${pair.url}
          `;

          await bot.sendMessage(CHAT_ID, msg, { parse_mode: "Markdown" });
        }
      } catch (innerErr) {
        console.log("⚠️ Pair skipped");
      }
    }
  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

// ===== LOOP =====
setInterval(scanSolanaPairs, 45000);
scanSolanaPairs();
