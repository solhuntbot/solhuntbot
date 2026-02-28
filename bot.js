require("dotenv").config();
const { Connection, PublicKey } = require("@solana/web3.js");
const TelegramBot = require("node-telegram-bot-api");

const connection = new Connection(process.env.RPC_URL, "confirmed");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

const CHAT_ID = process.env.CHAT_ID;

// Program IDs
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RAYDIUM_PROGRAM = new PublicKey("RVKd61ztZW9nXvTnHQYaWV7kngakdUSHh3DquynjUTdu");
const PUMP_PROGRAM = new PublicKey("6EF8rrecthR5DkZCzwrp7UpC9B4ZLwhtqof5cDkWwM");

// Keep track of already sent transactions
const sentTx = new Set();

async function sendAlert(message) {
  try {
    await bot.sendMessage(CHAT_ID, message);
  } catch (err) {
    console.log("Telegram send error:", err.message);
  }
}

// --- SPL Token Mint Listener ---
connection.onLogs(TOKEN_PROGRAM, async (logInfo) => {
  if (sentTx.has(logInfo.signature)) return;
  sentTx.add(logInfo.signature);

  try {
    const tx = await connection.getParsedTransaction(logInfo.signature, { maxSupportedTransactionVersion: 0 });
    if (!tx) return;

    tx.transaction.message.instructions.forEach((ix) => {
      if (ix.program === "spl-token" && ix.parsed?.type === "initializeMint") {
        const mint = ix.parsed.info.mint;
        sendAlert(`🧪 NEW TOKEN MINT\nMint: ${mint}\nhttps://solscan.io/tx/${logInfo.signature}`);
      }
    });
  } catch (err) {
    console.log("Mint listener error:", err.message);
  }
}, "confirmed");

// --- Raydium Liquidity Listener ---
connection.onLogs(RAYDIUM_PROGRAM, async (logInfo) => {
  if (sentTx.has(logInfo.signature)) return;
  sentTx.add(logInfo.signature);

  sendAlert(`💧 Raydium Liquidity Event\nhttps://solscan.io/tx/${logInfo.signature}`);
}, "confirmed");

// --- Pump.fun Listener ---
connection.onLogs(PUMP_PROGRAM, async (logInfo) => {
  if (sentTx.has(logInfo.signature)) return;
  sentTx.add(logInfo.signature);

  sendAlert(`🔥 Pump.fun Launch Detected\nhttps://solscan.io/tx/${logInfo.signature}`);
}, "confirmed");

console.log("🚀 Solana Launch Intelligence Bot Running...");
