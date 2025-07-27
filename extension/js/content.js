// Enhanced content script with intelligent contextual suggestions
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

// Find ChatGPT input
function findChatGPTInput() {
    const selectors = [
        '#prompt-textarea',
        '[data-id="root"] [contenteditable="true"]',
        '.ProseMirror',
        '[contenteditable="true"]'
    ];
    
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.isContentEditable) {
            return element;
        }
    }
    return null;
}

function getInputText(element) {
    if (!element) return '';
    return element.textContent || element.innerText || '';
}

// NEW: Intelligent context detection
function detectContext(text) {
    const lower = text.toLowerCase();
    
    // Programming/Code context
    if (lower.match(/\b(code|python|javascript|react|css|html|debug|error|function|variable|api|database)\b/)) {
        return {
            type: 'programming',
            keywords: ['code', 'python', 'javascript', 'react', 'debug', 'error', 'function']
        };
    }
    
    // Writing/Content context
    if (lower.match(/\b(write|essay|article|blog|content|grammar|style|tone|email|letter)\b/)) {
        return {
            type: 'writing',
            keywords: ['write', 'essay', 'article', 'content', 'email']
        };
    }
    
    // Learning/Education context
    if (lower.match(/\b(learn|explain|understand|teach|study|concept|theory|how does|what is)\b/)) {
        return {
            type: 'learning',
            keywords: ['learn', 'explain', 'understand', 'teach', 'concept']
        };
    }
    
    // Business/Professional context
    if (lower.match(/\b(business|marketing|strategy|plan|presentation|meeting|professional|work)\b/)) {
        return {
            type: 'business',
            keywords: ['business', 'marketing', 'strategy', 'presentation']
        };
    }
    
    // Creative context
    if (lower.match(/\b(creative|story|poem|design|art|brainstorm|idea|innovative)\b/)) {
        return {
            type: 'creative',
            keywords: ['creative', 'story', 'design', 'brainstorm', 'idea']
        };
    }
    
    return { type: 'general', keywords: [] };
}

