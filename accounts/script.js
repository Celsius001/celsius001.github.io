import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const db = getFirestore(app);

// DOM elements
const avatarContainer = document.getElementById('avatarContainer');
const avatarInput = document.getElementById('avatarInput');
const profileAvatar = document.getElementById('profileAvatar');
const userEmailInput = document.getElementById('userEmail');
const usernameInput = document.getElementById('usernameInput');
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const newPasswordInput = document.getElementById('newPassword');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const backHomeBtn = document.getElementById('backHomeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statMessages = document.getElementById('statMessages');
const statGameTime = document.getElementById('statGameTime');

// Game Tracker background ticker
function updateGameTimeDisplay() {
    let storedSeconds = parseInt(localStorage.getItem('celsius_game_seconds') || '0', 10);
    const hours = Math.floor(storedSeconds / 3600);
    const minutes = Math.floor((storedSeconds % 3600) / 60);
    statGameTime.textContent = `${hours}h ${minutes}m`;
}

// Tick game seconds every 60 seconds (or accumulate stored session time)
setInterval(() => {
    let storedSeconds = parseInt(localStorage.getItem('celsius_game_seconds') || '0', 10);
    storedSeconds += 60;
    localStorage.setItem('celsius_game_seconds', storedSeconds.toString());
    updateGameTimeDisplay();
}, 60000);
updateGameTimeDisplay();

// Load User profile & chat count metrics
async function loadUserMetricsAndProfile(user) {
    if (user.email) userEmailInput.value = user.email;
    const storedUsername = user.displayName || localStorage.getItem('celsius_username') || user.email?.split('@')[0] || 'User';
    usernameInput.value = storedUsername;

    // Load avatar from Firestore doc or local storage or auth profile
    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef).catch(() => null);
    if (userSnap && userSnap.exists() && userSnap.data().avatar) {
        profileAvatar.src = userSnap.data().avatar;
    } else if (localStorage.getItem('celsius_avatar')) {
        profileAvatar.src = localStorage.getItem('celsius_avatar');
    }

    // Calculate/Load chat messages sent count across known channels
    try {
        const channels = ['general', 'music', 'gaming', 'lounge'];
        let totalCount = 0;
        for (const ch of channels) {
            const q = query(collection(db, `messages_${ch}`), where('user', '==', storedUsername));
            const snap = await getDocs(q);
            totalCount += snap.size;
        }
        statMessages.textContent = totalCount;
    } catch (e) {
        statMessages.textContent = localStorage.getItem('celsius_messages_count') || '0';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserMetricsAndProfile(user);
    } else {
        window.location.href = '../index.html';
    }
});

// Image file upload handler (PNG, JPEG, WebP, etc.)
avatarContainer.addEventListener('click', () => avatarInput.click());

avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        const dataUrl = event.target.result;
        profileAvatar.src = dataUrl;
        localStorage.setItem('celsius_avatar', dataUrl);
        if (auth.currentUser) {
            await setDoc(doc(db, 'users', auth.currentUser.uid), { avatar: dataUrl }, { merge: true }).catch(() => {});
        }
    };
    reader.readAsDataURL(file);
});

// Profile form submission (username update)
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = usernameInput.value.trim();
    if (!newName) return;
    localStorage.setItem('celsius_username', newName);
    if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { username: newName }, { merge: true }).catch(() => {});
    }
    alert('Profile updated successfully!');
});

// Password update form
passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = newPasswordInput.value;
    if (pwd.length < 6) {
        alert('Password must be at least 6 characters.');
        return;
    }
    try {
        await updatePassword(auth.currentUser, pwd);
        alert('Password updated successfully!');
        newPasswordInput.value = '';
    } catch (err) {
        alert('Error updating password: ' + err.message);
    }
});

// Delete account
deleteAccountBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to permanently delete your account?')) {
        try {
            await deleteUser(auth.currentUser);
            window.location.href = '../index.html';
        } catch (err) {
            alert('Re-authentication required or error deleting account: ' + err.message);
        }
    }
});

// Navigation actions
backHomeBtn.addEventListener('click', () => {
    window.location.href = '../index.html';
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = '../index.html';
});
