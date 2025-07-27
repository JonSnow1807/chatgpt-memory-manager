// Enhanced content script with REAL OpenAI API analysis, AI-powered prompt improvement, minimize functionality, and Phase 2 Conversation Flow Optimization
console.log('ChatGPT Memory Manager with Real AI Analysis, Prompt Improvement, Minimize Feature, and Conversation Flow Optimization loaded!');

// Existing variables
let analysisOverlay = null;
let analysisTimeout = null;
let currentInput = null;
let lastAnalyzedText = '';
let isAnalyzing = false;
let lastAnalysis = null; // Store the last analysis for the improve button
let isMinimized = false; // Track minimize state

// Phase 2: Conversation Flow Optimization Variables
let conversationMonitor = {
    isActive: false,
    currentConversationId: null,
    lastMessageCount: 0,
    conversationHistory: [],
    qualityMetrics: {
        averageFlow: 0,
        turnCount: 0,
        issuesDetected: []
    },
    observer: null
};

let flowSuggestionOverlay = null;
let conversationAnalysisPanel = null;
let followUpSuggestionBox = null;

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

// NEW: Enhanced conversation extraction with turn tracking
function extractConversationWithTurns() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach((element, index) => {
        const role = element.getAttribute('data-message-author-role');
        const textElement = element.querySelector('.markdown') || element.querySelector('[class*="markdown"]') || element;
        
        if (textElement) {
            const content = textElement.innerText || textElement.textContent || '';
            if (content.trim()) {
                messages.push({
                    role: role,
                    content: content.trim(),
                    timestamp: new Date().toISOString(),
                    elementIndex: index
                });
            }
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

// NEW: Toggle minimize state
function toggleMinimize() {
    const overlay = analysisOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('#analysis-content');
    const minimizeBtn = overlay.querySelector('#minimize-btn');
    
    isMinimized = !isMinimized;
    
    if (isMinimized) {
        // Minimize
        content.style.display = 'none';
        overlay.style.width = '200px';
        overlay.style.height = 'auto';
        minimizeBtn.innerHTML = '📖';
        minimizeBtn.title = 'Expand AI Coach';
        
        // Add minimized indicator
        overlay.querySelector('.coach-header').style.opacity = '0.8';
        
    } else {
        // Maximize
        content.style.display = 'block';
        overlay.style.width = '380px';
        overlay.style.height = 'auto';
        minimizeBtn.innerHTML = '📄';
        minimizeBtn.title = 'Minimize AI Coach';
        
        // Remove minimized indicator
        overlay.querySelector('.coach-header').style.opacity = '1';
    }
}

// NEW Phase 2: Generate unique conversation ID
function generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// NEW Phase 2: Monitor conversation changes
function startConversationMonitoring() {
    if (conversationMonitor.isActive) return;
    
    conversationMonitor.isActive = true;
    conversationMonitor.currentConversationId = generateConversationId();
    
    console.log('🎯 Conversation Flow Monitoring activated');
    
    // Monitor for new messages
    const observer = new MutationObserver((mutations) => {
        let hasNewMessages = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                // Check if new message elements were added
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.querySelector && node.querySelector('[data-message-author-role]')) {
                            hasNewMessages = true;
                        }
                    }
                });
            }
        });
        
        if (hasNewMessages) {
            // Debounce to avoid too frequent analysis
            setTimeout(() => {
                analyzeConversationTurn();
            }, 1000);
        }
    });
    
    // Observe the main conversation container
    const conversationContainer = document.querySelector('main') || document.body;
    observer.observe(conversationContainer, {
        childList: true,
        subtree: true
    });
    
    // Store observer for cleanup
    conversationMonitor.observer = observer;
}

