import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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
const VERCEL_BACKEND_URL = "celsius-tmbd.vercel.app/api";

let activeType = 'movies';
let searchTimeout = null;

const searchInput = document.getElementById('searchInput');
const mainContainer = document.getElementById('mainContainer');
const searchContainer = document.getElementById('searchContainer');
const searchGrid = document.getElementById('searchGrid');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const userGreeting = document.getElementById('userGreeting');

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
            document.body.style.backgroundColor = theme.bg;
            document.body.style.color = theme.text;
        } catch (e) {}
    }
}

applyCelsiusTheme();

window.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'updateTheme') {
        applyCelsiusTheme();
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userGreeting.textContent = user.displayName || `User_${user.uid.substring(0, 5)}`;
    } else {
        userGreeting.textContent = "Guest";
    }
});

async function fetchTMDB(endpoint, query = '') {
    try {
        let url = `${VERCEL_BACKEND_URL}/tmdb?path=${encodeURIComponent(endpoint)}`;
        if (query) {
            url += `&query=${encodeURIComponent(query)}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Vercel backend fetch failed");
        const data = await res.json();
        return data.results || [];
    } catch (error) {
        return [];
    }
}

async function fetchAnilist(queryStr, variables = {}) {
    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query: queryStr, variables })
        });
        if (!res.ok) throw new Error("AniList fetch failed");
        return await res.json();
    } catch (error) {
        return { data: null };
    }
}

async function getAnimeCategory(category) {
    let sortOption = "POPULARITY_DESC";
    if (category === 'latest') sortOption = "TRENDING_DESC";
    if (category === 'new') sortOption = "START_DATE_DESC";

    const query = `
        query {
            Page(page: 1, perPage: 15) {
                media(type: ANIME, sort: ${sortOption}, isAdult: false) {
                    id title { english romaji } coverImage { extraLarge } bannerImage
                }
            }
        }
    `;

    const result = await fetchAnilist(query);
    if (!result.data) return [];

    return result.data.Page.media.map(anime => ({
        id: anime.id,
        title: anime.title.english || anime.title.romaji,
        poster: anime.coverImage.extraLarge,
        banner: anime.bannerImage || anime.coverImage.extraLarge,
        isAnime: true
    }));
}

async function searchContent(query) {
    if (activeType === 'anime') {
        const gqlQuery = `
            query ($search: String) {
                Page(page: 1, perPage: 20) {
                    media(type: ANIME, search: $search, isAdult: false) {
                        id title { english romaji } coverImage { extraLarge }
                    }
                }
            }
        `;
        const result = await fetchAnilist(gqlQuery, { search: query });
        if (!result.data) return [];
        return result.data.Page.media.map(anime => ({
            id: anime.id,
            title: anime.title.english || anime.title.romaji,
            poster: anime.coverImage.extraLarge,
            isAnime: true
        }));
    } else if (activeType === 'tv') {
        const results = await fetchTMDB('/search/tv', query);
        return results.map(item => ({
            id: item.id,
            title: item.name || item.title,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
            banner: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : '',
            isAnime: false
        }));
    } else {
        const results = await fetchTMDB('/search/movie', query);
        return results.map(movie => ({
            id: movie.id,
            title: movie.title,
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
            banner: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '',
            isAnime: false
        }));
    }
}

async function fetchCategory(category) {
    if (activeType === 'anime') {
        return await getAnimeCategory(category);
    } else if (activeType === 'tv') {
        let endpoint = '/tv/popular';
        if (category === 'latest') endpoint = '/tv/on_the_air';
        if (category === 'new') endpoint = '/tv/top_rated';
        
        const results = await fetchTMDB(endpoint);
        return results.map(item => ({
            id: item.id,
            title: item.name || item.title,
            poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
            banner: item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : '',
            isAnime: false
        }));
    } else {
        let endpoint = '/movie/popular';
        if (category === 'latest') endpoint = '/movie/now_playing';
        if (category === 'new') endpoint = '/movie/upcoming';
        
        const results = await fetchTMDB(endpoint);
        return results.map(movie => ({
            id: movie.id,
            title: movie.title,
            poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
            banner: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : '',
            isAnime: false
        }));
    }
}

function openPlayer(item) {
    const url = `player.html?type=${activeType}&title=${encodeURIComponent(item.title)}&poster=${encodeURIComponent(item.poster || '')}&id=${item.id || ''}`;
    window.location.href = url;
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `<img src="${item.poster}" alt="${item.title}" onerror="this.style.backgroundColor='var(--bg-panel)'">`;
    card.addEventListener('click', () => openPlayer(item));
    return card;
}

function renderRow(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); font-size: 14px; padding: 10px 0;">No content available.</p>`;
        return;
    }

    items.forEach(item => container.appendChild(createCard(item)));
}

async function initContent() {
    document.getElementById('heroTitle').textContent = "Loading...";
    document.getElementById('heroDesc').textContent = "Fetching content from servers.";
    document.getElementById('heroSection').style.removeProperty('--hero-bg');

    const topHits = await fetchCategory('hits');
    const latest = await fetchCategory('latest');
    const newAdd = await fetchCategory('new');

    renderRow('topHitsRow', topHits);
    renderRow('latestRow', latest);
    renderRow('newRow', newAdd);

    if (topHits.length > 0) {
        const heroItem = topHits[0];
        document.getElementById('heroTitle').textContent = heroItem.title;
        document.getElementById('heroDesc').textContent = `Watch the most popular ${activeType} right now exclusively on Celsius.`;
        if (heroItem.banner) {
            document.getElementById('heroSection').style.setProperty('--hero-bg', `url(${heroItem.banner})`);
        }
        
        heroPlayBtn.onclick = () => openPlayer(heroItem);
    } else {
        document.getElementById('heroTitle').textContent = "Content Unavailable";
        document.getElementById('heroDesc').textContent = "Please check your API configurations.";
        heroPlayBtn.onclick = null;
    }
}

const toggleBtns = document.querySelectorAll('.toggle-btn');
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeType = btn.dataset.type;
        
        searchInput.placeholder = `Search ${activeType}...`;
        searchInput.value = '';
        mainContainer.style.display = 'block';
        searchContainer.style.display = 'none';

        initContent();
    });
});

searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(searchTimeout);
    
    if (query.length > 2) {
        mainContainer.style.display = 'none';
        searchContainer.style.display = 'block';
        searchGrid.innerHTML = `<p style="color: var(--text-secondary);">Searching...</p>`;
        
        searchTimeout = setTimeout(async () => {
            const results = await searchContent(query);
            searchGrid.innerHTML = '';
            if (results.length === 0) {
                searchGrid.innerHTML = `<p style="color: var(--text-secondary);">No results found for "${query}".</p>`;
            } else {
                results.forEach(item => searchGrid.appendChild(createCard(item)));
            }
        }, 500);
    } else {
        mainContainer.style.display = 'block';
        searchContainer.style.display = 'none';
    }
});

initContent();

window.addEventListener('scroll', () => {
    const nav = document.querySelector('.watch-nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});
