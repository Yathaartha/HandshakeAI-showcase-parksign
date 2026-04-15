import { config } from "../../config.js";

export async function createGroqResponse(payload) {
  if (!config.groqApiKey) {
    return null;
  }

  const response = await fetch("https://api.groq.com/openai/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.groqApiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq request failed: ${text}`);
  }

  return response.json();
}
