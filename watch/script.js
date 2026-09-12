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
const VERCEL_API_URL = "https://your-celsius-backend.vercel.app/api";

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

const userGreeting = document.getElementById('userGreeting');

onAuthStateChanged(auth, (user) => {
    if (user) {
        userGreeting.textContent = user.displayName || `User_${user.uid.substring(0, 5)}`;
    } else {
        userGreeting.textContent = "Guest";
    }
});

async function fetchMovies(category) {
    try {
        const res = await fetch(`${VERCEL_API_URL}/movies?category=${category}`);
        if (!res.ok) throw new Error("Backend connection failed");
        return await res.json(); 
    } catch (error) {
        console.error(`Failed to fetch movies (${category}):`, error);
        return []; 
    }
}

async function fetchAnilist(category) {
    let sortOption = "POPULARITY_DESC"; 
    if (category === 'latest') sortOption = "TRENDING_DESC";
    if (category === 'new') sortOption = "START_DATE_DESC";

    const query = `
        query {
            Page(page: 1, perPage: 15) {
                media(type: ANIME, sort: ${sortOption}, isAdult: false) {
                    title { english romaji }
                    coverImage { extraLarge }
                    bannerImage
                }
            }
        }
    `;

    try {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({ query })
        });
        
        if (!res.ok) throw new Error("AniList fetch failed");
        
        const { data } = await res.json();
        
        return data.Page.media.map(anime => ({
            title: anime.title.english || anime.title.romaji,
            poster: anime.coverImage.extraLarge,
            banner: anime.bannerImage || anime.coverImage.extraLarge 
        }));
    } catch (error) {
        console.error(`Failed to fetch anime (${category}):`, error);
        return []; 
    }
}

async function fetchContent(category, type) {
    if (type === 'anime') {
        return await fetchAnilist(category);
    } else {
        return await fetchMovies(category);
    }
}

function renderRow(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); font-size: 14px; padding: 10px 0;">No content available.</p>`;
        return;
    }

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `<img src="${item.poster}" alt="${item.title}" onerror="this.style.backgroundColor='var(--bg-panel)'">`;
        container.appendChild(card);
    });
}

async function initContent(type = 'movies') {
    document.getElementById('heroTitle').textContent = "Loading...";
    document.getElementById('heroDesc').textContent = "Fetching content from servers.";
    document.getElementById('heroSection').style.removeProperty('--hero-bg');

    const topHits = await fetchContent('hits', type);
    const latest = await fetchContent('latest', type);
    const newAdd = await fetchContent('new', type);

    renderRow('topHitsRow', topHits);
    renderRow('latestRow', latest);
    renderRow('newRow', newAdd);

    if (topHits.length > 0) {
        const heroItem = topHits[0];
        document.getElementById('heroTitle').textContent = heroItem.title;
        document.getElementById('heroDesc').textContent = `Watch the most popular ${type} right now exclusively on Celsius.`;
        
        if (heroItem.banner) {
            document.getElementById('heroSection').style.setProperty('--hero-bg', `url(${heroItem.banner})`);
        }
    } else {
        document.getElementById('heroTitle').textContent = "API Offline";
        document.getElementById('heroDesc').textContent = "Please ensure your backend is running or check API limits.";
    }
}

const toggleBtns = document.querySelectorAll('.toggle-btn');
toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        
        toggleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        initContent(btn.dataset.type);
    });
});

initContent('movies');

window.addEventListener('scroll', () => {
    const nav = document.querySelector('.watch-nav');
    if (window.scrollY > 50) {
        nav.classList.add('scrolled');
    } else {
        nav.classList.remove('scrolled');
    }
});
