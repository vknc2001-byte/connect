// FireChat - Main Application Logic
// Uses Firebase 10 Modular Web SDK

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  query, 
  where,
  orderBy, 
  serverTimestamp, 
  updateDoc 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { 
  getFirebaseConfig, 
  saveFirebaseConfig, 
  clearFirebaseConfig, 
  isValidConfig 
} from './firebase-config.js?v=4';

// Global App State
let app = null;
let auth = null;
let db = null;
let currentUser = null;
let selectedUser = null;
let registeredUsers = [];
let activeChatUnsubscribe = null;
let usersListUnsubscribe = null;
let globalChatsUnsubscribe = null;
let lastKnownChatTimestamps = {};
let selectedAttachment = null; // { file, previewUrl, type, name, size }

// Camera State
let cameraStream = null;
let cameraFacingMode = 'environment';

// Toast Notification State
let toastDismissTimer = null;
let activeToastSenderId = null;

// DOM Element References
const elements = {
  // Views
  authView: document.getElementById('auth-view'),
  chatView: document.getElementById('chat-view'),

  // Header
  configStatusBadge: document.getElementById('config-status-badge'),
  userHeaderProfile: document.getElementById('user-header-profile'),
  headerAvatar: document.getElementById('header-avatar'),
  headerUserName: document.getElementById('header-user-name'),
  logoutBtn: document.getElementById('logout-btn'),

  // Toast Notification Bar
  toastNotificationBar: document.getElementById('toast-notification-bar'),
  toastAvatar: document.getElementById('toast-avatar'),
  toastSenderName: document.getElementById('toast-sender-name'),
  toastMessageText: document.getElementById('toast-message-text'),
  toastBodyBtn: document.getElementById('toast-body-btn'),
  toastCloseBtn: document.getElementById('toast-close-btn'),

  // Auth View
  googleLoginBtn: document.getElementById('google-login-btn'),
  authErrorMsg: document.getElementById('auth-error-msg'),
  setupHintCard: document.getElementById('setup-hint-card'),
  setupHintText: document.getElementById('setup-hint-text'),
  openConfigBtn: document.getElementById('open-config-btn'),

  // Sidebar
  sidebarUserAvatar: document.getElementById('sidebar-user-avatar'),
  sidebarUserName: document.getElementById('sidebar-user-name'),
  sidebarUserEmail: document.getElementById('sidebar-user-email'),
  userSearchInput: document.getElementById('user-search-input'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  usersCountBadge: document.getElementById('users-count-badge'),
  usersList: document.getElementById('users-list'),

  // Chat Area
  noChatState: document.getElementById('no-chat-state'),
  activeChatContainer: document.getElementById('active-chat-container'),
  mobileBackBtn: document.getElementById('mobile-back-btn'),
  recipientAvatar: document.getElementById('recipient-avatar'),
  recipientStatusDot: document.getElementById('recipient-status-dot'),
  recipientName: document.getElementById('recipient-name'),
  recipientStatusText: document.getElementById('recipient-status-text'),
  messagesContainer: document.getElementById('messages-container'),
  chatLoadingSpinner: document.getElementById('chat-loading-spinner'),

  // Attachments & Preview
  mediaPreviewContainer: document.getElementById('media-preview-container'),
  previewMediaWrapper: document.getElementById('preview-media-wrapper'),
  previewFileName: document.getElementById('preview-file-name'),
  previewFileSize: document.getElementById('preview-file-size'),
  mediaCaptionInput: document.getElementById('media-caption-input'),
  cancelPreviewBtn: document.getElementById('cancel-preview-btn'),

  // Upload Progress
  uploadProgressContainer: document.getElementById('upload-progress-container'),
  uploadStatusLabel: document.getElementById('upload-status-label'),
  uploadPercentLabel: document.getElementById('upload-percent-label'),
  progressBarFill: document.getElementById('progress-bar-fill'),

  // Chat Input
  chatForm: document.getElementById('chat-form'),
  mediaFileInput: document.getElementById('media-file-input'),
  cameraFileInput: document.getElementById('camera-file-input'),
  cameraBtn: document.getElementById('camera-btn'),
  attachBtn: document.getElementById('attach-btn'),
  messageTextInput: document.getElementById('message-text-input'),
  sendMessageBtn: document.getElementById('send-message-btn'),

  // Camera Modal
  cameraModal: document.getElementById('camera-modal'),
  closeCameraModalBtn: document.getElementById('close-camera-modal-btn'),
  cameraVideoStream: document.getElementById('camera-video-stream'),
  cameraSnapshotCanvas: document.getElementById('camera-snapshot-canvas'),
  cameraLoading: document.getElementById('camera-loading'),
  cameraSwitchBtn: document.getElementById('camera-switch-btn'),
  cameraCaptureBtn: document.getElementById('camera-capture-btn'),
  cameraPostCaptureActions: document.getElementById('camera-post-capture-actions'),
  cameraRetakeBtn: document.getElementById('camera-retake-btn'),
  cameraUseBtn: document.getElementById('camera-use-btn'),

  // Config Modal
  firebaseModal: document.getElementById('firebase-modal'),
  closeConfigModalBtn: document.getElementById('close-config-modal-btn'),
  cancelConfigBtn: document.getElementById('cancel-config-btn'),
  saveConfigBtn: document.getElementById('save-config-btn'),
  clearConfigBtn: document.getElementById('clear-config-btn'),
  configPasteArea: document.getElementById('config-paste-area'),
  parsePastedConfigBtn: document.getElementById('parse-pasted-config-btn'),
  cfgApiKey: document.getElementById('cfg-apiKey'),
  cfgAuthDomain: document.getElementById('cfg-authDomain'),
  cfgProjectId: document.getElementById('cfg-projectId'),
  cfgMessagingSenderId: document.getElementById('cfg-messagingSenderId'),
  cfgAppId: document.getElementById('cfg-appId'),

  // Lightbox Modal
  lightboxModal: document.getElementById('lightbox-modal'),
  closeLightboxBtn: document.getElementById('close-lightbox-btn'),
  lightboxContent: document.getElementById('lightbox-content')
};

// ==========================================================================
// Initialization
// ==========================================================================

async function initialize() {
  setupEventListeners();

  const { config, source } = await getFirebaseConfig();

  if (config && isValidConfig(config)) {
    try {
      initFirebase(config);
      updateConfigStatusBadge(true, 'Firebase Connected');
      elements.setupHintCard.classList.add('hidden');
    } catch (err) {
      console.error('Firebase init failed:', err);
      updateConfigStatusBadge(false, 'Config Error');
      showSetupHint('Firebase initialization error. Please check your credentials.');
    }
  } else {
    updateConfigStatusBadge(false, 'Configure Firebase');
    showSetupHint('Firebase is not yet configured. Please add your credentials.');
  }
}

/**
 * Initialize Firebase services
 */
function initFirebase(config) {
  app = initializeApp(config);
  auth = getAuth(app);
  db = getFirestore(app);

  // Monitor auth state
  onAuthStateChanged(auth, handleAuthStateChanged);
}

function updateConfigStatusBadge(connected, text) {
  const badge = elements.configStatusBadge;
  badge.className = 'status-badge ' + (connected ? 'connected' : 'warning');
  badge.querySelector('.status-text').textContent = text;
}

function showSetupHint(msg) {
  elements.setupHintCard.classList.remove('hidden');
  elements.setupHintText.textContent = msg;
}

// ==========================================================================
// Authentication Handling
// ==========================================================================

async function handleAuthStateChanged(user) {
  if (user) {
    currentUser = user;
    console.log('User signed in:', user.displayName, user.email);

    // Update user profile in Firestore
    await upsertUserToFirestore(user);

    // Update UI headers
    const photo = user.photoURL || createInitialsAvatar(user.displayName || user.email);
    elements.headerAvatar.src = photo;
    elements.headerUserName.textContent = user.displayName || user.email.split('@')[0];
    elements.sidebarUserAvatar.src = photo;
    elements.sidebarUserName.textContent = user.displayName || 'User';
    elements.sidebarUserEmail.textContent = user.email;

    // Switch view
    elements.authView.classList.add('hidden');
    elements.chatView.classList.remove('hidden');
    elements.userHeaderProfile.classList.remove('hidden');

    // Subscribe to registered users & global message notifications
    subscribeToRegisteredUsers();
    subscribeToGlobalChatNotifications();
  } else {
    currentUser = null;
    selectedUser = null;

    if (usersListUnsubscribe) {
      usersListUnsubscribe();
      usersListUnsubscribe = null;
    }
    if (activeChatUnsubscribe) {
      activeChatUnsubscribe();
      activeChatUnsubscribe = null;
    }
    if (globalChatsUnsubscribe) {
      globalChatsUnsubscribe();
      globalChatsUnsubscribe = null;
    }

    elements.authView.classList.remove('hidden');
    elements.chatView.classList.add('hidden');
    elements.userHeaderProfile.classList.add('hidden');
    elements.noChatState.classList.remove('hidden');
    elements.activeChatContainer.classList.add('hidden');
  }
}

/**
 * Save / Update user document in Firestore 'users' collection
 */
async function upsertUserToFirestore(user, status = 'online') {
  if (!db || !user) return;
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      uid: user.uid,
      displayName: user.displayName || user.email.split('@')[0],
      email: user.email,
      photoURL: user.photoURL || '',
      status: status,
      lastSeen: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('Could not update user document in Firestore:', err);
  }
}

