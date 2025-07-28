// Enhanced content script with Unified Coach Panel - Subtle UX with non-conflicting shortcuts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
console.log(`ChatGPT Memory Manager - AI Coach ready! Press ${isMac ? '⌘J' : 'Ctrl+J'} to toggle.`);

// Existing variables
let unifiedCoachPanel = null;
let analysisTimeout = null;
let currentInput = null;
let lastAnalyzedText = '';
let isAnalyzing = false;
let lastAnalysis = null;
let isPanelMinimized = false;
let activeTab = 'prompt'; // Current active tab

// Phase 2: Conversation Flow Optimization Variables (unchanged)
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

// Store latest analysis data for tabs
let latestFlowAnalysis = null;
let latestFollowUpSuggestion = null;

const API_URL = 'https://chatgpt-memory-manager-production.up.railway.app';

// ===== UNIFIED COACH PANEL =====
function createUnifiedCoachPanel() {
    if (unifiedCoachPanel) return;
    
    unifiedCoachPanel = document.createElement('div');
    unifiedCoachPanel.id = 'unified-coach-panel';
    unifiedCoachPanel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 400px;
        background: rgba(255, 255, 255, 0.97);
        backdrop-filter: blur(10px);
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.2);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        display: none;
        transition: all 0.3s ease;
        overflow: hidden;
    `;
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutText = isMac ? '⌘J' : 'Ctrl+J';
    
    unifiedCoachPanel.innerHTML = `
        <!-- Header -->
        <div class="coach-header" style="
            display: flex;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            background: rgba(255, 255, 255, 0.8);
        ">
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 8px; height: 8px; background: #10a37f; border-radius: 50%; animation: pulse 2s infinite;"></div>
                <strong style="color: #2d3748; font-size: 14px;">🤖 AI Coach</strong>
            </div>
            <div style="margin-left: auto; display: flex; align-items: center; gap: 8px;">
                <button id="coach-minimize-btn" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 4px;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                " title="Minimize">−</button>
                <button id="coach-close-btn" style="
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 4px;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                " title="Close">×</button>
            </div>
        </div>
        
        <!-- Tab Navigation -->
        <div class="coach-tabs" style="
            display: flex;
            background: rgba(249, 250, 251, 0.8);
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            padding: 0 12px;
        ">
            <button class="coach-tab active" data-tab="prompt" style="
                flex: 1;
                background: none;
                border: none;
                padding: 10px 8px;
                cursor: pointer;
                font-size: 12px;
                color: #667eea;
                border-bottom: 2px solid #667eea;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            ">
                <span>📝</span>
                <span>Prompt</span>
            </button>
            <button class="coach-tab" data-tab="flow" style="
                flex: 1;
                background: none;
                border: none;
                padding: 10px 8px;
                cursor: pointer;
                font-size: 12px;
                color: #666;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            ">
                <span>🔄</span>
                <span>Flow</span>
                <span class="tab-badge" id="flow-badge" style="
                    display: none;
                    background: #ff6b6b;
                    color: white;
                    font-size: 9px;
                    padding: 1px 4px;
                    border-radius: 8px;
                    margin-left: 4px;
                ">!</span>
            </button>
            <button class="coach-tab" data-tab="followup" style="
                flex: 1;
                background: none;
                border: none;
                padding: 10px 8px;
                cursor: pointer;
                font-size: 12px;
                color: #666;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            ">
                <span>💡</span>
                <span>Follow-up</span>
            </button>
            <button class="coach-tab" data-tab="analytics" style="
                flex: 1;
                background: none;
                border: none;
                padding: 10px 8px;
                cursor: pointer;
                font-size: 12px;
                color: #666;
                border-bottom: 2px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
            ">
                <span>📊</span>
                <span>Analytics</span>
            </button>
        </div>
        
        <!-- Tab Content -->
        <div class="coach-content" style="padding: 16px; max-height: 500px; overflow-y: auto;">
            <!-- Prompt Tab -->
            <div id="prompt-tab-content" class="tab-content" style="display: block;">
                <div id="prompt-analysis-content">
                    <div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">
                        Start typing to get real-time AI analysis...
                    </div>
                </div>
            </div>
            
            <!-- Flow Tab -->
            <div id="flow-tab-content" class="tab-content" style="display: none;">
                <div id="flow-analysis-content">
                    <div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">
                        Flow analysis will appear after your first conversation turn...
                    </div>
                </div>
            </div>
            
            <!-- Follow-up Tab -->
            <div id="followup-tab-content" class="tab-content" style="display: none;">
                <div id="followup-content">
                    <div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">
                        Smart follow-up suggestions will appear as you converse...
                    </div>
                    <button id="generate-followup-now" style="
                        width: 100%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 8px;
                        font-size: 12px;
                        cursor: pointer;
                        margin-top: 12px;
                    ">🔮 Generate Follow-up Now</button>
                </div>
            </div>
            
            <!-- Analytics Tab -->
            <div id="analytics-tab-content" class="tab-content" style="display: none;">
                <div id="analytics-content">
                    <div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">
                        Conversation analytics will appear as you chat...
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Footer with settings -->
        <div class="coach-footer" style="
            padding: 8px 16px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
            background: rgba(249, 250, 251, 0.8);
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            color: #666;
        ">
            <span>${shortcutText} to toggle • Powered by OpenAI</span>
            <button id="coach-settings-btn" style="
                background: none;
                border: none;
                cursor: pointer;
                opacity: 0.6;
                font-size: 14px;
                padding: 2px;
            " title="Settings">⚙️</button>
        </div>
    `;
    
    // Add panel styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        @keyframes slideInFromRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .coach-tab:hover {
            background: rgba(102, 126, 234, 0.05);
        }
        
        .coach-tab.active {
            color: #667eea !important;
            border-bottom-color: #667eea !important;
        }
        
        #coach-minimize-btn:hover,
        #coach-close-btn:hover,
        #coach-settings-btn:hover {
            opacity: 1 !important;
        }
        
        .tab-content {
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        /* Minimized state */
        #unified-coach-panel.minimized {
            width: 120px;
            height: 40px;
        }
        
        #unified-coach-panel.minimized .coach-tabs,
        #unified-coach-panel.minimized .coach-content,
        #unified-coach-panel.minimized .coach-footer {
            display: none;
        }
        
        #unified-coach-panel.minimized .coach-header {
            border-bottom: none;
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(unifiedCoachPanel);
    
    // Setup event handlers
    setupUnifiedPanelHandlers();
}

function setupUnifiedPanelHandlers() {
    // Tab switching
    const tabs = unifiedCoachPanel.querySelectorAll('.coach-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Minimize/Close buttons
    const minimizeBtn = unifiedCoachPanel.querySelector('#coach-minimize-btn');
    const closeBtn = unifiedCoachPanel.querySelector('#coach-close-btn');
    
    minimizeBtn.addEventListener('click', togglePanelMinimize);
    closeBtn.addEventListener('click', () => {
        unifiedCoachPanel.style.display = 'none';
        unifiedCoachPanel.setAttribute('data-manually-hidden', 'true');
        // Show floating button as alternative access
        showFloatingCoachButton();
    });
    
    // Generate follow-up button
    const generateFollowupBtn = unifiedCoachPanel.querySelector('#generate-followup-now');
    generateFollowupBtn.addEventListener('click', generateAndShowFollowUp);
    
    // Settings button (placeholder for now)
    const settingsBtn = unifiedCoachPanel.querySelector('#coach-settings-btn');
    settingsBtn.addEventListener('click', () => {
        showTemporaryNotification('⚙️ Settings coming soon!', 'info');
    });
}

function switchTab(tabName) {
    activeTab = tabName;
    
    // Update tab buttons
    const tabs = unifiedCoachPanel.querySelectorAll('.coach-tab');
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update content
    const contents = unifiedCoachPanel.querySelectorAll('.tab-content');
    contents.forEach(content => {
        content.style.display = 'none';
    });
    
    const activeContent = unifiedCoachPanel.querySelector(`#${tabName}-tab-content`);
    if (activeContent) {
        activeContent.style.display = 'block';
    }
    
    // Clear badge when viewing flow tab
    if (tabName === 'flow') {
        const flowBadge = unifiedCoachPanel.querySelector('#flow-badge');
        flowBadge.style.display = 'none';
    }
}

