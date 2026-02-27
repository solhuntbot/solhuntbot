require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 20000; // 20 seconds
const sentPairs = new Set();

/* ===================================================== */

const api = axios.create({
  timeout: 10000,
  headers: { "User-Agent": "Solana-Alpha-Scanner" }
});

async function safeGet(url) {
  try {
    const res = await api.get(url);
    return res.data;
  } catch (err) {
    console.log("Handled API error:", err.response?.status || err.message);
    return null;
  }
}

/* ===================================================== */
/* FETCH SOLANA PAIRS */
/* ===================================================== */

async function fetchPairs() {
  const data = await safeGet(
    "https://api.dexscreener.com/latest/dex/pairs/solana"
  );

  if (!data || !data.pairs) return [];
  return data.pairs;
}

/* ===================================================== */
/* PROFESSIONAL FILTER */
/* ===================================================== */

function passesFilter(pair) {
  if (!pair.pairCreatedAt) return false;

  const now = Date.now();
  const ageHours =
    (now - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60 * 60);

  const liquidity = pair.liquidity?.usd || 0;
  const fdv = pair.fdv || 0;

  const buys24 = pair.txns?.h24?.buys || 0;
  const sells24 = pair.txns?.h24?.sells || 0;

  const tx5mBuys = pair.txns?.m5?.buys || 0;
  const tx5mSells = pair.txns?.m5?.sells || 0;
  const tx5mTotal = tx5mBuys + tx5mSells;

  return (
    liquidity >= 8500 &&
    fdv >= 100000 &&
    fdv <= 1000000 &&
    ageHours <= 48 &&
    buys24 >= 50 &&
    sells24 >= 30 &&
    tx5mTotal >= 10
  );
}

/* ===================================================== */
/* TELEGRAM */
/* ===================================================== */

async function sendTelegram(pair) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  const ageHours = Math.round(
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
      (1000 * 60 * 60)
  );

  const message = `
🔥 SOLANA MOMENTUM ALERT

🪙 ${pair.baseToken.symbol}
🕒 Age: ${ageHours}h

💰 FDV: $${Math.round(pair.fdv || 0)}
💧 Liquidity: $${Math.round(pair.liquidity?.usd || 0)}
📈 Volume (24h): $${Math.round(pair.volume?.h24 || 0)}

🟢 24H Buys: ${pair.txns?.h24?.buys || 0}
🔴 24H Sells: ${pair.txns?.h24?.sells || 0}

⚡ 5M Transactions: ${(pair.txns?.m5?.buys || 0) + (pair.txns?.m5?.sells || 0)}

🔗 https://dexscreener.com/solana/${pair.pairAddress}
`;

  try {
    await api.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message
      }
    );

    console.log("✅ Alert sent:", pair.baseToken.symbol);
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

/* ===================================================== */
/* MAIN SCANNER */
/* ===================================================== */

async function scan() {
  console.log("Scanning...");

  const pairs = await fetchPairs();
  if (!pairs.length) return;

  for (const pair of pairs) {
    if (!passesFilter(pair)) continue;
    if (sentPairs.has(pair.pairAddress)) continue;

    sentPairs.add(pair.pairAddress);
    await sendTelegram(pair);
  }
}

/* ===================================================== */

console.log("🚀 Professional Solana Scanner Running...");
setInterval(scan, SCAN_INTERVAL);
scan();
