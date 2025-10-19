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

// Test routes (for GET)
app.get("/", (req, res) => {
  res.json({ 
    message: "🚀 Shopify Telegram Webhook is running on Vercel!",
    status: "active",
    endpoints: ["/", "/api/webhook"],
    timestamp: new Date().toISOString()
  });
});

app.get("/api/webhook", (req, res) => {
  res.json({ 
    message: "🚀 Shopify Telegram Webhook API endpoint is active!",
    status: "ready",
    method: "POST",
    timestamp: new Date().toISOString()
  });
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

// Send Telegram message with error handling
async function sendTelegramMessage(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    throw new Error("Missing Telegram configuration: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text, 
        parse_mode: "Markdown",
        disable_web_page_preview: true
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Telegram API error: ${response.status} - ${errorData}`);
    }

    const result = await response.json();
    console.log("📱 Telegram response:", result);
    return result;
  } catch (error) {
    console.error("❌ Telegram send error:", error);
    throw error;
  }
}

// Shopify webhook POST handler for both root and /api/webhook
const handleWebhook = async (req, res) => {
  try {
    console.log("📨 Webhook received:", {
      method: req.method,
      headers: req.headers,
      bodyLength: req.body?.length || 0
    });

    const verified =
      process.env.VERCEL_ENV === "production" ? verifyWebhook(req) : true;

    if (!verified) {
      console.log("❌ Webhook verification failed");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const data = JSON.parse(req.body.toString("utf8"));
    console.log("✅ Verified webhook data:", {
      id: data.id,
      name: data.name,
      total: data.total_price,
      currency: data.currency
    });

    // Check if it's an order webhook
    if (data.id && data.name && data.total_price) {
      const message = `🛒 *New Shopify Order!*
*Order ID:* ${data.id}
*Name:* ${data.name}
*Total:* ${data.total_price} ${data.currency}
*Customer:* ${data.customer?.first_name || "Unknown"} ${data.customer?.last_name || ""}
*Email:* ${data.customer?.email || "N/A"}
*Status:* ${data.financial_status || "Unknown"}`;

      await sendTelegramMessage(message);
      console.log("📱 Telegram message sent successfully");
    } else {
      console.log("ℹ️ Non-order webhook received:", data);
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
};

// Handle POST requests on both routes
app.post("/", handleWebhook);
app.post("/api/webhook", handleWebhook);

export default app;
