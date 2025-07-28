// Production backend URL
const BACKEND_URL = 'https://chatgpt-memory-manager-production.up.railway.app';

// Generate or get user ID
async function getUserId() {
    const result = await chrome.storage.local.get(['userId']);
    if (!result.userId) {
        const userId = 'user_' + crypto.randomUUID();
        await chrome.storage.local.set({ userId: userId });
        console.log('Generated new user ID:', userId);
        return userId;
    }
    return result.userId;
}

// Initialize user ID on install
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        const userId = await getUserId();
        console.log('Extension installed for user:', userId);
        
        // Optional: Open welcome page
        chrome.tabs.create({
            url: `https://frontend-eta-murex-79.vercel.app/welcome?userId=${userId}`
        });
    }
});

// Handle API calls from popup to bypass CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveConversation') {
        console.log('Saving conversation:', request.data);
        
        // Get user ID first
        getUserId().then(userId => {
            fetch(`${BACKEND_URL}/save_conversation`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId  // Add user ID to header
                },
                body: JSON.stringify(request.data)
            })
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Save successful:', data);
                sendResponse({success: true, data: data});
            })
            .catch(error => {
                console.error('Save error:', error);
                sendResponse({success: false, error: error.message});
            });
        });
        
        return true; // Indicates async response
    }
    
    if (request.action === 'checkBackend') {
        fetch(`${BACKEND_URL}/`)
        .then(response => response.json())
        .then(data => sendResponse({success: true, data: data}))
        .catch(error => sendResponse({success: false, error: error.message}));
        
        return true;
    }
    
    if (request.action === 'openDashboard') {
        // Open dashboard with user ID
        getUserId().then(userId => {
            chrome.tabs.create({
                url: `https://frontend-eta-murex-79.vercel.app?userId=${userId}`
            });
        });
    }
    
    if (request.action === 'getUserId') {
        // Allow other parts of extension to get user ID
        getUserId().then(userId => {
            sendResponse({userId: userId});
        });
        return true;
    }
    
    if (request.action === 'searchMemory') {
        getUserId().then(userId => {
            fetch(`${BACKEND_URL}/search_memory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-ID': userId
                },
                body: JSON.stringify(request.data)
            })
            .then(response => response.json())
            .then(data => sendResponse({success: true, data: data}))
            .catch(error => sendResponse({success: false, error: error.message}));
        });
        return true;
    }
});

console.log('Background script loaded with backend:', BACKEND_URL);