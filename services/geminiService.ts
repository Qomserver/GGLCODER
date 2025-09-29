import { GoogleGenAI, Chat, Content } from "@google/genai";
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
    return `You are an expert software developer. Your task is to generate or update complete codebases based on a user's prompt.
You MUST stream a sequence of JSON objects, one per line. Each line MUST be a single, complete, and valid JSON object.

First, think step-by-step about the project structure and implementation plan. Stream these thoughts using the "THINKING" action.

When updating an existing project, the user prompt will contain the full context of existing files. Use this context to make the correct changes.
To update an existing file, you can send a CREATE_FILE action with the same path which will act as overwriting it, followed by APPEND_TO_FILE actions with the new content.

CRITICAL: The "content" field MUST be a valid JSON string. This means all special characters, especially newlines and quotes, MUST be properly escaped (e.g., \\n, \\").

For web-based projects, you MUST include a 'deploy.sh' file. This script should start a simple local web server to host the static files. It should intelligently check for 'npx http-server', 'python3 -m http.server', or 'python -m SimpleHTTPServer' and use the first one it finds. Provide clear echo statements to the user about what it's doing and where to access the app.

SCHEMA:
{"action": ACTION, "filePath": STRING, "content": STRING, ...}
Where ACTION is one of: THINKING, CREATE_FILE, APPEND_TO_FILE, FINISH, ERROR.

RULES:
- Do NOT output any text, explanations, or markdown outside of the JSON objects.
- First, send all THINKING actions to outline your plan.
- Next, send all CREATE_FILE actions for new or modified files.
- Then, send all APPEND_TO_FILE actions with the code for each file.
- Finally, when all code is sent, send one FINISH action.
- CRITICAL: With the FINISH action, you MUST include a "suggestions" field: {"action":"FINISH", "isComplete":true, "suggestions": ["Add user authentication", "Implement a database", "Deploy the app"]}. This field is mandatory on finish.`;
};


const extractNextJsonObject = (buffer: string): { jsonObject: string | null; remainingBuffer: string } => {
    let searchIndex = 0;
    while (true) {
        const startIndex = buffer.indexOf('{', searchIndex);
        if (startIndex === -1) {
            // No more '{' found in the buffer, discard the rest.
            return { jsonObject: null, remainingBuffer: '' };
        }

        let braceCount = 1; // Start with 1 since we found the opening brace
        let inString = false;
        let isEscaped = false;
        let endIndex = -1;

        // Start scanning from the character after the opening brace
        for (let i = startIndex + 1; i < buffer.length; i++) {
            const char = buffer[i];
            if (inString) {
                if (isEscaped) {
                    isEscaped = false;
                } else if (char === '\\') {
                    isEscaped = true;
                } else if (char === '"') {
                    inString = false;
                }
            } else {
                if (char === '"') {
                    inString = true;
                } else if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            }
            if (braceCount === 0) {
                endIndex = i;
                break;
            }
        }

        if (endIndex !== -1) {
            const potentialJson = buffer.substring(startIndex, endIndex + 1);
            try {
                // Final validation: ensure it's actually parseable JSON.
                JSON.parse(potentialJson);
                // It's a valid JSON object.
                return {
                    jsonObject: potentialJson,
                    remainingBuffer: buffer.substring(endIndex + 1)
                };
            } catch (e) {
                // It was a false positive (e.g., "{ not valid json }").
                // Continue searching for the next '{' after this one.
                searchIndex = startIndex + 1;
            }
        } else {
            // We found an opening '{' but no closing '}'. It's an incomplete object.
            // Return the rest of the buffer from this '{' to be processed with the next chunk.
            return { jsonObject: null, remainingBuffer: buffer.substring(startIndex) };
        }
    }
};

const isRateLimitError = (error: any): boolean => {
    if (!error || typeof error !== 'object') return false;
    // For REST API responses where we throw { status, ... }
    if (error.status === 429) return true;
    // For nested Google-style errors
    const nestedError = error.error;
    if (nestedError && typeof nestedError === 'object') {
        if (nestedError.status === 'RESOURCE_EXHAUSTED') return true;
        if (nestedError.code === 429) return true;
    }
    return false;
};

const createErrorResponse = (error: any): StreamResponse => {
    let errorMessage = 'An unknown error occurred during code generation.';
    
    if (isRateLimitError(error)) {
        errorMessage = "The API rate limit was exceeded. The request couldn't be completed, even after automatic retries. Please check your plan and billing details, wait a few minutes, or try switching to a different provider in the settings.";
    } else if (typeof error === 'string') {
        errorMessage = error;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
        // Google-style errors
        if (error.error?.message) {
            errorMessage = `API Error: ${error.error.message} (Status: ${error.error.status || 'Unknown'})`;
        } 
        // Other common API error objects that are not Error instances
        else if (error.message) {
            errorMessage = `API Error: ${error.message}`;
        }
        // Fallback to pretty-printing the object
        else {
            try {
                const fullError = JSON.stringify(error, null, 2);
                errorMessage = `An unexpected error occurred. Full details:\n${fullError}`;
            } catch (e) {
                errorMessage = 'An unexpected and un-serializable error occurred.';
            }
        }
    }

    return { action: 'ERROR', error: errorMessage };
};

// --- API Service Interface ---

interface IApiService {
    streamGeneration(history: Content[], prompt: string): AsyncGenerator<StreamResponse>;
    streamCodeExecution(chat: Chat,