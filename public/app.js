const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const seedTopics = [
    { id: 1, title: 'Keran dekat bengkel perlu diperbaiki', body: 'Airnya terus menetes sejak kemarin. Semoga bisa segera dicek agar tidak boros air.', time: Date.now() - 3600000, likes: 8, liked: false, comments: [{ id: 1, body: 'Terima kasih sudah memberi tahu. Akan diteruskan ke petugas.', time: Date.now() - 1800000 }], owner: 'demo' },
    { id: 2, title: 'Info lomba desain poster sekolah', body: 'Pendaftaran lomba poster dibuka sampai Jumat. Tema tahun ini adalah sekolah ramah lingkungan.', time: Date.now() - 7200000, likes: 12, liked: false, comments: [], owner: 'other' },
    { id: 3, title: 'Perubahan jadwal kegiatan Jumat', body: 'Silakan cek pengumuman terbaru dari sekolah untuk informasi lengkapnya.', time: Date.now() - 86400000, likes: 4, liked: false, comments: [], owner: 'other' }
];
const people = [
    { name: 'Alya Putri', role: 'Siswa', detail: 'XI RPL 1', bio: 'Suka belajar desain UI dan membuat ilustrasi.' },
    { name: 'Raka Pratama', role: 'Siswa', detail: 'XI TKJ 2', bio: 'Tertarik dengan jaringan komputer.' },
    { name: 'Dina Maharani', role: 'Guru', detail: 'Matematika', bio: 'Belajar adalah proses yang terus berjalan.' },
    { name: 'Bima Santoso', role: 'Guru', detail: 'Produktif RPL', bio: 'Berbagi ilmu dan pengalaman.' },
    { name: 'Siti Rahma', role: 'Staf', detail: 'Perpustakaan', bio: 'Senang membantu warga sekolah menemukan bacaan.' },
    { name: 'Andi Wijaya', role: 'Siswa', detail: 'XII RPL 1', bio: 'Sedang belajar JavaScript dan Node.js.' }
];





