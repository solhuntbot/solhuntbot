require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 20000;
const discoveredPairs = new Set();

/* ===================================================== */

const api = axios.create({
  timeout: 8000,
  headers: { "User-Agent": "Solana-Alpha-Bot" }
});

async function safeRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await api.get(url);
      return res.data;
    } catch (err) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  return null;
}

/* =====================================================
   ✅ CORRECT DEXSCREENER ENDPOINT
===================================================== */

async function fetchDexPairs() {
  const data = await safeRequest(
    "https://api.dexscreener.com/latest/dex/pairs/solana"
  );

  if (!data || !data.pairs) return [];

  return data.pairs;
}

/* ===================================================== */

function validPair(pair) {
  if (!pair.pairCreatedAt) return false;

  const ageHours =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60 * 60);

  const tx24 = pair.txns?.h24 || {};
  const tx5m = pair.txns?.m5 || {};

  return (
    ageHours <= 48 &&
    (tx24.buys || 0) >= 20 &&
    (tx24.sells || 0) >= 10 &&
    ((tx5m.buys || 0) + (tx5m.sells || 0)) >= 5
  );
}

function detectSnipers(pair) {
  const vol5m = pair.volume?.m5 || 0;
  const buys5m = pair.txns?.m5?.buys || 0;

  if (vol5m > 15000 && buys5m > 10) return "High";
  if (buys5m > 5) return "Medium";
  return "Low";
}

function estimateBundleRisk(pair) {
  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 1;
  const ratio = liquidity / mc;

  return Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
}

function detectTrending(pair) {
  const priceChange = pair.priceChange?.m5 || 0;
  const vol5m = pair.volume?.m5 || 0;

  return priceChange > 15 && vol5m > 8000;
}

function computeAlphaScore(pair, sniperLevel, bundleRisk) {
  let score = 0;

  const ageMinutes =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60);

  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 0;
  const vol5m = pair.volume?.m5 || 0;

  if (ageMinutes < 10) score += 20;
  else if (ageMinutes < 30) score += 10;

  if (liquidity > 5000) score += 15;
  if (liquidity / (mc || 1) > 0.1) score += 10;

  if (vol5m > 8000) score += 15;

  if (sniperLevel === "High") score -= 10;
  if (bundleRisk > 70) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* ===================================================== */

async function sendTelegram(token) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const message = `
🔥 ${token.trending ? "HOT" : "NEW"} ${token.name}
🕒 Age: ${token.age}m
⭐ Alpha Score: ${token.alpha}/100

💰 MC: $${token.mc}
💧 Liq: $${token.liq}
📈 Vol (5m): $${token.vol}

📦 Bundles: ${token.bundle}%
🔫 Snipers: ${token.sniper}

🔗 https://dexscreener.com/solana/${token.pairAddress}
`;

  try {
    await api.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message
      }
    );
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

/* ===================================================== */

async function scan() {
  console.log("Scanning Solana pairs...");

  const pairs = await fetchDexPairs();
  if (!pairs.length) return;

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

    const token = {
      name: pair.baseToken.symbol,
      age: ageMinutes,
      mc: Math.round(pair.fdv || 0),
      liq: Math.round(pair.liquidity?.usd || 0),
      vol: Math.round(pair.volume?.m5 || 0),
      sniper,
      bundle,
      trending,
      alpha,
      pairAddress: pair.pairAddress
    };

    console.log(`${token.name} | Alpha: ${alpha}`);

    if (alpha >= 60) {
      await sendTelegram(token);
    }
  }
}

/* ===================================================== */

console.log("🚀 Solana Alpha Bot Running...");
setInterval(scan, SCAN_INTERVAL);
scan();
