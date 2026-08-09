import { GoogleGenAI, Type } from '@google/genai';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { fileBase64, pdfBase64, fileMimeType, fileName, rawText } = body;

    const activeFileBase64 = fileBase64 || pdfBase64;

    if (!activeFileBase64 && (!rawText || !rawText.trim())) {
      return new Response(JSON.stringify({ error: 'Please upload an offer document (PDF or Image) or paste fine print text to analyze.' }), {
        status: 400,
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
    const systemInstruction = `You are an expert bank promotion auditor. Your job is to extract bank sign-up offer terms and qualifying rules from fine prints, disclosures, offer pages, or uploaded PDF/Image documents.
Carefully analyze the provided document or text and identify:
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

    let contentsPayload;
    if (activeFileBase64) {
      const cleanData = activeFileBase64.replace(/^data:[^;]+;base64,/, '');
      const mimeType = fileMimeType || (activeFileBase64.startsWith('data:image/') ? activeFileBase64.split(';')[0].replace('data:', '') : 'application/pdf');

      contentsPayload = [
        {
          inlineData: {
            mimeType,
            data: cleanData
          }
        },
        `Analyze this bank promotional offer document/image and extract the bank institution name, account product name, account type, cash bonus amount, promo code, and all qualification requirements (milestones, deadlines, deposit amounts) strictly according to system instructions. ${rawText ? '\nAdditional user text notes: ' + rawText : ''}`
      ];
    } else {
      contentsPayload = rawText;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contentsPayload,
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
