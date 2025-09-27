import React from 'react';

interface ThinkingIndicatorProps {
    steps: string[];
}

const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ steps }) => {
    if (steps.length === 0) {
        return (
            <div className="flex items-center space-x-reverse space-x-3 p-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-400"></div>
                <p className="text-slate-400">هوش مصنوعی در حال فکر کردن است...</p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-3">
             <h3 className="text-sm font-semibold text-slate-300 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 ml-2 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                مراحل فکر کردن مدل:
            </h3>
            <ul className="space-y-2">
                {steps.map((step, index) => (
                    <li key={index} className="flex items-start text-sm text-slate-400 animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
                         <svg className="w-4 h-4 text-green-400 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        <span>{step}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ThinkingIndicator;
