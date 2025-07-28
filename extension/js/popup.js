document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Popup loaded');
    
    const captureBtn = document.getElementById('captureBtn');
    const viewMemoryBtn = document.getElementById('viewMemoryBtn');
    const status = document.getElementById('status');
    
    console.log('🔍 Elements found:', {
        captureBtn: !!captureBtn,
        viewMemoryBtn: !!viewMemoryBtn,
        status: !!status
    });
    
    // Check backend connection via background script
    chrome.runtime.sendMessage({action: 'checkBackend'}, (response) => {
        console.log('🔍 Backend check response:', response);
        if (response && response.success) {
            status.textContent = 'Connected to Memory Backend';
            status.style.backgroundColor = '#d4f4dd';
        } else {
            status.textContent = 'Backend not connected';
            status.style.backgroundColor = '#f4d4d4';
        }
    });
    
    captureBtn.addEventListener('click', async () => {
        console.log('🔍 Capture button clicked');
        status.textContent = 'Capturing conversation...';
        
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            console.log('🔍 Current tab:', tab.url);
            
            // Check if we're on ChatGPT
            if (!tab.url.includes('chatgpt.com') && !tab.url.includes('chat.openai.com')) {
                status.textContent = 'Please go to chatgpt.com first';
                status.style.backgroundColor = '#f4d4d4';
                return;
            }
            
            console.log('🔍 Sending capture message to content script');
            chrome.tabs.sendMessage(tab.id, {action: 'capture'}, (response) => {
                console.log('🔍 Content script response:', response);
                
                // Handle connection error
                if (chrome.runtime.lastError) {
                    console.error('🔍 Runtime error:', chrome.runtime.lastError);
                    status.textContent = 'Please refresh ChatGPT page and try again';
                    status.style.backgroundColor = '#f4d4d4';
                    return;
                }
                
                if (response && response.conversation) {
                    console.log('🔍 Conversation captured:', response.conversation.length, 'messages');
                    status.textContent = `Saving ${response.conversation.length} messages...`;
                    
                    // Save via background script
                    console.log('🔍 Sending to background script');
                    chrome.runtime.sendMessage({
                        action: 'saveConversation',
                        data: {
                            messages: response.conversation,
                            url: tab.url,
                            title: tab.title
                        }
                    }, (saveResponse) => {
                        console.log('🔍 Background script save response:', saveResponse);
                        
                        if (saveResponse && saveResponse.success) {
                            const result = saveResponse.data;
                            status.textContent = `Saved! Summary: ${result.summary.substring(0, 50)}...`;
                            status.style.backgroundColor = '#d4f4dd';
                        } else {
                            status.textContent = 'Error saving: ' + (saveResponse?.error || 'Unknown error');
                            status.style.backgroundColor = '#f4d4d4';
                        }
                    });
                } else {
                    console.log('🔍 No conversation found in response');
                    status.textContent = 'No conversation found';
                    status.style.backgroundColor = '#f4d4d4';
                }
            });
        } catch (error) {
            console.error('🔍 Capture error:', error);
            status.textContent = 'Error: ' + error.message;
            status.style.backgroundColor = '#f4d4d4';
        }
    });
    
    viewMemoryBtn.addEventListener('click', async () => {
        console.log('🔍 View memory button clicked');
        chrome.runtime.sendMessage({action: 'openDashboard'});
    });
});