// NEW: Generate contextual suggestions
function generateContextualSuggestions(text, context, score) {
    const suggestions = [];
    const lower = text.toLowerCase();
    
    // Context-specific suggestions
    switch (context.type) {
        case 'programming':
            if (!lower.includes('language') && !lower.includes('python') && !lower.includes('javascript')) {
                suggestions.push('💻 Specify the programming language you\'re using');
            }
            if (!lower.includes('error') && !lower.includes('problem')) {
                suggestions.push('🐛 Describe the specific error or problem');
            }
            if (!lower.includes('code') && score < 6) {
                suggestions.push('📝 Include the relevant code snippet');
            }
            break;
            
        case 'writing':
            if (!lower.includes('tone') && !lower.includes('style')) {
                suggestions.push('✍️ Specify the tone/style you want (formal, casual, etc.)');
            }
            if (!lower.includes('audience') && !lower.includes('for')) {
                suggestions.push('👥 Mention your target audience');
            }
            if (!lower.includes('length') && !lower.includes('words')) {
                suggestions.push('📏 Specify desired length (words/paragraphs)');
            }
            break;
            
        case 'learning':
            if (!lower.includes('level') && !lower.includes('beginner') && !lower.includes('advanced')) {
                suggestions.push('🎓 Specify your experience level (beginner/intermediate/advanced)');
            }
            if (!lower.includes('example')) {
                suggestions.push('📚 Ask for examples to understand better');
            }
            if (!lower.includes('step')) {
                suggestions.push('🪜 Request step-by-step explanations');
            }
            break;
            
        case 'business':
            if (!lower.includes('goal') && !lower.includes('objective')) {
                suggestions.push('🎯 Clarify your business goal or objective');
            }
            if (!lower.includes('industry') && !lower.includes('company')) {
                suggestions.push('🏢 Mention your industry or company context');
            }
            break;
            
        case 'creative':
            if (!lower.includes('style') && !lower.includes('genre')) {
                suggestions.push('🎨 Specify the style or genre you prefer');
            }
            if (!lower.includes('inspiration') && !lower.includes('similar')) {
                suggestions.push('💡 Mention any inspiration or similar works');
            }
            break;
            
        default:
            if (score < 4) {
                suggestions.push('💡 Be more specific about what you need');
                suggestions.push('🎯 Add context about your situation');
            }
    }
    
    // General improvements based on text analysis
    if (!text.includes('?') && text.length > 20) {
        suggestions.push('❓ Try phrasing as a clear question');
    }
    
    if (text.length < 20) {
        suggestions.push('📝 Add more details to get better results');
    }
    
    if (!lower.includes('please') && !lower.includes('can you') && !lower.includes('help')) {
        suggestions.push('🤝 Start with "Can you help me..." for clarity');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 most relevant suggestions
}

// Create analysis overlay UI
function createAnalysisOverlay() {
    if (analysisOverlay) return analysisOverlay;
    
    const overlay = document.createElement('div');
    overlay.id = 'prompt-analysis-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 340px;
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
        max-height: 450px;
        overflow-y: auto;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">✨ Prompt Coach</strong>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to see intelligent analysis...</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// NEW: Enhanced intelligent analysis
function analyzePrompt(text) {
    if (!text || text.trim().length < 3) {
        return {
            score: 0,
            suggestions: [],
            strengths: [],
            context: { type: 'general', keywords: [] }
        };
    }
    
    const cleanText = text.trim();
    const context = detectContext(cleanText);
    
    let score = 2.0; // Base score
    const strengths = [];
    
    // Length scoring
    if (cleanText.length >= 15 && cleanText.length <= 150) {
        strengths.push('✅ Good length');
        score += 1.5;
    } else if (cleanText.length > 150) {
        strengths.push('✅ Very detailed');
        score += 1;
    }
    
    // Context awareness
    if (context.keywords.length > 0) {
        strengths.push(`✅ ${context.type.charAt(0).toUpperCase() + context.type.slice(1)} context detected`);
        score += 1;
    }
    
    // Specificity
    const specificWords = ['specific', 'exactly', 'precisely', 'detailed', 'step by step'];
    if (specificWords.some(word => cleanText.toLowerCase().includes(word))) {
        strengths.push('✅ Asks for specificity');
        score += 1;
    }
    
    // Question format
    if (cleanText.includes('?')) {
        strengths.push('✅ Clear question format');
        score += 0.5;
    }
    
    // Politeness
    const politeWords = ['please', 'could you', 'can you', 'would you mind'];
    if (politeWords.some(word => cleanText.toLowerCase().includes(word))) {
        strengths.push('✅ Polite tone');
        score += 0.5;
    }
    
    // Context/background provided
    const contextWords = ['i am', 'i need', 'my goal', 'background', 'situation', 'working on'];
    if (contextWords.some(word => cleanText.toLowerCase().includes(word))) {
        strengths.push('✅ Provides context');
        score += 1;
    }
    
    // Examples requested
    if (cleanText.toLowerCase().includes('example')) {
        strengths.push('✅ Requests examples');
        score += 0.5;
    }
    
    score = Math.min(10, Math.max(0, score));
    
    const suggestions = generateContextualSuggestions(cleanText, context, score);
    
    return { score, suggestions, strengths, context };
}

// Update analysis overlay
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
        
        ${analysis.context.type !== 'general' ? `
            <div style="background: rgba(16, 163, 127, 0.1); padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #047857;">
                🧠 Context: ${analysis.context.type.charAt(0).toUpperCase() + analysis.context.type.slice(1)}
            </div>
        ` : ''}
        
        ${analysis.strengths.length > 0 ? `
            <div style="margin-bottom: 10px;">
                ${analysis.strengths.map(s => `<div style="font-size: 12px; color: #059669; margin-bottom: 3px; line-height: 1.4;">${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 Suggestions:</div>
                ${analysis.suggestions.map(s => `<div style="font-size: 11px; color: #ea580c; margin-bottom: 3px; line-height: 1.4;">• ${s}</div>`).join('')}
            </div>
        ` : ''}
    `;
}

// Handle input changes
function handleInputChange() {
    const text = getInputText(currentInput);
    
    if (analysisTimeout) clearTimeout(analysisTimeout);
    
    if (text.length > 0) {
        createAnalysisOverlay();
        analysisOverlay.style.display = 'block';
        
        analysisTimeout = setTimeout(() => {
            const analysis = analyzePrompt(text);
            updateAnalysisOverlay(analysis);
        }, 300);
    } else {
        if (analysisOverlay) {
            analysisOverlay.style.display = 'none';
        }
    }
}

// Set up monitoring
function setupInputMonitoring() {
    const input = findChatGPTInput();
    
    if (input && input !== currentInput) {
        if (currentInput) {
            currentInput.removeEventListener('input', handleInputChange);
            currentInput.removeEventListener('keyup', handleInputChange);
            currentInput.removeEventListener('paste', handleInputChange);
        }
        
        input.addEventListener('input', handleInputChange);
        input.addEventListener('keyup', handleInputChange);
        input.addEventListener('paste', handleInputChange);
        currentInput = input;
        
        createAnalysisOverlay();
        console.log('✨ Intelligent Prompt Coach ready!');
    }
}

// Initialize
function initialize() {
    setupInputMonitoring();
    setInterval(setupInputMonitoring, 3000);
}

setTimeout(initialize, 2000);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'capture') {
        const conversation = extractConversation();
        sendResponse({ conversation: conversation });
    }
});
