// ── Firebase 설정 ──────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, push, set, get, remove, onValue, query, orderByChild }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAvNwIF9BXFY5Clkf9SDZbK79GGvds199E",
  authDomain: "school-21d4a.firebaseapp.com",
  databaseURL: "https://school-21d4a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "school-21d4a",
  storageBucket: "school-21d4a.firebasestorage.app",
  messagingSenderId: "95581019938",
  appId: "1:95581019938:web:7e28da6c84744aeba14f7b"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const DB = {
  /* ── 세션 ── */
  setSession(user) { localStorage.setItem('gm_session', JSON.stringify(user)); },
  getSession()     { return JSON.parse(localStorage.getItem('gm_session') || 'null'); },
  clearSession()   { localStorage.removeItem('gm_session'); },

  /* ── 유저 ── */
  async getUsers() {
    const snap = await get(ref(db, 'users'));
    return snap.exists() ? Object.values(snap.val()) : [];
  },
  async phoneExists(phone) {
    const users = await this.getUsers();
    return users.some(u => u.phone === phone);
  },
  async idExists(id) {
    const snap = await get(ref(db, `users/${id}`));
    return snap.exists();
  },
  async register(user) {
    if (await this.idExists(user.id))       return { ok:false, msg:'이미 사용 중인 아이디입니다.' };
    if (await this.phoneExists(user.phone)) return { ok:false, msg:'이미 가입된 전화번호입니다.\n같은 전화번호로 여러 계정을 만들 수 없습니다.' };
    await set(ref(db, `users/${user.id}`), user);
    return { ok:true };
  },
  async login(id, password) {
    const snap = await get(ref(db, `users/${id}`));
    if (!snap.exists()) return { ok:false, msg:'아이디 또는 비밀번호가 틀렸습니다.' };
    const user = snap.val();
    if (user.password !== password) return { ok:false, msg:'아이디 또는 비밀번호가 틀렸습니다.' };
    return { ok:true, user };
  },

  /* ── 게시글 ── */
  async addPost(post) {
    post.createdAt = Date.now();
    // 교사 글은 pinned = true → 항상 상단 고정
    post.pinned = (post.authorRole === 'teacher');
    const newRef = push(ref(db, 'posts'));
    post.id = newRef.key;
    await set(newRef, post);
    return post;
  },
  async getPost(id) {
    const snap = await get(ref(db, `posts/${id}`));
    return snap.exists() ? snap.val() : null;
  },
  async deletePost(id) {
    await remove(ref(db, `posts/${id}`));
    // 해당 글의 댓글도 모두 삭제
    const cSnap = await get(ref(db, 'comments'));
    if (cSnap.exists()) {
      const all = cSnap.val();
      for (const key of Object.keys(all)) {
        if (all[key].postId === id) await remove(ref(db, `comments/${key}`));
      }
    }
  },
  // 실시간 구독 — 교사 글 항상 상단(최신순), 학생 글 그 아래(최신순)
  onPosts(callback) {
    return onValue(query(ref(db, 'posts'), orderByChild('createdAt')), snap => {
      if (!snap.exists()) { callback([]); return; }
      const all    = Object.values(snap.val());
      const pinned = all.filter(p =>  p.pinned).sort((a,b) => b.createdAt - a.createdAt);
      const normal = all.filter(p => !p.pinned).sort((a,b) => b.createdAt - a.createdAt);
      callback([...pinned, ...normal]);
    });
  },

  /* ── 댓글 ── */
  async addComment(comment) {
    comment.createdAt = Date.now();
    const newRef = push(ref(db, 'comments'));
    comment.id = newRef.key;
    await set(newRef, comment);
    return comment;
  },
  onComments(postId, callback) {
    return onValue(ref(db, 'comments'), snap => {
      if (!snap.exists()) { callback([]); return; }
      const all = Object.values(snap.val()).filter(c => c.postId === postId);
      all.sort((a,b) => a.createdAt - b.createdAt);
      callback(all);
    });
  },
  async deleteComment(id) {
    await remove(ref(db, `comments/${id}`));
  },

  /* ── 유틸 ── */
  timeAgo(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60)    return '방금 전';
    if (diff < 3600)  return Math.floor(diff/60) + '분 전';
    if (diff < 86400) return Math.floor(diff/3600) + '시간 전';
    return Math.floor(diff/86400) + '일 전';
  }
};

export default DB;
