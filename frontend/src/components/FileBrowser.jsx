import { useState, useEffect } from 'react';
import axios from 'axios';
import './FileBrowser.css';

const FileBrowser = ({ currentPath, onPathChange, onFileSelect }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDirectoryContents = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`http://127.0.0.1:8000/browse/${currentPath}`, {
          timeout: 10000, // 10 second timeout
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
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
          setItems([]);
          setError('Unexpected response format from server');
        }
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Failed to fetch directory contents');
      } finally {
        setLoading(false);
      }
    };

    fetchDirectoryContents();
  }, [currentPath]);

  const handleItemClick = (item) => {
    if (!item) {
      return;
    }
    
    const newPath = currentPath ? `${currentPath}/${item.name}` : item.name;
    
    if (item.is_dir) {
      onPathChange(newPath);
    } else {
      // Ensure the path is properly trimmed
      onFileSelect(newPath.trim());
    }
  };

  const navigateUp = () => {
    if (!currentPath || currentPath === '') return;
    
    const pathParts = currentPath.split('/');
    pathParts.pop();
    const parentPath = pathParts.join('/');
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
    <div className="file-browser" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: 'auto', 
      minHeight: '90vh'
    }}>
      <div className="file-browser-header" style={{ flex: '0 0 auto' }}>
        <h3>File Browser</h3>
        <button 
          className="up-button"
          onClick={navigateUp}
          disabled={!currentPath || currentPath === ''}
        >
          ⬆️ Up
        </button>
      </div>
      
      <div className="breadcrumbs" style={{ flex: '0 0 auto' }}>
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

      {loading && <div className="loading" style={{ flex: '0 0 auto' }}>Loading...</div>}
      
      {error && (
        <div className="error" style={{ flex: '0 0 auto' }}>
          <p>Error: {error}</p>
        </div>
      )}
      
      <ul className="file-list" style={{ 
        height: 'auto',
        maxHeight: 'unset',
        minHeight: '70vh', 
        overflow: 'visible',
        display: 'block',
        border: 'none'
      }}>
        {items.length > 0 ? (
          items.map((item, index) => (
            <li 
              key={index} 
              className={`file-item ${item.is_dir ? 'directory' : 'file'}`}
              onClick={() => handleItemClick(item)}
              style={{ padding: '3px 4px', fontSize: '12px', marginBottom: '1px' }}
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
          </div>
        ) : null}
      </ul>
    </div>
  );
};

export default FileBrowser;