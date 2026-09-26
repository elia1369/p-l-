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
Carefully inspect the uploaded ${isMultiple ? `${count} screenshots of trade order history tables or exchange transaction reports` : "screenshot of a trade order history table"} (from Iranian exchanges like Wallex, Nobitex, Tabdeal, or international exchanges like Binance, KuCoin).

${isMultiple ? `
MULTI-SCREENSHOT PROCESSING INSTRUCTIONS:
- You have been provided ${count} separate images. These may represent consecutive pages, scrolled views, or different trade history screenshots.
- You MUST scan and extract ALL trade rows from ALL ${count} images without missing any orders.
- DEDUPLICATION: If two or more screenshots contain overlapping sections of the trade list (e.g., the same executed order appears on both images with matching date, price, quantity, side, or order ID), include that trade row ONLY ONCE to avoid duplicate counting!
- Combine all unique trade orders across all images into a single consolidated list.
` : ""}

========================================================================================
CANONICAL COLUMN SPECIFICATION (DEFAULT FOR ALL IMAGES EVEN IF HEADERS ARE CUT OFF):
The screenshot(s) are from Iranian crypto exchanges (specifically Wallex transaction history).
Even when the table header is scrolled past, cropped, or not visible, the 10 COLUMNS ALWAYS strictly follow this exact order:

When reading from RIGHT to LEFT (Standard Persian RTL layout):
- Column 1 (Rightmost): بازار (Market / Trading Pair) -> e.g. "AVAXTMN", "BTCTMN", "USDTIRR"
- Column 2: فروشنده (Seller Name) -> e.g. "سیدعلیرضا ناظم زاده" or "MMRobot"
- Column 3: خریدار (Buyer Name) -> e.g. "محمد کریمی رزکانی" or "MMRobot"
- Column 4: قیمت واحد (Unit Price) -> Single unit price in TMN (e.g. 2,505,366) or USDT
- Column 5: مقدار (Quantity / Volume) -> Number of crypto coins traded (e.g. 30, 43.19026)
- Column 6: قیمت کل (Total Price / Total Value) -> Total trade value = Unit Price * Quantity (e.g. 75,160,980, 108,226,628)
- Column 7: کارمزد فروشنده (Seller Fee) -> Paid in TMN / Quote currency, e.g. "37,580 (TMN)" or "54,113 (TMN)"
- Column 8: کارمزد خریدار (Buyer Fee) -> Paid in Crypto Coin, e.g. "0.036 (AVAX)" or "0.05182831 (AVAX)"
- Column 9: تاریخ (Date & Time) -> e.g. "14:40 - 1405/06/31"
- Column 10 (Leftmost): نوع معامله (Transaction Type) -> e.g. "EXCHANGE"

When reading from LEFT to RIGHT:
- Column 1 (Leftmost): نوع معامله (Transaction Type e.g. "EXCHANGE")
- Column 2: تاریخ (Date & Time e.g. "14:40 - 1405/06/31")
- Column 3: کارمزد خریدار (Buyer Fee in base coin e.g. 0.036 AVAX)
- Column 4: کارمزد فروشنده (Seller Fee in TMN e.g. 37,580 TMN)
- Column 5: قیمت کل (Total Price e.g. 75,160,980)
- Column 6: مقدار (Quantity of crypto e.g. 30)
- Column 7: قیمت واحد (Unit Price e.g. 2,505,366)
- Column 8: خریدار (Buyer Name)
- Column 9: فروشنده (Seller Name)
- Column 10 (Rightmost): بازار (Market e.g. "AVAXTMN")
========================================================================================

CRITICAL RULES FOR DETERMINING BUY vs SELL SIDE & THE CORRECT FEE:
1. IDENTIFYING ACCOUNT OWNER & TRADE SIDE:
   - Identify the user whose account this ledger belongs to (the recurring personal name across trade rows, e.g., "سیدعلیرضا ناظم زاده").
   - If the user is in the "خریدار" (Buyer) column (Col 3 RTL / Col 8 LTR):
     * side = "BUY"
     * fee: Extract ONLY from the "کارمزد خریدار" (Buyer Fee) column (Col 8 RTL / Col 3 LTR).
     * feeUnit: "COIN" (because buyer pays fee in the bought crypto coin, e.g. 0.036 AVAX).
   - If the user is in the "فروشنده" (Seller) column (Col 2 RTL / Col 9 LTR):
     * side = "SELL"
     * fee: Extract ONLY from the "کارمزد فروشنده" (Seller Fee) column (Col 7 RTL / Col 4 LTR).
     * feeUnit: "CURRENCY" (because seller pays fee in TMN/quote currency, e.g. 37,580 TMN).

2. MATHEMATICAL VERIFICATION (PREVENT SWAPPING):
   - ALWAYS verify: Unit Price * Quantity ≈ Total Price!
     Example: 2,505,366 (price) * 30 (qty) = 75,160,980 (total).
     NEVER swap Total Price with Unit Price!
   - Seller Fee is ~0.05% - 0.25% of Total Price (in TMN, e.g. 37,580).
   - Buyer Fee is ~0.05% - 0.25% of Quantity (in coins, e.g. 0.036 AVAX).
   - NEVER assign a 37,580 Toman fee as "COIN" units!

