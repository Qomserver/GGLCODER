import React from 'react';

const CpuChipIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 21v-1.5M15.75 3v1.5M19.5 8.25H21M19.5 12H21m-3.75 3.75H21m-15-3.75h.008v.008H4.5v-.008Zm15 0h.008v.008H19.5v-.008Zm-7.5 0h.008v.008H12v-.008Zm0 3.75h.008v.008H12v-.008Zm0-7.5h.008v.008H12v-.008Zm-3.75 0h.008v.008H8.25v-.008Zm7.5 0h.008v.008H15.75v-.008Zm-3.75 3.75h.008v.008H12v-.008Zm0-7.5h.008v.008H12v-.008Zm-3.75 3.75h.008v.008H8.25v-.008Zm7.5 0h.008v.008H15.75v-.008Zm-3.75 7.5h.008v.008H12v-.008Zm-3.75 0h.008v.008H8.25v-.008Zm7.5 0h.008v.008H15.75v-.008Z" />
    </svg>
);

export default CpuChipIcon;
