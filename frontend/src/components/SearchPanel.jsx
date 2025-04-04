import React, { useState } from 'react';
import axios from 'axios';
import './SearchPanel.css';

const SearchPanel = ({ onResultSelect, repoPath }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e?.preventDefault();
    
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResults([]);
    setError(null);
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/search', {
        query: query
      });
      
      console.log("Search results received:", response.data);
      setResults(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while searching');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  // Truncate text to a certain length and add ellipsis if needed
  const truncateText = (text, maxLength = 200) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  // Highlight search terms in the content
  const highlightText = (text, searchQuery) => {
    if (!text || !searchQuery) return text;
    
    const terms = searchQuery.trim().split(/\s+/).filter(term => term.length > 0);
    if (terms.length === 0) return text;
    
    // Create a regular expression that matches any of the terms, case-insensitive
    const regex = new RegExp(`(${terms.map(term => escapeRegExp(term)).join('|')})`, 'gi');
    
    // Split by the regex and map each part
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      // Check if this part matches any term (case-insensitive)
      const isMatch = terms.some(term => part.toLowerCase() === term.toLowerCase());
      
      return isMatch ? 
        <span key={i} className="search-highlight">{part}</span> : 
        <span key={i}>{part}</span>;
    });
  };
  
  // Helper function to escape special characters in regex
  const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };
  
  const handleResultClick = (result) => {
    console.log("Search result clicked:", result);
    
    if (!result || !result.file_path) {
      console.error("Invalid search result:", result);
      return;
    }
    
    // Get the file path from the result
    const filePath = result.file_path; // Use the original path directly
    const startChar = result.start_char || 0;
    const endChar = result.end_char || 0;
    
    // Log the original path being passed up
    console.log(`Selecting file with original path: ${filePath} (${startChar}:${endChar})`);
    
    // Pass the original file path to the parent component
    onResultSelect(filePath, startChar, endChar); // Pass original filePath
  };

  return (
    <div className="search-panel">
      <div className="search-container">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search codebase..."
          className="search-input"
        />
        <button 
          onClick={handleSearch} 
          className="search-button"
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>

      <div className="search-results">
        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-spinner"></div>
            <p>Searching code...</p>
          </div>
        )}
        
        {error && (
          <div className="error-message">
            <p>Error: {error}</p>
          </div>
        )}
        
        {!isLoading && !error && results.length === 0 && query && (
          <div className="no-results">
            <p>No results found for "{query}"</p>
          </div>
        )}
        
        {results.length > 0 && (
          <div className="results-list">
            <h3>Found {results.length} result{results.length === 1 ? '' : 's'}</h3>
            {results.map((result, index) => (
              <div 
                key={index}
                className="result-item"
                onClick={() => handleResultClick(result)}
              >
                <div className="result-file">{result.file_path}</div>
                <div className="result-content">
                  {highlightText(result.content, result.query || query)}
                </div>
                <div className="result-meta">
                  <span className="relevance">
                    Relevance: {Math.round((result.score || (1 - (result.distance || 0))) * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;