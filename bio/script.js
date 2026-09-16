import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDj46RSodJ56rWwsxp9wh2x44hcZtBImxw",
    authDomain: "celsius-001.firebaseapp.com",
    projectId: "celsius-001",
    storageBucket: "celsius-001.firebasestorage.app",
    messagingSenderId: "80703174723",
    appId: "1:80703174723:web:10c8e93d0d544ffc967cf6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function applyCelsiusTheme() {
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('celsius_theme');
    if (savedTheme) {
        try {
            const theme = JSON.parse(savedTheme);
            document.body.style.backgroundColor = theme.bg;
            document.body.style.color = theme.text;
            document.getElementById('bio-card').style.backgroundColor = theme.panel;
        } catch (e) {}
    }
}
applyCelsiusTheme();

window.addEventListener('storage', (e) => {
    if (e.key === 'celsius_theme') applyCelsiusTheme();
});

const urlParams = new URLSearchParams(window.location.search);
const targetUser = urlParams.get('user');

document.getElementById('back-btn').addEventListener('click', () => {
    window.history.back();
});

async function loadBio() {
    if (!targetUser) {
        document.getElementById('bio-username').textContent = "User not found";
        return;
    }

    document.getElementById('bio-username').textContent = targetUser;

    const q = query(collection(db, 'users'), where('username', '==', targetUser));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        if (userData.avatar) {
            document.getElementById('bio-avatar').src = userData.avatar;
        }
        if (userData.bio) {
            document.getElementById('bio-text').textContent = userData.bio;
        }
    }
}

loadBio();
