// --- Supabase and Global Configuration ---
// NOTE: For the app to work, you must define window.SUPABASE_URL and 
// window.SUPABASE_ANON_KEY in your HTML *before* loading this script.
const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

// Initializing the Supabase Client.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// [AI INTEGRATION CONFIGURATION MOVED]
// The AI configuration constants were moved inside the app() function 
// to fix the "Cannot access 'SYSTEM_PROMPT' before initialization" error.

// --- Helper Functions ---

/**
 * Records an activity to the 'activity_logs' table.
 */
async function recordActivity(action, details, userId, userRole) { 
    if (!userId) {
        console.warn('Cannot record activity: User ID is required.');
        return;
    }

    // Using the correct client name 'supabaseClient'
    const { error } = await supabaseClient 
        .from('activity_logs')
        .insert([{
            user_id: userId,
            action: action,
            details: {
                ...details,
                user_role: userRole || 'unknown'
            }
        }]);

    if (error) {
        console.error('Error recording activity:', error.message);
    } else {
        console.log(`Activity logged: ${action}`);
    }
}

/**
 * Formats a date string into 'YYYY-MM-DD'.
 */
function formatDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toISOString().split('T')[0];
}

/**
 * Converts ISO date string to a human-readable time format (e.g., "10:30 AM").
 */
function formatLogTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Converts ISO date string to a human-readable date format (e.g., "Oct 21, 2025").
 */
