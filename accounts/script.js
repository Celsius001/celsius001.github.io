import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, updateProfile, deleteUser, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let currentUser = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        userEmailInput.value = user.email || "";
        usernameInput.value = user.displayName || "";
        await loadUserStats(user.uid);
    } else {
        window.location.href = "../index.html";
    }
});

async function loadUserStats(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userDocSnap = await getDoc(userDocRef);

        let totalMessages = 0;
        let gameHours = 0;

        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            gameHours = data.gameHours || 0;
        }

        const chatsRef = collection(db, "users", uid, "chats");
        const chatsSnap = await getDocs(chatsRef);
        
        for (const chatDoc of chatsSnap.docs) {
            const msgsRef = collection(db, "users", uid, "chats", chatDoc.id, "messages");
            const msgsSnap = await getDocs(msgsRef);
            msgsSnap.forEach(m => {
                if (m.data().sender === 'user') totalMessages++;
            });
        }

        statMessages.textContent = totalMessages;
        
        const h = Math.floor(gameHours);
        const m = Math.round((gameHours - h) * 60);
        statGameHours.textContent = `${h} hours ${m} minutes`;
    } catch (err) {
        console.error(err);
    }
}

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const newUsername = usernameInput.value.trim();
    if (!newUsername) return;

    try {
        await updateProfile(currentUser, { displayName: newUsername });
        
        const userDocRef = doc(db, "users", currentUser.uid);
        await setDoc(userDocRef, { username: newUsername }, { merge: true });

        alert("Username updated successfully!");
    } catch (err) {
        console.error(err);
        alert("Failed to update username: " + err.message);
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
        console.error(err);
        alert("Failed to change password. You may need to log out and log back in before updating security credentials.");
    }
});

deleteAccountBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    
    const confirmation = confirm("Are you sure you want to permanently delete your account? This action cannot be undone.");
    if (!confirmation) return;

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
        alert("Account deleted.");
        window.location.href = "../index.html";
    } catch (err) {
        console.error(err);
        alert("Failed to delete account: " + err.message);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = "../index.html";
    } catch (err) {
        console.error(err);
    }
});
