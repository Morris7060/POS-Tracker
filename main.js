// main.js - Consolidated Application Logic

// 1. Greeting and Time Update Function
function updateGreetingAndTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');

    // Determine greeting
    let greeting = '';
    if (hours < 12) {
        greeting = 'Good Morning🌅';
    } else if (hours < 18) {
        greeting = 'Good Afternoon🌞';
    } else {
        greeting = 'Good Evening🌜';
    }

    // Display greeting and time
    const elGreeting = document.getElementById('greeting');
    const elTime = document.getElementById('time');
    // Added safety check for elements
    if (elGreeting) elGreeting.textContent = `${greeting}, Admin!`;
    if (elTime) elTime.textContent = `Current Time: ${hours}:${minutes}:${seconds}`;
}

// 2. Alpine App Function (with Chart fix and Report integration)
function app(){
  return {
    agentsPerSupervisor: [],
    view: 'dashboard',
    supabase: window.supabase,
    settings: { admin_name: 'ICT Officer', email: 'admin@pos.com' }, // Default settings
    /* counts */
    counts: { supervisors:0, agents:0, pos:0, requests_pending:0 },
    /* search & filters */
    globalSearch: '', filterText: '', logsFilter: '',
    /* pagination & sorting (supervisors) */
    supPage: 1, supPageSize: 10, supSortColumn: 'name', supSortDir: 'asc', supervisorsTotal: 0,
    /* pagination & sorting (agents) */
    agtPage: 1, agtPageSize: 10, agtSortColumn: 'name', agtSortDir: 'asc', agentsTotal: 0,
    /* data */
    supervisors: [], agents: [], all_agents: [], pos_devices: [], pos_requests: [], activity_logs: [],
    /* modal */
    modalOpen: false, modalType: '', modalStep: 1, form: {}, modalTitle: '', modalSubtitle: '',
    supSelect: [],
    /* charts */
    chartAgents: null,
    chartType: localStorage.getItem('bst_chartType') || 'bar',
    _isToggling: false,
    
    selectedSupervisorId: '', // For the Report view

    get selectedSupervisorAgents() {
      const group = this.agentsPerSupervisor.find(
        g => g.supervisor_id == this.selectedSupervisorId
      );
      // Ensure agents property exists and is an array before returning
      return group && Array.isArray(group.agents) ? group.agents : [];
    },

    // -----------------------------------------------------------------
    // --- CONSOLIDATED & FIXED REPORT EXPORT LOGIC ---
    // -----------------------------------------------------------------

    /**
     * Exports all data from a Supabase table to a PDF file.
     */
    async exportPDF(table){
      try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Fetch all data for the table from Supabase
        const { data, error } = await this.supabase.from(table).select('*');
        
        if(error){ alert(error.message); return; }
        if(!data || !data.length){ 
          Alpine.store('toasts').pushSimple('No Data','⚠️', 'No data found to export.'); 
          return; 
        }

        const headers = Object.keys(data[0]);
        const body = data.map(r => Object.values(r));
        
        // Add title and table to PDF
        doc.text(`Report: ${table}`, 14, 18);
        (doc).autoTable({ 
            startY: 24, 
            head: [headers], 
            body: body,
            // Add minimal styling
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [56, 189, 248] }
        });

        // Save and download file
        doc.save(`${table}_report_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
        Alpine.store('toasts').pushSimple('PDF generated','🧾','');
      } catch(e){ 
        console.error(e); 
        Alpine.store('toasts').pushSimple('PDF export failed','❌', e.message || 'Unknown error');
      }
    },
    /**
     * Exports all data from a Supabase table to a CSV file.
     */
    async exportCSVServer(table){
      try {
        const { data, error } = await this.supabase.from(table).select('*');
        if(error){ alert(error.message); return; }
        if(!data || !data.length){ 
          Alpine.store('toasts').pushSimple('No Data','⚠️', 'No data found to export.'); 
          return; 
        }
        
        const headers = Object.keys(data[0]);
        // Map data to CSV rows, ensuring values are quoted and inner quotes escaped
        const rows = data.map(r => headers.map(h => `"${String(r[h]||'').replace(/"/g,'""')}"`).join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        
        // Create and download file
        const blob = new Blob([csv], { type:'text/csv' }); 
        const url = URL.createObjectURL(blob); 
        const a=document.createElement('a'); 
        a.href=url; 
        a.download=`${table}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
        URL.revokeObjectURL(url);
        Alpine.store('toasts').pushSimple('CSV exported','📤','');
      } catch(e){ 
        console.error(e); 
        Alpine.store('toasts').pushSimple('CSV export failed','❌', e.message || 'Unknown error'); 
      }
    },

    /**
     * Exports the locally loaded activity logs array to a CSV file.
     */
    exportLogsCSV(){
      try {
        const logs = this.activity_logs || [];
        if(!logs.length){ 
          Alpine.store('toasts').pushSimple('No Logs','⚠️', 'No activity logs to export.'); 
          return; 
        }
        
        // FIX: Ensure multiline text (common in logs 'action' or 'details') is flat before quoting
        const rows = logs.map(l => [ 
          l.id, 
          l.user_role, 
          l.user_name, 
          (l.action||'').replace(/[\r\n]+/g,' '), // Strips newlines
          (l.details||'').replace(/[\r\n]+/g,' '), // Strips newlines
          l.created_at 
        ]);
        
        const headers = ['id','user_role','user_name','action','details','created_at'];
        // Quote and escape inner quotes for CSV format
        const csv = [ 
          headers.join(','), 
          ...rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')) 
        ].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' }); 
        const url = URL.createObjectURL(blob); 
        const a=document.createElement('a'); 
        a.href = url; 
        a.download = `activity_logs_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
        URL.revokeObjectURL(url);
        Alpine.store('toasts').pushSimple('Logs exported','📤','');
      } catch(e){ 
        console.error(e); 
        Alpine.store('toasts').pushSimple('Logs CSV failed','❌', e.message || 'Unknown error'); 
      }
    },
    
    /* init: run after Alpine loads */
    async initApp() {
      try {
        // load settings first
        await this.loadSettings();
        await Promise.all([
          this.fetchSupervisors(),
          this.fetchAgents(),
          this.fetchPOS(),
          this.fetchActivityLogs()
        ]);
      } catch (e) {
        console.warn('data load error', e);
      }

      function renderIcons() {
        if(window.lucide) lucide.createIcons();
      }
      // Re-render icons after initial data load
      renderIcons();
      // Also watch for Alpine updates that add new DOM elements
      document.addEventListener('alpine:updated', renderIcons);

      this.updateCounts();
      this.setupRealtime();

      // protect against chart errors
      try {
        this.$nextTick(() => this.initChart());
      } catch (err) {
        console.warn('chart init skipped:', err);
      }
      this.syncToastStore();
      
      // Initialize greeting & time
      updateGreetingAndTime();
      setInterval(updateGreetingAndTime, 1000);
    },
