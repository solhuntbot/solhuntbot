const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const SCAN_INTERVAL = Number(process.env.SCAN_INTERVAL) || 60000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const seen = new Set();

async function scanDexscreener() {
  try {
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana"
    );

    const pairs = res.data.pairs || [];

    const fresh = pairs
      .filter(p => p.chainId === "solana")
      .slice(0, 5);

    for (const p of fresh) {
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);

      await bot.sendMessage(
        CHAT_ID,
        `🚀 NEW PAIR ALERT

🪙 ${p.baseToken.name} (${p.baseToken.symbol})
💰 MC: $${Math.floor(p.fdv || 0)}
💧 Liquidity: $${Math.floor(p.liquidity?.usd || 0)}
📊 Volume 24h: $${Math.floor(p.volume?.h24 || 0)}

🔗 https://dexscreener.com/solana/${p.pairAddress}`
      );
    }
  } catch (err) {
    console.log("❌ Dex scan error:", err.message);
  }
}

// 🔥 Pump.fun lightweight check
async function scanPumpFun() {
  try {
    const res = await axios.get(
      "https://frontend-api.pump.fun/coins/latest"
    );

    const coins = res.data || [];

    for (const coin of coins.slice(0, 3)) {
      if (seen.has(coin.mint)) continue;
      seen.add(coin.mint);

      await bot.sendMessage(
        CHAT_ID,
        `💊 PUMP.FUN LAUNCH

🪙 ${coin.name} (${coin.symbol})
🏷 Mint: ${coin.mint}

🔗 https://pump.fun/${coin.mint}`
      );
    }
  } catch (err) {
    console.log("❌ Pump scan error:", err.message);
  }
}

// ⏱ main loop
async function runScanner() {
  await scanDexscreener();
  await scanPumpFun();
}

setInterval(runScanner, SCAN_INTERVAL);
console.log("🚀 Solhunt bot running...");
