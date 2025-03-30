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
            // When a file is selected, show file view
            <div className="content-area" style={{ 
              flex: '1', 
              display: 'flex', 
              flexDirection: 'column',
              minHeight: '500px',
              height: 'auto',
              maxHeight: 'none', /* Remove any height constraints */
              border: '1px solid #ddd',
              borderRadius: '8px',
              overflow: 'visible', 
              backgroundColor: '#fff',
              marginBottom: '24px' /* Add bottom margin */
            }}>
              <div className="file-view" style={{ overflow: 'visible' }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px', 
                  backgroundColor: '#e6f7ff', 
                  marginBottom: '10px', 
                  borderRadius: '4px',
                  border: '2px solid #1890ff'
                }}>
                  <div>
                    <strong>Selected File:</strong> {selectedFile}
                  </div>
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
                
                <CodeViewer 
                  key={selectedFile}
                  filePath={selectedFile} 
                  highlightStart={selectedPosition.start}
                  highlightEnd={selectedPosition.end}
                  repoPath={config.repo_path}
                />
                
                <QueryPanel 
                  selectedFile={selectedFile}
                  repoPath={config.repo_path}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