// ... inside the return { ... } block of your function app()

// --- New Export Wrappers for Report View ---

/**
 * Exports the locally selected agents (agentsPerSupervisor report) to PDF.
 */
exportAgentsPerSupervisorPDF() {
    try {
        const data = this.selectedSupervisorAgents || []; // Use the local array
        if(!data.length){ 
            Alpine.store('toasts').pushSimple('No Data','⚠️', 'No agents selected for export.'); 
            return; 
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const supervisor = this.agentsPerSupervisor.find(g => g.supervisor_id == this.selectedSupervisorId)?.supervisor || 'N/A';
        const filename = `Agents_${supervisor}_Report.pdf`;

        // 1. Format data for autoTable
        const headers = ['Agent ID', 'Name', 'Contact', 'Location'];
        const body = data.map(a => [ 
            a.agent_id, 
            a.name, 
            a.contact, 
            a.location 
        ]);
        
        // 2. Add title and table to PDF
        doc.text(`Agents Report for Supervisor: ${supervisor}`, 14, 18);
        (doc).autoTable({ 
            startY: 24, 
            head: [headers], 
            body: body,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [56, 189, 248] }
        });

        // 3. Save and download file
        doc.save(filename);
        Alpine.store('toasts').pushSimple('PDF Report Generated','🧾', filename);
    } catch(e) {
        console.error('PDF export error:', e); 
        Alpine.store('toasts').pushSimple('PDF Export Failed','❌', e.message || 'Unknown error');
    }
},

/**
 * Exports the locally selected agents (agentsPerSupervisor report) to CSV.
 */