const seedTasks = [
    { id: 1, title: 'Latihan Persamaan Kuadrat', desc: 'Kerjakan soal latihan pada buku paket halaman 42 nomor 1–10.', category: 'Teori', subject: 'Matematika', due: '2026-10-18', status: 'belum', class: 'XI RPL 1', score: null },
    { id: 2, title: 'Teks Editorial', desc: 'Buat ringkasan teks editorial dan temukan gagasan utamanya.', category: 'Teori', subject: 'Bahasa Indonesia', due: '2026-10-17', status: 'Selesai', class: 'XI RPL 1', score: 88 },
    { id: 3, title: 'Laporan Praktik Routing', desc: 'Lampirkan topologi jaringan dan hasil konfigurasi router.', category: 'Bengkel', subject: 'Administrasi Jaringan', due: '2026-10-15', status: 'selesai', class: 'XI TKJ 2', score: 88 },
    { id: 4, title: 'Mini Project Halaman Web', desc: 'Buat halaman profil responsif menggunakan HTML dan CSS.', category: 'Bengkel', subject: 'Pemrograman Web', due: '2026-10-21', status: 'selesai', class: 'XI RPL 1', score: 95 }
];
let currentUser = null, currentPage = 'beranda', taskFilter = 'Semua', taskCategory = 'Semua', searchRole = 'Semua', searchQuery = '', tasks = [], topics = [], attendance = [];
let bioText = '', showAverage = true, showRank = true, cameraStream = null, currentPosition = null;
let notifications = [], adminAccounts = [];
let schoolSettings = { latitude: '-6.200000', longitude: '106.816666', radius: 100, open: '06:30', late: '07:15', cutoff: '23:59', alpha: 3 };
let identityRequests = [];
const userNav = [['beranda', '⌂', 'Beranda'], ['cari', '⌕', 'Cari'], ['absen', '◷', 'Absen'], ['tugas', '▤', 'Tugas'], ['profil', '◉', 'Profil']];
const adminNav = [['beranda', '⌂', 'Beranda'], ['cari', '⌕', 'Cari'], ['kehadiran', '◷', 'Kehadiran'], ['laporan', '▥', 'Laporan'], ['profil', '◉', 'Profil']];
function persist() { localStorage.setItem('sh_topics', JSON.stringify(topics)); localStorage.setItem('sh_tasks', JSON.stringify(tasks)); localStorage.setItem('sh_att', JSON.stringify(attendance)) }
function toast(msg) { let el = $('#toast'); el.textContent = msg; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2500) }
function esc(s = '') { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) }
function ago(t) { let m = Math.max(1, Math.floor((Date.now() - t) / 60000)); if (m < 60) return `${m} menit lalu`; let h = Math.floor(m / 60); if (h < 24) return `${h} jam lalu`; return `${Math.floor(h / 24)} hari lalu` }
function prettyDate(s) { return new Date(s + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) }
async function api(path, options = {}) {
    let response = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...(options.headers || {})
        }
    });
    let text = await response.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = {}; }
    if (!response.ok) {
        let msg = data.error || data.message;
        if (!msg) {
            if (response.status === 429) msg = 'Terlalu banyak percobaan. Harap tunggu beberapa saat.';
            else if (response.status === 401) msg = 'Email atau kata sandi salah.';
            else if (response.status === 403) msg = 'Akses tidak diizinkan atau akun belum aktif.';
            else if (typeof text === 'string' && text.length > 0 && text.length < 120 && !text.includes('<html')) msg = text;
            else msg = 'Permintaan belum dapat diproses.';
        }
        throw new Error(msg);
    }
    return data;
}
renderUserAttendance = async function () {
    if (window.renderUserAttendanceBridge) {
        return window.renderUserAttendanceBridge();
    }
};
$('#togglePass').onclick = () => { let p = $('#password'); p.type = p.type === 'password' ? 'text' : 'password' };
const serverAttendanceRenderer = renderUserAttendance;
renderUserAttendance = serverAttendanceRenderer;
$('#authSwitch').onclick = () => { let registering = $('#registerView').classList.toggle('hidden'); $('#loginForm').classList.toggle('hidden', registering); $('#googleLogin').classList.toggle('hidden', registering); $('#authTitle').textContent = registering ? 'Buat akun EduSmart' : 'Masuk ke EduSmart'; $('#authDescription').textContent = registering ? 'Lengkapi data dan akun Anda langsung aktif setelah mendaftar.' : 'Gunakan email dan kata sandi akun Anda.'; $('#authSwitchText').textContent = registering ? 'Sudah punya akun?' : 'Belum punya akun?'; $('#authSwitch').textContent = registering ? 'Kembali ke masuk' : 'Daftar akun sekolah' };
$('#loginForm').onsubmit = async e => { e.preventDefault(); $('#loginError').classList.add('hidden'); try { let result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#username').value.trim(), password: $('#password').value }) }); enterApp(result.user) } catch (error) { $('#loginError').textContent = error.message; $('#loginError').classList.remove('hidden') } };
$('#registerForm').onsubmit = async e => { e.preventDefault(); $('#registerError').classList.add('hidden'); let data = { name: $('#registerName').value.trim(), email: $('#registerEmail').value.trim(), password: $('#registerPassword').value, role: $('#registerRole').value, identityNumber: $('#registerIdentity').value.trim(), detail: $('#registerDetail').value.trim() }; try { let result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }); $('#registerPassword').value = ''; if (result.autoActivated) { let session = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: data.email, password: data.password }) }); enterApp(session.user); toast('Akun langsung aktif. Selamat datang di EduSmart.') } else { $('#authSwitch').click(); $('#loginError').textContent = result.message; $('#loginError').classList.remove('hidden') } } catch (error) { $('#registerError').textContent = error.message; $('#registerError').classList.remove('hidden') } };
$('#googleLogin').onclick = () => { window.location.assign('/auth/google') };
$('#googleRegister').onclick = async () => { let data = { name: $('#registerName').value.trim(), email: $('#registerEmail').value.trim(), role: $('#registerRole').value, identityNumber: $('#registerIdentity').value.trim(), detail: $('#registerDetail').value.trim() }; try { let result = await api('/api/auth/google-intent', { method: 'POST', body: JSON.stringify(data) }); window.location.assign(result.url) } catch (error) { $('#registerError').textContent = error.message; $('#registerError').classList.remove('hidden') } };
if (new URLSearchParams(location.search).get('auth') === 'pending') { $('#loginError').textContent = 'Pendaftaran Google berhasil. Akun menunggu aktivasi admin.'; $('#loginError').classList.remove('hidden') } else if (new URLSearchParams(location.search).has('auth')) { $('#loginError').textContent = 'Login Google tidak berhasil. Coba kembali atau gunakan email dan kata sandi.'; $('#loginError').classList.remove('hidden') }
api('/api/auth/session').then(result => { googleLoginEnabled = result.googleLoginEnabled; $('#googleLogin').classList.toggle('hidden', !googleLoginEnabled); $('#googleRegister').classList.toggle('hidden', !googleLoginEnabled); if (result.user) enterApp(result.user) }).catch(() => { $('#loginError').textContent = 'Server belum siap. Coba muat ulang halaman.'; $('#loginError').classList.remove('hidden') });
let googleLoginEnabled = false;
function enterApp(user) { currentUser = user; $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden'); setupApp() }
async function setupApp() { let role = currentUser.role; $('#topUser').textContent = currentUser.name; $('#topRole').textContent = role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : role === 'staf' ? 'Staf' : 'Admin sekolah'; $('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); renderNav(); goPage('beranda'); updateNotificationBadge(); try { let [postData, taskData, settingsData] = await Promise.all([api('/api/posts'), api('/api/assignments'), api('/api/attendance/settings')]); topics = postData.posts.map(post => ({ ...post, time: new Date(post.createdAt + 'Z').getTime(), owner: post.authorId === currentUser.id ? 'demo' : 'other' })); tasks = taskData.assignments.map(task => ({ ...task, desc: task.description || '', status: 'Belum', category: task.category || 'Teori', score: null, due: task.due.slice(0, 10) })); schoolSettings = { ...schoolSettings, latitude: String(settingsData.settings.latitude), longitude: String(settingsData.settings.longitude), radius: settingsData.settings.radiusMeters, open: settingsData.settings.openTime, late: settingsData.settings.lateAfter, close: settingsData.settings.closeTime }; if (currentPage === 'beranda') renderHome() } catch (error) { toast('Sebagian data belum dapat dimuat dari server.') } }
function renderNav() { let items = currentUser.role === 'admin' ? adminNav : userNav; $('#sideNav').innerHTML = items.map(([id, icon, label]) => `<a href="#" class="nav-link ${currentPage === id ? 'active' : ''}" data-page="${id}" aria-label="${label}" title="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`).join(''); $$('[data-page]').forEach(a => a.onclick = e => { e.preventDefault(); goPage(a.dataset.page) }) }
function goPage(page) { if (currentPage === 'absen' && page !== 'absen' && cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null } let adminOnly = ['kehadiran', 'laporan', 'akun', 'kalender', 'aturan', 'pengingat', 'identitas']; if (adminOnly.includes(page) && currentUser.role !== 'admin') { page = 'beranda'; toast('Halaman ini hanya tersedia untuk admin sekolah.') } if (page === 'absen' && currentUser.role === 'admin') page = 'kehadiran'; currentPage = page; let titles = { beranda: 'Beranda', cari: 'Cari warga sekolah', tugas: 'Tugas', profil: 'Profil', absen: 'Absen wajah', kehadiran: 'Kehadiran', laporan: 'Laporan', notifikasi: 'Notifikasi', akun: 'Pengelolaan akun', kalender: 'Kalender sekolah', aturan: 'Aturan kehadiran', pengingat: 'Pengingat kehadiran', identitas: 'Buka identitas' }; $('#pageName').textContent = titles[page] || 'Beranda'; renderNav(); let f = { beranda: renderHome, cari: renderSearch, tugas: renderTasks, profil: renderProfile, absen: renderAttendance, kehadiran: renderAttendance, laporan: renderReports, notifikasi: renderNotifications, akun: renderAdminAccounts, kalender: renderCalendar, aturan: renderAttendanceSettings, pengingat: renderReminders, identitas: renderIdentityRequests }; if (!f[page]) { currentPage = 'beranda'; renderNav(); renderHome() } else { f[page](); if (page === 'profil' && currentUser.role === 'admin') addAdminShortcuts() } }
$('#logoutBtn').onclick = async () => { if (cameraStream) cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null; await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => { }); currentUser = null; $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); $('#password').value = ''; $('#username').value = ''; toast('Anda telah keluar dari akun.') }; $('#profileShortcut').onclick = () => goPage('profil'); $('#notificationBtn').onclick = () => goPage('notifikasi');
function heading(kicker, title, desc, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>` }
function stat(icon, num, label, change = '') { return `<div class="card stat-card"><div class="stat-top"><span class="stat-icon">${icon}</span>${change ? `<span class="stat-change">${change}</span>` : ''}</div><div class="stat-number">${num}</div><div class="stat-label">${label}</div></div>` }
function topicHTML(t) { let canDelete = t.owner === 'demo' || t.canDelete || (currentUser && currentUser.role === 'admin'); return `<article class="topic"><div class="topic-head"><div class="anon-avatar">◌</div><div><b>Warga sekolah</b><small>${ago(t.time)}</small></div><span class="anon-tag">● Anonim</span></div><h4>${esc(t.title)}</h4><p>${esc(t.body)}</p><div class="topic-actions"><button class="text-action ${t.liked ? 'liked' : ''}" data-like="${t.id}">♡ ${t.likes} Suka</button><button class="text-action" data-comments="${t.id}">▱ ${t.comments.length} Komentar</button>${canDelete ? `<button class="text-action text-danger" data-delete-topic="${t.id}">Hapus</button>` : ''}</div><div class="comment-box hidden" id="comments-${t.id}">${t.comments.length ? t.comments.map(c => `<div class="comment-item"><span class="anon-avatar" style="width:26px;height:26px;font-size:14px">◌</span><p><b>Anonim</b> · ${ago(c.time)}<br>${esc(c.body)}</p></div>`).join('') : '<div class="empty-state" style="padding:12px">Belum ada komentar.</div>'}<div class="comment-input"><input id="comment-input-${t.id}" maxlength="500" placeholder="Tulis komentar anonim..."><button data-send-comment="${t.id}">Kirim</button></div></div></article>` }
async function reloadPosts() { let result = await api('/api/posts'); topics = result.posts.map(post => ({ ...post, time: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(), owner: (post.isOwner || (currentUser && currentUser.role === 'admin')) ? 'demo' : 'other', canDelete: Boolean(post.canDelete || post.isOwner || (currentUser && currentUser.role === 'admin')) })) }
bindTopicEvents = function () { if ($('#topicForm')) $('#topicForm').onsubmit = async event => { event.preventDefault(); try { await api('/api/posts', { method: 'POST', body: JSON.stringify({ title: $('#topicTitle').value.trim(), body: $('#topicBody').value.trim() }) }); await reloadPosts(); renderHome(); toast('Topik tersimpan di server.') } catch (error) { toast(error.message) } }; $$('[data-like]').forEach(button => button.onclick = async () => { try { await api(`/api/posts/${button.dataset.like}/like`, { method: 'POST', body: '{}' }); await reloadPosts(); renderHome() } catch (error) { toast(error.message) } }); $$('[data-comments]').forEach(button => button.onclick = () => $('#comments-' + button.dataset.comments).classList.toggle('hidden')); $$('[data-send-comment]').forEach(button => button.onclick = async () => { let postId = button.dataset.sendComment, input = $('#comment-input-' + postId); try { await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: input.value.trim() }) }); await reloadPosts(); renderHome(); $('#comments-' + postId)?.classList.remove('hidden') } catch (error) { toast(error.message) } }); $$('[data-delete-topic]').forEach(button => button.onclick = async () => { if (!confirm('Apakah Anda yakin ingin menghapus topik ini?')) return; try { await api(`/api/posts/${button.dataset.deleteTopic}`, { method: 'DELETE' }); await reloadPosts(); renderHome(); toast('Topik berhasil dihapus.') } catch (error) { toast(error.message) } }); $$('[data-page]').forEach(link => link.onclick = event => { event.preventDefault(); goPage(link.dataset.page) }) };
function mapAssignment(task) {
    let isSubmitted = Boolean(task.submissionId);
    let isPastDue = new Date(task.due) < new Date();
    let computedStatus = isSubmitted ? 'Selesai' : (isPastDue ? 'Terlambat' : 'Belum');
    return {
        ...task,
        desc: task.description || '',
        teacherName: task.teacherName || '',
        status: computedStatus,
        category: task.category || 'Teori',
        score: (task.score !== undefined && task.score !== null) ? Number(task.score) : null,
        due: (task.due || '').slice(0, 10),
        submissionId: task.submissionId || null,
        submittedAt: task.submittedAt || null,
        fileOriginalName: task.fileOriginalName || null,
        feedback: task.feedback || null,
        answerText: task.answerText || null,
        submissionCount: Number(task.submissionCount) || 0
    };
}
setupApp = async function () { let role = currentUser.role; $('#topUser').textContent = currentUser.name; $('#topRole').textContent = role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : role === 'staf' ? 'Staf' : 'Admin sekolah'; $('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); renderNav(); goPage('beranda'); updateNotificationBadge(); try { let [postData, taskData, settingsData] = await Promise.all([api('/api/posts'), api('/api/assignments'), api('/api/attendance/settings')]); topics = postData.posts.map(post => ({ ...post, time: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(), owner: (post.isOwner || (currentUser && currentUser.role === 'admin')) ? 'demo' : 'other', canDelete: Boolean(post.canDelete || post.isOwner || (currentUser && currentUser.role === 'admin')) })); if (taskData.availableClasses) window.availableClasses = taskData.availableClasses; tasks = (taskData.assignments || []).map(mapAssignment); schoolSettings = { ...schoolSettings, latitude: String(settingsData.settings.latitude), longitude: String(settingsData.settings.longitude), radius: settingsData.settings.radiusMeters, open: settingsData.settings.openTime, late: settingsData.settings.lateAfter, close: settingsData.settings.closeTime }; renderNav(); if (currentPage === 'beranda') renderHome() } catch (error) { toast('Sebagian data belum dapat dimuat: ' + error.message) } };
addTaskForm = function () { if ($('#taskCreateForm')) return; let classOptions = (window.availableClasses && window.availableClasses.length ? window.availableClasses : ['Semua Kelas', 'XII RPL 1', 'XII RPL 2', 'XI RPL 1', 'XI RPL 2', 'X RPL 1', 'X RPL 2']); $('#pageContent').insertAdjacentHTML('beforeend', `<section class="card task-create-panel"><div class="card-title"><h3>Buat tugas untuk kelas</h3><button class="text-action" id="cancelTaskCreate">Batal</button></div><form id="taskCreateForm" class="grid two-col"><div><label class="field-label">Kategori tugas</label><select id="newCategory" class="field" required><option value="Teori">Teori</option><option value="Bengkel">Bengkel</option></select><label class="field-label">Kelas tujuan</label><input id="newClass" class="field" required list="classList" placeholder="Pilih atau ketik kelas (misal: XII RPL atau Semua Kelas)" maxlength="60"><datalist id="classList">${classOptions.map(c => `<option value="${esc(c)}"></option>`).join('')}</datalist><label class="field-label">Mata pelajaran</label><input id="newSubject" class="field" required value="${esc(currentUser.detail && currentUser.role === 'guru' ? currentUser.detail : '')}" placeholder="Contoh: Matematika" maxlength="80"></div><div><label class="field-label">Judul tugas</label><input id="newTitle" class="field" required maxlength="150" placeholder="Judul tugas..."><label class="field-label">Tenggat</label><input id="newDue" class="field" type="datetime-local" required><label class="field-label">Instruksi</label><textarea id="newDesc" class="field" rows="3" required maxlength="5000" placeholder="Petunjuk pengerjaan tugas..."></textarea></div><button class="btn btn-primary" type="submit">Simpan &amp; Publikasikan tugas ↗</button></form></section>`); $('#cancelTaskCreate').onclick = () => $('#taskCreateForm').closest('.task-create-panel').remove(); $('#taskCreateForm').onsubmit = async event => { event.preventDefault(); try { await api('/api/assignments', { method: 'POST', body: JSON.stringify({ title: $('#newTitle').value.trim(), instructions: $('#newDesc').value.trim(), subject: $('#newSubject').value.trim(), className: $('#newClass').value.trim(), category: $('#newCategory').value, dueAt: new Date($('#newDue').value).toISOString(), maxScore: 100 }) }); let result = await api('/api/assignments'); if (result.availableClasses) window.availableClasses = result.availableClasses; tasks = (result.assignments || []).map(mapAssignment); renderTasks(); toast('Tugas berhasil disimpan dan dikirim ke ' + $('#newClass').value.trim() + '!') } catch (error) { toast(error.message) } } };
renderAccountRows = function (accounts) { return accounts.map((account, index) => `<tr><td><b>${esc(account.name)}</b></td><td>${esc(account.email)}</td><td>${esc(account.role)}</td><td>${esc(account.identityNumber)}</td><td>${esc(account.detail)}</td><td><span class="status ${account.status === 'AKTIF' ? 'status-selesai' : 'status-belum'}">${esc(account.status)}</span></td><td>${account.role !== 'ADMIN' ? `<button class="text-action" data-account-status="${index}">${account.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="text-action text-danger" style="font-weight:700" data-account-delete="${account.id}" data-account-name="${esc(account.name)}">🗑 Hapus</button>` : '<span class="muted">—</span>'}</td></tr>`).join('') };
renderAdminAccounts = async function () { try { let result = await api('/api/admin/accounts'); adminAccounts = result.accounts; $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', `${adminAccounts.length} akun di database sekolah.`) + `<section class="card"><div class="card-title"><h3>Akun warga sekolah</h3><input id="accountSearch" class="field compact-input" placeholder="Cari nama atau email"></div><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>NIS / NIP</th><th>Identitas</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="accountRows">${renderAccountRows(adminAccounts)}</tbody></table></div></section>`; let bind = () => { $$('[data-account-status]').forEach(button => button.onclick = async () => { let account = adminAccounts[Number(button.dataset.accountStatus)]; try { await api(`/api/admin/accounts/${account.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: account.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF' }) }); renderAdminAccounts() } catch (error) { toast(error.message) } }); $$('[data-account-delete]').forEach(button => button.onclick = async () => { let id = button.dataset.accountDelete; let name = button.dataset.accountName; if (!confirm(`Hapus warga sekolah "${name}"? Seluruh data yang terkait akan dihapus secara permanen.`)) return; try { await api(`/api/admin/accounts/${id}`, { method: 'DELETE' }); toast(`Warga sekolah "${name}" berhasil dihapus.`); renderAdminAccounts() } catch (error) { toast(error.message) } }) }; $('#accountSearch').oninput = () => { let q = $('#accountSearch').value.toLowerCase(); $('#accountRows').innerHTML = renderAccountRows(adminAccounts.filter(account => (account.name + ' ' + account.email + ' ' + account.identityNumber).toLowerCase().includes(q))); bind() }; bind() } catch (error) { $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', error.message) } };
updateNotificationBadge = async function () { try { let result = await api('/api/notifications'), unread = result.notifications.filter(notification => !notification.isRead).length; $('#notificationBtn').classList.toggle('has-unread', unread > 0); $('#notificationBtn').setAttribute('aria-label', unread ? `${unread} notifikasi belum dibaca` : 'Buka notifikasi') } catch (error) { $('#notificationBtn').classList.remove('has-unread') } };
renderNotifications = async function () { try { let result = await api('/api/notifications'), items = result.notifications; $('#pageContent').innerHTML = heading('PEMBARUAN', 'Notifikasi', `${items.filter(item => !item.isRead).length} belum dibaca.`, '<button class="btn btn-outline" id="readAllNotifications">Tandai semua dibaca</button>') + `<section class="notification-list">${items.map(item => `<article class="notification-item ${item.isRead ? '' : 'unread'}"><span class="notification-mark">✳</span><div><b>${esc(item.title)}</b><p>${esc(item.message)}</p><small>${new Date(item.createdAt + 'Z').toLocaleString('id-ID')}</small></div>${item.isRead ? '' : '<button class="text-action" data-notification-read="${item.id}">Tandai dibaca</button>'}</article>`).join('') || '<div class="empty-state">Belum ada notifikasi.</div>'}</section>`; $('#readAllNotifications').onclick = async () => { try { await api('/api/notifications/read-all', { method: 'PATCH', body: '{}' }); renderNotifications(); updateNotificationBadge() } catch (error) { toast(error.message) } }; $$('[data-notification-read]').forEach(button => button.onclick = async () => { try { await api(`/api/notifications/${button.dataset.notificationRead}/read`, { method: 'PATCH', body: '{}' }); renderNotifications(); updateNotificationBadge() } catch (error) { toast(error.message) } }) } catch (error) { $('#pageContent').innerHTML = heading('PEMBARUAN', 'Notifikasi', error.message) } };
renderAttendanceSettings = async function () { let settings; try { settings = (await api('/api/attendance/settings')).settings } catch (error) { return toast(error.message) } $('#pageContent').innerHTML = heading('PENGATURAN SEKOLAH', 'Aturan kehadiran', 'Perubahan disimpan di database server.') + `<form id="attendanceSettingsForm" class="card settings-form"><div class="settings-grid"><label>Koordinat lintang<input class="field" id="settingLatitude" type="number" step="0.000001" value="${settings.latitude}" required></label><label>Koordinat bujur<input class="field" id="settingLongitude" type="number" step="0.000001" value="${settings.longitude}" required></label><label>Radius (meter)<input class="field" id="settingRadius" type="number" min="30" max="500" value="${settings.radiusMeters}" required></label><label>Jam mulai<input class="field" id="settingOpen" type="time" value="${settings.openTime}" required></label><label>Jam tutup<input class="field" id="settingClose" type="time" value="${settings.closeTime}" required></label><label>Batas terlambat<input class="field" id="settingLate" type="time" value="${settings.lateAfter}" required></label></div><button class="btn btn-primary" type="submit">Simpan pengaturan</button></form>`; $('#attendanceSettingsForm').onsubmit = async event => { event.preventDefault(); try { await api('/api/admin/attendance/settings', { method: 'PUT', body: JSON.stringify({ latitude: Number($('#settingLatitude').value), longitude: Number($('#settingLongitude').value), radiusMeters: Number($('#settingRadius').value), openTime: $('#settingOpen').value, closeTime: $('#settingClose').value, lateAfter: $('#settingLate').value }) }); toast('Pengaturan tersimpan.') } catch (error) { toast(error.message) } } };
renderAttendance = function () { if (currentUser.role !== 'admin') return renderUserAttendance(); $('#pageContent').innerHTML = heading('PENGELOLAAN SEKOLAH', 'Verifikasi foto kehadiran', 'Tinjau pengajuan foto yang disimpan di server sekolah.') + `<section class="card"><div class="card-title"><h3>Pengajuan kehadiran</h3><button class="btn btn-outline" id="reloadAttendance">Muat ulang</button></div><div id="adminAttendanceRows">Memuat data...</div></section>`; let load = async () => { try { let result = await api('/api/admin/attendance'); $('#adminAttendanceRows').innerHTML = result.attendance.map(row => `<article class="admin-attendance-row"><img src="/api/attendance/${encodeURIComponent(row.id)}/photo" alt="Foto kehadiran ${esc(row.name)}"><div><b>${esc(row.name)}</b><small>${esc(row.role)} · ${new Date(row.capturedAt).toLocaleString('id-ID')} · ${esc(row.day)}</small><span class="status ${row.verification === 'DISETUJUI' ? 'status-selesai' : 'status-belum'}">${esc(row.verification)}</span></div><div>${row.verification === 'MENUNGGU' ? `<button class="btn btn-primary" data-review-att="${row.id}" data-verification="DISETUJUI">Setujui</button><button class="btn btn-outline" data-review-att="${row.id}" data-verification="DITOLAK">Tolak</button>` : ''}</div></article>`).join('') || '<div class="empty-state">Belum ada pengajuan.</div>'; $$('[data-review-att]').forEach(button => button.onclick = async () => { try { await api(`/api/admin/attendance/${button.dataset.reviewAtt}`, { method: 'PATCH', body: JSON.stringify({ verification: button.dataset.verification }) }); load() } catch (error) { toast(error.message) } }) } catch (error) { $('#adminAttendanceRows').textContent = error.message } }; $('#reloadAttendance').onclick = load; load() };
function renderHome() {
    let action = currentUser.role === 'guru' ? '<button class="btn btn-primary" data-page="tugas">＋ Tambah tugas</button>' : ''; $('#pageContent').innerHTML = heading('KOMUNITAS SEKOLAH', 'Halo, ' + esc(currentUser.name.split(' ')[0]) + '! 👋', 'Apa yang sedang terjadi di sekolah hari ini?', action) + `<div class="grid three-col" style="margin-bottom:18px">${stat('▤', topics.length, 'Topik dibagikan', 'Komunitas')}${stat('♡', topics.reduce((a, t) => a + t.likes, 0), 'Suka dari warga', 'Aktif')}${stat('✳', '100%', 'Ruang anonim', 'Privasi')}</div><div class="grid two-col"><section><div class="hero-card"><div class="eyebrow">KOMUNITAS YANG PEDULI</div><h2>Satu cerita kecil bisa membawa perubahan besar.</h2><p>Bagikan informasi, ide, atau hal yang perlu diperhatikan di lingkungan sekolah.</p><button class="btn" id="scrollToTopicForm">＋ Tulis topik</button></div><div class="card" id="topicFormCard" style="margin-top:18px"><div class="card-title"><h3>Bagikan sesuatu</h3><small>Anonim untuk semua</small></div><form id="topicForm"><input id="topicTitle" class="field" maxlength="120" placeholder="Judul topik..." required><textarea id="topicBody" class="field" maxlength="500" rows="3" placeholder="Ceritakan informasi atau ide kamu..." required style="margin-top:9px;resize:vertical"></textarea><div class="compose-foot"><span class="hint">Maks. 500 karakter untuk isi</span><button class="btn btn-primary" type="submit">Publikasikan ↗</button></div></form></div><div class="card" style="margin-top:18px"><div class="card-title"><h3>Topik terbaru</h3><small>${topics.length} diskusi</small></div><div id="topicFeed">${[...topics].sort((a, b) => b.time - a.time).map(topicHTML).join('') || '<div class="empty-state"><div class="empty-icon">✳</div><b>Belum ada topik</b>Mulai dengan menulis topik pertama.</div>'}</div></div></section><aside class="grid" style="align-content:start"><div class="card"><div class="card-title"><h3>Agenda & pengingat</h3><small>SEKITAR KAMU</small></div><div class="mini-list"><div class="mini-item"><div class="mini-icon">▦</div><div><b>Tenggat tugas terdekat</b><small>${tasks.filter(t => t.status !== 'Selesai').length} tugas menunggu diselesaikan</small></div></div><div class="mini-item"><div class="mini-icon">◷</div><div><b>Periksa jadwal sekolah</b><small>Pantau informasi terbaru dari guru</small></div></div><div class="mini-item"><div class="mini-icon">✳</div><div><b>Jaga ruang tetap nyaman</b><small>Laporkan ancaman atau perundungan</small></div></div></div></div><div class="side-note"><h4>🛡 Privasi adalah prioritas</h4><p>Nama penulis dan pemberi komentar tidak ditampilkan. Identitas hanya dapat dibuka admin melalui laporan yang diverifikasi dan seluruh prosesnya dicatat.</p></div><div class="card"><div class="card-title"><h3>Menu cepat</h3></div><div class="mini-list"><div class="mini-item"><div class="mini-icon">⌕</div><div><b><a href="#" data-page="cari" style="color:inherit;text-decoration:none">Cari warga sekolah</a></b><small>Temukan profil siswa dan guru</small></div></div><div class="mini-item"><div class="mini-icon">▤</div><div><b><a href="#" data-page="tugas" style="color:inherit;text-decoration:none">Lihat tugas</a></b><small>Cek status dan tenggat</small></div></div></div></div></aside></div>`;
    $('#scrollToTopicForm').onclick = () => { let card = $('#topicFormCard'); if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#topicTitle').focus(), 400) } }; $('#topicForm').onsubmit = e => { e.preventDefault(); let title = $('#topicTitle').value.trim(), body = $('#topicBody').value.trim(); if (!title || !body) return; topics.unshift({ id: Date.now(), title, body, time: Date.now(), likes: 0, liked: false, comments: [], owner: 'demo' }); persist(); renderHome(); toast('Topik berhasil dipublikasikan secara anonim.') }; bindTopicEvents()
}
function bindTopicEvents() { $$('[data-like]').forEach(b => b.onclick = () => { let t = topics.find(t => t.id == b.dataset.like); if (t) { t.liked = !t.liked; t.likes += t.liked ? 1 : -1; persist(); renderHome() } }); $$('[data-comments]').forEach(b => b.onclick = () => $('#comments-' + b.dataset.comments).classList.toggle('hidden')); $$('[data-send-comment]').forEach(b => b.onclick = () => { let t = topics.find(t => t.id == b.dataset.sendComment), input = $('#comment-input-' + b.dataset.sendComment), body = input.value.trim(); if (!body) return toast('Komentar tidak boleh kosong.'); t.comments.push({ id: Date.now(), body, time: Date.now() }); persist(); renderHome(); $('#comments-' + t.id).classList.remove('hidden'); toast('Komentar terkirim secara anonim.') }); $$('[data-delete-topic]').forEach(b => b.onclick = () => { topics = topics.filter(t => t.id != b.dataset.deleteTopic); persist(); renderHome(); toast('Topik milikmu dihapus.') }); $$('[data-page]').forEach(a => a.onclick = e => { e.preventDefault(); goPage(a.dataset.page) }) }
function renderSearch() {
    let list = people.filter(p => (searchRole === 'Semua' || p.role === searchRole) && (p.name + ' ' + p.detail + ' ' + p.bio).toLowerCase().includes(searchQuery.toLowerCase())); $('#pageContent').innerHTML = heading('JELAJAHI SEKOLAH', 'Cari warga sekolah', 'Temukan siswa, guru, atau staf berdasarkan nama, kelas, atau pelajaran.') + `<div class="search-row"><input id="peopleSearch" class="search-field" value="${esc(searchQuery)}" placeholder="⌕  Cari nama, kelas, atau pelajaran..."><button class="btn btn-primary" id="searchReset">Reset</button></div><div class="filter-row">${['Semua', 'Siswa', 'Guru', 'Staf'].map(x => `<button class="filter-chip ${searchRole === x ? 'active' : ''}" data-person-filter="${x}">${x}</button>`).join('')}</div><div class="card-title"><h3>Hasil pencarian</h3><small>${list.length} profil ditemukan</small></div><div class="people-grid">${list.map((p, i) => `<article class="person-card"><div class="person-avatar">◌</div><span class="role-tag">${p.role.toUpperCase()}</span><h3>${esc(p.name)}</h3><p>${esc(p.detail)}</p><button class="btn btn-outline" data-person="${esc(p.name)}">Lihat profil ↗</button></article>`).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">⌕</div><b>Tidak ada yang cocok dengan pencarianmu.</b>Coba nama lain atau kelasnya.</div>'}</div>`;
    $('#peopleSearch').oninput = e => { searchQuery = e.target.value; let pos = e.target.selectionStart; renderSearch(); let input = $('#peopleSearch'); input.focus(); input.setSelectionRange(pos, pos) }; $('#searchReset').onclick = () => { searchQuery = ''; searchRole = 'Semua'; renderSearch() }; $$('[data-person-filter]').forEach(b => b.onclick = () => { searchRole = b.dataset.personFilter; renderSearch() }); $$('[data-person]').forEach(b => b.onclick = () => showPerson(b.dataset.person))
}
function showPerson(name) { let p = people.find(p => p.name === name); if (!p) return; $('#pageContent').innerHTML = heading('PROFIL WARGA SEKOLAH', esc(p.name), 'Informasi profil yang dibagikan oleh pemilik.') + `<div class="grid two-col"><div class="card"><div class="person-avatar" style="margin:0 0 12px">◌</div><span class="role-tag">${p.role}</span><h2 style="font:800 23px Manrope">${esc(p.name)}</h2><p class="muted">${esc(p.detail)}</p><p class="profile-bio">${esc(p.bio)}</p><div class="field-label">Komentar anonim</div><textarea class="field" id="personComment" maxlength="500" rows="3" placeholder="Tulis komentar yang sopan..."></textarea><button class="btn btn-primary" style="margin-top:10px" id="sendPersonComment">Kirim komentar</button><div id="personComments" class="comment-box" style="margin-top:15px">Belum ada komentar.</div></div><div class="side-note"><h4>🛡 Komentar tetap anonim</h4><p>Pemilik profil dapat membaca komentar, tetapi tidak dapat melihat siapa yang menulisnya. Jaga komunikasi tetap sopan dan aman.</p></div></div>`; $('#sendPersonComment').onclick = () => { let v = $('#personComment').value.trim(); if (!v) return toast('Komentar tidak boleh kosong.'); $('#personComments').innerHTML = `<div class="comment-item"><span class="anon-avatar" style="width:26px;height:26px">◌</span><p><b>Anonim</b><br>${esc(v)}</p></div>`; $('#personComment').value = ''; toast('Komentar terkirim secara anonim.') } }
function renderTasks() {
    let mine = tasks.filter(t => {
        if (currentUser.role === 'guru' || currentUser.role === 'admin') return true;
        if (!currentUser.detail) return true;
        let studentClass = (currentUser.detail || '').trim().toLowerCase(), taskClass = (t.class || '').trim().toLowerCase();
        return taskClass === 'semua' || taskClass === 'semua kelas' || taskClass === studentClass || taskClass.includes(studentClass) || studentClass.includes(taskClass);
    });
    let filtered = mine.filter(t => (taskCategory === 'Semua' || t.category === taskCategory) && (taskFilter === 'Semua' || (taskFilter === 'Belum' && t.status === 'Belum') || (taskFilter === 'Terlambat' && t.status === 'Terlambat') || (taskFilter === 'Selesai' && t.status === 'Selesai')));
    let action = currentUser.role === 'guru' ? '<button class="btn btn-primary" id="addTaskBtn">＋ Tambah tugas</button>' : '';
    let isStudent = currentUser.role === 'siswa';
    let isTeacher = currentUser.role === 'guru';

    $('#pageContent').innerHTML = heading('PUSAT PEMBELAJARAN', 'Tugas & penilaian', 'Pantau tugas, tenggat, dan perkembangan belajarmu.', action) +
        `<div class="grid three-col" style="margin-bottom:19px">
        ${stat('▤', mine.length, 'Total tugas', isStudent ? `Kelas: ${esc(currentUser.detail || '-')}` : 'Semua kategori')}
        ${stat('◷', mine.filter(t => t.status === 'Belum').length, 'Belum selesai', 'Perlu perhatian')}
        ${stat('✓', mine.filter(t => t.status === 'Selesai').length, 'Sudah selesai', 'Bagus!')}
    </div>
    <div class="filter-row">
        ${['Semua', 'Belum', 'Terlambat', 'Selesai'].map(x => `<button class="filter-chip ${taskFilter === x ? 'active' : ''}" data-task-filter="${x}">${x}</button>`).join('')}
        <span style="width:12px"></span>
        ${['Semua', 'Teori', 'Bengkel'].map(x => `<button class="filter-chip ${taskCategory === x ? 'active' : ''}" data-task-category="${x}">${x}</button>`).join('')}
    </div>
    <div class="grid three-col">
        ${filtered.sort((a, b) => a.due.localeCompare(b.due)).map(t => {
            let statusBadge = '';
            let bottomScore = '';
            if (isStudent) {
                if (t.submissionId) {
                    if (t.score !== null) {
                        statusBadge = `<span class="status status-selesai">✓ Nilai: ${t.score}</span>`;
                        bottomScore = `<strong>Nilai: ${t.score}/100</strong>`;
                    } else {
                        statusBadge = `<span class="status status-selesai">✓ Terkumpul</span>`;
                        bottomScore = `<strong>Menunggu penilaian</strong>`;
                    }
                } else {
                    statusBadge = `<span class="status status-${t.status.toLowerCase()}">${t.status}</span>`;
                    bottomScore = `<strong>Belum dikumpulkan</strong>`;
                }
            } else {
                statusBadge = `<span class="status status-selesai">${t.submissionCount || 0} Terkumpul</span>`;
                bottomScore = `<strong>${t.submissionCount || 0} Pengumpulan</strong>`;
            }

            return `
            <article class="card task-card" style="display:flex;flex-direction:column;justify-content:space-between">
                <div>
                    <div class="task-top">
                        <span class="task-kind">${esc(t.category.toUpperCase())}</span>
                        ${statusBadge}
                    </div>
                    <h3 style="margin-top:6px">${esc(t.title)}</h3>
                    <p style="font-size:13px;line-height:1.45;color:var(--muted,#94a3b8)">${esc(t.desc)}</p>
                    <div class="task-meta" style="margin-top:8px">
                        <span>▤ ${esc(t.subject)}${t.teacherName ? ` · Guru: ${esc(t.teacherName)}` : ''}</span>
                        <span>◷ Tenggat: ${prettyDate(t.due)}</span>
                    </div>
                    <div class="task-bottom" style="margin-top:10px">
                        <span>🎯 Kelas: <b>${esc(t.class)}</b></span>
                        ${bottomScore}
                    </div>
                    ${isStudent && t.submissionId && t.feedback ? `
                        <div style="margin-top:10px;padding:8px 10px;background:rgba(29,121,89,0.12);border-left:3px solid #1d7959;border-radius:4px;font-size:12px">
                            <b>💬 Catatan Guru:</b> ${esc(t.feedback)}
                        </div>
                    ` : ''}
                </div>
                <div style="margin-top:14px;display:flex;flex-direction:column;gap:6px">
                    ${isStudent ? `
                        <button class="btn ${t.submissionId ? 'btn-outline' : 'btn-primary'}" style="width:100%" data-submit-task="${t.id}">
                            ${t.submissionId ? `📁 Lihat / Unggah Ulang (${esc(t.fileOriginalName || 'File')})` : '📤 Kirim File Pengerjaan'}
                        </button>
                    ` : ''}
                    ${isTeacher ? `
                        <button class="btn btn-primary" style="width:100%" data-view-submissions="${t.id}">
                            👥 Periksa Pengumpulan (${t.submissionCount || 0} Siswa)
                        </button>
                        <button class="btn btn-outline" style="width:100%" data-edit-task="${t.id}">
                            ⚙ Atur Status / Nilai Manual
                        </button>
                    ` : ''}
                    ${currentUser.role === 'admin' ? `
                        <button class="btn btn-outline" style="width:100%" data-view-submissions="${t.id}">
                            👥 Lihat Pengumpulan (${t.submissionCount || 0})
                        </button>
                    ` : ''}
                </div>
            </article>`;
        }).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">▤</div><b>Tidak ada tugas untuk kelas ini.</b>Coba ubah filter tugasmu.</div>'}
    </div>`;

    $$('[data-task-filter]').forEach(b => b.onclick = () => { taskFilter = b.dataset.taskFilter; renderTasks() });
    $$('[data-task-category]').forEach(b => b.onclick = () => { taskCategory = b.dataset.taskCategory; renderTasks() });
    if ($('#addTaskBtn')) $('#addTaskBtn').onclick = addTaskForm;
    $$('[data-edit-task]').forEach(b => b.onclick = () => editTask(b.dataset.editTask));
    $$('[data-submit-task]').forEach(b => b.onclick = () => openSubmitTaskModal(b.dataset.submitTask));
    $$('[data-view-submissions]').forEach(b => b.onclick = () => openSubmissionsModal(b.dataset.viewSubmissions));
}
function addTaskForm() { return window.addTaskForm ? window.addTaskForm() : null }
function editTask(id) {
    let t = tasks.find(x => x.id == id);
    if (!t) return;
    let status = prompt('Status siswa: Belum, Selesai, atau Terlambat', t.status);
    if (status === null) return;
    status = status.trim();
    if (!['Belum', 'Selesai', 'Terlambat'].includes(status)) return toast('Status tidak dikenal.');
    let score = prompt('Nilai 0–100 (kosongkan jika belum dinilai)', t.score ?? '');
    if (score !== '' && score !== null) {
        let n = Number(score);
        if (!Number.isFinite(n) || n < 0 || n > 100) return toast('Nilai harus 0 sampai 100.');
        t.score = n;
        t.status = 'Selesai';
    } else if (score === '') {
        t.score = null;
        t.status = status;
    } else t.status = status;
    persist();
    renderTasks();
    toast('Status dan nilai tugas diperbarui.');
}
function openSubmitTaskModal(taskId) {
    let t = tasks.find(x => x.id == taskId);
    if (!t) return;
    let old = $('#submitTaskDialog');
    if (old) old.remove();

    let hasSubmission = Boolean(t.submissionId);
    let dialogHTML = `
    <dialog id="submitTaskDialog" class="modal-dialog">
        <div style="padding:22px;display:flex;flex-direction:column;gap:14px;max-height:85vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:12px">
                <div>
                    <span class="eyebrow">${esc(t.category.toUpperCase())} · KELAS ${esc(t.class)}</span>
                    <h2 style="font-size:20px;margin-top:4px">${esc(t.title)}</h2>
                    <p class="muted" style="font-size:13px;margin:2px 0 0">
                        ${esc(t.subject)}${t.teacherName ? ` · Guru: ${esc(t.teacherName)}` : ''} · Tenggat: ${prettyDate(t.due)}
                    </p>
                </div>
                <button class="text-action" id="closeSubmitModal" style="font-size:18px;line-height:1;padding:4px 8px">✕</button>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03));padding:12px;border-radius:8px;border:1px solid var(--line);font-size:13px;white-space:pre-wrap"><b>Petunjuk Tugas:</b>\n${esc(t.desc || 'Tidak ada petunjuk tambahan.')}</div>

            ${hasSubmission ? `
            <div style="background:rgba(29,121,89,0.1);border:1px solid rgba(29,121,89,0.3);padding:14px;border-radius:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                    <span style="font-weight:700;color:var(--primary,#259b72);font-size:13px">✓ TUGAS SUDAH DIKUMPULKAN</span>
                    <span style="font-size:12px;color:var(--muted)">${new Date(t.submittedAt).toLocaleString('id-ID')}</span>
                </div>
                ${t.fileOriginalName ? `
                <div style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                    <span>📎 File yang diunggah:</span>
                    <a href="/api/submissions/${t.submissionId}/file" target="_blank" class="text-action" style="font-weight:600;text-decoration:underline">
                        ${esc(t.fileOriginalName)}
                    </a>
                </div>` : ''}
                ${t.answerText ? `<div style="margin-top:6px;font-size:13px"><b>Catatan Anda:</b> ${esc(t.answerText)}</div>` : ''}
                ${t.score !== null ? `
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(29,121,89,0.2)">
                    <div style="font-size:16px;font-weight:800;color:var(--primary,#259b72)">Nilai: ${t.score} / 100</div>
                    ${t.feedback ? `<div style="font-size:13px;margin-top:4px">💬 <b>Feedback Guru:</b> ${esc(t.feedback)}</div>` : ''}
                </div>` : '<div style="font-size:12px;color:var(--muted);margin-top:6px">⏳ Menunggu dinilai oleh guru.</div>'}
            </div>
            ` : ''}

            <form id="submissionUploadForm" style="display:flex;flex-direction:column;gap:12px">
                <label class="field-label" style="margin-bottom:-4px">
                    ${hasSubmission ? 'Unggah File Pengganti / Revisi (Maks 15MB)' : 'Pilih File Tugas (PDF, Dokumen, Gambar, ZIP, dll - Maks 15MB)'}
                </label>
                <input id="submitFile" type="file" class="field" ${hasSubmission ? '' : 'required'} style="padding:8px">

                <label class="field-label" style="margin-bottom:-4px">Catatan / Jawaban Teks Tambahan (Opsional)</label>
                <textarea id="submitAnswerText" class="field" rows="3" placeholder="Tuliskan keterangan tambahan atau catatan untuk guru jika ada...">${esc(t.answerText || '')}</textarea>

                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:8px">
                    <button type="button" class="btn btn-outline" id="btnCancelSubmit">Batal</button>
                    <button type="submit" class="btn btn-primary" id="btnConfirmSubmit">
                        ${hasSubmission ? '🔄 Perbarui Pengumpulan' : '📤 Kirim Tugas Sekarang'}
                    </button>
                </div>
            </form>
        </div>
    </dialog>`;

    document.body.insertAdjacentHTML('beforeend', dialogHTML);
    let modal = $('#submitTaskDialog');
    modal.showModal();

    $('#closeSubmitModal').onclick = () => modal.close();
    $('#btnCancelSubmit').onclick = () => modal.close();

    $('#submissionUploadForm').onsubmit = async (e) => {
        e.preventDefault();
        let fileInput = $('#submitFile');
        let answerText = $('#submitAnswerText').value.trim();
        let file = fileInput.files[0];

        if (!file && !hasSubmission && !answerText) {
            return toast('Silakan pilih file atau tulis jawaban terlebih dahulu.');
        }

        let btn = $('#btnConfirmSubmit');
        btn.disabled = true;
        btn.textContent = 'Mengunggah...';

        try {
            let formData = new FormData();
            if (file) formData.append('file', file);
            if (answerText) formData.append('answerText', answerText);

            let response = await fetch(`/api/assignments/${t.id}/submit`, {
                method: 'POST',
                body: formData
            });
            let result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || result.message || 'Gagal mengirim tugas.');
            }

            toast(result.message || 'Tugas berhasil dikumpulkan!');
            modal.close();

            let updated = await api('/api/assignments');
            if (updated.availableClasses) window.availableClasses = updated.availableClasses;
            tasks = (updated.assignments || []).map(mapAssignment);
            renderTasks();
        } catch (err) {
            toast(err.message);
            btn.disabled = false;
            btn.textContent = hasSubmission ? '🔄 Perbarui Pengumpulan' : '📤 Kirim Tugas Sekarang';
        }
    };
}
async function openSubmissionsModal(taskId) {
    let t = tasks.find(x => x.id == taskId);
    if (!t) return;
    let old = $('#submissionsModalDialog');
    if (old) old.remove();

    let dialogHTML = `
    <dialog id="submissionsModalDialog" class="modal-dialog">
        <div style="padding:22px;display:flex;flex-direction:column;gap:14px;max-height:85vh;overflow-y:auto">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:12px">
                <div>
                    <span class="eyebrow">${esc(t.category.toUpperCase())} · KELAS ${esc(t.class)}</span>
                    <h2 style="font-size:20px;margin-top:4px">Hasil Pengumpulan Tugas: ${esc(t.title)}</h2>
                    <p class="muted" style="font-size:13px;margin:2px 0 0">
                        ${esc(t.subject)} · Tenggat: ${prettyDate(t.due)}
                    </p>
                </div>
                <button class="text-action" id="closeSubmissionsModal" style="font-size:18px;line-height:1;padding:4px 8px">✕</button>
            </div>

            <div id="submissionsListContainer">
                <div style="text-align:center;padding:24px;color:var(--muted)">Memuat daftar pengumpulan siswa...</div>
            </div>
        </div>
    </dialog>`;

    document.body.insertAdjacentHTML('beforeend', dialogHTML);
    let modal = $('#submissionsModalDialog');
    modal.showModal();

    $('#closeSubmissionsModal').onclick = () => modal.close();

    try {
        let res = await api(`/api/assignments/${t.id}/submissions`);
        let subs = res.submissions || [];
        let container = $('#submissionsListContainer');

        if (subs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding:32px 16px">
                    <div class="empty-icon">📭</div>
                    <b>Belum ada siswa yang mengumpulkan</b>
                    <p class="muted" style="font-size:13px;margin-top:4px">Tugas ini ditujukan untuk kelas <b>${esc(t.class)}</b>.</p>
                </div>`;
            return;
        }

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                <span style="font-weight:600;font-size:14px">${subs.length} Siswa Sudah Mengumpulkan:</span>
            </div>
            <div class="submissions-list" style="display:flex;flex-direction:column;gap:12px">
                ${subs.map(sub => `
                    <article class="sub-item-card">
                        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
                            <div>
                                <h4 style="font-size:15px;margin:0;font-weight:700">${esc(sub.studentName)}</h4>
                                <div class="muted" style="font-size:12px;margin-top:2px">
                                    ${sub.identityNumber ? `NIS: <b>${esc(sub.identityNumber)}</b> · ` : ''}
                                    Kelas: <b>${esc(sub.studentClass || '-')}</b>
                                </div>
                                <div class="muted" style="font-size:12px">
                                    🕒 Waktu kirim: ${new Date(sub.submittedAt).toLocaleString('id-ID')}
                                </div>
                            </div>
                            <div>
                                ${sub.score !== null ?
                `<span class="status status-selesai" style="font-size:13px;font-weight:700">Nilai: ${sub.score} / 100</span>` :
                `<span class="status status-belum" style="font-size:13px">Belum Dinilai</span>`
            }
                            </div>
                        </div>

                        <div style="margin-top:10px;padding:10px;background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:6px">
                            ${sub.fileOriginalName ? `
                                <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                                    <span style="font-size:13px">📁 File Siswa: <b>${esc(sub.fileOriginalName)}</b></span>
                                    <a href="/api/submissions/${sub.id}/file" target="_blank" class="btn btn-outline" style="font-size:12px;padding:4px 10px;text-decoration:none">
                                        ⬇ Unduh / Buka File
                                    </a>
                                </div>
                            ` : `<div class="muted" style="font-size:12px">Tidak ada file yang dilampirkan.</div>`}
                            ${sub.answerText ? `
                                <div style="font-size:13px;margin-top:6px;border-top:1px dashed var(--line);padding-top:6px">
                                    <b>Catatan Siswa:</b>\n${esc(sub.answerText)}
                                </div>
                            ` : ''}
                        </div>

                        <form class="grade-submission-form" data-sub-id="${sub.id}" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                                <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px">
                                    Nilai (0–100):
                                    <input type="number" min="0" max="100" class="field compact-input" style="width:75px" value="${sub.score ?? ''}" placeholder="0-100" required>
                                </label>
                                <input type="text" class="field" style="flex:1;min-width:200px;font-size:12px" placeholder="Beri catatan / koreksi untuk siswa..." value="${esc(sub.feedback || '')}">
                                <button type="submit" class="btn btn-primary" style="font-size:12px;padding:6px 14px">Simpan Nilai</button>
                            </div>
                        </form>
                    </article>
                `).join('')}
            </div>
        `;

        $$('.grade-submission-form').forEach(form => {
            form.onsubmit = async (event) => {
                event.preventDefault();
                let subId = form.dataset.subId;
                let scoreInput = form.querySelector('input[type="number"]');
                let feedbackInput = form.querySelector('input[type="text"]');
                let submitBtn = form.querySelector('button[type="submit"]');

                submitBtn.disabled = true;
                submitBtn.textContent = 'Menyimpan...';

                try {
                    await api(`/api/submissions/${subId}/grade`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                            score: Number(scoreInput.value),
                            feedback: feedbackInput.value.trim()
                        })
                    });
                    toast('Nilai dan catatan berhasil disimpan!');
                    openSubmissionsModal(taskId);

                    let updated = await api('/api/assignments');
                    if (updated.availableClasses) window.availableClasses = updated.availableClasses;
                    tasks = (updated.assignments || []).map(mapAssignment);
                    renderTasks();
                } catch (err) {
                    toast(err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Simpan Nilai';
                }
            };
        });
    } catch (err) {
        $('#submissionsListContainer').innerHTML = `<div class="empty-state" style="color:#d95c58">Gagal memuat pengumpulan: ${esc(err.message)}</div>`;
    }
}
function renderProfile() {
    let isStudent = currentUser.role === 'siswa'; $('#pageContent').innerHTML = heading('AKUN SAYA', 'Profil pribadi', 'Kelola informasi yang ingin kamu bagikan kepada warga sekolah.') + `<div class="grid two-col"><section><div class="profile-cover"></div><div class="profile-info"><div class="profile-avatar">◌</div><h2>${esc(currentUser.name)}</h2><span class="role-tag">${currentUser.role.toUpperCase()}</span><p>${esc(currentUser.detail || 'Belum diatur')}</p><div class="profile-bio" id="bioDisplay">${bioText ? esc(bioText) : 'Belum ada bio. Tekan Edit profil untuk menulis deskripsi singkat.'}</div><button class="btn btn-outline" id="editBio" style="margin-top:15px">✎ Edit bio</button><div class="metric-row">${isStudent ? `<div class="metric"><b>${showAverage ? '86,5' : '—'}</b><small>Rata-rata nilai</small></div><div class="metric"><b>${showRank ? '#08' : '—'}</b><small>Peringkat kelas</small></div>` : `<div class="metric"><b>${tasks.filter(t => t.status !== 'Selesai').length}</b><small>Tugas aktif</small></div><div class="metric"><b>${people.length}</b><small>Warga demo</small></div>`}<div class="metric"><b>96%</b><small>Kehadiran</small></div></div></div></section><section class="card"><div class="card-title"><h3>Privasi profil</h3><small>ATUR SESUAI KEINGINAN</small></div><p class="muted">Pilih informasi yang boleh dilihat oleh warga sekolah lain.</p>${isStudent ? `<div class="toggle-row"><span><b>Rata-rata nilai</b><br><small class="muted">Tampilkan rata-rata semester</small></span><input class="toggle" id="showAverage" type="checkbox" ${showAverage ? 'checked' : ''}></div><div class="toggle-row"><span><b>Peringkat</b><br><small class="muted">Tampilkan posisi di kelas</small></span><input class="toggle" id="showRank" type="checkbox" ${showRank ? 'checked' : ''}></div>` : ''}<div class="side-note" style="margin-top:20px"><h4>🔒 Data sekolah terlindungi</h4><p>Nama, kelas, nomor absen, dan peran berasal dari sistem sekolah dan tidak dapat diubah dari halaman profil. Hubungi admin jika ada data yang salah.</p></div><div class="card-title" style="margin-top:22px"><h3>Ringkasan tugas</h3></div><div class="report-bar"><span style="width:${tasks.length ? Math.round(tasks.filter(t => t.status === 'Selesai').length / tasks.length * 100) : 0}%"></span></div><p class="muted">${tasks.filter(t => t.status === 'Selesai').length} dari ${tasks.length} tugas berstatus selesai.</p></section></div>`;
    $('#editBio').onclick = () => { let next = prompt('Tulis bio (maksimal 300 karakter). Jangan masukkan nomor HP atau alamat rumah.', bioText); if (next === null) return; if (next.length > 300) return toast('Bio maksimal 300 karakter.'); if (/(\+?\d[\d\s-]{8,}|\b(jalan|jl\.|alamat rumah)\b)/i.test(next)) return toast('Hindari nomor telepon atau alamat pribadi di bio.'); bioText = next.trim(); localStorage.setItem('sh_bio', bioText); renderProfile(); toast('Bio berhasil disimpan.') }; if ($('#showAverage')) $('#showAverage').onchange = e => { showAverage = e.target.checked; renderProfile() }; if ($('#showRank')) $('#showRank').onchange = e => { showRank = e.target.checked; renderProfile() }
}
function renderAttendance() {
    if (currentUser.role !== 'admin') { renderUserAttendance(); return } $('#pageContent').innerHTML = heading('PENGELOLAAN SEKOLAH', 'Kehadiran siswa', 'Catat kehadiran harian. Sakit dan izin memerlukan keterangan.') + `<div class="grid three-col" style="margin-bottom:18px">${stat('✓', attendance.filter(a => a.status === 'Hadir').length, 'Hadir', 'Hari ini')}${stat('◷', attendance.filter(a => a.status === 'Sakit' || a.status === 'Izin').length, 'Sakit / Izin', 'Perlu keterangan')}${stat('!', attendance.filter(a => a.status === 'Alpha').length, 'Alpha', 'Perlu perhatian')}</div><div class="card"><div class="card-title"><h3>Daftar kehadiran</h3><input id="attDate" type="date" class="field" style="width:auto;padding:8px" value="${new Date().toISOString().slice(0, 10)}"></div><p class="muted">Prototype demo: status awal siswa adalah Hadir. Perubahan disimpan di browser ini.</p><div class="table-wrap"><table><thead><tr><th>Nama siswa</th><th>Kelas</th><th>Status</th><th>Keterangan</th></tr></thead><tbody>${attendance.map((a, i) => `<tr><td><b>${esc(a.name)}</b></td><td>${esc(a.kelas)}</td><td><select class="attendance-select" data-att-status="${i}">${['Hadir', 'Sakit', 'Izin', 'Alpha'].map(s => `<option ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td><input class="field" data-att-note="${i}" placeholder="${['Sakit', 'Izin'].includes(a.status) ? 'Wajib diisi' : 'Opsional'}" value="${esc(a.note || '')}" style="padding:8px;min-width:130px"></td></tr>`).join('')}</tbody></table></div><button class="btn btn-primary" id="saveAttendance" style="margin-top:18px">Simpan kehadiran ↗</button><p class="hint" style="margin-top:12px">Catatan: sistem produksi perlu audit log untuk setiap koreksi dan pembatasan akses admin.</p></div>`;
    $$('[data-att-status]').forEach(s => s.onchange = () => { attendance[Number(s.dataset.attStatus)].status = s.value; renderAttendance() }); $('#saveAttendance').onclick = () => { let missing = false; $$('[data-att-note]').forEach(inp => { let a = attendance[Number(inp.dataset.attNote)]; a.note = inp.value.trim(); if (['Sakit', 'Izin'].includes(a.status) && !a.note) missing = true }); if (missing) return toast('Sakit dan Izin wajib memiliki keterangan.'); persist(); renderAttendance(); toast('Data kehadiran disimpan.') }
}
function renderReports() {
    if (currentUser.role !== 'admin') return; let done = tasks.filter(t => t.status === 'Selesai').length, late = tasks.filter(t => t.status === 'Terlambat').length, not = tasks.filter(t => t.status === 'Belum').length, counts = ['Hadir', 'Sakit', 'Izin', 'Alpha'].map(s => ({ s, n: attendance.filter(a => a.status === s).length })); $('#pageContent').innerHTML = heading('ANALISIS & ARSIP', 'Laporan sekolah', 'Ringkasan untuk evaluasi. Halaman ini hanya membaca data demo.') + `<div class="grid three-col" style="margin-bottom:18px">${stat('◷', Math.round(attendance.filter(a => a.status === 'Hadir').length / Math.max(attendance.length, 1) * 100) + '%', 'Kehadiran demo', 'Rekap saat ini')}${stat('▤', tasks.length, 'Tugas tercatat', 'Semua kategori')}${stat('✳', topics.length, 'Topik komunitas', 'Anonim')}</div><div class="grid two-col"><section class="card"><div class="card-title"><h3>Rekap kehadiran</h3><small>DATA DEMO</small></div>${counts.map(c => `<div style="margin:16px 0"><div style="display:flex;justify-content:space-between;font-size:11px"><span>${c.s}</span><b>${c.n} siswa</b></div><div class="report-bar"><span style="width:${c.n / Math.max(attendance.length, 1) * 100}%;background:${c.s === 'Alpha' ? '#d95c58' : c.s === 'Sakit' ? '#ffb66b' : '#1d7959'}"></span></div></div>`).join('')}</section><section class="card"><div class="card-title"><h3>Status tugas</h3><small>DATA DEMO</small></div>${[['Selesai', done], ['Belum', not], ['Terlambat', late]].map(([s, n]) => `<div style="display:flex;justify-content:space-between;padding:15px 0;border-bottom:1px solid var(--line);font-size:12px"><span>${s}</span><b>${n} tugas</b></div>`).join('')}<p class="muted" style="margin-top:15px">Ringkasan ini bukan data akademik resmi.</p></section></div><div class="card" style="margin-top:18px"><div class="card-title"><h3>Ekspor ringkasan</h3><small>PRATINJAU & UNDUH</small></div><p class="muted">Unduh data ringkasan demo sebagai CSV yang bisa dibuka di Excel.</p><button class="btn btn-primary" id="exportReport">↓ Unduh laporan CSV</button></div>`;
    $('#exportReport').onclick = () => { let rows = [['Jenis', 'Kategori', 'Jumlah'], ...counts.map(c => ['Kehadiran', c.s, c.n]), ['Tugas', 'Selesai', done], ['Tugas', 'Belum', not], ['Tugas', 'Terlambat', late], ['Komunitas', 'Topik', topics.length]]; let csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n'); let url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })); let a = document.createElement('a'); a.href = url; a.download = 'laporan-sekolahhub.csv'; a.click(); URL.revokeObjectURL(url); toast('Laporan CSV berhasil dibuat.') }
}

function updateNotificationBadge() { let unread = notifications.filter(n => !n.read).length; $('#notificationBtn').classList.toggle('has-unread', unread > 0); $('#notificationBtn').setAttribute('aria-label', unread ? `${unread} notifikasi belum dibaca` : 'Buka notifikasi') }
function addAdminShortcuts() { let shortcuts = [['akun', 'Pengelolaan akun', 'Aktivasi akun dan impor data'], ['kalender', 'Kalender sekolah', 'Atur hari efektif dan agenda'], ['aturan', 'Aturan kehadiran', 'Jam, radius GPS, dan batas alpha'], ['pengingat', 'Pengingat kehadiran', 'Warga yang belum absen'], ['identitas', 'Permintaan buka identitas', 'Tinjau permintaan dan riwayat']]; $('#pageContent').insertAdjacentHTML('beforeend', `<section class="admin-shortcuts"><div class="section-heading"><div><span class="eyebrow">PENGELOLAAN SEKOLAH</span><h2>Menu admin</h2></div></div><div class="shortcut-grid">${shortcuts.map(([id, title, desc]) => `<button class="shortcut-link" data-admin-page="${id}"><span><b>${title}</b><small>${desc}</small></span><strong>↗</strong></button>`).join('')}</div></section>`); $$('[data-admin-page]').forEach(button => button.onclick = () => goPage(button.dataset.adminPage)) }
function renderNotifications() { let unread = notifications.filter(n => !n.read).length; $('#pageContent').innerHTML = heading('PEMBARUAN', 'Notifikasi', `${unread} belum dibaca.`, '<button class="btn btn-outline" id="readAllNotifications">Tandai semua dibaca</button>') + `<section class="notification-list">${[...notifications].sort((a, b) => b.time - a.time).map(n => `<article class="notification-item ${n.read ? '' : 'unread'}"><span class="notification-mark">✳</span><div><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${ago(n.time)}</small></div>${n.read ? '' : '<span class="unread-dot"></span>'}</article>`).join('') || '<div class="empty-state">Belum ada notifikasi.</div>'}</section>`; $('#readAllNotifications').onclick = () => { notifications = notifications.map(n => ({ ...n, read: true })); localStorage.setItem('sh_notifications', JSON.stringify(notifications)); renderNotifications(); updateNotificationBadge() } }
function distanceMeters(a, b, c, d) { let rad = value => value * Math.PI / 180, lat1 = rad(a), lat2 = rad(c), deltaLat = rad(c - a), deltaLon = rad(d - b), h = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) }
function renderUserAttendance() {
    let history = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); $('#pageContent').innerHTML = heading('KEHADIRAN HARI INI', 'Absen wajah', 'Gunakan perangkat Anda untuk membuka kamera dan memeriksa lokasi sekolah.') + `<div class="attendance-layout"><section class="card attendance-camera-card"><div class="card-title"><h3>Verifikasi kehadiran</h3><span class="demo-chip">MODE DEMO</span></div><div class="camera-frame"><video id="attendanceVideo" autoplay muted playsinline></video><div class="face-guide"><span></span></div><div id="cameraHint" class="camera-hint">Kamera belum diaktifkan</div></div><div class="camera-actions"><button class="btn btn-outline" id="startCamera">Aktifkan kamera</button><button class="btn btn-outline" id="checkLocation">Periksa lokasi</button><button class="btn btn-primary" id="demoAttendance">Catat simulasi absen</button></div><div class="location-status" id="locationStatus"><span class="status-dot"></span><span>Lokasi belum diperiksa</span></div><p class="hint">Simulasi hanya menyimpan status contoh di browser ini. Sistem ini belum mengenali wajah, menyimpan descriptor, atau memverifikasi ke server.</p></section><aside class="grid attendance-aside"><section class="card"><div class="card-title"><h3>Ketentuan sekolah</h3><small>HARI INI</small></div><div class="setting-row"><span>Jam absen</span><b>${schoolSettings.open}–10:00 WIB</b></div><div class="setting-row"><span>Batas terlambat</span><b>${schoolSettings.late} WIB</b></div><div class="setting-row"><span>Radius lokasi</span><b>${schoolSettings.radius} meter</b></div><div class="side-note"><h4>Privasi wajah</h4><p>Kamera hanya ditampilkan saat halaman ini dibuka. Video tidak disimpan oleh prototype.</p></div></section><section class="card"><div class="card-title"><h3>Riwayat absen</h3><small>${history.length} CATATAN DEMO</small></div>${history.slice(0, 5).map(item => `<div class="history-row"><span class="history-check">✓</span><span><b>${esc(item.status)}</b><small>${esc(item.date)} · ${esc(item.time)}</small></span><span class="demo-chip">DEMO</span></div>`).join('') || '<div class="empty-state" style="padding:15px 0">Belum ada catatan kehadiran.</div>'}</section></aside></div>`;
    $('#startCamera').onclick = async () => { try { cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); $('#attendanceVideo').srcObject = cameraStream; $('#cameraHint').classList.add('hidden'); toast('Kamera aktif. Video tidak direkam.') } catch (error) { toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan melalui pengaturan browser.' : 'Kamera tidak tersedia pada perangkat ini.') } };
    $('#checkLocation').onclick = () => { if (!navigator.geolocation) return toast('Browser ini tidak mendukung lokasi.'); $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa izin dan lokasi...</span>'; navigator.geolocation.getCurrentPosition(position => { currentPosition = position.coords; let distance = Math.round(distanceMeters(position.coords.latitude, position.coords.longitude, Number(schoolSettings.latitude), Number(schoolSettings.longitude))); let accuracy = Math.round(position.coords.accuracy); $('#locationStatus').innerHTML = `<span class="status-dot ${distance <= schoolSettings.radius && accuracy <= 50 ? 'good' : 'warning'}"></span><span>${distance <= schoolSettings.radius && accuracy <= 50 ? 'Dalam radius sekolah' : 'Di luar batas atau kurang akurat'} · ${distance} m dari titik sekolah · akurasi ${accuracy} m</span>` }, () => { $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Lokasi tidak dapat diakses. Periksa izin browser.</span>' }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) };
    $('#demoAttendance').onclick = () => { let records = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'), today = new Date(), date = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); if (records.some(item => item.date === date)) return toast('Simulasi absen hari ini sudah tercatat.'); let time = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), [lateHour, lateMinute] = schoolSettings.late.split(':').map(Number), late = today.getHours() * 60 + today.getMinutes() > lateHour * 60 + lateMinute; records.unshift({ date, time, status: late ? 'Terlambat' : 'Hadir' }); localStorage.setItem('sh_my_attendance', JSON.stringify(records)); notifications.unshift({ id: Date.now(), title: 'Simulasi kehadiran tercatat', message: `Status demo ${late ? 'terlambat' : 'hadir'} pada pukul ${time}.`, time: Date.now(), read: false }); localStorage.setItem('sh_notifications', JSON.stringify(notifications)); renderUserAttendance(); updateNotificationBadge(); toast('Catatan simulasi tersimpan di browser.') };
}
let attendancePhotoUrls = [];
function openAttendancePhotoDb() { return new Promise((resolve, reject) => { let request = indexedDB.open('edusmart-attendance-photos', 1); request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function saveAttendancePhoto(id, blob) { let db = await openAttendancePhotoDb(); await new Promise((resolve, reject) => { let transaction = db.transaction('photos', 'readwrite'); transaction.objectStore('photos').put({ id, blob }); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error) }); db.close() }
async function removeAttendancePhoto(id) { let db = await openAttendancePhotoDb(); await new Promise((resolve, reject) => { let transaction = db.transaction('photos', 'readwrite'); transaction.objectStore('photos').delete(id); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error) }); db.close() }
async function loadAttendancePhoto(id) { let db = await openAttendancePhotoDb(); let photo = await new Promise((resolve, reject) => { let transaction = db.transaction('photos', 'readonly'), request = transaction.objectStore('photos').get(id); request.onsuccess = () => resolve(request.result?.blob || null); request.onerror = () => reject(request.error) }); db.close(); return photo }
async function hydrateAttendancePhotos() { for (let image of document.querySelectorAll('[data-photo-id]')) { try { let photo = await loadAttendancePhoto(image.dataset.photoId); if (!photo) continue; let url = URL.createObjectURL(photo); attendancePhotoUrls.push(url); image.src = url; image.onclick = () => { let preview = $('#photoPreview'); preview.src = url; $('#photoDialog').showModal() } } catch (error) { toast('Foto tersimpan tidak dapat dibuka di browser ini.') } } }
renderUserAttendance = function () {
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null } attendancePhotoUrls.forEach(url => URL.revokeObjectURL(url)); attendancePhotoUrls = []; let history = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); $('#pageContent').innerHTML = heading('KEHADIRAN HARI INI', 'Foto kehadiran', 'Ambil foto diri untuk catatan kehadiran. Foto disimpan hanya di browser/perangkat ini.') + `<div class="attendance-layout"><section class="card attendance-camera-card"><div class="card-title"><h3>Ambil foto</h3><span class="demo-chip">MENUNGGU VERIFIKASI</span></div><div class="camera-frame"><video id="attendanceVideo" autoplay muted playsinline></video><div class="face-guide"><span></span></div><div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai</div></div><div class="camera-actions"><button class="btn btn-outline" id="startCamera">Aktifkan kamera</button><button class="btn btn-outline" id="checkLocation">Periksa lokasi</button><button class="btn btn-primary" id="captureAttendance" disabled>Ambil & simpan foto</button></div><label class="photo-consent"><input id="photoConsent" type="checkbox"><span>Saya setuju foto kehadiran ini disimpan di browser/perangkat ini.</span></label><div class="location-status" id="locationStatus"><span class="status-dot"></span><span>Lokasi opsional belum diperiksa</span></div><p class="hint">Foto tidak diunggah atau dibagikan ke sekolah. Simpanan ini bukan bukti absen resmi dan belum diverifikasi oleh admin/server.</p></section><aside class="grid attendance-aside"><section class="card"><div class="card-title"><h3>Ketentuan sekolah</h3><small>HARI INI</small></div><div class="setting-row"><span>Jam absen</span><b>${schoolSettings.open}–10:00 WIB</b></div><div class="setting-row"><span>Batas terlambat</span><b>${schoolSettings.late} WIB</b></div><div class="setting-row"><span>Radius lokasi</span><b>${schoolSettings.radius} meter</b></div><div class="side-note"><h4>Privasi foto</h4><p>Foto disimpan lokal menggunakan penyimpanan browser. Hapus data situs browser untuk menghapus seluruh foto.</p></div></section><section class="card"><div class="card-title"><h3>Riwayat foto</h3><small>${history.length} CATATAN</small></div>${history.slice(0, 8).map(item => `<div class="history-row"><span class="history-check">◷</span><span><b>${esc(item.status)}</b><small>${esc(item.date)} · ${esc(item.time)}</small></span>${item.photoId ? `<img class="attendance-thumb" data-photo-id="${esc(item.photoId)}" alt="Foto kehadiran ${esc(item.date)}">` : ''}</div>`).join('') || '<div class="empty-state" style="padding:15px 0">Belum ada foto kehadiran.</div>'}</section></aside></div><dialog id="photoDialog" class="photo-dialog"><button class="photo-close" id="closePhotoDialog" aria-label="Tutup foto">×</button><img id="photoPreview" alt="Foto kehadiran tersimpan"></dialog>`;
    let consent = $('#photoConsent'), capture = $('#captureAttendance'); consent.onchange = () => { capture.disabled = !consent.checked || !cameraStream }; $('#closePhotoDialog').onclick = () => $('#photoDialog').close();
    $('#startCamera').onclick = async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context'); cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); $('#attendanceVideo').srcObject = cameraStream; $('#cameraHint').classList.add('hidden'); capture.disabled = !consent.checked; toast('Kamera aktif. Foto hanya tersimpan di browser ini.') } catch (error) { toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan melalui pengaturan browser.' : 'Kamera memerlukan HTTPS atau localhost dan perangkat yang mendukung.') } };
    $('#checkLocation').onclick = () => { if (!navigator.geolocation) return toast('Browser ini tidak mendukung lokasi.'); $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa lokasi...</span>'; navigator.geolocation.getCurrentPosition(position => { currentPosition = position.coords; let distance = Math.round(distanceMeters(position.coords.latitude, position.coords.longitude, Number(schoolSettings.latitude), Number(schoolSettings.longitude))), accuracy = Math.round(position.coords.accuracy); $('#locationStatus').innerHTML = `<span class="status-dot ${distance <= schoolSettings.radius && accuracy <= 50 ? 'good' : 'warning'}"></span><span>${distance <= schoolSettings.radius && accuracy <= 50 ? 'Dalam radius sekolah' : 'Di luar batas atau kurang akurat'} · ${distance} m · akurasi ${accuracy} m</span>` }, () => { $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Lokasi tidak dapat diakses. Periksa izin browser.</span>' }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) };
    capture.onclick = async () => { if (!cameraStream) return toast('Aktifkan kamera sebelum mengambil foto.'); if (!consent.checked) return toast('Persetujuan penyimpanan foto diperlukan.'); let video = $('#attendanceVideo'); if (!video.videoWidth) return toast('Kamera belum siap. Coba lagi sebentar.'); let today = new Date(), dayKey = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), dayIso = today.toISOString().slice(0, 10), records = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); if (records.some(item => item.dayIso === dayIso && item.photoId)) return toast('Foto kehadiran hari ini sudah tersimpan.'); capture.disabled = true; try { let canvas = document.createElement('canvas'), width = Math.min(video.videoWidth, 1280); canvas.width = width; canvas.height = Math.round(width * video.videoHeight / video.videoWidth); canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82)); if (!blob) throw new Error('capture-failed'); let photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; await saveAttendancePhoto(photoId, blob); let time = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); records.unshift({ photoId, dayIso, date: dayKey, time, status: 'Menunggu verifikasi' }); localStorage.setItem('sh_my_attendance', JSON.stringify(records)); renderUserAttendance(); toast('Foto tersimpan di browser ini; status menunggu verifikasi.') } catch (error) { capture.disabled = false; toast('Foto gagal disimpan. Periksa ruang penyimpanan browser.') } }; hydrateAttendancePhotos()
}
function persistAdminData() { localStorage.setItem('sh_accounts', JSON.stringify(adminAccounts)); localStorage.setItem('sh_settings', JSON.stringify(schoolSettings)); localStorage.setItem('sh_unlocks', JSON.stringify(identityRequests)) }
function persistAdminData() { localStorage.setItem('sh_accounts', JSON.stringify(adminAccounts)); localStorage.setItem('sh_settings', JSON.stringify(schoolSettings)); localStorage.setItem('sh_unlocks', JSON.stringify(identityRequests)) }
renderUserAttendance = function () {
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null } attendancePhotoUrls.forEach(url => URL.revokeObjectURL(url)); attendancePhotoUrls = []; let history = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); $('#pageContent').innerHTML = heading('KEHADIRAN HARI INI', 'Foto kehadiran', 'Ambil foto diri untuk catatan kehadiran. Foto disimpan hanya di browser/perangkat ini.') + `<div class="attendance-layout"><section class="card attendance-camera-card"><div class="card-title"><h3>Ambil foto</h3><span class="demo-chip">MENUNGGU VERIFIKASI</span></div><div class="camera-frame"><video id="attendanceVideo" autoplay muted playsinline></video><div class="face-guide"><span></span></div><div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai</div></div><div class="camera-actions"><button class="btn btn-outline" id="startCamera">Aktifkan kamera</button><button class="btn btn-outline" id="checkLocation">Periksa lokasi</button><button class="btn btn-primary" id="captureAttendance" disabled>Ambil & simpan foto</button></div><label class="photo-consent"><input id="photoConsent" type="checkbox"><span>Saya setuju foto kehadiran ini disimpan di browser/perangkat ini.</span></label><div class="location-status" id="locationStatus"><span class="status-dot"></span><span>Lokasi opsional belum diperiksa</span></div><p class="hint">Foto tidak diunggah atau dibagikan ke sekolah. Simpanan ini bukan bukti absen resmi dan belum diverifikasi oleh admin/server.</p></section><aside class="grid attendance-aside"><section class="card"><div class="card-title"><h3>Ketentuan sekolah</h3><small>HARI INI</small></div><div class="setting-row"><span>Jam absen</span><b>${schoolSettings.open}–10:00 WIB</b></div><div class="setting-row"><span>Batas terlambat</span><b>${schoolSettings.late} WIB</b></div><div class="setting-row"><span>Radius lokasi</span><b>${schoolSettings.radius} meter</b></div><div class="side-note"><h4>Privasi foto</h4><p>Foto disimpan lokal menggunakan penyimpanan browser. Hapus foto dari riwayat kapan saja atau hapus data situs browser.</p></div></section><section class="card"><div class="card-title"><h3>Riwayat foto</h3><small>${history.length} CATATAN</small></div>${history.slice(0, 8).map(item => `<div class="history-row"><span class="history-check">◷</span><span><b>${esc(item.status)}</b><small>${esc(item.date)} · ${esc(item.time)}</small></span>${item.photoId ? `<img class="attendance-thumb" data-photo-id="${esc(item.photoId)}" alt="Foto kehadiran ${esc(item.date)}"><button class="photo-delete" data-photo-delete="${esc(item.photoId)}" aria-label="Hapus foto kehadiran ${esc(item.date)}" title="Hapus foto">×</button>` : ''}</div>`).join('') || '<div class="empty-state" style="padding:15px 0">Belum ada foto kehadiran.</div>'}</section></aside></div><dialog id="photoDialog" class="photo-dialog"><button class="photo-close" id="closePhotoDialog" aria-label="Tutup foto">×</button><img id="photoPreview" alt="Foto kehadiran tersimpan"></dialog>`;
    let consent = $('#photoConsent'), capture = $('#captureAttendance'); consent.onchange = () => { capture.disabled = !consent.checked || !cameraStream }; $('#closePhotoDialog').onclick = () => $('#photoDialog').close(); $$('[data-photo-delete]').forEach(button => button.onclick = async () => { let id = button.dataset.photoDelete; try { await removeAttendancePhoto(id); let saved = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); localStorage.setItem('sh_my_attendance', JSON.stringify(saved.filter(item => item.photoId !== id))); renderUserAttendance(); toast('Foto kehadiran dihapus dari browser.') } catch (error) { toast('Foto tidak dapat dihapus saat ini.') } });
    $('#startCamera').onclick = async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context'); cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); $('#attendanceVideo').srcObject = cameraStream; $('#cameraHint').classList.add('hidden'); capture.disabled = !consent.checked; toast('Kamera aktif. Foto hanya tersimpan di browser ini.') } catch (error) { toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan melalui pengaturan browser.' : 'Kamera memerlukan HTTPS atau localhost dan perangkat yang mendukung.') } };
    $('#checkLocation').onclick = () => { if (!navigator.geolocation) return toast('Browser ini tidak mendukung lokasi.'); $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa lokasi...</span>'; navigator.geolocation.getCurrentPosition(position => { currentPosition = position.coords; let distance = Math.round(distanceMeters(position.coords.latitude, position.coords.longitude, Number(schoolSettings.latitude), Number(schoolSettings.longitude))), accuracy = Math.round(position.coords.accuracy); $('#locationStatus').innerHTML = `<span class="status-dot ${distance <= schoolSettings.radius && accuracy <= 50 ? 'good' : 'warning'}"></span><span>${distance <= schoolSettings.radius && accuracy <= 50 ? 'Dalam radius sekolah' : 'Di luar batas atau kurang akurat'} · ${distance} m · akurasi ${accuracy} m</span>` }, () => { $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Lokasi tidak dapat diakses. Periksa izin browser.</span>' }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) };
    capture.onclick = async () => { if (!cameraStream) return toast('Aktifkan kamera sebelum mengambil foto.'); if (!consent.checked) return toast('Persetujuan penyimpanan foto diperlukan.'); let video = $('#attendanceVideo'); if (!video.videoWidth) return toast('Kamera belum siap. Coba lagi sebentar.'); let today = new Date(), dayKey = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), dayIso = today.toISOString().slice(0, 10), records = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); if (records.some(item => item.dayIso === dayIso && item.photoId)) return toast('Foto kehadiran hari ini sudah tersimpan.'); capture.disabled = true; try { let canvas = document.createElement('canvas'), width = Math.min(video.videoWidth, 1280); canvas.width = width; canvas.height = Math.round(width * video.videoHeight / video.videoWidth); canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82)); if (!blob) throw new Error('capture-failed'); let photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; await saveAttendancePhoto(photoId, blob); let time = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); records.unshift({ photoId, dayIso, date: dayKey, time, status: 'Menunggu verifikasi' }); localStorage.setItem('sh_my_attendance', JSON.stringify(records)); renderUserAttendance(); toast('Foto tersimpan di browser ini; status menunggu verifikasi.') } catch (error) { capture.disabled = false; toast('Foto gagal disimpan. Periksa ruang penyimpanan browser.') } }; hydrateAttendancePhotos()
}
function renderAdminAccounts() {
    let pending = adminAccounts.filter(a => a.status === 'Menunggu').length; $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', `${adminAccounts.length} akun · ${pending} menunggu verifikasi.`) + `<section class="card"><div class="card-title"><h3>Impor data warga</h3><small>CSV · MODE DEMO</small></div><p class="muted">Gunakan kolom nama,email,peran,nomor_induk,bidang. Validasi dan perubahan hanya berlaku di browser ini.</p><div class="import-row"><input id="accountCsv" class="field" type="file" accept=".csv,text/csv"><button class="btn btn-primary" id="importAccounts">Validasi & impor</button></div><div id="importResult" class="hint"></div></section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Daftar akun</h3><input id="accountSearch" class="field compact-input" placeholder="Cari nama atau nomor induk"></div><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Peran</th><th>Nomor induk</th><th>Kelas / bidang</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="accountRows">${renderAccountRows(adminAccounts)}</tbody></table></div></section>`;
    function bindAccountActions() { $$('[data-account-status]').forEach(btn => btn.onclick = () => { let account = adminAccounts[Number(btn.dataset.accountStatus)]; account.status = account.status === 'Aktif' ? 'Nonaktif' : 'Aktif'; persistAdminData(); renderAdminAccounts() }); $$('[data-account-reset]').forEach(btn => btn.onclick = () => { let temporary = `Edu${Math.random().toString(36).slice(2, 8)}!`; alert(`Kata sandi sementara demo (ditampilkan sekali): ${temporary}`); toast('Reset simulasi selesai.') }) }
    $('#accountSearch').oninput = () => { let q = $('#accountSearch').value.toLowerCase(), filtered = adminAccounts.filter(a => (a.name + ' ' + a.identity + ' ' + a.detail).toLowerCase().includes(q)); $('#accountRows').innerHTML = renderAccountRows(filtered); bindAccountActions() }; bindAccountActions();
    $('#importAccounts').onclick = async () => { let file = $('#accountCsv').files[0]; if (!file) return toast('Pilih file CSV terlebih dahulu.'); if (file.size > 2 * 1024 * 1024) return toast('Ukuran CSV maksimal 2 MB.'); let parsed = parseCsv(await file.text()), header = parsed.shift()?.map(value => value.trim().toLowerCase()) || [], required = ['nama', 'email', 'peran', 'nomor_induk', 'bidang']; if (!required.every(column => header.includes(column))) return $('#importResult').textContent = 'Format kolom tidak sesuai. Periksa nama,email,peran,nomor_induk,bidang.'; if (parsed.length > 1000) return $('#importResult').textContent = 'Maksimal 1.000 baris per impor.'; let added = 0, failed = 0; parsed.forEach(row => { let record = Object.fromEntries(header.map((key, index) => [key, (row[index] || '').trim()])); if (!record.nama || !record.email || !record.peran || !record.nomor_induk || !record.bidang || adminAccounts.some(a => a.email === record.email)) { failed++; return } adminAccounts.push({ name: record.nama, email: record.email, role: record.peran, identity: record.nomor_induk, detail: record.bidang, status: 'Aktif' }); added++ }); persistAdminData(); $('#importResult').textContent = `${added} akun berhasil ditambahkan · ${failed} baris ditolak.`; renderAdminAccounts(); toast('Impor demo selesai.') };
}
function renderAccountRows(accounts) { return accounts.map(account => { let index = adminAccounts.indexOf(account); return `<tr><td><b>${esc(account.name)}</b><small class="table-secondary">${esc(account.email || 'Akun demo')}</small></td><td>${esc(account.role)}</td><td>${esc(account.identity)}</td><td>${esc(account.detail)}</td><td><span class="status ${account.status === 'Aktif' ? 'status-selesai' : 'status-belum'}">${esc(account.status)}</span></td><td><button class="text-action" data-account-status="${index}">${account.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="text-action" data-account-reset="${index}">Reset sandi</button></td></tr>` }).join('') }
function parseCsv(text) { let rows = [], row = [], cell = '', quoted = false; for (let index = 0; index < text.length; index++) { let char = text[index]; if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index++ } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { row.push(cell); cell = '' } else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index++; row.push(cell); if (row.some(value => value.trim())) rows.push(row); row = []; cell = '' } else cell += char } if (cell || row.length) { row.push(cell); rows.push(row) } return rows }
function renderCalendar() {
    let events = JSON.parse(localStorage.getItem('sh_calendar') || 'null') || [{ title: 'Ujian Tengah Semester', start: '2026-11-02', end: '2026-11-07', type: 'Ujian' }, { title: 'Hari Guru Nasional', start: '2026-11-25', end: '2026-11-25', type: 'Efektif' }]; $('#pageContent').innerHTML = heading('AGENDA SEKOLAH', 'Kalender sekolah', 'Hari efektif, libur, dan agenda akademik.') + `<section class="card"><div class="card-title"><h3>Tambah agenda</h3><small>TERLIHAT OLEH WARGA SEKOLAH</small></div><form id="calendarForm" class="calendar-form"><input id="eventTitle" class="field" required maxlength="120" placeholder="Nama agenda"><select id="eventType" class="field"><option>Libur</option><option>Efektif</option><option>Ujian</option></select><input id="eventStart" class="field" type="date" required><input id="eventEnd" class="field" type="date" required><button class="btn btn-primary">Simpan agenda</button></form></section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Agenda mendatang</h3><small>${events.length} AGENDA</small></div><div class="table-wrap"><table><thead><tr><th>Agenda</th><th>Jenis</th><th>Mulai</th><th>Selesai</th><th></th></tr></thead><tbody>${events.sort((a, b) => a.start.localeCompare(b.start)).map((event, index) => `<tr><td><b>${esc(event.title)}</b></td><td>${esc(event.type)}</td><td>${prettyDate(event.start)}</td><td>${prettyDate(event.end)}</td><td><button class="text-action" data-event-delete="${index}">Hapus</button></td></tr>`).join('')}</tbody></table></div></section>`;
    $('#calendarForm').onsubmit = e => { e.preventDefault(); if ($('#eventEnd').value < $('#eventStart').value) return toast('Tanggal selesai harus setelah tanggal mulai.'); events.push({ title: $('#eventTitle').value.trim(), type: $('#eventType').value, start: $('#eventStart').value, end: $('#eventEnd').value }); localStorage.setItem('sh_calendar', JSON.stringify(events)); renderCalendar(); toast('Agenda sekolah ditambahkan.') }; $$('[data-event-delete]').forEach(btn => btn.onclick = () => { events.splice(Number(btn.dataset.eventDelete), 1); localStorage.setItem('sh_calendar', JSON.stringify(events)); renderCalendar() })
}
function renderAttendanceSettings() { $('#pageContent').innerHTML = heading('PENGATURAN SEKOLAH', 'Aturan kehadiran', 'Tetapkan jam absen dan titik acuan sekolah.') + `<form id="attendanceSettingsForm" class="card settings-form"><div class="settings-grid"><label>Koordinat lintang<input class="field" id="settingLatitude" type="number" step="0.000001" value="${esc(schoolSettings.latitude)}" required></label><label>Koordinat bujur<input class="field" id="settingLongitude" type="number" step="0.000001" value="${esc(schoolSettings.longitude)}" required></label><label>Radius absen (meter)<input class="field" id="settingRadius" type="number" min="30" max="500" value="${schoolSettings.radius}" required></label><label>Jam mulai<input class="field" id="settingOpen" type="time" value="${schoolSettings.open}" required></label><label>Batas terlambat<input class="field" id="settingLate" type="time" value="${schoolSettings.late}" required></label><label>Batas koreksi<input class="field" id="settingCutoff" type="time" value="${schoolSettings.cutoff}" required></label><label>Batas alpha per bulan<input class="field" id="settingAlpha" type="number" min="1" max="31" value="${schoolSettings.alpha}" required></label></div><div class="side-note"><h4>Lokasi demo</h4><p>Koordinat sekolah hanya digunakan untuk menghitung jarak di halaman demo. Nilai ini belum tersimpan di server.</p></div><button class="btn btn-primary" type="submit">Simpan pengaturan</button></form>`; $('#attendanceSettingsForm').onsubmit = e => { e.preventDefault(); schoolSettings = { latitude: $('#settingLatitude').value, longitude: $('#settingLongitude').value, radius: Number($('#settingRadius').value), open: $('#settingOpen').value, late: $('#settingLate').value, cutoff: $('#settingCutoff').value, alpha: Number($('#settingAlpha').value) }; persistAdminData(); toast('Aturan kehadiran tersimpan di browser.') } }
function renderReminders() { let missing = attendance.filter(item => !['Hadir', 'Terlambat', 'Izin', 'Sakit'].includes(item.status)); $('#pageContent').innerHTML = heading('TINDAK LANJUT', 'Pengingat kehadiran', 'Kirim pengingat aplikasi kepada warga yang belum mengisi kehadiran.') + `<section class="card"><div class="card-title"><h3>Belum mengisi kehadiran</h3><span class="status status-belum">${missing.length} warga</span></div><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead><tbody>${missing.map(item => `<tr><td><b>${esc(item.name)}</b></td><td>${esc(item.kelas)}</td><td>Belum absen</td></tr>`).join('') || '<tr><td colspan="3">Semua warga sudah mengisi kehadiran.</td></tr>'}</tbody></table></div><button class="btn btn-primary" id="sendReminders" style="margin-top:18px" ${missing.length ? '' : 'disabled'}>Kirim pengingat aplikasi</button><p class="hint">Pengiriman demo hanya membuat notifikasi lokal, tidak mengirim email atau WhatsApp.</p></section>`; $('#sendReminders').onclick = () => { missing.forEach(item => notifications.unshift({ id: Date.now() + Math.random(), title: 'Pengingat kehadiran', message: `Silakan isi kehadiran hari ini, ${item.name}.`, time: Date.now(), read: false })); localStorage.setItem('sh_notifications', JSON.stringify(notifications)); updateNotificationBadge(); toast(`Pengingat demo dibuat untuk ${missing.length} warga.`) } }
function renderIdentityRequests() {
    let waiting = identityRequests.filter(item => item.status === 'Menunggu'), history = identityRequests.filter(item => item.status !== 'Menunggu'); $('#pageContent').innerHTML = heading('PRIVASI & KEAMANAN', 'Permintaan buka identitas', 'Setiap persetujuan pada versi produksi harus dilakukan admin lain dan tercatat dalam audit log.') + `<section class="card"><div class="card-title"><h3>Ajukan permintaan</h3><small>ALASAN MIN. 20 KARAKTER</small></div><form id="unlockRequestForm" class="unlock-form"><select id="unlockPost" class="field">${topics.map(topic => `<option value="${topic.id}">${esc(topic.title)}</option>`).join('')}</select><textarea id="unlockReason" class="field" required minlength="20" maxlength="500" rows="3" placeholder="Jelaskan alasan kebutuhan peninjauan..."></textarea><button class="btn btn-primary">Ajukan untuk ditinjau</button></form></section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Menunggu keputusan</h3><small>${waiting.length} PERMINTAAN</small></div>${waiting.map(request => `<article class="unlock-item"><div><b>${esc(request.post)}</b><p>${esc(request.reason)}</p><small>Diajukan ${ago(request.date)}</small></div><div><button class="btn btn-outline" data-unlock-decision="${request.id}" data-decision="Ditolak">Tolak</button><button class="btn btn-primary" data-unlock-decision="${request.id}" data-decision="Disetujui">Setujui</button></div></article>`).join('') || '<div class="empty-state">Tidak ada permintaan yang menunggu.</div>'}</section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Riwayat keputusan</h3><small>${history.length} KEPUTUSAN</small></div>${history.map(request => `<div class="history-row"><span class="history-check">${request.status === 'Disetujui' ? '✓' : '×'}</span><span><b>${esc(request.post)}</b><small>${esc(request.status)} · ${ago(request.date)}</small></span></div>`).join('') || '<div class="empty-state">Riwayat masih kosong.</div>'}</section>`;
    $('#unlockRequestForm').onsubmit = e => { e.preventDefault(); let reason = $('#unlockReason').value.trim(); if (reason.length < 20) return toast('Alasan harus minimal 20 karakter.'); let topic = topics.find(item => item.id === $('#unlockPost').value); identityRequests.unshift({ id: Date.now(), post: topic?.title || 'Topik sekolah', reason, status: 'Menunggu', date: Date.now() }); persistAdminData(); renderIdentityRequests(); toast('Permintaan dicatat untuk peninjauan admin lain.') }; $$('[data-unlock-decision]').forEach(btn => btn.onclick = () => { let request = identityRequests.find(item => item.id == btn.dataset.unlockDecision); request.status = btn.dataset.decision; request.date = Date.now(); persistAdminData(); renderIdentityRequests(); toast(`Permintaan ${request.status.toLowerCase()}. Akses demo berlaku 24 jam.`) })
}
