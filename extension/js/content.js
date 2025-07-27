// Enhanced content script with real-time prompt analysis for contenteditable
console.log('ChatGPT Memory Manager with Prompt Analyzer loaded!');

let analysisOverlay = null;
let analysisTimeout = null;
let currentInput = null;

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

// NEW: Find ChatGPT input (handles contenteditable)
function findChatGPTInput() {
    // ChatGPT uses contenteditable div
    const selectors = [
        '#prompt-textarea',
        '[data-id="root"] [contenteditable="true"]',
        '.ProseMirror',
        '[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.isContentEditable) {
            console.log('Found ChatGPT contenteditable input:', selector);
            return element;
        }
    }
    return null;
}

// NEW: Get text from contenteditable div
function getInputText(element) {
    if (!element) return '';
    
    // For contenteditable, use textContent or innerText
    return element.textContent || element.innerText || '';
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
        width: 320px;
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
        max-height: 400px;
        overflow-y: auto;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">✨ Prompt Coach</strong>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to see live analysis...</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// NEW: Enhanced prompt analysis
function analyzePrompt(text) {
    if (!text || text.trim().length < 5) {
        return {
            score: 0,
            suggestions: ['✍️ Start typing your prompt...'],
            strengths: [],
            tips: []
        };
    }
    
    const cleanText = text.trim();
    const analysis = {
        score: 3.0,
        suggestions: [],
        strengths: [],
        tips: []
    };
    
    // Length analysis
    if (cleanText.length < 15) {
        analysis.suggestions.push('📝 Try being more specific and detailed');
        analysis.score -= 1;
    } else if (cleanText.length >= 20 && cleanText.length <= 200) {
        analysis.strengths.push('✅ Good length and detail');
        analysis.score += 1;
    } else if (cleanText.length > 200) {
        analysis.strengths.push('✅ Very detailed prompt');
        analysis.score += 0.5;
    }
    
    // Context indicators
    const contextWords = ['i am', 'i need', 'my goal', 'context', 'background', 'for my', 'help me', 'i want'];
    const hasContext = contextWords.some(word => cleanText.toLowerCase().includes(word));
    if (hasContext) {
        analysis.strengths.push('✅ Includes personal context');
        analysis.score += 1;
    } else if (cleanText.length > 30) {
        analysis.suggestions.push('💡 Add context: "I need help with..." or "My goal is..."');
    }
    
    // Specificity indicators
    const specificWords = ['specific', 'detailed', 'step by step', 'explain', 'show me', 'how to', 'what is'];
    if (specificWords.some(word => cleanText.toLowerCase().includes(word))) {
        analysis.strengths.push('✅ Asks for specific information');
        analysis.score += 1;
    }
    
    // Question format
    if (cleanText.includes('?')) {
        analysis.strengths.push('✅ Clear question format');
        analysis.score += 0.5;
    } else if (cleanText.length > 20) {
        analysis.tips.push('❓ Consider phrasing as a question');
    }
    
    // Examples request
    if (cleanText.toLowerCase().includes('example')) {
        analysis.strengths.push('✅ Requests examples');
        analysis.score += 0.5;
    } else if (cleanText.length > 40) {
        analysis.tips.push('📚 Ask for examples to get better responses');
    }
    
    // Format/style instructions
    const formatWords = ['format', 'style', 'structure', 'organize', 'list', 'bullet points'];
    if (formatWords.some(word => cleanText.toLowerCase().includes(word))) {
        analysis.strengths.push('✅ Specifies desired format');
        analysis.score += 0.5;
    }
    
    // Professional/polite tone
    const politeWords = ['please', 'could you', 'would you', 'can you help'];
    if (politeWords.some(word => cleanText.toLowerCase().includes(word))) {
        analysis.strengths.push('✅ Polite and professional');
        analysis.score += 0.3;
    }
    
    // Cap score between 0-10
    analysis.score = Math.min(10, Math.max(0, analysis.score));
    
    // Add general tips based on score
    if (analysis.score < 5) {
        analysis.tips.push('🎯 Try: "Can you help me [specific task] for [context]?"');
    } else if (analysis.score >= 8) {
        analysis.tips.push('🌟 Excellent prompt! This should get great results.');
    }
    
    return analysis;
}

// NEW: Update analysis overlay with better styling
function updateAnalysisOverlay(analysis) {
    const overlay = analysisOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('#analysis-content');
    const scoreColor = analysis.score >= 7 ? '#10a37f' : analysis.score >= 4 ? '#ffa500' : '#ff6b6b';
    const scoreEmoji = analysis.score >= 7 ? '🎯' : analysis.score >= 4 ? '⚡' : '🔧';
    
    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 16px;">${scoreEmoji}</span>
            <div style="font-weight: 600; color: ${scoreColor};">
                ${analysis.score.toFixed(1)}/10
            </div>
            <div style="flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px;">
                <div style="width: ${(analysis.score/10)*100}%; height: 100%; background: ${scoreColor}; border-radius: 3px; transition: width 0.3s;"></div>
            </div>
        </div>
        
        ${analysis.strengths.length > 0 ? `
            <div style="margin-bottom: 10px;">
                ${analysis.strengths.map(s => `<div style="font-size: 12px; color: #059669; margin-bottom: 3px; line-height: 1.4;">${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions.length > 0 ? `
            <div style="margin-bottom: 10px;">
                ${analysis.suggestions.map(s => `<div style="font-size: 12px; color: #d97706; margin-bottom: 3px; line-height: 1.4;">${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.tips.length > 0 ? `
            <div style="background: rgba(16, 163, 127, 0.1); padding: 8px; border-radius: 6px; margin-top: 8px;">
                ${analysis.tips.map(s => `<div style="font-size: 11px; color: #047857; margin-bottom: 2px; line-height: 1.4;">${s}</div>`).join('')}
            </div>
        ` : ''}
    `;
}

// NEW: Handle input changes for contenteditable
function handleInputChange() {
    const text = getInputText(currentInput);
    
    // Clear previous timeout
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }
    
    // Show overlay when typing
    if (text.length > 0) {
        createAnalysisOverlay();
        analysisOverlay.style.display = 'block';
        
        // Debounce analysis (wait 300ms after user stops typing)
        analysisTimeout = setTimeout(() => {
            const analysis = analyzePrompt(text);
            updateAnalysisOverlay(analysis);
            console.log('Prompt analysis:', { text: text.substring(0, 50) + '...', score: analysis.score });
        }, 300);
    } else {
        // Hide overlay when empty
        if (analysisOverlay) {
            analysisOverlay.style.display = 'none';
        }
    }
}

// NEW: Set up input monitoring for contenteditable
function setupInputMonitoring() {
    const input = findChatGPTInput();
    
    if (input && input !== currentInput) {
        console.log('Setting up prompt analysis monitoring for contenteditable...');
        
        // Remove previous listeners
        if (currentInput) {
            currentInput.removeEventListener('input', handleInputChange);
            currentInput.removeEventListener('keyup', handleInputChange);
            currentInput.removeEventListener('paste', handleInputChange);
        }
        
        // Add new listeners for contenteditable
        input.addEventListener('input', handleInputChange);
        input.addEventListener('keyup', handleInputChange);
        input.addEventListener('paste', handleInputChange);
        currentInput = input;
        
        // Create overlay (hidden initially)
        createAnalysisOverlay();
        
        console.log('✨ Prompt analysis ready for contenteditable!');
    }
}

// Initialize when page loads
function initialize() {
    console.log('Initializing prompt analyzer...');
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
