import { GoogleGenAI, HarmCategory, HarmBlockThreshold, type Chat, type Content } from "@google/genai";
import { StreamResponse, ApiSettings } from '../types';

// Represents a part of the streaming response from the code execution model
export interface ExecutionResponsePart {
    text?: string;
    executableCode?: {
        language?: string;
        code?: string;
    };
    codeExecutionResult?: {
        outcome?: string;
        output?: string;
    };
    error?: string; // For service-level errors
}

// --- SHARED UTILITIES ---

const getSystemPrompt = (): string => {
    return `You are an expert software developer. Your task is to generate complete codebases based on a user's prompt.
You MUST stream a sequence of JSON objects, one per line. Each line MUST be a single, complete, and valid JSON object.

First, think step-by-step about the project structure and implementation plan. Stream these thoughts using the "THINKING" action. This helps the user understand your process.
Example: {"action":"THINKING","content":"First, I will create the main HTML file."}
{"action":"THINKING","content":"Then, I will add the CSS for styling and the JavaScript for interactivity."}

After you have outlined your plan, start generating the project files.

CRITICAL: The "content" field MUST be a valid JSON string. This means all special characters, especially newlines and quotes, MUST be properly escaped (e.g., \\n, \\").

SCHEMA:
{"action": ACTION, "filePath": STRING, "content": STRING, ...}
Where ACTION is one of: THINKING, CREATE_FILE, APPEND_TO_FILE, FINISH, ERROR.

RULES:
- Do NOT output any text, explanations, or markdown outside of the JSON objects.
- First, send all THINKING actions to outline your plan.
- Next, send all CREATE_FILE actions for the entire project structure.
- Then, send all APPEND_TO_FILE actions with the code for each file.
- Finally, when all code is sent, send one FINISH action.`;
};


const extractNextJsonObject = (buffer: string): { jsonObject: string | null; remainingBuffer: string } => {
    const startIndex = buffer.indexOf('{');
    if (startIndex === -1) {
        return { jsonObject: null, remainingBuffer: '' };
    }

    let braceCount = 0;
    let inString = false;
    let isEscaped = false;
    let endIndex = -1;

    for (let i = startIndex; i < buffer.length; i++) {
        const char = buffer[i];
        if (inString) {
            if (isEscaped) isEscaped = false;
            else if (char === '\\') isEscaped = true;
            else if (char === '"') inString = false;
        } else {
            if (char === '"') inString = true;
            else if (char === '{') braceCount++;
            else if (char === '}') braceCount--;
        }
        if (braceCount === 0 && i >= startIndex) {
            endIndex = i;
            break;
        }
    }

    if (endIndex !== -1) {
        const jsonStr = buffer.substring(startIndex, endIndex + 1);
        const remaining = buffer.substring(endIndex + 1);
        return { jsonObject: jsonStr, remainingBuffer: remaining };
    }

    return { jsonObject: null, remainingBuffer: buffer.substring(startIndex) };
};

