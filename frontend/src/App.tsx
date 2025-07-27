import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadMemories();
  }, []);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const response = await axios.get('https://chatgpt-memory-manager-production.up.railway.app/get_all_memories');
      setMemories(response.data.memories);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{padding: '20px'}}>
      <h1>ChatGPT Memory Manager</h1>
      <p>Memories: {memories.length}</p>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div>
          {memories.map((memory) => (
            <div key={memory.id} style={{border: '1px solid #ccc', margin: '10px', padding: '10px'}}>
              <h3>{memory.title}</h3>
              <p>{memory.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
