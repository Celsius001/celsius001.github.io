import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ICONS = {
    reply: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`,
    forward: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`
};

const CHANNELS_LIST = ['general', 'music', 'gaming', 'lounge'];

export class ChatUtilities {
    constructor(config) {
        this.db = config.db;
        this.getCurrentChannel = config.getChannel;
        this.getCurrentUser = config.getUser;
        this.inputArea = config.inputArea;
        this.messageInput = config.messageInput;
        this.replyState = null;
        this.replyBanner = null;
        this.contextMenu = null;
        this.setupReplyBanner();
        this.setupContextMenuDOM();
    }

    setupReplyBanner() {
        if (!this.inputArea) return;
        this.replyBanner = document.createElement('div');
        this.replyBanner.className = 'reply-banner';
        this.replyBanner.style.cssText = 'display:none;align-items:center;background:var(--bg-panel);padding:8px 16px;border-radius:8px 8px 0 0;font-size:13px;gap:8px;color:var(--text-secondary);border:1px solid var(--border-color);border-bottom:none;';
        this.inputArea.prepend(this.replyBanner);
    }

    setReply(msgId, author, text, avatar) {
        this.replyState = { id: msgId, author, text, avatar };
        if (this.replyBanner) {
            this.replyBanner.style.display = 'flex';
            this.replyBanner.innerHTML = `
                <span>Replying to <b style="color:var(--text-primary);">@${this.escapeHtml(author)}</b></span>
                <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;margin-left:auto;font-size:16px;" id="cancelReply">&times;</button>
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

    setupContextMenuDOM() {
        this.contextMenu = document.createElement('div');
        this.contextMenu.className = 'celsius-ctx-menu';
        this.contextMenu.style.cssText = 'position:fixed;display:none;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:4px;padding:6px;box-shadow:0 8px 16px rgba(0,0,0,0.8);z-index:9999;min-width:180px;font-size:14px;color:var(--text-secondary);';
        document.body.appendChild(this.contextMenu);

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.celsius-ctx-menu')) this.hideContextMenu();
        });
        window.addEventListener('scroll', () => this.hideContextMenu(), true);
    }

    hideContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.style.display = 'none';
            this.contextMenu.innerHTML = '';
        }
    }

    attachMessageContextMenu(msgDiv, msgId, data) {
        msgDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY, msgId, data);
        });
    }

    showContextMenu(x, y, msgId, data) {
        const isOwner = data.user === this.getCurrentUser();
        this.contextMenu.innerHTML = `
            <div class="ctx-item" data-action="reply">
                ${ICONS.reply} <span style="font-weight:500;">Reply</span>
            </div>
            <div class="ctx-item has-submenu" data-action="forward-menu">
                ${ICONS.forward} <span style="font-weight:500;">Forward to...</span>
                <div class="ctx-submenu">
                    ${CHANNELS_LIST.map(ch => `<div class="ctx-sub-item" data-target-channel="${ch}"># ${ch}</div>`).join('')}
                </div>
            </div>
            <div class="ctx-divider"></div>
            <div class="ctx-item" data-action="react-thumbs">👍 <span>Thumbs Up</span></div>
            <div class="ctx-item" data-action="react-heart">❤️ <span>Love</span></div>
            <div class="ctx-divider"></div>
            <div class="ctx-item" data-action="copy">
                ${ICONS.copy} <span>Copy text</span>
            </div>
            ${isOwner ? `<div class="ctx-item danger" data-action="delete">${ICONS.trash} <span>Delete Message</span></div>` : ''}
        `;

        const items = this.contextMenu.querySelectorAll('.ctx-item:not(.has-submenu)');
        items.forEach(it => {
            it.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:3px;cursor:pointer;transition:background 0.1s, color 0.1s;';
            it.addEventListener('mouseover', () => { it.style.background = 'var(--bg-hover)'; it.style.color = 'var(--text-primary)'; });
            it.addEventListener('mouseout', () => { it.style.background = 'transparent'; it.style.color = 'var(--text-secondary)'; });
            if (it.classList.contains('danger')) {
                it.style.color = '#ffffff';
                it.addEventListener('mouseout', () => { it.style.color = '#ffffff'; it.style.background = 'transparent'; });
                it.addEventListener('mouseover', () => { it.style.background = '#ffffff'; it.style.color = '#000000'; });
            }
        });

        const forwardParent = this.contextMenu.querySelector('.has-submenu');
        forwardParent.style.cssText = 'position:relative;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:3px;cursor:pointer; transition:background 0.1s;';
        
        const submenu = forwardParent.querySelector('.ctx-submenu');
        submenu.style.cssText = 'position:absolute;left:100%;top:0;display:none;background:var(--bg-panel);border:1px solid var(--border-color);border-radius:4px;padding:6px;min-width:160px;box-shadow:0 8px 16px rgba(0,0,0,0.8);';
        
        forwardParent.addEventListener('mouseover', () => {
            forwardParent.style.background = 'var(--bg-hover)';
            forwardParent.style.color = 'var(--text-primary)';
            submenu.style.display = 'block';
        });
        forwardParent.addEventListener('mouseout', (e) => {
            if (!forwardParent.contains(e.relatedTarget)) {
                forwardParent.style.background = 'transparent';
                forwardParent.style.color = 'var(--text-secondary)';
                submenu.style.display = 'none';
            }
        });

        submenu.querySelectorAll('.ctx-sub-item').forEach(sub => {
            sub.style.cssText = 'padding:8px 10px;border-radius:3px;cursor:pointer;color:var(--text-secondary);font-weight:500;';
            sub.addEventListener('mouseover', () => { sub.style.background = 'var(--bg-hover)'; sub.style.color = 'var(--text-primary)'; });
            sub.addEventListener('mouseout', () => { sub.style.background = 'transparent'; sub.style.color = 'var(--text-secondary)'; });
            sub.addEventListener('click', async (evt) => {
                evt.stopPropagation();
                const targetChannel = sub.dataset.targetChannel;
                await this.forwardMessage(targetChannel, data);
                this.hideContextMenu();
            });
        });

        const divider = this.contextMenu.querySelector('.ctx-divider');
        if (divider) divider.style.cssText = 'height:1px;background:var(--border-color);margin:4px 4px;';

        this.contextMenu.style.display = 'block';
        const rect = this.contextMenu.getBoundingClientRect();
        const finalX = x + rect.width > window.innerWidth ? x - rect.width : x;
        const finalY = y + rect.height > window.innerHeight ? y - rect.height : y;
        this.contextMenu.style.left = `${finalX}px`;
        this.contextMenu.style.top = `${finalY}px`;

        this.contextMenu.querySelectorAll('.ctx-item:not(.has-submenu)').forEach(item => {
            item.addEventListener('click', async () => {
                const action = item.dataset.action;
                const channel = this.getCurrentChannel();
                const docRef = doc(this.db, `messages_${channel}`, msgId);

                if (action === 'reply') {
                    this.setReply(msgId, data.user, data.text, data.avatar);
                } else if (action === 'copy') {
                    navigator.clipboard.writeText(data.text);
                } else if (action === 'delete') {
                    await deleteDoc(docRef).catch(() => {});
                } else if (action === 'react-thumbs' || action === 'react-heart') {
                    const emoji = action === 'react-thumbs' ? '👍' : '❤️';
                    const user = this.getCurrentUser();
                    const currentReactions = data.reactions || {};
                    const usersReacted = currentReactions[emoji] || [];
                    if (usersReacted.includes(user)) {
                        await updateDoc(docRef, { [`reactions.${emoji}`]: arrayRemove(user) }).catch(() => {});
                    } else {
                        await updateDoc(docRef, { [`reactions.${emoji}`]: arrayUnion(user) }).catch(() => {});
                    }
                }
                this.hideContextMenu();
            });
        });
    }

    async forwardMessage(targetChannel, data) {
        if (!targetChannel) return;
        const currentChannel = this.getCurrentChannel();
        const fwdPayload = {
            text: `[Forwarded from #${currentChannel}] ${data.text}`,
            user: this.getCurrentUser(),
            avatar: data.avatar || '../favicon.ico',
            createdAt: serverTimestamp(),
            forwardedFrom: currentChannel
        };
        await addDoc(collection(this.db, `messages_${targetChannel}`), fwdPayload).catch(() => {});
    }

    renderReactions(msgId, data) {
        const container = document.createElement('div');
        container.className = 'reactions-container';
        container.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;';
        const reactions = data.reactions || {};
        Object.entries(reactions).forEach(([emoji, users]) => {
            if (!Array.isArray(users) || users.length === 0) return;
            const hasReacted = users.includes(this.getCurrentUser());
            const pill = document.createElement('span');
            pill.className = 'reaction-pill' + (hasReacted ? ' active' : '');
            pill.style.cssText = `display:flex;align-items:center;gap:6px;padding:2px 6px;border-radius:8px;font-size:13px;font-weight:600;background:${hasReacted ? 'var(--bg-hover)' : 'var(--bg-panel)'};border:1px solid ${hasReacted ? 'var(--text-primary)' : 'var(--border-color)'};cursor:pointer;user-select:none;color:${hasReacted ? 'var(--text-primary)' : 'var(--text-secondary)'};`;
            pill.textContent = `${emoji} ${users.length}`;
            
            pill.addEventListener('mouseover', () => { if (!hasReacted) pill.style.border = '1px solid var(--text-muted)'; });
            pill.addEventListener('mouseout', () => { if (!hasReacted) pill.style.border = '1px solid var(--border-color)'; });
            
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
