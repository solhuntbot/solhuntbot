require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const SCAN_INTERVAL = 20000; // 20 seconds
const discoveredPairs = new Set();

/* =====================================================
   AXIOS INSTANCE
===================================================== */

const api = axios.create({
  timeout: 8000,
  headers: {
    "User-Agent": "Solana-Alpha-Bot"
  }
});

async function safeRequest(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await api.get(url);
      return res.data;
    } catch (err) {
      const status = err.response?.status;

      if ([403, 404, 429, 530].includes(status)) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

/* =====================================================
   FETCH SOLANA PAIRS
===================================================== */

async function fetchDexPairs() {
  const data = await safeRequest(
    "https://api.dexscreener.com/latest/dex/search/?q=solana"
  );

  if (!data || !data.pairs) return [];

  return data.pairs.filter(p => p.chainId === "solana");
}

/* =====================================================
   FILTER RULES
===================================================== */

function validPair(pair) {
  if (!pair.pairCreatedAt) return false;

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

/* =====================================================
   HEURISTICS
===================================================== */

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

  return Math.max(0, Math.min(100, Math.round((1 - ratio) * 100)));
}

function detectTrending(pair) {
  const priceChange = pair.priceChange?.m5 || 0;
  const vol5m = pair.volume?.m5 || 0;

  return priceChange > 30 && vol5m > 15000;
}

/* =====================================================
   ALPHA SCORING
===================================================== */

function computeAlphaScore(pair, sniperLevel, bundleRisk) {
  let score = 0;

  const ageMinutes =
    (Date.now() - new Date(pair.pairCreatedAt).getTime()) /
    (1000 * 60);

  const liquidity = pair.liquidity?.usd || 0;
  const mc = pair.fdv || 0;
  const vol5m = pair.volume?.m5 || 0;

  if (ageMinutes < 5) score += 25;
  else if (ageMinutes < 15) score += 15;

  if (liquidity > 10000) score += 20;
  if (liquidity / (mc || 1) > 0.15) score += 10;

  if (vol5m > 10000) score += 15;

  if (sniperLevel === "High") score -= 15;
  if (bundleRisk > 60) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* =====================================================
   TELEGRAM SENDER
===================================================== */

async function sendTelegram(token) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("❌ BOT_TOKEN or CHAT_ID missing.");
    return;
  }

  const message = `
🔥 ${token.trending ? "HOT" : "NEW"} ${token.name}
🕒 Age: ${token.age}m | Security: ✅
⭐ Alpha Score: ${token.alpha}/100

💰 MC: $${token.mc}
💧 Liq: $${token.liq}
📈 Vol (5m): $${token.vol}

📦 Bundles: ${token.bundle}%
🔫 Snipers: ${token.sniper}

🔗 https://dexscreener.com/solana/${token.address}
`;

  try {
    await api.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message
      }
    );

    console.log("✅ Telegram alert sent.");
  } catch (err) {
    console.log("❌ Telegram error:", err.response?.data || err.message);
  }
}

/* =====================================================
   MAIN SCANNER
===================================================== */

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
      address: pair.pairAddress,
      age: ageMinutes,
      mc: Math.round(pair.fdv || 0),
      liq: Math.round(pair.liquidity?.usd || 0),
      vol: Math.round(pair.volume?.m5 || 0),
      sniper,
      bundle,
      trending,
      alpha
    };

    console.log(`${token.name} | Alpha: ${alpha}`);

    if (alpha >= 80) {
      await sendTelegram(token);
    }
  }
}

/* =====================================================
   START ENGINE
===================================================== */

console.log("🚀 Solana Alpha Bot Running...");

/* ===== TELEGRAM TEST MESSAGE (STEP 4 AUTO TEST) ===== */

sendTelegram({
  name: "SYSTEM TEST",
  age: 1,
  alpha: 99,
  mc: 10000,
  liq: 5000,
  vol: 2000,
  bundle: 10,
  sniper: "Low",
  trending: true,
  address: "test"
});

setInterval(scan, SCAN_INTERVAL);
scan();
