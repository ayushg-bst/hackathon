import { useState, useEffect } from 'react';
import axios from 'axios';

const PlainTextViewer = ({ filePath }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!filePath) {
      setContent('');
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);

      try {
        console.log('PlainTextViewer: Fetching content for:', filePath);
        const encodedPath = encodeURIComponent(filePath);
        const url = `http://127.0.0.1:8000/browse/${encodedPath}`;
        
        const response = await axios.get(url);
        
        console.log('PlainTextViewer: Response received:', response.status);
        
        if (response.data && typeof response.data.content === 'string') {
          console.log(`PlainTextViewer: Content received, length: ${response.data.content.length}`);
          setContent(response.data.content);
        } else {
          setError('Invalid response format');
        }
      } catch (err) {
        console.error('PlainTextViewer: Error fetching content:', err);
        setError(err.message || 'Failed to fetch content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [filePath]);

  if (loading) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        Loading content for {filePath}...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#fff0f0', borderRadius: '5px', color: 'red' }}>
        Error: {error}
      </div>
    );
  }

  if (!filePath) {
    return (
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        No file selected
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #ddd',
      borderRadius: '5px',
      padding: '10px',
      backgroundColor: '#f8f8f8',
      display: 'flex',
      flexDirection: 'column',
      height: '400px'
    }}>
      <div style={{ 
        padding: '8px', 
        backgroundColor: '#e0e0e0', 
        marginBottom: '10px',
        borderRadius: '4px'
      }}>
        <strong>File:</strong> {filePath}
      </div>
      
      <pre style={{ 
        flex: 1,
        overflow: 'auto',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '10px',
        borderRadius: '4px',
        margin: 0,
        fontFamily: 'monospace'
      }}>
        {content || 'No content'}
      </pre>
      
      <div style={{ 
        marginTop: '10px', 
        fontSize: '12px', 
        color: '#666'
      }}>
        Characters: {content.length}
      </div>
    </div>
  );
};

export default PlainTextViewer; 