/**
 * Google Sign In Handler
 */
async function loginWithGoogle() {
  elements.authErrorMsg.classList.add('hidden');

  if (!auth) {
    elements.authErrorMsg.textContent = 'Please configure your Firebase credentials first.';
    elements.authErrorMsg.classList.remove('hidden');
    openConfigModal();
    return;
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    elements.googleLoginBtn.disabled = true;
    elements.googleLoginBtn.style.opacity = '0.7';
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error('Google Sign In error:', err);
    let message = 'Sign in failed. ';
    if (err.code === 'auth/popup-closed-by-user') {
      message = 'Sign in popup was closed. Please try again.';
    } else if (err.code === 'auth/unauthorized-domain') {
      message = 'Domain not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.';
    } else if (err.code === 'auth/operation-not-allowed') {
      message = 'Google sign-in is not enabled. Please enable Google in Firebase Console -> Authentication -> Sign-in method.';
    } else {
      message += err.message;
    }
    elements.authErrorMsg.textContent = message;
    elements.authErrorMsg.classList.remove('hidden');
  } finally {
    elements.googleLoginBtn.disabled = false;
    elements.googleLoginBtn.style.opacity = '1';
  }
}

/**
 * Sign out Handler
 */
async function handleSignOut() {
  if (currentUser && db) {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        status: 'offline',
        lastSeen: serverTimestamp()
      });
    } catch (e) {
      // Ignore
    }
  }
  if (auth) {
    await signOut(auth);
  }
}

