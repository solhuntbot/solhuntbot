require("dotenv").config();
const axios = require("axios");
const NodeCache = require("node-cache");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("Missing BOT_TOKEN or CHAT_ID in .env");
  process.exit(1);
}

const CACHE = new NodeCache({ stdTTL: 3600 });
const SCAN_INTERVAL = 20000; // 20 seconds for safety
const MAX_RETRIES = 3;

const API_HEADERS = {
  "User-Agent": "Solana-PumpScanner-Bot"
};

// Safe GET request with retry for 530
async function safeGet(url, retries = 0) {
  try {
    const res = await axios.get(url, { headers: API_HEADERS, timeout: 10000 });
    return res.data;
  } catch (err) {
    if ((err.response?.status === 530 || err.code === "ECONNRESET") && retries < MAX_RETRIES) {
      console.log(`530 or connection error detected. Retrying in 5s... [${retries + 1}]`);
      await new Promise(r => setTimeout(r, 5000));
      return safeGet(url, retries + 1);
    }
    console.log("Handled API error:", err.response?.status || err.message);
    return null;
  }
}

// Fetch newest Pump.fun coins
async function fetchNewCoins() {
  const data = await safeGet(
    "https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC"
  );
  if (!data || !Array.isArray(data)) return [];
  return data;
}

// Alpha filter
function passesFilter(token) {
  const liquidity = token.liquidity?.usd || 0;
  const fdv = token.fdv || 0;
  const ageHours = (Date.now() - token.created_timestamp) / (1000 * 60 * 60);
  const tx5m = (token.txns?.m5?.buys || 0) + (token.txns?.m5?.sells || 0);
  const buys24 = token.txns?.h24?.buys || 0;
  const sells24 = token.txns?.h24?.sells || 0;

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

// Send Telegram
async function sendTelegram(token) {
  const message = `
🔥 NEW ALPHA COIN DETECTED

🪙 ${token.symbol} - ${token.name}
🕒 Age: ${Math.floor((Date.now() - token.created_timestamp)/60000)}m
💰 FDV: $${Math.round(token.fdv || 0)}
💧 Liquidity: $${Math.round(token.liquidity?.usd || 0)}
📈 Volume 24h: $${Math.round(token.volume?.h24 || 0)}
👥 Hodls: ${token.holders_count || "N/A"}
⚡ 5-min Tx: ${tx5m}

🔗 https://pump.fun/${token.mint}
`;
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text: message }
    );
    console.log("✅ Alert sent for:", token.symbol);
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

// Main scan loop
async function scan() {
  console.log("Scanning Pump.fun for new coins...");
  const coins = await fetchNewCoins();
  for (const coin of coins) {
    if (CACHE.has(coin.mint)) continue;
    if (!passesFilter(coin)) continue;

    CACHE.set(coin.mint, true);
    await sendTelegram(coin);
  }
}

// Start
console.log("🚀 Pump.fun Alpha Bot Running...");
scan();
setInterval(scan, SCAN_INTERVAL);
