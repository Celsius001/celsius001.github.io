const firebaseConfig = {
    apiKey: "AIzaSyDj46RSodJ56rWwsxp9wh2x44hcZtBImxw",
    authDomain: "celsius-001.firebaseapp.com",
    projectId: "celsius-001",
    storageBucket: "celsius-001.firebasestorage.app",
    messagingSenderId: "80703174723",
    appId: "1:80703174723:web:10c8e93d0d544ffc967cf6"
};

const gamesGrid = document.getElementById('gamesGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const currentLibraryTitle = document.getElementById('currentLibraryTitle');
const libraryBoxes = document.querySelectorAll('.lib-box');
const categoryButtons = document.querySelectorAll('.cat-btn');

let currentGames = [];
let activeLibrary = 'seraph';
let activeCategory = 'all';
let favorites = JSON.parse(localStorage.getItem('celsius_favorites') || '[]');

function applyCelsiusTheme() {
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
}

applyCelsiusTheme();

async function getGames() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/gmshelf/seraph/seraph.json")
  const data = await res.json()
  return data
}

async function getUgsGames() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/gmshelf/ugs/ugs.json")
  const data = await res.json()
  return data
}

async function getTruffledGames() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/gmshelf/truffled/truffled.json")
  const data = await res.json()
  return data
}

function getGameUrl(gameUrl) {
        if (/^https?:\/\//i.test(gameUrl)) {
                return gameUrl;
        }

        return `https://cdn.jsdelivr.net/gh/gmshelf/${activeLibrary}/${gameUrl.replace(/^\/+/, '')}`;
}

async function openGame(gameUrl) {
    const resolvedUrl = getGameUrl(gameUrl);

    if (/^https?:\/\//i.test(gameUrl)) {
        window.location.href = resolvedUrl;
        return;
    }

    const response = await fetch(resolvedUrl);
    if (!response.ok) {
        throw new Error(`Failed to load game: ${response.status}`);
    }

    const html = await response.text();
    const baseUrl = new URL('.', resolvedUrl).href;
    const gameDocument = html.replace(
        /<head(\s[^>]*)?>/i,
        `$&\n<base href="${baseUrl}">`
    );

    document.open();
    document.write(gameDocument);
    document.close();
}

async function loadLibrary(libName) {
    activeLibrary = libName;
    currentLibraryTitle.textContent = `${libName.toUpperCase()} GAMES`;
    gamesGrid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">Loading games...</p>`;
    try {
        if (libName === 'seraph') {
            currentGames = await getGames();
        } else if (libName === 'ugs') {
            currentGames = await getUgsGames();
        } else if (libName === 'truffled') {
            currentGames = await getTruffledGames();
        }
        filterAndRenderGames();
    } catch (err) {
        gamesGrid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">Failed to load library.</p>`;
    }
}

function filterAndRenderGames() {
    let games = [...currentGames];
    const query = searchInput.value.toLowerCase();

    if (activeCategory === 'favorites') {
        games = games.filter(g => favorites.includes(g.url || g.title || g.name));
    }

    if (query) {
        games = games.filter(g => 
            (g.title && g.title.toLowerCase().includes(query)) || 
            (g.name && g.name.toLowerCase().includes(query))
        );
    }

    const sortBy = sortSelect.value;
    if (sortBy === 'name') {
        games.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''));
    }

    renderGames(games);
}

function renderGames(games) {
    const fragment = document.createDocumentFragment();
    gamesGrid.innerHTML = '';

    if (!games || games.length === 0) {
        gamesGrid.innerHTML = `<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center;">No games found.</p>`;
        return;
    }

    games.forEach(game => {
        const card = document.createElement('div');
        card.className = 'game-card';
        
        const iconSrc = game.icon || game.image || '../favicon.ico';
        const title = game.title || game.name || 'Untitled';
        const gameIdentifier = game.url || title;
        const isFav = favorites.includes(gameIdentifier);

        card.innerHTML = `
            <button class="fav-btn ${isFav ? 'favorited' : ''}" title="Favorite">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <img src="${iconSrc}" alt="" class="game-icon" onerror="this.src='../favicon.ico'">
            <span class="game-title">${title}</span>
        `;

        const favBtn = card.querySelector('.fav-btn');
        favBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (favorites.includes(gameIdentifier)) {
                favorites = favorites.filter(f => f !== gameIdentifier);
                favBtn.classList.remove('favorited');
                favBtn.querySelector('svg').setAttribute('fill', 'none');
            } else {
                favorites.push(gameIdentifier);
                favBtn.classList.add('favorited');
                favBtn.querySelector('svg').setAttribute('fill', 'currentColor');
            }
            localStorage.setItem('celsius_favorites', JSON.stringify(favorites));
            if (activeCategory === 'favorites') {
                filterAndRenderGames();
            }
        });

        card.addEventListener('click', () => {
            if (game.url) {
                openGame(game.url).catch(() => {
                    window.location.href = getGameUrl(game.url);
                });
            }
        });

        fragment.appendChild(card);
    });

    gamesGrid.appendChild(fragment);
}

libraryBoxes.forEach(box => {
    box.addEventListener('click', () => {
        libraryBoxes.forEach(b => b.classList.remove('active'));
        box.classList.add('active');
        loadLibrary(box.dataset.lib);
    });
});

categoryButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        categoryButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.dataset.cat;
        filterAndRenderGames();
    });
});

searchInput.addEventListener('input', () => {
    filterAndRenderGames();
});

sortSelect.addEventListener('change', () => {
    filterAndRenderGames();
});

window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'updateTheme') {
        applyCelsiusTheme();
    }
});

loadLibrary('seraph');
