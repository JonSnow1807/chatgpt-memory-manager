import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Brain, Calendar, RefreshCw, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import './App.css';

interface Memory {
  id: string;
  summary: string;
  timestamp: string;
  title: string;
}

interface SearchResult {
  content: string;
  metadata: {
    summary: string;
    timestamp: string;
    title: string;
  };
  relevance: number;
}

function App() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMemories, setTotalMemories] = useState(0);

  const API_URL = 'http://localhost:8000';

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/get_all_memories`);
      setMemories(response.data.memories);
      setTotalMemories(response.data.total);
    } catch (error) {
      console.error('Error loading memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchMemories = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/search_memory`, {
        query: searchQuery,
        limit: 10
      });
      setSearchResults(response.data.memories);
    } catch (error) {
      console.error('Error searching memories:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="title-section">
            <Brain size={32} className="logo" />
            <h1>ChatGPT Memory Manager</h1>
          </div>
          <div className="stats">
            <MessageCircle size={20} />
            <span>{totalMemories} memories stored</span>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Search Section */}
        <div className="search-section">
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search your ChatGPT memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchMemories()}
              className="search-input"
            />
            <button onClick={searchMemories} className="search-button">
              Search
            </button>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="section">
            <h2>Search Results</h2>
            <div className="memory-grid">
              {searchResults.map((result, index) => (
                <div key={index} className="memory-card search-result">
                  <div className="relevance-indicator" style={{width: `${result.relevance * 100}%`}} />
                  <h3>{result.metadata.title}</h3>
                  <p className="summary">{result.metadata.summary}</p>
                  <p className="content-preview">{result.content}</p>
                  <div className="memory-meta">
                    <Calendar size={14} />
                    <span>{format(new Date(result.metadata.timestamp), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Memories */}
        <div className="section">
          <div className="section-header">
            <h2>Recent Memories</h2>
            <button onClick={loadMemories} className="refresh-button" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spinning' : ''} />
              Refresh
            </button>
          </div>
          
          {loading && !memories.length ? (
            <div className="loading">Loading memories...</div>
          ) : memories.length === 0 ? (
            <div className="empty-state">
              <Brain size={48} />
              <p>No memories yet. Start capturing your ChatGPT conversations!</p>
            </div>
          ) : (
            <div className="memory-grid">
              {memories.slice(0, 12).map((memory) => (
                <div key={memory.id} className="memory-card">
                  <h3>{memory.title}</h3>
                  <p className="summary">{memory.summary}</p>
                  <div className="memory-meta">
                    <Calendar size={14} />
                    <span>{format(new Date(memory.timestamp), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