// Set offline when page closes
window.addEventListener('beforeunload', () => {
  if (currentUser && db) {
    upsertUserToFirestore(currentUser, 'offline');
  }
});

// ==========================================================================
// Registered Users List
// ==========================================================================

function subscribeToRegisteredUsers() {
  if (!db) return;

  const usersCol = collection(db, 'users');
  usersListUnsubscribe = onSnapshot(usersCol, (snapshot) => {
    registeredUsers = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      // Exclude self from chat selection list
      if (data.uid !== currentUser.uid) {
        registeredUsers.push(data);
      }
    });

    renderUsersList();
  }, (error) => {
    console.error('Users snapshot error:', error);
    elements.usersList.innerHTML = `<div class="empty-users-hint">Unable to load registered users: ${error.message}</div>`;
  });
}

function renderUsersList() {
  const searchTerm = elements.userSearchInput.value.trim().toLowerCase();
  const filtered = registeredUsers.filter(u => {
    const nameMatch = (u.displayName || '').toLowerCase().includes(searchTerm);
    const emailMatch = (u.email || '').toLowerCase().includes(searchTerm);
    return nameMatch || emailMatch;
  });

  elements.usersCountBadge.textContent = filtered.length;

  if (filtered.length === 0) {
    if (registeredUsers.length === 0) {
      elements.usersList.innerHTML = `
        <div class="empty-users-hint">
          <i class="fa-solid fa-user-clock" style="font-size: 1.8rem; margin-bottom: 0.5rem; display: block; color: var(--text-dim);"></i>
          No other users registered yet.<br>
          <span style="font-size: 0.75rem; color: var(--text-dim);">Open an incognito window and sign in with a 2nd Google account to test chatting!</span>
        </div>
      `;
    } else {
      elements.usersList.innerHTML = `
        <div class="empty-users-hint">
          No users matching "<strong>${escapeHtml(searchTerm)}</strong>"
        </div>
      `;
    }
    return;
  }

  elements.usersList.innerHTML = '';

  filtered.forEach(user => {
    const isOnline = user.status === 'online';
    const isActive = selectedUser && selectedUser.uid === user.uid;
    const avatar = user.photoURL || createInitialsAvatar(user.displayName || user.email);

    const userEl = document.createElement('div');
    userEl.className = `user-item ${isActive ? 'active' : ''}`;
    userEl.dataset.uid = user.uid;

    userEl.innerHTML = `
      <div class="user-avatar-wrap">
        <img src="${avatar}" alt="${escapeHtml(user.displayName || 'User')}" class="avatar-md">
        <span class="user-status-indicator ${isOnline ? 'online' : ''}"></span>
      </div>
      <div class="user-item-info">
        <div class="user-item-top">
          <span class="user-item-name">${escapeHtml(user.displayName || 'User')}</span>
          <span class="user-item-status-text">${isOnline ? 'Online' : 'Offline'}</span>
        </div>
        <span class="user-item-email">${escapeHtml(user.email || '')}</span>
      </div>
    `;

    userEl.addEventListener('click', () => selectUserToChat(user));
    elements.usersList.appendChild(userEl);
  });
}

