require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RPC_HTTP = process.env.RPC_HTTP;

if (!BOT_TOKEN || !CHAT_ID || !RPC_HTTP) {
  console.log("Missing BOT_TOKEN, CHAT_ID, or RPC_HTTP in .env");
  process.exit(1);
}

const connection = new Connection(RPC_HTTP, "confirmed");

const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkzkRgZNpmjDoE7YQDdyCjTiMQuYzfoE"
);

const seenSignatures = new Set();

async function sendTelegram(text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      { chat_id: CHAT_ID, text }
    );
    console.log("✅ Telegram alert sent");
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

async function scanPumpFun() {
  try {
    console.log("Scanning Pump.fun transactions...");
    const signatures = await connection.getSignaturesForAddress(
      PUMP_PROGRAM_ID,
      { limit: 10 }
    );

    for (const sig of signatures) {
      if (seenSignatures.has(sig.signature)) continue;
      seenSignatures.add(sig.signature);

      await sendTelegram(
        `🚀 Pump.fun Activity Detected\nhttps://solscan.io/tx/${sig.signature}`
      );
    }
  } catch (err) {
    console.log("Scan error:", err.message);
  }
}

console.log("🚀 Pump.fun HTTP Polling Bot Running...");
scanPumpFun();
setInterval(scanPumpFun, 12000);

process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err.message);
});
process.on("uncaughtException", (err) => {
  console.log("Uncaught exception:", err.message);
});
