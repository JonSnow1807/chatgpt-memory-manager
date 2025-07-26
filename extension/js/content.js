// This script runs on ChatGPT pages
console.log('ChatGPT Memory Manager loaded!');

// Function to extract conversation
function extractConversation() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach(element => {
        const role = element.getAttribute('data-message-author-role');
        const textElement = element.querySelector('.markdown');
        if (textElement) {
            messages.push({
                role: role,
                content: textElement.innerText,
                timestamp: new Date().toISOString()
            });
        }
    });
    
    return messages;
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'capture') {
        const conversation = extractConversation();
        sendResponse({ conversation: conversation });
    }
});
