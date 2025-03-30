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
    <div className="qa-panel">
      <h3>Ask about the code</h3>
      
      <div className="qa-input-container">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this code..."
          className="qa-input"
          rows={3}
        />
        
        {currentFilePath && (
          <div className="qa-context-info">
            Using context from: <span className="qa-file-path">{currentFilePath}</span>
          </div>
        )}
        
        <button 
          onClick={handleAsk} 
          className="qa-button"
          disabled={isLoading || !question.trim()}
        >
          {isLoading ? 'Thinking...' : 'Ask AI'}
        </button>
      </div>
      
      {isLoading && (
        <div className="qa-loading">
          <p>AI is analyzing the code and formulating an answer...</p>
        </div>
      )}
      
      {error && (
        <div className="qa-error">
          <p>{error}</p>
        </div>
      )}
      
      {answer && (
        <div className="qa-answer">
          <h4>Answer:</h4>
          <pre className="qa-answer-text">{answer}</pre>
        </div>
      )}
    </div>
  );
};

export default QAPanel; 