exportAgentsPerSupervisorCSV(){
    try {
        const data = this.selectedSupervisorAgents || [];
        if(!data.length){ 
            Alpine.store('toasts').pushSimple('No Data','⚠️', 'No agents selected for export.'); 
            return; 
        }

        const supervisor = this.agentsPerSupervisor.find(g => g.supervisor_id == this.selectedSupervisorId)?.supervisor || 'N/A';
        const filename = `Agents_${supervisor}_Report.csv`;

        // 1. Define headers and map data objects to an array of values
        const headers = ['agent_id','name','contact','location'];
        const rows = data.map(a => [ 
            a.agent_id, a.name, a.contact, a.location 
        ]);

        // 2. Format as CSV string (similar to exportLogsCSV)
        const csv = [ 
            headers.join(','), 
            // Quote and escape inner quotes
            ...rows.map(r => r.map(c => `"${String(c||'').replace(/"/g,'""')}"`).join(',')) 
        ].join('\n');

        // 3. Create and download file
        const blob = new Blob([csv], { type: 'text/csv' }); 
        const url = URL.createObjectURL(blob); 
        const a=document.createElement('a'); 
        a.href = url; 
        a.download = filename; 
        document.body.appendChild(a); 
        a.click(); 
        a.remove(); 
        URL.revokeObjectURL(url);
        
        Alpine.store('toasts').pushSimple('CSV Report Exported','📤', filename);
    } catch(e){ 
        console.error('CSV export error:', e);
        Alpine.store('toasts').pushSimple('CSV Export Failed','❌', e.message || 'Unknown error'); 
    }
},