function togglePanelMinimize() {
    isPanelMinimized = !isPanelMinimized;
    
    if (isPanelMinimized) {
        unifiedCoachPanel.classList.add('minimized');
        unifiedCoachPanel.querySelector('#coach-minimize-btn').innerHTML = '□';
        unifiedCoachPanel.querySelector('#coach-minimize-btn').title = 'Restore';
    } else {
        unifiedCoachPanel.classList.remove('minimized');
        unifiedCoachPanel.querySelector('#coach-minimize-btn').innerHTML = '−';
        unifiedCoachPanel.querySelector('#coach-minimize-btn').title = 'Minimize';
    }
}

function showFloatingCoachButton() {
    let floatingBtn = document.getElementById('floating-coach-btn');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcutText = isMac ? '⌘J' : 'Ctrl+J';
    
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'floating-coach-btn';
        floatingBtn.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 48px;
            height: 48px;
            border-radius: 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25);
            cursor: pointer;
            z-index: 9999;
            font-size: 18px;
            transition: all 0.2s ease;
            opacity: 0;
            animation: fadeInButton 0.5s ease forwards;
        `;
        
        // Add the fade-in animation
        if (!document.querySelector('#floating-btn-animation')) {
            const animStyle = document.createElement('style');
            animStyle.id = 'floating-btn-animation';
            animStyle.textContent = `
                @keyframes fadeInButton {
                    from { 
                        opacity: 0;
                        transform: scale(0.8);
                    }
                    to { 
                        opacity: 0.9;
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(animStyle);
        }
        floatingBtn.innerHTML = '🤖';
        floatingBtn.title = `Open AI Coach (${shortcutText})`;
        
        floatingBtn.addEventListener('click', () => {
            if (!unifiedCoachPanel) {
                createUnifiedCoachPanel();
            }
            unifiedCoachPanel.style.display = 'block';
            unifiedCoachPanel.setAttribute('data-manually-hidden', 'false');
            floatingBtn.style.display = 'none';
        });
        
        floatingBtn.addEventListener('animationend', () => {
            floatingBtn.style.opacity = '0.9';
        });
        
        floatingBtn.addEventListener('mouseenter', () => {
            floatingBtn.style.transform = 'scale(1.08)';
            floatingBtn.style.opacity = '1';
            floatingBtn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.35)';
        });
        
        floatingBtn.addEventListener('mouseleave', () => {
            floatingBtn.style.transform = 'scale(1)';
            floatingBtn.style.opacity = '0.9';
            floatingBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.25)';
        });
        
        document.body.appendChild(floatingBtn);
    } else {
        floatingBtn.style.display = 'block';
    }
}

