document.addEventListener('DOMContentLoaded', function() {
    const captureBtn = document.getElementById('captureBtn');
    const viewMemoryBtn = document.getElementById('viewMemoryBtn');
    const status = document.getElementById('status');
    
    // Check backend connection via background script
    chrome.runtime.sendMessage({action: 'checkBackend'}, (response) => {
        if (response && response.success) {
            status.textContent = 'Connected to Memory Backend';
            status.style.backgroundColor = '#d4f4dd';
        } else {
            status.textContent = 'Backend not connected';
            status.style.backgroundColor = '#f4d4d4';
        }
    });
    
    captureBtn.addEventListener('click', async () => {
        status.textContent = 'Capturing conversation...';
        
        try {
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            
            chrome.tabs.sendMessage(tab.id, {action: 'capture'}, (response) => {
                if (response && response.conversation) {
                    status.textContent = `Saving ${response.conversation.length} messages...`;
                    
                    // Save via background script
                    chrome.runtime.sendMessage({
                        action: 'saveConversation',
                        data: {
                            messages: response.conversation,
                            url: tab.url,
                            title: tab.title
                        }
                    }, (saveResponse) => {
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
                    status.textContent = 'No conversation found';
                }
            });
        } catch (error) {
            status.textContent = 'Error: ' + error.message;
        }
    });
    
    viewMemoryBtn.addEventListener('click', async () => {
        chrome.tabs.create({url: 'http://localhost:3000'});
    });
});