// ==========================================================================
// 1-on-1 Chat Mechanics
// ==========================================================================

function getChatRoomId(uid1, uid2) {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function selectUserToChat(user) {
  selectedUser = user;

  // Update UI selection
  renderUsersList();

  // On mobile, switch to chat view
  elements.chatView.classList.add('mobile-active');

  // Update recipient header details
  const avatar = user.photoURL || createInitialsAvatar(user.displayName || user.email);
  elements.recipientAvatar.src = avatar;
  elements.recipientName.textContent = user.displayName || user.email;
  const isOnline = user.status === 'online';
  elements.recipientStatusDot.className = `recipient-status-dot ${isOnline ? 'online' : 'offline'}`;
  elements.recipientStatusText.textContent = isOnline ? 'Online' : 'Offline';

  // Toggle panels
  elements.noChatState.classList.add('hidden');
  elements.activeChatContainer.classList.remove('hidden');

  // Cancel any previous attachment preview
  cancelAttachment();

  // Focus message input
  elements.messageTextInput.focus();

  // Unsubscribe previous chat messages listener
  if (activeChatUnsubscribe) {
    activeChatUnsubscribe();
    activeChatUnsubscribe = null;
  }

  // Subscribe to messages between currentUser & selectedUser
  subscribeToMessages();
}

function subscribeToMessages() {
  if (!db || !currentUser || !selectedUser) return;

  const chatId = getChatRoomId(currentUser.uid, selectedUser.uid);
  elements.chatLoadingSpinner.classList.remove('hidden');

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  let initialLoadDone = false;

  activeChatUnsubscribe = onSnapshot(q, (snapshot) => {
    elements.chatLoadingSpinner.classList.add('hidden');
    renderMessages(snapshot.docs);

    if (!initialLoadDone) {
      initialLoadDone = true;
      return;
    }

    // Check for new incoming messages
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const msg = change.doc.data();
        if (msg.senderId !== currentUser.uid) {
          playMessageChime();
          // If window is minimized or user is scrolled up, pop up notification bar
          const container = elements.messagesContainer;
          const isScrolledUp = container.scrollTop < (container.scrollHeight - container.clientHeight - 150);
          if (document.hidden || isScrolledUp) {
            showToastNotification({
              senderId: msg.senderId,
              senderName: msg.senderName,
              senderPhoto: msg.senderPhoto,
              text: msg.text || (msg.mediaType === 'video' ? '📹 Video' : '📷 Photo')
            });
          }
        }
      }
    });
  }, (err) => {
    console.error('Chat messages snapshot error:', err);
    elements.chatLoadingSpinner.classList.add('hidden');
    elements.messagesContainer.innerHTML = `<div class="empty-users-hint">Error loading messages: ${err.message}</div>`;
  });
}

