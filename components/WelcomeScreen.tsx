import React from 'react';
import CodeIcon from './icons/CodeIcon';
import { Project } from '../types';

interface WelcomeScreenProps {
  onLoadProject: (id: string) => void;
  savedProjects: Project[];
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLoadProject, savedProjects }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fa-IR', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-[#282c34] rounded-lg p-8 overflow-y-auto">
      <div className="text-center max-w-lg">
        <CodeIcon className="mx-auto h-16 w-16 text-slate-600 mb-4" />
        <h2 className="text-2xl font-bold text-slate-300 mb-2">به پلتفرم تولید کد با هوش مصنوعی خوش آمدید</h2>
        <p className="text-slate-400 mb-6">
          برای شروع، پروژه‌ای را که می‌خواهید بسازید در کادر ورودی توصیف کنید. هوش مصنوعی ساختار کامل فایل و کد را برای شما تولید خواهد کرد.
        </p>
        <p className="text-sm text-slate-500">
          برای مثال، چیزی شبیه این را امتحان کنید: <br />
          <span className="font-mono text-sky-400/70">"یک CRM ساده با پایتون و React"</span>
        </p>
      </div>

      {savedProjects && savedProjects.length > 0 && (
        <div className="mt-12 w-full max-w-lg">
          <h3 className="text-lg font-semibold text-slate-300 mb-4 text-center">یا یک پروژه اخیر را بارگذاری کنید</h3>
          <div className="space-y-3">
            {savedProjects.map(project => (
              <button
                key={project.id}
                onClick={() => onLoadProject(project.id)}
                className="w-full text-left p-3 bg-slate-800/50 hover:bg-slate-700/70 rounded-lg transition-colors duration-200"
              >
                <p className="font-semibold text-sky-400 truncate">{project.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  ذخیره شده در {formatDate(project.createdAt)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WelcomeScreen;