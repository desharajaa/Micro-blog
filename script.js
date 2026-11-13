const STORAGE_KEY = "chirp_microblog_v1";
const AUTH_KEY = "chirp_accounts_v1";
const SESSION_KEY = "chirp_session_v1";
let authMode = "signin";

const defaultUsers = [
  { id: "me", name: "Dev", handle: "@dev", bio: "Learning, building, and sharing little ideas.", color: "avatar-me", isMe: true },
  { id: "maya", name: "Maya Wilson", handle: "@mayamakes", bio: "Designing things that make everyday life feel lovely.", color: "avatar-1" },
  { id: "arjun", name: "Arjun Kumar", handle: "@arj.codes", bio: "CS student • coffee-powered coder • building in public.", color: "avatar-2" },
  { id: "lina", name: "Lina Rose", handle: "@linarose", bio: "Books, art, and small reminders to slow down.", color: "avatar-3" },
  { id: "sam", name: "Sam Carter", handle: "@samexplores", bio: "Curious about people, places, and technology.", color: "avatar-4" }
];

const starterPosts = [
  { id: "p1", userId: "maya", text: "A tiny reminder for today: you don't need to have everything figured out to take the next step. 🌱 #dailythoughts", image: "", createdAt: Date.now() - 1000 * 60 * 22, likes: ["arjun", "lina"], comments: [{ id: "c1", userId: "lina", text: "Needed this today. Thank you!" }] },
  { id: "p2", userId: "arjun", text: "Spent the evening building a mini project instead of waiting for the perfect idea. Starting messy is still starting. #coding #buildinpublic", image: "", createdAt: Date.now() - 1000 * 60 * 60 * 2, likes: ["maya", "sam", "lina"], comments: [{ id: "c2", userId: "sam", text: "That is the best way to learn!" }] },
  { id: "p3", userId: "lina", text: "Current mood: a warm drink, a good playlist, and absolutely no rush. What is one small thing that made you happy today? #dailythoughts", image: "", createdAt: Date.now() - 1000 * 60 * 60 * 5, likes: ["maya"], comments: [] },
  { id: "p4", userId: "sam", text: "Good design isn't only about how something looks. It's about how naturally it fits into someone's day. #design", image: "", createdAt: Date.now() - 1000 * 60 * 60 * 8, likes: ["arjun", "maya"], comments: [] }
];

let state = loadState();
let currentView = "home";
let searchTerm = "";
let sortNewestFirst = true;
let selectedImage = "";
let toastTimer;
let appInitialized = false;

const $ = (selector) => document.querySelector(selector);
const feed = $("#feed");
const emptyState = $("#emptyState");

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.users && parsed.posts) return parsed;
    }
  } catch (error) {
    console.warn("Could not read saved Chirp data.", error);
  }
  return {
    users: structuredClone(defaultUsers),
    posts: structuredClone(starterPosts),
    following: ["maya", "arjun", "lina"],
    currentUserId: "me"
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    showToast("Storage is full. Try removing a large image.");
  }
}

function currentUser() {
  return state.users.find(user => user.id === state.currentUserId) || state.users[0];
}
function getUser(id) {
  return state.users.find(user => user.id === id) || { id: "unknown", name: "Unknown user", handle: "@unknown", color: "" };
}
function initials(name) {
  return (name || "?").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}