function renderMessages(docs) {
  const container = elements.messagesContainer;
  container.innerHTML = '';

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="empty-users-hint" style="margin: auto;">
        <i class="fa-regular fa-comment-dots" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--text-dim); display: block;"></i>
        No messages yet.<br>
        Send a friendly greeting or take a photo to start chatting!
      </div>
    `;
    return;
  }

  let lastDateStr = null;

  docs.forEach(docSnap => {
    const msg = docSnap.data();
    const isOutgoing = msg.senderId === currentUser.uid;

    // Date divider check
    const dateObj = msg.timestamp ? msg.timestamp.toDate() : new Date();
    const dateStr = formatDateDivider(dateObj);
    if (dateStr !== lastDateStr) {
      lastDateStr = dateStr;
      const dateEl = document.createElement('div');
      dateEl.className = 'date-divider';
      dateEl.innerHTML = `<span>${dateStr}</span>`;
      container.appendChild(dateEl);
    }

    const row = document.createElement('div');
    row.className = `message-row ${isOutgoing ? 'outgoing' : 'incoming'}`;

    let mediaContent = '';
    if (msg.mediaUrl) {
      if (msg.mediaType === 'video') {
        mediaContent = `
          <div class="media-attachment">
            <video src="${escapeHtml(msg.mediaUrl)}" controls playsinline class="media-video" preload="metadata"></video>
          </div>
        `;
      } else {
        mediaContent = `
          <div class="media-attachment">
            <img src="${escapeHtml(msg.mediaUrl)}" alt="Attached photo" class="media-image" loading="lazy" />
          </div>
        `;
      }
    }

    const timeFormatted = formatTime(dateObj);

    row.innerHTML = `
      <div class="message-bubble">
        ${mediaContent}
        ${msg.text ? `<div class="message-text">${escapeHtml(msg.text)}</div>` : ''}
        <div class="message-meta">
          <span>${timeFormatted}</span>
          ${isOutgoing ? '<i class="fa-solid fa-check-double" title="Sent"></i>' : ''}
        </div>
      </div>
    `;

    // Attach click listener on image for Lightbox preview
    const imgEl = row.querySelector('.media-image');
    if (imgEl) {
      imgEl.addEventListener('click', () => openLightbox(msg.mediaUrl, 'image'));
    }

    container.appendChild(row);
  });

  // Scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// ==========================================================================
// Global Chat Notifications (Across All Conversations)
// ==========================================================================

function subscribeToGlobalChatNotifications() {
  if (!db || !currentUser) return;

  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', currentUser.uid)
  );

  let initialLoad = true;

  globalChatsUnsubscribe = onSnapshot(chatsQuery, (snapshot) => {
    if (initialLoad) {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.lastUpdated && data.lastUpdated.toMillis) {
          lastKnownChatTimestamps[docSnap.id] = data.lastUpdated.toMillis();
        }
      });
      initialLoad = false;
      return;
    }

    snapshot.docChanges().forEach(change => {
      const data = change.doc.data();
      const chatId = change.doc.id;
      const lastUpdatedMs = data.lastUpdated && data.lastUpdated.toMillis ? data.lastUpdated.toMillis() : Date.now();
      const prevMs = lastKnownChatTimestamps[chatId] || 0;

      if (lastUpdatedMs > prevMs) {
        lastKnownChatTimestamps[chatId] = lastUpdatedMs;

        // If message is from someone else and not in current active open conversation
        const isFromOther = data.lastSenderId && data.lastSenderId !== currentUser.uid;
        const isCurrentlyOpen = selectedUser && selectedUser.uid === data.lastSenderId && !document.hidden;

        if (isFromOther && !isCurrentlyOpen) {
          const otherUser = registeredUsers.find(u => u.uid === data.lastSenderId);
          showToastNotification({
            senderId: data.lastSenderId,
            senderName: (otherUser && otherUser.displayName) || data.lastSenderName || 'User',
            senderPhoto: (otherUser && otherUser.photoURL) || '',
            text: data.lastMessage || 'Sent a message'
          });
        }
      }
    });
  }, (err) => {
    console.warn('Global chat notification listener error:', err);
  });
}

function showToastNotification({ senderId, senderName, senderPhoto, text }) {
  playMessageChime();

  activeToastSenderId = senderId;
  const avatar = senderPhoto || createInitialsAvatar(senderName);
  elements.toastAvatar.src = avatar;
  elements.toastSenderName.textContent = senderName || 'New Message';
  elements.toastMessageText.textContent = text || 'Sent a message';

  elements.toastNotificationBar.classList.remove('hidden');

  if (toastDismissTimer) clearTimeout(toastDismissTimer);
  toastDismissTimer = setTimeout(() => {
    hideToastNotification();
  }, 4500);
}

function hideToastNotification() {
  elements.toastNotificationBar.classList.add('hidden');
  activeToastSenderId = null;
  if (toastDismissTimer) {
    clearTimeout(toastDismissTimer);
    toastDismissTimer = null;
  }
}

function handleToastClick() {
  if (!activeToastSenderId) return;
  const user = registeredUsers.find(u => u.uid === activeToastSenderId);
  if (user) {
    selectUserToChat(user);
  }
  hideToastNotification();
}

/**
 * Clean Two-Tone Web Audio Chime (Zero External Files)
 */
function playMessageChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.22);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.08); // A5
    gain2.gain.setValueAtTime(0.14, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);
  } catch (e) {
    // Audio autoplay restricted or unsupported
  }
}

// ==========================================================================
// Sending Messages & Handling Media
// ==========================================================================

async function handleSendMessage() {
  if (!currentUser || !selectedUser || !db) return;

  const text = elements.messageTextInput.value.trim();
  const attachment = selectedAttachment;

  // Don't send empty messages
  if (!text && !attachment) return;

  const chatId = getChatRoomId(currentUser.uid, selectedUser.uid);
  const messagesRef = collection(db, 'chats', chatId, 'messages');

  // Disable inputs while sending
  elements.sendMessageBtn.disabled = true;

  try {
    let mediaUrl = null;
    let mediaType = null;
    let fileName = null;

    // Handle media processing and saving to Firestore
    if (attachment) {
      elements.uploadProgressContainer.classList.remove('hidden');
      elements.progressBarFill.style.width = '35%';
      elements.uploadPercentLabel.textContent = '35%';
      elements.uploadStatusLabel.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Optimizing ${attachment.type}...`;

      if (attachment.type === 'image') {
        mediaUrl = await compressAndEncodeImage(attachment.file);
      } else {
        mediaUrl = await readFileAsDataUrl(attachment.file);
      }

      mediaType = attachment.type;
      fileName = attachment.name;

      elements.progressBarFill.style.width = '75%';
      elements.uploadPercentLabel.textContent = '75%';
      elements.uploadStatusLabel.innerHTML = `<i class="fa-solid fa-database"></i> Sending to chat...`;
    }

    const messageData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName || currentUser.email.split('@')[0],
      senderPhoto: currentUser.photoURL || '',
      receiverId: selectedUser.uid,
      text: text || (elements.mediaCaptionInput ? elements.mediaCaptionInput.value.trim() : ''),
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      fileName: fileName,
      timestamp: serverTimestamp()
    };

    // Save message doc to Firestore
    await addDoc(messagesRef, messageData);

    if (attachment) {
      elements.progressBarFill.style.width = '100%';
      elements.uploadPercentLabel.textContent = '100%';
      setTimeout(() => {
        elements.uploadProgressContainer.classList.add('hidden');
      }, 350);
    }

    // Update conversation metadata
    const chatDocRef = doc(db, 'chats', chatId);
    await setDoc(chatDocRef, {
      participants: [currentUser.uid, selectedUser.uid],
      lastMessage: text || (mediaType === 'video' ? '📹 Video' : '📷 Photo'),
      lastSenderId: currentUser.uid,
      lastSenderName: currentUser.displayName || currentUser.email.split('@')[0],
      lastUpdated: serverTimestamp()
    }, { merge: true });

    // Reset inputs
    elements.messageTextInput.value = '';
    elements.messageTextInput.style.height = 'auto';
    cancelAttachment();

  } catch (err) {
    console.error('Error sending message:', err);
    elements.uploadProgressContainer.classList.add('hidden');
    alert('Failed to send message: ' + err.message);
  } finally {
    elements.sendMessageBtn.disabled = false;
    elements.messageTextInput.focus();
  }
}

