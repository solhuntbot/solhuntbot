require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const RPC_HTTP = process.env.RPC_HTTP;
const RPC_WSS = process.env.RPC_WSS;

if (!RPC_HTTP || !RPC_WSS) {
  console.log("Missing RPC endpoints in environment variables");
  process.exit(1);
}

const connection = new Connection(RPC_HTTP, {
  commitment: "confirmed",
  wsEndpoint: RPC_WSS
});

/* Pump.fun Program ID */
const PUMP_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkzkRgZNpmjDoE7YQDdyCjTiMQuYzfoE"
);

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
    console.log("Alert sent");
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

console.log("Listening for Pump.fun activity...");

connection.onLogs(
  PUMP_PROGRAM_ID,
  async (logInfo) => {
    try {
      if (!logInfo.signature) return;

      await sendTelegram(
        `🚀 Pump.fun Activity\nhttps://solscan.io/tx/${logInfo.signature}`
      );
    } catch (err) {
      console.log("Listener error:", err.message);
    }
  },
  "confirmed"
);

process.on("unhandledRejection", (err) => {
  console.log("Unhandled:", err.message);
});

process.on("uncaughtException", (err) => {
  console.log("Crash prevented:", err.message);
});
