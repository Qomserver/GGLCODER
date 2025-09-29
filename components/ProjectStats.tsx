import React from 'react';
import { GenerationStats } from '../types';
import FileTextIcon from './icons/FileTextIcon';
import Bars3BottomLeftIcon from './icons/Bars3BottomLeftIcon';
import CpuChipIcon from './icons/CpuChipIcon';
import ClockIcon from './icons/ClockIcon';

interface ProjectStatsProps {
    stats: GenerationStats;
}

const StatItem: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
    <div className="flex items-center space-x-2 space-x-reverse bg-slate-700/30 p-2 rounded-md">
        <div className="text-sky-400">{icon}</div>
        <div className="flex-grow">
            <div className="text-slate-400 text-xs">{label}</div>
            <div className="text-slate-200 font-semibold">{value}</div>
        </div>
    </div>
);

const ProjectStats: React.FC<ProjectStatsProps> = ({ stats }) => {
    return (
        <div className="p-3 bg-slate-800/50 border-y border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">آمار پروژه</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
                <StatItem 
                    icon={<FileTextIcon />}
                    label="فایل‌ها"
                    value={stats.totalFiles}
                />
                 <StatItem 
                    icon={<Bars3BottomLeftIcon />}
                    label="خطوط کد"
                    value={stats.totalLines.toLocaleString('fa-IR')}
                />
                 <StatItem 
                    icon={<CpuChipIcon />}
                    label="حجم پروژه"
                    value={`${(stats.totalSize / 1024).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB`}
                />
                 <StatItem 
                    icon={<ClockIcon />}
                    label="زمان تولید"
                    value={`${(stats.duration / 1000).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}s`}
                />
            </div>
        </div>
    );
};

export default ProjectStats;
