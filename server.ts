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

// Proxy endpoint for Wallex Live Markets API: GET /hector/web/v1/markets
app.get(["/hector/web/v1/markets", "/api/wallex/markets"], async (_req, res) => {
  try {
    const response = await fetch("https://api.wallex.ir/hector/web/v1/markets", {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WallexTradePortfolio/1.0)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Wallex API responded with HTTP ${response.status}`);
    }

    const data = await response.json();
    res.setHeader("Cache-Control", "public, max-age=10");
    res.json(data);
  } catch (error: any) {
    console.error("Failed to fetch Wallex live markets:", error?.message || error);
    res.status(502).json({
      success: false,
      error: "خطا در دریافت نرخ‌های لحظه‌ای والکس (Failed to fetch Wallex live markets).",
      details: error?.message,
    });
  }
});

// Image Trade OCR & Extraction Endpoint supporting Single or Multiple Screenshots with Multi-Model Fallback
app.post("/api/extract-trades-from-image", async (req, res) => {
  const attemptLogs: Array<{ model: string; error: string }> = [];
  try {
    const { imageBase64, mimeType = "image/jpeg", images, userNotes } = req.body;

    // Collect all incoming images (support both array of images and single image)
    const rawImagesList: Array<{ imageBase64: string; mimeType?: string; name?: string }> = [];
    if (Array.isArray(images) && images.length > 0) {
      rawImagesList.push(...images);
    } else if (imageBase64) {
      rawImagesList.push({ imageBase64, mimeType });
    }

    if (rawImagesList.length === 0) {
      return res.status(400).json({
        success: false,
        error: "تصویری ارسال نشده است (No images provided).",
      });
    }

    // Robust base64 string cleaning and MIME type detection for each image
    const cleanedImages = rawImagesList.map((item, idx) => {
      let clean = item.imageBase64 || "";
      let effMime = item.mimeType || "image/jpeg";

      const base64Marker = ";base64,";
      const markerIndex = clean.indexOf(base64Marker);
      if (markerIndex !== -1) {
        const mimePart = clean.substring(0, markerIndex);
        if (mimePart.startsWith("data:")) {
          effMime = mimePart.substring(5).split(";")[0].trim() || effMime;
        }
        clean = clean.substring(markerIndex + base64Marker.length);
      } else if (clean.startsWith("data:")) {
        clean = clean.replace(/^data:[^;]+;base64,/, "");
      }
      clean = clean.trim().replace(/\s+/g, "");

      return {
        data: clean,
        mimeType: effMime,
        name: item.name || `Screenshot_${idx + 1}`,
      };
    }).filter(img => img.data.length > 0);

    if (cleanedImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: "محتوای تصاویر نامعتبر است (Invalid image content).",
      });
    }

    const ai = getGeminiClient();
    const count = cleanedImages.length;
    const isMultiple = count > 1;

    const promptText = `
You are an expert financial and cryptocurrency trade auditor and OCR vision model.
Carefully inspect the uploaded ${isMultiple ? `${count} screenshots of trade order history tables or exchange transaction reports` : "screenshot of a trade order history table"} (from exchanges like Wallex, Nobitex, Tabdeal, Binance, KuCoin, BingX, etc.).

${isMultiple ? `
MULTI-SCREENSHOT PROCESSING INSTRUCTIONS:
- You have been provided ${count} separate images. These may represent consecutive pages, scrolled views, or different trade history screenshots.
- You MUST scan and extract ALL trade rows from ALL ${count} images without missing any orders.
- DEDUPLICATION: If two or more screenshots contain overlapping sections of the trade list (e.g., the same executed order appears on both images with matching date, price, quantity, side, or order ID), include that trade row ONLY ONCE to avoid duplicate counting!
- Combine all unique trade orders across all images into a single consolidated list.
` : ""}

CRITICAL REQUIREMENT - MULTI-CURRENCY & BUY/SELL SIDES:
The screenshot(s) may contain trades for MULTIPLE DIFFERENT CRYPTOCURRENCIES / TOKENS (e.g. ARB, BTC, ETH, TON, ICP, SOL, SHIB, DOGE, AVAX, GALA, DOGS, POL, IBBABYDOGE, PUMP, USOON, CELR, XRP, etc.) AND both BUY (خرید) and SELL (فروش) transactions!
You MUST inspect each row independently and identify:
1. The EXACT cryptocurrency symbol for EACH individual trade row (e.g., ARB, BTC, ETH, AVAX, SOL, GALA).
2. The EXACT trade SIDE ("BUY" for خرید / سبز, or "SELL" for فروش / قرمز).
DO NOT group, sum, or lump different coins or BUY and SELL together! Each row must preserve its exact original quantity, price, and side.

CRITICAL INSTRUCTIONS FOR IRANIAN EXCHANGE TABLES (WALLEX, NOBITEX, ETC.) WITH SELLER (فروشنده) AND BUYER (خریدار) COLUMNS:
In matched trade execution reports (like Wallex), tables often show TWO parties and TWO separate fee columns:
Columns: [بازار / Market] [فروشنده / Seller] [خریدار / Buyer] [قیمت واحد / Unit Price] [مقدار / Quantity] [قیمت کل / Total] [کارمزد فروشنده / Seller Fee] [کارمزد خریدار / Buyer Fee]
1. IDENTIFYING THE ACCOUNT OWNER:
   - The user whose transaction report this is appears consistently across EVERY trade row (e.g., "پرهام قاضی زاده").
   - The counterparty is another person or robot (e.g., "MMRobot Multi2", "MMRobot Multi3", "External H builder", etc.).

2. SELECTING THE CORRECT SIDE AND THE CORRECT FEE:
   - When the user's name is in the "خریدار" (Buyer) column:
     * side = "BUY"
     * fee: YOU MUST EXTRACT THE FEE FROM THE "کارمزد خریدار" (Buyer Fee) COLUMN ONLY! DO NOT TAKE THE SELLER FEE!
     * feeUnit: Look at the unit in parentheses inside the "کارمزد خریدار" cell:
       - E.g. "0.00078888 (AVAX)" -> fee: 0.00078888, feeUnit: "COIN"
       - E.g. "0.01039694 (SOL)" -> fee: 0.01039694, feeUnit: "COIN"
       - E.g. "0 (USDT)" -> fee: 0, feeUnit: "CURRENCY"
   - When the user's name is in the "فروشنده" (Seller) column:
     * side = "SELL"
     * fee: YOU MUST EXTRACT THE FEE FROM THE "کارمزد فروشنده" (Seller Fee) COLUMN ONLY! DO NOT TAKE THE BUYER FEE!
     * feeUnit: Look at the unit in parentheses inside the "کارمزد فروشنده" cell:
       - E.g. "4,001 (TMN)" -> fee: 4001, feeUnit: "CURRENCY" (because TMN is Toman / quote currency!).
       - E.g. "74,608 (TMN)" -> fee: 74608, feeUnit: "CURRENCY".
       - E.g. "161,490 (TMN)" -> fee: 161490, feeUnit: "CURRENCY".
       - E.g. "0.15616013 (USDT)" -> fee: 0.15616013, feeUnit: "CURRENCY".
       - WARNING: NEVER mark "4,001 (TMN)" as "COIN"! 4,001 is Tomans, NOT coins! If you mark 4,001 as COIN, multiplying 4,001 by unit price 2,500,000 gives 10 Billion Toman fee which is a catastrophic mistake!

3. FEE SANITY AND VALUE BOUNDS:
   - On cryptocurrency exchanges, the fee is ALWAYS between 0.05% and 0.4% of the total turnover (1/500th to 1/1000th of trade value).
   - A transaction fee CAN NEVER exceed the total price or turnover of the trade!
   - If unit price is 2,535,945 TMN and total price is 2,000,556 TMN:
     * The fee in TMN is 4,001 TMN (~0.2%).
     * The fee in coins is 0.00078888 AVAX (~0.1%).

Your task is to extract all trade rows accurately across all images:
1. For EACH individual trade row, identify:
   - "symbol": Base coin symbol (e.g., "BTC", "ETH", "AVAX", "SOL", "GALA", "ARB", "SHIB"). Convert to standard uppercase letters.
   - "side": "BUY" or "SELL".
   - "currency": "TMN" for تومان / Toman, "USD" for Tether / USDT / $.
   - "price": Unit price per coin. Convert Persian digits (۰-۹) and remove thousand commas.
   - "quantity": Number of coins traded.
   - "fee": Transaction fee amount paid by the user for their side of the order.
   - "feeUnit": "COIN" if fee is in cryptocurrency asset, or "CURRENCY" if fee is in quote currency (TMN / USDT).
   - "total": The total turnover/spend amount if explicitly shown on that row.
   - "date": Date and time string if visible.
   - "orderId": Order ID or tracking number if visible.

2. Return "detectedAssets": Array of all distinct crypto asset symbols found.
3. "detectedSymbol": The primary or first asset symbol detected.
4. "detectedCurrency": The primary quote currency detected ("TMN" or "USD").

${userNotes ? `User Note: ${userNotes}` : ""}

Precision rules:
- Pay extreme attention to decimals like 0.002, 0.02, 0/02, ۰٫۰۲.
- Ensure "price", "quantity", and "fee" are positive numbers.
- Return structured JSON matching the provided schema.
`;

    // Candidate models in priority order. Active and healthy multimodal vision models first
    const CANDIDATE_MODELS = [
      "gemini-3-flash-preview",
      "gemini-3.7-flash",
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite-preview",
      "gemini-flash-lite-latest",
    ];
    
    let lastError: any = null;
    let response = null;
    let usedModel = "";

    // Build multimodal image parts
    const imageParts = cleanedImages.map((img) => ({
      inlineData: {
        mimeType: img.mimeType,
        data: img.data,
      },
    }));

    const responseSchema = {
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
    };

    // Helper to call generateContent on a specific model with automatic retry on 503/429
    const tryGenerateWithModel = async (modelName: string, parts: any[], maxModelRetries = 2) => {
      let mErr: any = null;
      for (let attempt = 1; attempt <= maxModelRetries; attempt++) {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema,
            },
          });
          return res;
        } catch (err: any) {
          mErr = err;
          const msg = err?.message || String(err || "");
          const isTransient = msg.includes("503") || msg.includes("high demand") || msg.includes("429") || msg.includes("UNAVAILABLE");
          if (isTransient && attempt < maxModelRetries) {
            console.warn(`Transient error on ${modelName} (attempt ${attempt}/${maxModelRetries}). Retrying in ${attempt * 800}ms...`);
            await new Promise((resolve) => setTimeout(resolve, attempt * 800));
          } else {
            break;
          }
        }
      }
      throw mErr;
    };

    // 1. First attempt: Process all images together across candidate models
    const combinedParts = [...imageParts, { text: promptText }];
    for (let i = 0; i < CANDIDATE_MODELS.length; i++) {
      const modelName = CANDIDATE_MODELS[i];
      try {
        const retriesForThisModel = (i === 0) ? 3 : 1;
        console.log(`Attempting OCR with model: ${modelName} on ${count} image(s) (priority ${i + 1}/${CANDIDATE_MODELS.length}, max retries: ${retriesForThisModel})`);
        response = await tryGenerateWithModel(modelName, combinedParts, retriesForThisModel);
        usedModel = modelName;
        break; // Success!
      } catch (err: any) {
        lastError = err;
        const errDesc = err?.message || String(err || "");
        console.warn(`Model ${modelName} failed on all images combined:`, errDesc);
        attemptLogs.push({ model: modelName, error: errDesc });
        
        if (i < CANDIDATE_MODELS.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // 2. Fallback: If combined multi-image failed and user sent > 1 image, process each image individually and merge
    if (!response && count > 1) {
      console.log(`Combined multi-image OCR failed. Initiating fallback: processing ${count} images individually...`);
      const singlePrompt = `
You are an expert financial and cryptocurrency trade auditor and OCR vision model.
Extract all trade rows from this single exchange order history screenshot accurately.
Identify:
1. Cryptocurrency base symbol (e.g., BTC, ETH, AVAX, SOL, GALA, ARB, SHIB, POL, DOGS, etc.).
2. Trade side (BUY or SELL): Look at user's position in matched table (Buyer = BUY, Seller = SELL).
3. Quote currency: TMN (تومان) or USD/USDT.
4. Unit price, volume quantity, and fee:
   - For Buyer trades (خرید): extract fee from "کارمزد خریدار" (Buyer Fee).
   - For Seller trades (فروش): extract fee from "کارمزد فروشنده" (Seller Fee). If fee has "(TMN)", it is in Toman (CURRENCY).
   - Exchange fees are strictly around 0.05% to 0.4% of trade value. Never mark a Toman fee (e.g. 4,001 TMN) as "COIN"!
Return structured JSON matching the schema.
`;
      const accumulatedTrades: any[] = [];
      const distinctAssetsSet = new Set<string>();
      let primarySym = "CRYPTO";
      let primaryCurr = "TMN";
      let exName = "";

      let fallbackSuccess = true;
      for (let idx = 0; idx < cleanedImages.length; idx++) {
        const singleImg = cleanedImages[idx];
        const singleParts = [
          { inlineData: { mimeType: singleImg.mimeType, data: singleImg.data } },
          { text: singlePrompt }
        ];

        let singleRes = null;
        for (const modelName of CANDIDATE_MODELS) {
          try {
            singleRes = await tryGenerateWithModel(modelName, singleParts, 2);
            usedModel = `${modelName} (per-image fallback)`;
            break;
          } catch (e: any) {
            console.warn(`Per-image OCR failed with ${modelName} on image ${idx + 1}:`, e?.message);
          }
        }

        if (!singleRes) {
          fallbackSuccess = false;
          break;
        }

        try {
          const parsed = JSON.parse(singleRes.text || "{}");
          if (parsed.exchangeName) exName = parsed.exchangeName;
          if (parsed.detectedSymbol) primarySym = parsed.detectedSymbol;
          if (parsed.detectedCurrency) primaryCurr = parsed.detectedCurrency;
          if (Array.isArray(parsed.detectedAssets)) {
            parsed.detectedAssets.forEach((a: string) => distinctAssetsSet.add(a));
          }
          if (Array.isArray(parsed.trades)) {
            accumulatedTrades.push(...parsed.trades);
          }
        } catch (e) {
          console.error("Error parsing per-image response:", e);
        }
      }

      if (fallbackSuccess && accumulatedTrades.length > 0) {
        // Build synthetic response object
        const mergedData = {
          detectedSymbol: primarySym,
          detectedCurrency: primaryCurr,
          detectedAssets: Array.from(distinctAssetsSet),
          exchangeName: exName,
          trades: accumulatedTrades,
          confidenceNotes: "Extracted via per-image resilient fallback with trade deduplication."
        };
        response = { text: JSON.stringify(mergedData) };
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

      const p = Number(t.price) || 0;
      const q = Number(t.quantity) || 0;
      let rawFee = Number(t.fee) || 0;
      const totalVal = t.total && Number(t.total) > 0 ? Number(t.total) : p * q;
      const rawUnit = String(t.feeUnit || "").trim().toUpperCase();

      // Robust feeUnit identification:
      // If the unit string indicates a fiat/quote currency (TMN, TOMAN, تومان, USDT, USD, IRR, etc.), fee is in CURRENCY
      const isExplicitCurrencyUnit =
        rawUnit === "CURRENCY" ||
        rawUnit === "TMN" ||
        rawUnit === "TOMAN" ||
        rawUnit === "تومان" ||
        rawUnit === "USD" ||
        rawUnit === "USDT" ||
        rawUnit === "IRR" ||
        rawUnit === "RIAL" ||
        rawUnit === "$" ||
        rawUnit === curr;

      const isExplicitCoinUnit =
        rawUnit === "COIN" ||
        rawUnit === sym ||
        rawUnit === "BASE";

      let cleanFeeUnit: "COIN" | "CURRENCY";
      if (isExplicitCurrencyUnit) {
        cleanFeeUnit = "CURRENCY";
      } else if (isExplicitCoinUnit) {
        cleanFeeUnit = "COIN";
      } else {
        // Infer from values or default side convention
        if (totalVal > 0 && p > 0) {
          if (rawFee * p > totalVal * 0.1 && rawFee <= totalVal * 0.05) {
            cleanFeeUnit = "CURRENCY";
          } else if (q > 0 && rawFee <= q * 0.05) {
            cleanFeeUnit = "COIN";
          } else {
            cleanFeeUnit = t.side?.toUpperCase() === "SELL" ? "CURRENCY" : "COIN";
          }
        } else {
          cleanFeeUnit = t.side?.toUpperCase() === "SELL" ? "CURRENCY" : "COIN";
        }
      }

      // Mathematical Guard Rail & Sanity Check:
      // Exchange fees are ALWAYS 0.05% to 0.4% (max 1%).
      if (totalVal > 0 && p > 0 && rawFee > 0) {
        if (cleanFeeUnit === "COIN") {
          const feeInQuoteCurrency = rawFee * p;
          // If fee multiplied by price is > 10% of total trade turnover or fee > 10% of volume:
          if (feeInQuoteCurrency > totalVal * 0.1 || (q > 0 && rawFee > q * 0.1)) {
            // Check if rawFee itself was already in quote currency (e.g. 4001 TMN on 2,000,556 TMN trade)
            if (rawFee <= totalVal * 0.05) {
              cleanFeeUnit = "CURRENCY";
            } else if (q > 0 && (rawFee / p) <= q * 0.05) {
              rawFee = rawFee / p;
            } else {
              // Safety fallback: 0.2% standard exchange fee in coin
              rawFee = q * 0.002;
            }
          }
        } else if (cleanFeeUnit === "CURRENCY") {
          // If fee in quote currency > 10% of trade turnover:
          if (rawFee > totalVal * 0.1) {
            if (rawFee * p <= totalVal * 0.05) {
              cleanFeeUnit = "COIN";
            } else {
              // Safety fallback: 0.2% standard exchange fee in quote currency
              rawFee = totalVal * 0.002;
            }
          }
        }
      }

      return {
        ...t,
        symbol: sym,
        currency: curr,
        price: p,
        quantity: q,
        fee: rawFee,
        feeUnit: cleanFeeUnit,
        side: (t.side?.toUpperCase() === "SELL" ? "SELL" : "BUY") as "BUY" | "SELL",
        total: totalVal > 0 ? totalVal : undefined,
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
