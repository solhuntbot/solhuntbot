const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log("🚀 Solhunt Meme Scanner started...");

// ===== FILTER SETTINGS =====
const MIN_LIQUIDITY = 5000;
const MIN_VOLUME = 10000;
const MIN_TXNS = 50;

let sent = new Set();

// ===== SCANNER =====
async function scan() {
  try {
    console.log("🔍 Scanning Solana pairs...");

    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana"
    );

    const pairs = res.data.pairs || [];

    console.log(`✅ Pairs received: ${pairs.length}`);

    for (const p of pairs) {
      const liquidity = p.liquidity?.usd || 0;
      const volume = p.volume?.h24 || 0;
      const txns = p.txns?.h24?.buys + p.txns?.h24?.sells || 0;
      const symbol = p.baseToken?.symbol || "UNKNOWN";

      // Meme-style filter
      const isMeme =
        symbol.length <= 6 &&
        !symbol.includes("SOL") &&
        !symbol.includes("USDC");

      if (
        isMeme &&
        liquidity > MIN_LIQUIDITY &&
        volume > MIN_VOLUME &&
        txns > MIN_TXNS &&
        !sent.has(p.pairAddress)
      ) {
        sent.add(p.pairAddress);

        const msg =
`🔥 NEW SOLANA GEM

💎 ${symbol}
💧 Liquidity: $${liquidity.toLocaleString()}
📊 Volume 24h: $${volume.toLocaleString()}
🔁 Txns 24h: ${txns}

🔗 https://dexscreener.com/solana/${p.pairAddress}`;

        await bot.sendMessage(CHAT_ID, msg);
        console.log("✅ Sent:", symbol);
      }
    }
  } catch (err) {
    console.log("❌ Scan error:", err.message);
  }
}

// run every 60 sec
setInterval(scan, 60000);
scan();
