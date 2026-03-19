
import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Gemini API client using the environment variable API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Uses Gemini AI to analyze a maintenance request and determine its priority and assessment.
 */
export const analyzeMaintenanceRequest = async (issueDescription: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following property maintenance issue and provide a professional assessment and priority level. Issue: "${issueDescription}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            priority: {
              type: Type.STRING,
              description: 'The priority level of the request (LOW, MEDIUM, HIGH, EMERGENCY).',
            },
            assessment: {
              type: Type.STRING,
              description: 'A brief professional assessment of the reported fault.',
            },
          },
          required: ["priority", "assessment"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini AI Analysis Error:", error);
    return {
      priority: "MEDIUM",
      assessment: "AI assessment currently unavailable. Defaulting to standard triage protocol.",
    };
  }
};

/**
 * Uses Gemini AI to screen tenant applications based on provided dossier data and property rent.
 */
export const screenTenantApplication = async (appData: any, propertyRent: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Perform a detailed risk assessment for this tenant application for a property with rent ₦${propertyRent.toLocaleString()}. Applicant Dossier: ${JSON.stringify(appData)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskScore: {
              type: Type.NUMBER,
              description: 'A stability rating from 0 to 100, where 100 is highly stable/low risk.',
            },
            recommendation: {
              type: Type.STRING,
              description: 'A detailed summary of why this applicant is recommended or flagged.',
            },
          },
          required: ["riskScore", "recommendation"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini AI Screening Error:", error);
    return { riskScore: 70, recommendation: "Automated analysis failed. Manual review required." };
  }
};

/**
 * Uses Gemini AI to generate a concise summary of a lease agreement.
 */
export const summarizeAgreement = async (agreementDetails: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Provide a concise 2-3 sentence summary of the key terms and conditions in this lease agreement: "${agreementDetails}"`,
    });

    return response.text || "Summary generation failed.";
  } catch (error) {
    console.error("Gemini AI Summary Error:", error);
    return "Could not generate summary at this time.";
  }
};
