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

// Connection to Solana via Helius HTTP RPC (Railway-safe)
const connection = new Connection(RPC_HTTP, "confirmed");

// Pump.fun mainnet program ID
const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkzkRgZNpmjDoE7YQDdyCjTiMQuYzfoE"
);

// Keep track of already alerted transactions
const seenSignatures = new Set();

// Send Telegram alert
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

// Poll Pump.fun transactions
async function scanPumpFun() {
  try {
    console.log("Scanning Pump.fun transactions...");

    const signatures = await connection.getSignaturesForAddress(
      PUMP_PROGRAM_ID,
      { limit: 15 } // fetch last 15 txs
    );

    for (const sig of signatures) {
      if (seenSignatures.has(sig.signature)) continue;
      seenSignatures.add(sig.signature);

      // Send alert for each new transaction
      const message = `
🚀 NEW Pump.fun ACTIVITY DETECTED
📝 Tx: https://solscan.io/tx/${sig.signature}
⏱ Time: ${new Date(sig.blockTime * 1000).toLocaleString()}
`;
      await sendTelegram(message);
    }
  } catch (err) {
    console.log("Scan error:", err.message);
  }
}

// Start bot
console.log("🚀 Pump.fun Safe Alpha Bot Running...");
scanPumpFun();
setInterval(scanPumpFun, 12000); // every 12 seconds

// Prevent crashes
process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err.message);
});
process.on("uncaughtException", (err) => {
  console.log("Uncaught exception:", err.message);
});
