import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDj46RSodJ56rWwsxp9wh2x44hcZtBImxw",
    authDomain: "celsius-001.firebaseapp.com",
    projectId: "celsius-001",
    storageBucket: "celsius-001.firebasestorage.app",
    messagingSenderId: "80703174723",
    appId: "1:80703174723:web:10c8e93d0d544ffc967cf6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function applyCelsiusSettings() {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('celsius_theme');
    if (savedTheme) {
        try {
            const theme = JSON.parse(savedTheme);
            root.style.setProperty('--bg-main', theme.bg || '#000000');
            root.style.setProperty('--bg-panel', theme.panel || '#121212');
            root.style.setProperty('--text-primary', theme.text || '#ffffff');
            root.style.setProperty('--accent-color', theme.accent || '#ffffff');
            document.body.style.backgroundColor = theme.bg || '#000000';
            document.body.style.color = theme.text || '#ffffff';
        } catch (e) {}
    }
}

applyCelsiusSettings();

window.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'updateTheme' || event.data.action === 'updateSettings')) {
        applyCelsiusSettings();
    }
});

const headerUserName = document.getElementById('headerUserName');
const headerAvatar = document.getElementById('headerAvatar');
const playerAvatar = document.getElementById('playerAvatar');

onAuthStateChanged(auth, (user) => {
    if (user) {
        headerUserName.textContent = user.displayName || user.email.split('@')[0];
        if (user.photoURL) {
            headerAvatar.style.backgroundImage = `url(${user.photoURL})`;
            playerAvatar.style.backgroundImage = `url(${user.photoURL})`;
        }
    } else {
        headerUserName.textContent = 'Log In';
        headerAvatar.style.backgroundImage = '';
        playerAvatar.style.backgroundImage = '';
    }
});

const API_BASE = "https://celsiusmusic-backend.vercel.app/api";
const mainContentArea = document.getElementById('mainContentArea');
let currentAudio = new Audio();
let isPlaying = false;

function playTrack(track) {
    if (!track.audioUrl) {
        alert("Audio preview not available for this track.");
        return;
    }
    currentAudio.src = track.audioUrl;
    currentAudio.play().catch(() => {});
    document.querySelector('.now-playing-art').style.backgroundImage = `url('${track.thumbnail}')`;
    document.querySelector('.track-title').textContent = track.title;
    document.querySelector('.track-artist').textContent = track.artist;
    isPlaying = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
}

function renderHomeView() {
    mainContentArea.innerHTML = `
        <section class="category-section" data-category="top-hits">
            <h3 class="category-title">Top Hits</h3>
            <div class="category-row" id="row-top-hits"></div>
        </section>
        <section class="category-section" data-category="hip-hop">
            <h3 class="category-title">Hip Hop & Rap</h3>
            <div class="category-row" id="row-hip-hop"></div>
        </section>
        <section class="category-section" data-category="curated">
            <h3 class="category-title">Made For You</h3>
            <div class="category-row" id="row-curated"></div>
        </section>
    `;
    fetchAllCategories();
}

function renderSearchView(query = '') {
    mainContentArea.innerHTML = `
        <h3 class="category-title">${query ? `Results for "${query}"` : 'Search'}</h3>
        <div class="category-row" id="row-search"></div>
    `;
    if (query) {
        fetchCategoryTracks(query, 'row-search');
    }
}

function renderLikedSongsView() {
    mainContentArea.innerHTML = `
        <div class="view-header">
            <div class="view-banner" style="background: linear-gradient(135deg, #450af5, #c4efd9);">❤️</div>
            <div class="view-details">
                <p>PUBLIC PLAYLIST</p>
                <h1>Liked Songs</h1>
            </div>
        </div>
        <div class="track-list-table" id="likedSongsList">
            <p style="color: var(--text-secondary); font-size: 0.85rem;">No liked songs yet.</p>
        </div>
    `;
}

function renderPlaylistView(playlistName) {
    mainContentArea.innerHTML = `
        <div class="view-header">
            <div class="view-banner">🎵</div>
            <div class="view-details">
                <p>CUSTOM PLAYLIST</p>
                <h1>${playlistName}</h1>
            </div>
        </div>
        <div class="track-list-table">
            <p style="color: var(--text-secondary); font-size: 0.85rem;">This playlist is empty.</p>
        </div>
    `;
}

async function fetchCategoryTracks(categoryName, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/tracks?category=${encodeURIComponent(categoryName)}`);
        if (!response.ok) throw new Error();
        const data = await response.json();
        container.innerHTML = '';
        if (Array.isArray(data) && data.length > 0) {
            data.forEach(track => {
                const card = document.createElement('div');
                card.className = 'music-card';
                card.innerHTML = `
                    <div class="card-art" style="background-image: url('${track.thumbnail || ''}')"></div>
                    <div class="card-title">${track.title}</div>
                    <div class="card-artist">${track.artist}</div>
                `;
                card.addEventListener('click', () => playTrack(track));
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.85rem;">No tracks found.</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.85rem;">Failed to load tracks.</p>`;
    }
}

function fetchAllCategories() {
    const sections = document.querySelectorAll('.category-section');
    sections.forEach(section => {
        const category = section.getAttribute('data-category');
        const rowId = `row-${category}`;
        fetchCategoryTracks(category, rowId);
    });
}

renderHomeView();

document.querySelectorAll('.sidebar-nav .nav-item').forEach((item, index) => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        if (index === 0) renderHomeView();
        if (index === 1) renderSearchView();
    });
});

document.getElementById('likedSongsBtn').addEventListener('click', () => {
    renderLikedSongsView();
});

const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
            renderSearchView(query);
        }
    }
});

const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');

playPauseBtn.addEventListener('click', () => {
    if (!currentAudio.src) return;
    isPlaying = !isPlaying;
    if (isPlaying) {
        currentAudio.play();
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        currentAudio.pause();
        pauseIcon.classList.add('hidden');
        playIcon.classList.remove('hidden');
    }
});

const favoriteBtn = document.getElementById('favoriteBtn');
favoriteBtn.addEventListener('click', () => {
    favoriteBtn.classList.toggle('active');
});

const createPlaylistBtn = document.getElementById('createPlaylistBtn');
const userPlaylists = document.getElementById('userPlaylists');

createPlaylistBtn.addEventListener('click', () => {
    const playlistName = prompt('Enter playlist name:');
    if (playlistName && playlistName.trim() !== '') {
        const item = document.createElement('a');
        item.className = 'playlist-item';
        item.textContent = playlistName;
        item.addEventListener('click', () => renderPlaylistView(playlistName));
        userPlaylists.appendChild(item);
    }
});

const volumeBarContainer = document.getElementById('volumeBarContainer');
if (volumeBarContainer) {
    volumeBarContainer.addEventListener('click', (e) => {
        const rect = volumeBarContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        currentAudio.volume = Math.max(0, Math.min(1, pos));
        const fill = volumeBarContainer.querySelector('.progress-bar-fill');
        if (fill) fill.style.width = `${pos * 100}%`;
    });
}
