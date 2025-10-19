import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import crypto from "crypto";
import fetch from "node-fetch";

dotenv.config();

const app = express();

// Shopify webhook requires RAW body for signature verification
app.use(express.raw({ type: "application/json" }));
app.use(cors());

// Test route (for GET)
app.get("/", (req, res) => {
  res.send("🚀 Shopify Telegram Webhook is running on Vercel!");
});

// Verify Shopify webhook
function verifyWebhook(req) {
  const hmacHeader = req.get("x-shopify-hmac-sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body, "utf8")
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(hmacHeader, "utf8")
    );
  } catch {
    return false;
  }
}

// Send Telegram message
async function sendTelegramMessage(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

// Shopify webhook POST handler
app.post("/", async (req, res) => {
  try {
    const verified =
      process.env.VERCEL_ENV === "production" ? verifyWebhook(req) : true;

    if (!verified) {
      console.log("❌ Webhook verification failed");
      return res.status(401).send("Unauthorized");
    }

    const data = JSON.parse(req.body.toString("utf8"));
    console.log("✅ Verified order:", data.id);

    const message = `🛒 *New Shopify Order!*
*Order ID:* ${data.id}
*Name:* ${data.name}
*Total:* ${data.total_price} ${data.currency}
*Customer:* ${data.customer?.first_name || "Unknown"} ${data.customer?.last_name || ""}`;

    await sendTelegramMessage(message);

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server Error");
  }
});

export default app;
