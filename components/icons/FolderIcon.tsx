import React from 'react';

const FolderIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M2 4.75A2.75 2.75 0 014.75 2h5.5a.75.75 0 01.6.3L12.5 4H17.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H4.75A1.25 1.25 0 003.5 4.75v10.5c0 .69.56 1.25 1.25 1.25h10.5a1.25 1.25 0 001.25-1.25V8.75a.75.75 0 011.5 0v6.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25V4.75z" clipRule="evenodd" />
  </svg>
);

export default FolderIcon;
