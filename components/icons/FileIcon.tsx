import React from 'react';

const FileIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V8.707a2 2 0 00-.586-1.414l-4.293-4.293A2 2 0 0010.707 2H4zm5.5 1.5v2.25a.75.75 0 00.75.75h2.25a.75.75 0 000-1.5h-1.5V3.5a.75.75 0 00-1.5 0z" clipRule="evenodd" />
  </svg>
);

export default FileIcon;
