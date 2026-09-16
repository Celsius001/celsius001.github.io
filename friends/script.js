import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = "";
let currentAvatar = "../favicon.ico";
let presenceInterval = null;
let unsubscribeUsers = null;

const currentUsernameDisplay = document.getElementById('current-username');
const currentUserAvatarDisplay = document.getElementById('current-user-avatar');
const onlineUsersGrid = document.getElementById('online-users-grid');
const onlineCount = document.getElementById('online-count');
const tabs = document.querySelectorAll('.tab-item');
const panes = document.querySelectorAll('.tab-pane');

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
            root.style.setProperty('--bg-hover', theme.panel);
        } catch (e) {}
    }
}
applyCelsiusSettings();

window.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'updateTheme' || event.data.action === 'updateSettings')) {
        applyCelsiusSettings();
    }
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

document.getElementById('nav-chat').addEventListener('click', () => {
    window.location.href = '../chat/index.html';
});

function initUser(user) {
    currentUser = user.displayName || localStorage.getItem('celsius_username') || user.email?.split('@')[0] || "User";
    currentAvatar = localStorage.getItem('celsius_avatar') || "../favicon.ico";
    
    currentUsernameDisplay.textContent = currentUser;
    currentUserAvatarDisplay.src = currentAvatar;

    registerUserPresence(user.uid);
    listenToOnlineUsers();
}

function registerUserPresence(uid) {
    const userRef = doc(db, 'online_users', uid);
    const sendHeartbeat = () => {
        setDoc(userRef, { 
            username: currentUser, 
            avatar: currentAvatar,
            lastSeen: Date.now() 
        }, { merge: true }).catch(() => {});
    };
    sendHeartbeat();
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(sendHeartbeat, 5000);
    window.addEventListener('beforeunload', () => { clearInterval(presenceInterval); deleteDoc(userRef); });
}

function listenToOnlineUsers() {
    const usersQuery = query(collection(db, 'online_users'), orderBy('lastSeen', 'desc'));
    if (unsubscribeUsers) unsubscribeUsers();
    unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const fragment = document.createDocumentFragment();
        let count = 0;
        const now = Date.now();
        
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (!userData.lastSeen || (now - userData.lastSeen) > 15000) return;
            if (userData.username === currentUser) return;
            
            count++;
            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `
                <div class="user-card-banner"></div>
                <div class="user-card-actions">
                    <button class="card-action-btn action-dm">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                    <button class="card-action-btn action-add">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                    </button>
                </div>
                <div class="user-card-content">
                    <div class="user-card-avatar-container">
                        <img src="${escapeHtml(userData.avatar) || '../favicon.ico'}" class="user-card-avatar" alt="avatar">
                        <div class="user-card-status-dot"></div>
                    </div>
                    <div class="user-card-info">
                        <div class="user-card-name">${escapeHtml(userData.username)}</div>
                        <div class="user-card-state">Online</div>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                window.location.href = `bios.html?user=${encodeURIComponent(userData.username)}`;
            });

            const dmBtn = card.querySelector('.action-dm');
            dmBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                startDM(userData.username);
            });

            const addBtn = card.querySelector('.action-add');
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                addFriend(userData.username, userData.avatar);
            });

            fragment.appendChild(card);
        });
        
        onlineUsersGrid.innerHTML = '';
        onlineUsersGrid.appendChild(fragment);
        onlineCount.textContent = count;
    }, () => {});
}

function addFriend(targetUsername, targetAvatar) {
    if (!targetUsername) return;
    const friendRef = doc(db, `friends_${currentUser}`, targetUsername);
    setDoc(friendRef, {
        username: targetUsername,
        avatar: targetAvatar || '../favicon.ico',
        status: 'pending',
        timestamp: Date.now()
    }).then(() => {
        alert(`Friend request sent to ${targetUsername}`);
    }).catch((err) => {
        alert(`Failed to send request: ${err.message}`);
    });
}

function startDM(targetUsername) {
    if (!targetUsername) return;
    const dmId = [currentUser, targetUsername].sort().join('_');
    window.location.href = `dm.html?chat=${dmId}&with=${encodeURIComponent(targetUsername)}`;
}

function escapeHtml(str) {
    return (str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        initUser(user);
    } else {
        window.location.href = '../index.html';
    }
});
