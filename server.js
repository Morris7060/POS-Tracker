// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch"; // Needed if Node < 18

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: "*" })); // allow requests from frontend
app.use(express.json());

// POST /ask endpoint for POS AI Assistant
app.post("/ask", async (req, res) => {
  const { message, context } = req.body;

  if (!message) return res.status(400).json({ reply: "No message provided." });

  try {
    // Example Groq/Gemini API call
    const apiResponse = await fetch("https://api.groq.com/v1/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.API_KEY}`
      },
      body: JSON.stringify({
        prompt: `
You are a POS Assistant for Blue Star POS Tracking System.
Answer user questions about agents, supervisors, POS devices, or reports.
Use this system data as context:

${JSON.stringify(context, null, 2)}

User asked: "${message}"
Respond concisely and clearly.
        `,
        model: "llama-3.3-70b-versatile", // replace with your enabled Groq/Gemini model
        temperature: 0.5,
        max_tokens: 500
      })
    });

    const data = await apiResponse.json();

    // Extract the AI reply (depends on API structure)
    const reply = data?.choices?.[0]?.text || data?.reply || "Sorry, I am still under Development.";

    res.json({ reply });
  } catch (error) {
    console.error("AI API error:", error);
    res.json({ reply: "Sorry, something went wrong with the assistant." });
  }
});

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Blue Star POS Assistant Server is running 🚀");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// Example in-memory data (replace with DB queries)
const supervisorsData = [
  {
    supervisor_id: 1,
    supervisor: "Alice Johnson",
    agents: [
      { agent_id: 101, name: "Agent A1", contact: "123-456" },
      { agent_id: 102, name: "Agent A2", contact: "234-567" }
    ]
  },
  {
    supervisor_id: 2,
    supervisor: "Bob Smith",
    agents: [
      { agent_id: 201, name: "Agent B1", contact: "345-678" }
    ]
  },
  {
    supervisor_id: 3,
    supervisor: "Carol Lee",
    agents: [] // no agents
  }
];

// API endpoint
app.get('/api/supervisors-with-agents', (req, res) => {
  res.json(supervisorsData);
});