// ===== UPDATE FUNCTIONS FOR UNIFIED PANEL =====

function updatePromptTabContent(analysis, originalPrompt = '') {
    const content = unifiedCoachPanel.querySelector('#prompt-analysis-content');
    
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
                ${analysis.strengths.map(s => `<div style="font-size: 11px; color: #059669; margin-bottom: 3px;">• ${s}</div>`).join('')}
            </div>
        ` : ''}
        
        ${analysis.suggestions && analysis.suggestions.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 10px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 AI Suggestions:</div>
                ${analysis.suggestions.map(s => `<div style="font-size: 11px; color: #ea580c; margin-bottom: 3px;">• ${s}</div>`).join('')}
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
            ">✨ Generate AI-Improved Prompt</button>
        ` : ''}
    `;
    
    // Add improve button handler
    if (showImproveButton) {
        const improveBtn = content.querySelector('#paste-improved-btn');
        improveBtn.addEventListener('click', async () => {
            improveBtn.innerHTML = '🤖 AI is improving your prompt...';
            improveBtn.disabled = true;
            
            try {
                const improvedPrompt = await generateImprovedPromptWithAI(originalPrompt, lastAnalysis);
                const success = pasteIntoInput(improvedPrompt);
                
                if (success) {
                    improveBtn.innerHTML = '✅ AI-Improved Prompt Pasted!';
                    improveBtn.style.background = '#10a37f';
                    
                    setTimeout(() => {
                        togglePanelMinimize(); // Minimize instead of hiding
                    }, 2000);
                }
            } catch (error) {
                improveBtn.innerHTML = '❌ Improvement failed - try again';
                improveBtn.style.background = '#ff6b6b';
                improveBtn.disabled = false;
            }
        });
    }
}

function updateFlowTabContent(analysis) {
    const content = unifiedCoachPanel.querySelector('#flow-analysis-content');
    latestFlowAnalysis = analysis;
    
    const issueTypeEmoji = {
        'shallow_response': '🔍',
        'off_topic': '📍',
        'repetitive': '🔄',
        'vague': '🎯',
        'good': '✅'
    };
    
    const emoji = issueTypeEmoji[analysis.issue_type] || '💡';
    const suggestionsText = analysis.suggestions.join('\n• ');
    
    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 16px;">${emoji}</span>
            <strong style="color: #2d3748; font-size: 13px;">Conversation Flow Analysis</strong>
            <div style="margin-left: auto; font-size: 11px; color: #666; background: rgba(249, 115, 22, 0.1); padding: 2px 6px; border-radius: 6px;">
                Score: ${analysis.flow_score.toFixed(1)}/10
            </div>
        </div>
        
        ${analysis.suggestions.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
                <div style="font-size: 11px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">💡 Flow Suggestions:</div>
                <div style="font-size: 11px; color: #ea580c; line-height: 1.4;">• ${suggestionsText}</div>
            </div>
        ` : ''}
        
        ${analysis.analysis ? `
            <div style="font-size: 10px; color: #666; line-height: 1.3; margin-bottom: 8px;">
                ${analysis.analysis}
            </div>
        ` : ''}
        
        <div style="background: rgba(59, 130, 246, 0.1); padding: 6px; border-radius: 6px;">
            <div style="font-size: 10px; color: #3b82f6;">
                Direction: ${analysis.conversation_direction === 'improving' ? '📈 Improving' : analysis.conversation_direction === 'declining' ? '📉 Declining' : '➡️ Stable'}
            </div>
        </div>
    `;
    
    // Show notification badge on Flow tab if issues detected
    if (analysis.issue_type !== 'good' && activeTab !== 'flow') {
        const flowBadge = unifiedCoachPanel.querySelector('#flow-badge');
        flowBadge.style.display = 'block';
    }
}

function updateFollowUpTabContent(followUpQuestion, context) {
    const content = unifiedCoachPanel.querySelector('#followup-content');
    latestFollowUpSuggestion = { question: followUpQuestion, context: context };
    
    content.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 14px;">🔗</span>
            <strong style="color: #2d3748; font-size: 12px;">Smart Follow-up</strong>
            <div style="margin-left: auto; font-size: 10px; color: #666; background: rgba(102, 126, 234, 0.1); padding: 2px 6px; border-radius: 6px;">
                ${context}
            </div>
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
        
        <button id="generate-another-followup" style="
            width: 100%;
            background: rgba(102, 126, 234, 0.1);
            color: #667eea;
            border: none;
            padding: 8px;
            border-radius: 6px;
            font-size: 11px;
            cursor: pointer;
            margin-top: 8px;
        ">Generate Another Follow-up</button>
    `;
    
    // Add button handlers
    const pasteBtn = content.querySelector('#paste-followup-btn');
    const regenerateBtn = content.querySelector('#regenerate-followup-btn');
    const generateAnotherBtn = content.querySelector('#generate-another-followup');
    
    pasteBtn.addEventListener('click', () => {
        const success = pasteIntoInput(followUpQuestion);
        if (success) {
            pasteBtn.innerHTML = '✅ Pasted!';
            pasteBtn.style.background = '#10a37f';
        }
    });
    
    regenerateBtn.addEventListener('click', generateAndShowFollowUp);
    generateAnotherBtn.addEventListener('click', generateAndShowFollowUp);
}