// NEW Phase 2: Analyze conversation turn when new message appears
async function analyzeConversationTurn() {
    const currentMessages = extractConversationWithTurns();
    
    // Check if we have new messages
    if (currentMessages.length <= conversationMonitor.lastMessageCount) {
        return;
    }
    
    // Update conversation history
    conversationMonitor.conversationHistory = currentMessages;
    conversationMonitor.lastMessageCount = currentMessages.length;
    
    // Need at least 2 messages (1 turn) to analyze
    if (currentMessages.length < 2) {
        return;
    }
    
    // Get the latest turn (user message + assistant response)
    const userMessages = currentMessages.filter(msg => msg.role === 'user');
    const assistantMessages = currentMessages.filter(msg => msg.role === 'assistant');
    
    if (userMessages.length === 0 || assistantMessages.length === 0) {
        return;
    }
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    
    // Only analyze if we have a complete turn
    if (lastAssistantMessage.timestamp > lastUserMessage.timestamp || 
        assistantMessages.length === userMessages.length) {
        
        console.log('🔄 Analyzing conversation turn...');
        
        try {
            const analysis = await analyzeConversationTurnAPI(
                lastUserMessage.content,
                lastAssistantMessage.content,
                currentMessages.slice(0, -2) // Exclude current turn from context
            );
            
            // Update quality metrics
            updateConversationQualityMetrics(analysis);
            
            // Show suggestions if needed
            if (analysis.flow_score < 7 || analysis.issue_type !== 'good') {
                showFlowSuggestions(analysis);
            }
            
            // Update conversation analysis panel
            updateConversationAnalysisPanel(analysis);
            
            // Generate follow-up suggestion if conversation seems to be going well
            if (analysis.flow_score >= 7 && userMessages.length >= 2) {
                setTimeout(generateAndShowFollowUp, 2000); // Delay to avoid overwhelming
            }
            
        } catch (error) {
            console.error('❌ Conversation analysis failed:', error);
        }
    }
}

// NEW Phase 2: API call for conversation turn analysis
async function analyzeConversationTurnAPI(userMessage, assistantMessage, conversationHistory) {
    try {
        const response = await fetch(`${API_URL}/analyze_conversation_turn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_message: userMessage,
                assistant_message: assistantMessage,
                conversation_history: conversationHistory.slice(-10), // Last 5 turns
                conversation_id: conversationMonitor.currentConversationId
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const analysis = await response.json();
        console.log('✅ Conversation turn analysis:', analysis);
        
        return analysis;
        
    } catch (error) {
        console.error('❌ Conversation turn API failed:', error);
        
        // Fallback analysis
        return {
            flow_score: 6.0,
            issue_type: 'api_error',
            suggestions: ['Continue your conversation naturally'],
            conversation_direction: 'stable',
            analysis: 'Analysis temporarily unavailable'
        };
    }
}

// NEW Phase 2: Update conversation quality metrics
function updateConversationQualityMetrics(analysis) {
    const metrics = conversationMonitor.qualityMetrics;
    
    metrics.turnCount++;
    metrics.averageFlow = ((metrics.averageFlow * (metrics.turnCount - 1)) + analysis.flow_score) / metrics.turnCount;
    
    if (analysis.issue_type && analysis.issue_type !== 'good') {
        metrics.issuesDetected.push({
            issue: analysis.issue_type,
            turn: metrics.turnCount,
            timestamp: new Date().toISOString()
        });
    }
    
    // Limit issues history to last 10
    if (metrics.issuesDetected.length > 10) {
        metrics.issuesDetected = metrics.issuesDetected.slice(-10);
    }
}

// NEW Phase 2: Show flow suggestions overlay
function showFlowSuggestions(analysis) {
    // Don't show if already visible or if analysis is good
    if (flowSuggestionOverlay && flowSuggestionOverlay.style.display === 'block') {
        return;
    }
    
    if (!flowSuggestionOverlay) {
        createFlowSuggestionOverlay();
    }
    
    const suggestionsText = analysis.suggestions.join('\n• ');
    const issueTypeEmoji = {
        'shallow_response': '🔍',
        'off_topic': '📍',
        'repetitive': '🔄',
        'vague': '🎯',
        'good': '✅'
    };
    
    const emoji = issueTypeEmoji[analysis.issue_type] || '💡';
    
    flowSuggestionOverlay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 16px;">${emoji}</span>
            <strong style="color: #2d3748; font-size: 13px;">Flow Coach</strong>
            <div style="margin-left: auto; font-size: 11px; color: #666; background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 6px;">
                Score: ${analysis.flow_score.toFixed(1)}/10
            </div>
            <button onclick="this.closest('#flow-suggestion-overlay').style.display='none'" style="
                background: none; border: none; cursor: pointer; 
                font-size: 16px; opacity: 0.7; padding: 2px;
            ">×</button>
        </div>
        
        <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
            <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 Flow Suggestions:</div>
            <div style="font-size: 11px; color: #ea580c; line-height: 1.4;">• ${suggestionsText}</div>
        </div>
        
        ${analysis.analysis ? `
            <div style="font-size: 10px; color: #666; line-height: 1.3; margin-bottom: 8px;">
                ${analysis.analysis}
            </div>
        ` : ''}
        
        <button id="generate-followup-btn" style="
            width: 100%; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white; border: none; padding: 6px 8px; border-radius: 6px;
            font-size: 11px; cursor: pointer; margin-bottom: 6px;
        ">🔗 Generate Smart Follow-up</button>
        
        <div style="font-size: 9px; color: #999; text-align: center;">
            Conversation flow analysis
        </div>
    `;
    
    // Add follow-up button functionality
    const followUpBtn = flowSuggestionOverlay.querySelector('#generate-followup-btn');
    followUpBtn.addEventListener('click', generateAndShowFollowUp);
    
    flowSuggestionOverlay.style.display = 'block';
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (flowSuggestionOverlay && flowSuggestionOverlay.style.display === 'block') {
            flowSuggestionOverlay.style.display = 'none';
        }
    }, 8000);
}

