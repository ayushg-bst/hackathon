import { useState, useEffect } from 'react';
import axios from 'axios';
import './FileBrowser.css';

const FileBrowser = ({ currentPath, onPathChange, onFileSelect }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const fetchDirectoryContents = async () => {
      setLoading(true);
      setError(null);
      setDebugInfo(null);
      
      try {
        console.log(`Fetching directory contents for path: ${currentPath}`);
        const response = await axios.get(`http://127.0.0.1:8000/browse/${currentPath}`, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('API response:', response.data);
        
        // Store debug info
        setDebugInfo({
          status: response.status,
          statusText: response.statusText,
          hasData: !!response.data,
          hasItems: response.data && Array.isArray(response.data.items),
          itemCount: response.data && response.data.items ? response.data.items.length : 0
        });
        
        if (response.data && Array.isArray(response.data.items)) {
          // Sort items: directories first, then files, both alphabetically
          const sortedItems = response.data.items.sort((a, b) => {
            // If both are dirs or both are files, sort alphabetically
            if (a.is_dir === b.is_dir) {
              return a.name.localeCompare(b.name);
            }
            // Otherwise, directories come first
            return a.is_dir ? -1 : 1;
          });
          
          setItems(sortedItems);
        } else {
          console.error('Unexpected response format:', response.data);
          setItems([]);
          setError('Unexpected response format from server');
        }
      } catch (err) {
        console.error('Error fetching directory contents:', err);
        console.error('Error details:', err.response?.data);
        
        setDebugInfo({
          errorMessage: err.message,
          errorResponse: err.response ? {
            status: err.response.status,
            statusText: err.response.statusText,
            data: err.response.data
          } : null,
          errorStack: err.stack
        });
        
        setError(err.response?.data?.detail || err.message || 'Failed to fetch directory contents');
      } finally {
        setLoading(false);
      }
    };

    fetchDirectoryContents();
  }, [currentPath]);

  const handleItemClick = (item) => {
    if (!item) {
      console.error('FileBrowser: Attempted to click on null/undefined item');
      return;
    }
    
    const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    console.log(`FileBrowser: Clicked on item: ${item.name}, new path: ${newPath}`);
    console.log(`FileBrowser: Item object:`, item);
    
    if (item.is_dir) {
      console.log(`FileBrowser: Navigating to directory: ${newPath}`);
      onPathChange(newPath);
    } else {
      console.log(`FileBrowser: Opening file: ${newPath}`);
      // Ensure the path is properly trimmed
      onFileSelect(newPath.trim());
    }
  };

  const navigateUp = () => {
    if (!currentPath || currentPath === '') return;
    
    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');
    console.log(`Navigating up to: ${parentPath}`);
    onPathChange(parentPath);
  };

  // Generate breadcrumb items from current path
  const generateBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Root', path: '' }];
    
    const pathParts = currentPath.split('/');
    let currentBreadcrumbPath = '';
    
    const breadcrumbs = [{ name: 'Root', path: '' }];
    
    for (const part of pathParts) {
      if (part) {
        currentBreadcrumbPath += (currentBreadcrumbPath ? '/' : '') + part;
        breadcrumbs.push({
          name: part,
          path: currentBreadcrumbPath
        });
      }
    }
    
    return breadcrumbs;
  };

  // Get appropriate icon for file type
  const getFileIcon = (fileName) => {
    if (!fileName.includes('.')) return '📄'; // No extension
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    // Map of extensions to icons
    const iconMap = {
      // Code
      js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
      py: '🐍', rb: '💎', php: '🐘',
      java: '☕', c: '🟦', cpp: '🟦', h: '🟦',
      cs: '🟩', go: '🦫', rs: '🦀', swift: '🐦',
      html: '🌐', css: '🎨', scss: '🎨', less: '🎨',
      // Data
      json: '📊', xml: '📊', yaml: '📊', yml: '📊',
      csv: '📊', sql: '🛢️',
      // Documents
      md: '📝', txt: '📝', pdf: '📑', doc: '📑', docx: '📑',
      xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
      // Media
      jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', svg: '🖼️',
      mp3: '🎵', wav: '🎵', mp4: '🎬', mov: '🎬',
      // Archives
      zip: '📦', rar: '📦', tar: '📦', gz: '📦'
    };
    
    return iconMap[extension] || '📄';
  };
  
  const getDirIcon = () => {
    return '📁';
  };

  return (
    <div className="file-browser">
      <div className="file-browser-header">
        <h3>File Browser</h3>
        <button 
          className="up-button"
          onClick={navigateUp}
          disabled={!currentPath || currentPath === ''}
        >
          ⬆️ Up
        </button>
      </div>
      
      <div className="breadcrumbs">
        {generateBreadcrumbs().map((crumb, index, array) => (
          <span key={crumb.path}>
            <span 
              className="breadcrumb-item"
              onClick={() => onPathChange(crumb.path)}
            >
              {crumb.name}
            </span>
            {index < array.length - 1 && <span className="breadcrumb-separator">/</span>}
          </span>
        ))}
      </div>

      {loading && <div className="loading">Loading...</div>}
      
      {error && (
        <div className="error">
          <p>Error: {error}</p>
          {debugInfo && (
            <details>
              <summary>Debug Info</summary>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
      
      <ul className="file-list">
        {items.length > 0 ? (
          items.map((item, index) => (
            <li 
              key={index} 
              className={`file-item ${item.is_dir ? 'directory' : 'file'}`}
              onClick={() => handleItemClick(item)}
            >
              <span className="file-icon">
                {item.is_dir ? getDirIcon() : getFileIcon(item.name)}
              </span>
              {item.name}
            </li>
          ))
        ) : !loading && !error ? (
          <div className="empty-directory">
            This directory is empty or no items returned
            {debugInfo && (
              <details>
                <summary>Debug Info</summary>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </details>
            )}
          </div>
        ) : null}
      </ul>
    </div>
  );
};

export default FileBrowser; 