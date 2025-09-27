import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Content } from '@google/genai';
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

const providerApiKeys: Record<string, string> = {
    Google: process.env.API_KEY || '',
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
};

const findFirstFile = (nodes: FileNode[]): string | null => {
    for (const node of nodes) {
        if (node.type === 'file') return node.path;
        if (node.type === 'folder') {
            const found = findFirstFile(node.children);
            if (found) return found;
        }
    }
    return null;
};

const App: React.FC = () => {
    const [state, setState] = useState<AppState>(initialState);
    const [savedProjects, setSavedProjects] = useLocalStorage<Project[]>('ai-codegen-projects', []);
    const [apiSettings, setApiSettings] = useLocalStorage<ApiSettings>('ai-codegen-settings', {
        provider: 'Google',
        apiKey: process.env.API_KEY || '',
        model: 'gemini-2.5-flash',
    });
    
    const { saveProject, loadProject } = useProjectManager();

    const fileContentsRef = useRef(state.fileContents);
    const fileTreeRef = useRef(state.fileTree);
    const thinkingStepsRef = useRef(state.thinkingSteps);
    const startTimeRef = useRef<number>(0);
    const chatHistoryRef = useRef<Content[]>([]);
    const uploadInputRef = useRef<HTMLInputElement>(null);
    
    fileContentsRef.current = state.fileContents;
    fileTreeRef.current = state.fileTree;
    thinkingStepsRef.current = state.thinkingSteps;

    const apiService = useMemo(() => getApiService(apiSettings), [apiSettings]);
     useEffect(() => {
        if (!apiSettings.apiKey && apiSettings.provider === 'Google') {
            setApiSettings(prev => ({ ...prev, apiKey: process.env.API_KEY || '' }));
        }
    }, [apiSettings.provider]);

    const updateState = useCallback((updates: Partial<AppState>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    const addNodeToTree = useCallback((path: string, type: 'file' | 'folder') => {
        const parts = path.split('/').filter(Boolean);
        let currentLevel = fileTreeRef.current;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isTarget = i === parts.length - 1;
            const fullPath = parts.slice(0, i + 1).join('/');
            
            let existingNode = currentLevel.find(node => node.name === part);

            if (!existingNode) {
                existingNode = {
                    name: part,
                    path: fullPath,
                    type: isTarget ? type : 'folder',
                    children: [],
                };
                
                currentLevel.push(existingNode);
                currentLevel.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
            }
            
            if (existingNode.type === 'folder') {
                currentLevel = existingNode.children;
            }
        }
        updateState({ fileTree: [...fileTreeRef.current] });
    }, [updateState]);

    const calculateStats = useCallback((): GenerationStats => {
        const files = Object.keys(fileContentsRef.current);
        const totalLines = files.reduce((sum, file) => {
            return sum + (fileContentsRef.current[file]?.split('\n').length || 0);
        }, 0);
        
        const totalSize = files.reduce((sum, file) => {
            return sum + (fileContentsRef.current[file]?.length || 0);
        }, 0);
        
        return {
            totalFiles: files.length,
            totalLines,
            totalSize,
            duration: Date.now() - startTimeRef.current,
        };
    }, []);

    const processStream = useCallback(async (stream: AsyncGenerator<StreamResponse>) => {
        try {
            let streamHasContent = false;
            let fullResponseText = '';

            for await (const chunk of stream) {
                streamHasContent = true;
                switch (chunk.action) {
                    case 'THINKING':
                        if (chunk.content) {
                            const newSteps = [...thinkingStepsRef.current, chunk.content];
                            thinkingStepsRef.current = newSteps;
                            updateState({ thinkingSteps: newSteps });
                        }
                        break;
                    case 'CREATE_FILE':
                        if (chunk.filePath) {
                            addNodeToTree(chunk.filePath, 'file');
                            const newContents = { ...fileContentsRef.current, [chunk.filePath]: '' };
                            fileContentsRef.current = newContents;
                            updateState({
                                fileContents: newContents,
                                selectedFile: state.selectedFile ?? findFirstFile(fileTreeRef.current)
                            });
                        }
                        break;
                    case 'APPEND_TO_FILE':
                        if (chunk.filePath && chunk.content) {
                             const newContents = {
                                ...fileContentsRef.current,
                                [chunk.filePath]: (fileContentsRef.current[chunk.filePath] || '') + chunk.content,
                            };
                            fileContentsRef.current = newContents;
                            updateState({ fileContents: newContents });
                        }
                        break;
                    case 'FINISH':
                        if (chunk.isComplete) {
                            updateState({
                                isFinished: true,
                                showContinue: false,
                                generationStats: calculateStats()
                            });
                             // Add the full response to chat history
                            if (fullResponseText) {
                                chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullResponseText }] });
                            }
                            return;
                        }
                        break;
                    case 'ERROR':
                        if (chunk.error) {
                            updateState({ error: chunk.error, showContinue: false });
                            return;
                        }
                        break;
                }

                // Aggregate the text for history
                if(chunk.action !== 'FINISH' && chunk.action !== 'ERROR'){
                    fullResponseText += JSON.stringify(chunk) + '\n';
                }
            }

            if(streamHasContent) {
                updateState({ showContinue: true });
                 // Add successful partial response to chat history
                if (fullResponseText) {
                    chatHistoryRef.current.push({ role: 'model', parts: [{ text: fullResponseText }] });
                }
            }
        } catch (error) {
            updateState({
                error: error instanceof Error ? error.message : 'پردازش استریم با شکست مواجه شد',
                showContinue: false
            });
        }
    }, [addNodeToTree, updateState, calculateStats, state.selectedFile]);

    const handleGenerate = useCallback(async (isContinuation: boolean = false) => {
        if (!apiSettings.apiKey) {
            updateState({ error: 'کلید API تنظیم نشده است. لطفاً آن را در تنظیمات وارد کنید.' });
            return;
        }

        updateState({ isLoading: true, error: null, isFinished: false, showContinue: false });

        let promptForModel: string;

        if (isContinuation) {
            if (chatHistoryRef.current.length === 0) {
                updateState({ error: 'امکان ادامه وجود ندارد. جلسه تولید کد فعالی یافت نشد.', isLoading: false });
                return;
            }
            promptForModel = "Continue generating the project. Please resume from where you left off and do not repeat any files or code. If all files are complete, send the FINISH action.";
        } else {
            if (!state.prompt) {
                updateState({ isLoading: false });
                return;
            }
            updateState({ fileTree: [], fileContents: {}, selectedFile: null, generationStats: null, projectMetadata: null, isFinished: false, thinkingSteps: [] });
            fileTreeRef.current = [];
            fileContentsRef.current = {};
            startTimeRef.current = Date.now();
            chatHistoryRef.current = []; // Reset history for new generation
            promptForModel = state.prompt;
        }

        try {
            const stream = apiService.streamGeneration(chatHistoryRef.current, promptForModel);
            // Add user prompt to history
            chatHistoryRef.current.push({ role: 'user', parts: [{ text: promptForModel }] });
            await processStream(stream);
        } catch (error) {
            updateState({ error: error instanceof Error ? error.message : 'تولید کد با شکست مواجه شد' });
        } finally {
            updateState({ isLoading: false });
        }
    }, [state.prompt, processStream, updateState, apiService, apiSettings.apiKey]);
    
    const handleSaveSettings = (settings: ApiSettings) => {
        setApiSettings(settings);
        updateState({ isSettingsModalOpen: false });
    };

    // UI HANDLERS
    const handleSelectFile = useCallback((path: string) => {
        updateState({ selectedFile: path });
        if (window.innerWidth < 768) {
            updateState({ isSidebarOpen: false });
        }
    }, [updateState]);

    const { fileTree, projectMetadata, prompt, fileContents, generationStats } = state;
    const handleSaveProject = useCallback(async () => {
        if (fileTree.length === 0) return;
        const project: Project = {
            id: projectMetadata?.id || Date.now().toString(),
            name: prompt.substring(0, 50) || 'پروژه بدون عنوان',
            prompt: prompt,
            fileTree: fileTree,
            fileContents: fileContents,
            stats: generationStats,
            createdAt: projectMetadata?.createdAt || new Date().toISOString(),
        };
        if (await saveProject(project)) {
            const projectsFromStorage = localStorage.getItem('ai-codegen-projects');
            setSavedProjects(projectsFromStorage ? JSON.parse(projectsFromStorage) : []);
        }
    }, [fileTree, projectMetadata, prompt, fileContents, generationStats, saveProject, setSavedProjects]);


    const handleLoadProject = useCallback((projectId: string) => {
        const project = loadProject(projectId);
        if (project) {
            chatHistoryRef.current = [];
            updateState({
                ...initialState,
                prompt: project.prompt,
                fileTree: project.fileTree,
                fileContents: project.fileContents,
                generationStats: project.stats,
                projectMetadata: { id: project.id, name: project.name, createdAt: project.createdAt },
                selectedFile: findFirstFile(project.fileTree),
                showContinue: false,
                isFinished: true,
            });
        }
    }, [loadProject, updateState]);
    
    const handleExportToZip = useCallback(async () => {
        if (state.fileTree.length === 0) return;
        
        const zip = new JSZip();
        Object.entries(state.fileContents).forEach(([path, content]) => {
            zip.file(path, content);
        });

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const projectName = (state.prompt.substring(0, 30) || 'project').replace(/[\s/]/g, '-');
        a.href = url;
        a.download = `${projectName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [state.fileContents, state.fileTree, state.prompt]);

    const handleUploadClick = () => uploadInputRef.current?.click();

    const handleFileUploaded = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        updateState({ isLoading: true, error: null });
        try {
            const zip = await JSZip.loadAsync(file);
            const newFileContents: Record<string, string> = {};
            const promises: Promise<void>[] = [];
            
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir) {
                    promises.push(zipEntry.async('string').then(content => {
                        newFileContents[zipEntry.name] = content;
                    }));
                }
            });
            await Promise.all(promises);

            fileTreeRef.current = [];
            Object.keys(newFileContents).sort().forEach(path => addNodeToTree(path, 'file'));
            
            chatHistoryRef.current = [];
            updateState({
                ...initialState,
                prompt: `پروژه از ${file.name} بارگذاری شد`,
                fileTree: [...fileTreeRef.current],
                fileContents: newFileContents,
                projectMetadata: { id: Date.now().toString(), name: file.name.replace('.zip', ''), createdAt: new Date().toISOString() },
                selectedFile: findFirstFile(fileTreeRef.current),
                isFinished: true,
            });
        } catch (e) {
            updateState({ error: 'خواندن فایل ZIP با شکست مواجه شد. لطفاً از معتبر بودن فایل اطمینان حاصل کنید.' });
        } finally {
            updateState({ isLoading: false });
            if (event.target) event.target.value = '';
        }
    };

    const handleCreateFile = () => {
        // FIX: Use `window.prompt` to avoid conflict with the `prompt` state variable which is a string.
        const path = window.prompt("مسیر فایل جدید را وارد کنید (مثال: src/components/Button.tsx):");
        if (path) {
            addNodeToTree(path, 'file');
            updateState({ fileContents: {...state.fileContents, [path]: ''}, selectedFile: path });
        }
    };

    const handleCreateFolder = () => {
        // FIX: Use `window.prompt` to avoid conflict with the `prompt` state variable which is a string.
        const path = window.prompt("مسیر پوشه جدید را وارد کنید (مثال: src/assets):");
        if (path) {
            addNodeToTree(path, 'folder');
        }
    };
    
    const handleDeleteNode = (path: string, type: 'file' | 'folder') => {
        const newFileContents = { ...state.fileContents };
        const pathsToDelete = type === 'folder' 
            ? Object.keys(newFileContents).filter(p => p.startsWith(path + '/'))
            : [path];
        
        pathsToDelete.forEach(p => delete newFileContents[p]);
        if (type === 'file') delete newFileContents[path];

        const removeNode = (nodes: FileNode[], nodePath: string): FileNode[] => {
            return nodes.filter(node => node.path !== nodePath).map(node => {
                if (node.type === 'folder') {
                    return { ...node, children: removeNode(node.children, nodePath) };
                }
                return node;
            });
        };
        
        const newFileTree = removeNode(state.fileTree, path);
        fileTreeRef.current = newFileTree;
        
        updateState({
            fileTree: newFileTree,
            fileContents: newFileContents,
            selectedFile: state.selectedFile && pathsToDelete.includes(state.selectedFile) ? null : state.selectedFile
        });
    };
    
    const handleContentChange = (newContent: string) => {
        if(state.selectedFile) {
            const newFileContents = { ...state.fileContents, [state.selectedFile]: newContent };
            fileContentsRef.current = newFileContents;
            updateState({ fileContents: newFileContents });
        }
    }

    const isPristine = state.fileTree.length === 0;

    const Header = useMemo(() => (
        <header className="bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 p-3 flex items-center justify-between z-20 sticky top-0 md:relative">
            <div className="flex items-center space-x-3">
                <CodeIcon className="w-7 h-7 text-sky-400" />
                <h1 className="text-xl font-bold text-slate-100 hidden sm:block">پلتفرم تولید کد با هوش مصنوعی</h1>
            </div>
            <div className="flex items-center space-x-2">
                 <button onClick={() => updateState({isTerminalVisible: !state.isTerminalVisible})} className="flex items-center space-x-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-md transition-colors" title="نمایش/مخفی کردن ترمینال اجرای کد">
                    <TerminalIcon className="w-5 h-5" />
                    <span className="hidden lg:block">اجرا کننده</span>
                 </button>
                 <button onClick={() => updateState({ isSettingsModalOpen: true })} className="p-2 text-slate-300 hover:text-white transition-colors" title="تنظیمات">
                    <SettingsIcon className="w-5 h-5" />
                </button>
                {!isPristine && (
                    <>
                        <button onClick={handleSaveProject} className="hidden md:block px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white text-sm rounded-md transition-colors">ذخیره</button>
                        <button onClick={handleExportToZip} className="flex items-center space-x-2 px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md transition-colors" title="خروجی ZIP از پروژه">
                            <DownloadIcon className="w-4 h-4" />
                            <span className="hidden lg:block">خروجی ZIP</span>
                        </button>
                    </>
                )}
                <button onClick={() => updateState({ isSidebarOpen: !state.isSidebarOpen })} className="md:hidden p-1 text-slate-300 hover:text-white transition-colors" aria-label="نمایش/مخفی کردن نوار کناری">
                    {state.isSidebarOpen ? <CloseIcon /> : <MenuIcon />}
                </button>
            </div>
        </header>
    ), [state.isSidebarOpen, state.isTerminalVisible, isPristine, updateState, handleSaveProject, handleExportToZip]);

    const Sidebar = useMemo(() => (
        <aside className="flex flex-col h-full bg-slate-900 md:border-l md:border-slate-800">
            <input type="file" ref={uploadInputRef} onChange={handleFileUploaded} accept=".zip" style={{ display: 'none' }} />
            <PromptInput prompt={state.prompt} setPrompt={(p) => updateState({ prompt: p })} onSubmit={() => handleGenerate(false)} onContinue={() => handleGenerate(true)} isLoading={state.isLoading} isFinished={state.isFinished} showContinue={state.showContinue} isPristine={isPristine} onCreateFile={handleCreateFile} onCreateFolder={handleCreateFolder} onUpload={handleUploadClick} />
            {state.generationStats && <ProjectStats stats={state.generationStats} />}
            <div className="flex-grow overflow-y-auto border-t border-slate-800">
                <FileTree nodes={state.fileTree} selectedFile={state.selectedFile} onSelectFile={handleSelectFile} onDeleteNode={handleDeleteNode} />
            </div>
        </aside>
    ), [state.prompt, state.isLoading, state.isFinished, state.showContinue, state.fileTree, state.selectedFile, state.generationStats, isPristine, updateState, handleGenerate, handleSelectFile, handleDeleteNode, handleFileUploaded]);

    return (
        <div className="h-screen w-screen flex flex-col">
            {Header}
             <SettingsModal 
                isOpen={state.isSettingsModalOpen}
                onClose={() => updateState({ isSettingsModalOpen: false })}
                currentSettings={apiSettings}
                onSave={handleSaveSettings}
                providerApiKeys={providerApiKeys}
            />
            <main className="flex-grow flex relative overflow-hidden">
                <div className={`fixed inset-0 bg-black/50 z-20 md:hidden ${state.isSidebarOpen ? 'block' : 'hidden'}`} onClick={() => updateState({ isSidebarOpen: false })} />
                
                <div className="flex-grow h-full p-0 md:p-4 flex flex-col">
                     {state.error && (
                        <div className="absolute top-4 left-4 bg-red-800/90 border border-red-600 text-white p-4 rounded-lg shadow-lg z-50 max-w-md">
                            <div className="flex justify-between items-start"><p className="font-bold">خطا</p><button onClick={() => updateState({ error: null })} className="mr-4 text-red-200 hover:text-white"><CloseIcon className="w-5 h-5" /></button></div>
                            <p className="mt-2 text-sm">{state.error}</p>
                        </div>
                    )}
                    <div className="flex-grow min-h-0">
                        {isPristine && !state.isLoading && !state.error ? (
                            <WelcomeScreen onLoadProject={handleLoadProject} savedProjects={savedProjects} />
                        ) : state.isLoading && isPristine ? (
                            <div className="h-full flex flex-col justify-start text-slate-500 bg-[#282c34] rounded-lg p-4 overflow-y-auto">
                                <ThinkingIndicator steps={state.thinkingSteps} />
                            </div>
                        ) : (
                            <CodeEditor filePath={state.selectedFile} content={state.selectedFile ? state.fileContents[state.selectedFile] : null} onContentChange={handleContentChange} />
                        )}
                    </div>
                    {state.isTerminalVisible && <ExecutionTerminal onClose={() => updateState({isTerminalVisible: false})} />}
                </div>

                <div className={`fixed top-0 right-0 h-full w-80 z-30 transition-transform duration-300 ease-in-out md:hidden ${state.isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                    {Sidebar}
                </div>
                <div className="hidden md:block w-96 lg:w-[450px] flex-shrink-0 h-full">
                    {Sidebar}
                </div>
            </main>
        </div>
    );
};

export default App;