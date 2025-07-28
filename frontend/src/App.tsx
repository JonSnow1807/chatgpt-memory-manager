import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Brain, Calendar, RefreshCw, MessageCircle, Download, BarChart, Trash2, X, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import './App.css';

console.log('APP VERSION 2.0 - USER ISOLATION ACTIVE');

const API_URL = 'https://chatgpt-memory-manager-production.up.railway.app';

interface Memory {
  id: string;
  summary: string;
  timestamp: string;
  title: string;
  topics?: string[];
}

interface SearchResult {
  content: string;
  metadata: {
    summary: string;
    timestamp: string;
    title: string;
    topics?: string;
  };
  distance?: number;
  relevance?: number;
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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // Get or generate user ID - THIS MUST RUN FIRST
  useEffect(() => {
    const initializeUserId = () => {
      const params = new URLSearchParams(window.location.search);
      let uid = params.get('userId');
      
      if (!uid) {
        // Try to get from localStorage
        uid = localStorage.getItem('userId');
        if (!uid) {
          // Generate new one
          uid = 'user_' + crypto.randomUUID();
          localStorage.setItem('userId', uid);
        }
        // Redirect with userId in URL
        window.location.href = `${window.location.pathname}?userId=${uid}`;
        return; // Stop execution here
      } else {
        // Save to localStorage for persistence
        localStorage.setItem('userId', uid);
        setUserId(uid);
        setIsInitializing(false);
      }
    };

    initializeUserId();
  }, []); // Empty dependency array - runs once

  // Load memories ONLY after userId is set
  useEffect(() => {
    if (userId && !isInitializing) {
      loadMemories();
    }
  }, [userId, isInitializing]);

  const getHeaders = () => ({
    'X-User-ID': userId || ''
  });

