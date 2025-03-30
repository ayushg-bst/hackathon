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
    console.log('CodeViewer: Editor instance mounted');
    
    // Check if content was already loaded BEFORE mount completed
    if (codeContent) {
      console.log('CodeViewer: Content exists on mount, calling editor.setValue()');
      editor.setValue(codeContent);
      console.log('CodeViewer: Finished calling editor.setValue() from handleEditorDidMount'); // Log after call
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
        
        // Log the path being requested for debugging
        console.log('CodeViewer: Fetching file content for:', normalizedPath);
        
        // Encode URL components to handle spaces and special characters
        const encodedPath = encodeURIComponent(normalizedPath);
        console.log('Encoded URL path:', encodedPath);
        
        // Use the browser API with the normalized path
        const url = `http://127.0.0.1:8000/browse/${encodedPath}`;
        console.log('Full request URL:', url);
        
        // Track the request and response headers for debugging
        const config = {
          timeout: 15000, // Extend timeout for larger files
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        };
        
        const response = await axios.get(url, config);
        
        console.log('CodeViewer: Response status:', response.status);
        
        if (isMounted && response.data && typeof response.data.content === 'string') { // Check isMounted
          console.log('CodeViewer: Inside success block (isMounted=true, valid response)'); // Log 1
          const content = response.data.content;
          console.log(`CodeViewer: Content retrieved, length: ${content.length}`); // Log 2 (replaces old log)
          
          console.log('CodeViewer: About to call setCodeContent'); // Log 3
          setCodeContent(content);
          console.log('CodeViewer: Finished calling setCodeContent'); // Log 4
          
          // Calculate basic file info
          console.log('CodeViewer: About to calculate file info'); // Log 5
          const lines = content.split('\n').length;
          const size = new Blob([content]).size;
          console.log('CodeViewer: Finished calculating file info'); // Log 6
          setFileInfo({
            lines,
            size: size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`
          });
        } else if (isMounted) { // Check isMounted
          console.error('CodeViewer: Unexpected response format or component unmounted:', response.data);
          setError('Received an invalid response format from the server or component unmounted');
          setCodeContent('');
        }
      } catch (err) {
        console.error('Error fetching file content:', err);
        if (isMounted) { // Check isMounted
          console.error('Error details:', err.response?.data);
          
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
        if (isMounted) { // Check isMounted
          setLoading(false);
        }
      }
    };
    
    // Use the flag for cleanup
    fetchFileContent();
    
    return () => {
      isMounted = false; // Set flag to false on unmount
      console.log("CodeViewer cleanup for path:", filePath); // Log cleanup
    };
  }, [filePath]);

  // NEW useEffect: Update editor instance when codeContent changes and ref is ready
  useEffect(() => {
    console.log(`CodeViewer: Second useEffect running. editorRef.current is ${editorRef.current ? 'set' : 'null'}. codeContent length is ${codeContent?.length ?? 0}.`); // Log state inside effect
    if (editorRef.current && codeContent) {
      // Check if the editor content is already the same to avoid unnecessary updates
      if (editorRef.current.getValue() !== codeContent) {
        console.log('CodeViewer: codeContent changed, ref exists. Calling editor.setValue()');
        editorRef.current.setValue(codeContent);
        console.log('CodeViewer: Finished calling editor.setValue() via second useEffect'); // Log after call
      } else {
         console.log('CodeViewer: Second useEffect - content is same as editor value, skipping setValue.'); // Add log for same content case
      }
    } else if (editorRef.current && !codeContent) {
       // Handle clearing the editor if filePath becomes null/empty
       console.log('CodeViewer: codeContent is empty, ref exists. Clearing editor.');
       editorRef.current.setValue('');
    } else {
        console.log(`CodeViewer: Second useEffect - condition not met (editorRef: ${!!editorRef.current}, codeContent: ${!!codeContent})`); // Log if condition failed
    }
  }, [codeContent]); // Depend only on codeContent

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
          <details>
            <summary>Debug Information</summary>
            <pre>File path received: {filePath}</pre>
            <pre>URL path used: {encodeURIComponent(filePath)}</pre>
          </details>
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
          height="100%"
          language={language}
          theme="vs-dark"
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
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
};

export default CodeViewer; 