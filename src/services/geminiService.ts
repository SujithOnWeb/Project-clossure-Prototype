import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateDocumentation(userStories: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following user stories, generate a professional Business Requirements Document (BRD) and a high-level Design Document.
    
    User Stories:
    ${userStories}
    
    Format the output as a JSON object with keys 'brd' and 'designDoc'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          brd: { type: Type.STRING },
          designDoc: { type: Type.STRING }
        },
        required: ["brd", "designDoc"]
      }
    }
  });
  
  return JSON.parse(response.text || "{}");
}

export async function auditProject(checklist: string[]) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Audit the following project closure checklist and provide a status report for each item.
    
    Checklist:
    ${checklist.join("\n")}
    
    For each item, provide a status (Pass/Fail/Pending) and a brief comment.
    Format as a JSON array of objects with 'item', 'status', and 'comment'.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING },
            status: { type: Type.STRING },
            comment: { type: Type.STRING }
          },
          required: ["item", "status", "comment"]
        }
      }
    }
  });
  
  return JSON.parse(response.text || "[]");
}

export async function executeAgentTask(agentName: string, role: string, instruction: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are ${agentName}, a ${role} in a project closure team.
    
    Task Instruction:
    ${instruction}
    
    Perform the task and provide a concise summary of the result. 
    If the task involves creating a document, provide a mock URL (e.g., https://sharepoint.com/docs/...) where it would be stored.
    If the task involves scheduling, provide a mock meeting time and Teams link.
    
    Format the output as a JSON object with a 'result' key containing the summary.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          result: { type: Type.STRING }
        },
        required: ["result"]
      }
    }
  });
  
  return JSON.parse(response.text || "{}");
}
