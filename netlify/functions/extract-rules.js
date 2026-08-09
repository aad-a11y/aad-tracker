import { GoogleGenAI, Type } from '@google/genai';

async function fetchUrlContent(url) {
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  // Strategy 1: Direct fetch
  try {
    const res = await fetch(url, { headers: fetchHeaders, redirect: 'follow' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) return text;
    }
  } catch (e) {
    console.warn('Direct fetch failed:', e);
  }

  // Strategy 2: AllOrigins proxy
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) return text;
    }
  } catch (e) {
    console.warn('AllOrigins proxy failed:', e);
  }

  // Strategy 3: CorsProxy
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 200) return text;
    }
  } catch (e) {
    console.warn('CorsProxy failed:', e);
  }

  return null;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { url, rawText } = body;

    if (!url && !rawText) {
      return new Response(JSON.stringify({ error: 'Please provide either a URL or raw fine print text.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let textToAnalyze = rawText || '';
    let fetchedUrlSuccess = false;

    if (url) {
      const html = await fetchUrlContent(url);
      if (html) {
        const sanitized = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
        const textContent = sanitized.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

        if (textContent.length > 100) {
          textToAnalyze = `Source URL: ${url}\n\nWebpage content:\n${textContent}\n\n${rawText ? 'Additional details:\n' + rawText : ''}`;
          fetchedUrlSuccess = true;
        }
      }
    }

    if (!textToAnalyze) {
      return new Response(JSON.stringify({
        error: 'Bank anti-bot security blocked automated link scanning for this page (Chase/Bank bot restriction). Please click "Paste Fine Print Text" above, copy & paste the promotional details directly, and AI will extract everything instantly!',
        fallbackRequired: true
      }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'GEMINI_API_KEY environment variable is not configured in Netlify Settings > Site configuration > Environment variables.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = `You are an expert bank promotion auditor. Your job is to extract bank sign-up offer terms and qualifying rules from fine prints, disclosures, and offer pages.
Carefully analyze the provided text and identify:
1. Bank Institution Name.
2. The specific Account Product Name.
3. The Account Type (must map to checking, savings, business_checking, business_savings, credit_card, or other).
4. The exact target sign-up bonus cash amount (number only, e.g. 300, 1500).
5. Promotion code if specified.
6. A detailed list of requirements (milestones) needed to qualify for the bonus.
For each requirement, determine:
- type: must be exactly one of 'direct_deposit', 'debit_transactions', 'minimum_balance', 'bill_pay', 'account_funding', 'other'.
- description: clear summary (e.g., "Receive direct deposits totaling $5,000 within 90 days").
- targetValue: numerical value to track (total dollar amount for deposits/funding/balance, count for debit purchases/bill-pay, 1 for other).
- daysToComplete: number of calendar days from account opening to complete this. Defaults to 90 if unspecified.
- notes: key details like "Internal transfers do not count", "Must keep balance for 90 days".
7. Any additional important conditions (e.g. monthly fees, early termination fee if closed within 6 months) as a general notes string.

Return the response strictly as valid JSON matching the requested schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: textToAnalyze,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bankName: { type: Type.STRING },
            accountName: { type: Type.STRING },
            accountType: { type: Type.STRING },
            bonusAmount: { type: Type.NUMBER },
            promoCode: { type: Type.STRING },
            requirements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                  targetValue: { type: Type.NUMBER },
                  daysToComplete: { type: Type.NUMBER },
                  notes: { type: Type.STRING }
                },
                required: ["type", "description", "targetValue", "daysToComplete"]
              }
            },
            notes: { type: Type.STRING }
          },
          required: ["bankName", "accountName", "accountType", "bonusAmount", "requirements"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty response from Gemini API");
    }

    const data = JSON.parse(resultText.trim());

    return new Response(JSON.stringify({
      success: true,
      fetchedUrlSuccess,
      data
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message || 'Error processing request with AI'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
