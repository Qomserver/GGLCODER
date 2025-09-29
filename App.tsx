import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Content } from '@google/genai';
import JSZip from 'jszip';
import { FileNode, StreamResponse, GenerationStats, Project, ProjectMetadata, ApiSettings } from './types';
import { getApiService } from './services/geminiService';
import FileTree from './components/FileTree';
import CodeEditor from './components/CodeViewer';
import PromptInput from './components/PromptInput';
import CodeIcon from './components/icons/CodeIcon';
import MenuIcon from './components/icons/MenuIcon';
import CloseIcon from './components/icons/CloseIcon';
import WelcomeScreen from './components/WelcomeScreen';
import ProjectStats from './components/ProjectStats';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useProjectManager } from './hooks/useProjectManager';
import DownloadIcon from './components/icons/DownloadIcon';
import TerminalIcon from './components/icons/TerminalIcon';
import ExecutionTerminal from './components/ExecutionTerminal';
import SettingsIcon from './components/icons/SettingsIcon';
import SettingsModal from './components/SettingsModal';
import ThinkingIndicator from './components/ThinkingIndicator';


// --- Service Configuration ---
const AVALAI_API_KEY = 'aa-1DS8podaPIE7rAKv765HzcWxRE2AjAoGkaw1Ojz0XsvFhRbZ';
const GAPGPT_API_KEY =  'sk-yh9DZpd5IgsdSoNHa7ThUDueQYkLv1RApjksBrD0Ey3R0QeM';
const TALKBOT_API_KEY = 'sk-aa65c63406e9f79bf4f9637cffd66132';

export const providerApiKeys: Record<string, string> = {
    Google: (typeof process !== 'undefined' && process.env?.API_KEY) || '',
    AvalAI: AVALAI_API_KEY,
    GapGPT: GAPGPT_API_KEY,
    TalkBot: TALKBOT_API_KEY,
};

interface AppState {
    prompt: string;
    fileTree: FileNode[];
    fileContents: Record<string, string>;
    selectedFile: string | null;
    isLoading: boolean;
    error: string | null;
    isFinished: boolean;
    showContinue: boolean;
    isSidebarOpen: boolean;
    isTerminalVisible: boolean;
    generationStats: GenerationStats | null;
    projectMetadata: ProjectMetadata | null;
    isSettingsModalOpen: boolean;
    thinkingSteps: string[];
    suggestions: string[];
}

const initialState: AppState = {
    prompt: '',
    fileTree: [],
    fileContents: {},
    selectedFile: null,
    isLoading: false,
    error: null,
    isFinished: false,
    showContinue: false,
    isSidebarOpen: false,
    isTerminalVisible: false,
    generationStats: null,
    projectMetadata: null,
    isSettingsModalOpen: false,
    thinkingSteps: [],
    suggestions: [],
};

const findFirstFile = (nodes: FileNode[]): string | null => {
    for (const node of nodes) {
        if (node.type === 'file') return node.path;
        if (node.type === 'folder') {
            const foundInChild = findFirstFile(node.children);
            if (foundInChild) return foundInChild;
        }
    }
    return null;
};