  const loadMemories = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/get_all_memories`, {
        headers: getHeaders()
      });
      setMemories(response.data.memories);
      setTotalMemories(response.data.total);
      calculateStats(response.data.memories);
    } catch (error: any) {
      console.error('Error loading memories:', error);
      if (error.response?.status === 429) {
        setError('Daily limit reached. Please try again tomorrow.');
      } else if (error.response?.status === 400) {
        setError('User authentication required. Refreshing...');
        // Force refresh to get userId
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setError('Failed to load memories. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (mems: Memory[]) => {
    if (mems.length === 0) return;

    const allTopics: string[] = [];
    mems.forEach(m => {
      if (m.topics && Array.isArray(m.topics)) {
        allTopics.push(...m.topics);
      }
    });
    
    const topicCount: { [key: string]: number } = {};
    allTopics.forEach(topic => {
      topicCount[topic] = (topicCount[topic] || 0) + 1;
    });

    const topTopics = Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    setStats({
      totalConversations: mems.length,
      averageLength: Math.round(mems.reduce((acc, m) => acc + m.summary.length, 0) / mems.length),
      mostCommonTopics: topTopics,
      lastCaptured: mems[0]?.timestamp || 'Never'
    });
  };

  const searchMemories = async () => {
    if (!searchQuery.trim() || !userId) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${API_URL}/search_memory`, {
        query: searchQuery,
        limit: 10
      }, {
        headers: getHeaders()
      });
      setSearchResults(response.data.memories);
    } catch (error: any) {
      console.error('Error searching memories:', error);
      if (error.response?.status === 429) {
        setError('Daily limit reached. Please try again tomorrow.');
      } else {
        setError('Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteMemory = async (memoryId: string) => {
    if (!userId) return;
    
    try {
      await axios.delete(`${API_URL}/delete_memory/${memoryId}`, {
        headers: getHeaders()
      });
      setDeleteConfirm(null);
      loadMemories();
    } catch (error: any) {
      console.error('Error deleting memory:', error);
      setError('Failed to delete memory. Please try again.');
    }
  };

  const exportMemories = () => {
    const exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
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

  const getRelevanceColor = (relevance?: number) => {
    if (!relevance) return '#666';
    if (relevance > 0.8) return '#10a37f';
    if (relevance > 0.6) return '#ffa500';
    return '#666';
  };

  // Show loading state while initializing
  if (isInitializing || !userId) {
    return (
      <div className="App">
        <div style={{ padding: '40px', textAlign: 'center' }}>
          <Brain size={48} />
          <h2>Loading your memory space...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="title-section">
            <Brain size={32} className="logo" />
            <h1>ChatGPT Spark</h1>
            <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '10px' }}>
              Your Private Memory Space
            </span>
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

      {error && (
        <div style={{
          background: '#ff6b6b',
          color: 'white',
          padding: '10px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError(null)} style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '16px'
          }}>×</button>
        </div>
      )}

      <main className="main-content">
        {showStats && stats && (
          <div className="stats-panel">
            <h3>Your Memory Statistics</h3>
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
                <span className="stat-label">Top Topics</span>
                <div className="topic-tags">
                  {stats.mostCommonTopics.length > 0 ? (
                    stats.mostCommonTopics.map(topic => (
                      <span key={topic} className="topic-tag">{topic}</span>
                    ))
                  ) : (
                    <span className="no-topics">No topics yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="search-section">
          <div className="search-container">
            <Search size={20} className="search-icon" />
            <input
              type="text"
              placeholder="Search your ChatGPT memories semantically..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchMemories()}
              className="search-input"
            />
            <button onClick={searchMemories} className="search-button">
              Search
            </button>
            {searchQuery && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }} 
                className="clear-button"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="search-hint">
              Using AI semantic search - try searching for concepts, not just keywords!
            </p>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="section">
            <h2>Search Results</h2>
            <div className="memory-grid">
              {searchResults.map((result, index) => (
                <div key={index} className="memory-card search-result"> 
                  <h3>{result.metadata.title}</h3>
                  <p className="summary">{result.metadata.summary}</p>
                  <div className="content-preview">{result.content.substring(0, 150)}...</div>
                  {result.metadata.topics && (
                    <div className="memory-topics">
                      {JSON.parse(result.metadata.topics).map((topic: string) => (
                        <span key={topic} className="topic-tag small">{topic}</span>
                      ))}
                    </div>
                  )}
                  {result.relevance && (
                    <div style={{
                      fontSize: '11px',
                      color: getRelevanceColor(result.relevance),
                      marginTop: '8px'
                    }}>
                      Relevance: {Math.round(result.relevance * 100)}%
                    </div>
                  )}
                  <div className="memory-meta">
                    <Calendar size={14} />
                    <span>{format(new Date(result.metadata.timestamp), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <div className="section-header">
            <h2>Your Recent Memories</h2>
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
              <p style={{ fontSize: '14px', opacity: 0.7, marginTop: '10px' }}>
                Click the extension icon on ChatGPT to save conversations
              </p>
            </div>
          ) : (
            <div className="memory-grid">
              {memories.slice(0, 12).map((memory) => (
                <div key={memory.id} className="memory-card">
                  <div className="memory-header">
                    <h3>{memory.title}</h3>
                    <button 
                      className="delete-button"
                      onClick={() => setDeleteConfirm(memory.id)}
                      title="Delete memory"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {deleteConfirm === memory.id && (
                    <div className="delete-confirm">
                      <p>Delete this memory?</p>
                      <button onClick={() => deleteMemory(memory.id)} className="confirm-delete">
                        Yes, delete
                      </button>
                      <button onClick={() => setDeleteConfirm(null)} className="cancel-delete">
                        Cancel
                      </button>
                    </div>
                  )}
                  <p className="summary">{memory.summary}</p>
                  {memory.topics && memory.topics.length > 0 && (
                    <div className="memory-topics">
                      {memory.topics.map(topic => (
                        <span key={topic} className="topic-tag small">{topic}</span>
                      ))}
                    </div>
                  )}
                  <div className="memory-meta">
                    <Calendar size={14} />
                    <span>{format(new Date(memory.timestamp), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          opacity: 0.6,
          fontSize: '12px'
        }}>
          <p>Your User ID: {userId}</p>
          <p>All memories are private to your browser installation</p>
        </div>
      </main>
    </div>
  );
}

export default App;