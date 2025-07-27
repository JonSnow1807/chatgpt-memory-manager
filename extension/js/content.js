// Enhanced content script with comprehensive contextual suggestions
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

// NEW: Comprehensive context detection
function detectContext(text) {
    const lower = text.toLowerCase();
    
    // Programming/Tech
    if (lower.match(/\b(code|python|javascript|react|css|html|debug|error|function|variable|api|database|programming|software|algorithm|framework|library)\b/)) {
        return { type: 'programming', icon: '💻', keywords: ['code', 'python', 'javascript', 'debug', 'error'] };
    }
    
    // Writing/Content
    if (lower.match(/\b(write|essay|article|blog|content|grammar|style|tone|email|letter|copy|copywriting|editing|proofreading)\b/)) {
        return { type: 'writing', icon: '✍️', keywords: ['write', 'essay', 'article', 'content', 'email'] };
    }
    
    // Learning/Education
    if (lower.match(/\b(learn|explain|understand|teach|study|concept|theory|how does|what is|education|academic|research|homework)\b/)) {
        return { type: 'learning', icon: '🎓', keywords: ['learn', 'explain', 'understand', 'teach', 'concept'] };
    }
    
    // Business/Professional
    if (lower.match(/\b(business|marketing|strategy|plan|presentation|meeting|professional|work|corporate|sales|revenue|growth|startup)\b/)) {
        return { type: 'business', icon: '💼', keywords: ['business', 'marketing', 'strategy', 'presentation'] };
    }
    
    // Creative/Design
    if (lower.match(/\b(creative|story|poem|design|art|brainstorm|idea|innovative|drawing|painting|music|creative writing|graphics)\b/)) {
        return { type: 'creative', icon: '🎨', keywords: ['creative', 'story', 'design', 'brainstorm', 'idea'] };
    }
    
    // Health/Medical
    if (lower.match(/\b(health|medical|doctor|symptoms|medicine|treatment|wellness|fitness|nutrition|diet|exercise|workout|therapy)\b/)) {
        return { type: 'health', icon: '🏥', keywords: ['health', 'medical', 'symptoms', 'wellness', 'fitness'] };
    }
    
    // Legal/Law
    if (lower.match(/\b(legal|law|lawyer|attorney|contract|lawsuit|court|rights|legislation|regulation|compliance|patent|copyright)\b/)) {
        return { type: 'legal', icon: '⚖️', keywords: ['legal', 'law', 'contract', 'rights', 'compliance'] };
    }
    
    // Finance/Money
    if (lower.match(/\b(finance|money|investment|stock|trading|budget|taxes|banking|cryptocurrency|bitcoin|economics|financial)\b/)) {
        return { type: 'finance', icon: '💰', keywords: ['finance', 'investment', 'budget', 'taxes', 'economics'] };
    }
    
    // Travel/Tourism
    if (lower.match(/\b(travel|trip|vacation|hotel|flight|tourism|destination|itinerary|booking|passport|visa|airline)\b/)) {
        return { type: 'travel', icon: '✈️', keywords: ['travel', 'trip', 'vacation', 'hotel', 'flight'] };
    }
    
    // Cooking/Food
    if (lower.match(/\b(cook|recipe|food|ingredient|kitchen|meal|dish|baking|cooking|chef|restaurant|cuisine|nutrition)\b/)) {
        return { type: 'cooking', icon: '👨‍🍳', keywords: ['recipe', 'cooking', 'ingredient', 'meal', 'dish'] };
    }
    
    // Sports/Fitness
    if (lower.match(/\b(sport|sports|fitness|workout|training|exercise|gym|athlete|game|team|competition|strength|cardio)\b/)) {
        return { type: 'sports', icon: '🏃‍♂️', keywords: ['sports', 'fitness', 'workout', 'training', 'exercise'] };
    }
    
    // Science/Research
    if (lower.match(/\b(science|research|experiment|hypothesis|data|analysis|chemistry|physics|biology|mathematics|scientific)\b/)) {
        return { type: 'science', icon: '🔬', keywords: ['science', 'research', 'experiment', 'data', 'analysis'] };
    }
    
    // Technology/Gadgets
    if (lower.match(/\b(technology|tech|gadget|smartphone|computer|laptop|tablet|device|electronics|innovation|digital)\b/)) {
        return { type: 'technology', icon: '📱', keywords: ['technology', 'gadget', 'device', 'electronics'] };
    }
    
    // Gaming
    if (lower.match(/\b(game|gaming|video game|console|player|strategy|RPG|fps|multiplayer|Steam|PlayStation|Xbox)\b/)) {
        return { type: 'gaming', icon: '🎮', keywords: ['game', 'gaming', 'player', 'strategy', 'console'] };
    }
    
    // Home/DIY
    if (lower.match(/\b(home|house|DIY|repair|maintenance|decoration|furniture|garden|cleaning|organizing|renovation)\b/)) {
        return { type: 'home', icon: '🏠', keywords: ['home', 'DIY', 'repair', 'decoration', 'garden'] };
    }
    
    // Relationships/Social
    if (lower.match(/\b(relationship|dating|friendship|family|social|communication|advice|conflict|counseling|therapy)\b/)) {
        return { type: 'relationships', icon: '💕', keywords: ['relationship', 'social', 'communication', 'advice'] };
    }
    
    return { type: 'general', icon: '💬', keywords: [] };
}

