import express from "express";
import webhookApp from "./api/webhook.js";

const app = express();

// Mount at /api/webhook
app.use("/api/webhook", webhookApp);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Local server running at http://localhost:${PORT}`);
});
