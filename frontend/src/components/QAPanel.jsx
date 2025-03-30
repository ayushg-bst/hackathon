import { useState } from 'react';
import axios from 'axios';
import './QAPanel.css';

const QAPanel = ({ currentFilePath }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAsk = async () => {
    if (!question.trim()) return;
    
    setIsLoading(true);
    setAnswer('');
    setError(null);
    
    try {
      // Prepare request body
      const requestBody = {
        question: question
      };
      
      // Add context file path if available
      if (currentFilePath) {
        requestBody.context_file_path = currentFilePath;
      }
      
      const response = await axios.post('http://localhost:8000/query', requestBody);
      setAnswer(response.data.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while getting an answer');
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="qa-panel" style={{
      height: '100%',
      overflowY: 'auto',
      padding: '15px',
      boxSizing: 'border-box',
      backgroundColor: '#ffffff'
    }}>
      <h3 style={{ marginBottom: '15px' }}>Ask about the code</h3>
      
      <div className="qa-input-container" style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        gap: '10px',
        marginBottom: '15px'
      }}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this code..."
          className="qa-input"
          rows={4}
          style={{ 
            flexGrow: 1,
            resize: 'vertical',
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        />
        
        <button 
          onClick={handleAsk} 
          className="qa-button"
          disabled={isLoading || !question.trim()}
          style={{ flexShrink: 0 }}
        >
          {isLoading ? 'Thinking...' : 'Ask AI'}
        </button>
      </div>
      
      {currentFilePath && (
        <div className="qa-context-info" style={{ marginBottom: '15px', fontSize: '0.85em', color: '#555' }}>
          Using context from: <span className="qa-file-path" style={{ fontWeight: 'bold' }}>{currentFilePath}</span>
        </div>
      )}
      
      {isLoading && (
        <div className="qa-loading" style={{ marginBottom: '15px' }}>
          <p>AI is analyzing the code and formulating an answer...</p>
        </div>
      )}
      
      {error && (
        <div className="qa-error" style={{ marginBottom: '15px' }}>
          <p>{error}</p>
        </div>
      )}
      
      {answer && (
        <div className="qa-answer">
          <h4>Answer:</h4>
          <pre className="qa-answer-text" style={{
            padding: '10px',
            backgroundColor: '#f0f0f0',
            border: '1px solid #ddd',
            borderRadius: '4px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            maxWidth: '100%',
            overflowX: 'auto'
          }}>{answer}</pre>
        </div>
      )}
    </div>
  );
};

export default QAPanel;