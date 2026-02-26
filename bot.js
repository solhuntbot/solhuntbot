require("dotenv").config();
const axios = require("axios");
const NodeCache = require("node-cache");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const cache = new NodeCache({ stdTTL: 600 }); // dedupe memory 10 mins
const smartWallets = new Set();
const discoveredPairs = new Set();

const SCAN_INTERVAL = 20000; // 20 seconds

/* ---------------------------------------------------
   GLOBAL AXIOS RESILIENCE
--------------------------------------------------- */
axios.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    if ([403, 404, 429, 530].includes(status)) {
      console.log(`Handled API error: ${status}`);
      return Promise.resolve({ data: {} });
    }
    return Promise.reject(err);
  }
);

async function retry(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

/* ---------------------------------------------------
   WATCHERS
--------------------------------------------------- */

async function fetchPumpTokens() {
  return retry(async () => {
    const { data } = await axios.get("https://pump.fun/api/new");
    return data.tokens || [];
  });
}

async function fetchDexPairs() {
  return retry(async () => {
    const { data } = await axios.get(
      "https://api.dexscreener.com/latest/dex/pairs/solana"
    );
    return data.pairs || [];
  });
}

/* ---------------------------------------------------
   FILTER RULES
--------------------------------------------------- */

function validPair(pair) {
  const ageHours =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60 * 60);

  const tx24 = pair.txns?.h24 || {};
  const tx5m = pair.txns?.m5 || {};

  return (
    ageHours <= 72 &&
    (tx24.buys || 0) >= 50 &&
    (tx24.sells || 0) >= 30 &&
    ((tx5m.buys || 0) + (tx5m.sells || 0)) >= 10
  );
}

/* ---------------------------------------------------
   HEURISTICS
--------------------------------------------------- */

function detectSnipers(pair) {
  const vol5m = pair.volume?.m5 || 0;
  const buys5m = pair.txns?.m5?.buys || 0;

  if (vol5m > 20000 && buys5m > 15) return "High";
  if (buys5m > 7) return "Medium";
  return "Low";
}

function estimateBundleRisk(pair) {
  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 1;
  const ratio = liquidity / mc;

  return Math.max(0, Math.min(100, (1 - ratio) * 100));
}

function detectTrending(pair) {
  const priceChange = pair.priceChange?.m5 || 0;
  const vol5m = pair.volume?.m5 || 0;

  return priceChange > 30 && vol5m > 15000;
}

/* ---------------------------------------------------
   ALPHA SCORING
--------------------------------------------------- */

function computeAlphaScore(pair, sniperLevel, bundleRisk) {
  let score = 0;

  const ageMinutes =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60);

  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 0;
  const vol5m = pair.volume?.m5 || 0;

  // Freshness
  if (ageMinutes < 5) score += 25;
  else if (ageMinutes < 15) score += 15;

  // Liquidity
  if (liquidity > 10000) score += 20;
  if (liquidity / (mc || 1) > 0.15) score += 10;

  // Volume
  if (vol5m > 10000) score += 15;

  // Sniper penalty
  if (sniperLevel === "High") score -= 15;

  // Bundle penalty
  if (bundleRisk > 60) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ---------------------------------------------------
   TELEGRAM ALERT
--------------------------------------------------- */

async function sendTelegram(tokenData) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const text = `
🔥 ${tokenData.trending ? "HOT" : "NEW"} ${tokenData.name}
🕒 Age: ${tokenData.age}m | Security: ✅
⭐ Alpha Score: ${tokenData.alpha}/100

💰 MC: $${tokenData.mc}
💧 Liq: $${tokenData.liq}
📈 Vol (5m): $${tokenData.vol}

📦 Bundles: ${tokenData.bundle}%
🔫 Snipers: ${tokenData.sniper}

🔗 https://dexscreener.com/solana/${tokenData.address}
`;

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML"
      }
    );
  } catch (err) {
    console.log("Telegram send error handled.");
  }
}

/* ---------------------------------------------------
   MAIN SCANNER LOOP
--------------------------------------------------- */

async function scan() {
  console.log("Scanning...");

  const pairs = await fetchDexPairs();
  if (!pairs) return;

  for (const pair of pairs) {
    if (!validPair(pair)) continue;
    if (discoveredPairs.has(pair.pairAddress)) continue;

    discoveredPairs.add(pair.pairAddress);

    const sniper = detectSnipers(pair);
    const bundle = estimateBundleRisk(pair);
    const trending = detectTrending(pair);
    const alpha = computeAlphaScore(pair, sniper, bundle);

    const ageMinutes = Math.round(
      (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
        (1000 * 60)
    );

    const tokenData = {
      name: pair.baseToken.symbol,
      address: pair.pairAddress,
      age: ageMinutes,
      mc: Math.round(pair.fdv || 0),
      liq: Math.round(pair.liquidity?.usd || 0),
      vol: Math.round(pair.volume?.m5 || 0),
      sniper,
      bundle: Math.round(bundle),
      trending,
      alpha
    };

    console.log(`${tokenData.name} | Alpha: ${alpha}`);

    if (alpha >= 80) {
      await sendTelegram(tokenData);
    }
  }
}

/* ---------------------------------------------------
   START ENGINE
--------------------------------------------------- */

setInterval(scan, SCAN_INTERVAL);
scan();

console.log("🚀 Solana Alpha Bot Running...");
