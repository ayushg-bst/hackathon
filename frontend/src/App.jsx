import { useState, useEffect } from 'react'
import axios from 'axios';
import FileBrowser from './components/FileBrowser'
import CodeViewer from './components/CodeViewer'
import SearchPanel from './components/SearchPanel'
import QueryPanel from './components/QueryPanel'
import DefinitionFinder from './components/DefinitionFinder'
import './App.css'

function App() {
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState({ start: 0, end: 0 });
  const [forceRender, setForceRender] = useState(0);
  const [config, setConfig] = useState({ repo_path: '' });
  const [isQAPanelOpen, setIsQAPanelOpen] = useState(false); // Start closed

  // Fetch configuration from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/config');
        setConfig(response.data);
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  const handlePathChange = (newPath) => {
    // Check if the path is valid
    if (newPath === undefined || newPath === null) {
      return;
    }
    
    // Clean up the path - remove any leading/trailing whitespace
    const cleanPath = newPath.trim();
    
    setCurrentPath(cleanPath);
    setSelectedFile(null);
  };

  const handleFileSelect = async (filePath) => {
    // Check if the path is valid
    if (filePath === undefined || filePath === null) {
      return;
    }
    
    // Clean up the path - remove any leading/trailing whitespace
    const cleanPath = filePath.trim();
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(cleanPath);
    setSelectedPosition({ start: 0, end: 0 });
  };

  const handleSearchResultSelect = (filePath, startChar, endChar) => {
    if (!filePath) {
      return;
    }
    
    // Handle potential absolute paths
    let processedPath = filePath.trim();
    
    // If this is an absolute path matching our repository structure,
    // convert it to a relative path for the file browser
    if (config.repo_path && processedPath.startsWith(config.repo_path)) {
      processedPath = processedPath.slice(config.repo_path.length);
    }
    
    // Remove leading slashes
    if (processedPath.startsWith('/')) {
      processedPath = processedPath.replace(/^\/+/, '');
    }
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(processedPath);
    setSelectedPosition({ start: startChar, end: endChar });
  };

  const toggleQAPanel = () => setIsQAPanelOpen(!isQAPanelOpen);

  const handleDefinitionSelect = (filePath, lineNumber) => {
    if (!filePath) {
      return;
    }
    
    // Handle potential absolute paths, similar to search results
    let processedPath = filePath.trim();
    
    // If this is an absolute path matching our repository structure,
    // convert it to a relative path for the file browser
    if (config.repo_path && processedPath.startsWith(config.repo_path)) {
      processedPath = processedPath.slice(config.repo_path.length);
    }
    
    // Remove leading slashes
    if (processedPath.startsWith('/')) {
      processedPath = processedPath.replace(/^\/+/, '');
    }
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(processedPath);
    // For definitions, we use line numbers instead of character positions
    // Set the position to highlight the entire line
    setSelectedPosition({ start: lineNumber, end: lineNumber });
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Repository Explorer</h2>
        </div>
        <div className="sidebar-content">
          <FileBrowser 
            currentPath={currentPath}
            onPathChange={handlePathChange}
            onFileSelect={handleFileSelect}
          />
          <DefinitionFinder 
            onDefinitionSelect={handleDefinitionSelect}
            repoPath={config.repo_path}
          />
        </div>
      </div>
      
      <div className="main-content">
        <div className="main-header">
          <h1>Code Navigator</h1>
        </div>
        
        <div className="main-body">
          {!selectedFile ? (
            // When no file is selected, show search panel
            <div className="search-container">
              <SearchPanel 
                onResultSelect={handleSearchResultSelect}
                repoPath={config.repo_path}
              />
              
              <div className="empty-state" style={{ marginTop: '20px' }}>
                <div className="empty-state-icon">📁</div>
                <p>Select a file from the file browser or search results to view its content</p>
              </div>
            </div>
          ) : (
            // When a file is selected, show file view with column layout
            <div className="main-content-column" style={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              height: '100%',
              border: '1px solid #ddd',
              borderRadius: '8px',
              overflow: 'hidden',
              backgroundColor: '#fff',
              marginBottom: '24px',
              position: 'relative'
            }}>
              {/* Header Section */}
              <div className="main-content-header" style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '40px',
                padding: '0 15px',
                borderBottom: '1px solid #ccc',
                flexShrink: 0
              }}>
                <div>
                  <strong>Selected File:</strong> {selectedFile}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '10px'
                }}>
                  {/* Toggle button for QA Panel */}
                  <button
                    onClick={toggleQAPanel}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}
                  >
                    {isQAPanelOpen ? '>> Hide Q&A' : '<< Ask AI'}
                  </button>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#1890ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Back to Search
                  </button>
                </div>
              </div>
              
              {/* Body Section - horizontal layout for code viewer and QA panel */}
              <div className="main-content-body" style={{
                display: 'flex',
                flexDirection: 'row',
                flexGrow: 1,
                overflow: 'hidden',
                minHeight: 0
              }}>
                {/* Code Viewer wrapper */}
                <div className="file-view" style={{ 
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: '0%',
                  height: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  transition: 'width 0.3s ease, flex-basis 0.3s ease'
                }}>
                  <CodeViewer 
                    key={selectedFile}
                    filePath={selectedFile} 
                    highlightStart={selectedPosition.start}
                    highlightEnd={selectedPosition.end}
                    repoPath={config.repo_path}
                  />
                </div>
                
                {/* QA Panel wrapper div - conditionally sized based on isQAPanelOpen */}
                <div style={{ 
                  width: isQAPanelOpen ? '350px' : '0px', 
                  flexShrink: 0, 
                  transition: 'width 0.3s ease', 
                  overflow: 'hidden', 
                  height: '100%', 
                  borderLeft: isQAPanelOpen ? '1px solid #ccc' : 'none',
                  backgroundColor: '#f9f9f9'
                }}>
                  {/* Always render QueryPanel, but it will be hidden when width is 0 */}
                  <div style={{ 
                    width: '350px', 
                    height: '100%', 
                    overflowY: 'auto',
                    padding: isQAPanelOpen ? '15px' : '0'
                  }}>
                    <QueryPanel 
                      selectedFile={selectedFile}
                      repoPath={config.repo_path}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