// ... rest of your functions (e.g., initApp, fetchSupervisors, etc.)
    /* Chart initialization and fix for 'fullSize' error */
    initChart() {
      const ctx = document.getElementById('agentsChart');
      if (!ctx || !window.Chart) return;
      
      const chartData = this.supervisors.map(s => s.agent_count);
      const chartLabels = this.supervisors.map(s => s.name);
      const isBar = this.chartType === 'bar';

      if (this.chartAgents) {
        try { this.chartAgents.destroy(); } catch {}
      }

      this.chartAgents = new Chart(ctx, {
        type: this.chartType,
        data: {
          labels: chartLabels,
          datasets: [{
            label: 'Agents',
            data: chartData,
            backgroundColor: isBar ? 'rgba(56, 189, 248, 0.8)' : chartLabels.map(() => `hsl(${Math.random() * 360}, 70%, 50%)`),
            borderColor: isBar ? 'rgba(2, 132, 199, 1)' : '#fff',
            borderWidth: isBar ? 1 : 2,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          // **FIXED: Explicitly disable title/subtitle plugins to prevent layout error**
          plugins: {
            legend: { display: this.chartType === 'pie' ? true : 'top' },
            tooltip: { cornerRadius: 8 },
            title: { display: false },
            subtitle: { display: false }
          },
          scales: isBar ? {
            y: { beginAtZero: true },
            x: { grid: { display: false } }
          } : {}
        }
      });
    },

    toggleChartType() {
      if (this._isToggling) return;
      this._isToggling = true;

      this.chartType = this.chartType === 'bar' ? 'pie' : 'bar';
      localStorage.setItem('bst_chartType', this.chartType);

      if (this.chartAgents) {
        try { this.chartAgents.destroy(); } catch {}
        this.chartAgents = null;
      }

      setTimeout(() => {
        this.initChart();
        this._isToggling = false;
      }, 300);
    },

    updateChart() {
      if (this.chartAgents) {
        // Redraw chart if data is loaded, preventing full destroy/re-init
        this.chartAgents.data.labels = this.supervisors.map(s => s.name);
        this.chartAgents.data.datasets[0].data = this.supervisors.map(s => s.agent_count);
        this.chartAgents.update();
      } else {
        // If chart hasn't been initialized yet, do it now
        this.initChart();
      }
    },
    
    /* keep a live mirror of Alpine.store('toasts') into local toasts array for UI */
    syncToastStore() {
      try {
        // Ensure Alpine.store is available before trying to sync
        if (typeof Alpine.store !== 'function') return;

        // Initialize store if it doesn't exist
        if (!Alpine.store('toasts')) {
            Alpine.store('toasts', { items: [], pushSimple(title, emoji, message){ this.items.push({title, emoji, message}) } });
        }

        const store = Alpine.store('toasts');
        // reactive update - poll-based fallback
        setInterval(() => {
          if (JSON.stringify(this.toasts) !== JSON.stringify(store.items)) {
            this.toasts = [...store.items];
          }
        }, 500);
      } catch(e){}
    },

    /* navigation */
    nav(viewName){
      this.view = viewName;
      this.modalOpen = false;
      this.modalType = '';
      this.modalStep = 1;
      this.form = {};

      const titleMap = {
        dashboard:'Dashboard', supervisors:'Supervisors', agents:'Agents', pos:'POS Devices', logs:'Activity Logs', settings:'Settings', report:'Reports'
      };
      const subMap = {
        dashboard:'Enterprise POS — Internal Use Only', supervisors:'Manage and track field supervisors', agents:'Manage field agents', pos:'Track POS device inventory', logs:'View system activity log', settings:'Manage system settings and backups', report:'Generate and export data reports'
      };
      const t = titleMap[viewName] || 'Dashboard';
      const s = subMap[viewName] || '';
      const elTitle = document.getElementById('pageTitle');
      const elSub = document.getElementById('pageSub');
      if (elTitle) elTitle.innerText = t;
      if (elSub) elSub.innerText = s;
    },

    /* ---------- SERVER-SIDE: Supervisors (paging + sorting) ---------- */
    async fetchSupervisors(){
      try {
        const start = (this.supPage - 1) * this.supPageSize;
        const end = start + this.supPageSize - 1;
        const { data, error } = await this.supabase.from('supervisors')
          .select('*', { count: 'exact' })
          .ilike('name', `%${this.filterText || ''}%`)
          .order(this.supSortColumn, { ascending: this.supSortDir === 'asc' })
          .range(start, end);
        if(error) throw error;
        this.supervisors = data || [];
        // fetch total count separately (Supabase sometimes needs head:true)
        const cnt = await this.supabase.from('supervisors').select('supervisor_id',{ count: 'exact', head: true }).ilike('name', `%${this.filterText || ''}%`);
        this.supervisorsTotal = cnt.count || (data||[]).length;
        // derived fields
        await this.attachSupervisorDerived();
        // Update supervisor select for modals
        this.supSelect = this.supervisors || [];
        this.updateChart();
        this.updateCounts(); // Update counts after total is fetched
      } catch(e){ console.error('fetchSupervisors', e); this.notifyError('Fetch supervisors failed', e); }
    },

    // derived fields for supervisors
    async attachSupervisorDerived(){
      try {
        const { data: allAgents } = await this.supabase.from('agents').select('*');
        const { data: allPos } = await this.supabase.from('pos_devices').select('*');
        this.all_agents = allAgents || [];
        this.pos_devices = (allPos || []).map(p => ({ ...p }));
        for(const s of this.supervisors){
          s.agent_count = (this.all_agents || []).filter(a => a.supervisor_id === s.supervisor_id).length;
          s.pos_assigned = (this.pos_devices || []).filter(p => {
            const ag = this.all_agents.find(x => x.agent_id === p.agent_id);
            return ag && ag.supervisor_id === s.supervisor_id;
          }).length;
        }
      } catch(e){ console.error('attachSupervisorDerived', e);}
    },

    changeSort(column, which){
      if(which === 'supervisors'){
        if(this.supSortColumn === column) this.supSortDir = this.supSortDir === 'asc' ? 'desc' : 'asc';
        else { this.supSortColumn = column; this.supSortDir = 'asc'; }
        this.fetchSupervisors();
      } else {
        if(this.agtSortColumn === column) this.agtSortDir = this.agtSortDir === 'asc' ? 'desc' : 'asc';
        else { this.agtSortColumn = column; this.agtSortDir = 'asc'; }
        this.fetchAgents();
      }
    },

    changePage(direction, which){
      if(which==='supervisors'){
        if(direction==='next') this.supPage++; else if(direction==='prev' && this.supPage>1) this.supPage--;
        this.fetchSupervisors();
      } else {
        if(direction==='next') this.agtPage++; else if(direction==='prev' && this.agtPage>1) this.agtPage--;
        this.fetchAgents();
      }
    },

    get supervisorsCountDisplay(){ return `${Math.min(this.supPage * this.supPageSize, this.supervisorsTotal || this.supervisors.length)} / ${this.supervisorsTotal || this.supervisors.length}`; },

    /* ---------- SERVER-SIDE: Agents (paging + sorting) ---------- */
    async fetchAgents(){
      try {
        const start = (this.agtPage - 1) * this.agtPageSize;
        const end = start + this.agtPageSize - 1;
        const { data, error } = await this.supabase.from('agents').select('*,supervisor:supervisor_id(name)').ilike('name', `%${this.filterText||''}%`).order(this.agtSortColumn, { ascending: this.agtSortDir==='asc' }).range(start, end);
        if(error) throw error;
        this.agents = (data || []).map(a => ({ ...a, supervisor_name: a.supervisor?.name || '' }));
        const cnt = await this.supabase.from('agents').select('agent_id',{ count:'exact', head:true }).ilike('name', `%${this.filterText||''}%`);
        this.agentsTotal = cnt.count || (data||[]).length;
        // Also update all_agents for POS modal if needed
        this.all_agents = (await this.supabase.from('agents').select('*')).data || [];
        this.updateCounts(); // Update counts after total is fetched
      } catch(e){ console.error('fetchAgents', e); this.notifyError('Fetch agents failed', e); }
    },

    get agentsCountDisplay(){ return `${Math.min(this.agtPage * this.agtPageSize, this.agentsTotal || this.agents.length)} / ${this.agentsTotal || this.agents.length}`; },

    /* ---------- POS & Logs ---------- */
    async fetchPOS(){
      try {
        const { data, error } = await this.supabase.from('pos_devices').select('*,agent_id(name,agent_id)').order('serial_number');
        if(error) throw error;
        this.pos_devices = (data || []).map(p => ({ ...p, agent_name: p.agent_id ? p.agent_id.name : '' }));
        this.updateCounts(); // Update counts after total is fetched
      } catch(e){ console.error('fetchPOS', e); this.notifyError('Fetch POS failed', e); }
    },

    async fetchActivityLogs(){
      try {
        const { data, error } = await this.supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000);
        if(error) throw error;
        this.activity_logs = data || [];
      } catch(e){ console.error('fetchActivityLogs', e); this.notifyError('Fetch logs failed', e); }
    },

    applyLogsFilter(){}, // client-side filtered via getter

    get filteredActivityLogs(){
      if(!this.logsFilter) return this.activity_logs;
      const filter = this.logsFilter.toLowerCase();
      return this.activity_logs.filter(l => 
        (l.action||'').toLowerCase().includes(filter) || 
        (l.details||'').toLowerCase().includes(filter) ||
        (l.user_name||'').toLowerCase().includes(filter)
      );
    },

    applySearch(){ this.supPage=1; this.agtPage=1; this.fetchSupervisors(); this.fetchAgents(); },

    async refreshAll(){ await Promise.all([ this.fetchSupervisors(), this.fetchAgents(), this.fetchPOS(), this.fetchActivityLogs() ]); this.updateCounts(); this.updateChart(); },

    updateCounts(){ this.counts.supervisors = this.supervisorsTotal || this.supervisors.length; this.counts.agents = this.agentsTotal || this.agents.length; this.counts.pos = this.pos_devices.length; },

    /* ---------- MODALS ---------- */
    openModal(type, payload=null){
      this.modalType = type; this.modalStep = 1;
      this.form = payload ? JSON.parse(JSON.stringify(payload)) : {};
      this.modalTitle = ({ addSupervisor:'Add Supervisor', editSupervisor:'Edit Supervisor', addAgent:'Add Agent', editAgent:'Edit Agent', addPOS:'Add POS', editPOS:'Edit POS' })[type] || '';
      this.modalSubtitle = 'Step 1 — Details';
      this.modalOpen = true;
      if (type.includes('Agent')) {
          this.supSelect = this.supervisors.length ? this.supervisors : [];
      }
    },

    closeModal(){ this.modalOpen=false; this.modalType=''; this.modalStep=1; this.form={}; this.modalTitle=''; this.modalSubtitle=''; },

    nextModalStep(){ if(this.modalStep<2){ this.modalStep++; this.modalSubtitle='Step 2 — Confirm'; } },
    prevModalStep(){ if(this.modalStep>1){ this.modalStep--; this.modalSubtitle='Step 1 — Details'; } },

    /* ---------- Supervisor CRUD ---------- */
    async addSupervisorConfirm(){
      if(!this.form.name) return alert('Name required');
      try {
        const { error } = await this.supabase.from('supervisors').insert([{ name: this.form.name, region: this.form.region }]);
        if(error) throw error;
        await this.logActivity('Added supervisor', `Name: ${this.form.name}`);
        Alpine.store('toasts').pushSimple('Supervisor added','👥', this.form.name);
        this.closeModal(); this.fetchSupervisors(); this.fetchAgents(); this.fetchPOS();
      } catch(e){ alert(e.message || 'Failed to add supervisor'); console.error(e); }
    },

    async updateSupervisorConfirm(){
      if(!this.form.name) return alert('Name required');
      try {
        const { error } = await this.supabase.from('supervisors').update({ name: this.form.name, region: this.form.region }).eq('supervisor_id', this.form.supervisor_id);
        if(error) throw error;
        await this.logActivity('Edited supervisor', `ID: ${this.form.supervisor_id}`);
        Alpine.store('toasts').pushSimple('Supervisor updated','✏️', this.form.name);
        this.closeModal(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to update supervisor'); console.error(e); }
    },

    confirmDeleteSupervisor(id){ if(confirm('Delete supervisor?')) this.deleteSupervisor(id); },

    async deleteSupervisor(id){
      try {
        const { error } = await this.supabase.from('supervisors').delete().eq('supervisor_id', id);
        if(error) throw error;
        await this.logActivity('Deleted supervisor', `ID: ${id}`);
        Alpine.store('toasts').pushSimple('Supervisor deleted','🗑️', `ID: ${id}`);
        this.fetchSupervisors(); this.fetchAgents(); this.fetchPOS();
      } catch(e){ alert(e.message || 'Failed to delete supervisor'); console.error(e); }
    },

    /* ---------- Agent CRUD ---------- */
    async addAgentConfirm(){
      if(!this.form.name || !this.form.supervisor_id) return alert('Name & Supervisor required');
      try {
        const { error } = await this.supabase.from('agents').insert([{ name: this.form.name, contact: this.form.contact, location: this.form.location, supervisor_id: this.form.supervisor_id }]);
        if(error) throw error;
        await this.logActivity('Added agent', `Name: ${this.form.name}`);
        Alpine.store('toasts').pushSimple('Agent added','👤', this.form.name);
        this.closeModal(); this.fetchAgents(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to add agent'); console.error(e); }
    },

    async updateAgentConfirm(){
      try {
        const { error } = await this.supabase.from('agents').update({ name: this.form.name, contact: this.form.contact, location: this.form.location, supervisor_id: this.form.supervisor_id }).eq('agent_id', this.form.agent_id);
        if(error) throw error;
        await this.logActivity('Edited agent', `ID: ${this.form.agent_id}`);
        Alpine.store('toasts').pushSimple('Agent updated','✏️', this.form.name);
        this.closeModal(); this.fetchAgents(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to update agent'); console.error(e); }
    },

    confirmDeleteAgent(id){ if(confirm('Delete agent?')) this.deleteAgent(id); },

    async deleteAgent(id){
      try {
        const { error } = await this.supabase.from('agents').delete().eq('agent_id', id);
        if(error) throw error;
        await this.logActivity('Deleted agent', `ID: ${id}`);
        Alpine.store('toasts').pushSimple('Agent deleted','🗑️', `ID: ${id}`);
        this.fetchAgents(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to delete agent'); console.error(e); }
    },

    /* ---------- POS CRUD ---------- */
    async addPOSConfirm(){
      if(!this.form.serial_number) return alert('Serial required');
      try {
        const { error } = await this.supabase.from('pos_devices').insert([{ serial_number: this.form.serial_number, agent_id: this.form.agent_id || null, date_issued: null, status: this.form.status || 'Available', condition: this.form.condition || 'Good', notes: this.form.notes || '' }]);
        if(error) throw error;
        await this.logActivity('Added POS', `Serial: ${this.form.serial_number}`);
        Alpine.store('toasts').pushSimple('POS added','📦', this.form.serial_number);
        this.closeModal(); this.fetchPOS(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to add POS'); console.error(e); }
    },

    async updatePOSConfirm(){
      try {
        const { error } = await this.supabase.from('pos_devices').update({ serial_number: this.form.serial_number, agent_id: this.form.agent_id || null, status: this.form.status, condition: this.form.condition, notes: this.form.notes || '' }).eq('pos_id', this.form.pos_id);
        if(error) throw error;
        await this.logActivity('Edited POS', `POS ID: ${this.form.pos_id}`);
        Alpine.store('toasts').pushSimple('POS updated','📦', this.form.serial_number);
        this.closeModal(); this.fetchPOS(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to update POS'); console.error(e); }
    },

    confirmDeletePOS(id){ if(confirm('Delete POS?')) this.deletePOS(id); },

    async deletePOS(id){
      try {
        const { error } = await this.supabase.from('pos_devices').delete().eq('pos_id', id);
        if(error) throw error;
        await this.logActivity('Deleted POS', `POS ID: ${id}`);
        Alpine.store('toasts').pushSimple('POS deleted','📦', `ID: ${id}`);
        this.fetchPOS(); this.fetchSupervisors();
      } catch(e){ alert(e.message || 'Failed to delete POS'); console.error(e); }
    },

    /* ---------- Activity logs & Notifications ---------- */
    async logActivity(action, details=''){
      try { await this.supabase.from('activity_logs').insert([{ user_role:'ICT', user_name:this.settings.admin_name||'ICT', action, details }]); } catch(e){ console.error(e); }
      this.fetchActivityLogs();
    },

    /* ---------- Realtime (Supabase Realtime channels) ---------- */
    setupRealtime(){
      try {
        // Ensure supabase is available
        if(!this.supabase) return;
        
        const channel = this.supabase.channel('realtime-ict')
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'activity_logs' }, payload => {
            try { Alpine.store('toasts').pushSimple(payload.new.action || 'Activity','🧾', payload.new.details || ''); } catch {}
            this.fetchActivityLogs();
          })
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'supervisors' }, payload => {
            try { Alpine.store('toasts').pushSimple('Supervisor added','👥', payload.new.name || ''); } catch {}
            this.fetchSupervisors();
          })
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'agents' }, payload => {
            try { Alpine.store('toasts').pushSimple('Agent added','👤', payload.new.name || ''); } catch {}
            this.fetchAgents();
          })
          .on('postgres_changes', { event:'INSERT', schema:'public', table:'pos_devices' }, payload => {
            try { Alpine.store('toasts').pushSimple('POS added','📦', payload.new.serial_number || ''); } catch {}
            this.fetchPOS();
          })
          .subscribe();
      } catch(e){ console.warn('Realtime setup failed', e); }
    },

    /* ---------- SETTINGS & BACKUP ---------- */
    async loadSettings(){ try { const { data } = await this.supabase.from('settings').select('*').eq('id',1).maybeSingle(); if(data) this.settings = { ...this.settings, ...data }; } catch(e){ console.warn('loadSettings', e); } },
    async saveSettings(){ try { await this.supabase.from('settings').upsert([{ id:1, admin_name:this.settings.admin_name, email:this.settings.email, theme:this.settings.theme, notifications:this.settings.notifications }], { onConflict:'id' }); Alpine.store('toasts').pushSimple('Settings saved','⚙️',''); await this.logActivity('Updated settings', `Admin: ${this.settings.admin_name}`); } catch(e){ alert('Error saving settings'); console.error(e); } },

    async exportBackupJSON(){
      try {
        const [supRes, agRes, posRes, reqRes, logsRes] = await Promise.all([
          this.supabase.from('supervisors').select('*'),
          this.supabase.from('agents').select('*'),
          this.supabase.from('pos_devices').select('*'),
          this.supabase.from('pos_requests').select('*'),
          this.supabase.from('activity_logs').select('*')
        ]);
        const payload = { supervisors: supRes.data||[], agents: agRes.data||[], pos_devices: posRes.data||[], pos_requests: reqRes.data||[], activity_logs: logsRes.data||[], settings: this.settings };
        const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
        const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`backup_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        Alpine.store('toasts').pushSimple('Backup downloaded','📥','');
      } catch(e){ alert('Backup failed'); console.error(e); }
    },

    async fetchAgentsPerSupervisor() {
      try {
        const { data: supervisors, error: supErr } = await this.supabase
          .from('supervisors')
          .select('supervisor_id, name');
        if (supErr) throw supErr;

        const { data: agents, error: agErr } = await this.supabase
          .from('agents')
          .select('agent_id, name, contact, supervisor_id');
        if (agErr) throw agErr;

        this.agentsPerSupervisor = supervisors.map(s => {
          return {
            supervisor_id: s.supervisor_id,
            supervisor: s.name,
            agents: agents.filter(a => a.supervisor_id === s.supervisor_id)
          }
        });
        // Set default selection if none is selected
        if (!this.selectedSupervisorId && this.agentsPerSupervisor.length > 0) {
            this.selectedSupervisorId = this.agentsPerSupervisor[0].supervisor_id;
        }
      } catch(e) {
        console.error('fetchAgentsPerSupervisor', e);
        this.notifyError('Failed to fetch report', e);
      }
    },

    /* ---------- Helpers ---------- */
    notifyError(title, e){ 
      try { 
          // Ensure Alpine store for toasts is initialized before pushing
          if (typeof Alpine.store !== 'function' || !Alpine.store('toasts')) return;
          Alpine.store('toasts').pushSimple(title,'⚠️', (e && e.message) ? e.message : String(e)); 
      } catch(e2){} 
    },

    // Wrapper functions for UI
    confirmDeleteSupervisor(id){ if(confirm('Delete supervisor?')) this.deleteSupervisor(id); },
    confirmDeleteAgent(id){ if(confirm('Delete agent?')) this.deleteAgent(id); },
    confirmDeletePOS(id){ if(confirm('Delete POS?')) this.deletePOS(id); }
  
  };
}

// Expose app() to the global window object for Alpine to initialize
window.app = app;


// 3. Floating AI Chat Logic (Consolidated/Cleaned)
document.addEventListener('DOMContentLoaded', () => {
    // --- AI Chat Logic ---
    const openBtn = document.getElementById("openAIButton");
    const closeBtn = document.getElementById("closeAIButton");
    const chatWindow = document.getElementById("aiChatWindow");
    const chatOutput = document.getElementById("chatOutput");
    const chatInput = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");

    if (!openBtn || !chatWindow || !chatOutput || !chatInput || !sendBtn) return; // Exit if chat UI is not present

    // Static context (should be dynamically pulled from Alpine.js state in a full app)
    const context = {
        supervisors: [
            { id: 1, name: "John Doe" },
            { id: 2, name: "Jane Smith" }
        ],
        agents: [
            { id: 101, name: "Agent A", supervisor_id: 1 },
            { id: 102, name: "Agent B", supervisor_id: 2 }
        ],
        devices: [
            { id: 1001, agent_id: 101, serial: "POS-001" },
            { id: 1002, agent_id: 102, serial: "POS-002" }
        ]
    };

    // Open/Close AI Window
    openBtn.addEventListener("click", () => {
        chatWindow.style.display = "flex";
        if (window.lucide) window.lucide.createIcons(); // Re-render Lucide icons
    });
    closeBtn.addEventListener("click", () => chatWindow.style.display = "none");

    // Function to create bubble (The superior, bubble-style version)
    function addBubble(text, sender) {
        const bubble = document.createElement("div");
        bubble.textContent = text;
        bubble.style.padding = "8px 12px";
        bubble.style.borderRadius = "15px";
        bubble.style.maxWidth = "80%";
        bubble.style.wordWrap = "break-word";
        bubble.style.alignSelf = sender === "user" ? "flex-end" : "flex-start";
        bubble.style.background = sender === "user" ? "#007bff" : "#333";
        bubble.style.color = sender === "user" ? "#fff" : "#fff";
        chatOutput.appendChild(bubble);
        chatOutput.scrollTop = chatOutput.scrollHeight;
    }

    // Send Message
    sendBtn.addEventListener("click", async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        addBubble(message, "user");
        chatInput.value = "";

        try {
            // NOTE: This relies on an external server running at http://localhost:3000/ask
            const res = await fetch("http://localhost:3000/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, context })
            });
            const data = await res.json();
            addBubble(data.reply, "assistant");
        } catch (err) {
            // This handles the ERR_CONNECTION_REFUSED error
            addBubble("Sorry, I am still under development. (Error: Connection Refused to http://localhost:3000)", "assistant");
        }
    });

    // Enter key support
    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendBtn.click();
    });
});