function updateAnalyticsTabContent() {
    const content = unifiedCoachPanel.querySelector('#analytics-content');
    const metrics = conversationMonitor.qualityMetrics;
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="background: rgba(102, 126, 234, 0.1); padding: 8px; border-radius: 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #667eea;">${metrics.averageFlow.toFixed(1)}</div>
                <div style="font-size: 10px; color: #666;">Avg Flow Score</div>
            </div>
            <div style="background: rgba(16, 163, 127, 0.1); padding: 8px; border-radius: 6px; text-align: center;">
                <div style="font-size: 18px; font-weight: bold; color: #10a37f;">${metrics.turnCount}</div>
                <div style="font-size: 10px; color: #666;">Turns</div>
            </div>
        </div>
        
        ${latestFlowAnalysis ? `
            <div style="margin-bottom: 8px;">
                <div style="font-size: 10px; color: #666; margin-bottom: 3px;">Latest Turn Quality:</div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <div style="flex: 1; height: 4px; background: #f0f0f0; border-radius: 2px;">
                        <div style="width: ${(latestFlowAnalysis.flow_score/10)*100}%; height: 100%; background: ${latestFlowAnalysis.flow_score >= 7 ? '#10a37f' : latestFlowAnalysis.flow_score >= 5 ? '#ffa500' : '#ff6b6b'}; border-radius: 2px;"></div>
                    </div>
                    <span style="font-size: 10px; color: #666; font-weight: 600;">${latestFlowAnalysis.flow_score.toFixed(1)}</span>
                </div>
            </div>
        ` : ''}
        
        ${metrics.issuesDetected.length > 0 ? `
            <div style="background: rgba(249, 115, 22, 0.1); padding: 8px; border-radius: 6px; margin-top: 8px;">
                <div style="font-size: 10px; color: #ea580c; font-weight: 600; margin-bottom: 4px;">Recent Issues:</div>
                <div style="font-size: 9px; color: #ea580c;">
                    ${metrics.issuesDetected.slice(-3).map(issue => `• Turn ${issue.turn}: ${issue.issue.replace('_', ' ')}`).join('<br>')}
                </div>
            </div>
        ` : ''}
        
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e5e5;">
            <div style="font-size: 10px; color: #666; text-align: center;">
                Conversation ID: ${conversationMonitor.currentConversationId?.slice(0, 8)}...
            </div>
        </div>
    `;
}

// ===== EXISTING FUNCTIONS (Keep all unchanged) =====

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

// Enhanced conversation extraction with turn tracking
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

// AI-Powered Prompt Improvement
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
        input.innerHTML = '';
        input.textContent = '';
        
        if (input.tagName === 'TEXTAREA') {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            input.innerHTML = text.replace(/\n/g, '<br>');
            input.textContent = text;
            
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
        
        input.focus();
        
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

// Generate unique conversation ID
function generateConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Monitor conversation changes
function startConversationMonitoring() {
    if (conversationMonitor.isActive) return;
    
    conversationMonitor.isActive = true;
    conversationMonitor.currentConversationId = generateConversationId();
    
    console.log('🎯 Conversation Flow Monitoring activated');
    
    const observer = new MutationObserver((mutations) => {
        let hasNewMessages = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
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
            setTimeout(() => {
                analyzeConversationTurn();
            }, 1000);
        }
    });
    
    const conversationContainer = document.querySelector('main') || document.body;
    observer.observe(conversationContainer, {
        childList: true,
        subtree: true
    });
    
    conversationMonitor.observer = observer;
}

// Analyze conversation turn when new message appears
async function analyzeConversationTurn() {
    const currentMessages = extractConversationWithTurns();
    
    if (currentMessages.length <= conversationMonitor.lastMessageCount) {
        return;
    }
    
    conversationMonitor.conversationHistory = currentMessages;
    conversationMonitor.lastMessageCount = currentMessages.length;
    
    if (currentMessages.length < 2) {
        return;
    }
    
    const userMessages = currentMessages.filter(msg => msg.role === 'user');
    const assistantMessages = currentMessages.filter(msg => msg.role === 'assistant');
    
    if (userMessages.length === 0 || assistantMessages.length === 0) {
        return;
    }
    
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
    
    if (lastAssistantMessage.timestamp > lastUserMessage.timestamp || 
        assistantMessages.length === userMessages.length) {
        
        console.log('🔄 Analyzing conversation turn...');
        
        try {
            const analysis = await analyzeConversationTurnAPI(
                lastUserMessage.content,
                lastAssistantMessage.content,
                currentMessages.slice(0, -2)
            );
            
            updateConversationQualityMetrics(analysis);
            
            // Update Flow tab with analysis
            updateFlowTabContent(analysis);
            
            // Update Analytics tab
            updateAnalyticsTabContent();
            
            // Generate follow-up if conversation is going well
            if (analysis.flow_score >= 7 && userMessages.length >= 2) {
                setTimeout(generateAndShowFollowUp, 2000);
            }
            
        } catch (error) {
            console.error('❌ Conversation analysis failed:', error);
        }
    }
}

// API call for conversation turn analysis
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
                conversation_history: conversationHistory.slice(-10),
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
        
        return {
            flow_score: 6.0,
            issue_type: 'api_error',
            suggestions: ['Continue your conversation naturally'],
            conversation_direction: 'stable',
            analysis: 'Analysis temporarily unavailable'
        };
    }
}

// Update conversation quality metrics
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
    
    if (metrics.issuesDetected.length > 10) {
        metrics.issuesDetected = metrics.issuesDetected.slice(-10);
    }
}

// Generate and show follow-up suggestions
async function generateAndShowFollowUp() {
    try {
        // Switch to follow-up tab
        switchTab('followup');
        
        // Show loading in follow-up tab
        const content = unifiedCoachPanel.querySelector('#followup-content');
        content.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 20px; margin-bottom: 8px;">🤖</div>
                <div style="color: #666; font-size: 12px;">Generating smart follow-up...</div>
            </div>
        `;
        
        const conversationHistory = conversationMonitor.conversationHistory;
        const context = detectConversationContext(conversationHistory);
        
        const response = await fetch(`${API_URL}/suggest_followup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                conversation_history: conversationHistory.slice(-8),
                context: context,
                user_goal: extractUserGoal(conversationHistory)
            })
        });
        
        if (!response.ok) {
            throw new Error(`API returned ${response.status}`);
        }
        
        const result = await response.json();
        updateFollowUpTabContent(result.followup_question, result.context);
        
    } catch (error) {
        console.error('❌ Follow-up generation failed:', error);
        showTemporaryNotification('❌ Follow-up generation failed', 'error');
    }
}

// Detect conversation context from history
function detectConversationContext(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return 'general';
    }
    
    const allText = conversationHistory
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join(' ')
        .toLowerCase();
    
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

// Extract user goal from conversation
function extractUserGoal(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return null;
    }
    
    const earlyUserMessages = conversationHistory
        .filter(msg => msg.role === 'user')
        .slice(0, 3)
        .map(msg => msg.content)
        .join(' ');
    
    const goalIndicators = [
        'I want to', 'I need to', 'I\'m trying to', 'help me', 'how do I',
        'I\'m working on', 'I\'m building', 'I\'m learning', 'I want to understand'
    ];
    
    for (const indicator of goalIndicators) {
        const index = earlyUserMessages.toLowerCase().indexOf(indicator.toLowerCase());
        if (index !== -1) {
            const sentence = earlyUserMessages.slice(index).split('.')[0];
            return sentence.length > 10 ? sentence : null;
        }
    }
    
    return null;
}

// Enhanced temporary notification with types
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
        top: 80px;
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
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, duration);
}

// Real OpenAI API Analysis
async function analyzePromptWithOpenAI(promptText) {
    try {
        console.log('🤖 Analyzing prompt with OpenAI API...');
        isAnalyzing = true;
        
        updatePromptTabContent({
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
        
        lastAnalysis = analysis;
        
        return analysis;
        
    } catch (error) {
        console.error('❌ OpenAI analysis failed:', error);
        
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

// Handle input changes with AI analysis
function handleInputChange() {
    const text = getInputText(currentInput);
    
    if (analysisTimeout) {
        clearTimeout(analysisTimeout);
    }
    
    if (text.length > 0) {
        // Show panel if hidden (but don't force it open if user closed it)
        if (!unifiedCoachPanel) {
            createUnifiedCoachPanel();
        }
        
        // Only auto-show if it's not manually hidden
        if (unifiedCoachPanel.getAttribute('data-manually-hidden') !== 'true') {
            unifiedCoachPanel.style.display = 'block';
            // Hide floating button when panel auto-shows
            const floatingBtn = document.getElementById('floating-coach-btn');
            if (floatingBtn) floatingBtn.style.display = 'none';
        }
        
        if (text === lastAnalyzedText || isAnalyzing) {
            return;
        }
        
        analysisTimeout = setTimeout(async () => {
            if (text.length >= 10 && text !== lastAnalyzedText) {
                lastAnalyzedText = text;
                
                try {
                    const analysis = await analyzePromptWithOpenAI(text);
                    updatePromptTabContent(analysis, text);
                } catch (error) {
                    console.error('Analysis error:', error);
                }
            } else if (text.length < 10) {
                updatePromptTabContent({
                    score: 1,
                    context: 'general',
                    icon: '💬',
                    strengths: [],
                    suggestions: ['Add more details for AI analysis'],
                    analysis: 'Type at least 10 characters for full AI analysis',
                    loading: false
                }, text);
            }
        }, 1500);
        
    } else {
        // Don't auto-hide panel when text is empty - let user control it
        lastAnalyzedText = '';
        lastAnalysis = null;
        
        // Update prompt tab to show waiting state
        if (unifiedCoachPanel && unifiedCoachPanel.style.display !== 'none') {
            const content = unifiedCoachPanel.querySelector('#prompt-analysis-content');
            if (content) {
                content.innerHTML = `
                    <div style="color: #666; font-size: 13px; text-align: center; padding: 20px;">
                        Start typing to get real-time AI analysis...
                    </div>
                `;
            }
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
        
        createUnifiedCoachPanel();
        console.log('🤖 Unified AI Coach ready!');
        
        // Show a one-time tip about keyboard shortcut
        try {
            const hasShownTip = localStorage.getItem('ai-coach-tip-shown-v2');
            if (!hasShownTip) {
                const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
                showTemporaryNotification(`💡 Tip: Press ${isMac ? '⌘J' : 'Ctrl+J'} anytime to toggle AI Coach`, 'info', 6000);
                localStorage.setItem('ai-coach-tip-shown-v2', 'true');
            }
        } catch (e) {
            // localStorage might not be available in some contexts
        }
    }
}

// Initialize Phase 2 features
function initializePhase2Features() {
    console.log('🚀 Initializing Phase 2: Conversation Flow Optimization');
    
    startConversationMonitoring();
    
    // Keyboard shortcut (Cmd+J on Mac, Ctrl+J on Windows)
    document.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const modifier = isMac ? e.metaKey : e.ctrlKey;
        
        if (modifier && e.key === 'j') {
            e.preventDefault();
            if (unifiedCoachPanel) {
                if (unifiedCoachPanel.style.display === 'none') {
                    unifiedCoachPanel.style.display = 'block';
                    unifiedCoachPanel.setAttribute('data-manually-hidden', 'false');
                    // Hide floating button if it exists
                    const floatingBtn = document.getElementById('floating-coach-btn');
                    if (floatingBtn) floatingBtn.style.display = 'none';
                } else {
                    unifiedCoachPanel.style.display = 'none';
                    unifiedCoachPanel.setAttribute('data-manually-hidden', 'true');
                    showFloatingCoachButton();
                }
            } else {
                createUnifiedCoachPanel();
                unifiedCoachPanel.style.display = 'block';
                unifiedCoachPanel.setAttribute('data-manually-hidden', 'false');
            }
        }
    });
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    console.log('✅ Phase 2 features initialized!');
    console.log(`💡 Use ${isMac ? '⌘J' : 'Ctrl+J'} to toggle AI Coach panel`);
}

// Enhanced initialization
function initializeEnhanced() {
    setupInputMonitoring();
    setInterval(setupInputMonitoring, 3000);
    
    // Show floating button after a delay (more subtle)
    setTimeout(() => {
        showFloatingCoachButton();
    }, 2000);
    
    setTimeout(() => {
        initializePhase2Features();
    }, 3000);
    
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    console.log('🤖 Unified AI Coach with all features ready!');
    console.log(`💡 Press ${isMac ? '⌘J' : 'Ctrl+J'} to toggle AI Coach`);
}

// Initialize everything
setTimeout(initializeEnhanced, 2000);

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'capture') {
        const conversation = extractConversation();
        sendResponse({ conversation: conversation });
    }
});