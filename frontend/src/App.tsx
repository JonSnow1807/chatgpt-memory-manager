import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Brain, Calendar, RefreshCw, MessageCircle, Download, BarChart } from 'lucide-react';
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

interface Stats {
  totalConversations: number;
  averageLength: number;
  mostCommonTopics: string[];
  lastCaptured: string;
}

function App() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalMemories, setTotalMemories] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

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
      calculateStats(response.data.memories);
    } catch (error) {
      console.error('Error loading memories:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (mems: Memory[]) => {
    if (mems.length === 0) return;

    // Extract topics from summaries
    const words = mems
      .map(m => m.summary.toLowerCase().split(' '))
      .flat()
      .filter(word => word.length > 4);
    
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const topWords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    setStats({
      totalConversations: mems.length,
      averageLength: Math.round(mems.reduce((acc, m) => acc + m.summary.length, 0) / mems.length),
      mostCommonTopics: topWords,
      lastCaptured: mems[0]?.timestamp || 'Never'
    });
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

  const exportMemories = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      totalMemories: memories.length,
      memories: memories.map(m => ({
        ...m,
        formattedDate: format(new Date(m.timestamp), 'MMM d, yyyy h:mm a')
      }))
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chatgpt-memories-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="title-section">
            <Brain size={32} className="logo" />
            <h1>ChatGPT Memory Manager</h1>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowStats(!showStats)} className="stats-button">
              <BarChart size={20} />
              Stats
            </button>
            <button onClick={exportMemories} className="export-button" disabled={memories.length === 0}>
              <Download size={20} />
              Export
            </button>
            <div className="stats">
              <MessageCircle size={20} />
              <span>{totalMemories} memories stored</span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        {/* Stats Panel */}
        {showStats && stats && (
          <div className="stats-panel">
            <h3>Memory Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Conversations</span>
                <span className="stat-value">{stats.totalConversations}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Average Summary Length</span>
                <span className="stat-value">{stats.averageLength} chars</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Last Captured</span>
                <span className="stat-value">
                  {stats.lastCaptured !== 'Never' 
                    ? format(new Date(stats.lastCaptured), 'MMM d, h:mm a')
                    : 'Never'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Common Topics</span>
                <div className="topic-tags">
                  {stats.mostCommonTopics.map(topic => (
                    <span key={topic} className="topic-tag">{topic}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