const createErrorResponse = (error: any): StreamResponse => {
    let errorMessage = 'An unknown error occurred during code generation.';
    if (error && typeof error === 'object' && error.error && typeof error.error === 'object' && error.error.message) {
        if (error.error.status === 'RESOURCE_EXHAUSTED') {
            errorMessage = "You've exceeded the API request limit. Please check your plan and billing details. You may need to wait before trying again.";
        } else {
            errorMessage = `API Error: ${error.error.message} (Status: ${error.error.status || 'Unknown'})`;
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    return { action: 'ERROR', error: errorMessage };
};

// --- API Service Interface ---

interface IApiService {
    streamGeneration(history: Content[], prompt: string): AsyncGenerator<StreamResponse>;
    streamCodeExecution(chat: Chat, prompt: string): AsyncGenerator<ExecutionResponsePart>;
}

// --- Google GenAI SDK Implementation ---

class GoogleSdkService implements IApiService {
    private genAI: GoogleGenAI;
    private settings: ApiSettings;

    constructor(settings: ApiSettings) {
        if (!settings.apiKey) {
            throw new Error("API_KEY is required for GoogleSdkService");
        }
        this.genAI = new GoogleGenAI({ apiKey: settings.apiKey });
        this.settings = settings;
    }
    
    startChatSession(history: Content[]): Chat {
        const isFlashModel = this.settings.model.includes('flash');
        return this.genAI.chats.create({
            model: this.settings.model,
            config: { 
                temperature: 0.1, topP: 0.8, topK: 40,
                maxOutputTokens: 16384,
                ...(isFlashModel && { thinkingConfig: { thinkingBudget: 8192 } }),
                systemInstruction: getSystemPrompt(),
            },
            history,
        });
    }

    async* streamGeneration(history: Content[], prompt: string): AsyncGenerator<StreamResponse> {
        try {
            const chat = this.startChatSession(history);
            const result = await chat.sendMessageStream({ message: prompt });
            let buffer = "";
            for await (const chunk of result) {
                const text = chunk.text;
                if (!text) continue;
                buffer += text;
                while (true) {
                    const { jsonObject, remainingBuffer } = extractNextJsonObject(buffer);
                    if (jsonObject) {
                        try {
                            yield JSON.parse(jsonObject) as StreamResponse;
                        } catch (e) { console.warn("Could not parse JSON from SDK stream:", jsonObject, e); }
                        buffer = remainingBuffer;
                    } else {
                        buffer = remainingBuffer;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error("Code generation error (Google SDK):", error);
            yield createErrorResponse(error);
        }
    }

    async* streamCodeExecution(chat: Chat, prompt: string): AsyncGenerator<ExecutionResponsePart> {
        // This remains SDK-based for now as it's a more complex interaction
        try {
            const result = await chat.sendMessageStream({ message: prompt });
            for await (const chunk of result) {
                for (const part of chunk.candidates?.[0]?.content?.parts || []) {
                    yield part;
                }
            }
        } catch (error) {
            console.error("Code execution error (Google SDK):", error);
            yield { error: error instanceof Error ? error.message : "Unknown execution error" };
        }
    }
}

// --- Generic Fetch-based REST Implementation ---

abstract class RestApiService {
    protected settings: ApiSettings;
    protected baseUrl: string;

    constructor(settings: ApiSettings, baseUrl: string) {
        this.settings = settings;
        this.baseUrl = baseUrl;
    }
    
    protected abstract buildRequest(history: Content[], prompt: string): RequestInit;
    protected abstract getEndpoint(): string;

    async* streamGeneration(history: Content[], prompt: string): AsyncGenerator<StreamResponse> {
        try {
            const response = await fetch(this.getEndpoint(), this.buildRequest(history, prompt));
            if (!response.ok) {
                const errorData = await response.json();
                throw { error: errorData.error || { message: `HTTP error! status: ${response.status}` }};
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let responseTextBuffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Process the main buffer for Gemini/OpenAI response chunks
                while(true) {
                    const { jsonObject, remainingBuffer } = extractNextJsonObject(buffer);
                    if(jsonObject) {
                        try {
                           const chunk = JSON.parse(jsonObject);
                           // Extract text content from provider-specific format
                           const text = this instanceof OpenAiCompatibleService 
                             ? chunk.choices?.[0]?.delta?.content || ''
                             : chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
                           
                           if(text) {
                               responseTextBuffer += text;
                               // Process the text content buffer for our action JSONs
                               while(true) {
                                   const { jsonObject: actionJson, remainingBuffer: actionRemaining } = extractNextJsonObject(responseTextBuffer);
                                   if (actionJson) {
                                       try {
                                           yield JSON.parse(actionJson) as StreamResponse;
                                       } catch (e) { console.warn("Could not parse action JSON from REST stream:", actionJson, e); }
                                       responseTextBuffer = actionRemaining;
                                   } else {
                                       responseTextBuffer = actionRemaining;
                                       break;
                                   }
                               }
                           }
                        } catch (e) { 
                            // This can happen with stream-end objects etc.
                        }
                        buffer = remainingBuffer;
                    } else {
                        buffer = remainingBuffer;
                        break;
                    }
                }
            }
        } catch (error) {
            console.error(`Code generation error (${this.settings.provider}):`, error);
            yield createErrorResponse(error);
        }
    }
    
    // TODO: Implement REST-based code execution
    async* streamCodeExecution(chat: Chat, prompt: string): AsyncGenerator<ExecutionResponsePart> {
        yield { error: `${this.settings.provider} provider does not support code execution yet.` };
    }
}

class GeminiRestService extends RestApiService {
    getEndpoint(): string {
        return `${this.baseUrl}/v1beta/models/${this.settings.model}:streamGenerateContent`;
    }

    buildRequest(history: Content[], prompt: string): RequestInit {
        const contents = [...history, { role: 'user', parts: [{ text: prompt }] }];
        const isFlashModel = this.settings.model.includes('flash');
        return {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify({
                contents,
                systemInstruction: { parts: [{ text: getSystemPrompt() }] },
                generationConfig: { 
                    temperature: 0.1, topP: 0.8, topK: 40,
                    maxOutputTokens: 16384,
                    ...(isFlashModel && { thinkingConfig: { thinkingBudget: 8192 } }),
                },
            }),
        };
    }
}

class OpenAiCompatibleService extends RestApiService {
    getEndpoint(): string {
        return `${this.baseUrl}/chat/completions`;
    }
    
    buildRequest(history: Content[], prompt: string): RequestInit {
        const messages = [
            { role: 'system', content: getSystemPrompt() },
            ...history.map(c => ({
                role: c.role === 'model' ? 'assistant' : 'user',
                content: c.parts[0].text,
            })),
            { role: 'user', content: prompt }
        ];

        return {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify({
                model: this.settings.model,
                messages,
                temperature: 0.1,
                top_p: 0.8,
                max_tokens: 16384,
                stream: true,
            }),
        };
    }
}


// --- FACTORY FUNCTION ---

export const getApiService = (settings: ApiSettings): IApiService => {
    switch (settings.provider) {
        case 'AvalAI':
            return new GeminiRestService(settings, 'https://api.avalai.ir');
        case 'GapGPT':
            return new OpenAiCompatibleService(settings, 'https://api.gapgpt.app/v1');
        case 'TalkBot':
            return new OpenAiCompatibleService(settings, 'https://api.talkbot.ir/v1');
        case 'Google':
        default:
            return new GoogleSdkService(settings);
    }
};

// --- LEGACY CODE EXECUTION (SDK ONLY) ---
// Note: This part is not provider-agnostic yet.
export const startExecutionChat = (apiKey: string): Chat => {
    const genAI = new GoogleGenAI({ apiKey });
    return genAI.chats.create({
        model: "gemini-2.5-flash",
        config: {
            tools: [{ codeExecution: {} }],
        }
    });
};

export async function* streamCodeExecution(
    chat: Chat,
    prompt: string,
): AsyncGenerator<ExecutionResponsePart> {
    try {
        const result = await chat.sendMessageStream({ message: prompt });
        for await (const chunk of result) {
            for (const part of chunk.candidates?.[0]?.content?.parts || []) {
                yield part;
            }
        }
    } catch (error) {
        console.error("Code execution error:", error);
        yield { error: error instanceof Error ? error.message : "Unknown execution error" };
    }
}