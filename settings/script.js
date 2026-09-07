document.addEventListener('DOMContentLoaded', async () => {
    const closeBtn = document.getElementById('closeBtn');
    const backdrop = document.getElementById('backdrop');
    const modal = document.getElementById('modal');
    const navItems = document.querySelectorAll('.nav-item');
    const settingsSections = document.querySelectorAll('.settings-section');
    const sectionTitle = document.getElementById('section-title');
    const themesGrid = document.getElementById('themesGrid');
    const presetsGrid = document.getElementById('presetsGrid');
    const saveCustomBtn = document.getElementById('saveCustomBtn');
    
    const customBg = document.getElementById('customBg');
    const customText = document.getElementById('customText');
    const customAccent = document.getElementById('customAccent');
    const customPanel = document.getElementById('customPanel');
    const customSidebar = document.getElementById('customSidebar');

    navItems.forEach(item => {
        item.addEventListener('click', async () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            settingsSections.forEach(sec => sec.classList.remove('active'));

            item.classList.add('active');
            sectionTitle.textContent = item.textContent;

            const targetId = item.getAttribute('data-target');
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }

            const fileUrl = item.getAttribute('data-file');
            if (fileUrl && targetSection && !targetSection.dataset.loaded) {
                try {
                    targetSection.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;">Loading document...</div>';
                    const res = await fetch(fileUrl);
                    if (res.ok) {
                        const htmlText = await res.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(htmlText, 'text/html');
                        const bodyContent = doc.body.innerHTML || htmlText;
                        targetSection.innerHTML = bodyContent;
                        targetSection.dataset.loaded = "true";
                    } else {
                        targetSection.innerHTML = '<p style="color:var(--text-secondary);">Document not found.</p>';
                    }
                } catch (err) {
                    targetSection.innerHTML = '<p style="color:var(--text-secondary);">Failed to load document content.</p>';
                }
            }
        });
    });

    const closeModal = () => {
        backdrop.style.opacity = '0';
        modal.style.transform = 'scale(0.92) translateY(16px)';
        setTimeout(() => {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ action: 'closeSettings' }, '*');
            } else {
                window.history.back();
            }
        }, 200);
    };

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
    });

    try {
        const themeRes = await fetch('themes.json');
        const themes = await themeRes.json();
        const activeThemeName = localStorage.getItem('celsius_theme_name') || 'Winter Frost';

        themes.forEach(theme => {
            const card = document.createElement('div');
            card.className = `theme-card ${activeThemeName === theme.name ? 'active' : ''}`;
            card.innerHTML = `
                <div class="theme-preview-box" style="background-color: ${theme.bg}; color: ${theme.text};">
                    <span style="background: ${theme.accent}; width: 16px; height: 16px; border-radius: 50%; display: inline-block;"></span>
                    <span class="theme-check">✓</span>
                </div>
                <div class="theme-name">${theme.name}</div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                localStorage.setItem('celsius_theme_name', theme.name);
                localStorage.setItem('celsius_theme', JSON.stringify(theme));
                applySettings();
            });

            themesGrid.appendChild(card);
        });
    } catch (e) {
        themesGrid.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">Unable to load themes.</p>';
    }

    try {
        const presetRes = await fetch('presets.json');
        const presetData = await presetRes.json();
        const activePreset = localStorage.getItem('celsius_preset') || '';

        presetData.presets.forEach(preset => {
            const card = document.createElement('div');
            card.className = `preset-card ${activePreset === preset.file ? 'active' : ''}`;
            card.innerHTML = `
                <img src="../preset/${preset.file}" alt="${preset.name}" class="preset-thumbnail" onerror="this.style.display='none'">
                <div class="preset-name">${preset.name}</div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                localStorage.setItem('celsius_preset', preset.file);
                applySettings();
            });

            presetsGrid.appendChild(card);
        });
    } catch (e) {
        presetsGrid.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">Unable to load background presets.</p>';
    }

    saveCustomBtn.addEventListener('click', () => {
        const customTheme = {
            name: "Custom Theme",
            bg: customBg.value,
            text: customText.value,
            accent: customAccent.value,
            panel: customPanel.value,
            sidebar: customSidebar.value
        };

        localStorage.setItem('celsius_theme_name', "Custom Theme");
        localStorage.setItem('celsius_theme', JSON.stringify(customTheme));
        
        document.querySelectorAll('.theme-card').forEach(c => {
            if (c.querySelector('.theme-name').textContent === "Custom Theme") {
                c.classList.add('active');
            } else {
                c.classList.remove('active');
            }
        });

        applySettings();
        alert("Custom theme applied successfully!");
    });

    function applySettings() {
        const targetWindow = window.parent && window.parent !== window ? window.parent : window;
        targetWindow.postMessage({ action: 'updateSettings' }, '*');
        const preset = localStorage.getItem('celsius_preset');
        if (preset) {
            document.body.style.backgroundImage = `url('../preset/${preset}')`;
        }
    }

    const currentPreset = localStorage.getItem('celsius_preset');
    if (currentPreset) {
        document.body.style.backgroundImage = `url('../preset/${currentPreset}')`;
    }
});
