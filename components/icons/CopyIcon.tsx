import React from 'react';

const CopyIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.03 1.125 0 1.131.094 1.976 1.057 1.976 2.192V7.5M8.25 7.5h7.5M8.25 7.5H5.106c-1.135 0-2.098.845-2.192 1.976-.03.373-.03.748 0 1.125.094 1.131 1.057 1.976 2.192 1.976h13.788c1.135 0 2.098-.845 2.192-1.976.03-.373.03-.748 0-1.125-.094-1.131-1.057-1.976-2.192-1.976H8.25Z" />
    </svg>
);

export default CopyIcon;