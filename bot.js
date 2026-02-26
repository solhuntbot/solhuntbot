require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 15000; // 15s for near real-time scanning
const discoveredPairs = new Set();

/* ===================================================== */

const api = axios.create({
  timeout: 8000,
  headers: { "User-Agent": "Solana-Early-Bot" }
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
   FETCH SOLANA PAIRS (LIVE PAIRS)
===================================================== */

async function fetchDexPairs() {
  const data = await safeRequest(
    "https://api.dexscreener.com/latest/dex/pairs/solana"
  );

  if (!data || !data.pairs) return [];
  return data.pairs;
}

/* =====================================================
   FILTER EARLY HIGH-VOLUME PAIRS
===================================================== */

function validEarlyPair(pair) {
  if (!pair.pairCreatedAt) return false;

  const ageMinutes = (Date.now() - new Date(pair.pairCreatedAt).getTime()) / (1000 * 60);

  const liquidity = pair.liquidity?.usd || 0;
  const vol5m = pair.volume?.m5 || 0;

  // EARLY ALERT: < 2 min, high volume, min liquidity $8,000
  return ageMinutes <= 2 && liquidity >= 8000 && vol5m >= 5000;
}

/* =====================================================
   HEURISTICS
===================================================== */

function detectSnipers(pair) {
  const vol5m = pair.volume?.m5 || 0;
  const buys5m = pair.txns?.m5?.buys || 0;

  if (vol5m > 20000 && buys5m > 10) return "High";
  if (buys5m > 5) return "Medium";
  return "Low";
}

function estimateBundleRisk(pair) {
  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 1;
  const ratio = liquidity / mc;
  return Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
}

function computeAlphaScore(pair, sniperLevel, bundleRisk) {
  let score = 0;
  const ageMinutes = (Date.now() - new Date(pair.pairCreatedAt).getTime()) / (1000 * 60);

  // Super early bonus
  if (ageMinutes <= 2) score += 30;
  else if (ageMinutes <= 5) score += 15;

  // Liquidity bonus
  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 0;
  if (liquidity >= 8000) score += 25;
  if (liquidity / (mc || 1) > 0.15) score += 10;

  // Volume bonus
  const vol5m = pair.volume?.m5 || 0;
  if (vol5m > 10000) score += 20;

  // Sniper & bundle penalties
  if (sniperLevel === "High") score -= 10;
  if (bundleRisk > 60) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* =====================================================
   TELEGRAM SENDER
===================================================== */

async function sendTelegram(token) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const message = `
🔥 EARLY ALERT ${token.name}
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
      { chat_id: CHAT_ID, text: message }
    );
    console.log(`✅ Telegram alert sent: ${token.name}`);
  } catch (err) {
    console.log("❌ Telegram error:", err.response?.data || err.message);
  }
}

/* =====================================================
   SCANNER LOOP
===================================================== */

async function scan() {
  console.log("Scanning Solana pairs...");

  const pairs = await fetchDexPairs();
  if (!pairs.length) return;

  for (const pair of pairs) {
    if (!validEarlyPair(pair)) continue;
    if (discoveredPairs.has(pair.pairAddress)) continue;

    discoveredPairs.add(pair.pairAddress);

    const sniper = detectSnipers(pair);
    const bundle = estimateBundleRisk(pair);
    const alpha = computeAlphaScore(pair, sniper, bundle);
    const ageMinutes = Math.round((Date.now() - new Date(pair.pairCreatedAt).getTime()) / (1000 * 60));

    const token = {
      name: pair.baseToken.symbol,
      age: ageMinutes,
      mc: Math.round(pair.fdv || 0),
      liq: Math.round(pair.liquidity?.usd || 0),
      vol: Math.round(pair.volume?.m5 || 0),
      sniper,
      bundle,
      trending: true,
      alpha,
      pairAddress: pair.pairAddress
    };

    console.log(`${token.name} | Alpha: ${alpha}`);

    // Send all tokens that meet early + liquidity + volume
    await sendTelegram(token);
  }
}

/* =====================================================
   START ENGINE
===================================================== */

console.log("🚀 Solana Early Alert Bot Running...");
setInterval(scan, SCAN_INTERVAL);
scan();
