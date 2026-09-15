import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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

let currentUser = "";
let currentAvatar = "../favicon.ico";
let currentChannel = "general";
let unsubscribeMessages = null;
let unsubscribeUsers = null;
let presenceInterval = null;

const channelElements = document.querySelectorAll('.channel-item');
const currentChannelTitle = document.getElementById('current-channel-title');
const welcomeChannelName = document.getElementById('welcome-channel-name');
const messagesList = document.getElementById('messages-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const inputArea = document.getElementById('input-area');
const usersList = document.getElementById('users-list');
const onlineCount = document.getElementById('online-count');
const currentUsernameDisplay = document.getElementById('current-username');
const currentUserAvatarDisplay = document.getElementById('current-user-avatar');

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
            root.style.setProperty('--bg-hover', theme.panel);
            root.style.setProperty('--bg-message-hover', 'rgba(255,255,255,0.05)');
        } catch (e) {}
    }
}
applyCelsiusSettings();

window.addEventListener('message', (event) => {
    if (event.data && (event.data.action === 'updateTheme' || event.data.action === 'updateSettings')) {
        applyCelsiusSettings();
    }
});

function initUser() {
    currentUser = localStorage.getItem('celsius_username') || "User_" + Math.floor(1000 + Math.random() * 9000);
    currentAvatar = localStorage.getItem('celsius_avatar') || "../favicon.ico";

    currentUsernameDisplay.textContent = currentUser;
    currentUserAvatarDisplay.src = currentAvatar;

    registerUserPresence();
    switchChannel('general');
}

function registerUserPresence() {
    const userRef = doc(db, 'online_users', currentUser);
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
            userEl.innerHTML = `
                <div class="user-item-avatar">
                    <img src="${userData.avatar || '../favicon.ico'}" alt="pfp">
                </div>
                <div class="user-item-name">${chatUtils.escapeHtml(userData.username)}</div>
            `;
            
            userEl.addEventListener('click', () => {
                window.location.href = '../accounts/index.html';
            });
            
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
    welcomeChannelName.textContent = currentChannel;
    messageInput.placeholder = `Message #${channelName}`;
    channelElements.forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-channel') === currentChannel);
    });
    chatUtils.clearReply();
    purgeExpiredMessages(channelName);
    listenToMessages();
}

function formatTime(timestamp) {
    if (!timestamp) return "Today at " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = timestamp.toDate();
    const today = new Date();
    const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth();
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return isToday ? `Today at ${timeStr}` : `${date.toLocaleDateString()} ${timeStr}`;
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

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar-container';
    avatarDiv.innerHTML = `<img src="${data.avatar || '../favicon.ico'}" class="message-avatar">`;

    const content = document.createElement('div');
    content.className = 'message-content';

    if (data.replyTo) {
        const replyContext = document.createElement('div');
        replyContext.className = 'reply-context';
        replyContext.innerHTML = `
            <img src="${data.replyTo.avatar || '../favicon.ico'}" style="width:16px;height:16px;border-radius:50%;" alt="">
            <span class="reply-author">@${chatUtils.escapeHtml(data.replyTo.author)}</span>
            <span class="reply-text-preview">${chatUtils.escapeHtml(data.replyTo.text)}</span>
        `;
        content.appendChild(replyContext);
    }

    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerHTML = `
        <span class="message-author">${chatUtils.escapeHtml(data.user || 'Anonymous')}</span>
        <span class="message-timestamp">${formatTime(data.createdAt)}</span>
    `;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = data.text;

    content.appendChild(header);
    content.appendChild(text);
    content.appendChild(chatUtils.renderReactions(msgId, data));

    chatUtils.attachMessageContextMenu(msgDiv, msgId, data);
    msgDiv.appendChild(avatarDiv);
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
        avatar: currentAvatar,
        createdAt: serverTimestamp(),
        ...(replyPayload ? { replyTo: { id: replyPayload.id, author: replyPayload.author, text: replyPayload.text, avatar: replyPayload.avatar } } : {})
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

document.getElementById('nav-friends').addEventListener('click', () => {
    window.location.href = '../friends/index.html';
});

initUser();