const sortFileTree = (nodes: FileNode[]): FileNode[] => {
    nodes.sort((a, b) => {
        if (a.type === 'folder' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
    nodes.forEach(node => {
        if (node.type === 'folder') {
            node.children = sortFileTree(node.children);
        }
    });
    return nodes;
};

const addNodeToTree = (nodes: FileNode[], path: string, type: 'file' | 'folder'): FileNode[] => {
    const parts = path.split('/').filter(p => p);
    if (parts.length === 0) return nodes;

    let currentLevel = [...nodes];
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let node = currentLevel.find(n => n.name === part);

        if (!node) {
            const isLastPart = i === parts.length - 1;
            const nodeType = isLastPart ? type : 'folder';
            
            node = { name: part, path: currentPath, type: nodeType, children: [] };
            currentLevel.push(node);
        }

        if (node.type === 'folder') {
            currentLevel = node.children;
        } else if (i < parts.length - 1) {
            console.error("Error: Attempted to create a node inside a file path:", path);
            return nodes; 
        }
    }
    return sortFileTree(nodes);
};

const removeNodeFromTree = (nodes: FileNode[], path: string): FileNode[] => {
    return nodes.filter(node => node.path !== path).map(node => {
        if (node.type === 'folder') {
            return { ...node, children: removeNodeFromTree(node.children, path) };
        }
        return node;
    });
};

const calculateStats = (fileContents: Record<string, string>, duration: number): GenerationStats => {
    const totalFiles = Object.keys(fileContents).length;
    let totalLines = 0;
    let totalSize = 0;
    for (const content of Object.values(fileContents)) {
        totalLines += content.split('\n').length;
        totalSize += new Blob([content]).size;
    }
    return { totalFiles, totalLines, totalSize, duration };
};

const buildPromptWithContext = (prompt: string, fileTree: FileNode[], fileContents: Record<string, string>): string => {
    let context = "The user wants to update the existing project. Here is the current project structure and content:\n\n";
    const addNodeToContext = (node: FileNode, indent: string) => {
        context += `${indent}${node.name}${node.type === 'folder' ? '/' : ''}\n`;
        if (node.type === 'folder') {
            node.children.forEach(child => addNodeToContext(child, indent + '  '));
        }
    };
    fileTree.forEach(node => addNodeToContext(node, ''));
    context += '\n--- FILE CONTENTS ---\n';
    for (const [path, content] of Object.entries(fileContents)) {
        context += `\n--- START OF FILE: ${path} ---\n${content}\n--- END OF FILE: ${path} ---\n`;
    }
    return `Original Request: "${prompt}"\n\n${context}`;
};

const App: React.FC = () => {
    const [state, setState] = useState<AppState>(initialState);
    const { prompt, fileTree, fileContents, selectedFile, isLoading, error, isFinished, showContinue, isSidebarOpen, isTerminalVisible, generationStats, projectMetadata, isSettingsModalOpen, thinkingSteps, suggestions } = state;
    
    const [savedProjects, setSavedProjects] = useLocalStorage<Project[]>('ai-codegen-projects', []);
    const { saveProject, loadProject } = useProjectManager();
    const [apiSettings, setApiSettings] = useLocalStorage<ApiSettings>('ai-codegen-settings', {
        provider: 'Google',
        apiKey: providerApiKeys['Google'] || '',
        model: 'gemini-2.5-flash',
    });
    
    const isPristine = projectMetadata === null;
    const startTimeRef = useRef<number>(0);

    const apiService = useMemo(() => {
        try {
            return getApiService({ ...apiSettings, apiKey: apiSettings.apiKey || providerApiKeys[apiSettings.provider] });
        } catch (e) {
            console.error(e);
            setState(s => ({...s, error: e instanceof Error ? e.message : 'Failed to initialize API service.'}));
            return null;
        }
    }, [apiSettings]);

    useEffect(() => {
        if (projectMetadata && !isLoading) {
            const project: Project = {
                id: projectMetadata.id,
                name: projectMetadata.name,
                prompt,
                fileTree,
                fileContents,
                stats: generationStats,
                createdAt: projectMetadata.createdAt,
            };
            saveProject(project).then(success => {
                if (success) {
                    const updatedSaved = localStorage.getItem('ai-codegen-projects');
                    if(updatedSaved) setSavedProjects(JSON.parse(updatedSaved));
                }
            });
        }
    }, [fileTree, fileContents, generationStats, isLoading, projectMetadata, prompt, saveProject, setSavedProjects]);

    const handleSetState = useCallback((updates: Partial<AppState>) => {
        setState(prevState => ({ ...prevState, ...updates }));
    }, []);

    const handleSelectFile = useCallback((path: string) => {
        handleSetState({ selectedFile: path });
    }, [handleSetState]);

    const handleContentChange = useCallback((newContent: string) => {
        if (selectedFile) {
            handleSetState({
                fileContents: { ...fileContents, [selectedFile]: newContent }
            });
        }
    }, [fileContents, handleSetState, selectedFile]);

    const handleGenerate = useCallback(async (continueGeneration = false) => {
        if (!prompt || !apiService) return;

        handleSetState({ isLoading: true, error: null, isFinished: false, showContinue: false, thinkingSteps: [], suggestions: [] });
        if (!continueGeneration) {
           handleSetState({ fileTree: [], fileContents: {}, selectedFile: null, generationStats: null });
        }
        
        startTimeRef.current = Date.now();
        const history: Content[] = [];
        let finalPrompt = prompt;

        if (isPristine) {
            const newProjectId = `proj_${Date.now()}`;
            handleSetState({ projectMetadata: { id: newProjectId, name: prompt, createdAt: new Date().toISOString() } });
        } else {
            finalPrompt = buildPromptWithContext(prompt, fileTree, fileContents);
        }

        try {
            const stream = apiService.streamGeneration(history, finalPrompt);
            for await (const chunk of stream) {
                const res = chunk as StreamResponse;
                switch (res.action) {
                    case 'THINKING':
                        if (res.content) {
                           handleSetState({ thinkingSteps: [...thinkingSteps, res.content] });
                        }
                        break;
                    case 'CREATE_FILE':
                        if (res.filePath) {
                            const newFileTree = addNodeToTree(fileTree, res.filePath, 'file');
                            handleSetState({ fileTree: newFileTree, fileContents: {...fileContents, [res.filePath]: '' } });
                        }
                        break;
                    case 'APPEND_TO_FILE':
                        if (res.filePath && res.content !== undefined) {
                            const newContent = (fileContents[res.filePath] || '') + res.content;
                            handleSetState({ fileContents: { ...fileContents, [res.filePath]: newContent } });
                        }
                        break;
                    case 'FINISH':
                        const duration = Date.now() - startTimeRef.current;
                        const stats = calculateStats(fileContents, duration);
                        handleSetState({ isFinished: true, isLoading: false, suggestions: res.suggestions || [] });
                        if(fileTree.length > 0 && selectedFile === null) {
                            handleSetState({ selectedFile: findFirstFile(fileTree) });
                        }
                        handleSetState({ generationStats: stats });
                        return;
                    case 'ERROR':
                        handleSetState({ error: res.error || 'An unknown error occurred.', isLoading: false, showContinue: true });
                        return;
                }
            }
        } catch (e: any) {
            console.error("Generation failed:", e);
            handleSetState({ error: e.message || 'An unexpected error occurred.', isLoading: false, showContinue: true });
        }
    }, [prompt, apiService, handleSetState, isPristine, fileTree, fileContents, selectedFile, thinkingSteps]);

    const handleDownloadZip = useCallback(() => {
        const zip = new JSZip();
        Object.entries(fileContents).forEach(([path, content]) => {
            zip.file(path, content);
        });
        zip.generateAsync({ type: 'blob' }).then(content => {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            const projectName = projectMetadata?.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'project';
            link.download = `${projectName}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }, [fileContents, projectMetadata]);

     const handleSaveSettings = useCallback((newSettings: ApiSettings) => {
        setApiSettings(newSettings);
        handleSetState({ isSettingsModalOpen: false });
    }, [handleSetState, setApiSettings]);

    const handleLoadProject = useCallback((projectId: string) => {
        const project = loadProject(projectId);
        if(project) {
            handleSetState({
                prompt: project.prompt,
                fileTree: project.fileTree,
                fileContents: project.fileContents,
                generationStats: project.stats,
                projectMetadata: { id: project.id, name: project.name, createdAt: project.createdAt },
                selectedFile: findFirstFile(project.fileTree),
                isFinished: true,
            });
        }
    }, [loadProject, handleSetState]);

    const handleDeleteNode = useCallback((path: string, type: 'file' | 'folder') => {
        const newFileTree = removeNodeFromTree(fileTree, path);
        const newFileContents = { ...fileContents };
        if (type === 'file') {
             delete newFileContents[path];
        } else { // folder
            Object.keys(newFileContents).forEach(key => {
                if(key.startsWith(path + '/')) {
                    delete newFileContents[key];
                }
            });
        }
        handleSetState({ 
            fileTree: newFileTree, 
            fileContents: newFileContents,
            selectedFile: selectedFile === path ? findFirstFile(newFileTree) : selectedFile
        });
    }, [fileTree, fileContents, selectedFile, handleSetState]);

    return (
        <div className="h-screen w-screen flex flex-col font-sans">
            <header className="bg-slate-800/50 border-b border-slate-700 p-2 flex items-center justify-between z-30">
                <div className="flex items-center space-x-3 space-x-reverse">
                    <button onClick={() => handleSetState({ isSidebarOpen: !isSidebarOpen })} className="p-2 text-slate-400 hover:text-white md:hidden">
                        {isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                    </button>
                    <div className="flex items-center space-x-2 space-x-reverse">
                        <CodeIcon className="w-7 h-7 text-sky-400"/>
                        <h1 className="text-lg font-bold text-slate-200">پلتفرم تولید کد</h1>
                    </div>
                </div>
                <div className="flex items-center space-x-1 space-x-reverse">
                   <button onClick={handleDownloadZip} disabled={fileTree.length === 0} className="p-2 text-slate-400 hover:text-white disabled:opacity-50 disabled:hover:text-slate-400" title="دانلود پروژه (Zip)"><DownloadIcon /></button>
                   <button onClick={() => handleSetState({ isTerminalVisible: !isTerminalVisible })} className={`p-2 hover:text-white ${isTerminalVisible ? 'text-sky-400' : 'text-slate-400'}`} title="ترمینال اجرا"><TerminalIcon /></button>
                   <button onClick={() => handleSetState({ isSettingsModalOpen: true })} className="p-2 text-slate-400 hover:text-white" title="تنظیمات"><SettingsIcon /></button>
                </div>
            </header>
            <main className="flex-grow flex overflow-hidden">
                <aside className={`absolute md:static top-0 right-0 h-full w-80 bg-slate-800 border-l border-slate-700 flex-shrink-0 flex flex-col transition-transform duration-300 ease-in-out z-20 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-80'} md:translate-x-0`}>
                    <div className="flex-grow overflow-y-auto">
                        <FileTree nodes={fileTree} selectedFile={selectedFile} onSelectFile={handleSelectFile} onDeleteNode={handleDeleteNode} />
                        {isLoading && <ThinkingIndicator steps={thinkingSteps} />}
                    </div>
                    {generationStats && <ProjectStats stats={generationStats} />}
                    <PromptInput 
                        prompt={prompt}
                        setPrompt={(p) => handleSetState({ prompt: p })}
                        onSubmit={() => handleGenerate(false)}
                        isLoading={isLoading}
                        isFinished={isFinished}
                        showContinue={showContinue}
                        onContinue={() => handleGenerate(true)}
                        isPristine={isPristine}
                        onCreateFile={() => {}}
                        onCreateFolder={() => {}}
                        onUpload={() => {}}
                        suggestions={suggestions}
                    />
                </aside>
                <div className="flex-grow flex flex-col p-4 overflow-y-auto">
                    {fileTree.length > 0 ? (
                        <CodeEditor
                            filePath={selectedFile}
                            content={selectedFile ? fileContents[selectedFile] : null}
                            onContentChange={handleContentChange}
                        />
                    ) : (
                        <WelcomeScreen onLoadProject={handleLoadProject} savedProjects={savedProjects} />
                    )}
                    {isTerminalVisible && <ExecutionTerminal onClose={() => handleSetState({ isTerminalVisible: false })}/>}
                </div>
            </main>
            <SettingsModal 
                isOpen={isSettingsModalOpen} 
                onClose={() => handleSetState({ isSettingsModalOpen: false })} 
                onSave={handleSaveSettings}
                currentSettings={apiSettings}
                providerApiKeys={providerApiKeys}
            />
            {error && (
                <div className="fixed bottom-4 left-4 max-w-md bg-red-800/90 border border-red-600 text-white p-4 rounded-lg shadow-lg z-50 animate-fade-in-up">
                    <p className="font-bold mb-1">خطا در پردازش</p>
                    <p className="text-sm">{error}</p>
                    <button onClick={() => handleSetState({ error: null })} className="absolute top-2 right-2 text-red-200 hover:text-white">
                        <CloseIcon className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default App;
