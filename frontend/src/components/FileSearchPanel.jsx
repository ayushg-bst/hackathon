import { useState, useEffect } from 'react';
import axios from 'axios';
import './FileSearchPanel.css';

const FileSearchPanel = ({ onFileSelect }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [extension, setExtension] = useState('');
    const [directory, setDirectory] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchType, setSearchType] = useState('filename'); // 'filename' or 'content'
    const [exactMatch, setExactMatch] = useState(false);
    
    // Common file extensions to filter by
    const commonExtensions = ['py', 'js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'h', 'html', 'css'];

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        
        setIsLoading(true);
        setError(null);
        setResults([]);
        
        try {
            // Check if the query is quoted for exact phrase matching
            const isQuotedString = (searchQuery.startsWith('"') && searchQuery.endsWith('"')) ||
                                (searchQuery.startsWith("'") && searchQuery.endsWith("'"));
            
            // Build query parameters
            const params = { 
                q: searchQuery,
                code: searchType === 'content',
                exact: exactMatch || isQuotedString // Force exact matching for quoted strings
            };
            
            if (extension) params.ext = extension;
            if (directory) params.dir = directory;
            
            console.log(`Searching for "${searchQuery}" in ${searchType} mode (exact: ${params.exact})`);
            
            // Call the unified search endpoint
            const response = await axios.get('http://127.0.0.1:8000/search', { params });
            
            if (response.data && Array.isArray(response.data)) {
                console.log(`Found ${response.data.length} results`);
                setResults(response.data);
            } else {
                console.error("Unexpected response format:", response.data);
                setError("Received invalid response format from server");
                setResults([]);
            }
        } catch (err) {
            console.error('Error searching:', err);
            setError(`Failed to search: ${err.message || 'Unknown error'}`);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleSelectFile = (filePath) => {
        if (onFileSelect) {
            // Pass the file path to the parent component
            onFileSelect(filePath);
        }
    };

    return (
        <div className="file-search-panel">
            <div className="search-header">
                <h3>Search Repository</h3>
                <div className="search-type-toggle">
                    <button 
                        className={searchType === 'filename' ? 'active' : ''}
                        onClick={() => setSearchType('filename')}
                    >
                        <span className="icon">📁</span> File Names
                    </button>
                    <button 
                        className={searchType === 'content' ? 'active' : ''}
                        onClick={() => setSearchType('content')}
                    >
                        <span className="icon">📝</span> Code Content
                    </button>
                </div>
                <div className="search-inputs">
                    <div className="search-input-wrapper">
                        <input
                            type="text"
                            placeholder={searchType === 'filename' 
                                ? "Search for files..."
                                : exactMatch 
                                    ? "Search code with exact pattern" 
                                    : 'Search code content or use "quoted text" for exact phrases'
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <div className="search-tips">
                            <span className="tip-icon">💡</span>
                            <span className="tip-text">
                                {searchType === 'content' 
                                    ? 'Tip: Use quotes ("example") for exact phrase matching' 
                                    : 'Tip: Search for file names or paths'}
                            </span>
                        </div>
                    </div>
                    
                    {searchType === 'content' && (
                        <div className="exact-match-toggle">
                            <label>
                                <input 
                                    type="checkbox" 
                                    checked={exactMatch} 
                                    onChange={() => setExactMatch(!exactMatch)} 
                                />
                                <span>Pattern Match</span>
                                {exactMatch && (
                                    <div className="pattern-hint">
                                        Supports "is not null", "== null", or any complete phrase
                                    </div>
                                )}
                            </label>
                        </div>
                    )}
                    
                    <div className="search-filters">
                        <input
                            type="text"
                            placeholder="Filter by extension (e.g., js,py)"
                            value={extension}
                            onChange={(e) => setExtension(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <input
                            type="text"
                            placeholder="Filter by directory (e.g., src/components)"
                            value={directory}
                            onChange={(e) => setDirectory(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button onClick={handleSearch} disabled={isLoading}>
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
                
                <div className="extension-shortcuts">
                    {commonExtensions.map(ext => (
                        <button 
                            key={ext} 
                            className={extension === ext ? 'active' : ''} 
                            onClick={() => setExtension(ext === extension ? '' : ext)}
                        >
                            .{ext}
                        </button>
                    ))}
                    <button 
                        className={extension === '' ? 'active' : ''} 
                        onClick={() => setExtension('')}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="search-results">
                {results && results.length > 0 ? (
                    <div>
                        <p className="results-count">{results.length} result(s) found</p>
                        <ul className="file-list">
                            {results.map((result, index) => (
                                <li key={index} onClick={() => handleSelectFile(result.file_path)}>
                                    <span className="file-icon">📄</span>
                                    <div className="file-result">
                                        <div className="file-path">{result.file_path}</div>
                                        {result.snippet && (
                                            <div className={`code-snippet ${result.exact_match ? 'exact-match' : ''}`}>
                                                <pre dangerouslySetInnerHTML={{ __html: 
                                                    result.snippet.replace(/«(.*?)»/g, 
                                                    '<span class="match-highlight">$1</span>') 
                                                }} />
                                            </div>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ) : !isLoading && searchQuery && (
                    <p className="no-results">No results found matching your search criteria.</p>
                )}
                
                {isLoading && (
                    <div className="loading">
                        <p>Searching...</p>
                        <div className="loading-spinner"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FileSearchPanel;
