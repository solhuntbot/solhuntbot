require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

/* ===================================================== */

const connection = new Connection(RPC_URL, {
  commitment: "confirmed",
  wsEndpoint: RPC_URL.replace("https", "wss")
});

/* ===================================================== */
/* PUMP.FUN PROGRAM ID */
/* ===================================================== */

/*
Pump.fun Program ID (mainnet)
If this changes, update it.
*/

const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkzkRgZNpmjDoE7YQDdyCjTiMQuYzfoE"
);

/* ===================================================== */
/* TELEGRAM */
/* ===================================================== */

async function sendTelegram(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: message
      }
    );
    console.log("✅ Telegram alert sent");
  } catch (err) {
    console.log("Telegram error:", err.response?.data || err.message);
  }
}

/* ===================================================== */
/* LISTEN FOR NEW TOKEN CREATIONS */
/* ===================================================== */

console.log("🚀 Listening for Pump.fun token creations...");

connection.onLogs(
  PUMP_PROGRAM_ID,
  async (logInfo) => {
    try {
      const signature = logInfo.signature;

      const tx = await connection.getParsedTransaction(signature, {
        maxSupportedTransactionVersion: 0
      });

      if (!tx) return;

      const message = `
🚀 NEW PUMP.FUN TOKEN DETECTED

📝 Tx: ${signature}

🔗 https://solscan.io/tx/${signature}
`;

      await sendTelegram(message);

    } catch (err) {
      console.log("Listener error:", err.message);
    }
  },
  "confirmed"
);
