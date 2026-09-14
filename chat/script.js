import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { ChatUtilities } from "./chat-utilities.js";

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
let currentChannel = "general";
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let presenceInterval = null;

const channelElements = document.querySelectorAll('.channel-item');
const currentChannelTitle = document.getElementById('current-channel-title');
const messagesList = document.getElementById('messages-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const inputArea = document.getElementById('input-area');
const usersList = document.getElementById('users-list');
const onlineCount = document.getElementById('online-count');
const currentUsernameDisplay = document.getElementById('current-username');

const chatUtils = new ChatUtilities({
    db,
    getChannel: () => currentChannel,
    getUser: () => currentUser,
    inputArea,
    messageInput
});

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
            document.body.style.backgroundColor = theme.bg;
            document.body.style.color = theme.text;
        } catch (e) {}
    }
}
applyCelsiusSettings();

window.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'updateTheme' || event.data.action === 'updateSettings')) {
        applyCelsiusSettings();
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (user.displayName) {
            currentUser = user.displayName;
        } else {
            let storedName = localStorage.getItem('celsius_username');
            if (!storedName) {
                storedName = prompt("Enter your username to join celsius|chat:", "");
                if (!storedName || storedName.trim() === "") storedName = "User_" + Math.floor(1000 + Math.random() * 9000);
            }
            currentUser = storedName.trim();
            localStorage.setItem('celsius_username', currentUser);
            await updateProfile(user, { displayName: currentUser }).catch(() => {});
        }
        currentUsernameDisplay.textContent = currentUser;
        registerUserPresence();
        switchChannel('general');
    } else {
        signInAnonymously(auth).catch(() => {});
    }
});

function registerUserPresence() {
    const userRef = doc(db, 'online_users', currentUser);
    const sendHeartbeat = () => {
        setDoc(userRef, { username: currentUser, lastSeen: Date.now() }, { merge: true }).catch(() => {});
    };
    sendHeartbeat();
    if (presenceInterval) clearInterval(presenceInterval);
    presenceInterval = setInterval(sendHeartbeat, 5000);
    window.addEventListener('beforeunload', () => { clearInterval(presenceInterval); deleteDoc(userRef); });
    listenToOnlineUsers();
}

function listenToOnlineUsers() {
    const usersQuery = query(collection(db, 'online_users'), orderBy('lastSeen', 'desc'));
    if (unsubscribeUsers) unsubscribeUsers();
    unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        usersList.innerHTML = '';
        let count = 0;
        const now = Date.now();
        snapshot.forEach((docSnap) => {
            const userData = docSnap.data();
            if (!userData.lastSeen || (now - userData.lastSeen) > 15000) return;
            count++;
            const userEl = document.createElement('div');
            userEl.className = 'user-item';
            userEl.innerHTML = `<div class="user-item-avatar"><img src="../favicon.ico" class="avatar-favicon"></div><div class="user-item-name">${chatUtils.escapeHtml(userData.username)}</div>`;
            usersList.appendChild(userEl);
        });
        onlineCount.textContent = count;
    }, () => {});
}

async function purgeExpiredMessages(channelName) {
    try {
        const q = query(collection(db, `messages_${channelName}`));
        const snapshot = await getDocs(q);
        const cutoff = Date.now() - (24 * 60 * 60 * 1000);
        snapshot.forEach(async (docSnap) => {
            const data = docSnap.data();
            if (data.createdAt && typeof data.createdAt.toMillis === 'function') {
                if (data.createdAt.toMillis() < cutoff) {
                    await deleteDoc(docSnap.ref).catch(() => {});
                }
            }
        });
    } catch (e) {}
}

function switchChannel(channelName) {
    currentChannel = channelName;
    currentChannelTitle.textContent = currentChannel;
    messageInput.placeholder = `Message #${channelName}`;
    channelElements.forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-channel') === currentChannel);
    });
    chatUtils.clearReply();
    purgeExpiredMessages(channelName);
    listenToMessages();
}

function formatTime(timestamp) {
    if (!timestamp) return "Just now";
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function listenToMessages() {
    if (unsubscribeMessages) unsubscribeMessages();
    messagesList.innerHTML = '';
    const q = query(collection(db, `messages_${currentChannel}`), orderBy('createdAt', 'asc'));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            appendMessage(docSnap.id, docSnap.data());
        });
        scrollToBottom();
    }, () => {});
}

function appendMessage(msgId, data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    msgDiv.style.position = 'relative';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `<img src="../favicon.ico" class="avatar-favicon">`;

    const content = document.createElement('div');
    content.className = 'message-content';

    if (data.replyTo) {
        const replyTag = document.createElement('div');
        replyTag.style.cssText = 'font-size:11px;color:var(--text-secondary);margin-bottom:2px;display:flex;align-items:center;gap:4px;';
        replyTag.innerHTML = `↪️ Replying to <b>${chatUtils.escapeHtml(data.replyTo.author)}</b>`;
        content.appendChild(replyTag);
    }

    if (data.forwardedFrom) {
        const fwdTag = document.createElement('div');
        fwdTag.style.cssText = 'font-size:11px;color:var(--text-secondary);margin-bottom:2px;display:flex;align-items:center;gap:4px;';
        fwdTag.innerHTML = `➡️ Forwarded from #${chatUtils.escapeHtml(data.forwardedFrom)}`;
        content.appendChild(fwdTag);
    }

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `<span class="message-author">${chatUtils.escapeHtml(data.user || 'Anonymous')}</span><span class="message-timestamp">${formatTime(data.createdAt)}</span>`;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = data.text;

    content.appendChild(header);
    content.appendChild(text);
    content.appendChild(chatUtils.renderReactions(msgId, data));

    chatUtils.attachMessageContextMenu(msgDiv, msgId, data);
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);

    messagesList.appendChild(msgDiv);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === "") return;
    const replyPayload = chatUtils.getReplyPayload();

    const msgData = {
        text,
        user: currentUser,
        createdAt: serverTimestamp(),
        ...(replyPayload ? { replyTo: { id: replyPayload.id, author: replyPayload.author, text: replyPayload.text } } : {})
    };

    messageInput.value = '';
    chatUtils.clearReply();
    addDoc(collection(db, `messages_${currentChannel}`), msgData).catch(() => {});
}

channelElements.forEach(el => {
    el.addEventListener('click', () => switchChannel(el.getAttribute('data-channel')));
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});
