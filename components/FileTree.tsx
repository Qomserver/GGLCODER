import React, { useState } from 'react';
import { FileNode } from '../types';
import FolderIcon from './icons/FolderIcon';
import FileIcon from './icons/FileIcon';
import TrashIcon from './icons/TrashIcon';

interface FileTreeProps {
  nodes: FileNode[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  onDeleteNode: (path: string, type: 'file' | 'folder') => void;
}

const TreeNode: React.FC<{ node: FileNode; selectedFile: string | null; onSelectFile: (path: string) => void; onDeleteNode: (path: string, type: 'file' | 'folder') => void; level: number }> = ({ node, selectedFile, onSelectFile, onDeleteNode, level }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const isSelected = selectedFile === node.path;

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nodeType = node.type === 'file' ? 'فایل' : 'پوشه';
    if (window.confirm(`آیا از حذف ${nodeType} «${node.name}» اطمینان دارید؟`)) {
      onDeleteNode(node.path, node.type);
    }
  };

  if (node.type === 'folder') {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="flex items-center justify-between space-x-2 cursor-pointer p-1 rounded-md hover:bg-slate-700"
          style={{ paddingRight: `${level * 1}rem` }}
        >
          <div className="flex items-center space-x-2">
            <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </span>
            <FolderIcon className="w-5 h-5 text-sky-400" />
            <span className="text-sm text-slate-300">{node.name}</span>
          </div>
          {isHovered && (
             <button onClick={handleDelete} className="p-1 text-slate-500 hover:text-red-400">
                <TrashIcon className="w-4 h-4" />
             </button>
          )}
        </div>
        {isOpen && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.path} node={child} selectedFile={selectedFile} onSelectFile={onSelectFile} onDeleteNode={onDeleteNode} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`flex items-center justify-between space-x-2 cursor-pointer p-1 rounded-md ${isSelected ? 'bg-sky-900/50' : 'hover:bg-slate-700'}`}
      style={{ paddingRight: `${level * 1}rem` }}
    >
      <div className="flex items-center space-x-2">
         <FileIcon className="w-5 h-5 text-slate-400 mr-4" />
         <span className={`text-sm ${isSelected ? 'text-sky-300 font-medium' : 'text-slate-300'}`}>{node.name}</span>
      </div>
       {isHovered && (
         <button onClick={handleDelete} className="p-1 text-slate-500 hover:text-red-400">
            <TrashIcon className="w-4 h-4" />
         </button>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ nodes, selectedFile, onSelectFile, onDeleteNode }) => {
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        ساختار پروژه در اینجا نمایش داده خواهد شد...
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {nodes.map(node => (
        <TreeNode key={node.path} node={node} selectedFile={selectedFile} onSelectFile={onSelectFile} onDeleteNode={onDeleteNode} level={0} />
      ))}
    </div>
  );
};

export default FileTree;