// NEW Phase 2: Create flow suggestion overlay
function createFlowSuggestionOverlay() {
    if (flowSuggestionOverlay) return;
    
    flowSuggestionOverlay = document.createElement('div');
    flowSuggestionOverlay.id = 'flow-suggestion-overlay';
    flowSuggestionOverlay.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        width: 320px;
        background: rgba(255, 255, 255, 0.97);
        backdrop-filter: blur(10px);
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 6px 20px rgba(249, 115, 22, 0.15);
        border: 1px solid rgba(249, 115, 22, 0.2);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        animation: slideInFromRight 0.3s ease;
    `;
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInFromRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideUpFromBottom {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(flowSuggestionOverlay);
}

// NEW Phase 2: Generate and show follow-up suggestions
async function generateAndShowFollowUp() {
    try {
        // Show loading state
        showTemporaryNotification('🤖 Generating smart follow-up...', 'info');
        
        const conversationHistory = conversationMonitor.conversationHistory;
        const context = detectConversationContext(conversationHistory);
        
        const response = await fetch(`${API_URL}/suggest_followup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_history: conversationHistory.slice(-8), // Last 4 turns
                context: context,
                user_goal: extractUserGoal(conversationHistory)
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        showFollowUpSuggestion(result.followup_question, result.context);
        
    } catch (error) {
        console.error('❌ Follow-up generation failed:', error);
        showTemporaryNotification('❌ Follow-up generation failed', 'error');
    }
}

