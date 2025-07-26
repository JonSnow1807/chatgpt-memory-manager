// Handle API calls from popup to bypass CORS
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveConversation') {
        console.log('Saving conversation:', request.data);
        
        fetch('http://localhost:8000/save_conversation', {
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
        
        return true; // Keep the message channel open for async response
    }
    
    if (request.action === 'checkBackend') {
        fetch('http://localhost:8000/')
        .then(response => response.json())
        .then(data => sendResponse({success: true, data: data}))
        .catch(error => sendResponse({success: false, error: error.message}));
        
        return true;
    }
});

console.log('Background script loaded');
