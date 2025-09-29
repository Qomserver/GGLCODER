export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children: FileNode[];
  size?: number;
  language?: string;
}

export interface StreamResponse {
  action: 'CREATE_FILE' | 'APPEND_TO_FILE' | 'FINISH' | 'ERROR' | 'THINKING';
  filePath?: string;
  content?: string;
  isComplete?: boolean;
  error?: string;
  suggestions?: string[];
}

export interface GenerationStats {
    totalFiles: number;
    totalLines: number;
    totalSize: number; // in bytes
    duration: number; // in milliseconds
}

export interface ProjectMetadata {
    id: string;
    name: string;
    createdAt: string;
}

export interface Project {
    id: string;
    name: string;
    prompt: string;
    fileTree: FileNode[];
    fileContents: Record<string, string>;
    stats: GenerationStats | null;
    createdAt: string;
}

export interface ApiSettings {
    provider: 'Google' | 'AvalAI' | 'GapGPT' | 'TalkBot';
    apiKey: string;
    model: string;
}