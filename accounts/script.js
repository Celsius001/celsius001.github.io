import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, updatePassword, updateProfile, deleteUser, signOut, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
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
const backHomeBtn = document.getElementById('backHomeBtn');
const statMessages = document.getElementById('statMessages');
const statGameTime = document.getElementById('statGameTime');
const avatarContainer = document.getElementById('avatarContainer');
const avatarInput = document.getElementById('avatarInput');
const profileAvatar = document.getElementById('profileAvatar');

let currentUser = null;
let unsubUser = null;
let unsubGlobalChat = null;
let unsubMessages = null;

backHomeBtn.addEventListener('click', () => {
    window.top.location.href = "../home/index.html";
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        userEmailInput.value = user.email || "";
        usernameInput.value = user.displayName || "";
        if (user.photoURL) {
            profileAvatar.src = user.photoURL;
        } else {
            profileAvatar.src = "../favicon.ico";
        }
        setupDataFeed(user);
    } else {
        window.top.location.href = "../index.html";
    }
});

function setupDataFeed(user) {
    unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        let gameMinutes = 0;
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.gameMinutes) {
                gameMinutes = data.gameMinutes;
            } else if (data.gameHours) {
                gameMinutes = Math.round(data.gameHours * 60);
            }
            if (data.photoURL) {
                profileAvatar.src = data.photoURL;
            }
        }
        const h = Math.floor(gameMinutes / 60);
        const m = gameMinutes % 60;
        statGameTime.textContent = `${h}h ${m}m`;
    });

    const processChatSnapshots = (snapshots) => {
        let count = 0;
        snapshots.forEach(snap => {
            if (!snap.empty) {
                snap.forEach(d => {
                    const data = d.data();
                    const sender = data.uid || data.userId || data.senderId || data.sender;
                    const name = data.username || data.name || data.displayName;
                    if (sender === user.uid || sender === user.email || name === user.displayName) {
                        count++;
                    }
                });
            }
        });
        statMessages.textContent = count;
    };

    let chatDocs = [];
    let messagesDocs = [];

    unsubGlobalChat = onSnapshot(collection(db, "chat"), (snapshot) => {
        chatDocs = snapshot.docs;
        processChatSnapshots([chatDocs, messagesDocs]);
    }, () => {});

    unsubMessages = onSnapshot(collection(db, "messages"), (snapshot) => {
        messagesDocs = snapshot.docs;
        processChatSnapshots([chatDocs, messagesDocs]);
    }, () => {});
}

function processImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max = 150;
                if (width > height) {
                    if (width > max) {
                        height *= max / width;
                        width = max;
                    }
                } else {
                    if (height > max) {
                        width *= max / height;
                        height = max;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

avatarContainer.addEventListener('click', () => {
    avatarInput.click();
});

avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    if (!file.type.startsWith('image/')) {
        alert("Please select a valid image file.");
        return;
    }
    try {
        const optimizedUrl = await processImageFile(file);
        await updateProfile(currentUser, { photoURL: optimizedUrl });
        await setDoc(doc(db, "users", currentUser.uid), { photoURL: optimizedUrl }, { merge: true });
        profileAvatar.src = optimizedUrl;
        alert("Profile picture updated successfully!");
    } catch (err) {
        alert("Failed to update profile picture. Please try another image.");
    }
});

profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const nameVal = usernameInput.value.trim();
    if (!nameVal) return;
    try {
        await updateProfile(currentUser, { displayName: nameVal });
        await setDoc(doc(db, "users", currentUser.uid), { username: nameVal }, { merge: true });
        alert("Username updated successfully!");
    } catch (err) {
        alert("Failed to update username.");
    }
});

passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const pwdVal = newPasswordInput.value;
    if (pwdVal.length < 6) {
        alert("Password must be at least 6 characters long.");
        return;
    }
    try {
        await updatePassword(currentUser, pwdVal);
        alert("Password updated successfully!");
        newPasswordInput.value = '';
    } catch (err) {
        alert("Failed to update password. Please sign out and sign back in before changing your password.");
    }
});

deleteAccountBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    if (!confirm("Are you sure you want to permanently delete your account? All data will be lost.")) return;

    const cleanupAndRedirect = async () => {
        try {
            const uid = currentUser.uid;
            const chatsRef = collection(db, "users", uid, "chats");
            const chatsSnap = await getDocs(chatsRef);
            for (const cDoc of chatsSnap.docs) {
                const msgsRef = collection(db, "users", uid, "chats", cDoc.id, "messages");
                const msgsSnap = await getDocs(msgsRef);
                for (const mDoc of msgsSnap.docs) {
                    await deleteDoc(doc(db, "users", uid, "chats", cDoc.id, "messages", mDoc.id));
                }
                await deleteDoc(doc(db, "users", uid, "chats", cDoc.id));
            }
            await deleteDoc(doc(db, "users", uid));
            await deleteUser(currentUser);
        } catch (err) {}
        window.top.location.href = "../index.html";
    };

    try {
        await cleanupAndRedirect();
    } catch (error) {
        if (error.code === 'auth/requires-recent-login') {
            const pwd = prompt("For security, please enter your password to confirm account deletion:");
            if (!pwd) return;
            try {
                const credential = EmailAuthProvider.credential(currentUser.email, pwd);
                await reauthenticateWithCredential(currentUser, credential);
                await cleanupAndRedirect();
            } catch (reauthErr) {
                alert("Incorrect password or re-authentication failed.");
            }
        } else {
            alert("Deletion failed: " + error.message);
        }
    }
});

logoutBtn.addEventListener('click', async () => {
    if (unsubUser) unsubUser();
    if (unsubGlobalChat) unsubGlobalChat();
    if (unsubMessages) unsubMessages();
    try {
        await signOut(auth);
    } catch (err) {}
    window.top.location.href = "../index.html";
});
