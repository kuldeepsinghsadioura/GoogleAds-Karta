const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");

const app = express();
const PORT = 3000;

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/kpi-karta", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

// KPI Schema
const kpiSchema = new mongoose.Schema({
  campaignId: String,
  impressions: Number,
  clicks: Number,
  cost: Number,
  updatedAt: Date,
});
const KPI = mongoose.model("KPI", kpiSchema);

// Replace with your access token & config
const GOOGLE_ADS_API_URL = "https://googleads.googleapis.com/v12/customers/YOUR_CUSTOMER_ID/googleAds:search";
const ACCESS_TOKEN = "YOUR_GOOGLE_ADS_ACCESS_TOKEN";

// Endpoint to update KPI from Google Ads
app.get("/update-kpis", async (req, res) => {
  try {
    const query = `
      SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM campaign
      WHERE segments.date DURING LAST_7_DAYS
    `;

    const response = await axios.post(
      GOOGLE_ADS_API_URL,
      { query },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const rows = response.data.results;

    // Update or insert KPIs in MongoDB
    for (const row of rows) {
      const { id } = row.campaign;
      const { impressions, clicks, costMicros } = row.metrics;

      await KPI.findOneAndUpdate(
        { campaignId: id },
        {
          impressions: Number(impressions),
          clicks: Number(clicks),
          cost: costMicros / 1e6, // Convert micros to standard currency
          updatedAt: new Date(),
        },
        { upsert: true, new: true }
      );
    }

    res.json({ message: "KPIs updated successfully", count: rows.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update KPIs", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
