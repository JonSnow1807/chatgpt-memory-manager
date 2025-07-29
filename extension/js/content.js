// Enhanced content script with Unified Coach Panel - Subtle UX with non-conflicting shortcuts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
console.log(`ChatGPT Spark - AI Assistant ready! Press ${isMac ? '⌘J' : 'Ctrl+J'} to toggle.`);

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

// Memory tab variables
let selectedMemoryIds = new Set();
let knowledgeGraphData = null;
let contextUsageInterval = null;

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
                <strong style="color: #2d3748; font-size: 14px;">⚡ ChatGPT Spark</strong>
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
            <button class="coach-tab" data-tab="memory" style="
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
                <span>🧠</span>
                <span>Memory</span>
                <span class="context-warning" id="context-warning" style="
                    display: none;
                    background: #ff6b6b;
                    color: white;
                    font-size: 9px;
                    padding: 1px 4px;
                    border-radius: 8px;
                    margin-left: 4px;
                ">!</span>
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
            
            <!-- Memory Tab -->
            <div id="memory-tab-content" class="tab-content" style="display: none;">
                <div id="memory-content">
                    <div id="context-usage-bar" style="
                        background: #f0f0f0;
                        height: 20px;
                        border-radius: 10px;
                        overflow: hidden;
                        margin-bottom: 12px;
                        position: relative;
                    ">
                        <div id="context-usage-fill" style="
                            height: 100%;
                            background: linear-gradient(90deg, #10a37f 0%, #ffa500 70%, #ff6b6b 85%);
                            width: 0%;
                            transition: width 0.3s ease;
                        "></div>
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            text-align: center;
                            font-size: 11px;
                            line-height: 20px;
                            color: #333;
                            font-weight: 600;
                        " id="context-usage-text">0% Context Used</div>
                    </div>
                    
                    <div id="memory-search-section" style="margin-bottom: 12px;">
                        <input type="text" id="memory-search-input" placeholder="Search your memories..." style="
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #e0e0e0;
                            border-radius: 6px;
                            font-size: 12px;
                        ">
                    </div>
                    
                    <div id="knowledge-graph-container" style="
                        height: 200px;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        margin-bottom: 12px;
                        background: #fafafa;
                        position: relative;
                    ">
                        <div style="text-align: center; padding: 80px 20px; color: #999; font-size: 12px;">
                            Loading knowledge graph...
                        </div>
                    </div>
                    
                    <div id="selected-memories" style="margin-bottom: 12px;">
                        <div style="font-size: 11px; color: #666; margin-bottom: 6px;">
                            <strong>Selected Memories:</strong>
                        </div>
                        <div id="selected-memories-list" style="max-height: 150px; overflow-y: auto;"></div>
                    </div>
                    
                    <button id="generate-context-bridge" style="
                        width: 100%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        border: none;
                        padding: 10px;
                        border-radius: 8px;
                        font-size: 12px;
                        cursor: pointer;
                        margin-bottom: 8px;
                        font-weight: 600;
                    ">🌉 Generate Context Bridge</button>
                    
                    <div id="context-bridge-result" style="display: none;"></div>
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
    
    // Memory tab specific handlers
    const memorySearchInput = document.getElementById('memory-search-input');
    if (memorySearchInput) {
        memorySearchInput.addEventListener('input', debounce(searchMemories, 500));
    }
    
    const generateBridgeBtn = document.getElementById('generate-context-bridge');
    if (generateBridgeBtn) {
        generateBridgeBtn.addEventListener('click', generateContextBridge);
    }
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
    
    // Load memory data when switching to memory tab
    if (tabName === 'memory') {
        loadKnowledgeGraph();
        startContextMonitoring();
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
    
    console.log(`Found ${messageElements.length} message elements`);
    
    messageElements.forEach((element, index) => {
        const role = element.getAttribute('data-message-author-role');
        
        // Try multiple selectors to find the text content
        let textElement = element.querySelector('.markdown');
        if (!textElement) {
            textElement = element.querySelector('.prose');
        }
        if (!textElement) {
            textElement = element.querySelector('[class*="prose"]');
        }
        if (!textElement) {
            // Last resort - get all text from the element
            const textNodes = element.querySelectorAll('.text-base');
            if (textNodes.length > 0) {
                textElement = textNodes[0];
            }
        }
        
        let content = '';
        if (textElement) {
            content = textElement.innerText || textElement.textContent || '';
        } else {
            // Fallback - get text directly from element
            content = element.innerText || element.textContent || '';
        }
        
        if (role && content.trim()) {
            messages.push({
                role: role,
                content: content.trim(),
                timestamp: new Date().toISOString()
            });
            console.log(`Message ${index}: ${role} - ${content.substring(0, 50)}...`);
        }
    });
    
    console.log(`Extracted ${messages.length} messages total`);
    return messages;
}

// Enhanced conversation extraction with turn tracking
function extractConversationWithTurns() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach((element, index) => {
        const role = element.getAttribute('data-message-author-role');
        
        // Try multiple selectors to find the text content
        let textElement = element.querySelector('.markdown') || 
                         element.querySelector('.prose') || 
                         element.querySelector('[class*="prose"]') ||
                         element.querySelector('.text-base');
        
        if (!textElement) {
            // If no specific text element found, use the whole element
            textElement = element;
        }
        
        const content = textElement.innerText || textElement.textContent || '';
        
        if (content.trim()) {
            messages.push({
                role: role,
                content: content.trim(),
                timestamp: new Date().toISOString(),
                elementIndex: index
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

// FIXED: Monitor conversation changes with polling backup
function startConversationMonitoring() {
    if (conversationMonitor.isActive) return;
    
    conversationMonitor.isActive = true;
    conversationMonitor.currentConversationId = generateConversationId();
    
    console.log('🎯 Conversation Flow Monitoring activated');
    
    // Polling approach as primary method
    setInterval(() => {
        const currentMessages = extractConversationWithTurns();
        if (currentMessages.length > conversationMonitor.lastMessageCount) {
            console.log('📨 New message detected via polling');
            analyzeConversationTurn();
        }
    }, 2000); // Check every 2 seconds
    
    // Mutation observer as backup
    const observer = new MutationObserver((mutations) => {
        let hasNewMessages = false;
        
        mutations.forEach(mutation => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // More robust detection
                        const hasMessage = node.querySelector && (
                            node.querySelector('[data-message-author-role]') ||
                            node.querySelector('.text-base') ||
                            node.querySelector('.prose') ||
                            (node.getAttribute && node.getAttribute('data-message-author-role'))
                        );
                        if (hasMessage) {
                            hasNewMessages = true;
                            console.log('📨 New message detected via MutationObserver');
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
    
    // Try multiple container selectors
    const conversationContainer = document.querySelector('main [class*="react-scroll-to-bottom"]') || 
                                  document.querySelector('main div[class*="flex-col"]') ||
                                  document.querySelector('main') || 
                                  document.body;
    
    observer.observe(conversationContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-message-author-role']
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
    
    // Start monitoring context usage
    setTimeout(() => {
        startContextMonitoring();
    }, 5000);
    
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

window.detectGPTModel = detectGPTModel;
window.extractConversationWithTurns = extractConversationWithTurns;
window.checkContextUsage = checkContextUsage;
window.knowledgeGraphData = knowledgeGraphData;

// Add debug helper for manual testing
window.debugTriggerAnalysis = function() {
    console.log('🔧 Manually triggering conversation analysis...');
    analyzeConversationTurn();
};

// ===== MEMORY TAB FUNCTIONS =====

// Function to monitor context usage
function startContextMonitoring() {
    // Check context usage every 30 seconds
    contextUsageInterval = setInterval(checkContextUsage, 30000);
    // Check immediately
    checkContextUsage();
}


function detectGPTModel() {
    // Check URL for model indicators
    const url = window.location.href;
    
    // Check for GPT-4 indicators in the DOM
    const modelSelectors = [
        // Look for model selector dropdown
        '[data-testid="model-selector"]',
        '[class*="model-selector"]',
        'button[aria-label*="GPT"]',
        // Check for GPT-4 badge
        '[class*="gpt-4"]',
        '[data-model*="gpt-4"]'
    ];
    
    for (const selector of modelSelectors) {
        const element = document.querySelector(selector);
        if (element) {
            const text = element.textContent || element.getAttribute('aria-label') || '';
            if (text.includes('GPT-4')) {
                if (text.includes('32k')) return 'gpt-4-32k';
                return 'gpt-4';
            }
            if (text.includes('GPT-3.5')) return 'gpt-3.5-turbo';
        }
    }
    
    // Default to GPT-4 if we can't detect
    return 'gpt-4';
}


async function checkContextUsage() {
    const conversation = extractConversationWithTurns();
    const model = detectGPTModel();
    
    try {
        const response = await fetch(`${API_URL}/analyze_context_usage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                conversation,
                model: model
             })
        });
        
        const data = await response.json();
        updateContextUsageDisplay(data);
        
    } catch (error) {
        console.error('Error checking context usage:', error);
    }
}

function updateContextUsageDisplay(data) {
    const fill = document.getElementById('context-usage-fill');
    const text = document.getElementById('context-usage-text');
    const warning = document.getElementById('context-warning');
    
    if (fill && text) {
        fill.style.width = `${Math.min(100, data.usage_percentage)}%`;
        text.textContent = `${data.usage_percentage}% Context Used (${data.estimated_tokens}/${data.context_limit} tokens)`;
        
        // Show warning if approaching limit
        if (data.approaching_limit && warning) {
            warning.style.display = 'block';
            // Auto-switch to Memory tab if critical
            if (data.critical && activeTab !== 'memory') {
                showTemporaryNotification('⚠️ Approaching context limit! Check Memory tab.', 'warning');
            }
        }
    }
}

// Function to load and display knowledge graph
async function loadKnowledgeGraph() {
    try {
        const userId = await getUserId();
        const response = await fetch(`${API_URL}/generate_knowledge_graph`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                time_range_days: 30,
                max_nodes: 50
            })
        });
        
        const data = await response.json();
        knowledgeGraphData = data;
        renderKnowledgeGraph(data);
        
    } catch (error) {
        console.error('Error loading knowledge graph:', error);
    }
}

// Simple D3.js knowledge graph renderer
function renderKnowledgeGraph(data) {
    const container = document.getElementById('knowledge-graph-container');
    if (!container || !data.nodes.length) return;
    
    // Clear existing content
    container.innerHTML = '';
    
    // For now, create a simple interactive list (we'll add D3.js visualization later)
    const graphHTML = `
        <div style="padding: 12px;">
            <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
                📊 ${data.stats.total_memories} memories across ${data.stats.total_topics} topics
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${data.nodes.map(node => `
                    <div class="memory-node" data-id="${node.id}" style="
                        background: ${selectedMemoryIds.has(node.id) ? '#667eea' : '#e0e0e0'};
                        color: ${selectedMemoryIds.has(node.id) ? 'white' : '#333'};
                        padding: 4px 8px;
                        border-radius: 12px;
                        font-size: 10px;
                        cursor: pointer;
                        transition: all 0.2s;
                    " title="${node.summary}">
                        ${node.label}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    container.innerHTML = graphHTML;
    
    // Add click handlers
    container.querySelectorAll('.memory-node').forEach(node => {
        node.addEventListener('click', () => toggleMemorySelection(node.dataset.id));
    });
}

// Toggle memory selection
function toggleMemorySelection(memoryId) {
    if (selectedMemoryIds.has(memoryId)) {
        selectedMemoryIds.delete(memoryId);
    } else {
        selectedMemoryIds.add(memoryId);
    }
    
    // Update visual state
    renderKnowledgeGraph(knowledgeGraphData);
    updateSelectedMemoriesList();
}

// Update selected memories display
function updateSelectedMemoriesList() {
    const listContainer = document.getElementById('selected-memories-list');
    if (!listContainer || !knowledgeGraphData) return;
    
    const selectedNodes = knowledgeGraphData.nodes.filter(n => selectedMemoryIds.has(n.id));
    
    listContainer.innerHTML = selectedNodes.length ? selectedNodes.map(node => `
        <div style="
            background: #f0f0f0;
            padding: 6px;
            margin-bottom: 4px;
            border-radius: 4px;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        ">
            <span>${node.title}</span>
            <button class="remove-memory-btn" data-id="${node.id}" style="
                background: none;
                border: none;
                color: #999;
                cursor: pointer;
                font-size: 12px;
            ">×</button>
        </div>
    `).join('') : '<div style="color: #999; font-size: 11px;">No memories selected</div>';
    
    // Add event listeners to remove buttons
    listContainer.querySelectorAll('.remove-memory-btn').forEach(btn => {
        btn.addEventListener('click', () => toggleMemorySelection(btn.dataset.id));
    });
}

// Generate context bridge
async function generateContextBridge() {
    const btn = document.getElementById('generate-context-bridge');
    const resultDiv = document.getElementById('context-bridge-result');
    
    if (!selectedMemoryIds.size) {
        showTemporaryNotification('Please select at least one memory', 'warning');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '🔄 Generating context bridge...';
    
    try {
        const userId = await getUserId();
        const currentConversation = extractConversationWithTurns();
        

        const selectedNodes = knowledgeGraphData.nodes.filter(n => selectedMemoryIds.has(n.id));
        const searchQuery = selectedNodes.map(n => n.title).join(' ');
        const response = await fetch(`${API_URL}/intelligent_context_bridge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-ID': userId
            },
            body: JSON.stringify({
                current_conversation: currentConversation,
                search_query: searchQuery,
                max_context_tokens: 2000
            })
        });
        
        const data = await response.json();
        
        // Display result
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
            <div style="
                background: #f8f9fa;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 12px;
                margin-top: 12px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 12px;">Generated Context Bridge</strong>
                    <span style="font-size: 10px; color: #666;">
                        💾 Saved ${data.metrics.compression_ratio}% tokens
                    </span>
                </div>
                <div style="
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    font-size: 11px;
                    line-height: 1.4;
                    max-height: 200px;
                    overflow-y: auto;
                    margin-bottom: 8px;
                ">
                    ${data.context_injection.replace(/\n/g, '<br>')}
                </div>
                <button id="paste-context-bridge" style="
                    width: 100%;
                    background: #10a37f;
                    color: white;
                    border: none;
                    padding: 8px;
                    border-radius: 6px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: 600;
                ">📋 Paste to ChatGPT</button>
            </div>
        `;
        
        // Add paste handler
        document.getElementById('paste-context-bridge').addEventListener('click', () => {
            const success = pasteIntoInput(data.context_injection);
            if (success) {
                showTemporaryNotification('✅ Context bridge pasted!', 'success');
                // Minimize panel
                togglePanelMinimize();
            }
        });
        
    } catch (error) {
        console.error('Error generating context bridge:', error);
        showTemporaryNotification('Failed to generate context bridge', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🌉 Generate Context Bridge';
    }
}

// Get user ID helper
async function getUserId() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getUserId' }, (response) => {
            resolve(response.userId);
        });
    });
}

// Add debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Search memories function
async function searchMemories(event) {
    const query = event.target.value;
    if (!query) {
        loadKnowledgeGraph(); // Reset to full graph
        return;
    }
    
    // Filter existing graph based on search
    if (knowledgeGraphData) {
        const filteredData = {
            ...knowledgeGraphData,
            nodes: knowledgeGraphData.nodes.filter(node => 
                node.title.toLowerCase().includes(query.toLowerCase()) ||
                node.summary.toLowerCase().includes(query.toLowerCase()) ||
                node.topics.some(t => t.toLowerCase().includes(query.toLowerCase()))
            )
        };
        renderKnowledgeGraph(filteredData);
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request.action);
    
    if (request.action === 'capture') {
        const conversation = extractConversation();
        console.log('Sending back conversation:', conversation.length, 'messages');
        sendResponse({ conversation: conversation });
    }
    
    // Return true to indicate async response
    return true;
});