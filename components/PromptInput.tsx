import React from 'react';
import Spinner from './Spinner';
import PlusIcon from './icons/PlusIcon';
import FolderPlusIcon from './icons/FolderPlusIcon';
import UploadIcon from './icons/UploadIcon';
import LightbulbIcon from './icons/LightbulbIcon';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isFinished: boolean;
  onContinue: () => void;
  showContinue: boolean;
  isPristine: boolean;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  suggestions: string[];
}

const examplePrompts = [
    "اپلیکیشن لیست کارها با HTML، CSS و جاوااسکریپت",
    "بک‌اند وبلاگ با پایتون فلسک و عملیات CRUD",
    "وب‌سایت نمونه کار با React و Tailwind CSS",
    "پلاگین وردپرس برای فرم تماس",
];

const PromptInput: React.FC<PromptInputProps> = ({ prompt, setPrompt, onSubmit, isLoading, showContinue, onContinue, isFinished, isPristine, onCreateFile, onCreateFolder, onUpload, suggestions }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        onSubmit();
      }
    }
  };
  
  const mainButtonText = isPristine ? 'تولید پروژه' : 'آپدیت پروژه';

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-200">کنترل‌ها</h2>
        <div className="flex items-center space-x-1">
           <button onClick={onCreateFile} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md" title="فایل جدید"><PlusIcon className="w-4 h-4" /></button>
           <button onClick={onCreateFolder} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md" title="پوشه جدید"><FolderPlusIcon className="w-4 h-4" /></button>
           <button onClick={onUpload} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-md" title="آپلود Zip"><UploadIcon className="w-4 h-4" /></button>
        </div>
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isPristine ? "مثال: یک CRM ساده با بک‌اند پایتون فلسک..." : "ویژگی بعدی برای اضافه کردن را توصیف کنید..."}
        className="w-full h-24 p-3 bg-slate-800 border border-slate-700 rounded-md focus:ring-2 focus:ring-sky-500 focus:outline-none transition resize-none text-sm"
        disabled={isLoading}
      />
      
      {isPristine && (
         <div className="space-y-2">
            <p className="text-xs text-slate-400">یا یک مثال را امتحان کنید:</p>
            <div className="flex flex-wrap gap-2">
                {examplePrompts.map((p) => (
                    <button
                        key={p}
                        onClick={() => setPrompt(p)}
                        className="px-3 py-1 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                    >
                        {p}
                    </button>
                ))}
            </div>
        </div>
      )}

      {showContinue ? (
         <button
            onClick={onContinue}
            disabled={isLoading}
            className="w-full flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
            {isLoading ? <Spinner /> : 'ادامه تولید'}
        </button>
      ) : (
        <button
            onClick={onSubmit}
            disabled={isLoading || !prompt}
            className="w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 disabled:bg-slate-600 disabled:cursor-not-allowed"
        >
            {isLoading ? <><Spinner className="ml-2"/> در حال پردازش...</> : mainButtonText}
        </button>
      )}

      {isFinished && !isLoading && suggestions && suggestions.length > 0 && (
         <div className="space-y-3 pt-4 border-t border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center">
                <LightbulbIcon className="w-5 h-5 ml-2 text-amber-400" />
                <span>ایده برای ارتقاء</span>
            </h3>
            <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                    <button
                        key={i}
                        onClick={() => setPrompt(s)}
                        className="px-3 py-1 bg-slate-700/60 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                    >
                        {s}
                    </button>
                ))}
            </div>
        </div>
      )}

      {isFinished && !showContinue && (!suggestions || suggestions.length === 0) && (
          <div className="text-center p-2 bg-green-900/50 border border-green-700 rounded-md text-sm text-green-300">
              پردازش با موفقیت به پایان رسید!
          </div>
      )}
    </div>
  );
};

export default PromptInput;