/**
 * Optimizes & compresses image into a Base64 Data URL fitting inside Firestore (under 1MB)
 */
function compressAndEncodeImage(file, maxDimension = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // If still large (>800KB), re-compress with smaller dimensions
        if (dataUrl.length > 800000) {
          canvas.width = Math.round(width * 0.75);
          canvas.height = Math.round(height * 0.75);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }

        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Reads video or file directly as a Base64 Data URL
 */
function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ==========================================================================
// Live Camera Feature
// ==========================================================================

async function openCameraModal() {
  elements.cameraModal.classList.remove('hidden');
  elements.cameraLoading.classList.remove('hidden');
  elements.cameraVideoStream.classList.remove('hidden');
  elements.cameraSnapshotCanvas.classList.add('hidden');
  elements.cameraCaptureBtn.classList.remove('hidden');
  elements.cameraSwitchBtn.classList.remove('hidden');
  elements.cameraPostCaptureActions.classList.add('hidden');

  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera stream not supported in this browser.');
    }

    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: cameraFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 960 }
      },
      audio: false
    });

    elements.cameraVideoStream.srcObject = cameraStream;
    elements.cameraVideoStream.onloadedmetadata = () => {
      elements.cameraLoading.classList.add('hidden');
      elements.cameraVideoStream.play();
    };
  } catch (err) {
    console.warn('Camera stream error, using device camera fallback:', err);
    closeCameraModal();
    // Fall back to native camera file input
    elements.cameraFileInput.click();
  }
}

function captureCameraSnapshot() {
  if (!elements.cameraVideoStream || !cameraStream) return;

  const video = elements.cameraVideoStream;
  const canvas = elements.cameraSnapshotCanvas;

  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Switch display from video to frozen canvas
  canvas.classList.remove('hidden');
  video.classList.add('hidden');

  // Toggle buttons
  elements.cameraCaptureBtn.classList.add('hidden');
  elements.cameraSwitchBtn.classList.add('hidden');
  elements.cameraPostCaptureActions.classList.remove('hidden');
}

function retakeCameraSnapshot() {
  elements.cameraSnapshotCanvas.classList.add('hidden');
  elements.cameraVideoStream.classList.remove('hidden');
  elements.cameraCaptureBtn.classList.remove('hidden');
  elements.cameraSwitchBtn.classList.remove('hidden');
  elements.cameraPostCaptureActions.classList.add('hidden');
}

