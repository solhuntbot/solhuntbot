require("dotenv").config();
const axios = require("axios");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.log("Missing BOT_TOKEN or CHAT_ID");
  process.exit(1);
}

async function sendTest() {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: CHAT_ID,
        text: "🚀 Bot is alive on Railway"
      }
    );
    console.log("Message sent successfully");
  } catch (err) {
    console.log("Telegram error:", err.message);
  }
}

console.log("Bot started...");
sendTest();

setInterval(() => {
  console.log("Still running...");
}, 10000);

process.on("unhandledRejection", (err) => {
  console.log("Unhandled:", err.message);
});

process.on("uncaughtException", (err) => {
  console.log("Crash prevented:", err.message);
});