function formatLogDate(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


// --- Toast/Notification Store for Alpine.js ---
document.addEventListener('alpine:init', () => {
    Alpine.store('toasts', {
        items: [],
        history: [],

        add(toast) {
            toast.id = Date.now();
            toast.show = true;
            this.items.unshift(toast);
            this.history.unshift(toast);
            setTimeout(() => this.remove(toast.id), 5000);
        },

        remove(id) {
            const index = this.items.findIndex(i => i.id === id);
            if (index > -1) {
                this.items[index].show = false;
                setTimeout(() => {
                    this.items = this.items.filter(i => i.id !== id);
                }, 300); // Wait for transition
            }
        },
        
        showSuccess(title, message) {
            this.add({ title, message, emoji: '✅', borderClass: 'border-green-500' });
        },
        showError(title, message) {
            this.add({ title, message, emoji: '❌', borderClass: 'border-red-500' });
        },
        showInfo(title, message) {
            this.add({ title, message, emoji: '💡', borderClass: 'border-sky-500' });
        },
        clearHistory() {
            this.history = [];
        }
    });
});


// --- Alpine.js App Data and Logic ---

// The main Alpine.js data object
function app() {
    return {
        // --- Core State ---
        view: 'dashboard',
        isSidebarOpen: false,
        showNotificationsSidebar: false,
        globalSearch: '',
        isAppLoaded: false, 

        
        // --- Data from Supabase ---
        supervisors: [],
        agents: [],
        posDevices: [],
        activityLogs: [],
        alerts: [],
        alertFilters: {
            status: 'ALL',
            severity: 'ALL',
        },

        // [AI INTEGRATION START] - New AI Chat State
        aiChatWindowOpen: false,
        chatInput: '',
        // FIX: Moved SYSTEM_PROMPT inside the app() function to resolve ReferenceError
        SYSTEM_PROMPT: `You are a friendly and intelligent IT Asset Management Assistant named 'Senior Man'. 
Your primary function is to help the administrator analyze and manage inventory data. 
You can answer questions about supervisors, agents, and POS devices. 
You have access to a data lookup tool for real-time information. 
When asked a question about the current inventory or staff, use the 'lookupData' tool. 
Be concise and focus on the data requested.`,
        chatHistory: [
             { 
                role: 'system', 
                content: this.SYSTEM_PROMPT, // FIX: Use 'this.SYSTEM_PROMPT'
                id: 'sys-0',
                timestamp: Date.now()
             },
             { 
                role: 'assistant', 
                content: "Hello! I'm Senior Man, your POS Management Assistant. How can I help you analyze the data today?", 
                id: 'ai-0',
                timestamp: Date.now() + 1 
             }
        ],
        isAITyping: false,
        aiConfig: {
            // FIX: Inlined AI Configuration
            AI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            AI_API_KEY: 'AIzaSyDVALjRSB0jKvBX33QdXD3Esq0noaX7efQ',
            AI_MODEL: 'gemini-2.5-flash',
        },
        // [AI INTEGRATION END]

        // --- Dashboard / Filters ---
        counts: { supervisors: 0, agents: 0, pos: 0, requests_pending: 0 },
        selectedSupervisorFilterId: '',
        agentSupervisorData: { names: [], counts: [] },
        posConditionData: { labels: [], counts: [] },
        updates: { currentVersion: '2.1.0' },

        logFilters: {
            searchQuery: '',
            actionType: 'ALL',
            startDate: '', // YYYY-MM-DD
            endDate: '',   // YYYY-MM-DD
        },

        // --- User/Settings ---
        currentUser: { name: 'ICT Admin', role: 'Admin', id: 'ADM001' },
        settings: { admin_name: 'ICT Admin', email: 'admin@enterprise.com' },

        // --- Modal State ---
        showModal: false,
        modalView: '',
        modalTitle: '',
        form: {}, // Holds form data for Add/Edit operations

        // --- Chart Instances ---
        agentsChartInstance: null,
        posConditionChartInstance: null,


        // --- Initialization and Watchers ---
        // --- Initialization and Watchers ---
        initApp() {
            this.fetchData(); 
            this.updateTime();
            setInterval(() => this.updateTime(), 1000);
            this.loadTheme(); // <-- This now calls the method defined below
            
            // Watchers remain the same...
            this.$watch('view', () => {
                this.$nextTick(() => {
                    lucide.createIcons();
                });
            });

            this.$nextTick(() => {
                lucide.createIcons();
            });
            
            this.$watch('aiChatWindowOpen', (open) => {
                if (open) {
                    this.$nextTick(() => this.scrollToBottom());
                }
            });
        },
        
        // FIX: The loadTheme function is now correctly defined as a method
        loadTheme() {
            // Placeholder for theme loading logic
            console.log("Theme loaded successfully (defaulting to light mode).");
        },
        
        // [AI INTEGRATION START] - Alpine-friendly AI Setup & Helpers
        
        /**
         * Scrolls the chat window to the bottom using its ref
         */
        scrollToBottom() {
            const chatOutput = this.$refs.chatOutput; 
            if (chatOutput) {
                chatOutput.scrollTop = chatOutput.scrollHeight;
            }
        },

        /**
         * Formats a timestamp into chat time (e.g., "10:30 AM")
         */
        getChatTime(timestamp) {
            if (!timestamp) return 'N/A';
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        },

        /**
         * The core function that the AI calls to retrieve real-time data.
         * @param {string} entity - The table to look up ('supervisors', 'agents', 'pos_devices', 'alerts').
         * @returns {string} - JSON string of the requested data.
         */
        lookupData(entity) {
            const dataMap = {
                'supervisors': this.supervisors,
                'agents': this.agents,
                'pos_devices': this.posDevices,
                'alerts': this.alerts.filter(a => a.status !== 'Resolved'),
            };

            const data = dataMap[entity];
            if (!data) {
                return JSON.stringify({ error: `Entity '${entity}' not found or not supported.` });
            }
            
            // Limit the data size to prevent large responses, especially for agents/pos
            const MAX_RECORDS = 10;
            const summary = data.length > MAX_RECORDS 
                ? data.slice(0, MAX_RECORDS).map(item => {
                    // Reduce data complexity for tool input
                    if (entity === 'agents') return { id: item.agent_id, name: item.name, supervisor: item.supervisor_name, location: item.location };
                    if (entity === 'pos_devices') return { serial: item.serial_number, agent: item.agent_name, status: item.status };
                    if (entity === 'alerts') return { id: item.id, title: item.title, severity: item.severity, status: item.status };
                    return item;
                })
                : data.map(item => {
                    if (entity === 'agents') return { id: item.agent_id, name: item.name, supervisor: item.supervisor_name, location: item.location };
                    if (entity === 'pos_devices') return { serial: item.serial_number, agent: item.agent_name, status: item.status };
                    if (entity === 'alerts') return { id: item.id, title: item.title, severity: item.severity, status: item.status };
                    return item;
                });
            
            const count = data.length;
            
            return JSON.stringify({ 
                count: count,
                summary: summary,
                note: count > MAX_RECORDS ? `Showing a summary of the first ${MAX_RECORDS} records out of ${count} total.` : null
            });
        },

        /**
         * Handles the AI's request to call a function/tool.
         * @param {object} functionCall - The function call object (tool_call) from the AI.
         * @returns {object} - The tool output in a message format.
         */
        handleFunctionCall(functionCall) {
            if (functionCall.function && functionCall.function.name === 'lookupData') {
                try {
                    const args = JSON.parse(functionCall.function.arguments);
                    const output = this.lookupData(args.entity);
                    return {
                        role: 'tool',
                        tool_call_id: functionCall.id,
                        content: output,
                        id: Date.now() + 3
                    };
                } catch (e) {
                    console.error('Error parsing function arguments:', e);
                    return {
                        role: 'tool',
                        tool_call_id: functionCall.id,
                        content: JSON.stringify({ error: 'Invalid arguments provided for lookupData.' }),
                        id: Date.now() + 3
                    };
                }
            }

            const unknownFunctionName = functionCall.function ? functionCall.function.name : 'Unknown/Undefined';
            
            return {
                role: 'tool',
                tool_call_id: functionCall.id,
                content: JSON.stringify({ error: `Unknown function: ${unknownFunctionName}` }),
                id: Date.now() + 3
            };
        },


        /**
         * Sends the user message to the AI API and handles the response.
         */
        async sendAIChatMessage() {
            const userMessage = this.chatInput.trim();
            if (!userMessage || this.isAITyping) return;

            // 1. Add user message to history
            const userMsg = { role: 'user', content: userMessage, id: Date.now(), timestamp: Date.now() };
            this.chatHistory.push(userMsg);
            this.chatInput = '';
            this.isAITyping = true;
            this.$nextTick(() => this.scrollToBottom());
            
            const tools = [
                {
                    type: 'function',
                    function: {
                        name: 'lookupData',
                        description: 'Retrieves real-time data from the POS tracking system for a specified entity.',
                        parameters: {
                            type: 'object',
                            properties: {
                                entity: {
                                    type: 'string',
                                    description: 'The name of the entity table to query. Must be one of: "supervisors", "agents", "pos_devices", or "alerts".'
                                }
                            },
                            required: ['entity']
                        }
                    }
                }
            ];

            try {
                let aiResponse;
                let functionCallRequired = true;

                // Loop for multi-turn tool use (Function Calling)
                while (functionCallRequired) {
                    
                    // Filter history to prepare messages for the API call (excluding local IDs/timestamps)
                    const apiMessages = this.chatHistory.map(msg => {
                        const { id, timestamp, ...rest } = msg;
                        return rest;
                    });
                    
                    const response = await fetch(this.aiConfig.AI_API_URL, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            // The Authorization header format depends on the AI API (e.g., OpenAI/Gemini/Custom)
                            // This example assumes an OpenAI-like structure for the key. Adjust as needed.
                            'Authorization': `Bearer ${this.aiConfig.AI_API_KEY}` 
                        },
                        body: JSON.stringify({
                            model: this.aiConfig.AI_MODEL,
                            messages: [
                                // FIX: Use 'this.SYSTEM_PROMPT' instead of the now-removed global constant
                                { role: 'system', content: this.SYSTEM_PROMPT },
                                ...apiMessages
                            ],
                            tools: tools,
                        })
                    });
                    
                    if (!response.ok) throw new Error(`HTTP Error: ${response.statusText}`);
                    const jsonResponse = await response.json();
                    
                    // The structure of the response depends on the AI model (e.g., OpenAI vs Google Gen AI)
                    // This block assumes a common OpenAI-like response structure
                    aiResponse = jsonResponse.choices[0].message;
                    aiResponse.id = Date.now() + 2;
                    aiResponse.timestamp = Date.now();
                    
                    // 2. Check for Function Call
                    if (aiResponse.tool_calls && aiResponse.tool_calls.length > 0) {
                        
                        // Add the AI's tool call request to the history
                        this.chatHistory.push(aiResponse);

                        // Process the tool call and get the result
                        const toolCall = aiResponse.tool_calls[0];
                        const toolOutput = this.handleFunctionCall(toolCall);

                        // 3. Add tool output to history and loop back to send it to the AI
                        this.chatHistory.push(toolOutput);
                        functionCallRequired = true; // Continue the loop to get the final text response

                    } else if (aiResponse.content) {
                        // 4. It was a direct text response, add to history and exit loop
                        this.chatHistory.push(aiResponse);
                        functionCallRequired = false;
                    } else {
                        // Edge case: no content and no tool call (should not happen)
                        const errorMsg = { role: 'assistant', content: 'The AI provided an empty response.', id: Date.now() + 4, timestamp: Date.now() };
                        this.chatHistory.push(errorMsg);
                        functionCallRequired = false;
                    }

                }

} catch (error) {
    console.error('AI API Error:', error);
    const errorMessage = { 
        role: 'assistant', 
        content: 'I am currently unable to connect to my AI service. Please check the API configuration and network connection. Details in console.',
        id: Date.now() + 5 
    };
    this.chatHistory.push(errorMessage);
    Alpine.store('toasts').showError('AI Error', 'Failed to get response from AI service.');
                
            } finally {
                this.isAITyping = false;
                this.$nextTick(() => {
                    // FIX: Auto-focus the input field after sending a message
                    // Assuming the input field in index.html has x-ref="chatInputRef"
                    if (this.$refs.chatInputRef) {
                        this.$refs.chatInputRef.focus();
                    }
                    this.scrollToBottom();
                });
            }
        },
        
        // [AI INTEGRATION END]

        // --- Clock & Greeting Logic ---
        updateTime() {
            const now = new Date();
            const timeElement = document.getElementById('time');
            if (timeElement) {
                timeElement.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            const greetingElement = document.getElementById('greeting');
            const hour = now.getHours();
            let greeting;
            if (hour < 12) {
                greeting = 'Good Morning 🌄';
            } else if (hour < 18) {
                greeting = 'Good Afternoon☀️';
            } else {
                greeting = 'Good Evening🌙';
            }
            if (greetingElement) {
                greetingElement.textContent = `${greeting}, ${this.currentUser.name}!`;
            }
        },

        // --- Data Fetching ---
        async fetchData() {
            // Use Promise.all to fetch all core data concurrently
            await Promise.all([
                this.fetchSupervisors(),
                this.fetchAgents(),
                this.fetchPOSDevices(),
                this.fetchActivityLogs(),
                this.fetchAlerts()
            ]);
            
            this.prepareAgentSupervisorData();
            this.preparePOSConditionData();
            
            this.$nextTick(() => {
                this.initAgentsChart();
                this.initPOSConditionChart();
                
                // Set the state to true to hide the preloader
                this.isAppLoaded = true; 
            
            });
        },

        async fetchSupervisors() {
            const { data, error } = await supabaseClient.from('supervisors').select('*');
            if (error) {
                Alpine.store('toasts').showError('Data Error', 'Could not fetch supervisors.');
                console.error('Error fetching supervisors:', error);
            } else {
                this.supervisors = data;
                this.counts.supervisors = data.length;
            }
        },

        async fetchAgents() {
            // Fetch agents and their supervisor names
            const { data, error } = await supabaseClient
                .from('agents')
                .select('*, supervisors(name)'); // Join supervisors table
            
            if (error) {
                Alpine.store('toasts').showError('Data Error', 'Could not fetch agents.');
                console.error('Error fetching agents:', error);
            } else {
                this.agents = data.map(agent => ({
                    ...agent,
                    supervisor_name: agent.supervisors ? agent.supervisors.name : 'Unassigned'
                }));
                this.counts.agents = data.length;
            }
        },

       // main.js - inside function app()

        async fetchPOSDevices() {
            // Fetch POS devices and their assigned agent names
            const { data, error } = await supabaseClient
                .from('pos_devices')
                .select('*, agents(name)'); // Join agents table
            
            if (error) {
                Alpine.store('toasts').showError('Data Error', 'Could not fetch POS devices.');
                console.error('Error fetching POS devices:', error);
            } else {
                this.posDevices = data.map(pos => ({
                    ...pos,
                    agent_name: pos.agents ? pos.agents.name : null,
                    formatted_date_issued: pos.date_issued ? formatDate(pos.date_issued) : null,
                }));
                this.counts.pos = data.length;
                
                // ✅ FIX 1: Count POS where STATUS is 'Maintenance' to align with pending requests.
                // Replaces the old 'Faulty' check.
                this.counts.requests_pending = this.posDevices.filter(p => p.status === 'Maintenance').length;
            }
        },
        
        /**
         * Fetches all alerts from the Supabase 'alerts' table.
         */
        async fetchAlerts() {
            try {
                const { data, error } = await supabaseClient // Use supabaseClient
                    .from('alerts')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                this.alerts = data;
                Alpine.store('toasts').showSuccess('Alerts Loaded', `${data.length} system alerts fetched successfully.`);
            } catch (error) {
                console.error('Error fetching alerts:', error.message);
                Alpine.store('toasts').showError('Error', 'Failed to fetch system alerts.');
            }
        },

        /**
         * Updates the status of a specific alert.
         */
        async updateAlertStatus(id, newStatus) {
            if (!confirm(`Are you sure you want to mark this alert as ${newStatus}?`)) return;
            try {
                const { error } = await supabaseClient // Use supabaseClient
                    .from('alerts')
                    .update({ status: newStatus })
                    .eq('id', id);

                if (error) throw error;

                // Update local state to reflect the change
                const index = this.alerts.findIndex(a => a.id === id);
                if (index !== -1) {
                    this.alerts[index].status = newStatus;
                }
                Alpine.store('toasts').showSuccess('Success', `Alert ${id} status updated to ${newStatus}.`);
            } catch (error) {
                console.error('Error updating alert status:', error.message);
                Alpine.store('toasts').showError('Error', 'Failed to update alert status.');
            }
        },

        /**
         * Helper to format the created_at time for display.
         */
        formatAlertTime(timestamp) {
            if (!timestamp) return 'N/A';
            return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        },


        async fetchActivityLogs() {
            const { data, error } = await supabaseClient
                .from('activity_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(10); // Fetching only the 10 most recent logs for the sidebar
            if (error) {
                console.error('Error fetching activity logs:', error);
            } else {
                this.activityLogs = data;
            }
        },

        // --- Filtering Logic ---
        filteredSupervisors() {
            if (!this.globalSearch) {
                return this.supervisors;
            }
            const search = this.globalSearch.toLowerCase();
            return this.supervisors.filter(s => 
                s.name.toLowerCase().includes(search) || 
                s.region.toLowerCase().includes(search) || 
                s.contact.includes(search)
            );
        },

        filteredAgents() {
            let filtered = this.agents;
            if (this.selectedSupervisorFilterId) {
                // FIX: Use non-strict equality (==) to correctly compare the string ID from the dropdown
                // with the number/BIGINT ID from the database (a.supervisor_id).
                filtered = filtered.filter(a => a.supervisor_id == this.selectedSupervisorFilterId);
            }

            if (!this.globalSearch) {
                return filtered;
            }

            const search = this.globalSearch.toLowerCase();
            return filtered.filter(a => 
                a.name.toLowerCase().includes(search) || 
                a.location.toLowerCase().includes(search) || 
                a.supervisor_name.toLowerCase().includes(search)
            );
        },

        filteredPOS() {
            if (!this.globalSearch) {
                return this.posDevices;
            }
            const search = this.globalSearch.toLowerCase();
            return this.posDevices.filter(p => 
                p.serial_number.toLowerCase().includes(search) || 
                p.agent_name?.toLowerCase().includes(search) || 
                p.status.toLowerCase().includes(search)
            );
        },
        
        filteredActivityLogs() {
            let filtered = this.activityLogs;

            // Filter by Action Type
            if (this.logFilters.actionType !== 'ALL') {
                filtered = filtered.filter(log => log.action.includes(this.logFilters.actionType));
            }

            // Filter by Search Query (details)
            if (this.logFilters.searchQuery) {
                const search = this.logFilters.searchQuery.toLowerCase();
                filtered = filtered.filter(log => 
                    JSON.stringify(log.details).toLowerCase().includes(search)
                );
            }

            // Note: Date filtering is omitted for simplicity in this version but can be added here.
            
            return filtered;
        },

        filteredAlerts() {
            return this.alerts.filter(alert => {
                const statusMatch = this.alertFilters.status === 'ALL' || alert.status === this.alertFilters.status;
                const severityMatch = this.alertFilters.severity === 'ALL' || alert.severity === this.alertFilters.severity;
                return statusMatch && severityMatch;
            });
        },


        // --- Chart Data Preparation ---
        prepareAgentSupervisorData() {
            const counts = {};
            // Use the un-filtered agents data
            this.agents.forEach(agent => {
                const supervisorName = agent.supervisor_name || 'Unassigned';
                counts[supervisorName] = (counts[supervisorName] || 0) + 1;
            });
            
            // ENHANCEMENT 1: Sort the data by count (Agents assigned)
            const sortedData = Object.entries(counts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count); // Sort descending by count

            this.agentSupervisorData.names = sortedData.map(item => item.name);
            this.agentSupervisorData.counts = sortedData.map(item => item.count);

            if (this.agentsChartInstance) {
                this.updateAgentsChart();
            }
        },

        // main.js - inside function app()

        preparePOSConditionData() {
            // ✅ FIX 2: Updated statuses to match the new schema states
            const counts = {
                'Available': 0,
                'Deployed': 0,
                'Maintenance': 0, // Now correctly linked to the pending request count
                'Faulty': 0
            };
            this.posDevices.forEach(pos => {
                const status = pos.status || 'Unknown';
                if (counts.hasOwnProperty(status)) {
                    counts[status]++;
                }
            });
            this.posConditionData.labels = Object.keys(counts);
            this.posConditionData.counts = Object.values(counts);

            if (this.posConditionChartInstance) {
                this.updatePOSConditionChart();
            }
        },

        // --- Chart Rendering ---
        initAgentsChart() {
            const ctx = document.getElementById('agentsChart');
            if (!ctx) return; // Exit if the canvas element is not in the DOM

            // Destroy existing chart if it exists
            if (this.agentsChartInstance) {
                this.agentsChartInstance.destroy();
            }

            this.agentsChartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: this.agentSupervisorData.names,
                    datasets: [{
                        label: 'Number of Agents',
                        data: this.agentSupervisorData.counts,
                        backgroundColor: '#0EA5E9', // sky-500
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    // ENHANCEMENT 2: Change to Horizontal Bar Chart
                    indexAxis: 'y', 
                    scales: {
                        x: { // X-axis is now the count (value axis)
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Agent Count'
                            }
                        },
                        y: { // Y-axis is now the labels (category axis)
                            title: {
                                display: true,
                                text: 'Supervisor'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        },

        updateAgentsChart() {
            if (this.agentsChartInstance) {
                this.agentsChartInstance.data.labels = this.agentSupervisorData.names;
                this.agentsChartInstance.data.datasets[0].data = this.agentSupervisorData.counts;
                this.agentsChartInstance.update();
            }
        },

        initPOSConditionChart() {
            const ctx = document.getElementById('posConditionChart');
            if (!ctx) return; // Exit if the canvas element is not in the DOM

            // Destroy existing chart if it exists
            if (this.posConditionChartInstance) {
                this.posConditionChartInstance.destroy();
            }

            this.posConditionChartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: this.posConditionData.labels,
                    datasets: [{
                        data: this.posConditionData.counts,
                        backgroundColor: [
                            '#10B981', // Operational (Green)
                            '#F59E0B', // Maintenance (Yellow/Amber)
                            '#EF4444', // Faulty (Red)
                            '#9CA3AF'  // Retired (Gray)
                        ],
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'right',
                        },
                        title: {
                            display: false,
                        }
                    }
                }
            });
        },

        updatePOSConditionChart() {
            if (this.posConditionChartInstance) {
                this.posConditionChartInstance.data.labels = this.posConditionData.labels;
                this.posConditionChartInstance.data.datasets[0].data = this.posConditionData.counts;
                this.posConditionChartInstance.update();
            }
        },
        
        // --- Reporting Logic (PDF Export) ---
        exportToPDF(entity) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let title = '';
            let columns = [];
            let rows = [];
            let data = [];

            if (entity === 'supervisors') {
                title = 'Supervisors Report';
                columns = ['ID', 'Name', 'Region', 'Contact'];
                data = this.supervisors;
                rows = data.map(s => [s.supervisor_id, s.name, s.region, s.contact]);
            } else if (entity === 'agents') {
                title = 'Agents Report';
                columns = ['ID', 'Name', 'Location', 'Supervisor'];
                data = this.agents;
                rows = data.map(a => [a.agent_id, a.name, a.location, a.supervisor_name]);
            } else if (entity === 'pos') {
                title = 'POS Devices Report';
                columns = ['Serial No.', 'Model', 'Status', 'Agent', 'Date Issued'];
                data = this.posDevices;
                rows = data.map(p => [p.serial_number, p.model, p.status, p.agent_name || 'Unassigned', p.formatted_date_issued || 'N/A']);
            } else {
                Alpine.store('toasts').showError('Export Error', 'Unknown entity for PDF export.');
                return;
            }

            doc.text(title, 14, 15);
            doc.autoTable({
                startY: 20,
                head: [columns],
                body: rows,
                theme: 'striped',
                headStyles: { fillColor: [14, 165, 233] } // sky-500
            });

            doc.save(`${title.toLowerCase().replace(/\s/g, '-')}-${formatDate(new Date())}.pdf`);
            Alpine.store('toasts').showSuccess('PDF Generated', `${title} successfully exported.`);
        },


        // --- CRUD Modals & Operations ---
        openModal(view, title, data = {}) {
            this.modalView = view;
            this.modalTitle = title;
            // Deep clone the object for editing to avoid modifying data before save
            this.form = JSON.parse(JSON.stringify(data)); 
            this.showModal = true;
            this.$nextTick(() => {
                lucide.createIcons();
                // If it's an edit view, format date if necessary
                if (view === 'edit-pos' && this.form.date_issued) {
                    this.form.date_issued = formatDate(this.form.date_issued);
                }
            });
        },
        
        closeModal(success = false) {
            this.showModal = false;
            this.form = {};
            if (success) {
                // Re-fetch data to update the table/charts
                this.fetchData();
            }
        },

        // --- Supervisor CRUD ---
        async saveSupervisor() {
            const isEdit = this.modalView === 'edit-supervisor';
            const table = 'supervisors';
            const payload = {
                supervisor_id: this.form.supervisor_id,
                name: this.form.name,
                region: this.form.region,
                contact: this.form.contact,
            };

            let error;
            if (isEdit) {
                // Update operation
                ({ error } = await supabaseClient
                    .from(table)
                    .update(payload)
                    .eq('supervisor_id', this.form.supervisor_id));
            } else {
                // Insert operation
                ({ error } = await supabaseClient
                    .from(table)
                    .insert([payload]));
            }

            if (error) {
                Alpine.store('toasts').showError('Save Error', `Failed to ${isEdit ? 'update' : 'add'} supervisor: ${error.message}`);
                console.error(`Error saving supervisor:`, error);
            } else {
                Alpine.store('toasts').showSuccess('Success', `Supervisor ${isEdit ? 'updated' : 'added'} successfully.`);
                await recordActivity(
                    isEdit ? 'UPDATE_SUPERVISOR' : 'ADD_SUPERVISOR', 
                    { entity_type: 'Supervisor', entity_id: this.form.supervisor_id, name: this.form.name }, 
                    this.currentUser.id, 
                    this.currentUser.role
                );
                this.closeModal(true);
            }
        },

        // --- Agent CRUD ---
        async saveAgent() {
            const isEdit = this.modalView === 'edit-agent';
            const table = 'agents';
            const payload = {
                agent_id: this.form.agent_id,
                name: this.form.name,
                location: this.form.location,
                supervisor_id: this.form.supervisor_id,
            };

            let error;
            if (isEdit) {
                // Update operation
                ({ error } = await supabaseClient
                    .from(table)
                    .update(payload)
                    .eq('agent_id', this.form.agent_id));
            } else {
                // Insert operation
                ({ error } = await supabaseClient
                    .from(table)
                    .insert([payload]));
            }

            if (error) {
                Alpine.store('toasts').showError('Save Error', `Failed to ${isEdit ? 'update' : 'register'} agent: ${error.message}`);
                console.error(`Error saving agent:`, error);
            } else {
                Alpine.store('toasts').showSuccess('Success', `Agent ${isEdit ? 'updated' : 'registered'} successfully.`);
                await recordActivity(
                    isEdit ? 'UPDATE_AGENT' : 'ADD_AGENT', 
                    { entity_type: 'Agent', entity_id: this.form.agent_id, name: this.form.name }, 
                    this.currentUser.id, 
                    this.currentUser.role
                );
                this.closeModal(true);
            }
        },

        // --- POS Device CRUD ---
        // --- POS Device CRUD ---
        // main.js - inside function app()

        // --- POS Device CRUD ---
        async savePOS() {
            const isEdit = this.modalView === 'edit-pos';
            const table = 'pos_devices';
            
            // ✅ FIX: Since pos_id is PRIMARY KEY but NOT auto-generated by the schema, 
            // we must generate a unique ID client-side for new records.
            if (!isEdit && !this.form.pos_id) {
                 // Use current timestamp as a simple unique ID
                 this.form.pos_id = Date.now(); 
            }

            // Define the payload with only fields matching the new schema
            const payload = {
                // Include the pos_id
                pos_id: this.form.pos_id, 
                serial_number: this.form.serial_number,
                status: this.form.status || 'Available',
                condition: this.form.condition || 'Good',
                notes: this.form.notes || null,
                agent_id: this.form.agent_id || null,
                
                // date_issued is only included if explicitly set in the form and we are editing.
                ...(this.form.date_issued && isEdit && { date_issued: this.form.date_issued }),
            };
            
            // Remove null/undefined values before sending to prevent unexpected API errors
            Object.keys(payload).forEach(key => (payload[key] === undefined) && delete payload[key]);


            let error;
            if (isEdit) {
                ({ error } = await supabaseClient
                    .from(table)
                    .update(payload)
                    .eq('serial_number', this.form.serial_number));
            } else {
                ({ error } = await supabaseClient
                    .from(table)
                    .insert([payload]));
            }

            if (error) {
                Alpine.store('toasts').showError('Save Error', `Failed to ${isEdit ? 'update' : 'add'} POS device: ${error.message}`);
                console.error(`Error saving POS:`, error);
            } else {
                Alpine.store('toasts').showSuccess('Success', `POS Device ${isEdit ? 'updated' : 'added'} successfully.`);
                await recordActivity(
                    isEdit ? 'UPDATE_POS' : 'ADD_POS', 
                    { entity_type: 'POS Device', entity_id: this.form.serial_number, status: this.form.status }, 
                    this.currentUser.id, 
                    this.currentUser.role
                );
                this.closeModal(true);
            }
        },
        // --- Maintenance Update ---
        async updateMaintenanceStatus() {
            const table = 'pos_devices';
            const newStatus = this.form.status;

            try {
                const { error } = await supabaseClient
                    .from(table)
                    .update({ status: newStatus })
                    .eq('serial_number', this.form.serial_number);

                if (error) throw error;
                
                Alpine.store('toasts').showSuccess('Status Updated', `POS Device ${this.form.serial_number} status changed to ${newStatus}.`);
                await recordActivity(
                    'UPDATE_POS_STATUS', 
                    { entity_type: 'POS Device', entity_id: this.form.serial_number, old_status: this.form.status_old, new_status: newStatus }, 
                    this.currentUser.id, 
                    this.currentUser.role
                );
                this.closeModal(true);
            } catch (error) {
                Alpine.store('toasts').showError('Update Error', `Failed to update POS status: ${error.message}`);
                console.error(`Error updating POS status:`, error);
            }
        },

        // --- Delete Operation ---
        async deleteItem() {
            let error;
            let table = '';
            let idField = '';
            let idValue = '';
            let entityType = '';

            if (this.modalView === 'delete-supervisor') {
                table = 'supervisors';
                idField = 'supervisor_id';
                idValue = this.form.supervisor_id;
                entityType = 'Supervisor';
            } else if (this.modalView === 'delete-agent') {
                table = 'agents';
                idField = 'agent_id';
                idValue = this.form.agent_id;
                entityType = 'Agent';
            } else if (this.modalView === 'delete-pos') {
                table = 'pos_devices';
                idField = 'serial_number';
                idValue = this.form.serial_number;
                entityType = 'POS Device';
            } else {
                return;
            }

            ({ error } = await supabaseClient
                .from(table)
                .delete()
                .eq(idField, idValue));

            if (error) {
                Alpine.store('toasts').showError('Delete Error', `Failed to delete ${entityType}: ${error.message}`);
                console.error(`Error deleting ${entityType}:`, error);
            } else {
                Alpine.store('toasts').showSuccess('Success', `${entityType} ${idValue} deleted successfully.`);
                await recordActivity(
                    `DELETE_${entityType.toUpperCase().replace(/\s/g, '_')}`, 
                    { entity_type: entityType, entity_id: idValue, name: this.form.name || this.form.serial_number }, 
                    this.currentUser.id, 
                    this.currentUser.role
                );
                this.closeModal(true);
            }
        },
        
        // --- Settings Management ---
        saveSettings() {
            // Update the current user's display name
            this.currentUser.name = this.settings.admin_name;

            Alpine.store('toasts').showSuccess('Settings Saved', 'Application settings updated.');
            this.updateTime(); // Update greeting immediately
        }
    }
}