// NEW Phase 2: Show follow-up suggestion box
function showFollowUpSuggestion(followUpQuestion, context) {
    // Remove existing follow-up box
    if (followUpSuggestionBox) {
        followUpSuggestionBox.remove();
    }
    
    followUpSuggestionBox = document.createElement('div');
    followUpSuggestionBox.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 350px;
        background: rgba(255, 255, 255, 0.97);
        backdrop-filter: blur(10px);
        border-radius: 10px;
        padding: 14px;
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.15);
        border: 1px solid rgba(102, 126, 234, 0.2);
        z-index: 9998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: slideUpFromBottom 0.3s ease;
    `;
    
    followUpSuggestionBox.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 14px;">🔗</span>
            <strong style="color: #2d3748; font-size: 12px;">Smart Follow-up</strong>
            <div style="margin-left: auto; font-size: 10px; color: #666; background: rgba(102, 126, 234, 0.1); padding: 2px 6px; border-radius: 6px;">
                ${context}
            </div>
            <button onclick="this.closest('div').remove()" style="
                background: none; border: none; cursor: pointer; 
                font-size: 14px; opacity: 0.7; padding: 2px;
            ">×</button>
        </div>
        
        <div style="background: rgba(102, 126, 234, 0.1); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
            <div style="font-size: 12px; color: #667eea; line-height: 1.4; font-weight: 500;">
                "${followUpQuestion}"
            </div>
        </div>
        
        <div style="display: flex; gap: 6px;">
            <button id="paste-followup-btn" style="
                flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; border: none; padding: 8px 12px; border-radius: 6px;
                font-size: 11px; cursor: pointer; font-weight: 600;
            ">✨ Use This Question</button>
            <button id="regenerate-followup-btn" style="
                background: rgba(102, 126, 234, 0.1); color: #667eea; border: none;
                padding: 8px 10px; border-radius: 6px; font-size: 11px; cursor: pointer;
            ">🔄</button>
        </div>
        
        <div style="font-size: 9px; color: #999; text-align: center; margin-top: 6px;">
            AI-generated follow-up suggestion
        </div>
    `;
    
    // Add button functionality
    const pasteBtn = followUpSuggestionBox.querySelector('#paste-followup-btn');
    const regenerateBtn = followUpSuggestionBox.querySelector('#regenerate-followup-btn');
    
    pasteBtn.addEventListener('click', () => {
        const success = pasteIntoInput(followUpQuestion);
        if (success) {
            pasteBtn.innerHTML = '✅ Pasted!';
            pasteBtn.style.background = '#10a37f';
            setTimeout(() => {
                followUpSuggestionBox.remove();
            }, 1500);
        }
    });
    
    regenerateBtn.addEventListener('click', generateAndShowFollowUp);
    
    document.body.appendChild(followUpSuggestionBox);
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
        if (followUpSuggestionBox && followUpSuggestionBox.parentElement) {
            followUpSuggestionBox.remove();
        }
    }, 15000);
}

// NEW Phase 2: Detect conversation context from history
function detectConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return 'general';
    }
    
    const allText = conversationHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase();
    
    // Context detection keywords
    const contexts = {
        programming: ['code', 'function', 'python', 'javascript', 'bug', 'error', 'api', 'database', 'algorithm'],
        writing: ['write', 'essay', 'article', 'content', 'blog', 'story', 'edit', 'grammar', 'style'],
        business: ['strategy', 'market', 'revenue', 'customer', 'business', 'analysis', 'growth', 'competition'],
        learning: ['explain', 'understand', 'learn', 'concept', 'theory', 'definition', 'example', 'teach'],
        creative: ['design', 'creative', 'art', 'brainstorm', 'idea', 'innovation', 'inspiration'],
        health: ['health', 'medical', 'fitness', 'wellness', 'nutrition', 'exercise', 'symptoms'],
        finance: ['investment', 'money', 'budget', 'financial', 'trading', 'economics', 'profit'],
        travel: ['travel', 'trip', 'vacation', 'hotel', 'flight', 'tourism', 'destination']
    };
    
    let bestContext = 'general';
    let maxMatches = 0;
    
    for (const [context, keywords] of Object.entries(contexts)) {
        const matches = keywords.filter(keyword => allText.includes(keyword)).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            bestContext = context;
        }
    }
    
    return bestContext;
}

// NEW Phase 2: Extract user goal from conversation
function extractUserGoal(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return null;
    }
    
    // Look for goal indicators in first few user messages
    const earlyUserMessages = conversationHistory
        .filter(msg => msg.role === 'user')
        .slice(0, 3)
        .map(msg => msg.content)
        .join(' ');
    
    // Simple goal extraction
    const goalIndicators = [
        'I want to', 'I need to', 'I\'m trying to', 'help me', 'how do I',
        'I\'m working on', 'I\'m building', 'I\'m learning', 'I want to understand'
    ];
    
    for (const indicator of goalIndicators) {
        const index = earlyUserMessages.toLowerCase().indexOf(indicator.toLowerCase());
        if (index !== -1) {
            // Extract the sentence containing the goal
            const sentence = earlyUserMessages.slice(index).split('.')[0];
            return sentence.length > 10 ? sentence : null;
        }
    }
    
    return null;
}

