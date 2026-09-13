const tabsList = document.getElementById('tabsList');
const newTabBtn = document.getElementById('newTabBtn');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const appFrame = document.getElementById('appFrame');
const homeView = document.getElementById('homeView');
const urlInput = document.getElementById('urlInput');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const reloadBtn = document.getElementById('reloadBtn');

function applyCelsiusSettings() {
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
            document.body.style.backgroundColor = theme.bg;
            document.body.style.color = theme.text;
        } catch (e) {}
    }
    const currentPreset = localStorage.getItem('celsius_preset');
    if (currentPreset) {
        document.body.style.backgroundImage = `url('../preset/${currentPreset}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }
}
applyCelsiusSettings();

window.addEventListener('message', (event) => {
    if (event.data) {
        if (event.data.action === 'updateSettings') {
            applyCelsiusSettings();
            if (appFrame && appFrame.contentWindow) {
                try {
                    appFrame.contentWindow.postMessage({ action: 'updateTheme', theme: JSON.parse(localStorage.getItem('celsius_theme')) }, '*');
                } catch (e) {}
            }
        } else if (event.data.action === 'closeSettings') {
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.url === 'celsius://settings') {
                const closeBtn = activeTab.querySelector('.close-tab');
                if (closeBtn) closeBtn.click();
            }
        }
    }
});

function getIconSrc(url) {
    if (!url.startsWith('celsius://')) {
        try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; } catch { return '../favicon.ico'; }
    }
    let appName = url.replace('celsius://', '');
    if (appName === 'ai') appName = 'clanker';
    return appName === 'home' ? '../favicon.ico' : `../${appName}/favicon.ico`;
}

function saveTabsState() {
    const tabsData = Array.from(document.querySelectorAll('.tab')).map(tab => ({
        title: tab.querySelector('.tab-title').textContent,
        url: tab.dataset.url
    }));
    const activeTab = document.querySelector('.tab.active');
    localStorage.setItem('celsius_tabs_list', JSON.stringify(tabsData));
    localStorage.setItem('celsius_active_url', activeTab ? activeTab.dataset.url : 'celsius://home');
}

function restoreTabsState() {
    try {
        const saved = JSON.parse(localStorage.getItem('celsius_tabs_list'));
        const activeUrl = localStorage.getItem('celsius_active_url');
        if (saved && Array.isArray(saved) && saved.length > 0) {
            saved.forEach(item => createTab(item.title, item.url, false));
            const targetTab = Array.from(document.querySelectorAll('.tab')).find(t => t.dataset.url === activeUrl);
            if (targetTab) activateTab(targetTab);
            else activateTab(document.querySelector('.tab'));
            return;
        }
    } catch(e) {}
    createTab('Celsius Home', 'celsius://home', true);
}

function createTab(title = 'New Tab', url = 'celsius://home', autoActivate = true) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.url = url;
    tab.innerHTML = `
        <img src="${getIconSrc(url)}" alt="" class="tab-icon">
        <span class="tab-title">${title}</span>
        <button class="close-tab">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>`;

    tab.addEventListener('click', (e) => {
        if (!e.target.closest('.close-tab')) activateTab(tab);
    });

    tab.querySelector('.close-tab').addEventListener('click', () => {
        const wasActive = tab.classList.contains('active');
        tab.remove();
        const remainingTabs = document.querySelectorAll('.tab');
        if (remainingTabs.length > 0 && wasActive) {
            activateTab(remainingTabs[remainingTabs.length - 1]);
        } else if (remainingTabs.length === 0) {
            appFrame.style.display = 'none';
            homeView.style.display = 'flex';
            urlInput.value = '';
            sidebarLinks.forEach(l => l.classList.remove('active'));
            localStorage.removeItem('celsius_tabs_list');
        } else {
            saveTabsState();
        }
    });

    tabsList.appendChild(tab);
    if (autoActivate) activateTab(tab);
    saveTabsState();
}

function activateTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    updateContent(tab.dataset.url);
    saveTabsState();
}

function updateContent(appUrl) {
    urlInput.value = appUrl === 'celsius://home' ? '' : appUrl;
    sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.app === appUrl) link.classList.add('active');
    });

    if (appUrl === 'celsius://home') {
        appFrame.style.display = 'none';
        homeView.style.display = 'flex';
        appFrame.src = 'about:blank';
    } else if (appUrl.startsWith('celsius://')) {
        homeView.style.display = 'none';
        appFrame.style.display = 'block';
        let folderName = appUrl.replace('celsius://', '');
        if (folderName === 'ai') folderName = 'clanker';
        appFrame.src = '../' + folderName + '/index.html';
    } else {
        homeView.style.display = 'none';
        appFrame.style.display = 'block';
        if (window.scramjetReady && window.scramjetCtrl) {
            if (!window.scramjetFrame) window.scramjetFrame = window.scramjetCtrl.createFrame(appFrame);
            window.scramjetFrame.go(appUrl);
        } else {
            appFrame.src = appUrl;
        }
    }
}

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        let newUrl = urlInput.value.trim();
        if (!newUrl) return;
        if (!newUrl.startsWith('celsius://') && !newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = newUrl.includes('.') && !newUrl.includes(' ') ? 'https://' + newUrl : 'https://www.google.com/search?q=' + encodeURIComponent(newUrl);
        }
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) {
            activeTab.dataset.url = newUrl;
            let displayTitle = newUrl;
            try { displayTitle = new URL(newUrl).hostname; } catch(e){}
            activeTab.querySelector('.tab-title').textContent = displayTitle;
            activeTab.querySelector('.tab-icon').src = getIconSrc(newUrl);
            updateContent(newUrl);
            saveTabsState();
        } else {
            createTab(newUrl, newUrl, true);
        }
    }
});

newTabBtn.addEventListener('click', () => {
    createTab('Celsius Home', 'celsius://home', true);
});

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const appUrl = link.dataset.app;
        const existingTab = Array.from(document.querySelectorAll('.tab')).find(t => t.dataset.url === appUrl);
        if (existingTab) {
            activateTab(existingTab);
        } else {
            let appName = appUrl.replace('celsius://', '');
            const formattedTitle = appName.charAt(0).toUpperCase() + appName.slice(1);
            createTab(appName === 'home' ? 'Celsius Home' : formattedTitle, appUrl, true);
        }
    });
});

reloadBtn.addEventListener('click', () => {
    if (appFrame.style.display === 'block') {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab) updateContent(activeTab.dataset.url);
    }
});

fullscreenBtn.addEventListener('click', () => {
    const elem = document.documentElement;
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
        if (elem.requestFullscreen) elem.requestFullscreen();
        else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
        else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
    } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
    }
});

restoreTabsState();
