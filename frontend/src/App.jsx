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
        console.log('Config loaded:', response.data);
        setConfig(response.data);
      } catch (error) {
        console.error('Failed to load configuration:', error);
      }
    };
    
    fetchConfig();
  }, []);

  useEffect(() => {
    console.log("Current selected file:", selectedFile);
  }, [selectedFile]);

  const handlePathChange = (newPath) => {
    console.log("App: Path change called with:", newPath);
    // Check if the path is valid
    if (newPath === undefined || newPath === null) {
      console.error("Invalid path received:", newPath);
      return;
    }
    
    // Clean up the path - remove any leading/trailing whitespace
    const cleanPath = newPath.trim();
    console.log("Cleaned path:", cleanPath);
    
    setCurrentPath(cleanPath);
    setSelectedFile(null);
  };

  const handleFileSelect = async (filePath) => {
    console.log("App: File select called with:", filePath);
    // Check if the path is valid
    if (filePath === undefined || filePath === null) {
      console.error("Invalid file path received:", filePath);
      return;
    }
    
    // Clean up the path - remove any leading/trailing whitespace
    const cleanPath = filePath.trim();
    console.log("Cleaned file path:", cleanPath);
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(cleanPath);
    setSelectedPosition({ start: 0, end: 0 });
  };

  const handleSearchResultSelect = (filePath, startChar, endChar) => {
    console.log(`App: handleSearchResultSelect called with filePath: ${filePath}, startChar: ${startChar}, endChar: ${endChar}`);
    
    if (!filePath) {
      console.error("App: Invalid search result path received:", filePath);
      return;
    }
    
    console.log(`App: Current config.repo_path: ${config.repo_path}`);
    
    // Handle potential absolute paths
    let processedPath = filePath.trim();
    console.log(`App: Path after trimming: ${processedPath}`);
    
    // If this is an absolute path matching our repository structure,
    // convert it to a relative path for the file browser
    if (config.repo_path && processedPath.startsWith(config.repo_path)) {
      console.log(`App: Path starts with repo_path. Removing prefix.`);
      processedPath = processedPath.slice(config.repo_path.length);
      console.log(`App: Path after removing repo prefix: ${processedPath}`);
    } else {
      console.log(`App: Path does not start with repo_path or repo_path is not set. No prefix removed.`);
    }
    
    // Remove leading slashes
    if (processedPath.startsWith('/')) {
      console.log(`App: Path starts with '/'. Removing leading slashes.`);
      processedPath = processedPath.replace(/^\/+/, '');
      console.log(`App: Path after removing leading slashes: ${processedPath}`);
    }
    
    console.log("App: Final processed path for search result:", processedPath);
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(processedPath);
    setSelectedPosition({ start: startChar, end: endChar });
    
    // Debug: Will this file actually load?
    console.log("App: Setting selectedFile to:", processedPath);
  };

  const handleDefinitionSelect = (filePath, lineNumber) => {
    console.log("Definition selected:", filePath, lineNumber);
    
    if (!filePath) {
      console.error("Invalid definition path:", filePath);
      return;
    }
    
    // Handle potential absolute paths, similar to search results
    let processedPath = filePath.trim();
    
    // If this is an absolute path matching our repository structure,
    // convert it to a relative path for the file browser
    if (config.repo_path && processedPath.startsWith(config.repo_path)) {
      processedPath = processedPath.slice(config.repo_path.length);
      console.log(`Removed repo prefix, now: ${processedPath}`);
    }
    
    // Remove leading slashes
    if (processedPath.startsWith('/')) {
      processedPath = processedPath.replace(/^\/+/, '');
      console.log(`Removed leading slashes, now: ${processedPath}`);
    }
    
    console.log("Processed path for definition:", processedPath);
    
    // Force re-render of the CodeViewer by changing the key
    setForceRender(prev => prev + 1);
    setSelectedFile(processedPath);
    // For definitions, we use line numbers instead of character positions
    // Set the position to highlight the entire line
    setSelectedPosition({ start: lineNumber, end: lineNumber });
    
    // Debug: Will this file actually load?
    console.log("CodeViewer will attempt to load:", processedPath);
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
          <SearchPanel 
            onResultSelect={handleSearchResultSelect}
            repoPath={config.repo_path}
          />
          
          {selectedFile ? (
            <div className="file-view">
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
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📁</div>
              <p>Select a file from the file browser to view its content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