function useCameraSnapshot() {
  const canvas = elements.cameraSnapshotCanvas;
  canvas.toBlob(blob => {
    if (!blob) return;

    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(blob);

    selectedAttachment = {
      file: file,
      previewUrl: previewUrl,
      type: 'image',
      name: file.name,
      size: formatBytes(file.size)
    };

    // Render preview in chat input
    elements.previewFileName.textContent = selectedAttachment.name;
    elements.previewFileSize.textContent = selectedAttachment.size;
    elements.previewMediaWrapper.innerHTML = `<img src="${previewUrl}" alt="Camera snapshot" />`;
    elements.mediaPreviewContainer.classList.remove('hidden');

    closeCameraModal();
    elements.messageTextInput.focus();
  }, 'image/jpeg', 0.85);
}

function switchCameraFacing() {
  cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
  openCameraModal();
}

function closeCameraModal() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  elements.cameraModal.classList.add('hidden');
}

// ==========================================================================
// Media File Attachment & Preview
// ==========================================================================

function handleFileSelection(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');

  if (!isImage && !isVideo) {
    alert('Please select an image or video file.');
    event.target.value = '';
    return;
  }

  // Check Firestore limit (1MB max doc size):
  if (isVideo && file.size > 750 * 1024) {
    alert(
      '⚠️ Free Firestore Limit:\n\n' +
      'Videos must be short clips under 750 KB to fit within free Firestore.\n' +
      'Please select a shorter clip or choose a photo (photos are auto-compressed)!'
    );
    event.target.value = '';
    return;
  }

  const previewUrl = URL.createObjectURL(file);
  selectedAttachment = {
    file: file,
    previewUrl: previewUrl,
    type: isVideo ? 'video' : 'image',
    name: file.name,
    size: formatBytes(file.size)
  };

  // Render preview
  elements.previewFileName.textContent = selectedAttachment.name;
  elements.previewFileSize.textContent = selectedAttachment.size;

  if (isVideo) {
    elements.previewMediaWrapper.innerHTML = `
      <video src="${previewUrl}" muted playsinline></video>
    `;
  } else {
    elements.previewMediaWrapper.innerHTML = `
      <img src="${previewUrl}" alt="Preview" />
    `;
  }

  elements.mediaPreviewContainer.classList.remove('hidden');
  event.target.value = '';
  elements.messageTextInput.focus();
}

function cancelAttachment() {
  if (selectedAttachment && selectedAttachment.previewUrl) {
    URL.revokeObjectURL(selectedAttachment.previewUrl);
  }
  selectedAttachment = null;
  elements.mediaPreviewContainer.classList.add('hidden');
  elements.previewMediaWrapper.innerHTML = '';
  if (elements.mediaCaptionInput) {
    elements.mediaCaptionInput.value = '';
  }
}

// ==========================================================================
// Lightbox Modal
// ==========================================================================

function openLightbox(url, type = 'image') {
  if (type === 'video') {
    elements.lightboxContent.innerHTML = `
      <video src="${escapeHtml(url)}" controls autoplay class="lightbox-video"></video>
    `;
  } else {
    elements.lightboxContent.innerHTML = `
      <img src="${escapeHtml(url)}" alt="Zoomed preview" class="lightbox-img" />
    `;
  }
  elements.lightboxModal.classList.remove('hidden');
}

function closeLightbox() {
  elements.lightboxModal.classList.add('hidden');
  elements.lightboxContent.innerHTML = '';
}

// ==========================================================================
// Firebase Configuration Modal Handlers
// ==========================================================================

function openConfigModal() {
  try {
    const saved = localStorage.getItem('firechat_firebase_config');
    if (saved) {
      const cfg = JSON.parse(saved);
      elements.cfgApiKey.value = cfg.apiKey || '';
      elements.cfgAuthDomain.value = cfg.authDomain || '';
      elements.cfgProjectId.value = cfg.projectId || '';
      elements.cfgMessagingSenderId.value = cfg.messagingSenderId || '';
      elements.cfgAppId.value = cfg.appId || '';
    } else {
      elements.cfgAuthDomain.value = elements.cfgAuthDomain.value || 'connect-37efb.firebaseapp.com';
      elements.cfgProjectId.value = elements.cfgProjectId.value || 'connect-37efb';
    }
  } catch (e) {
    // Ignore
  }
  elements.firebaseModal.classList.remove('hidden');
}

function closeConfigModal() {
  elements.firebaseModal.classList.add('hidden');
}

