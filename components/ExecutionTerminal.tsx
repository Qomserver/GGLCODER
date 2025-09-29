import React, { useState, useRef, useEffect } from 'react';
import { Chat } from '@google/genai';
import { startExecutionChat, streamCodeExecution, ExecutionResponsePart } from '../services/geminiService';
import Spinner from './Spinner';
import CloseIcon from './icons/CloseIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ApiSettings } from '../types';

interface ExecutionTerminalProps {
    onClose: () => void;
}

const TerminalOutput: React.FC<{ part: ExecutionResponsePart }> = ({ part }) => {
    if (part.text) {
        return <p className="whitespace-pre-wrap">{part.text}</p>;
    }

    if (part.executableCode?.code) {
        const code = part.executableCode.code;
        return (
            <div className="bg-slate-900/50 p-3 my-2 rounded-md">
                <p className="text-xs text-cyan-400 mb-1 font-semibold">کد قابل اجرا (پایتون)</p>
                <pre><code className="language-python hljs">{code}</code></pre>
            </div>
        );
    }
    
    if (part.codeExecutionResult) {
        const { output, outcome } = part.codeExecutionResult;
        const isError = outcome === 'ERROR';
        return (
            <div className={`bg-slate-900/50 p-3 my-2 rounded-md border-l-4 ${isError ? 'border-red-500' : 'border-green-500'}`}>
                <p className={`text-xs ${isError ? 'text-red-400' : 'text-green-400'} mb-1 font-semibold`}>نتیجه اجرا ({outcome})</p>
                <pre className="text-sm whitespace-pre-wrap">{output}</pre>
            </div>
        );
    }

    if(part.error) {
        return <p className="text-red-400">خطا: {part.error}</p>;
    }

    return null;
};

const ExecutionTerminal: React.FC<ExecutionTerminalProps> = ({ onClose }) => {
    const [history, setHistory] = useState<ExecutionResponsePart[][]>([]);
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const chatSessionRef = useRef<Chat | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const [apiSettings] = useLocalStorage<ApiSettings>('ai-codegen-settings', {
        provider: 'Google',
        apiKey: (typeof process !== 'undefined' && process.env?.API_KEY) || '',
        model: 'gemini-2.5-flash',
    });

    useEffect(() => {
        if(apiSettings.apiKey){
            try {
                // Only Google provider supports code execution tool
                if (apiSettings.provider === 'Google') {
                    chatSessionRef.current = startExecutionChat(apiSettings.apiKey);
                    setError(null);
                } else {
                    setError("Code execution is only supported for the 'Google' provider. Please change it in settings.");
                }
            } catch (e) {
                setError("Failed to start execution session. Ensure the Google API key is valid.");
            }
        } else {
            setError("Google API key for code execution is not set in settings.");
        }
    }, [apiSettings]);
    
    useEffect(() => {
        if(outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
        if((window as any).hljs) {
            (window as any).hljs.highlightAll();
        }
    }, [history]);

    const handleSubmit = async () => {
        if (!prompt || isLoading || !chatSessionRef.current) return;
        setIsLoading(true);

        const currentTurn: ExecutionResponsePart[] = [{ text: `> ${prompt}` }];
        setHistory(prev => [...prev, currentTurn]);
        setPrompt('');

        try {
            const stream = streamCodeExecution(chatSessionRef.current, prompt);
            for await (const part of stream) {
                setHistory(prev => {
                    const newHistory = [...prev];
                    const lastTurn = newHistory[newHistory.length - 1];
                    lastTurn.push(part);
                    return newHistory;
                });
            }
        } catch (e) {
            const errorPart = { error: e instanceof Error ? e.message : "An unknown error occurred during execution." };
             setHistory(prev => {
                const newHistory = [...prev];
                const lastTurn = newHistory[newHistory.length - 1];
                lastTurn.push(errorPart);
                return newHistory;
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="h-1/3 min-h-48 flex flex-col bg-slate-800 border-t-2 border-slate-700 mt-4 rounded-t-lg">
            <div className="flex justify-between items-center p-2 bg-slate-900/50 rounded-t-lg">
                <h3 className="font-mono text-sm font-bold text-cyan-300">ترمینال اجرای کد</h3>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-white"><CloseIcon className="w-5 h-5"/></button>
            </div>
            <div ref={outputRef} className="flex-grow p-4 overflow-y-auto font-mono text-sm text-slate-300 space-y-4">
                {error && <p className="text-red-400">{error}</p>}
                 {!error && history.length === 0 && <p className="text-slate-500">Welcome to the Execution Terminal. Ask the AI to run Python code. (e.g., "list files in current directory")</p>}
                {history.map((turn, turnIndex) => (
                    <div key={turnIndex} className="border-b border-slate-700/50 pb-2 mb-2 last:border-b-0">
                        {turn.map((part, partIndex) => <TerminalOutput key={partIndex} part={part} />)}
                    </div>
                ))}
            </div>
            <div className="p-2 border-t border-slate-700 flex items-center">
                <span className="text-cyan-300 ml-2">{'<'}</span>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={error ? "Cannot execute code." : "از هوش مصنوعی بخواهید کد پایتون تولید و اجرا کند..."}
                    className="w-full bg-transparent outline-none font-mono text-sm"
                    disabled={isLoading || !!error}
                />
                {isLoading && <Spinner className="mr-2" />}
            </div>
        </div>
    );
};

export default ExecutionTerminal;