// Production backend URL
const BACKEND_URL = 'https://chatgpt-memory-manager-production.up.railway.app';

// Handle API calls from popup to bypass CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveConversation') {
        console.log('Saving conversation:', request.data);
        
        fetch(`${BACKEND_URL}/save_conversation`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
        
        return true;
    }
    
    if (request.action === 'checkBackend') {
        fetch(`${BACKEND_URL}/`)
        .then(response => response.json())
        .then(data => sendResponse({success: true, data: data}))
        .catch(error => sendResponse({success: false, error: error.message}));
        
        return true;
    }
    
    if (request.action === 'openDashboard') {
        chrome.tabs.create({url: 'https://frontend-eta-murex-79.vercel.app'});
    }
});

console.log('Background script loaded with backend:', BACKEND_URL);
