import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Support large image payloads (screenshots can be several MBs in base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for Gemini client to prevent crashes if key is absent
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Image Trade OCR & Extraction Endpoint with Multi-Model Fallback & Automatic Retry
app.post("/api/extract-trades-from-image", async (req, res) => {
  const attemptLogs: Array<{ model: string; error: string }> = [];
  try {
    const { imageBase64, mimeType = "image/jpeg", userNotes } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: "تصویر ارسال نشده است (No image provided).",
      });
    }

    // Robust base64 string cleaning and MIME type detection
    let cleanBase64 = imageBase64;
    let effectiveMime = mimeType || "image/jpeg";

    const base64Marker = ";base64,";
    const markerIndex = imageBase64.indexOf(base64Marker);
    if (markerIndex !== -1) {
      const mimePart = imageBase64.substring(0, markerIndex);
      if (mimePart.startsWith("data:")) {
        effectiveMime = mimePart.substring(5).split(";")[0].trim() || effectiveMime;
      }
      cleanBase64 = imageBase64.substring(markerIndex + base64Marker.length);
    } else if (imageBase64.startsWith("data:")) {
      cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, "");
    }
    cleanBase64 = cleanBase64.trim().replace(/\s+/g, "");

    const ai = getGeminiClient();

    const promptText = `
You are an expert financial and cryptocurrency trade auditor and OCR vision model.
Carefully inspect this uploaded screenshot of a trade order history table, fill list, or exchange transaction report (from exchanges like Wallex, Nobitex, Tabdeal, Binance, KuCoin, BingX, etc.).

CRITICAL REQUIREMENT - MULTI-CURRENCY & BUY/SELL SIDES:
The screenshot may contain trades for MULTIPLE DIFFERENT CRYPTOCURRENCIES / TOKENS (e.g. ARB / Arbitrum, BTC, ETH, TON, ICP, SOL, SHIB, DOGE, etc.) AND both BUY (خرید) and SELL (فروش) transactions!
You MUST inspect each row independently and identify:
1. The EXACT cryptocurrency symbol for EACH individual trade row (e.g., ARB for Arbitrum, BTC for Bitcoin).
2. The EXACT trade SIDE ("BUY" for خرید / سبز, or "SELL" for فروش / قرمز).
DO NOT group, sum, or lump different coins or BUY and SELL together! A BUY of 13,757 and a SELL of 13,757 are TWO SEPARATE rows with opposite sides, NEVER sum them into 27,514! Each row must preserve its exact original quantity and side.

CRITICAL FEE RULES (IRANIAN & GLOBAL EXCHANGES - WALLEX, NOBITEX, BINANCE, ETC.):
- In BUY trades (خرید): Fee is almost always deducted from the purchased cryptocurrency asset (COIN) — e.g. buying BTC deducts 0.0002 BTC or buying ICP deducts 0.02 ICP.
- In SELL trades (فروش): Fee is almost always deducted from the received quote currency (CURRENCY) — e.g. selling BTC in the TMN or USDT market deducts تومان / TMN or USDT from the proceeds.
- If a row explicitly shows the fee asset or symbol (e.g. "0.002 BTC", "15,000 TMN", "1.2 USDT"), identify it accurately as "COIN" (base asset) or "CURRENCY" (quote currency).

Your task is to extract all trade rows accurately:
1. For EACH individual trade row, identify:
   - "symbol": The specific base cryptocurrency asset symbol for THIS row (e.g., "BTC", "ETH", "ICP", "TON", "SOL", "SHIB", "DOGE"). If the row displays a trading pair like "BTC/TMN" or "BTC/USDT" or "ICP / تومان", extract just the base coin symbol (e.g., "BTC", "ICP", "TON"). Convert to standard uppercase letters.
   - "side": "BUY" for خرید / Buy, or "SELL" for فروش / Sell. Be very careful: look at badges, colors (green=BUY, red=SELL), or text (خرید / فروش / Buy / Sell).
   - "currency": The quote currency for this row: "TMN" for تومان / Toman, "USD" for Tether / USDT / $, or "IRR" for Rial. If in doubt and numbers are in hundreds of thousands or millions (e.g., 710,000 or 75,000), default to "TMN".
   - "price": Unit price per coin (e.g., 710000). Convert Persian digits (۰-۹) and remove thousand commas.
   - "quantity": The volume or amount of coins purchased or traded for that row (e.g., 10, 0.05, 12.5).
   - "fee": The transaction fee amount (e.g., 0.02 or 1400).
   - "feeUnit": Specify "COIN" if the fee is deducted in the cryptocurrency itself (e.g. 0.02 ICP), or "CURRENCY" if fee is in quote currency (e.g. تومان / TMN / USDT). If unclear: for BUY set "COIN", for SELL set "CURRENCY".
   - "total": The total turnover/spend amount if explicitly shown on that row (optional).
   - "date": Date and time string if visible (optional).
   - "orderId": Order ID or tracking number if visible (optional).

2. Return "detectedAssets": An array of all distinct crypto asset symbols found in the trades (e.g. ["ICP", "TON"]).
3. "detectedSymbol": The primary or first asset symbol detected.
4. "detectedCurrency": The primary quote currency detected ("TMN" or "USD").

${userNotes ? `User Note: ${userNotes}` : ""}

Precision rules:
- Pay extreme attention to decimals like 0.002, 0.02, 0/02, ۰٫۰۲.
- Ensure "price", "quantity", and "fee" are positive numbers.
- Return structured JSON matching the provided schema.
`;

    // Candidate models in priority order. Verified healthy models first
    const CANDIDATE_MODELS = [
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
    ];
    
    let lastError: any = null;
    let response = null;
    let usedModel = "";

    for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
      const modelName = CANDIDATE_MODELS[i];
      try {
        console.log(`Attempting OCR with model: ${modelName} (attempt ${i + 1}/${CANDIDATE_MODELS.length})`);
        
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: effectiveMime,
                  data: cleanBase64,
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedAssets: {
                  type: Type.ARRAY,
                  description: "Array of all distinct crypto asset symbols found in the image (e.g. ['ICP', 'TON'])",
                  items: {
                    type: Type.STRING,
                  },
                },
                detectedSymbol: {
                  type: Type.STRING,
                  description: "The primary crypto symbol detected, e.g., ICP, BTC, ETH, SOL",
                },
                detectedCurrency: {
                  type: Type.STRING,
                  description: "The quote currency detected: TMN, USD, USDT, or IRR",
                },
                exchangeName: {
                  type: Type.STRING,
                  description: "Name of the exchange if visible (e.g., Wallex, Nobitex, Binance)",
                },
                trades: {
                  type: Type.ARRAY,
                  description: "Array of extracted trades with individual symbol per trade",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      symbol: {
                        type: Type.STRING,
                        description: "The specific base cryptocurrency symbol for THIS trade row (e.g., ICP, TON, BTC, ETH)",
                      },
                      currency: {
                        type: Type.STRING,
                        description: "Quote currency for this trade: TMN or USD",
                      },
                      price: {
                        type: Type.NUMBER,
                        description: "Unit trade price",
                      },
                      quantity: {
                        type: Type.NUMBER,
                        description: "Quantity or volume of coin traded",
                      },
                      fee: {
                        type: Type.NUMBER,
                        description: "Fee value",
                      },
                      feeUnit: {
                        type: Type.STRING,
                        description: "COIN or CURRENCY",
                      },
                      side: {
                        type: Type.STRING,
                        description: "BUY or SELL",
                      },
                      total: {
                        type: Type.NUMBER,
                        description: "Total spend if present",
                      },
                      date: {
                        type: Type.STRING,
                        description: "Date string if present",
                      },
                      orderId: {
                        type: Type.STRING,
                        description: "Order number or transaction ID",
                      },
                    },
                    required: ["symbol", "price", "quantity", "fee", "side"],
                  },
                },
                confidenceNotes: {
                  type: Type.STRING,
                  description: "Brief note about extraction confidence or table layout",
                },
              },
              required: ["detectedSymbol", "detectedCurrency", "trades"],
            },
          },
        });

        usedModel = modelName;
        break; // Successfully got response
      } catch (err: any) {
        lastError = err;
        const errDesc = err?.message || String(err || "");
        console.warn(`Model ${modelName} failed (attempt ${i + 1}/${CANDIDATE_MODELS.length}):`, errDesc);
        attemptLogs.push({ model: modelName, error: errDesc });
        
        if (i < CANDIDATE_MODELS.length - 1) {
          // Wait briefly before trying fallback model
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to process image across all model endpoints.");
    }

    const jsonText = response.text || "{}";
    let parsedData = JSON.parse(jsonText);

    // Normalize and ensure per-trade symbol and quote currency separation
    const primarySym = (parsedData.detectedSymbol || "CRYPTO").toUpperCase().replace(/[^A-Z0-9]/g, "") || "CRYPTO";
    const primaryCurr = (parsedData.detectedCurrency || "TMN").toUpperCase().includes("USD") ? "USD" : "TMN";

    const normalizedTrades = (parsedData.trades || []).map((t: any) => {
      let sym = t.symbol ? String(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g, "") : primarySym;
      if (!sym) sym = primarySym;
      
      let curr = primaryCurr;
      if (t.currency) {
        const c = String(t.currency).toUpperCase();
        curr = c.includes("USD") || c.includes("USDT") || c === "$" ? "USD" : "TMN";
      }

      return {
        ...t,
        symbol: sym,
        currency: curr,
        price: Number(t.price) || 0,
        quantity: Number(t.quantity) || 0,
        fee: Number(t.fee) || 0,
        feeUnit: (t.feeUnit?.toUpperCase() === "CURRENCY" ? "CURRENCY" : "COIN") as "COIN" | "CURRENCY",
        side: (t.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        total: t.total ? Number(t.total) : undefined,
      };
    });

    const distinctAssets = Array.from(new Set(normalizedTrades.map((t: any) => t.symbol))).filter(Boolean);

    parsedData = {
      ...parsedData,
      detectedSymbol: primarySym,
      detectedCurrency: primaryCurr,
      detectedAssets: distinctAssets.length > 0 ? distinctAssets : (parsedData.detectedAssets || [primarySym]),
      trades: normalizedTrades,
    };

    return res.json({
      success: true,
      data: parsedData,
      modelUsed: usedModel,
    });
  } catch (err: any) {
    console.error("Gemini Vision OCR Error:", err);
    let friendlyMessage = "خطا در پردازش تصویر با هوش مصنوعی. لطفاً مجدداً تلاش نمایید.";
    
    const rawMsg = err?.message || "";
    if (rawMsg.includes("503") || rawMsg.includes("high demand") || rawMsg.includes("UNAVAILABLE")) {
      friendlyMessage = "سرویس هوش مصنوعی گوگل در این لحظه با ترافیک موقت بالا مواجه شد (کد 503). لطفاً دکمه «تلاش مجدد» را فشار دهید.";
    } else if (rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
      friendlyMessage = "محدودیت تعداد درخواست موقت. لطفاً چند ثانیه دیگر روی «تلاش مجدد» کلیک فرمایید.";
    }

    return res.status(500).json({
      success: false,
      error: friendlyMessage,
      rawError: rawMsg,
      attemptLogs,
    });
  }
});

// Vite Middleware for Development / Static serving for Production
async function setupApp() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupApp();
