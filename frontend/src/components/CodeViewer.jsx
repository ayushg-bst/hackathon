import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import './CodeViewer.css';

const CodeViewer = ({ filePath, highlightStart, highlightEnd, repoPath }) => {
  const [codeContent, setCodeContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fileInfo, setFileInfo] = useState({ lines: 0, size: 0 });
  const editorRef = useRef(null);

  // Helper function to handle editor mounting
  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    
    // Check if content is available and set it
    if (codeContent) {
      editor.setValue(codeContent);
      
      // Explicitly tell Monaco to layout after setting content
      setTimeout(() => {
        editor.layout();
        // Force refresh syntax highlighting
        monaco.editor.setModelLanguage(editor.getModel(), language);
      }, 100);
    }
  }

  // Helper function to determine language from file extension
  const getLanguageFromPath = (path) => {
    if (!path) return 'plaintext';
    
    const extension = path.split('.').pop().toLowerCase();
    const languageMap = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      html: 'html',
      css: 'css',
      json: 'json',
      md: 'markdown',
      txt: 'plaintext',
      xml: 'xml',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      sql: 'sql',
      yaml: 'yaml',
      yml: 'yaml',
    };

    return languageMap[extension] || 'plaintext';
  };

  // Get language display name for UI
  const getLanguageDisplayName = (languageId) => {
    const displayNames = {
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      java: 'Java',
      html: 'HTML',
      css: 'CSS',
      json: 'JSON',
      markdown: 'Markdown',
      plaintext: 'Plain Text',
      xml: 'XML',
      cpp: 'C++',
      c: 'C',
      csharp: 'C#',
      go: 'Go',
      rust: 'Rust',
      php: 'PHP',
      ruby: 'Ruby',
      shell: 'Shell',
      sql: 'SQL',
      yaml: 'YAML'
    };

    return displayNames[languageId] || languageId;
  };

  useEffect(() => {
    let isMounted = true; // Flag to track mount status

    // Only fetch if filePath is provided
    if (!filePath) {
      setCodeContent('');
      return;
    }

    const fetchFileContent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Use the filePath prop directly, assuming it's already normalized by App.jsx
        const normalizedPath = filePath;
        
        // Encode URL components to handle spaces and special characters
        const encodedPath = encodeURIComponent(normalizedPath);
        
        // Use the browser API with the normalized path
        const url = `http://127.0.0.1:8000/browse/${encodedPath}`;
        
        // Track the request and response headers for debugging
        const config = {
          timeout: 15000, // Extend timeout for larger files
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };
        
        const response = await axios.get(url, config);
        
        if (isMounted && response.data && typeof response.data.content === 'string') {
          const content = response.data.content;
          
          setCodeContent(content);
          
          // Calculate basic file info
          const lines = content.split('\n').length;
          const size = new Blob([content]).size;
          setFileInfo({
            lines,
            size: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
          });
        } else if (isMounted) {
          setError('Received an invalid response format from the server');
          setCodeContent('');
        }
      } catch (err) {
        if (isMounted) {
          let errorMessage = 'Failed to fetch file content';
          if (err.response?.status === 404) {
            errorMessage = `File not found: ${filePath}`;
          } else if (err.response?.data?.detail) {
            errorMessage = err.response.data.detail;
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          setError(errorMessage);
          setCodeContent('');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    // Use the flag for cleanup
    fetchFileContent();
    
    return () => {
      isMounted = false;
    };
  }, [filePath]);

  // Update editor instance when codeContent changes and ref is ready
  useEffect(() => {
    if (editorRef.current && codeContent) {
      // Check if the editor content is already the same to avoid unnecessary updates
      if (editorRef.current.getValue() !== codeContent) {
        editorRef.current.setValue(codeContent);
      }
    } else if (editorRef.current && !codeContent) {
       // Handle clearing the editor if filePath becomes null/empty
       editorRef.current.setValue('');
    }
  }, [codeContent]);

  // Determine language for syntax highlighting
  const language = getLanguageFromPath(filePath);
  const languageDisplayName = getLanguageDisplayName(language);

  // Get file name from path
  const fileName = filePath ? filePath.split('/').pop() : '';

  if (loading) {
    return (
      <div className="code-viewer">
        <div className="code-viewer-header">
          <div className="file-path">{filePath || 'No file selected'}</div>
        </div>
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <div>Loading file content...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="code-viewer">
        <div className="code-viewer-header">
          <div className="file-path">{filePath || 'Error'}</div>
        </div>
        <div className="error-message">
          <div>Error: {error}</div>
        </div>
      </div>
    );
  }

  if (!filePath) {
    return (
      <div className="code-viewer">
        <div className="code-viewer-header">
          <div className="file-path">No file selected</div>
        </div>
        <div className="empty-state">
          Select a file from the file browser to view its contents
        </div>
      </div>
    );
  }

  return (
    <div className="code-viewer">
      <div className="code-viewer-header">
        <div className="file-path">{fileName}</div>
        <div className="file-info">
          <span className="file-language">{languageDisplayName}</span>
          <span className="file-stats">{fileInfo.lines} lines • {fileInfo.size}</span>
        </div>
      </div>
      
      <div className="editor-container">
        <Editor
          height="calc(90vh - 60px)"
          language={language}
          theme="vs-dark"
          defaultValue={codeContent || ''} 
          value={codeContent || ''}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            highlightActiveIndentGuide: true,
            renderIndentGuides: true,
            fixedOverflowWidgets: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: true,
              verticalHasArrows: false,
              horizontalHasArrows: false,
              alwaysConsumeMouseWheel: false
            },
            overviewRulerLanes: 0
          }}
          onMount={handleEditorDidMount}
        />
        
        {/* Fallback display - a simple textarea showing the code content */}
        {codeContent && !editorRef.current && (
          <textarea 
            style={{
              width: '100%',
              height: '300px',
              fontFamily: 'monospace',
              fontSize: '14px',
              padding: '10px',
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              border: 'none',
              resize: 'none'
            }}
            readOnly
            value={codeContent}
          />
        )}
      </div>
    </div>
  );
};

export default CodeViewer;