// Enhanced content script with REAL OpenAI API analysis and AI-powered prompt improvement
console.log('ChatGPT Memory Manager with Real AI Analysis and Prompt Improvement loaded!');

let analysisOverlay = null;
let analysisTimeout = null;
let currentInput = null;
let lastAnalyzedText = '';
let isAnalyzing = false;
let lastAnalysis = null; // Store the last analysis for the improve button

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

// NEW: AI-Powered Prompt Improvement
async function generateImprovedPromptWithAI(originalPrompt, analysis) {
    try {
        console.log('🚀 Generating AI-improved prompt...');
        
        const response = await fetch(`${API_URL}/improve_prompt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: originalPrompt,
                analysis: analysis
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        console.log('✅ AI-improved prompt generated:', result);
        
        return result.improved_prompt;
        
    } catch (error) {
        console.error('❌ AI prompt improvement failed:', error);
        
        // Fallback improvement
        return `Could you please help me with: ${originalPrompt}. Please provide detailed explanations and examples.`;
    }
}

// Function to paste text into ChatGPT input
function pasteIntoInput(text) {
    const input = findChatGPTInput();
    if (!input) {
        console.error('Could not find ChatGPT input field');
        return false;
    }
    
    try {
        // Clear current content
        input.innerHTML = '';
        input.textContent = '';
        
        // Insert new text
        if (input.tagName === 'TEXTAREA') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // For contenteditable divs (most common in ChatGPT)
            input.innerHTML = text.replace(/\n/g, '<br>');
            input.textContent = text;
            
            // Trigger input events to notify ChatGPT
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        // Focus the input
        input.focus();
        
        // Set cursor to end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        return true;
    } catch (error) {
        console.error('Error pasting text:', error);
        return false;
    }
}

// Real OpenAI API Analysis
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
        
        // Store analysis for improvement button
        lastAnalysis = analysis;
        
        return analysis;
        
    } catch (error) {
        console.error('❌ OpenAI analysis failed:', error);
        
        // Return fallback analysis
        const fallback = {
            score: 3.0,
            context: 'general',
            icon: '💬',
            strengths: [],
            suggestions: ['AI analysis temporarily unavailable'],
            analysis: 'Using basic analysis - OpenAI API unavailable',
            loading: false,
            error: true
        };
        
        lastAnalysis = fallback;
        return fallback;
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
        max-height: 600px;
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
function updateAnalysisOverlay(analysis, originalPrompt = '') {
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
    
    // Show improve button if score is below 7 and prompt is long enough
    const showImproveButton = analysis.score < 7 && originalPrompt.length > 10 && !analysis.error;
    
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
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 10px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 AI Suggestions:</div>
                ${analysis.suggestions.map(s => `<div style="font-size: 11px; color: #ea580c; margin-bottom: 3px; line-height: 1.4;">• ${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${showImproveButton ? `
            <button id="paste-improved-btn" style="
                width: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 10px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                margin-bottom: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            ">
                ✨ Generate AI-Improved Prompt
            </button>
        ` : ''}
        
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #e5e5e5; font-size: 10px; color: #999; text-align: center;">
            ${analysis.error ? 'Fallback analysis' : 'Analyzed by OpenAI GPT-4'}
        </div>
    `;
    
    // Add click handler for the paste button
    if (showImproveButton) {
        const pasteBtn = content.querySelector('#paste-improved-btn');
        if (pasteBtn) {
            pasteBtn.addEventListener('mouseenter', () => {
                pasteBtn.style.transform = 'translateY(-1px)';
                pasteBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            });
            
            pasteBtn.addEventListener('mouseleave', () => {
                pasteBtn.style.transform = 'translateY(0)';
                pasteBtn.style.boxShadow = 'none';
            });
            
            pasteBtn.addEventListener('click', async () => {
                // Show loading state
                pasteBtn.innerHTML = '🤖 AI is improving your prompt...';
                pasteBtn.style.background = '#ffa500';
                pasteBtn.disabled = true;
                
                try {
                    // Call AI improvement API
                    const improvedPrompt = await generateImprovedPromptWithAI(originalPrompt, lastAnalysis);
                    
                    // Paste the improved prompt
                    const success = pasteIntoInput(improvedPrompt);
                    
                    if (success) {
                        // Success feedback
                        pasteBtn.innerHTML = '✅ AI-Improved Prompt Pasted!';
                        pasteBtn.style.background = '#10a37f';
                        
                        // Hide overlay after successful paste
                        setTimeout(() => {
                            overlay.style.display = 'none';
                        }, 2000);
                    } else {
                        throw new Error('Failed to paste');
                    }
                    
                } catch (error) {
                    console.error('Error improving prompt:', error);
                    pasteBtn.innerHTML = '❌ Improvement failed - try again';
                    pasteBtn.style.background = '#ff6b6b';
                    pasteBtn.disabled = false;
                    
                    // Reset after 3 seconds
                    setTimeout(() => {
                        pasteBtn.innerHTML = '✨ Generate AI-Improved Prompt';
                        pasteBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                        pasteBtn.disabled = false;
                    }, 3000);
                }
            });
        }
    }
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
                    updateAnalysisOverlay(analysis, text); // Pass original text
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
                }, text);
            }
        }, 1500); // Longer delay for API calls
        
    } else {
        // Hide overlay when empty
        if (analysisOverlay) {
            analysisOverlay.style.display = 'none';
        }
        lastAnalyzedText = '';
        lastAnalysis = null;
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
        console.log('🤖 Real OpenAI-powered Prompt Coach with AI Improvement ready!');
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