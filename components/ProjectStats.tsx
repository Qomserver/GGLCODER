import React from 'react';
import { GenerationStats } from '../types';

interface ProjectStatsProps {
    stats: GenerationStats;
}

const ProjectStats: React.FC<ProjectStatsProps> = ({ stats }) => {
    return (
        <div className="p-3 bg-slate-800/50 border-y border-slate-700">
            <h3 className="text-xs font-semibold text-slate-400 mb-2">آمار پروژه</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                    <span className="text-slate-500">فایل‌ها:</span>
                    <span className="ml-1 text-slate-300 font-medium">{stats.totalFiles}</span>
                </div>
                <div>
                    <span className="text-slate-500">خطوط:</span>
                    <span className="ml-1 text-slate-300 font-medium">{stats.totalLines.toLocaleString('fa-IR')}</span>
                </div>
                <div>
                    <span className="text-slate-500">حجم:</span>
                    <span className="ml-1 text-slate-300 font-medium">{(stats.totalSize / 1024).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB</span>
                </div>
                <div>
                    <span className="text-slate-500">زمان:</span>
                    <span className="ml-1 text-slate-300 font-medium">{(stats.duration / 1000).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s</span>
                </div>
            </div>
        </div>
    );
};

export default ProjectStats;