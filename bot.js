require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const RPC_HTTP = "https://mainnet.helius-rpc.com/?api-key=52623cc2-9cfb-4ffe-a82e-4a05f8bde2a0";
const RPC_WSS  = "wss://mainnet.helius-rpc.com/?api-key=52623cc2-9cfb-4ffe-a82e-4a05f8bde2a0";

/* ===================================================== */
/* CONNECTION */
/* ===================================================== */

const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WSS
});

/* ===================================================== */
/* PUMP.FUN PROGRAM ID (MAINNET VERIFIED) */
/* ===================================================== */

const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkzkRgZNpmjDoE7YQDdyCjTiMQuYzfoE"
);

/* ===================================================== */
/* TELEGRAM */
/* ===================================================== */

async function sendTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text
      }
    );
    console.log("✅ Telegram sent");
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

/* ===================================================== */
/* SAFE LISTENER */
/* ===================================================== */

console.log("🚀 Pump.fun On-Chain Listener Running...");

connection.onLogs(
  PUMP_PROGRAM_ID,
  async (logInfo) => {
    try {
      const signature = logInfo.signature;

      if (!signature) return;

      const message = `
🚀 NEW PUMP.FUN ACTIVITY DETECTED

📝 Tx:
https://solscan.io/tx/${signature}
`;

      await sendTelegram(message);

    } catch (err) {
      console.log("Listener error:", err.message);
    }
  },
  "confirmed"
);

/* ===================================================== */
/* KEEP PROCESS ALIVE */
/* ===================================================== */

process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err.message);
});

process.on("uncaughtException", (err) => {
  console.log("Uncaught exception:", err.message);
});
