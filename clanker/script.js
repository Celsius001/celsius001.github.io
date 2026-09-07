import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    getFirestore, collection, addDoc, doc, deleteDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

const BACKEND_URL = "https://celsius-ai-backend.vercel.app/api/chat";

const landingView = document.getElementById('landingView');
const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatList = document.getElementById('chatList');
const messagesCountSpan = document.getElementById('messagesCount');
const progressFill = document.getElementById('progressFill');

let currentUser = null;
let currentChatId = null;
let messageCount = 0;
const MAX_MESSAGES = 60;
let unsubscribeChats = null;
let unsubscribeMessages = null;

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
    if (event.data) {
        if (event.data.action === 'updateTheme' || event.data.action === 'updateSettings') {
            applyCelsiusSettings();
        }
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        listenToChats();
    } else {
        window.location.href = "../index.html";
    }
});

userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if (this.value.trim().length > 0) {
        sendBtn.classList.add('active');
    } else {
        sendBtn.classList.remove('active');
    }
});

function updateUsageCounter() {
    messageCount++;
    messagesCountSpan.textContent = `${messageCount} / ${MAX_MESSAGES}`;
    const percentage = (messageCount / MAX_MESSAGES) * 100;
    progressFill.style.width = `${percentage}%`;
}

function listenToChats() {
    if (!currentUser) return;
    if (unsubscribeChats) unsubscribeChats();

    const chatsRef = collection(db, "users", currentUser.uid, "chats");
    const q = query(chatsRef, orderBy("createdAt", "desc"));

    unsubscribeChats = onSnapshot(q, (snapshot) => {
        chatList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const chatId = docSnap.id;
            
            const chatItem = document.createElement('div');
            chatItem.classList.add('chat-item');
            if (chatId === currentChatId) chatItem.classList.add('active');

            const titleSpan = document.createElement('span');
            titleSpan.classList.add('chat-title');
            titleSpan.textContent = data.title || "New Chat";

            const deleteBtn = document.createElement('button');
            deleteBtn.classList.add('delete-chat-btn');
            deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteChat(chatId);
            });

            chatItem.appendChild(titleSpan);
            chatItem.appendChild(deleteBtn);

            chatItem.addEventListener('click', () => {
                selectChat(chatId);
            });

            chatList.appendChild(chatItem);
        });
    });
}

async function selectChat(chatId) {
    currentChatId = chatId;
    landingView.classList.add('hidden');
    messagesContainer.classList.remove('hidden');
    
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    
    if (unsubscribeMessages) unsubscribeMessages();

    const messagesRef = collection(db, "users", currentUser.uid, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const msg = docSnap.data();
            appendMessageUI(msg.text, msg.sender);
        });
    });
}

async function deleteChat(chatId) {
    if (!currentUser) return;
    const chatDocRef = doc(db, "users", currentUser.uid, "chats", chatId);
    const msgsRef = collection(db, "users", currentUser.uid, "chats", chatId, "messages");
    
    const msgsSnap = await getDocs(msgsRef);
    msgsSnap.forEach(async (mDoc) => {
        await deleteDoc(doc(db, "users", currentUser.uid, "chats", chatId, "messages", mDoc.id));
    });
    
    await deleteDoc(chatDocRef);

    if (currentChatId === chatId) {
        resetToHome();
    }
}

function resetToHome() {
    currentChatId = null;
    if (unsubscribeMessages) unsubscribeMessages();
    messagesContainer.innerHTML = '';
    messagesContainer.classList.add('hidden');
    landingView.classList.remove('hidden');
}

function appendMessageUI(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    msgDiv.textContent = text;
    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return msgDiv;
}

async function sendMessage(text) {
    if (!text || !currentUser) return;

    if (messageCount >= MAX_MESSAGES) {
        alert("Daily limit reached.");
        return;
    }

    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.classList.remove('active');
    sendBtn.disabled = true;
    userInput.disabled = true;

    if (!currentChatId) {
        const chatsRef = collection(db, "users", currentUser.uid, "chats");
        const newChatDoc = await addDoc(chatsRef, {
            title: text.slice(0, 30),
            createdAt: serverTimestamp()
        });
        currentChatId = newChatDoc.id;
        await selectChat(currentChatId);
    }

    const messagesRef = collection(db, "users", currentUser.uid, "chats", currentChatId, "messages");
    
    await addDoc(messagesRef, {
        text: text,
        sender: 'user',
        createdAt: serverTimestamp()
    });

    const aiMessageDocRef = await addDoc(messagesRef, {
        text: '...',
        sender: 'ai',
        createdAt: serverTimestamp()
    });

    try {
        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: text,
                userId: currentUser.uid
            })
        });

        const data = await response.json();

        if (!response.ok) {
            await updateDoc(aiMessageDocRef, { text: data.error || "An error occurred with the AI API." });
            sendBtn.disabled = false;
            userInput.disabled = false;
            return;
        }

        const fullAiText = data.reply || "No response generated.";
        
        await updateDoc(aiMessageDocRef, { text: fullAiText });
        updateUsageCounter();

    } catch (err) {
        console.error(err);
        await updateDoc(aiMessageDocRef, { text: "Failed to communicate with the backend server. Make sure your Vercel deployment is live." });
    } finally {
        sendBtn.disabled = false;
        userInput.disabled = false;
        userInput.focus();
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

sendBtn.addEventListener('click', () => sendMessage(userInput.value.trim()));

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(userInput.value.trim());
    }
});

newChatBtn.addEventListener('click', () => {
    resetToHome();
});
