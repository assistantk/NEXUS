import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Candle, Stock } from "./types";

const API_KEY = process.env.VITE_GOOGLE_API_KEY || '';
const ai = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const SYSTEM_INSTRUCTION = `
You are Nova, an elite AI Financial Analyst for a high-frequency trading platform. 
Your goal is to provide concise, data-driven insights on stock market trends.
You are analytical, objective, and professional, but accessible.

IMPORTANT RULES:
1. Always include a disclaimer: "Not financial advice."
2. Analyze technical indicators (RSI, MACD, Moving Averages) if data is provided.
3. Be concise. Use markdown for formatting.
4. If asked to predict, assess trends but emphasize uncertainty.
`;

export const getGeminiChatResponse = async (
  message: string, 
  currentStock: Stock, 
  contextData?: string
) => {
  try {
    if (!API_KEY || !ai) {
      console.warn('VITE_GOOGLE_API_KEY environment variable not set');
      return "API key not configured. Please set VITE_GOOGLE_API_KEY environment variable.";
    }

    if (!message || !currentStock) {
      return "Invalid input: message and currentStock are required.";
    }

    const model = ai.getGenerativeModel({ model: 'models/gemini-2.0-flash-exp' });
    
    let fullPrompt = `User Query: "${message}"\n\n`;
    fullPrompt += `Current Focus Stock: ${currentStock.symbol} (${currentStock.name}) Price: $${currentStock.price.toFixed(2)}\n`;
    
    if (contextData) {
      fullPrompt += `Recent Market Data Context: ${contextData}\n`;
    }

    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: fullPrompt }]
      }],
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.7,
      }
    };

    const response = await model.generateContent(request);
    const text = response.response?.text();
    if (!text) {
      throw new Error('Empty response from Gemini API');
    }
    return text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I'm currently unable to connect to the market analysis network. Please try again later.";
  }
};

export const generateAIPrediction = async (symbol: string, history: Candle[]) => {
  try {
    if (!API_KEY || !ai) {
      console.warn('VITE_GOOGLE_API_KEY environment variable not set');
      return null;
    }

    if (!symbol || !Array.isArray(history) || history.length === 0) {
      console.warn('Invalid input: symbol and non-empty history array are required');
      return null;
    }

    const model = ai.getGenerativeModel({ model: 'models/gemini-2.0-flash-exp' });
    
    // Filter history to ensure no previous predictions are included if the caller didn't filter
    const cleanHistory = history.filter(c => !c.isPrediction);
    
    if (cleanHistory.length === 0) {
      console.warn('No valid history data available after filtering predictions');
      return null;
    }
    
    // Simplify history to reduce token count for demo
    const simplifiedHistory = cleanHistory.slice(-20).map(c => {
      try {
        const dateStr = c.time.includes('T') ? c.time.split('T')[0] : c.time;
        return `${dateStr}: Close $${c.close.toFixed(2)}, Vol ${c.volume}`;
      } catch (e) {
        return `Close $${c.close.toFixed(2)}, Vol ${c.volume}`;
      }
    }).join('\n');

    const prompt = `
      Analyze the following 20-day price history for ${symbol}:
      ${simplifiedHistory}

      Perform a technical analysis simulation.
      Return a JSON object with the following structure:
      {
        "trend": "UP" | "DOWN" | "NEUTRAL",
        "confidence": number (0-100),
        "riskLevel": "LOW" | "MEDIUM" | "HIGH",
        "targetPrice": number (predicted price in 5 periods),
        "reasoning": "Short string explaining why (max 15 words)",
        "predictedPath": [number, number, number, number, number] (next 5 closing prices)
      }
    `;

    const request = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            trend: { type: SchemaType.STRING, enum: ["UP", "DOWN", "NEUTRAL"] },
            confidence: { type: SchemaType.NUMBER },
            riskLevel: { type: SchemaType.STRING, enum: ["LOW", "MEDIUM", "HIGH"] },
            targetPrice: { type: SchemaType.NUMBER },
            reasoning: { type: SchemaType.STRING },
            predictedPath: { 
              type: SchemaType.ARRAY, 
              items: { type: SchemaType.NUMBER } 
            }
          },
          required: ["trend", "confidence", "riskLevel", "targetPrice", "reasoning", "predictedPath"]
        }
      }
    };

    const response = await model.generateContent(request);
    let jsonString = response.response?.text() || '';
    
    if (!jsonString) {
      console.warn('Empty response from prediction API');
      return null;
    }
    
    // Remove markdown code blocks if present
    if (jsonString.includes('```json')) {
      jsonString = jsonString.replace(/```json/g, '').replace(/```/g, '');
    } else if (jsonString.includes('```')) {
      jsonString = jsonString.replace(/```/g, '');
    }
    
    jsonString = jsonString.trim();
    
    if (!jsonString) {
      console.warn('Response was empty after cleaning markdown');
      return null;
    }
    
    const result = JSON.parse(jsonString);
    return result;
  } catch (error) {
    console.error("Prediction Error:", error);
    return null;
  }
};