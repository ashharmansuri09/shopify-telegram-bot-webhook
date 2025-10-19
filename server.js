import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import crypto from "crypto";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for Shopify webhook (RAW body required)
app.use("/webhook", express.raw({ type: "application/json" }));

// Enable CORS for testing
app.use(cors());

// Root route
app.get("/", (req, res) => {
  res.send("🚀 Shopify Telegram Webhook is running!");
});

// Verify webhook authenticity
function verifyWebhook(req) {
  const hmacHeader = req.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body, "utf8")
    .digest("base64");

  const verified = crypto.timingSafeEqual(
    Buffer.from(digest, "utf8"),
    Buffer.from(hmacHeader, "utf8")
  );

  return verified;
}

// Send Telegram Message
async function sendTelegramMessage(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
}

// Shopify webhook endpoint
app.post("/webhook", async (req, res) => {
  try {
    const verified = verifyWebhook(req);
    if (!verified) {
      console.log("❌ Webhook verification failed");
      return res.status(401).send("Unauthorized");
    }

    const data = JSON.parse(req.body.toString("utf8"));
    console.log("✅ Verified order received:", data.id);

    const message = `🛒 *New Shopify Order!*\n\n*Order ID:* ${data.id}\n*Name:* ${data.name}\n*Total:* ${data.total_price} ${data.currency}\n*Customer:* ${data.customer?.first_name || "Unknown"} ${data.customer?.last_name || ""}`;

    await sendTelegramMessage(message);

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
