import React, { useState, useEffect, useRef } from 'react';
import CopyIcon from './icons/CopyIcon';

interface CodeEditorProps {
  content: string | null;
  filePath: string | null;
  onContentChange: (newContent: string) => void;
}

const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    html: 'xml', // highlight.js uses 'xml' for html
    css: 'css',
    json: 'json',
    md: 'markdown',
    sh: 'bash',
    sql: 'sql',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    rs: 'rust',
    yml: 'yaml',
    yaml: 'yaml',
};

const getLanguageFromPath = (path: string | null): string => {
    if (!path) return 'plaintext';
    const extension = path.split('.').pop()?.toLowerCase() || '';
    return languageMap[extension] || 'plaintext';
};

const CodeEditor: React.FC<CodeEditorProps> = ({ content, filePath, onContentChange }) => {
  const [displayedContent, setDisplayedContent] = useState('');
  const [highlightedContent, setHighlightedContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const prevFilePathRef = useRef<string | null | undefined>(undefined);
  const isUserScrolledUp = useRef(false);
  const userEditTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const prevFilePath = prevFilePathRef.current;
    prevFilePathRef.current = filePath;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    const targetContent = content || '';

    if (filePath !== prevFilePath) {
      setDisplayedContent(targetContent);
      isUserScrolledUp.current = false;
      return;
    }

    if (targetContent.startsWith(displayedContent) && targetContent.length > displayedContent.length) {
      const diff = targetContent.substring(displayedContent.length);
      let i = 0;
      const type = () => {
        if (i < diff.length) {
          setDisplayedContent(prev => prev + diff.charAt(i));
          i++;
          typingTimeoutRef.current = window.setTimeout(type, 5);
        }
      };
      type();
    } else if (displayedContent !== targetContent) {
      // To prevent a race condition where user edits are reverted by a stale `content` prop,
      // we only snap the content to the prop value if the user is not actively typing.
      if (userEditTimeoutRef.current === null) {
        setDisplayedContent(targetContent);
      }
    }
  }, [content, filePath]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }

    // Set a short timeout to indicate the user is actively editing.
    // During this time, the useEffect will not snap content back.
    if (userEditTimeoutRef.current) {
        clearTimeout(userEditTimeoutRef.current);
    }
    userEditTimeoutRef.current = window.setTimeout(() => {
        userEditTimeoutRef.current = null;
    }, 200);

    setDisplayedContent(e.target.value);
    onContentChange(e.target.value);
  };

  useEffect(() => {
    const language = getLanguageFromPath(filePath);
    if ((window as any).hljs) {
        try {
            const result = (window as any).hljs.highlight(displayedContent, { language, ignoreIlleals: true });
            setHighlightedContent(result.value);
        } catch (e) {
            setHighlightedContent(displayedContent);
        }
    } else {
        setHighlightedContent(displayedContent);
    }
  }, [displayedContent, filePath]);
  
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (preRef.current) {
          preRef.current.scrollTop = e.currentTarget.scrollTop;
          preRef.current.scrollLeft = e.currentTarget.scrollLeft;
      }
      const el = e.currentTarget;
      const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 5;
      isUserScrolledUp.current = !isAtBottom;
  };
  
   useEffect(() => {
    if (preRef.current && !isUserScrolledUp.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
    if (textareaRef.current && !isUserScrolledUp.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [highlightedContent]);

  useEffect(() => {
    setIsCopied(false);
  }, [filePath]);

  const handleCopy = () => {
    if (displayedContent) {
        navigator.clipboard.writeText(displayedContent).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }).catch(err => console.error('Failed to copy text: ', err));
    }
  };

  if (filePath === null) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 bg-[#282c34] rounded-lg">
        <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
            <p className="mt-2 text-sm">برای مشاهده محتوا، یک فایل را انتخاب کنید.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-full bg-[#282c34] rounded-lg overflow-hidden relative font-mono text-sm">
      <div className="absolute top-0 left-0 right-0 p-3 bg-slate-800/80 backdrop-blur-sm border-b border-slate-700 flex justify-between items-center z-20">
          <p className="text-sm text-slate-400">{filePath}</p>
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded-md text-xs text-slate-300 transition-all duration-200 disabled:opacity-50"
            disabled={!displayedContent}
            aria-label="کپی کد در کلیپ‌بورد"
          >
            {isCopied ? (
                <span className="text-green-400">کپی شد!</span>
            ) : (
                <>
                    <CopyIcon className="w-4 h-4" />
                    <span>کپی</span>
                </>
            )}
          </button>
      </div>

      <div className="h-full w-full relative">
        <textarea
            ref={textareaRef}
            value={displayedContent}
            onChange={handleChange}
            onScroll={handleScroll}
            className="absolute top-0 left-0 w-full h-full pt-16 p-4 bg-transparent outline-none resize-none font-mono text-transparent caret-white z-10"
            style={{ WebkitTextFillColor: 'transparent', direction: 'ltr' }}
            spellCheck="false"
            autoCorrect="off"
            autoCapitalize="off"
        />
        <pre ref={preRef} className="h-full w-full overflow-auto pt-16 p-4 pointer-events-none absolute top-0 left-0" style={{ direction: 'ltr' }}>
            <code className={`language-${getLanguageFromPath(filePath)}`} dangerouslySetInnerHTML={{ __html: highlightedContent + '\n' }} />
        </pre>
      </div>
    </div>
  );
};

export default CodeEditor;