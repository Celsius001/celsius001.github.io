import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, updateProfile, deleteUser, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, deleteDoc, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const userEmailInput = document.getElementById('userEmail');
const usernameInput = document.getElementById('usernameInput');
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const newPasswordInput = document.getElementById('newPassword');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statMessages = document.getElementById('statMessages');
const statGameHours = document.getElementById('statGameHours');
const avatarWrapper = document.getElementById('avatarWrapper');
const avatarInput = document.getElementById('avatarInput');
const profileAvatar = document.getElementById('profileAvatar');
const backHomeLink = document.getElementById('backHomeLink');

let currentUser = null;
let unsubUser = null;
let unsubChats = null;
let activeMessageListeners = [];

backHomeLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.top.location.href = "../home/index.html";
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userEmailInput.value = user.email || "";
        usernameInput.value = user.displayName || "";
        if (user.photoURL) {
            profileAvatar.src = user.photoURL;
        }
        setupRealtimeData(user.uid);
    } else {
        window.top.location.href = "../home/index.html";
    }
});

function setupRealtimeData(uid) {
    unsubUser = onSnapshot(doc(db, "users", uid), (docSnap) => {
        let gameHours = 0;
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.gameHours) gameHours = data.gameHours;
            if (data.photoURL) profileAvatar.src = data.photoURL;
        }
        const totalMinutes = Math.round(gameHours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        statGameHours.textContent = `${h} hours ${m} minutes`;
    });

    const chatsRef = collection(db, "users", uid, "chats");
    unsubChats = onSnapshot(chatsRef, (chatsSnap) => {
        activeMessageListeners.forEach(unsub => unsub());
        activeMessageListeners = [];

        if (chatsSnap.empty) {
            statMessages.textContent = "0";
            return;
        }

        let messageCounts = {};

        chatsSnap.docs.forEach((chatDoc) => {
            const chatId = chatDoc.id;
            messageCounts[chatId] = 0;
            const msgsRef = collection(db, "users", uid, "chats", chatId, "messages");
            const unsubMsg = onSnapshot(msgsRef, (msgsSnap) => {
                let count = 0;
                msgsSnap.forEach(m => {
                    if (m.data().sender === 'user') count++;
                });
                messageCounts[chatId] = count;
                
                let total = 0;
                for (let id in messageCounts) {
                    total += messageCounts[id];
                }
                statMessages.textContent = total;
            });
            activeMessageListeners.push(unsubMsg);
        });
    });
}

avatarWrapper.addEventListener('click', () => {
    avatarInput.click();
});

avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
        alert("Please select an image file.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const photoURL = event.target.result;
        try {
            await updateProfile(currentUser, { photoURL });
            await setDoc(doc(db, "users", currentUser.uid), { photoURL }, { merge: true });
            profileAvatar.src = photoURL;
        } catch (err) {
            alert("Failed to update profile picture.");
        }
    };
    reader.readAsDataURL(file);
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const newUsername = usernameInput.value.trim();
    if (!newUsername) return;

    try {
        await updateProfile(currentUser, { displayName: newUsername });
        await setDoc(doc(db, "users", currentUser.uid), { username: newUsername }, { merge: true });
        alert("Username updated successfully!");
    } catch (err) {
        alert("Failed to update username.");
    }
});

passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const newPassword = newPasswordInput.value;
    if (newPassword.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }

    try {
        await updatePassword(currentUser, newPassword);
        alert("Password changed successfully!");
        newPasswordInput.value = '';
    } catch (err) {
        alert("Failed to change password. Please log out and log back in to verify your identity.");
    }
});

deleteAccountBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    if (!confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) return;

    try {
        const uid = currentUser.uid;
        const chatsRef = collection(db, "users", uid, "chats");
        const chatsSnap = await getDocs(chatsRef);
        
        for (const chatDoc of chatsSnap.docs) {
            const msgsRef = collection(db, "users", uid, "chats", chatDoc.id, "messages");
            const msgsSnap = await getDocs(msgsRef);
            for (const msgDoc of msgsSnap.docs) {
                await deleteDoc(doc(db, "users", uid, "chats", chatDoc.id, "messages", msgDoc.id));
            }
            await deleteDoc(doc(db, "users", uid, "chats", chatDoc.id));
        }

        await deleteDoc(doc(db, "users", uid));
        await deleteUser(currentUser);
        window.top.location.href = "../home/index.html";
    } catch (err) {
        alert("Failed to delete account. You may need to log out and log back in first.");
    }
});

logoutBtn.addEventListener('click', async () => {
    if (unsubUser) unsubUser();
    if (unsubChats) unsubChats();
    activeMessageListeners.forEach(u => u());
    try {
        await signOut(auth);
        window.top.location.href = "../home/index.html";
    } catch (err) {}
});
