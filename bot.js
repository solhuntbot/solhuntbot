require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 10000; // 10 seconds
const seenMints = new Set();

/* ===================================================== */

const api = axios.create({
  timeout: 10000,
  headers: { "User-Agent": "PumpFun-Early-Scanner" }
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
/* FETCH NEW PUMP.FUN COINS */
/* ===================================================== */

async function fetchPumpCoins() {
  const data = await safeGet(
    "https://frontend-api.pump.fun/coins?offset=0&limit=30&sort=created_timestamp&order=DESC"
  );

  if (!data || !Array.isArray(data)) return [];
  return data;
}

/* ===================================================== */
/* EARLY FILTER */
/* ===================================================== */

function passesEarlyFilter(token) {
  const ageMinutes =
    (Date.now() - token.created_timestamp) / (1000 * 60);

  const solRaised = token.virtual_sol_reserves || 0;
  const buys = token.reply_count || 0;

  return (
    ageMinutes <= 2 &&     // ultra early
    solRaised >= 5        // at least 5 SOL initial traction
  );
}

/* ===================================================== */
/* TELEGRAM */
/* ===================================================== */

async function sendTelegram(token) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  const ageSeconds = Math.floor(
    (Date.now() - token.created_timestamp) / 1000
  );

  const message = `
🚀 NEW PUMP.FUN LAUNCH

🪙 ${token.symbol}
📝 ${token.name}

⏱ Age: ${ageSeconds}s
💰 SOL Raised: ${token.virtual_sol_reserves || 0}

🔗 https://pump.fun/${token.mint}
`;

  try {
    await api.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message
      }
    );

    console.log("✅ Early alert sent:", token.symbol);
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

/* ===================================================== */
/* MAIN SCANNER */
/* ===================================================== */

async function scan() {
  console.log("Scanning Pump.fun early launches...");

  const coins = await fetchPumpCoins();
  if (!coins.length) return;

  for (const coin of coins) {
    if (seenMints.has(coin.mint)) continue;

    if (!passesEarlyFilter(coin)) continue;

    seenMints.add(coin.mint);
    await sendTelegram(coin);
  }
}

/* ===================================================== */

console.log("🚀 Pump.fun Early Alpha Bot Running...");
setInterval(scan, SCAN_INTERVAL);
scan();
