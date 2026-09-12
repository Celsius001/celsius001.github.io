function applyCelsiusTheme() {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('celsius_theme');
    if (savedTheme) {
        try {
            const theme = JSON.parse(savedTheme);
            root.style.setProperty('--bg-main', theme.bg);
            root.style.setProperty('--text-primary', theme.text);
            root.style.setProperty('--bg-panel', theme.panel);
            root.style.setProperty('--accent-color', theme.accent);
            document.body.style.backgroundColor = theme.bg;
            document.body.style.color = theme.text;
        } catch (e) {}
    }
}

applyCelsiusTheme();

const videoContainer = document.getElementById('videoContainer');
const mediaFrame = document.getElementById('mediaFrame');
const statusOverlay = document.getElementById('videoPlaceholder');
const playerStatus = document.getElementById('playerStatus');

document.getElementById('backBtn').addEventListener('click', () => {
    window.location.href = 'index.html';
});

function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        type: params.get('type') || 'unknown',
        id: params.get('id') || '',
        title: params.get('title') || 'Unknown Title',
        poster: params.get('poster') || ''
    };
}

function updateStreamUrl(mediaData) {
    let embedUrl = "";

    if (mediaData.type === 'anime') {
        embedUrl = `https://vidsrc.sbs/embed/anime/${mediaData.id}`;
    } else if (mediaData.type === 'tv') {
        embedUrl = `https://vidsrc.sbs/embed/tv/${mediaData.id}`;
    } else {
        embedUrl = `https://vidsrc.sbs/embed/movie/${mediaData.id}`;
    }

    mediaFrame.src = embedUrl;
    mediaFrame.onload = () => {
        statusOverlay.style.opacity = '0';
        setTimeout(() => statusOverlay.style.display = 'none', 300);
    };
}

function initPlayer() {
    const mediaData = getQueryParams();
    document.getElementById('videoTitle').textContent = mediaData.title;
    document.title = `Playing: ${mediaData.title} - Celsius Watch`;

    if (mediaData.poster) {
        document.getElementById('playerBgBlur').style.backgroundImage = `url(${mediaData.poster})`;
    }

    playerStatus.textContent = `Connecting stream for "${mediaData.title}"...`;

    setTimeout(() => {
        updateStreamUrl(mediaData);
    }, 600);
}

let hideTimeout;
function resetHideTimer() {
    videoContainer.classList.remove('idle');
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        videoContainer.classList.add('idle');
    }, 3000);
}

window.addEventListener('mousemove', resetHideTimer);
window.addEventListener('keydown', resetHideTimer);

initPlayer();