function parsePastedConfig() {
  const text = elements.configPasteArea.value;
  if (!text.trim()) return;

  const extract = (key) => {
    const regex = new RegExp(`['"]?${key}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const apiKey = extract('apiKey');
  const authDomain = extract('authDomain');
  const projectId = extract('projectId');
  const messagingSenderId = extract('messagingSenderId');
  const appId = extract('appId');

  if (apiKey) elements.cfgApiKey.value = apiKey;
  if (authDomain) elements.cfgAuthDomain.value = authDomain;
  if (projectId) elements.cfgProjectId.value = projectId;
  if (messagingSenderId) elements.cfgMessagingSenderId.value = messagingSenderId;
  if (appId) elements.cfgAppId.value = appId;
}

function saveConfigFromModal() {
  const cfg = {
    apiKey: elements.cfgApiKey.value.trim(),
    authDomain: elements.cfgAuthDomain.value.trim(),
    projectId: elements.cfgProjectId.value.trim(),
    messagingSenderId: elements.cfgMessagingSenderId.value.trim(),
    appId: elements.cfgAppId.value.trim()
  };

  if (!isValidConfig(cfg)) {
    alert('Please enter at least API Key, Auth Domain, and Project ID.');
    return;
  }

  saveFirebaseConfig(cfg);
  closeConfigModal();

  alert('Firebase configuration saved successfully! Reloading...');
  window.location.reload();
}

function handleClearConfig() {
  if (confirm('Reset Firebase configuration to default?')) {
    clearFirebaseConfig();
    alert('Configuration reset. Reloading page...');
    window.location.reload();
  }
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================

function setupEventListeners() {
  // Toast Notification Bar
  elements.toastBodyBtn.addEventListener('click', handleToastClick);
  elements.toastCloseBtn.addEventListener('click', hideToastNotification);

  // Config Modal
  elements.configStatusBadge.addEventListener('click', openConfigModal);
  elements.openConfigBtn.addEventListener('click', openConfigModal);
  elements.closeConfigModalBtn.addEventListener('click', closeConfigModal);
  elements.cancelConfigBtn.addEventListener('click', closeConfigModal);
  elements.saveConfigBtn.addEventListener('click', saveConfigFromModal);
  elements.clearConfigBtn.addEventListener('click', handleClearConfig);
  elements.parsePastedConfigBtn.addEventListener('click', parsePastedConfig);

  // Authentication
  elements.googleLoginBtn.addEventListener('click', loginWithGoogle);
  elements.logoutBtn.addEventListener('click', handleSignOut);

  // Search
  elements.userSearchInput.addEventListener('input', () => {
    elements.clearSearchBtn.classList.toggle('hidden', !elements.userSearchInput.value);
    renderUsersList();
  });
  elements.clearSearchBtn.addEventListener('click', () => {
    elements.userSearchInput.value = '';
    elements.clearSearchBtn.classList.add('hidden');
    renderUsersList();
  });

  // Mobile Back Button
  elements.mobileBackBtn.addEventListener('click', () => {
    elements.chatView.classList.remove('mobile-active');
  });

  // Attachments
  elements.attachBtn.addEventListener('click', () => {
    elements.mediaFileInput.click();
  });
  elements.mediaFileInput.addEventListener('change', handleFileSelection);
  elements.cancelPreviewBtn.addEventListener('click', cancelAttachment);

  // Camera
  elements.cameraBtn.addEventListener('click', openCameraModal);
  elements.closeCameraModalBtn.addEventListener('click', closeCameraModal);
  elements.cameraCaptureBtn.addEventListener('click', captureCameraSnapshot);
  elements.cameraRetakeBtn.addEventListener('click', retakeCameraSnapshot);
  elements.cameraUseBtn.addEventListener('click', useCameraSnapshot);
  elements.cameraSwitchBtn.addEventListener('click', switchCameraFacing);
  elements.cameraFileInput.addEventListener('change', handleFileSelection);

  // Send message
  elements.chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Auto-grow textarea & Enter to send
  elements.messageTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  elements.messageTextInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // Lightbox
  elements.closeLightboxBtn.addEventListener('click', closeLightbox);
  elements.lightboxModal.addEventListener('click', (e) => {
    if (e.target === elements.lightboxModal) {
      closeLightbox();
    }
  });

  // Global keydown (Escape)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeConfigModal();
      closeCameraModal();
      hideToastNotification();
    }
  });
}

// ==========================================================================
// Helper Utilities
// ==========================================================================

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(date) {
  if (!date || isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateDivider(date) {
  if (!date || isNaN(date.getTime())) return 'Today';
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function createInitialsAvatar(name) {
  const initial = (name || 'U').charAt(0).toUpperCase();
  const colors = ['#2563eb', '#d97706', '#059669', '#db2777', '#7c3aed', '#0891b2'];
  const charCode = initial.charCodeAt(0);
  const color = colors[charCode % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${color}"/>
    <text x="50" y="62" font-size="44" font-family="sans-serif" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Start Application
window.addEventListener('DOMContentLoaded', initialize);
