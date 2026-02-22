const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SCAN_INTERVAL = Number(process.env.SCAN_INTERVAL) || 60000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const seen = new Set();

// ✅ shared axios config (fixes Pump 530)
const http = axios.create({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json"
  }
});


// =======================
// 🔥 DEXSCREENER SCANNER
// =======================
async function scanDexscreener() {
  try {
    const res = await http.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana"
    );

    const pairs = res.data?.pairs || [];

    const now = Date.now();

    // ✅ filter REAL new pairs (last 10 minutes)
    const fresh = pairs
      .filter(p => {
        if (!p.pairCreatedAt) return false;
        const ageMinutes = (now - p.pairCreatedAt) / 60000;
        return ageMinutes <= 10; // ⭐ EARLY
      })
      .slice(0, 5);

    for (const p of fresh) {
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);

      const ageMin = Math.floor((now - p.pairCreatedAt) / 60000);

      await bot.sendMessage(
        CHAT_ID,
        `🔥 New Solana Pair

🪙 ${p.baseToken.name} (${p.baseToken.symbol})
🕒 Age: ${ageMin}m

💰 MC: $${Math.floor(p.fdv || 0)}
💧 Liq: $${Math.floor(p.liquidity?.usd || 0)}
📈 Vol 24h: $${Math.floor(p.volume?.h24 || 0)}

🔗 https://dexscreener.com/solana/${p.pairAddress}`
      );
    }

    console.log(`✅ Dex scanned: ${pairs.length}`);
  } catch (err) {
    console.log("❌ Dex scan error:", err.response?.status || err.message);
  }
}


// =======================
// 💊 PUMP.FUN SCANNER
// =======================
async function scanPumpFun() {
  try {
    const res = await http.get(
      "https://frontend-api.pump.fun/coins/latest"
    );

    const coins = res.data || [];

    for (const coin of coins.slice(0, 5)) {
      if (seen.has(coin.mint)) continue;
      seen.add(coin.mint);

      await bot.sendMessage(
        CHAT_ID,
        `💊 Pump.fun Launch

🪙 ${coin.name} (${coin.symbol})
🏷 Mint: ${coin.mint}

🔗 https://pump.fun/${coin.mint}`
      );
    }

    console.log(`✅ Pump scanned: ${coins.length}`);
  } catch (err) {
    console.log("❌ Pump scan error:", err.response?.status || err.message);
  }
}


// =======================
// ⏱ MAIN LOOP
// =======================
async function runScanner() {
  await scanDexscreener();
  await scanPumpFun();
}

// ✅ RUN IMMEDIATELY (you were missing this)
runScanner();

// ✅ then interval
setInterval(runScanner, SCAN_INTERVAL);

console.log("🚀 Solhunt bot running...");
