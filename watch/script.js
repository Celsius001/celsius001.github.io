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

async function fetchContent(category, type) {
    try {
        const res = await fetch(`${VERCEL_API_URL}/${type}?category=${category}`);
        if (!res.ok) throw new Error("");
        return await res.json();
    } catch (error) {
        const seedWord = type === 'anime' ? 'anime' : 'movie';
        return Array.from({ length: 15 }).map((_, i) => ({
            title: `${type === 'anime' ? 'Anime' : 'Movie'} ${category} ${i + 1}`,
            poster: `https://picsum.photos/seed/${seedWord}${category}${i}/400/600`
        }));
    }
}

function renderRow(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `<img src="${item.poster}" alt="${item.title}" onerror="this.style.backgroundColor='var(--border-color)'">`;
        container.appendChild(card);
    });
}

async function initContent(type = 'movies') {
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
        const heroBgUrl = heroItem.banner || `https://picsum.photos/seed/hero${type}/1920/1080`;
        document.getElementById('heroSection').style.setProperty('--hero-bg', `url(${heroBgUrl})`);
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
