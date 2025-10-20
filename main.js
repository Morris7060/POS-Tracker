// main.js — Blue Star Assistant + Chart.js safety patch
// Place this file in the same folder as index.html and include it as <script src="main.js"></script> before </body>.

// Wrap everything so page doesn't error if elements are missing
document.addEventListener("DOMContentLoaded", () => {
  // -------- Chart.js safety patch --------
  // If Chart is loaded, wrap Chart.prototype.update to catch plugin errors (prevents "fullSize" crash)
  if (window.Chart && Chart.prototype && !Chart.prototype._bst_patched) {
    const originalUpdate = Chart.prototype.update;
    Chart.prototype.update = function(...args) {
      try {
        return originalUpdate.apply(this, args);
      } catch (err) {
        // Log once with detail, but avoid noisy repeated logs
        if (!Chart.prototype._bst_loggedChartError) {
          console.warn("Chart update error suppressed (plugin conflict). See details:", err);
          Chart.prototype._bst_loggedChartError = true;
        }
        return null;
      }
    };
    Chart.prototype._bst_patched = true;
  }

  // -------- Assistant DOM references --------
  const openBtn = document.getElementById("openBtnAssistant");
  const chatPanel = document.getElementById("chatPanel");
  const closeBtn = document.getElementById("closeBtnAssistant");
  const chatMessages = document.getElementById("chatMessages");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtnAssistant");
  const typingIndicator = document.getElementById("typingIndicator");

  // If core elements not present, do nothing (prevents console errors)
  if (!openBtn || !chatPanel || !closeBtn || !chatMessages || !chatInput || !sendBtn) {
    console.warn("Blue Star Assistant elements not found — assistant disabled.");
    return;
  }

  // Helper: safely append message bubble
  function addBubble(text, from = "assistant") {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.maxWidth = "100%";
    wrapper.style.justifyContent = from === "user" ? "flex-end" : "flex-start";

    const bubble = document.createElement("div");
    bubble.textContent = text;
    bubble.style.padding = "8px 12px";
    bubble.style.borderRadius = "12px";
    bubble.style.maxWidth = "78%";
    bubble.style.wordBreak = "break-word";
    bubble.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
    bubble.style.background = from === "user" ? "#0ea5e9" : "#1f1f26";
    bubble.style.color = "#fff";
    bubble.style.fontSize = "13px";
    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTyping() {
    if (typingIndicator) typingIndicator.style.display = "flex";
  }
  function hideTyping() {
    if (typingIndicator) typingIndicator.style.display = "none";
  }

  // Open/close behavior
  openBtn.addEventListener("click", () => {
    chatPanel.classList.remove("hidden");
    chatPanel.setAttribute("aria-hidden", "false");
    chatInput.focus();
  });
  closeBtn.addEventListener("click", () => {
    chatPanel.classList.add("hidden");
    chatPanel.setAttribute("aria-hidden", "true");
  });

  // Helper: extract POS context from DOM (reads tables if present; safe-if-missing)
  function getPOSContext() {
    // Supervisors table rows should be <tr data-id="..."> and have a .name cell
    const supervisors = Array.from(document.querySelectorAll("#supervisorsTable tr[data-id]")).map(r => ({
      id: r.dataset.id,
      name: (() => { const el = r.querySelector(".name"); return el ? el.textContent.trim() : (r.querySelector("td") ? r.querySelector("td").textContent.trim() : ""); })()
    }));

    const agents = Array.from(document.querySelectorAll("#agentsTable tr[data-id]")).map(r => ({
      id: r.dataset.id,
      name: (() => { const el = r.querySelector(".name"); return el ? el.textContent.trim() : ""; })(),
      supervisor_id: (() => { const el = r.querySelector(".supervisor"); return el ? el.dataset.supId || el.textContent.trim() : null; })()
    }));

    const devices = Array.from(document.querySelectorAll("#posTable tr[data-id]")).map(r => ({
      id: r.dataset.id,
      serial: (() => { const el = r.querySelector(".serial") || r.querySelector("td"); return el ? el.textContent.trim() : ""; })(),
      agent_id: (() => { const el = r.querySelector(".agent"); return el ? el.dataset.agentId || el.textContent.trim() : null; })()
    }));

    // Fallbacks if tables not found
    return {
      supervisors: supervisors.length ? supervisors : (window.suppliersContext || []),
      agents: agents.length ? agents : (window.agentsContext || []),
      devices: devices.length ? devices : (window.devicesContext || [])
    };
  }

  // Debounced send (prevents double-submits)
  let sending = false;

  async function sendMessageToServer(message) {
    if (!message || sending) return;
    sending = true;
    addBubble(message, "user");
    showTyping();

    const context = getPOSContext();

    try {
      const resp = await fetch("http://localhost:3000/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context })
      });

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      hideTyping();
      addBubble(data.reply || "No response from assistant.", "assistant");
    } catch (err) {
      hideTyping();
      addBubble("Sorry, the assistant failed to respond. Check server or network.", "assistant");
      console.error("Assistant error:", err);
    } finally {
      sending = false;
    }
  }

  // UI event listeners
  sendBtn.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    sendMessageToServer(text);
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Simple typing dots animation (update text every 400ms)
  (function animateTypingDots() {
    const dotsEl = document.getElementById("typingDots");
    if (!dotsEl) return;
    let step = 0;
    setInterval(() => {
      step = (step + 1) % 4;
      dotsEl.textContent = step === 0 ? "•" : step === 1 ? "• •" : step === 2 ? "• • •" : "• •";
    }, 400);
  })();

  // Expose a debug helper on window so you can test quickly in console:
  window._bst_assistant = {
    sendTest: (msg) => sendMessageToServer(msg),
    getContext: getPOSContext
  };
});
// Ensure DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Get canvas context
  const ctx = document.getElementById('myChart');
  if (!ctx) return; // Exit if canvas not found

  // Initial chart data with safe fallbacks
  const initialData = {
    labels: [], // start empty
    datasets: [
      {
        label: 'Sales',
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Chart configuration
  const config = {
    type: 'bar',
    data: initialData,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
        },
        subtitle: {
          display: true,
          text: 'Monthly Sales',
        },
      },
      layout: {
        padding: {
          top: 10,
          bottom: 10,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };

  // Create Chart instance
  const myChart = new Chart(ctx, config);

  // Function to safely update chart data
  window.updateChart = function (newLabels = [], newData = []) {
    if (!Array.isArray(newLabels) || !Array.isArray(newData)) return;

    // Ensure datasets exist
    if (!myChart.data.datasets || myChart.data.datasets.length === 0) {
      myChart.data.datasets = [{ label: 'Sales', data: [] }];
    }

    myChart.data.labels = newLabels;
    myChart.data.datasets[0].data = newData;

    // Optional: update subtitle safely
    if (myChart.options.plugins.subtitle) {
      myChart.options.plugins.subtitle.text = 'Updated Monthly Sales';
    }

    myChart.update();
  };

  // Example usage: dynamically update chart after fetching data
  // updateChart(['Jan', 'Feb', 'Mar'], [1200, 1500, 1100]);
});
import { Chart, registerables } from 'chart.js';
import ChartSubtitle from 'chartjs-plugin-subtitle';

Chart.register(...registerables, ChartSubtitle);

document.addEventListener('DOMContentLoaded', () => {
  const ctx = document.getElementById('myChart');
  if (!ctx) return;

  const myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [],        // safe empty array
      datasets: [{
        label: 'Sales',
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        subtitle: {
          display: true,
          text: 'Monthly Sales'
        }
      },
      layout: { padding: 10 },
      scales: { y: { beginAtZero: true } }
    }
  });

  // Safe dynamic update
  window.updateChart = (labels = [], data = []) => {
    myChart.data.labels = Array.isArray(labels) ? labels : [];
    myChart.data.datasets[0].data = Array.isArray(data) ? data : [];
    if (myChart.options.plugins.subtitle) {
      myChart.options.plugins.subtitle.text = 'Updated Sales';
    }
    myChart.update();
  };
});
function agentsReport() {
  return {
    selectedSupervisorId: '',
    agentsPerSupervisor: [], // will be fetched from backend

    get selectedSupervisorAgents() {
      const group = this.agentsPerSupervisor.find(
        g => g.supervisor_id == this.selectedSupervisorId
      );
      return group ? group.agents : [];
    },

    fetchSupervisors() {
      // Replace with your backend API endpoint
      fetch('/api/supervisors-with-agents')
        .then(res => res.json())
        .then(data => {
          this.agentsPerSupervisor = data;
        })
        .catch(err => {
          console.error('Error fetching supervisors:', err);
        });
    },

    editAgent(agent) {
      alert(`Edit ${agent.name}`);
    },

    deleteAgent(agent) {
      if (!confirm(`Delete ${agent.name}?`)) return;
      const group = this.agentsPerSupervisor.find(
        g => g.supervisor_id == this.selectedSupervisorId
      );
      if (group) {
        group.agents = group.agents.filter(a => a.agent_id !== agent.agent_id);
      }
    },

    exportAgentsPerSupervisorPDF() {
      alert("Export PDF under development");
    },

    exportAgentsPerSupervisorCSV() {
      alert("Export CSV under development");
    },

    init() {
      this.fetchSupervisors(); // fetch data when component initializes
    }
  };
}
function initCharts() {
  // Example data
  const ctx = document.getElementById('desktopChart').getContext('2d');

  const desktopChart = new Chart(ctx, {
    type: 'bar', // or 'line', 'doughnut', etc.
    data: {
      labels: ['Supervisor A', 'Supervisor B', 'Supervisor C', 'Supervisor D'],
      datasets: [{
        label: 'Number of Agents',
        data: [5, 8, 3, 6],
        backgroundColor: ['#38bdf8', '#60a5fa', '#2563eb', '#1d4ed8'],
        borderColor: ['#0284c7', '#1e40af', '#1e3a8a', '#1e40af'],
        borderWidth: 1,
        hoverBackgroundColor: ['#0ea5e9', '#3b82f6', '#1e40af', '#1e3a8a']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: 'Agents per Supervisor',
          font: {
            size: 20,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        subtitle: {
          display: true,
          text: 'Click bars to see details',
          color: '#64748b',
          font: { size: 14 }
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.raw} agents`;
            }
          }
        },
        legend: {
          position: 'bottom',
          labels: {
            font: { size: 14 },
            boxWidth: 20
          }
        }
      },
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1
          },
          title: {
            display: true,
            text: 'Number of Agents',
            font: { weight: 'bold' }
          }
        },
        x: {
          title: {
            display: true,
            text: 'Supervisor',
            font: { weight: 'bold' }
          }
        }
      },
      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const supervisor = desktopChart.data.labels[index];
          alert(`Show detailed agents for ${supervisor}`); // placeholder, can open modal
        }
      }
    }
  });
}

// At the bottom of main.js
window.agentsReport = function() {
  return {
    selectedSupervisorId: '',
    agentsPerSupervisor: [],
    get selectedSupervisorAgents() {
      const group = this.agentsPerSupervisor.find(
        g => g.supervisor_id == this.selectedSupervisorId
      );
      return group ? group.agents : [];
    },
    fetchSupervisors() {
      fetch('/api/supervisors-with-agents')
        .then(res => res.json())
        .then(data => this.agentsPerSupervisor = data)
        .catch(err => console.error('fetchSupervisors', err));
    },
    editAgent(agent) { alert(`Edit ${agent.name}`); },
    deleteAgent(agent) {
      if (!confirm(`Delete ${agent.name}?`)) return;
      const group = this.agentsPerSupervisor.find(g => g.supervisor_id == this.selectedSupervisorId);
      if (group) group.agents = group.agents.filter(a => a.agent_id !== agent.agent_id);
    },
    exportAgentsPerSupervisorPDF() { alert("PDF export under development"); },
    exportAgentsPerSupervisorCSV() { alert("CSV export under development"); },
    init() { this.fetchSupervisors(); }
  };
};
