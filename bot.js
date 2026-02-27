require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 15000;
const seenTokens = new Set();

/* ===================================================== */

const api = axios.create({
  timeout: 10000,
  headers: { "User-Agent": "Solana-Pump-Scanner" }
});

/* ===================================================== */
/* SAFE REQUEST */
/* ===================================================== */

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
/* STEP 1: FETCH NEW PUMP.FUN TOKENS */
/* ===================================================== */

async function fetchPumpTokens() {
  const data = await safeGet(
    "https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC"
  );

  if (!data || !Array.isArray(data)) return [];
  return data;
}

/* ===================================================== */
/* STEP 2: CHECK IF TOKEN HAS DEX PAIR */
/* ===================================================== */

async function fetchDexPair(tokenAddress) {
  const data = await safeGet(
    `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
  );

  if (!data || !data.pairs || data.pairs.length === 0) return null;

  // Only care about Solana pairs
  const solPair = data.pairs.find(p => p.chainId === "solana");
  return solPair || null;
}

/* ===================================================== */
/* PROFESSIONAL FILTER */
/* ===================================================== */

function passesFilter(pair) {
  if (!pair.pairCreatedAt) return false;

  const liquidity = pair.liquidity?.usd || 0;
  const fdv = pair.fdv || 0;

  const buys24 = pair.txns?.h24?.buys || 0;
  const sells24 = pair.txns?.h24?.sells || 0;

  const tx5m =
    (pair.txns?.m5?.buys || 0) +
    (pair.txns?.m5?.sells || 0);

  const ageHours =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60 * 60);

  return (
    liquidity >= 8500 &&
    fdv >= 100000 &&
    fdv <= 1000000 &&
    ageHours <= 48 &&
    buys24 >= 50 &&
    sells24 >= 30 &&
    tx5m >= 10
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

  const message = `
🔥 PUMP.FUN MIGRATION ALERT

🪙 ${pair.baseToken.symbol}
💰 FDV: $${Math.round(pair.fdv || 0)}
💧 Liquidity: $${Math.round(pair.liquidity?.usd || 0)}
📈 Volume (24h): $${Math.round(pair.volume?.h24 || 0)}

🟢 24H Buys: ${pair.txns?.h24?.buys || 0}
🔴 24H Sells: ${pair.txns?.h24?.sells || 0}
⚡ 5M Tx: ${(pair.txns?.m5?.buys || 0) + (pair.txns?.m5?.sells || 0)}

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
  console.log("Scanning Pump.fun...");

  const pumpTokens = await fetchPumpTokens();
  if (!pumpTokens.length) return;

  for (const token of pumpTokens) {
    if (seenTokens.has(token.mint)) continue;
    seenTokens.add(token.mint);

    const pair = await fetchDexPair(token.mint);
    if (!pair) continue;

    if (!passesFilter(pair)) continue;

    await sendTelegram(pair);
  }
}

/* ===================================================== */

console.log("🚀 Pump.fun Direct Scanner Running...");
setInterval(scan, SCAN_INTERVAL);
scan();
