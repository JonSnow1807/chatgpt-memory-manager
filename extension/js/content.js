// Enhanced content script with REAL OpenAI API analysis
console.log('ChatGPT Memory Manager with Real AI Analysis loaded!');

let analysisOverlay = null;
let analysisTimeout = null;
let currentInput = null;
let lastAnalyzedText = '';
let isAnalyzing = false;

const API_URL = 'https://chatgpt-memory-manager-production.up.railway.app';

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

// NEW: Real OpenAI API Analysis
async function analyzePromptWithOpenAI(promptText) {
    try {
        console.log('🤖 Analyzing prompt with OpenAI API...');
        isAnalyzing = true;
        
        // Show loading state
        updateAnalysisOverlay({
            score: 0,
            context: 'general',
            strengths: [],
            suggestions: [],
            analysis: '🤖 AI analyzing your prompt...',
            loading: true
        });
        
        const response = await fetch(`${API_URL}/analyze_prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: promptText
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const analysis = await response.json();
        console.log('✅ OpenAI analysis received:', analysis);
        
        // Add domain icon mapping
        const domainIcons = {
            'programming': '💻',
            'writing': '✍️',
            'learning': '🎓',
            'business': '💼',
            'creative': '🎨',
            'health': '🏥',
            'legal': '⚖️',
            'finance': '💰',
            'travel': '✈️',
            'cooking': '👨‍🍳',
            'sports': '🏃‍♂️',
            'science': '🔬',
            'technology': '📱',
            'gaming': '🎮',
            'home': '🏠',
            'relationships': '💕',
            'general': '💬'
        };
        
        analysis.icon = domainIcons[analysis.context] || '💬';
        analysis.loading = false;
        
        return analysis;
        
    } catch (error) {
        console.error('❌ OpenAI analysis failed:', error);
        
        // Return fallback analysis
        return {
            score: 3.0,
            context: 'general',
            icon: '💬',
            strengths: [],
            suggestions: ['AI analysis temporarily unavailable'],
            analysis: 'Using basic analysis - OpenAI API unavailable',
            loading: false,
            error: true
        };
    } finally {
        isAnalyzing = false;
    }
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
        width: 380px;
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
        max-height: 550px;
        overflow-y: auto;
    `;
    
    overlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">🤖 AI Prompt Coach</strong>
            <div style="margin-left: auto; font-size: 10px; color: #666; background: rgba(16, 163, 127, 0.1); padding: 2px 6px; border-radius: 8px;">
                Powered by OpenAI
            </div>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to get real AI analysis...</div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// Update analysis overlay with real AI results
function updateAnalysisOverlay(analysis) {
    const overlay = analysisOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('#analysis-content');
    
    if (analysis.loading) {
        content.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; padding: 20px; text-align: center;">
                <div style="width: 16px; height: 16px; border: 2px solid #10a37f; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <div style="color: #666; font-size: 13px;">${analysis.analysis}</div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        return;
    }
    
    const scoreColor = analysis.score >= 7 ? '#10a37f' : analysis.score >= 4 ? '#ffa500' : '#ff6b6b';
    const scoreEmoji = analysis.score >= 8 ? '🎯' : analysis.score >= 6 ? '⚡' : analysis.score >= 4 ? '🔧' : '📝';
    
    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 16px;">${scoreEmoji}</span>
            <div style="font-weight: 600; color: ${scoreColor};">
                ${analysis.score.toFixed(1)}/10
            </div>
            <div style="flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px;">
                <div style="width: ${(analysis.score/10)*100}%; height: 100%; background: ${scoreColor}; border-radius: 3px; transition: width 0.3s;"></div>
            </div>
            ${analysis.error ? '<span style="font-size: 12px; color: #ff6b6b;">⚠️</span>' : '<span style="font-size: 12px; color: #10a37f;">✨</span>'}
        </div>
        
        ${analysis.context !== 'general' ? `
            <div style="background: rgba(16, 163, 127, 0.1); padding: 6px 10px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #047857; display: flex; align-items: center; gap: 6px;">
                <span>${analysis.icon}</span>
                <span>Context: ${analysis.context.charAt(0).toUpperCase() + analysis.context.slice(1)}</span>
            </div>
        ` : ''}
        
        ${analysis.analysis ? `
            <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 10px;">
                <div style="font-size: 11px; color: #1d4ed8; font-weight: 600; margin-bottom: 4px;">🧠 AI Analysis:</div>
                <div style="font-size: 11px; color: #1d4ed8; line-height: 1.4;">${analysis.analysis}</div>
            </div>
        ` : ''}
        
        ${analysis.strengths && analysis.strengths.length > 0 ? `
            <div style="margin-bottom: 10px;">
                <div style="font-size: 11px; color: #059669; font-weight: 600; margin-bottom: 4px;">✅ Strengths:</div>
                ${analysis.strengths.map(s => `<div style="font-size: 11px; color: #059669; margin-bottom: 3px; line-height: 1.4;">• ${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions && analysis.suggestions.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 AI Suggestions:</div>
                ${analysis.suggestions.map(s => `<div style="font-size: 11px; color: #ea580c; margin-bottom: 3px; line-height: 1.4;">• ${s}</div>`).join('')}
            </div>
        ` : ''}
        
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center;">
            ${analysis.error ? 'Fallback analysis' : 'Analyzed by OpenAI GPT-4'}
        </div>
    `;
}

// Handle input changes with AI analysis
function handleInputChange() {
    const text = getInputText(currentInput);
    
    // Clear previous timeout
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }
    
    if (text.length > 0) {
        createAnalysisOverlay();
        analysisOverlay.style.display = 'block';
        
        // Don't re-analyze the same text
        if (text === lastAnalyzedText || isAnalyzing) {
            return;
        }
        
        // Debounce AI analysis (wait 1.5 seconds after user stops typing)
        analysisTimeout = setTimeout(async () => {
            if (text.length >= 10 && text !== lastAnalyzedText) {
                lastAnalyzedText = text;
                
                try {
                    const analysis = await analyzePromptWithOpenAI(text);
                    updateAnalysisOverlay(analysis);
                } catch (error) {
                    console.error('Analysis error:', error);
                }
            } else if (text.length < 10) {
                // Show quick feedback for short prompts
                updateAnalysisOverlay({
                    score: 1,
                    context: 'general',
                    icon: '💬',
                    strengths: [],
                    suggestions: ['Add more details for AI analysis'],
                    analysis: 'Type at least 10 characters for full AI analysis',
                    loading: false
                });
            }
        }, 1500); // Longer delay for API calls
        
    } else {
        // Hide overlay when empty
        if (analysisOverlay) {
            analysisOverlay.style.display = 'none';
        }
        lastAnalyzedText = '';
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
        console.log('🤖 Real OpenAI-powered Prompt Coach ready!');
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