// NEW Phase 2: Create conversation analysis panel
function createConversationAnalysisPanel() {
    if (conversationAnalysisPanel) return;
    
    conversationAnalysisPanel = document.createElement('div');
    conversationAnalysisPanel.id = 'conversation-analysis-panel';
    conversationAnalysisPanel.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 20px;
        width: 280px;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 10px;
        padding: 12px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 9997;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        transition: all 0.3s ease;
    `;
    
    conversationAnalysisPanel.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 14px;">📊</span>
            <strong style="color: #2d3748; font-size: 12px;">Conversation Analysis</strong>
            <button id="toggle-analysis-panel" style="
                margin-left: auto; background: none; border: none; 
                cursor: pointer; font-size: 12px; opacity: 0.7;
            ">📈</button>
        </div>
        <div id="analysis-panel-content">
            <div style="font-size: 11px; color: #666; text-align: center; padding: 10px;">
                Start a conversation to see analysis...
            </div>
        </div>
    `;
    
    // Add toggle functionality
    const toggleBtn = conversationAnalysisPanel.querySelector('#toggle-analysis-panel');
    let isExpanded = true;
    
    toggleBtn.addEventListener('click', () => {
        const content = conversationAnalysisPanel.querySelector('#analysis-panel-content');
        isExpanded = !isExpanded;
        
        if (isExpanded) {
            content.style.display = 'block';
            conversationAnalysisPanel.style.width = '280px';
            toggleBtn.innerHTML = '📈';
        } else {
            content.style.display = 'none';
            conversationAnalysisPanel.style.width = '200px';
            toggleBtn.innerHTML = '📊';
        }
    });
    
    document.body.appendChild(conversationAnalysisPanel);
}

// NEW Phase 2: Update conversation analysis panel
function updateConversationAnalysisPanel(analysis) {
    if (!conversationAnalysisPanel) {
        createConversationAnalysisPanel();
    }
    
    const content = conversationAnalysisPanel.querySelector('#analysis-panel-content');
    const metrics = conversationMonitor.qualityMetrics;
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div style="background: rgba(102, 126, 234, 0.1); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #667eea;">${metrics.averageFlow.toFixed(1)}</div>
                <div style="font-size: 9px; color: #666;">Avg Flow</div>
            </div>
            <div style="background: rgba(16, 163, 127, 0.1); padding: 6px; border-radius: 6px; text-align: center;">
                <div style="font-size: 14px; font-weight: bold; color: #10a37f;">${metrics.turnCount}</div>
                <div style="font-size: 9px; color: #666;">Turns</div>
            </div>
        </div>
        
        <div style="margin-bottom: 8px;">
            <div style="font-size: 10px; color: #666; margin-bottom: 3px;">Latest Turn Quality:</div>
            <div style="display: flex; align-items: center; gap: 6px;">
                <div style="flex: 1; height: 4px; background: #f0f0f0; border-radius: 2px;">
                    <div style="width: ${(analysis.flow_score/10)*100}%; height: 100%; background: ${analysis.flow_score >= 7 ? '#10a37f' : analysis.flow_score >= 5 ? '#ffa500' : '#ff6b6b'}; border-radius: 2px;"></div>
                </div>
                <span style="font-size: 10px; color: #666; font-weight: 600;">${analysis.flow_score.toFixed(1)}</span>
            </div>
        </div>
        
        ${analysis.conversation_direction ? `
            <div style="background: rgba(59, 130, 246, 0.1); padding: 6px; border-radius: 6px; margin-bottom: 6px;">
                <div style="font-size: 10px; color: #3b82f6;">
                    Direction: ${analysis.conversation_direction === 'improving' ? '📈 Improving' : analysis.conversation_direction === 'declining' ? '📉 Declining' : '➡️ Stable'}
                </div>
            </div>
        ` : ''}
        
        ${metrics.issuesDetected.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 6px; border-radius: 6px;">
                <div style="font-size: 10px; color: #ea580c; font-weight: 600;">Recent Issues:</div>
                <div style="font-size: 9px; color: #ea580c;">
                    ${metrics.issuesDetected.slice(-3).map(issue => `• ${issue.issue.replace('_', ' ')}`).join('<br>')}
                </div>
            </div>
        ` : ''}
    `;
    
    conversationAnalysisPanel.style.display = 'block';
}

// NEW Phase 2: Enhanced temporary notification with types
function showTemporaryNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    
    const typeStyles = {
        info: 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
        success: 'background: linear-gradient(135deg, #10a37f 0%, #0d8f70 100%);',
        warning: 'background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);',
        error: 'background: linear-gradient(135deg, #ff6b6b 0%, #ff5252 100%);',
        flow: 'background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 140px;
        right: 20px;
        ${typeStyles[type] || typeStyles.info}
        color: white;
        padding: 10px 14px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        max-width: 280px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 12px;
        font-weight: 500;
        animation: slideInFromRight 0.3s ease;
    `;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <div>${message}</div>
            <button onclick="this.parentElement.parentElement.remove()" style="
                background: none; border: none; color: white; 
                cursor: pointer; margin-left: auto; opacity: 0.8;
                font-size: 14px; padding: 0;
            ">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

// Real OpenAI API Analysis (unchanged)
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

// Create analysis overlay UI with minimize button (unchanged)
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
        <div class="coach-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; transition: opacity 0.3s;">
            <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%;"></div>
            <strong style="color: #2d3748; font-size: 14px;">🤖 AI Prompt Coach</strong>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                <div style="font-size: 10px; color: #666; background: rgba(16, 163, 127, 0.1); padding: 2px 6px; border-radius: 8px;">
                    Powered by OpenAI
                </div>
                <button id="minimize-btn" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background 0.2s;
                    opacity: 0.7;
                " title="Minimize AI Coach">📄</button>
            </div>
        </div>
        <div id="analysis-content">
            <div style="color: #666; font-size: 13px;">Start typing to get real AI analysis...</div>
        </div>
    `;
    
    // Add minimize button functionality
    const minimizeBtn = overlay.querySelector('#minimize-btn');
    minimizeBtn.addEventListener('click', toggleMinimize);
    
    // Add hover effect for minimize button
    minimizeBtn.addEventListener('mouseenter', () => {
        minimizeBtn.style.background = 'rgba(0, 0, 0, 0.1)';
        minimizeBtn.style.opacity = '1';
    });
    
    minimizeBtn.addEventListener('mouseleave', () => {
        minimizeBtn.style.background = 'none';
        minimizeBtn.style.opacity = '0.7';
    });
    
    document.body.appendChild(overlay);
    analysisOverlay = overlay;
    return overlay;
}

// Update analysis overlay with real AI results (unchanged from your current version)
function updateAnalysisOverlay(analysis, originalPrompt = '') {
    const overlay = analysisOverlay;
    if (!overlay) return;
    
    const content = overlay.querySelector('#analysis-content');
    
    // Don't update content if minimized (but allow initial loading state)
    if (isMinimized && !analysis.loading) {
        return;
    }
    
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
                            isMinimized = false; // Reset minimize state
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

// Handle input changes with AI analysis (unchanged)
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
            isMinimized = false; // Reset minimize state when hiding
        }
        lastAnalyzedText = '';
        lastAnalysis = null;
    }
}

