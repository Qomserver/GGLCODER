import React from 'react';

const LightbulbIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.311a7.5 7.5 0 0 1-7.5 0c-1.42-1.42-2.5-3.52-2.5-6.097C4.5 6.09 7.5 3 12 3s7.5 3.09 7.5 7.153c0 2.577-1.08 4.678-2.5 6.097Z" />
    </svg>
);

export default LightbulbIcon;