function avatarHTML(user, extraClass = "") {
  const color = user.id === state.currentUserId ? "avatar-me" : (user.color || "");
  return `<div class="avatar ${escapeHTML(color)} ${extraClass}" aria-hidden="true">${escapeHTML(initials(user.name))}</div>`;
}
function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
function linkifyText(text) {
  return escapeHTML(text).replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1<span class="hashtag">$2</span>');
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function updateUserChrome() {
  const user = currentUser();
  $("#sidebarName").textContent = user.name;
  $("#sidebarHandle").textContent = user.handle;
  document.querySelectorAll(".avatar-me").forEach(node => {
    if (node.closest(".post-card") || node.closest(".comment")) return;
    node.textContent = initials(user.name);
  });
}
function getVisiblePosts() {
  let posts = [...state.posts];
  if (currentView === "following") posts = posts.filter(post => state.following.includes(post.userId) || post.userId === state.currentUserId);
  if (currentView === "profile") posts = posts.filter(post => post.userId === state.currentUserId);
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    const matchingUserIds = state.users.filter(user => `${user.name} ${user.handle} ${user.bio || ""}`.toLowerCase().includes(q)).map(user => user.id);
    posts = posts.filter(post => post.text.toLowerCase().includes(q) || matchingUserIds.includes(post.userId) || post.comments.some(comment => comment.text.toLowerCase().includes(q)));
  }
  posts.sort((a, b) => sortNewestFirst ? b.createdAt - a.createdAt : a.createdAt - b.createdAt);
  return posts;
}
function renderProfileBanner() {
  const user = currentUser();
  const followers = state.users.filter(person => person.id !== user.id && (person.following || []).includes(user.id)).length;
  const postsCount = state.posts.filter(post => post.userId === user.id).length;
  return `<div class="profile-banner">
    <div class="profile-banner-top">${avatarHTML(user)}<div><h2>${escapeHTML(user.name)}</h2><span class="handle">${escapeHTML(user.handle)}</span></div>
    <button class="sort-btn" id="profileEditInline" style="margin-left:auto">Edit profile</button></div>
    <p>${escapeHTML(user.bio || "Still writing my story...")}</p>
    <div class="profile-stats"><span><strong>${postsCount}</strong> posts</span><span><strong>${state.following.length}</strong> following</span><span><strong>${followers}</strong> followers</span></div>
  </div>`;
}
function renderPost(post) {
  const user = getUser(post.userId);
  const me = currentUser();
  const liked = post.likes.includes(me.id);
  const commentsOpen = post.commentsOpen === true;
  const comments = post.comments.map(comment => {
    const author = getUser(comment.userId);
    return `<div class="comment">${avatarHTML(author)}<div class="comment-content"><strong>${escapeHTML(author.name)}</strong><p>${escapeHTML(comment.text)}</p></div></div>`;
  }).join("");
  const image = post.image ? `<img class="post-image" src="${post.image}" alt="Image attached to post" loading="lazy" />` : "";
  return `<article class="post-card" data-post-id="${escapeHTML(post.id)}">
    <div class="post-top">${avatarHTML(user)}<div class="post-author"><div class="author-line"><strong>${escapeHTML(user.name)}</strong><span class="handle">${escapeHTML(user.handle)}</span><span class="post-time">${timeAgo(post.createdAt)}</span></div></div>
      ${post.userId === me.id ? `<button class="post-menu" data-action="delete" title="Delete your post" aria-label="Delete post">•••</button>` : ""}
    </div>
    <div class="post-body">${linkifyText(post.text)}</div>${image}
    <div class="post-actions">
      <button class="action-btn ${liked ? "liked" : ""}" data-action="like" aria-label="${liked ? "Unlike" : "Like"} post"><span class="action-icon">${liked ? "♥" : "♡"}</span><span>${post.likes.length || ""} ${post.likes.length === 1 ? "like" : "likes"}</span></button>
      <button class="action-btn ${commentsOpen ? "commented" : ""}" data-action="comments"><span class="action-icon">▱</span><span>${post.comments.length} comments</span></button>
      <span class="action-spacer"></span><button class="action-btn" data-action="share" title="Copy post text"><span class="action-icon">↗</span><span>Share</span></button>
    </div>
    ${commentsOpen ? `<div class="comments">${comments || `<p class="handle">No comments yet. Start the conversation!</p>`}
      <form class="comment-form"><input name="comment" maxlength="220" placeholder="Write a comment..." aria-label="Write a comment" required /><button type="submit">Send</button></form>
    </div>` : ""}
  </article>`;
}
function renderFeed() {
  const posts = getVisiblePosts();
  feed.innerHTML = posts.map(renderPost).join("");
  emptyState.hidden = posts.length > 0;
  if (posts.length === 0) {
    $("#emptyAction").textContent = currentView === "profile" ? "Write a post" : "Explore people";
  }
  if (currentView === "profile") {
    feed.insertAdjacentHTML("afterbegin", renderProfileBanner());
    $("#profileEditInline")?.addEventListener("click", openProfileDialog);
  }
  updateUserChrome();
}
function renderSuggestions() {
  const list = state.users.filter(user => user.id !== currentUser().id).slice(0, 4);
  $("#suggestions").innerHTML = list.map(user => {
    const isFollowing = state.following.includes(user.id);
    return `<div class="suggestion">${avatarHTML(user)}<div class="suggestion-info"><strong>${escapeHTML(user.name)}</strong><span>${escapeHTML(user.handle)}</span></div><button class="follow-btn ${isFollowing ? "following" : ""}" data-follow="${escapeHTML(user.id)}">${isFollowing ? "Following" : "Follow"}</button></div>`;
  }).join("");
}
function setView(view) {
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === view));
  const titles = { home: ["Home", "Your feed", "Fresh thoughts from your community"], explore: ["Explore", "Explore the community", "Find people and ideas worth following"], following: ["Following", "Your following feed", "Posts from people you follow"], profile: ["My profile", "Your posts", "Your little corner of Chirp"] };
  const [title, heading, subheading] = titles[view] || titles.home;
  $("#pageTitle").textContent = title;
  $("#feedHeading").textContent = heading;
  $("#feedSubheading").textContent = subheading;
  if (view === "explore") {
    $("#feedSubheading").textContent = "Search, discover, and join the conversation";
    $("#searchInput").focus();
  }
  renderFeed();
}
function publishPost() {
  const text = $("#postText").value.trim();
  if (!text && !selectedImage) return showToast("Write something or add a photo first.");
  const post = { id: `p${Date.now()}${Math.random().toString(16).slice(2, 6)}`, userId: currentUser().id, text, image: selectedImage, createdAt: Date.now(), likes: [], comments: [] };
  state.posts.push(post);
  saveState();
  $("#postText").value = "";
  $("#charCount").textContent = "0 / 280";
  clearSelectedImage();
  setView("home");
  showToast("Your post is live!");
}
function clearSelectedImage() {
  selectedImage = "";
  $("#postImage").value = "";
  $("#imagePreviewWrap").hidden = true;
  $("#imagePreview").src = "";
}
function toggleLike(postId) {
  const post = state.posts.find(item => item.id === postId);
  if (!post) return;
  const userId = currentUser().id;
  post.likes = post.likes || [];
  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter(id => id !== userId);
  } else {
    post.likes.push(userId);
  }
  saveState();
  renderFeed();
}
function toggleComments(postId) {
  const post = state.posts.find(item => item.id === postId);
  if (!post) return;
  post.commentsOpen = !post.commentsOpen;
  renderFeed();
  if (post.commentsOpen) feed.querySelector(`[data-post-id="${CSS.escape(postId)}"] .comment-form input`)?.focus();
}
function deletePost(postId) {
  const post = state.posts.find(item => item.id === postId);
  if (!post || post.userId !== currentUser().id) return;
  if (!confirm("Delete this post?")) return;
  state.posts = state.posts.filter(item => item.id !== postId);
  saveState();
  renderFeed();
  showToast("Post deleted.");
}
function addComment(postId, text) {
  const post = state.posts.find(item => item.id === postId);
  const commentText = text.trim();
  if (!post || !commentText) return;
  post.comments.push({ id: `c${Date.now()}`, userId: currentUser().id, text: commentText });
  post.commentsOpen = true;
  saveState();
  renderFeed();
  showToast("Comment added.");
}
function toggleFollow(userId) {
  if (userId === currentUser().id) return;
  if (state.following.includes(userId)) {
    state.following = state.following.filter(id => id !== userId);
    showToast(`Unfollowed ${getUser(userId).name}.`);
  } else {
    state.following.push(userId);
    showToast(`Following ${getUser(userId).name}!`);
  }
  saveState();
  renderSuggestions();
  renderFeed();
}
function openProfileDialog() {
  const user = currentUser();
  $("#profileNameInput").value = user.name;
  $("#profileHandleInput").value = user.handle.replace(/^@/, "");
  $("#profileBioInput").value = user.bio || "";
  $("#profileDialog").showModal();
}
function saveProfile(event) {
  event.preventDefault();
  const user = currentUser();
  const name = $("#profileNameInput").value.trim();
  const handle = $("#profileHandleInput").value.trim().replace(/^@+/, "").replace(/\s+/g, "").replace(/[^a-zA-Z0-9_.]/g, "");
  if (!name || !handle) return showToast("Please enter a name and username.");
  user.name = name;
  user.handle = `@${handle}`;
  user.bio = $("#profileBioInput").value.trim();
  saveState();
  $("#profileDialog").close();
  renderFeed();
  renderSuggestions();
  showToast("Profile updated.");
}
function searchByTag(tag) {
  $("#searchInput").value = `#${tag}`;
  searchTerm = `#${tag}`;
  setView("explore");
  renderFeed();
}
function init() {
  if (appInitialized) return;
  appInitialized = true;
  updateUserChrome();
  renderSuggestions();
  renderFeed();

  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $("#publishBtn").addEventListener("click", publishPost);
  $("#postText").addEventListener("input", () => {
    $("#charCount").textContent = `${$("#postText").value.length} / 280`;
  });
  $("#postText").addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") publishPost();
  });
  $("#postImage").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return showToast("Please choose an image file.");
    if (file.size > 1.5 * 1024 * 1024) {
      event.target.value = "";
      return showToast("Choose an image smaller than 1.5 MB for this demo.");
    }
    const reader = new FileReader();
    reader.onload = () => {
      selectedImage = reader.result;
      $("#imagePreview").src = selectedImage;
      $("#imagePreviewWrap").hidden = false;
    };
    reader.readAsDataURL(file);
  });
  $("#removeImageBtn").addEventListener("click", clearSelectedImage);
  $("#searchInput").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    if (searchTerm) {
      currentView = "explore";
      document.querySelectorAll(".nav-item").forEach(button => button.classList.toggle("active", button.dataset.view === "explore"));
      $("#pageTitle").textContent = "Explore";
      $("#feedHeading").textContent = "Search results";
      $("#feedSubheading").textContent = `Showing matches for “${searchTerm}”`;
    } else if (currentView === "explore") {
      $("#feedHeading").textContent = "Explore the community";
      $("#feedSubheading").textContent = "Find people and ideas worth following";
    }
    renderFeed();
  });
  $("#sortBtn").addEventListener("click", () => {
    sortNewestFirst = !sortNewestFirst;
    $("#sortBtn").textContent = sortNewestFirst ? "Latest ↓" : "Oldest ↑";
    renderFeed();
  });
  $("#suggestions").addEventListener("click", event => {
    const button = event.target.closest("[data-follow]");
    if (button) toggleFollow(button.dataset.follow);
  });
  $("#seeAllBtn").addEventListener("click", () => setView("explore"));
  $("#emptyAction").addEventListener("click", () => {
    if (currentView === "profile") {
      $("#postText").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else setView("explore");
  });
  $("#editProfileBtn").addEventListener("click", openProfileDialog);
  $("#profileForm").addEventListener("submit", saveProfile);
  $("#profileForm").addEventListener("click", event => {
    if (event.target.classList.contains("close-btn")) $("#profileDialog").close();
  });
  document.querySelectorAll(".trend-row").forEach(button => button.addEventListener("click", () => searchByTag(button.dataset.tag)));
  $("#logoutBtn").addEventListener("click", logout);
  feed.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const postElement = actionButton.closest("[data-post-id]");
    if (!postElement) return;
    const postId = postElement.dataset.postId;
    const action = actionButton.dataset.action;
    if (action === "like") toggleLike(postId);
    if (action === "comments") toggleComments(postId);
    if (action === "delete") deletePost(postId);
    if (action === "share") {
      const post = state.posts.find(item => item.id === postId);
      if (post) {
        const textToCopy = `${getUser(post.userId).name}: ${post.text}`;
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(textToCopy).then(() => showToast("Post text copied!")).catch(() => showToast(textToCopy));
        else showToast(textToCopy || "Image post");
      }
    }
  });
  feed.addEventListener("submit", event => {
    if (!event.target.matches(".comment-form")) return;
    event.preventDefault();
    const postElement = event.target.closest("[data-post-id]");
    const input = event.target.elements.comment;
    addComment(postElement.dataset.postId, input.value);
  });
}

