const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

require("dotenv").config();
const fallbackQuotes = require("./fallback.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Create favorites table if it doesn't exist
async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorite_quotes (
        id SERIAL PRIMARY KEY,
        quote TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Favorite quotes table is ready.");
  } catch (error) {
    console.error("Database error:", error);
  }
}

createTable();

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Get random quote
app.get("/api/quote", async (req, res) => {
  try {
    const response = await fetch(
      "https://quotely.lol/api/v1/random"
    );

    if (!response.ok) {
      throw new Error("Quote API failed");
    }

    const result = await response.json();

    const data = result.data;

    if (!data || !data.quote || !data.author) {
      throw new Error("Invalid quote response");
    }

    res.json({
      quote: data.quote,
      author: data.author
    });

  } catch (error) {
    console.error("Quote API error:", error);

    const randomIndex = Math.floor(
      Math.random() * fallbackQuotes.length
    );

    const fallback = fallbackQuotes[randomIndex];

    res.json({
      quote: fallback.text,
      author: fallback.author
    });
  }
});
// Save favorite quote
app.post("/api/favorites", async (req, res) => {
  try {
    const { quote, author } = req.body;

    if (!quote || !author) {
      return res.status(400).json({
        error: "Quote and author are required"
      });
    }

    const result = await pool.query(
      "INSERT INTO favorite_quotes (quote, author) VALUES ($1, $2) RETURNING *",
      [quote, author]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error("Favorite save error:", error);
    res.status(500).json({
      error: "Unable to save favorite"
    });
  }
});
// Get all favorite quotes
app.get("/api/favorites", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM favorite_quotes ORDER BY created_at DESC"
    );

    res.json(result.rows);

  } catch (error) {
    console.error("Fetch favorites error:", error);

    res.status(500).json({
      error: "Unable to fetch favorites"
    });
  }
});
// Delete favorite quote
app.delete("/api/favorites/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM favorite_quotes WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Favorite not found"
      });
    }

    res.json({
      message: "Favorite deleted successfully"
    });

  } catch (error) {
    console.error("Delete favorite error:", error);

    res.status(500).json({
      error: "Unable to delete favorite"
    });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
