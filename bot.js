require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const HELIUS_RPC = process.env.HELIUS_RPC;

const RAYDIUM_PROGRAM = "RVKd61ztZW9g4vYtDqgW8sELpAo7P5PLf4KJc4j3gZ"; // Raydium AMM

const SCAN_INTERVAL = 15000;
const MIN_LIQUIDITY_USD = 8500;
const MIN_AGE_SECONDS = 120;      // 2 minutes
const MAX_AGE_SECONDS = 86400;    // 24 hours

let seenPools = new Set();

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

async function sendTelegram(message) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    );
  } catch (err) {
    console.error("Telegram error:", err.response?.data || err.message);
  }
}

async function heliusRPC(method, params) {
  try {
    const res = await axios.post(HELIUS_RPC, {
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    }, { timeout: 10000 });

    return res.data.result;
  } catch (err) {
    console.error("RPC error:", err.message);
    return null;
  }
}

async function getRecentRaydiumTx() {
  return await heliusRPC("getSignaturesForAddress", [
    RAYDIUM_PROGRAM,
    { limit: 25 }
  ]);
}

async function getTransaction(signature) {
  return await heliusRPC("getTransaction", [
    signature,
    { maxSupportedTransactionVersion: 0 }
  ]);
}

function estimateLiquidity(meta) {
  try {
    const balances = meta?.postTokenBalances || [];
    if (!balances.length) return 0;

    let total = 0;
    for (let b of balances) {
      if (b.uiTokenAmount?.uiAmount) {
        total += b.uiTokenAmount.uiAmount;
      }
    }

    return total * 0.01; // crude USD heuristic
  } catch {
    return 0;
  }
}

function formatAge(seconds) {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

function sniperHeuristic(txCount) {
  if (txCount > 40) return "High";
  if (txCount > 20) return "Medium";
  return "Low";
}

function bundleHeuristic(txCount) {
  return Math.min(70, Math.floor(txCount * 1.3));
}

async function scan() {
  try {
    const signatures = await getRecentRaydiumTx();
    if (!signatures) return;

    for (let sigObj of signatures) {
      if (seenPools.has(sigObj.signature)) continue;

      const tx = await getTransaction(sigObj.signature);
      if (!tx) continue;

      const blockTime = tx.blockTime;
      if (!blockTime) continue;

      const ageSeconds = Math.floor(Date.now() / 1000) - blockTime;
      if (ageSeconds < MIN_AGE_SECONDS) continue;
      if (ageSeconds > MAX_AGE_SECONDS) continue;

      const liquidity = estimateLiquidity(tx.meta);
      if (liquidity < MIN_LIQUIDITY_USD) continue;

      seenPools.add(sigObj.signature);

      const txCount = tx.meta?.logMessages?.length || 0;

      const message = `
🔥 <b>NEW RAYDIUM LAUNCH</b>

🕒 Age: ${formatAge(ageSeconds)}
💧 Liquidity (est): $${liquidity.toFixed(0)}
📊 Activity Score: ${txCount}

📦 Bundles (est): ${bundleHeuristic(txCount)}%
🔫 Snipers: ${sniperHeuristic(txCount)}

🔗 https://solscan.io/tx/${sigObj.signature}

⚡ Fresh pool detected on Raydium
      `;

      await sendTelegram(message);
    }

  } catch (err) {
    console.error("Scan error:", err.message);
  }
}

console.log("🚀 Raydium tracker running...");

setInterval(scan, SCAN_INTERVAL);
