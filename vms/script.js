const BACKEND_URL = "https://celsius001vms.onrender.com";

const root = document.documentElement;
const savedTheme = localStorage.getItem('celsius_theme');
if (savedTheme) {
    try {
        const theme = JSON.parse(savedTheme);
        root.style.setProperty('--bg-main', theme.bg);
        root.style.setProperty('--text-primary', theme.text);
        root.style.setProperty('--accent-color', theme.accent);
        root.style.setProperty('--bg-panel', theme.panel);
        root.style.setProperty('--bg-sidebar', theme.sidebar);
    } catch (e) {}
}

window.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'updateTheme' || event.data.action === 'updateSettings')) {
        const theme = JSON.parse(localStorage.getItem('celsius_theme') || '{}');
        if (theme.bg) root.style.setProperty('--bg-main', theme.bg);
        if (theme.text) root.style.setProperty('--text-primary', theme.text);
        if (theme.accent) root.style.setProperty('--accent-color', theme.accent);
        if (theme.panel) root.style.setProperty('--bg-panel', theme.panel);
        if (theme.sidebar) root.style.setProperty('--bg-sidebar', theme.sidebar);
    }
});

const idleView = document.getElementById('idle-view');
const activeView = document.getElementById('active-view');
const launchBtn = document.getElementById('launchBtn');
const terminateBtn = document.getElementById('terminateBtn');
const capacityCount = document.getElementById('capacity-count');
const countdownTimer = document.getElementById('countdown-timer');
const homeBtn = document.getElementById('homeBtn');

let timerInterval = null;
let sessionSecondsLeft = 1500;
let activeSessionId = null;

async function checkCapacity() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/capacity`);
        const data = await response.json();
        capacityCount.textContent = data.activeCount || 0;
    } catch (e) {
        capacityCount.textContent = "0";
    }
}
checkCapacity();
setInterval(checkCapacity, 5000);

function startTimer() {
    sessionSecondsLeft = 1500;
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        sessionSecondsLeft--;
        updateTimerDisplay();
        if (sessionSecondsLeft <= 0) {
            clearInterval(timerInterval);
            terminateSession();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(sessionSecondsLeft / 60);
    const secs = sessionSecondsLeft % 60;
    countdownTimer.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

async function launchVM() {
    launchBtn.disabled = true;
    launchBtn.textContent = "Provisioning...";

    try {
        const response = await fetch(`${BACKEND_URL}/api/launch`, { method: 'POST' });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || "Global limit reached. Maximum 2 users can be connected at once.");
            launchBtn.disabled = false;
            launchBtn.textContent = "Launch VM";
            return;
        }

        activeSessionId = data.sessionId;
        idleView.style.display = 'none';
        activeView.style.display = 'flex';
        startTimer();
    } catch (e) {
        alert("Failed to connect to backend server.");
        launchBtn.disabled = false;
        launchBtn.textContent = "Launch VM";
    }
}

async function terminateSession() {
    if (timerInterval) clearInterval(timerInterval);

    if (activeSessionId) {
        try {
            await fetch(`${BACKEND_URL}/api/terminate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: activeSessionId })
            });
        } catch (e) {}
        activeSessionId = null;
    }

    activeView.style.display = 'none';
    idleView.style.display = 'flex';
    launchBtn.disabled = false;
    launchBtn.textContent = "Launch VM";
    checkCapacity();
}

window.addEventListener('beforeunload', () => {
    if (activeSessionId) {
        navigator.sendBeacon(`${BACKEND_URL}/api/terminate`, JSON.stringify({ sessionId: activeSessionId }));
    }
});

launchBtn.addEventListener('click', launchVM);
terminateBtn.addEventListener('click', terminateSession);

homeBtn.addEventListener('click', () => {
    const homeUrl = new URL('../index.html', window.location.href).href;
    if (window.top !== window) {
        window.top.location.href = homeUrl;
    } else {
        window.location.href = homeUrl;
    }
});
