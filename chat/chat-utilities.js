import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export class ChatUtilities {
    constructor(config) {
        this.db = config.db;
        this.getCurrentChannel = config.getChannel;
        this.getCurrentUser = config.getUser;
        this.inputArea = config.inputArea;
        this.messageInput = config.messageInput;
        this.replyState = null;
        this.replyBanner = null;
        this.setupReplyBanner();
    }

    setupReplyBanner() {
        if (!this.inputArea) return;
        this.replyBanner = document.createElement('div');
        this.replyBanner.className = 'reply-banner';
        this.replyBanner.style.cssText = 'display:none;align-items:center;background:var(--bg-panel);padding:6px 12px;border-radius:8px 8px 0 0;border:1px solid var(--border-color);border-bottom:none;font-size:12px;gap:8px;';
        this.inputArea.prepend(this.replyBanner);
    }

    setReply(msgId, author, text) {
        this.replyState = { id: msgId, author, text };
        if (this.replyBanner) {
            this.replyBanner.style.display = 'flex';
            this.replyBanner.innerHTML = `
                <span style="color:var(--text-secondary);">Replying to <b style="color:var(--text-primary);">${this.escapeHtml(author)}</b>: "${this.escapeHtml(text.slice(0, 45))}"</span>
                <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;margin-left:auto;font-size:14px;" id="cancelReply">&times;</button>
            `;
            this.replyBanner.querySelector('#cancelReply').addEventListener('click', () => this.clearReply());
        }
        if (this.messageInput) this.messageInput.focus();
    }

    clearReply() {
        this.replyState = null;
        if (this.replyBanner) {
            this.replyBanner.style.display = 'none';
            this.replyBanner.innerHTML = '';
        }
    }

    getReplyPayload() {
        return this.replyState;
    }

    createActionToolbar(msgId, data) {
        const toolbar = document.createElement('div');
        toolbar.className = 'msg-toolbar';
        toolbar.style.cssText = 'position:absolute;right:12px;top:-14px;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:6px;display:flex;gap:2px;padding:2px;opacity:0;pointer-events:none;transition:opacity 0.15s ease;z-index:5;';
        toolbar.innerHTML = `
            <button class="tool-btn" data-action="reply" title="Reply">↩️</button>
            <button class="tool-btn" data-action="react-thumbs" title="Like">👍</button>
            <button class="tool-btn" data-action="react-heart" title="Love">❤️</button>
            <button class="tool-btn" data-action="copy" title="Copy text">📋</button>
            ${data.user === this.getCurrentUser() ? '<button class="tool-btn delete" data-action="delete" title="Delete">🗑️</button>' : ''}
        `;

        // Style inner tool buttons
        toolbar.querySelectorAll('.tool-btn').forEach(b => {
            b.style.cssText = 'background:none;border:none;cursor:pointer;padding:2px 5px;font-size:12px;border-radius:4px;color:var(--text-primary);';
            b.addEventListener('mouseover', () => b.style.background = 'var(--bg-hover)');
            b.addEventListener('mouseout', () => b.style.background = 'none');
        });

        toolbar.addEventListener('click', async (e) => {
            const btn = e.target.closest('.tool-btn');
            if (!btn) return;
            const action = btn.dataset.action;
            const channel = this.getCurrentChannel();
            const docRef = doc(this.db, `messages_${channel}`, msgId);

            if (action === 'reply') {
                this.setReply(msgId, data.user, data.text);
            } else if (action === 'copy') {
                navigator.clipboard.writeText(data.text);
            } else if (action === 'delete') {
                await deleteDoc(docRef).catch(() => {});
            } else if (action === 'react-thumbs' || action === 'react-heart') {
                const emoji = action === 'react-thumbs' ? '👍' : '❤️';
                const user = this.getCurrentUser();
                const currentReactions = data.reactions || {};
                const usersReacted = currentReactions[emoji] || [];
                const hasReacted = usersReacted.includes(user);
                if (hasReacted) {
                    await updateDoc(docRef, { [`reactions.${emoji}`]: arrayRemove(user) }).catch(() => {});
                } else {
                    await updateDoc(docRef, { [`reactions.${emoji}`]: arrayUnion(user) }).catch(() => {});
                }
            }
        });

        return toolbar;
    }

    renderReactions(msgId, data) {
        const container = document.createElement('div');
        container.className = 'reactions-container';
        container.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;';
        const reactions = data.reactions || {};
        Object.entries(reactions).forEach(([emoji, users]) => {
            if (!Array.isArray(users) || users.length === 0) return;
            const pill = document.createElement('span');
            pill.className = 'reaction-pill' + (users.includes(this.getCurrentUser()) ? ' active' : '');
            pill.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;font-size:11px;background:${users.includes(this.getCurrentUser()) ? 'var(--bg-hover)' : 'var(--bg-panel)'};border:1px solid var(--border-color);cursor:pointer;`;
            pill.textContent = `${emoji} ${users.length}`;
            pill.addEventListener('click', async () => {
                const channel = this.getCurrentChannel();
                const docRef = doc(this.db, `messages_${channel}`, msgId);
                const user = this.getCurrentUser();
                if (users.includes(user)) {
                    await updateDoc(docRef, { [`reactions.${emoji}`]: arrayRemove(user) }).catch(() => {});
                } else {
                    await updateDoc(docRef, { [`reactions.${emoji}`]: arrayUnion(user) }).catch(() => {});
                }
            });
            container.appendChild(pill);
        });
        return container;
    }

    escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
    }
}
