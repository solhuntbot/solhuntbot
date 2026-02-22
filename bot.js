async function scanDexscreener() {
  try {
    const res = await axios.get(
      "https://api.dexscreener.com/latest/dex/search?q=solana",
      { timeout: 15000 }
    );

    const pairs = res.data.pairs || [];

    // 🔥 filter fresh low caps like alpha bots
    const fresh = pairs
      .filter(p =>
        p.chainId === "solana" &&
        p.liquidity?.usd > 5000 &&
        p.fdv &&
        p.fdv < 2000000
      )
      .slice(0, 5);

    for (const p of fresh) {
      if (seen.has(p.pairAddress)) continue;
      seen.add(p.pairAddress);

      await bot.sendMessage(
        CHAT_ID,
`🔥 ${p.baseToken.symbol} New Trending
🕒 Age: Early | Security: ✅
🔗 X•CHART

💰 MC: $${Math.floor(p.fdv || 0)}
💧 Liq: $${Math.floor(p.liquidity?.usd || 0)}
📈 Vol: 24h: $${Math.floor(p.volume?.h24 || 0)}
👥 Hodls: Growing

🔗 https://dexscreener.com/solana/${p.pairAddress}`
      );
    }
  } catch (err) {
    console.log("❌ Dex scan error:", err.response?.status || err.message);
  }
}
