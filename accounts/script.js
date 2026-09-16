import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, getDocs, query, where, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const avatarContainer = document.getElementById('avatarContainer');
const avatarInput = document.getElementById('avatarInput');
const profileAvatar = document.getElementById('profileAvatar');
const userEmailInput = document.getElementById('userEmail');
const usernameInput = document.getElementById('usernameInput');
const bioInput = document.getElementById('bioInput');
const bioBgInput = document.getElementById('bioBgInput');
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const newPasswordInput = document.getElementById('newPassword');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const backHomeBtn = document.getElementById('backHomeBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statMessages = document.getElementById('statMessages');
const statGameTime = document.getElementById('statGameTime');

let gamesUnsubscribe = null;
let currentUsername = "";

function renderGameTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    statGameTime.textContent = `${hours}h ${minutes}m`;
}

function calculateDocSeconds(data) {
    if (typeof data.durationSeconds === 'number') return data.durationSeconds;
    if (typeof data.seconds === 'number') return data.seconds;
    if (typeof data.timeSpent === 'number') return data.timeSpent;
    return Number(data.duration || 0);
}

function listenToGamesFolder(uid, username) {
    if (gamesUnsubscribe) gamesUnsubscribe();
    const qById = query(collection(db, 'games'), where('userId', '==', uid));
    gamesUnsubscribe = onSnapshot(qById, async (snapshot) => {
        let totalSecs = 0;
        snapshot.forEach((docSnap) => {
            totalSecs += calculateDocSeconds(docSnap.data());
        });
        renderGameTime(totalSecs);
    }, () => {});
}

async function loadUserMetricsAndProfile(user) {
    if (user.email) userEmailInput.value = user.email;
    currentUsername = user.displayName || localStorage.getItem('celsius_username') || user.email?.split('@')[0] || 'User';
    usernameInput.value = currentUsername;

    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef).catch(() => null);
    if (userSnap && userSnap.exists()) {
        const data = userSnap.data();
        if (data.avatar) profileAvatar.src = data.avatar;
        if (data.bio) bioInput.value = data.bio;
        if (data.bioBg) bioBgInput.value = data.bioBg;
    }

    try {
        const channels = ['general', 'music', 'gaming', 'lounge'];
        let totalCount = 0;
        for (const ch of channels) {
            const q = query(collection(db, `messages_${ch}`), where('user', '==', currentUsername));
            const snap = await getDocs(q);
            totalCount += snap.size;
        }
        statMessages.textContent = totalCount;
    } catch (e) {
        statMessages.textContent = '0';
    }

    listenToGamesFolder(user.uid, currentUsername);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserMetricsAndProfile(user);
    } else {
        if (gamesUnsubscribe) gamesUnsubscribe();
        window.location.href = '../index.html';
    }
});

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

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = usernameInput.value.trim();
    const newBio = bioInput.value.trim();
    const newBioBg = bioBgInput.value;
    if (!newName) return;

    localStorage.setItem('celsius_username', newName);
    currentUsername = newName;

    if (auth.currentUser) {
        await setDoc(doc(db, 'users', auth.currentUser.uid), { 
            username: newName, 
            bio: newBio, 
            bioBg: newBioBg 
        }, { merge: true }).catch(() => {});
    }
    alert('Profile updated successfully!');
});

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

deleteAccountBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to permanently delete your account?')) {
        try {
            await deleteUser(auth.currentUser);
            window.location.href = '../index.html';
        } catch (err) {
            alert('Error deleting account: ' + err.message);
        }
    }
});

backHomeBtn.addEventListener('click', () => { window.location.href = '../index.html'; });
logoutBtn.addEventListener('click', async () => {
    if (gamesUnsubscribe) gamesUnsubscribe();
    await signOut(auth);
    window.location.href = '../index.html';
});
