require("dotenv").config();
const axios = require("axios");

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const HELIUS_RPC = process.env.HELIUS_RPC;

const RAYDIUM_PROGRAM = "RVKd61ztZW9g4vYtDqgW8sELpAo7P5PLf4KJc4j3gZ";

const SCAN_INTERVAL = 15000;
const MIN_AGE_SECONDS = 120;      // 2 minutes
const MAX_AGE_SECONDS = 86400;    // 24 hours
const MIN_ACTIVITY_SCORE = 10;   // basic tx activity filter

let seen = new Set();

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
    const res = await axios.post(
      HELIUS_RPC,
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params
      },
      { timeout: 10000 }
    );

    return res.data.result;
  } catch (err) {
    console.error("RPC error:", err.message);
    return null;
  }
}

function formatAge(seconds) {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h`;
}

function sniperHeuristic(activity) {
  if (activity > 40) return "High";
  if (activity > 20) return "Medium";
  return "Low";
}

function bundleHeuristic(activity) {
  return Math.min(70, Math.floor(activity * 1.2));
}

async function scan() {
  try {
    const signatures = await heliusRPC("getSignaturesForAddress", [
      RAYDIUM_PROGRAM,
      { limit: 20 }
    ]);

    if (!signatures) return;

    for (let sigObj of signatures) {
      if (seen.has(sigObj.signature)) continue;

      const tx = await heliusRPC("getTransaction", [
        sigObj.signature,
        { maxSupportedTransactionVersion: 0 }
      ]);

      if (!tx || !tx.blockTime) continue;

      const ageSeconds = Math.floor(Date.now() / 1000) - tx.blockTime;

      if (ageSeconds < MIN_AGE_SECONDS) continue;
      if (ageSeconds > MAX_AGE_SECONDS) continue;

      const activityScore = tx.meta?.logMessages?.length || 0;
      if (activityScore < MIN_ACTIVITY_SCORE) continue;

      seen.add(sigObj.signature);

      const message = `
🔥 <b>RAYDIUM ACTIVITY DETECTED</b>

🕒 Age: ${formatAge(ageSeconds)}
📊 Activity Score: ${activityScore}

📦 Bundles (est): ${bundleHeuristic(activityScore)}%
🔫 Snipers: ${sniperHeuristic(activityScore)}

🔗 https://solscan.io/tx/${sigObj.signature}

⚡ Early Raydium movement detected
      `;

      await sendTelegram(message);
    }
  } catch (err) {
    console.error("Scan error:", err.message);
  }
}

console.log("🚀 Raydium tracker running...");

setInterval(scan, SCAN_INTERVAL);
