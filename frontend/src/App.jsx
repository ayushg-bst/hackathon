import { useState, useEffect } from 'react'
import axios from 'axios';
import FileBrowser from './components/FileBrowser'
import CodeViewer from './components/CodeViewer'
import SearchPanel from './components/SearchPanel'
import QueryPanel from './components/QueryPanel'
import DefinitionFinder from './components/DefinitionFinder'
import FileSearchPanel from './components/FileSearchPanel';
import './App.css'

function App() {
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPosition, setSelectedPosition] = useState({ start: 0, end: 0 });
  const [forceRender, setForceRender] = useState(0);
  const [config, setConfig] = useState({ repo_path: '' });
  const [isQAPanelOpen, setIsQAPanelOpen] = useState(false); // Start closed
  const [searchPanelVisible, setSearchPanelVisible] = useState(false);
  const [previousSearchState, setPreviousSearchState] = useState(null);
  const [fromSearch, setFromSearch] = useState(false);

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

  const handleFileSelect = async (filePath, fromSearchResults = true) => {
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
    
    // If coming from search results, save search panel state
    if (fromSearchResults && searchPanelVisible) {
      setFromSearch(true);
      // We don't hide search panel here to preserve state
    } else {
      // Close the search panel if not from search results
      setSearchPanelVisible(false);
      setFromSearch(false);
    }
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

  const handleBackToSearch = () => {
    if (fromSearch) {
      // Ensure search panel is visible
      setSearchPanelVisible(true);
      // Clear selected file
      setSelectedFile(null);
    } else {
      // Just clear selected file if not from search
      setSelectedFile(null);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Code Navigator</h1>
        <div className="header-actions">
          <button 
            onClick={() => setSearchPanelVisible(!searchPanelVisible)} 
            className={`action-button ${searchPanelVisible ? 'active' : ''}`}
          >
            {searchPanelVisible ? 'Hide Search' : 'Search'}
          </button>
        </div>
      </header>

      <main className="app-content">
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
          {searchPanelVisible && (
            <div className="search-panel-wrapper">
              <FileSearchPanel onFileSelect={(filePath) => handleFileSelect(filePath, true)} />
            </div>
          )}

          {!selectedFile ? (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <p>Select a file from the file browser or search results to view its content</p>
            </div>
          ) : (
            <div className="file-viewer-wrapper">
              <div className="file-viewer-header">
                <strong>Selected File:</strong> {selectedFile}
                <div className="file-viewer-actions">
                  <button onClick={toggleQAPanel} className="qa-toggle-button">
                    {isQAPanelOpen ? 'Hide Q&A' : 'Ask AI'}
                  </button>
                  <button 
                    onClick={handleBackToSearch} 
                    className={`back-button ${fromSearch ? 'from-search' : ''}`}
                  >
                    {fromSearch ? 'Back to Search Results' : 'Back to Search'}
                  </button>
                </div>
              </div>
              <div className="file-viewer-body">
                <div className={`code-viewer-container ${isQAPanelOpen ? 'panel-open' : 'panel-closed'}`}>
                  <CodeViewer 
                    key={selectedFile}
                    filePath={selectedFile} 
                    highlightStart={selectedPosition.start}
                    highlightEnd={selectedPosition.end}
                    repoPath={config.repo_path}
                  />
                </div>
                <QueryPanel 
                  selectedFile={selectedFile}
                  repoPath={config.repo_path}
                  className={isQAPanelOpen ? '' : 'collapsed'}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