function readAccounts() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "[]"); }
  catch { return []; }
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  $("#authTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("#authSubtitle").textContent = signup ? "Join Chirp and share what’s on your mind." : "Sign in to continue sharing your thoughts.";
  $("#signupNameWrap").hidden = !signup;
  $("#authName").required = signup;
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("#authSwitchText").textContent = signup ? "Already have an account?" : "Don't have an account?";
  $("#authSwitch").textContent = signup ? "Sign in" : "Sign up";
  $("#authError").textContent = "";
}
function showApp(userId) {
  state.currentUserId = userId;
  if (!state.following) state.following = [];
  saveState();
  localStorage.setItem(SESSION_KEY, userId);
  $("#authScreen").hidden = true;
  $("#appShell").hidden = false;
  init();
}
function logout() {
  localStorage.removeItem(SESSION_KEY);
  $("#appShell").hidden = true;
  $("#authScreen").hidden = false;
  $("#authForm").reset();
  setAuthMode("signin");
}
function handleAuth(event) {
  event.preventDefault();
  const email = $("#authEmail").value.trim().toLowerCase();
  const password = $("#authPassword").value;
  const accounts = readAccounts();
  if (authMode === "signup") {
    const name = $("#authName").value.trim();
    if (!name) return $("#authError").textContent = "Please enter your name.";
    if (accounts.some(account => account.email === email)) return $("#authError").textContent = "An account with this email already exists.";
    const handleBase = (email.split("@")[0].replace(/[^a-z0-9_.]/g, "") || "user").slice(0, 15);
    let handle = "@" + handleBase;
    let suffix = 1;
    while (state.users.some(user => user.handle.toLowerCase() === handle.toLowerCase())) handle = "@" + handleBase + suffix++;
    const userId = "u" + Date.now();
    const account = { id: userId, email, password, name };
    accounts.push(account);
    localStorage.setItem(AUTH_KEY, JSON.stringify(accounts));
    state.users.push({ id: userId, name, handle, bio: "New to Chirp. Happy to be here!", color: "avatar-2" });
    state.following = state.following || [];
    saveState();
    showApp(userId);
    showToast("Welcome to Chirp!");
    return;
  }
  const account = accounts.find(item => item.email === email && item.password === password);
  if (!account) return $("#authError").textContent = "Invalid email or password. Please try again.";
  showApp(account.id);
}
function bootAuth() {
  $("#authSwitch").addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));
  $("#authForm").addEventListener("submit", handleAuth);
  const sessionId = localStorage.getItem(SESSION_KEY);
  const account = readAccounts().find(item => item.id === sessionId);
  if (account && state.users.some(user => user.id === account.id)) showApp(account.id);
  else {
    localStorage.removeItem(SESSION_KEY);
    $("#appShell").hidden = true;
    $("#authScreen").hidden = false;
    setAuthMode("signin");
  }
}
bootAuth();