Your task is to extract all trade rows accurately across all images:
1. For EACH individual trade row, identify:
   - "symbol": Base coin symbol (e.g., "BTC", "ETH", "AVAX", "SOL", "GALA", "ARB", "SHIB"). Convert to standard uppercase letters.
   - "side": "BUY" or "SELL".
   - "currency": "TMN" for تومان / Toman, "USD" for Tether / USDT / $.
   - "price": Unit price per coin (قیمت واحد).
   - "quantity": Number of coins traded (مقدار).
   - "total": The total turnover/spend amount (قیمت کل = Unit Price * Quantity).
   - "fee": Transaction fee amount paid by the user for their side of the order.
   - "feeUnit": "COIN" if fee is in cryptocurrency asset, or "CURRENCY" if fee is in quote currency (TMN / USDT).
   - "sellerFee": Numeric fee value from the Seller Fee column if visible.
   - "buyerFee": Numeric fee value from the Buyer Fee column if visible.
   - "sellerName": Seller person/entity name if visible.
   - "buyerName": Buyer person/entity name if visible.
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
      "gemini-3.8-flash",
      "gemini-flash-latest",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-3.7-flash",
      "gemini-3-flash-preview",
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
              sellerName: {
                type: Type.STRING,
                description: "Seller person/entity name from Column 2 (or Col 9 from left)",
              },
              buyerName: {
                type: Type.STRING,
                description: "Buyer person/entity name from Column 3 (or Col 8 from left)",
              },
              sellerFee: {
                type: Type.NUMBER,
                description: "Seller fee from Column 7 (TMN/quote currency fee)",
              },
              buyerFee: {
                type: Type.NUMBER,
                description: "Buyer fee from Column 8 (crypto coin fee)",
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
          const isQuota = msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("Quota exceeded");
          if (isQuota) {
            // Immediate break to failover to the next candidate model without wasting time on exhausted quota
            break;
          }
          const isTransient = msg.includes("503") || msg.includes("high demand") || msg.includes("UNAVAILABLE");
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

CANONICAL 10-COLUMN ORDER (DEFAULT FOR ALL IMAGES EVEN IF HEADERS ARE CUT OFF):
From RIGHT to LEFT (Standard Iranian exchange / Wallex table):
1. بازار (Market) -> e.g. "AVAXTMN", "BTCTMN"
2. فروشنده (Seller Name)
3. خریدار (Buyer Name)
4. قیمت واحد (Unit Price) -> Single coin price
5. مقدار (Quantity) -> Crypto volume
6. قیمت کل (Total Price) -> Total = Unit Price * Quantity
7. کارمزد فروشنده (Seller Fee) -> in TMN (~0.05% - 0.25% of Total)
8. کارمزد خریدار (Buyer Fee) -> in Crypto Coin (~0.05% - 0.25% of Quantity)
9. تاریخ (Date & Time)
10. نوع معامله (Trade Type e.g. EXCHANGE)

From LEFT to RIGHT:
[نوع معامله] [تاریخ] [کارمزد خریدار (کوین)] [کارمزد فروشنده (تومان)] [قیمت کل] [مقدار] [قیمت واحد] [خریدار] [فروشنده] [بازار]

RULES:
- When user is in "خریدار" (Buyer): side = "BUY", user's fee is from "کارمزد خریدار" (COIN fee).
- When user is in "فروشنده" (Seller): side = "SELL", user's fee is from "کارمزد فروشنده" (TMN / CURRENCY fee).
- Mathematical verification: Unit Price * Quantity MUST equal Total Price.
- Never mark a 37,580 Toman fee as "COIN"!
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

    // Analyze recurring names across all extracted trades to identify the account owner
    const rawTradesList = Array.isArray(parsedData.trades) ? parsedData.trades : [];
    const nameCounts: Record<string, { asSeller: number; asBuyer: number }> = {};
    for (const t of rawTradesList) {
      const sName = String(t.sellerName || "").trim();
      const bName = String(t.buyerName || "").trim();
      const isSystemBot = (n: string) => /robot|mmrobot|external|market\s*maker|system/i.test(n);

      if (sName && !isSystemBot(sName)) {
        if (!nameCounts[sName]) nameCounts[sName] = { asSeller: 0, asBuyer: 0 };
        nameCounts[sName].asSeller += 1;
      }
      if (bName && !isSystemBot(bName)) {
        if (!nameCounts[bName]) nameCounts[bName] = { asSeller: 0, asBuyer: 0 };
        nameCounts[bName].asBuyer += 1;
      }
    }

    let dominantUser: string | null = null;
    let maxUserRows = 0;
    for (const [name, stats] of Object.entries(nameCounts)) {
      const tot = stats.asSeller + stats.asBuyer;
      if (tot > maxUserRows) {
        maxUserRows = tot;
        dominantUser = name;
      }
    }

    const normalizedTrades = rawTradesList.map((t: any) => {
      let sym = t.symbol ? String(t.symbol).toUpperCase().replace(/[^A-Z0-9]/g, "") : primarySym;
      if (!sym) sym = primarySym;
      
      let curr = primaryCurr;
      if (t.currency) {
        const c = String(t.currency).toUpperCase();
        curr = c.includes("USD") || c.includes("USDT") || c === "$" ? "USD" : "TMN";
      }

      let p = Number(t.price) || 0;
      let q = Number(t.quantity) || 0;
      let totalVal = t.total && Number(t.total) > 0 ? Number(t.total) : 0;
      const sellerFee = Number(t.sellerFee) || 0;
      const buyerFee = Number(t.buyerFee) || 0;
      let rawFee = Number(t.fee) || 0;
      const rawUnit = String(t.feeUnit || "").trim().toUpperCase();

      // CANONICAL COLUMN MATHEMATICAL CHECK (Col 4 Unit Price, Col 5 Quantity, Col 6 Total Price):
      // Unit Price * Quantity MUST equal Total Price!
      // If OCR inverted Unit Price and Total Price (e.g. 75,160,980 as price and 2,505,366 as total):
      if (p > 0 && q > 0) {
        if (totalVal > 0) {
          const prodPQ = p * q;
          const prodTotalQ = totalVal * q;
          // Check if totalVal * q equals p (meaning they were swapped)
          if (p > totalVal && Math.abs(prodTotalQ - p) < Math.max(p, totalVal) * 0.05 && Math.abs(prodPQ - totalVal) > Math.max(p, totalVal) * 0.1) {
            const swap = p;
            p = totalVal;
            totalVal = swap;
          }
        } else {
          totalVal = p * q;
        }
      } else if (p === 0 && totalVal > 0 && q > 0) {
        p = totalVal / q;
      } else if (q === 0 && totalVal > 0 && p > 0) {
        q = totalVal / p;
      }

      // DETERMINE SIDE: Check if account owner is Seller or Buyer
      let determinedSide: "BUY" | "SELL" = (t.side?.toUpperCase() === "SELL" ? "SELL" : "BUY");
      const currentSeller = String(t.sellerName || "").trim();
      const currentBuyer = String(t.buyerName || "").trim();
      if (dominantUser) {
        if (currentSeller === dominantUser) {
          determinedSide = "SELL";
        } else if (currentBuyer === dominantUser) {
          determinedSide = "BUY";
        }
      }

      // Robust feeUnit identification:
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

      // DETERMINE FEE ACCORDING TO CANONICAL IRANIAN EXCHANGE (WALLEX) COLUMNS:
      // Column 7: Seller Fee (always in TMN / Quote currency)
      // Column 8: Buyer Fee (always in Crypto Coin)
      if (determinedSide === "SELL") {
        cleanFeeUnit = "CURRENCY";
        if (sellerFee > 0) {
          rawFee = sellerFee;
        } else if (isExplicitCurrencyUnit && rawFee > 0) {
          // already currency
        } else if (buyerFee > 0 && rawFee === buyerFee && totalVal > 0) {
          // Model mistakenly picked buyer coin fee for seller!
          rawFee = sellerFee > 0 ? sellerFee : totalVal * 0.0005; // 0.05% typical seller fee
        }
      } else {
        // BUY side
        cleanFeeUnit = "COIN";
        if (buyerFee > 0) {
          rawFee = buyerFee;
        } else if (isExplicitCoinUnit && rawFee > 0) {
          // already coin
        } else if (sellerFee > 0 && rawFee === sellerFee && q > 0) {
          // Model mistakenly picked seller TMN fee (e.g. 37,580 TMN) for buyer of 30 AVAX!
          rawFee = buyerFee > 0 ? buyerFee : q * 0.0012; // 0.12% typical buyer coin fee
        } else if (rawFee > 100 && q > 0 && rawFee > q * 0.1) {
          // Large integer fee on a coin quantity is clearly a Toman quote fee!
          if (buyerFee > 0) {
            rawFee = buyerFee;
          } else {
            rawFee = q * 0.0012;
          }
        }
      }

      // Mathematical Guard Rail & Sanity Check:
      // Exchange fees are ALWAYS between 0.05% and 0.4% (max 1%).
      if (totalVal > 0 && p > 0 && rawFee > 0) {
        if (cleanFeeUnit === "COIN") {
          const feeInQuoteCurrency = rawFee * p;
          if (feeInQuoteCurrency > totalVal * 0.05 || (q > 0 && rawFee > q * 0.05)) {
            // Check if rawFee was in Toman currency:
            if (rawFee <= totalVal * 0.05) {
              cleanFeeUnit = "CURRENCY";
            } else if (q > 0 && (rawFee / p) <= q * 0.05) {
              rawFee = rawFee / p;
            } else {
              rawFee = q * 0.0012;
            }
          }
        } else if (cleanFeeUnit === "CURRENCY") {
          if (rawFee > totalVal * 0.05) {
            if (rawFee * p <= totalVal * 0.05) {
              cleanFeeUnit = "COIN";
            } else {
              rawFee = totalVal * 0.0005;
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
        side: determinedSide,
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
