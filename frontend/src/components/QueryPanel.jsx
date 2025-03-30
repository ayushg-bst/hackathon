import React, { useState } from 'react';
import axios from 'axios';
import './QueryPanel.css';

const QueryPanel = ({ selectedFile }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!question.trim()) return;
    
    setIsLoading(true);
    setAnswer('');
    setError(null);
    
    try {
      const response = await axios.post('http://127.0.0.1:8000/query', {
        question: question,
        context_file_path: selectedFile || null
      });
      
      setAnswer(response.data.answer);
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred while processing your question');
      console.error('Query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="query-panel">
      <h3>Ask about the code</h3>
      
      <div className="query-form">
        <div className="query-input-row">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the codebase..."
            className="query-input"
            rows={3}
          />
          <button 
            onClick={handleSubmit} 
            className="query-button"
            disabled={isLoading || !question.trim()}
          >
            {isLoading ? 'Thinking...' : 'Ask AI'}
          </button>
        </div>
        
        <div className="query-help">
          {selectedFile ? 
            <span>Currently providing context from: <strong>{selectedFile}</strong></span> : 
            <span>No file selected. The AI will use relevant code snippets to answer.</span>
          }
          <div>Press Ctrl+Enter to submit</div>
        </div>
      </div>

      {isLoading && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Analyzing code and formulating an answer...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>Error: {error}</p>
        </div>
      )}
      
      {answer && (
        <div className="answer-container">
          <h4>Answer</h4>
          <div className="answer-content">
            {answer.split('\n').map((line, i) => (
              <p key={i}>{line || <br />}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryPanel;