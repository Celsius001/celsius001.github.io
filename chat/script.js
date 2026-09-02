import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
let currentChannel = "general";
let unsubscribeMessages = null;
let unsubscribeUsers = null;
const userId = crypto.randomUUID();

const channelElements = document.querySelectorAll('.channel-item');
const currentChannelTitle = document.getElementById('current-channel-title');
const messagesList = document.getElementById('messages-list');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const usersList = document.getElementById('users-list');
const onlineCount = document.getElementById('online-count');
const currentUsernameDisplay = document.getElementById('current-username');

function initializeUser() {
    let storedName = localStorage.getItem('celsius_username');
    if (!storedName) {
        storedName = prompt("Enter your username to join celsius|chat:", "");
        if (!storedName || storedName.trim() === "") {
            storedName = "User_" + Math.floor(1000 + Math.random() * 9000);
        }
        localStorage.setItem('celsius_username', storedName.trim());
    }
    currentUser = storedName;
    currentUsernameDisplay.textContent = currentUser;
    registerUserPresence();
}

function registerUserPresence() {
    const userRef = doc(db, 'online_users', userId);
    setDoc(userRef, {
        username: currentUser,
        joinedAt: serverTimestamp()
    }).catch(err => {
        console.error("Error setting presence:", err);
    });

    window.addEventListener('beforeunload', () => {
        deleteDoc(userRef);
    });

    listenToOnlineUsers();
}

function listenToOnlineUsers() {
    const usersQuery = query(collection(db, 'online_users'), orderBy('joinedAt', 'desc'));
    if (unsubscribeUsers) {
        unsubscribeUsers();
    }
    unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        usersList.innerHTML = '';
        let count = 0;
        snapshot.forEach((docSnap) => {
            count++;
            const userData = docSnap.data();
            
            const userEl = document.createElement('div');
            userEl.className = 'user-item';
            
            const avatarEl = document.createElement('div');
            avatarEl.className = 'user-item-avatar';
            
            const iconImg = document.createElement('img');
            iconImg.src = 'favicon.ico';
            iconImg.alt = 'user';
            iconImg.className = 'avatar-favicon';
            avatarEl.appendChild(iconImg);
            
            const nameEl = document.createElement('div');
            nameEl.className = 'user-item-name';
            nameEl.textContent = userData.username || 'Anonymous';
            
            userEl.appendChild(avatarEl);
            userEl.appendChild(nameEl);
            usersList.appendChild(userEl);
        });
        onlineCount.textContent = count;
    }, (error) => {
        console.error("Firestore user listener error:", error);
    });
}

function switchChannel(channelName) {
    currentChannel = channelName;
    currentChannelTitle.textContent = currentChannel;
    messageInput.placeholder = `Message #${currentChannel}`;
    
    channelElements.forEach(el => {
        if (el.getAttribute('data-channel') === currentChannel) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    
    listenToMessages();
}

function formatTime(timestamp) {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function listenToMessages() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    messagesList.innerHTML = '';
    
    const q = query(collection(db, `messages_${currentChannel}`), orderBy('createdAt', 'asc'));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                const data = change.doc.data();
                appendMessage(data);
            }
        });
        scrollToBottom();
    }, (error) => {
        console.error("Firestore message listener error:", error);
    });
}

function appendMessage(data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message';
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    const avatarImg = document.createElement('img');
    avatarImg.src = 'favicon.ico';
    avatarImg.alt = 'avatar';
    avatarImg.className = 'avatar-favicon';
    avatar.appendChild(avatarImg);
    
    const content = document.createElement('div');
    content.className = 'message-content';
    
    const header = document.createElement('div');
    header.className = 'message-header';
    
    const author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = data.user || 'Anonymous';
    
    const time = document.createElement('span');
    time.className = 'message-timestamp';
    time.textContent = formatTime(data.createdAt);
    
    header.appendChild(author);
    header.appendChild(time);
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = data.text;
    
    content.appendChild(header);
    content.appendChild(text);
    
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
    
    const msgData = {
        text: text,
        user: currentUser,
        createdAt: serverTimestamp()
    };
    
    messageInput.value = '';
    
    addDoc(collection(db, `messages_${currentChannel}`), msgData).catch((error) => {
        console.error("Failed to send message:", error);
    });
}

channelElements.forEach(el => {
    el.addEventListener('click', () => {
        const channelName = el.getAttribute('data-channel');
        switchChannel(channelName);
    });
});

messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
    }
});

initializeUser();
switchChannel('general');