// NEW: Generate contextual suggestions for all domains
function generateContextualSuggestions(text, context, score) {
    const suggestions = [];
    const lower = text.toLowerCase();
    
    switch (context.type) {
        case 'programming':
            if (!lower.includes('language') && !lower.match(/\b(python|javascript|java|c\+\+|react|node)\b/)) {
                suggestions.push('💻 Specify the programming language or framework');
            }
            if (!lower.includes('error') && !lower.includes('issue') && score < 6) {
                suggestions.push('🐛 Describe the specific error or issue you\'re facing');
            }
            if (!lower.includes('code') && !lower.includes('example')) {
                suggestions.push('📝 Include relevant code snippets or examples');
            }
            break;
            
        case 'writing':
            if (!lower.includes('audience') && !lower.includes('for whom')) {
                suggestions.push('👥 Specify your target audience');
            }
            if (!lower.includes('tone') && !lower.includes('style')) {
                suggestions.push('✍️ Mention desired tone (formal, casual, professional)');
            }
            if (!lower.includes('length') && !lower.includes('word')) {
                suggestions.push('📏 Specify length requirements');
            }
            break;
            
        case 'health':
            if (!lower.includes('doctor') && !lower.includes('professional')) {
                suggestions.push('⚠️ Remember to consult healthcare professionals for medical advice');
            }
            if (!lower.includes('age') && !lower.includes('gender')) {
                suggestions.push('👤 Include relevant demographics (age, gender if applicable)');
            }
            if (!lower.includes('symptom') && lower.includes('pain')) {
                suggestions.push('🩺 Describe symptoms more specifically (location, intensity, duration)');
            }
            break;
            
        case 'legal':
            if (!lower.includes('jurisdiction') && !lower.includes('state') && !lower.includes('country')) {
                suggestions.push('🗺️ Specify your jurisdiction (state/country) as laws vary');
            }
            suggestions.push('⚖️ Consider consulting a qualified attorney for legal advice');
            if (!lower.includes('situation') && !lower.includes('circumstance')) {
                suggestions.push('📋 Provide more context about your specific situation');
            }
            break;
            
        case 'finance':
            if (!lower.includes('risk') && lower.includes('invest')) {
                suggestions.push('⚠️ Consider your risk tolerance and investment timeline');
            }
            if (!lower.includes('goal') && !lower.includes('objective')) {
                suggestions.push('🎯 Clarify your financial goals and timeline');
            }
            suggestions.push('💼 Consider consulting a financial advisor for personalized advice');
            break;
            
        case 'travel':
            if (!lower.includes('budget') && !lower.includes('cost')) {
                suggestions.push('💰 Mention your budget range');
            }
            if (!lower.includes('date') && !lower.includes('when')) {
                suggestions.push('📅 Include travel dates or season');
            }
            if (!lower.includes('preference') && !lower.includes('like')) {
                suggestions.push('❤️ Share your travel preferences (culture, adventure, relaxation)');
            }
            break;
            
        case 'cooking':
            if (!lower.includes('people') && !lower.includes('serving')) {
                suggestions.push('👥 Specify how many people you\'re cooking for');
            }
            if (!lower.includes('diet') && !lower.includes('allerg')) {
                suggestions.push('🥗 Mention any dietary restrictions or allergies');
            }
            if (!lower.includes('time') && !lower.includes('quick')) {
                suggestions.push('⏰ Include available cooking time');
            }
            break;
            
        case 'sports':
            if (!lower.includes('level') && !lower.includes('beginner') && !lower.includes('experience')) {
                suggestions.push('🏃‍♂️ Specify your fitness/experience level');
            }
            if (!lower.includes('goal') && !lower.includes('target')) {
                suggestions.push('🎯 Clarify your fitness goals');
            }
            if (!lower.includes('equipment') && !lower.includes('gym')) {
                suggestions.push('🏋️‍♂️ Mention available equipment or location');
            }
            break;
            
        case 'science':
            if (!lower.includes('level') && !lower.includes('grade')) {
                suggestions.push('🎓 Specify the academic level (high school, college, etc.)');
            }
            if (!lower.includes('context') && !lower.includes('application')) {
                suggestions.push('🔬 Provide context for the scientific concept');
            }
            break;
            
        case 'technology':
            if (!lower.includes('model') && !lower.includes('version')) {
                suggestions.push('📱 Include device model or software version');
            }
            if (!lower.includes('budget') && lower.includes('buy')) {
                suggestions.push('💰 Mention your budget range');
            }
            break;
            
        case 'gaming':
            if (!lower.includes('platform') && !lower.includes('console')) {
                suggestions.push('🎮 Specify gaming platform (PC, console, mobile)');
            }
            if (!lower.includes('genre') && !lower.includes('type')) {
                suggestions.push('🎲 Mention preferred game genres or types');
            }
            break;
            
        case 'home':
            if (!lower.includes('budget') && lower.includes('cost')) {
                suggestions.push('💰 Include your budget for the project');
            }
            if (!lower.includes('space') && !lower.includes('room')) {
                suggestions.push('🏠 Describe the space or room details');
            }
            break;
            
        case 'relationships':
            if (!lower.includes('context') && !lower.includes('situation')) {
                suggestions.push('💕 Provide more context about the situation');
            }
            suggestions.push('🗣️ Consider professional counseling for serious relationship issues');
            break;
            
        default:
            if (score < 4) {
                suggestions.push('💡 Be more specific about what you need');
                suggestions.push('🎯 Add context about your situation or goal');
            }
    }
    
    // General improvements
    if (!text.includes('?') && text.length > 20) {
        suggestions.push('❓ Try phrasing as a clear question');
    }
    
    if (text.length < 20) {
        suggestions.push('📝 Add more details for better results');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 most relevant
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
        width: 360px;
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
        max-height: 500px;
        overflow-y: auto;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">✨ AI Prompt Coach</strong>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to see intelligent analysis...</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// Enhanced intelligent analysis
function analyzePrompt(text) {
    if (!text || text.trim().length < 3) {
        return {
            score: 0,
            suggestions: [],
            strengths: [],
            context: { type: 'general', icon: '💬', keywords: [] }
        };
    }
    
    const cleanText = text.trim();
    const context = detectContext(cleanText);
    
    let score = 2.0;
    const strengths = [];
    
    // Length scoring
    if (cleanText.length >= 15 && cleanText.length <= 150) {
        strengths.push('✅ Good length');
        score += 1.5;
    } else if (cleanText.length > 150) {
        strengths.push('✅ Very detailed');
        score += 1;
    }
    
    // Context awareness bonus
    if (context.keywords.length > 0) {
        strengths.push(`✅ ${context.type.charAt(0).toUpperCase() + context.type.slice(1)} context`);
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
    const politeWords = ['please', 'could you', 'can you', 'would you mind', 'help me'];
    if (politeWords.some(word => cleanText.toLowerCase().includes(word))) {
        strengths.push('✅ Polite tone');
        score += 0.5;
    }
    
    // Context provided
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
                ${analysis.context.icon} Context: ${analysis.context.type.charAt(0).toUpperCase() + analysis.context.type.slice(1)}
            </div>
        ` : ''}
        
        ${analysis.strengths.length > 0 ? `
            <div style="margin-bottom: 10px;">
                ${analysis.strengths.map(s => `<div style="font-size: 12px; color: #059669; margin-bottom: 3px; line-height: 1.4;">${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 Smart Suggestions:</div>
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
        console.log('✨ Comprehensive AI Prompt Coach ready! Supports 16+ domains');
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
