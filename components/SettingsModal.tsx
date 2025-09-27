import React, { useState, useEffect } from 'react';
import { ApiSettings } from '../types';
import CloseIcon from './icons/CloseIcon';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: ApiSettings) => void;
    currentSettings: ApiSettings;
    providerApiKeys: Record<string, string>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings, providerApiKeys }) => {
    const [settings, setSettings] = useState<ApiSettings>(currentSettings);

    useEffect(() => {
        setSettings(currentSettings);
    }, [currentSettings, isOpen]);

    if (!isOpen) {
        return null;
    }

    const handleSave = () => {
        onSave(settings);
    };

    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newProvider = e.target.value as ApiSettings['provider'];
        setSettings(prev => ({
            ...prev,
            provider: newProvider,
            apiKey: providerApiKeys[newProvider] || '',
        }));
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-slate-700">
                    <h2 className="text-lg font-semibold text-white">تنظیمات API</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label htmlFor="provider" className="block text-sm font-medium text-slate-300 mb-1">ارائه‌دهنده</label>
                        <select
                            id="provider"
                            value={settings.provider}
                            onChange={handleProviderChange}
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        >
                            <option value="Google">Google (پیش‌فرض)</option>
                            <option value="AvalAI">AvalAI</option>
                            <option value="GapGPT">GapGPT</option>
                            <option value="TalkBot">TalkBot</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            { settings.provider === 'Google' && 'از کلید API گوگل جنریتیو AI شما استفاده می‌کند.'}
                            { settings.provider === 'AvalAI' && 'از اندپوینت سازگار با Gemini در AvalAI استفاده می‌کند.'}
                            { settings.provider === 'GapGPT' && 'از اندپوینت سازگار با Gemini در GapGPT استفاده می‌کند.'}
                            { settings.provider === 'TalkBot' && 'از اندپوینت سازگار با OpenAI در TalkBot استفاده می‌کند.'}
                        </p>
                    </div>
                     <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-1">کلید API</label>
                        <input
                            type="password"
                            id="apiKey"
                            value={settings.apiKey}
                            onChange={e => setSettings({ ...settings, apiKey: e.target.value })}
                            placeholder={settings.provider === 'Google' ? 'از متغیر محیطی استفاده می‌شود' : 'کلید API خود را وارد کنید'}
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none font-mono"
                        />
                    </div>
                    <div>
                        <label htmlFor="model" className="block text-sm font-medium text-slate-300 mb-1">نام مدل</label>
                        <input
                            type="text"
                            id="model"
                            value={settings.model}
                            onChange={e => setSettings({ ...settings, model: e.target.value })}
                            placeholder="مثال: gemini-2.5-flash"
                            className="w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none"
                        />
                         <p className="text-xs text-slate-500 mt-1">مدلی را که ارائه‌دهنده انتخابی شما پشتیبانی می‌کند، مشخص کنید.</p>
                    </div>
                </div>
                <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-end space-x-2 space-x-reverse">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded-md transition duration-200">
                        انصراف
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-md transition duration-200">
                        ذخیره
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;