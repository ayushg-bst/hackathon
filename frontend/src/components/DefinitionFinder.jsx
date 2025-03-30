import React, { useState } from 'react';
import axios from 'axios';
import './DefinitionFinder.css';

const DefinitionFinder = ({ onDefinitionSelect, repoPath }) => {
  const [symbol, setSymbol] = useState('');
  const [definitions, setDefinitions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFindDefinition = async () => {
    if (!symbol.trim()) return;
    
    setIsLoading(true);
    setDefinitions([]);
    setError(null);
    
    try {
      const response = await axios.get(`http://127.0.0.1:8000/index/definition/${encodeURIComponent(symbol.trim())}`);
      
      if (response.data && response.data.definitions) {
        setDefinitions(response.data.definitions);
      } else {
        setDefinitions([]);
      }
    } catch (err) {
      console.error('Error finding definition:', err);
      
      if (err.response?.status === 404) {
        setError(`No definitions found for symbol "${symbol}"`);
      } else {
        setError(err.response?.data?.message || 'An error occurred while searching for definitions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleFindDefinition();
    }
  };

  const handleDefinitionItemClick = (definition) => {
    if (!definition || !definition.path) {
      console.error('Invalid definition:', definition);
      return;
    }
    
    let path = definition.path;
    const lineNumber = definition.line || 0;
    
    // Convert absolute path to relative path if needed
    if (repoPath && path.startsWith(repoPath)) {
      path = path.slice(repoPath.length);
      console.log(`Removed repo prefix from definition path, now: ${path}`);
    }
    
    // Remove leading slashes
    if (path.startsWith('/')) {
      path = path.replace(/^\/+/, '');
      console.log(`Removed leading slashes from definition path, now: ${path}`);
    }
    
    console.log(`Selecting definition at ${path}:${lineNumber}`);
    onDefinitionSelect(path, lineNumber);
  };

  return (
    <div className="definition-finder">
      <h3>Find Symbol Definitions</h3>
      
      <div className="definition-finder-input">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter symbol name..."
          className="symbol-input"
        />
        <button 
          onClick={handleFindDefinition} 
          className="find-button"
          disabled={isLoading || !symbol.trim()}
        >
          {isLoading ? 'Finding...' : 'Find Definition'}
        </button>
      </div>
      
      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Searching for definitions...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {definitions.length > 0 && (
        <div className="definitions-list">
          <h4>Found {definitions.length} definition{definitions.length === 1 ? '' : 's'}</h4>
          {definitions.map((definition, index) => (
            <div 
              key={index}
              className="definition-item"
              onClick={() => handleDefinitionItemClick(definition)}
            >
              <div className="definition-path">{definition.path}</div>
              <div className="definition-info">
                <span className="definition-kind">{definition.kind}</span>
                <span className="definition-line">Line: {definition.line}</span>
              </div>
              {definition.signature && (
                <div className="definition-signature">{definition.signature}</div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {!isLoading && !error && definitions.length === 0 && symbol.trim() && (
        <div className="no-results">
          <p>No definitions found for "{symbol}"</p>
        </div>
      )}
    </div>
  );
};

export default DefinitionFinder; 