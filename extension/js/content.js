// Enhanced content script with real-time prompt analysis
console.log('ChatGPT Memory Manager with Prompt Analyzer loaded!');

let analysisOverlay = null;
let analysisTimeout = null;
let currentTextarea = null;

// Function to extract conversation (existing functionality)
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

// NEW: Find ChatGPT input textarea
function findChatGPTInput() {
    // ChatGPT uses different selectors, try multiple
    const selectors = [
        '#prompt-textarea',
        '[data-id="root"] textarea',
        'textarea[placeholder*="Message"]',
        'main textarea',
        '[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            console.log('Found ChatGPT input:', selector);
            return element;
        }
    }
    return null;
}

// NEW: Create analysis overlay UI
function createAnalysisOverlay() {
    if (analysisOverlay) return analysisOverlay;
    
    const overlay = document.createElement('div');
    overlay.id = 'prompt-analysis-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        transition: all 0.3s ease;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">Prompt Analysis</strong>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to see analysis...</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// NEW: Analyze prompt quality
function analyzePrompt(text) {
    if (!text || text.length < 10) {
        return {
            score: 0,
            suggestions: ['Start typing your prompt...'],
            strengths: []
        };
    }
    
    const analysis = {
        score: 5.0,
        suggestions: [],
        strengths: []
    };
    
    // Check length (optimal 20-200 characters for simple prompts)
    if (text.length < 20) {
        analysis.suggestions.push('💡 Try being more specific');
        analysis.score -= 1;
    } else if (text.length > 20) {
        analysis.strengths.push('✅ Good detail level');
        analysis.score += 0.5;
    }
    
    // Check for context
    const contextWords = ['i am', 'i need', 'my goal', 'context', 'background', 'for my'];
    if (contextWords.some(word => text.toLowerCase().includes(word))) {
        analysis.strengths.push('✅ Includes context');
        analysis.score += 1;
    } else if (text.length > 30) {
        analysis.suggestions.push('💡 Consider adding context about your situation');
    }
    
    // Check for examples
    if (text.toLowerCase().includes('example') || text.toLowerCase().includes('like')) {
        analysis.strengths.push('✅ Asks for examples');
        analysis.score += 0.5;
    }
    
    // Check for specific instructions
    const instructionWords = ['step by step', 'detailed', 'explain', 'list', 'format', 'style'];
    if (instructionWords.some(word => text.toLowerCase().includes(word))) {
        analysis.strengths.push('✅ Clear instructions');
        analysis.score += 0.5;
    } else if (text.length > 40) {
        analysis.suggestions.push('💡 Be specific about the format you want');
    }
    
    // Check for questions vs statements
    if (text.includes('?')) {
        analysis.strengths.push('✅ Clear question format');
        analysis.score += 0.5;
    }
    
    // Cap score at 10
    analysis.score = Math.min(10, Math.max(0, analysis.score));
    
    return analysis;
}

// NEW: Update analysis overlay
function updateAnalysisOverlay(analysis) {
    const overlay = analysisOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('#analysis-content');
    const scoreColor = analysis.score >= 7 ? '#10a37f' : analysis.score >= 5 ? '#ffa500' : '#ff4444';
    
    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <div style="font-weight: 600; color: ${scoreColor};">
                Score: ${analysis.score.toFixed(1)}/10
            </div>
            <div style="flex: 1; height: 4px; background: #f0f0f0; border-radius: 2px;">
                <div style="width: ${(analysis.score/10)*100}%; height: 100%; background: ${scoreColor}; border-radius: 2px; transition: width 0.3s;"></div>
            </div>
        </div>
        
        ${analysis.strengths.length > 0 ? `
            <div style="margin-bottom: 8px;">
                ${analysis.strengths.map(s => `<div style="font-size: 12px; color: #059669; margin-bottom: 2px;">${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions.length > 0 ? `
            <div>
                ${analysis.suggestions.map(s => `<div style="font-size: 12px; color: #d97706; margin-bottom: 2px;">${s}</div>`).join('')}
            </div>
        ` : ''}
    `;
}

// NEW: Handle input changes
function handleInputChange(event) {
    const text = event.target.value;
    
    // Clear previous timeout
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }
    
    // Show overlay when typing
    if (text.length > 0) {
        createAnalysisOverlay();
        analysisOverlay.style.display = 'block';
        
        // Debounce analysis (wait 500ms after user stops typing)
        analysisTimeout = setTimeout(() => {
            const analysis = analyzePrompt(text);
            updateAnalysisOverlay(analysis);
        }, 500);
    } else {
        // Hide overlay when empty
        if (analysisOverlay) {
            analysisOverlay.style.display = 'none';
        }
    }
}

// NEW: Set up input monitoring
function setupInputMonitoring() {
    const textarea = findChatGPTInput();
    
    if (textarea && textarea !== currentTextarea) {
        console.log('Setting up prompt analysis monitoring...');
        
        // Remove previous listener
        if (currentTextarea) {
            currentTextarea.removeEventListener('input', handleInputChange);
        }
        
        // Add new listener
        textarea.addEventListener('input', handleInputChange);
        currentTextarea = textarea;
        
        // Create overlay (hidden initially)
        createAnalysisOverlay();
        
        console.log('Prompt analysis ready!');
    }
}

// Initialize when page loads
function initialize() {
    setupInputMonitoring();
    
    // Re-check periodically in case ChatGPT DOM changes
    setInterval(setupInputMonitoring, 3000);
}

// Start initialization after a short delay
setTimeout(initialize, 2000);

// Listen for messages from popup (existing functionality)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'capture') {
        const conversation = extractConversation();
        sendResponse({ conversation: conversation });
    }
});