// Set up monitoring (unchanged)
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
        console.log('🤖 Real OpenAI-powered Prompt Coach with AI Improvement and Minimize Feature ready!');
    }
}

// NEW Phase 2: Initialize Phase 2 features
function initializePhase2Features() {
    console.log('🚀 Initializing Phase 2: Conversation Flow Optimization');
    
    // Start conversation monitoring
    startConversationMonitoring();
    
    // Create analysis panel
    createConversationAnalysisPanel();
    
    // Add keyboard shortcut for toggling analysis (Ctrl+Shift+F)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            const panel = conversationAnalysisPanel;
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        }
    });
    
    console.log('✅ Phase 2 features initialized - Conversation Flow Optimization active!');
}

// Enhanced initialization with Phase 2
function initializeEnhanced() {
    // Existing initialization
    setupInputMonitoring();
    setInterval(setupInputMonitoring, 3000);
    
    // Phase 2 initialization
    setTimeout(() => {
        initializePhase2Features();
    }, 3000); // Start after existing features are ready
    
    console.log('🤖 Real OpenAI-powered Prompt Coach with AI Improvement, Minimize Feature, and Conversation Flow Optimization ready!');
}

// Initialize everything
setTimeout(initializeEnhanced, 2000);

// Listen for messages from popup (unchanged)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'capture') {
        const conversation = extractConversation();
        sendResponse({ conversation: conversation });
    }
});