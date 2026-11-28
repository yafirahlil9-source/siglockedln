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
let currentUser = null, currentPage = 'beranda', taskFilter = 'Semua', taskCategory = 'Semua', searchRole = 'Semua', searchQuery = '', tasks = [], topics = [];
let bioText = '', showAverage = true, showRank = true, cameraStream = null, currentPosition = null;
let notifications = [], adminAccounts = [];
let optimisticReadNotifIds = new Set(), markAllReadPending = false;
let availableSubjects = [], teacherSubjects = [], teacherClasses = [], teacherMaterials = [], allMaterials = [];
let schoolSettings = { latitude: '-7.164041847763249', longitude: '112.64734569558635', radius: 100, open: '06:30', late: '07:15', cutoff: '23:59', alpha: 3 };
let identityRequests = [];
function svgIcon(name, size = 18) {
    const paths = {
        home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        scanFace: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.8-1.8 2.3-2.5 4-2.5s3.2.7 4 2.5"/>',
        tasks: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
        user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        classes: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
        reports: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
        eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
        sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>'
    };
    return `<svg class="sg-svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.sparkles}</svg>`;
}
window.svgIcon = svgIcon;
const userNav = [['beranda', svgIcon('home', 18), 'Beranda'], ['cari', svgIcon('search', 18), 'Cari'], ['absen', svgIcon('scanFace', 18), 'Absen'], ['pembelajaran', svgIcon('tasks', 18), 'Materi & Tugas'], ['profil', svgIcon('user', 18), 'Profil']];
const adminNav = [['beranda', svgIcon('home', 18), 'Beranda'], ['cari', svgIcon('search', 18), 'Cari'], ['kehadiran', svgIcon('scanFace', 18), 'Kehadiran'], ['akademik', svgIcon('classes', 18), 'Mata pelajaran'], ['pembelajaran', svgIcon('tasks', 18), 'Materi & Tugas'], ['kelas', svgIcon('classes', 18), 'Kelas'], ['laporan', svgIcon('reports', 18), 'Laporan'], ['profil', svgIcon('user', 18), 'Profil']];
function persist() { localStorage.setItem('sh_topics', JSON.stringify(topics)); localStorage.setItem('sh_tasks', JSON.stringify(tasks)) }
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
function bindPasswordToggle(btnSelector, inputSelector) {
    const btn = $(btnSelector);
    const input = $(inputSelector);
    if (!btn || !input) return;
    btn.onclick = () => {
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = svgIcon(show ? 'eyeOff' : 'eye', 18);
        btn.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        btn.classList.remove('pop');
        void btn.offsetWidth;
        btn.classList.add('pop');
        setTimeout(() => btn.classList.remove('pop'), 180);
    };
}
bindPasswordToggle('#togglePass', '#password');
bindPasswordToggle('#toggleRegPass', '#registerPassword');
const serverAttendanceRenderer = renderUserAttendance;
renderUserAttendance = serverAttendanceRenderer;

let isRegisterMode = false;
async function populateRegisterClasses() {
    try {
        let res = await api('/api/classes');
        let classes = res.classes || [];
        let select = $('#registerDetail');
        if (select) {
            select.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
                classes.map(c => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
        }
    } catch (e) {
        let select = $('#registerDetail');
        if (select) {
            select.innerHTML = '<option value="">-- Pilih Kelas --</option>' +
                ['X RPL 1', 'X RPL 2', 'XI RPL 1', 'XI RPL 2', 'XII RPL 1', 'XII RPL 2'].map(c => `<option value="${c}">${c}</option>`).join('');
        }
    }
}
populateRegisterClasses();

function subjectOptions(selected = '') {
    if (!availableSubjects.length) return '<option value="">Belum ada mata pelajaran</option>';
    return '<option value="">-- Pilih Mata Pelajaran --</option>' + availableSubjects.map(subject =>
        `<option value="${subject.id}" ${String(subject.id) === String(selected) ? 'selected' : ''}>${esc(subject.name)}</option>`
    ).join('');
}

function closeRegisterSubjectMenus() {
    $$('.register-subject-picker').forEach(picker => {
        picker.querySelector('.register-subject-menu')?.classList.add('hidden');
        picker.querySelector('.register-subject-toggle')?.setAttribute('aria-expanded', 'false');
    });
}

function refreshRegisterSubjectSelections() {
    const selects = $$('.register-subject-select');
    const selected = selects.map(select => select.value).filter(Boolean);
    selects.forEach(select => {
        [...select.options].forEach(option => {
            option.disabled = Boolean(option.value && selected.includes(option.value) && option.value !== select.value);
        });
        const picker = select.closest('.register-subject-picker');
        if (!picker) return;
        const current = select.selectedOptions[0];
        picker.querySelector('.register-subject-current').textContent = select.value ? current.textContent : '-- Pilih Mata Pelajaran --';
        picker.querySelector('.register-subject-toggle').classList.toggle('has-value', Boolean(select.value));
        picker.querySelectorAll('.register-subject-option').forEach(option => {
            const id = option.dataset.subjectId;
            const isCurrent = id === select.value;
            const isTaken = selected.includes(id) && !isCurrent;
            option.disabled = isTaken;
            option.classList.toggle('is-selected', isCurrent);
            option.setAttribute('aria-selected', String(isCurrent));
            option.querySelector('.register-subject-plus').textContent = isCurrent ? '✓' : '+';
        });
    });
}

function addRegisterSubjectRow(selected = '') {
    const container = $('#registerSubjectRows');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'register-subject-row';
    row.innerHTML = `<div class="register-subject-picker">
        <button type="button" class="field register-subject-toggle" aria-haspopup="listbox" aria-expanded="false">
            <span class="register-subject-current">-- Pilih Mata Pelajaran --</span><span class="register-subject-chevron">⌄</span>
        </button>
        <div class="register-subject-menu hidden" role="listbox" aria-label="Pilih mata pelajaran">
            ${availableSubjects.map(subject => `<button type="button" class="register-subject-option" data-subject-id="${subject.id}" role="option" aria-selected="false"><span>${esc(subject.name)}</span><span class="register-subject-plus">+</span></button>`).join('') || '<span class="register-subject-empty">Belum ada mata pelajaran</span>'}
        </div>
        <select class="register-subject-select" hidden>${subjectOptions(selected)}</select>
    </div><button type="button" class="icon-btn remove-register-subject" aria-label="Hapus pilihan mata pelajaran">×</button>`;
    row.querySelector('.remove-register-subject').onclick = event => {
        event.preventDefault();
        if (container.querySelectorAll('.register-subject-row').length <= 1) return toast('Minimal satu mata pelajaran harus dipilih.');
        row.remove();
        refreshRegisterSubjectSelections();
    };
    const select = row.querySelector('select');
    const toggle = row.querySelector('.register-subject-toggle');
    const menu = row.querySelector('.register-subject-menu');
    select.dataset.selectedValue = selected || '';
    toggle.onclick = event => {
        event.preventDefault();
        const opening = menu.classList.contains('hidden');
        closeRegisterSubjectMenus();
        menu.classList.toggle('hidden', !opening);
        toggle.setAttribute('aria-expanded', String(opening));
    };
    row.querySelectorAll('.register-subject-option').forEach(option => option.onclick = event => {
        event.preventDefault();
        if (option.disabled) return;
        const wasEmpty = !select.value;
        select.value = option.dataset.subjectId;
        select.dataset.selectedValue = select.value;
        refreshRegisterSubjectSelections();
        closeRegisterSubjectMenus();
        if (wasEmpty) {
            addRegisterSubjectRow();
            const rows = container.querySelectorAll('.register-subject-row');
            rows[rows.length - 1].querySelector('.register-subject-toggle').focus();
        }
    });
    container.appendChild(row);
    refreshRegisterSubjectSelections();
}

document.addEventListener('click', event => {
    if (!event.target.closest('.register-subject-picker')) closeRegisterSubjectMenus();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeRegisterSubjectMenus();
});

async function populateRegisterSubjects() {
    try {
        const result = await api('/api/subjects');
        availableSubjects = result.subjects || [];
    } catch (_) {
        availableSubjects = [];
    }
    const container = $('#registerSubjectRows');
    if (!container) return;
    const selections = [...container.querySelectorAll('.register-subject-select')].map(select => select.value);
    container.replaceChildren();
    if (!selections.length) addRegisterSubjectRow();
    else selections.forEach(value => addRegisterSubjectRow(value));
}

function selectedRegisterSubjectIds() {
    return $$('.register-subject-select').map(select => Number(select.value)).filter(id => Number.isInteger(id) && id > 0);
}

populateRegisterSubjects();

function updateRegisterRoleUI() {
    let role = $('#registerRole') ? $('#registerRole').value : 'SISWA';
    let classGroup = $('#registerClassGroup');
    let classSelect = $('#registerDetail');
    let subjectsGroup = $('#registerSubjectsGroup');
    if (classGroup && classSelect) {
        if (role === 'SISWA') {
            classGroup.classList.remove('hidden');
            classSelect.required = true;
        } else {
            classGroup.classList.add('hidden');
            classSelect.required = false;
            classSelect.value = '';
        }
    }
    if (subjectsGroup) {
        const isTeacher = role === 'GURU';
        subjectsGroup.classList.toggle('hidden', !isTeacher);
        if (isTeacher && !$('#registerSubjectRows').children.length) addRegisterSubjectRow();
    }
}
if ($('#registerRole')) $('#registerRole').onchange = updateRegisterRoleUI;

function setAuthMode(register) {
    isRegisterMode = register;
    $('#loginView').classList.toggle('is-register', register);
    if ($('#googleLogin')) $('#googleLogin').classList.toggle('hidden', register || !googleLoginEnabled);
    if ($('#googleRegister')) $('#googleRegister').classList.toggle('hidden', !register || !googleLoginEnabled);
    $('#loginError').classList.add('hidden');
    $('#registerError').classList.add('hidden');
    if (register) {
        updateRegisterRoleUI();
        populateRegisterClasses();
        populateRegisterSubjects();
    }
}
if ($('#overlayRegisterBtn')) $('#overlayRegisterBtn').onclick = () => setAuthMode(true);
if ($('#overlayLoginBtn')) $('#overlayLoginBtn').onclick = () => setAuthMode(false);
if ($('#mobileToRegister')) $('#mobileToRegister').onclick = () => setAuthMode(true);
if ($('#mobileToLogin')) $('#mobileToLogin').onclick = () => setAuthMode(false);

$('#loginForm').onsubmit = async e => {
    e.preventDefault();
    $('#loginError').classList.add('hidden');
    try {
        let result = await api('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: $('#username').value.trim(), password: $('#password').value })
        });
        enterApp(result.user);
    } catch (error) {
        $('#loginError').textContent = error.message;
        $('#loginError').classList.remove('hidden');
    }
};

$('#registerForm').onsubmit = async e => {
    e.preventDefault();
    $('#registerError').classList.add('hidden');
    let role = $('#registerRole').value;
    let detail = role === 'SISWA' ? ($('#registerDetail') ? $('#registerDetail').value.trim() : '') : '';
    let subjectIds = role === 'GURU' ? selectedRegisterSubjectIds() : [];
    if (role === 'SISWA' && !detail) {
        $('#registerError').textContent = 'Harap pilih kelas Anda terlebih dahulu.';
        $('#registerError').classList.remove('hidden');
        return;
    }
    if (role === 'GURU' && !subjectIds.length) {
        $('#registerError').textContent = 'Harap pilih minimal satu mata pelajaran.';
        $('#registerError').classList.remove('hidden');
        return;
    }
    let data = {
        name: $('#registerName').value.trim(),
        email: $('#registerEmail').value.trim(),
        password: $('#registerPassword').value,
        role: role,
        identityNumber: $('#registerIdentity').value.trim(),
        detail: detail,
        subjectIds
    };
    try {
        let result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
        $('#registerPassword').value = '';
        if (result.autoActivated) {
            let session = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: data.email, password: data.password }) });
            enterApp(session.user);
            toast('Akun langsung aktif. Selamat datang di Siglockedin.');
        } else {
            setAuthMode(false);
            $('#loginError').textContent = result.message || 'Pendaftaran berhasil. Silakan masuk.';
            $('#loginError').classList.remove('hidden');
        }
    } catch (error) {
        $('#registerError').textContent = error.message;
        $('#registerError').classList.remove('hidden');
    }
};

$('#googleLogin').onclick = () => { window.location.assign('/auth/google') };
$('#googleRegister').onclick = async () => {
    let role = $('#registerRole').value;
    let detail = role === 'SISWA' ? ($('#registerDetail') ? $('#registerDetail').value.trim() : '') : '';
    let subjectIds = role === 'GURU' ? selectedRegisterSubjectIds() : [];
    if (role === 'SISWA' && !detail) {
        $('#registerError').textContent = 'Harap pilih kelas Anda terlebih dahulu.';
        $('#registerError').classList.remove('hidden');
        return;
    }
    if (role === 'GURU' && !subjectIds.length) {
        $('#registerError').textContent = 'Harap pilih minimal satu mata pelajaran.';
        $('#registerError').classList.remove('hidden');
        return;
    }
    let data = {
        name: $('#registerName').value.trim(),
        email: $('#registerEmail').value.trim(),
        role: role,
        identityNumber: $('#registerIdentity').value.trim(),
        detail: detail,
        subjectIds
    };
    try {
        let result = await api('/api/auth/google-intent', { method: 'POST', body: JSON.stringify(data) });
        window.location.assign(result.url);
    } catch (error) {
        $('#registerError').textContent = error.message;
        $('#registerError').classList.remove('hidden');
    }
};

if (new URLSearchParams(location.search).get('auth') === 'pending') {
    $('#loginError').textContent = 'Pendaftaran Google berhasil. Akun menunggu aktivasi admin.';
    $('#loginError').classList.remove('hidden');
} else if (new URLSearchParams(location.search).has('auth')) {
    $('#loginError').textContent = 'Login Google tidak berhasil. Coba kembali atau gunakan email dan kata sandi.';
    $('#loginError').classList.remove('hidden');
}

api('/api/auth/session').then(result => {
    googleLoginEnabled = result.googleLoginEnabled;
    $('#googleLogin').classList.toggle('hidden', !googleLoginEnabled);
    $('#googleRegister').classList.toggle('hidden', !googleLoginEnabled);
    if (result.user) enterApp(result.user);
}).catch(() => {
    $('#loginError').textContent = 'Server belum siap. Coba muat ulang halaman.';
    $('#loginError').classList.remove('hidden');
});
let googleLoginEnabled = false;

function enterApp(user) {
    currentUser = user;
    $('#loginView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    setupApp();
}

async function setupApp() {
    let role = currentUser.role;
    $('#topUser').textContent = currentUser.name;
    $('#topRole').textContent = role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : role === 'staf' ? 'Staf' : 'Admin sekolah';
    $('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    renderNav();
    goPage('beranda');
    updateNotificationBadge();
    try {
        let [postData, taskData, settingsData, classesData] = await Promise.all([
            api('/api/posts'),
            api('/api/assignments'),
            api('/api/attendance/settings'),
            api('/api/classes').catch(() => ({ classes: [] }))
        ]);
        topics = postData.posts.map(post => ({
            ...post,
            time: new Date(post.createdAt).getTime(),
            owner: (post.isOwner || (currentUser && currentUser.role === 'admin')) ? 'demo' : 'other',
            canDelete: Boolean(post.canDelete || post.isOwner || (currentUser && currentUser.role === 'admin'))
        }));
        if (classesData.classes) {
            window.availableClasses = ['Semua Kelas', ...classesData.classes.map(c => c.name)];
        } else if (taskData.availableClasses) {
            window.availableClasses = taskData.availableClasses;
        }
        tasks = (taskData.assignments || []).map(mapAssignment);
        schoolSettings = {
            ...schoolSettings,
            latitude: String(settingsData.settings.latitude),
            longitude: String(settingsData.settings.longitude),
            radius: settingsData.settings.radiusMeters,
            open: settingsData.settings.openTime,
            late: settingsData.settings.lateAfter,
            cutoff: settingsData.settings.closeTime,
            close: settingsData.settings.closeTime
        };
        if (currentPage === 'beranda') renderHome();
    } catch (error) {
        toast('Sebagian data belum dapat dimuat dari server.');
    }
}

function renderNav() {
    let items = currentUser.role === 'admin' ? adminNav : userNav;
    $('#sideNav').innerHTML = items.map(([id, icon, label]) => `<a href="#" class="nav-link ${currentPage === id ? 'active' : ''}" data-page="${id}" aria-label="${label}" title="${label}"><span class="nav-icon">${icon}</span><span>${label}</span></a>`).join('');
    $$('[data-page]').forEach(a => a.onclick = e => { e.preventDefault(); goPage(a.dataset.page) });
}

(function initSidebarToggle() {
    const appEl = $('#appView');
    const toggleBtn = $('#sidebarToggleBtn');
    if (!appEl || !toggleBtn) return;
    const saved = localStorage.getItem('sh_sidebar_collapsed') === '1';
    appEl.classList.toggle('sidebar-collapsed', saved);
    toggleBtn.onclick = () => {
        const next = !appEl.classList.contains('sidebar-collapsed');
        appEl.classList.toggle('sidebar-collapsed', next);
        localStorage.setItem('sh_sidebar_collapsed', next ? '1' : '0');
    };
})();

function goPage(page, options = {}) {
    if (currentPage === 'absen' && page !== 'absen' && cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (page === 'materi' || page === 'tugas') {
        options = { ...options, section: page };
        page = 'pembelajaran';
    }
    let adminOnly = ['kehadiran', 'laporan', 'akun', 'kalender', 'aturan', 'pengingat', 'identitas', 'kelas', 'akademik'];
    if (adminOnly.includes(page) && currentUser.role !== 'admin') {
        page = 'beranda';
        toast('Halaman ini hanya tersedia untuk admin sekolah.');
    }
    if (page === 'absen' && currentUser.role === 'admin') page = 'kehadiran';
    currentPage = page;
    let titles = {
        beranda: 'Beranda',
        cari: 'Cari warga sekolah',
        pembelajaran: 'Materi & Tugas',
        profil: 'Profil',
        absen: 'Absen wajah',
        kehadiran: 'Kehadiran',
        akademik: 'Mata pelajaran',
        kelas: 'Pengelolaan data kelas',
        laporan: 'Laporan',
        notifikasi: 'Notifikasi',
        akun: 'Pengelolaan akun',
        kalender: 'Kalender sekolah',
        aturan: 'Aturan kehadiran',
        pengingat: 'Pengingat kehadiran',
        identitas: 'Buka identitas'
    };
    $('#pageName').textContent = titles[page] || 'Beranda';
    renderNav();
    let f = {
        beranda: renderHome,
        cari: renderSearch,
        pembelajaran: () => renderLearning(options),
        profil: renderProfile,
        absen: renderAttendance,
        kehadiran: renderAttendance,
        akademik: renderAcademicAdmin,
        kelas: renderAdminClasses,
        laporan: renderReports,
        notifikasi: renderNotifications,
        akun: renderAdminAccounts,
        kalender: renderCalendar,
        aturan: renderAttendanceSettings,
        pengingat: renderReminders,
        identitas: renderIdentityRequests
    };
    if (!f[page]) {
        currentPage = 'beranda';
        renderNav();
        renderHome();
    } else {
        f[page]();
        if (page === 'profil' && currentUser.role === 'admin') addAdminShortcuts();
    }
}
async function logout() {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {});
    currentUser = null;
    currentPage = 'beranda';
    tasks = [];
    topics = [];
    notifications = [];
    optimisticReadNotifIds.clear();
    markAllReadPending = false;
    adminAccounts = [];
    availableSubjects = [];
    teacherSubjects = [];
    teacherClasses = [];
    teacherMaterials = [];
    allMaterials = [];
    identityRequests = [];
    bioText = '';
    showAverage = true;
    showRank = true;
    if (window._notifPollTimer) clearInterval(window._notifPollTimer);
    window._notifPollTimer = null;
    ['sh_topics', 'sh_tasks', 'sh_att', 'sh_notifications', 'sh_accounts', 'sh_settings', 'sh_unlocks', 'sh_bio', 'sh_my_attendance'].forEach(key => localStorage.removeItem(key));
    $$('dialog[open]').forEach(dialog => dialog.close());
    $('#pageContent').innerHTML = '';
    $('#appView').classList.add('hidden');
    $('#loginView').classList.remove('hidden');
    $('#password').value = '';
    $('#username').value = '';
    $('#registerForm')?.reset();
    if ($('#registerRole')) $('#registerRole').value = 'SISWA';
    updateRegisterRoleUI();
    populateRegisterSubjects();
    setAuthMode(false);
    updateNotificationBadge();
    toast('Anda telah keluar dari akun.');
}
$('#logoutBtn').onclick = logout;
if ($('#mobileLogoutBtn')) $('#mobileLogoutBtn').onclick = () => logout();
$('#profileShortcut').onclick = () => goPage('profil');
$('#notificationBtn').onclick = () => goPage('notifikasi');
function heading(kicker, title, desc, action = '') { return `<div class="page-heading"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${desc}</p></div>${action ? `<div class="heading-actions">${action}</div>` : ''}</div>` }
function stat(icon, num, label, change = '') { return `<div class="card stat-card"><div class="stat-top"><span class="stat-icon">${icon}</span>${change ? `<span class="stat-change">${change}</span>` : ''}</div><div class="stat-number">${num}</div><div class="stat-label">${label}</div></div>` }
function topicHTML(t) {
    let isAdmin = currentUser && currentUser.role === 'admin';
    let canDelete = t.owner === 'demo' || t.canDelete || isAdmin;

    let headAuthorHTML = '';
    let authorBadgeHTML = '';
    if (isAdmin && t.authorName) {
        headAuthorHTML = `
            <div class="anon-avatar" style="background:var(--green2);color:var(--emerald);font-weight:800;font-size:15px">${esc(t.authorName.charAt(0).toUpperCase())}</div>
            <div>
                <div style="display:flex;align-items:center;gap:6px">
                    <b style="color:var(--emerald)">${esc(t.authorName)}</b>
                    <span class="role-tag" style="font-size:9px">${esc(t.authorRole || 'PENGGUNA')}</span>
                    ${t.authorDetail ? `<span class="role-tag" style="font-size:9px;background:var(--lime-soft);color:var(--lime)">${esc(t.authorDetail)}</span>` : ''}
                </div>
                <small>${esc(t.authorEmail || '')} · ${ago(t.time)}</small>
            </div>
            <span class="anon-tag" style="background:var(--green2);color:var(--emerald);border:1px solid rgba(52,211,153,0.35);font-weight:700">👁 Penulis: ${esc(t.authorName)}</span>
        `;
        authorBadgeHTML = `
            <div style="margin:4px 0 10px;padding:7px 11px;background:rgba(52,211,153,0.08);border-left:3px solid var(--emerald);border-radius:6px;font-size:11px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
                <span>👤 <b>Pembuat Topik (Info Admin):</b> <strong>${esc(t.authorName)}</strong> · Peran: <b>${esc(t.authorRole || '-')}</b> ${t.authorDetail ? `· Kelas/Bidang: <b>${esc(t.authorDetail)}</b>` : ''}</span>
                <span style="color:var(--muted);font-size:10px">${esc(t.authorEmail || '')}</span>
            </div>
        `;
    } else {
        headAuthorHTML = `
            <div class="anon-avatar">◌</div>
            <div><b>Warga sekolah</b><small>${ago(t.time)}</small></div>
            <span class="anon-tag">● Anonim</span>
        `;
    }

    return `<article class="topic">
        <div class="topic-head">${headAuthorHTML}</div>
        ${authorBadgeHTML}
        <h4>${esc(t.title)}</h4>
        <p>${esc(t.body)}</p>
        ${t.imageName ? `
            <div class="topic-attached-wrap" style="margin:10px 0">
                <img class="topic-attached-img" src="/api/posts/${t.id}/image" alt="Lampiran gambar" data-preview-img="/api/posts/${t.id}/image" style="max-width:100%;max-height:360px;border-radius:10px;object-fit:cover;cursor:pointer;border:1px solid var(--line);display:block">
            </div>
        ` : ''}
        <div class="topic-actions">
            <button class="text-action ${t.liked ? 'liked' : ''}" data-like="${t.id}">♡ ${t.likes} Suka</button>
            <button class="text-action" data-comments="${t.id}">▱ ${t.comments ? t.comments.length : 0} Komentar</button>
            ${canDelete ? `<button class="text-action text-danger" data-delete-topic="${t.id}">Hapus</button>` : ''}
        </div>
        <div class="comment-box hidden" id="comments-${t.id}">
            ${t.comments && t.comments.length ? t.comments.map(c => {
                let commentAuthor = (isAdmin && c.authorName) ?
                    `<b style="color:var(--emerald)">${esc(c.authorName)}</b> <span class="role-tag" style="font-size:8px;padding:2px 4px">${esc(c.authorRole || '')}${c.authorDetail ? ` · ${esc(c.authorDetail)}` : ''}</span>` :
                    '<b>Anonim</b>';
                return `<div class="comment-item">
                    <span class="anon-avatar" style="width:26px;height:26px;font-size:13px;font-weight:700">${(isAdmin && c.authorName) ? esc(c.authorName.charAt(0).toUpperCase()) : '◌'}</span>
                    <p>${commentAuthor} · ${ago(c.time || (c.createdAt ? new Date(c.createdAt).getTime() : Date.now()))}<br>${esc(c.body)}</p>
                </div>`;
            }).join('') : '<div class="empty-state" style="padding:12px">Belum ada komentar.</div>'}
            <div class="comment-input"><input id="comment-input-${t.id}" maxlength="500" placeholder="Tulis komentar..."><button data-send-comment="${t.id}">Kirim</button></div>
        </div>
    </article>`;
}
async function reloadPosts() {
    let result = await api('/api/posts');
    topics = result.posts.map(post => ({
        ...post,
        time: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(),
        owner: (post.isOwner || (currentUser && currentUser.role === 'admin')) ? 'demo' : 'other',
        canDelete: Boolean(post.canDelete || post.isOwner || (currentUser && currentUser.role === 'admin'))
    }));
}
bindTopicEvents = function () {
    if ($('#topicImageInput')) {
        $('#topicImageInput').onchange = () => {
            let f = $('#topicImageInput').files[0];
            if (f) {
                $('#topicImageName').textContent = f.name;
                $('#topicImageBadge').classList.remove('hidden');
            } else {
                $('#topicImageBadge').classList.add('hidden');
            }
        };
    }
    if ($('#topicImageRemove')) {
        $('#topicImageRemove').onclick = () => {
            if ($('#topicImageInput')) $('#topicImageInput').value = '';
            $('#topicImageBadge').classList.add('hidden');
        };
    }
    if ($('#topicForm')) {
        $('#topicForm').onsubmit = async event => {
            event.preventDefault();
            let submitBtn = $('#publishTopicBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Memublikasikan...';
            }
            try {
                let formData = new FormData();
                formData.append('title', $('#topicTitle').value.trim());
                formData.append('body', $('#topicBody').value.trim());
                let imgFile = $('#topicImageInput')?.files[0];
                if (imgFile) formData.append('image', imgFile);

                await api('/api/posts', { method: 'POST', body: formData });
                if ($('#topicImageInput')) $('#topicImageInput').value = '';
                $('#topicImageBadge')?.classList.add('hidden');
                $('#topicTitle').value = '';
                $('#topicBody').value = '';
                await reloadPosts();
                renderHome();
                toast('Topik diskusi berhasil dibagikan.');
            } catch (error) {
                toast(error.message);
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publikasikan ↗';
                }
            }
        };
    }
    $$('[data-like]').forEach(button => button.onclick = async () => {
        try {
            await api(`/api/posts/${button.dataset.like}/like`, { method: 'POST', body: '{}' });
            await reloadPosts();
            renderHome();
        } catch (error) {
            toast(error.message);
        }
    });
    $$('[data-comments]').forEach(button => button.onclick = () => $('#comments-' + button.dataset.comments).classList.toggle('hidden'));
    $$('[data-send-comment]').forEach(button => button.onclick = async () => {
        let postId = button.dataset.sendComment, input = $('#comment-input-' + postId);
        try {
            await api(`/api/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body: input.value.trim() }) });
            await reloadPosts();
            renderHome();
            $('#comments-' + postId)?.classList.remove('hidden');
        } catch (error) {
            toast(error.message);
        }
    });
    $$('[data-delete-topic]').forEach(button => button.onclick = async () => {
        if (!confirm('Apakah Anda yakin ingin menghapus topik ini?')) return;
        try {
            await api(`/api/posts/${button.dataset.deleteTopic}`, { method: 'DELETE' });
            await reloadPosts();
            renderHome();
            toast('Topik berhasil dihapus.');
        } catch (error) {
            toast(error.message);
        }
    });
    $$('[data-preview-img]').forEach(img => img.onclick = () => {
        let lightbox = $('#mediaLightboxDialog');
        let lightboxImg = $('#mediaLightboxImg');
        if (lightbox && lightboxImg) {
            lightboxImg.src = img.dataset.previewImg || img.src;
            lightbox.showModal();
        }
    });
    let closeLightbox = $('#closeMediaLightbox');
    if (closeLightbox) closeLightbox.onclick = () => $('#mediaLightboxDialog').close();
    $$('[data-page]').forEach(link => link.onclick = event => { event.preventDefault(); goPage(link.dataset.page) });
};
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
        attachmentName: task.attachmentName || null,
        attachmentOriginalName: task.attachmentOriginalName || null,
        submissionCount: Number(task.submissionCount) || 0
    };
}
setupApp = async function () { let role = currentUser.role; $('#topUser').textContent = currentUser.name; $('#topRole').textContent = role === 'siswa' ? 'Siswa' : role === 'guru' ? 'Guru' : role === 'staf' ? 'Staf' : 'Admin sekolah'; $('#today').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }); renderNav(); goPage('beranda'); fetchNotifications(); if (!window._notifPollTimer) { window._notifPollTimer = setInterval(() => { if (currentUser) fetchNotifications(); }, 15000); } try { let [postData, taskData, settingsData, teachingData] = await Promise.all([api('/api/posts'), api('/api/assignments'), api('/api/attendance/settings'), api('/api/teaching/me')]); topics = postData.posts.map(post => ({ ...post, time: post.createdAt ? new Date(post.createdAt).getTime() : Date.now(), owner: (post.isOwner || (currentUser && currentUser.role === 'admin')) ? 'demo' : 'other', canDelete: Boolean(post.canDelete || post.isOwner || (currentUser && currentUser.role === 'admin')) })); if (taskData.availableClasses) window.availableClasses = taskData.availableClasses; tasks = (taskData.assignments || []).map(mapAssignment); teacherSubjects = teachingData.subjects || []; teacherClasses = teachingData.classes || []; teacherMaterials = teachingData.materials || []; allMaterials = teachingData.materials || []; if (currentUser.role !== 'guru') availableSubjects = teachingData.subjects || []; schoolSettings = { ...schoolSettings, latitude: String(settingsData.settings.latitude), longitude: String(settingsData.settings.longitude), radius: settingsData.settings.radiusMeters, open: settingsData.settings.openTime, late: settingsData.settings.lateAfter, cutoff: settingsData.settings.closeTime, close: settingsData.settings.closeTime }; renderNav(); if (currentPage === 'beranda') renderHome() } catch (error) { toast('Sebagian data belum dapat dimuat: ' + error.message) } };
addTaskForm = function () {
    const existingPanel = $('.task-create-panel');
    if (existingPanel) {
        existingPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#newTitle')?.focus({ preventScroll: true });
        return;
    }
    const subjects = teacherSubjects.length ? teacherSubjects : availableSubjects;
    if (!subjects.length) {
        toast('Belum ada mata pelajaran yang dipilih.');
        return;
    }
    if (!teacherClasses.length) {
        toast('Belum ada kelas tersedia. Hubungi admin untuk menambahkan kelas.');
        return;
    }
    const taskContainer = currentPage === 'pembelajaran' ? $('#learningTasksSection') : $('#pageContent');
    if (!taskContainer) return;
    taskContainer.insertAdjacentHTML('beforeend', `
        <section class="card task-create-panel" style="margin-top:20px;scroll-margin-top:20px">
            <div class="card-title">
                <h3>Buat tugas untuk kelas</h3>
                <button class="text-action" id="cancelTaskCreate">Batal</button>
            </div>
            <form id="taskCreateForm" class="grid two-col">
                <div>
                    <label class="field-label" for="newSubject">Mata pelajaran</label>
                    <select id="newSubject" class="field" required ${subjects.length === 1 ? 'disabled' : ''}>
                        ${subjects.map(subject => `<option value="${subject.id}">${esc(subject.name)}</option>`).join('')}
                    </select>
                    ${subjects.length === 1 ? '<p class="hint">Mata pelajaran terisi otomatis sesuai pilihan saat mendaftar.</p>' : ''}
                    <label class="field-label" for="newMaterial">Materi dasar tugas</label>
                    <select id="newMaterial" class="field" required></select>
                    <div id="taskMaterialHelp" aria-live="polite"></div>
                    <label class="field-label">Kategori tugas</label>
                    <select id="newCategory" class="field" required>
                        <option value="Teori">Teori</option>
                        <option value="Bengkel">Bengkel</option>
                    </select>
                    <label class="field-label">Kelas tujuan</label>
                    <select id="newClass" class="field" required>
                        ${teacherClasses.map(cls => `<option value="${esc(cls.name)}">${esc(cls.name)}</option>`).join('')}
                    </select>
                    <label class="field-label">Lampirkan Berkas / Soal (Opsional - PDF, DOCX, ZIP, Gambar maks 25MB)</label>
                    <input id="newAttachment" type="file" class="field" style="padding:8px">
                </div>
                <div>
                    <label class="field-label">Judul tugas</label>
                    <input id="newTitle" class="field" required maxlength="150" placeholder="Judul tugas...">
                    <label class="field-label">Tenggat</label>
                    <input id="newDue" class="field" type="datetime-local" required>
                    <label class="field-label">Instruksi</label>
                    <textarea id="newDesc" class="field" rows="4" required maxlength="5000" placeholder="Petunjuk pengerjaan tugas..."></textarea>
                </div>
                <div style="grid-column:1/-1;margin-top:10px">
                    <button class="btn btn-primary" id="saveTaskBtn" type="submit">Simpan &amp; Publikasikan tugas ↗</button>
                </div>
            </form>
        </section>
    `);
    const panel = $('.task-create-panel');
    const selectedSubjectId = () => Number($('#newSubject').value);
    const selectedSubjectName = () => subjects.find(subject => subject.id === selectedSubjectId())?.name || 'mata pelajaran ini';
    const updateTaskMaterials = () => {
        const materials = teacherMaterials.filter(material => material.subjectId === selectedSubjectId());
        const select = $('#newMaterial');
        const help = $('#taskMaterialHelp');
        select.innerHTML = materials.length > 1
            ? '<option value="">Pilih materi...</option>' + materials.map(material => `<option value="${esc(material.id)}">${esc(material.title)}</option>`).join('')
            : materials.map(material => `<option value="${esc(material.id)}">${esc(material.title)}</option>`).join('');
        select.disabled = materials.length <= 1;
        select.required = materials.length > 1;
        $('#saveTaskBtn').disabled = materials.length === 0;
        if (!materials.length) {
            help.innerHTML = `<div class="form-notice">Belum ada materi untuk ${esc(selectedSubjectName())}. Buat materi terlebih dahulu sebelum membuat tugas. <button class="text-action" type="button" id="createTaskMaterial">Buat materi</button></div>`;
            $('#createTaskMaterial').onclick = () => {
                if (currentPage === 'pembelajaran') {
                    renderMaterials(selectedSubjectId()).then(() => {
                        const card = $('#materialCreateCard');
                        card?.classList.remove('hidden');
                        (card || $('#learningMaterialsSection'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        setTimeout(() => $('#materialTitle')?.focus({ preventScroll: true }), 200);
                    });
                } else {
                    goPage('materi', { subjectId: selectedSubjectId() });
                }
            };
        } else {
            help.innerHTML = materials.length === 1
                ? '<p class="hint">Materi terisi otomatis karena hanya tersedia satu materi.</p>'
                : '<p class="hint">Pilih salah satu materi yang menjadi dasar tugas.</p>';
        }
    };
    $('#newSubject').onchange = updateTaskMaterials;
    updateTaskMaterials();
    if (panel) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        $('#newTitle')?.focus({ preventScroll: true });
    }
    $('#cancelTaskCreate').onclick = () => panel.remove();
    $('#taskCreateForm').onsubmit = async event => {
        event.preventDefault();
        const materialId = $('#newMaterial').value;
        if (!materialId) {
            toast('Pilih atau buat materi terlebih dahulu.');
            return;
        }
        const className = $('#newClass').value.trim();
        let submitBtn = $('#saveTaskBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Menyimpan tugas...';
        try {
            let formData = new FormData();
            formData.append('title', $('#newTitle').value.trim());
            formData.append('instructions', $('#newDesc').value.trim());
            formData.append('subjectId', selectedSubjectId());
            formData.append('materialId', materialId);
            formData.append('className', className);
            formData.append('category', $('#newCategory').value);
            formData.append('dueAt', new Date($('#newDue').value).toISOString());
            formData.append('maxScore', 100);
            let attFile = $('#newAttachment').files[0];
            if (attFile) formData.append('attachment', attFile);

            await api('/api/assignments', { method: 'POST', body: formData });
            let result = await api('/api/assignments');
            if (result.availableClasses) window.availableClasses = result.availableClasses;
            tasks = (result.assignments || []).map(mapAssignment);
            renderTasks();
            toast('Tugas berhasil disimpan dan dikirim ke ' + className + '!');
        } catch (error) {
            toast(error.message);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Simpan & Publikasikan tugas ↗';
        }
    };
};

function showAttendancePhotoError(image) {
    const wrapper = image.closest('.attendance-photo-wrap');
    if (!wrapper) return;
    wrapper.classList.add('photo-unavailable');
    image.hidden = true;
    wrapper.querySelector('.photo-unavailable-label').hidden = false;
}

function bindAttendancePhotoFallbacks(container = document) {
    container.querySelectorAll('img.attendance-photo').forEach(image => {
        image.onerror = () => showAttendancePhotoError(image);
        if (image.complete && image.naturalWidth === 0) showAttendancePhotoError(image);
    });
}

renderAttendance = function () {
    if (currentUser.role !== 'admin') return renderUserAttendance();
    $('#pageContent').innerHTML = heading('PENGELOLAAN SEKOLAH', 'Foto Kehadiran Siswa', 'Periksa foto, lokasi, dan catatan siswa sebelum menyetujui kehadiran.') +
    `<section class="card">
        <div class="card-title">
            <h3>Daftar Kehadiran Siswa (Verifikasi Admin)</h3>
            <button class="btn btn-outline" id="reloadAttendance">Muat ulang</button>
        </div>
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        <th>Foto Wajah</th>
                        <th>Nama Siswa</th>
                        <th>Kelas</th>
                        <th>Waktu & Tanggal</th>
                        <th>Status</th>
                        <th>Kontrol Admin</th>
                    </tr>
                </thead>
                <tbody id="adminAttendanceRows">
                    <tr><td colspan="6" style="text-align:center">Memuat data absensi...</td></tr>
                </tbody>
            </table>
        </div>
    </section>`;

    let load = async () => {
        try {
            let result = await api('/api/admin/attendance');
            let rows = result.attendance || [];
            $('#adminAttendanceRows').innerHTML = rows.map(row => `
                <tr>
                    <td>
                        <div class="attendance-photo-wrap">
                            <img src="/api/attendance/${encodeURIComponent(row.id)}/photo" class="attendance-thumb attendance-photo" alt="Foto wajah ${esc(row.name)}" data-preview-img="/api/attendance/${encodeURIComponent(row.id)}/photo">
                            <span class="photo-unavailable-label" hidden>Foto rusak / tidak dapat dibaca</span>
                        </div>
                    </td>
                    <td><b>${esc(row.name)}</b><br><small class="muted">${esc(row.email || '')}</small></td>
                    <td><span class="role-tag">${esc(row.detail || '-')}</span></td>
                    <td>${new Date(row.capturedAt).toLocaleString('id-ID')}<br><small class="muted">${esc(row.day)}</small></td>
                    <td><span class="status ${row.verification === 'DISETUJUI' ? 'status-selesai' : (row.verification === 'DITOLAK' ? 'status-terlambat' : 'status-belum')}">${row.verification === 'DISETUJUI' ? '✓ Disetujui Admin' : row.verification === 'DITOLAK' ? (row.rejectionReason === 'LOKASI' ? 'Ditolak · Tidak hadir' : 'Ditolak') : esc(row.verification)}</span></td>
                    <td>
                        <div style="display:flex;gap:6px">
                            ${row.verification === 'DISETUJUI' ? `
                                <button class="btn btn-outline" style="padding:5px 9px;font-size:11px" data-review-att="${row.id}" data-verification="DITOLAK">Tolak</button>
                            ` : row.verification === 'DITOLAK' && row.rejectionReason === 'LOKASI' ? `
                                <span class="muted">Ditolak otomatis</span>
                            ` : `
                                <button class="btn btn-primary" style="padding:5px 9px;font-size:11px" data-review-att="${row.id}" data-verification="DISETUJUI">✓ Setujui</button>
                            `}
                        </div>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="6" class="empty-state">Belum ada pengajuan absensi hari ini.</td></tr>';
            bindAttendancePhotoFallbacks($('#adminAttendanceRows'));

            $$('[data-review-att]').forEach(button => button.onclick = async () => {
                try {
                    await api(`/api/admin/attendance/${button.dataset.reviewAtt}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ verification: button.dataset.verification })
                    });
                    toast(`Kehadiran telah ${button.dataset.verification.toLowerCase()}.`);
                    load();
                } catch (error) {
                    toast(error.message);
                }
            });

            $$('[data-preview-img]').forEach(img => img.onclick = () => {
                if (img.closest('.photo-unavailable')) return;
                let lightbox = $('#mediaLightboxDialog');
                let lightboxImg = $('#mediaLightboxImg');
                if (lightbox && lightboxImg) {
                    lightboxImg.src = img.dataset.previewImg || img.src;
                    lightbox.showModal();
                }
            });
        } catch (error) {
            $('#adminAttendanceRows').innerHTML = `<tr><td colspan="6" class="error">${esc(error.message)}</td></tr>`;
        }
    };

    $('#reloadAttendance').onclick = load;
    load();
};

async function renderAdminClasses() {
    if (currentUser.role !== 'admin') return goPage('beranda');
    $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan Data Kelas', 'Atur data kelas sistem untuk meminimalisir typo pendaftaran dan penugasan.') +
    `<div class="grid two-col">
        <section class="card">
            <div class="card-title"><h3>Daftar Kelas di Sistem</h3><small id="classCount">Memuat...</small></div>
            <div class="table-wrap">
                <table>
                    <thead><tr><th>No</th><th>Nama Kelas</th><th>Aksi</th></tr></thead>
                    <tbody id="adminClassRows"><tr><td colspan="3">Memuat kelas...</td></tr></tbody>
                </table>
            </div>
        </section>
        <section class="card" style="align-self:start">
            <div class="card-title"><h3>Tambah Kelas Baru</h3><small>VALIDASI SISTEM</small></div>
            <form id="addClassForm" style="display:flex;flex-direction:column;gap:12px">
                <label class="field-label" style="margin:0">Nama Kelas</label>
                <input id="newClassNameInput" class="field" placeholder="Contoh: XII RPL 3, X MM 1" required maxlength="60">
                <p class="hint">Gunakan format standar (Tingkat Jurusan Nomor) agar konsisten dan meminimalisir kesalahan penulisan.</p>
                <button class="btn btn-primary" type="submit">＋ Tambah Kelas</button>
            </form>
        </section>
    </div>`;

    const loadClasses = async () => {
        try {
            let res = await api('/api/classes');
            let list = res.classes || [];
            $('#classCount').textContent = `${list.length} KELAS`;
            window.availableClasses = ['Semua Kelas', ...list.map(c => c.name)];
            $('#adminClassRows').innerHTML = list.map((c, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td><b>${esc(c.name)}</b></td>
                    <td>
                        <button class="text-action text-danger" data-delete-class="${c.id}" data-class-name="${esc(c.name)}">🗑 Hapus</button>
                    </td>
                </tr>
            `).join('') || '<tr><td colspan="3" class="empty-state">Belum ada kelas.</td></tr>';

            $$('[data-delete-class]').forEach(btn => btn.onclick = async () => {
                let id = btn.dataset.deleteClass;
                let name = btn.dataset.className;
                if (!confirm(`Hapus kelas "${name}" dari sistem?`)) return;
                try {
                    await api(`/api/classes/${id}`, { method: 'DELETE' });
                    toast(`Kelas "${name}" berhasil dihapus.`);
                    loadClasses();
                    populateRegisterClasses();
                } catch (err) {
                    toast(err.message);
                }
            });
        } catch (err) {
            $('#adminClassRows').innerHTML = `<tr><td colspan="3" class="error">${esc(err.message)}</td></tr>`;
        }
    };

    $('#addClassForm').onsubmit = async e => {
        e.preventDefault();
        let name = $('#newClassNameInput').value.trim();
        if (!name) return;
        try {
            await api('/api/classes', { method: 'POST', body: JSON.stringify({ name }) });
            $('#newClassNameInput').value = '';
            toast(`Kelas "${name}" berhasil ditambahkan.`);
            loadClasses();
            populateRegisterClasses();
        } catch (err) {
            toast(err.message);
        }
    };

    loadClasses();
}

async function renderAcademicAdmin() {
    if (currentUser.role !== 'admin') return goPage('beranda');
    $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Mata pelajaran', 'Kelola mata pelajaran yang dapat dipilih guru saat mendaftar.') + '<div class="empty-state">Memuat data akademik...</div>';
    let data;
    try {
        data = await api('/api/subjects');
    } catch (error) {
        $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Mata pelajaran', 'Gagal memuat data akademik.') + `<div class="empty-state error">${esc(error.message)}</div>`;
        return;
    }
    availableSubjects = data.subjects || [];
    const subjects = data.subjects || [];
    $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Mata pelajaran', 'Kelola mata pelajaran yang dapat dipilih guru saat mendaftar.') + `
        <div class="grid two-col">
            <section class="card">
                <div class="card-title"><h3>Daftar mata pelajaran</h3><small>${subjects.length} MAPEL</small></div>
                <div class="table-wrap"><table><thead><tr><th>Nama mata pelajaran</th><th>Aksi</th></tr></thead><tbody id="academicSubjectRows">
                    ${subjects.map(subject => `<tr><td><b>${esc(subject.name)}</b></td><td><button class="text-action text-danger" data-delete-subject="${subject.id}" data-subject-name="${esc(subject.name)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="2" class="empty-state">Belum ada mata pelajaran.</td></tr>'}
                </tbody></table></div>
            </section>
            <section class="card" style="align-self:start">
                <div class="card-title"><h3>Tambah mata pelajaran</h3><small>DATA MASTER</small></div>
                <form id="addSubjectForm" class="stack-form">
                    <label class="field-label">Nama mata pelajaran</label>
                    <input id="newSubjectName" class="field" maxlength="80" placeholder="Contoh: Pemrograman Dasar" required>
                    <button class="btn btn-primary" type="submit">+ Tambah mata pelajaran</button>
                </form>
            </section>
        </div>`;

    $('#addSubjectForm').onsubmit = async event => {
        event.preventDefault();
        const name = $('#newSubjectName').value.trim();
        try {
            await api('/api/admin/subjects', { method: 'POST', body: JSON.stringify({ name }) });
            $('#newSubjectName').value = '';
            toast('Mata pelajaran berhasil ditambahkan.');
            renderAcademicAdmin();
        } catch (error) {
            toast(error.message);
        }
    };
    $$('[data-delete-subject]').forEach(button => button.onclick = async () => {
        if (!confirm(`Hapus mata pelajaran "${button.dataset.subjectName}"?`)) return;
        try {
            await api(`/api/admin/subjects/${button.dataset.deleteSubject}`, { method: 'DELETE' });
            toast('Mata pelajaran berhasil dihapus.');
            renderAcademicAdmin();
        } catch (error) {
            toast(error.message);
        }
    });
}

function renderLearning(options = {}) {
    $('#pageContent').innerHTML = heading('PUSAT PEMBELAJARAN', 'Materi & Tugas', 'Baca materi dan kelola tugas dalam satu halaman.') + `
        <section id="learningMaterialsSection" class="learning-section"></section>
        <section id="learningTasksSection" class="learning-section"></section>`;
    Promise.all([
        renderMaterials(options.subjectId || ''),
        Promise.resolve(renderTasks())
    ]).then(() => {
        const sectionId = options.section === 'tugas' ? '#learningTasksSection' : options.section === 'materi' ? '#learningMaterialsSection' : '';
        if (sectionId) {
            $(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
}

async function renderMaterials(preferredSubjectId = '') {
    const canCreate = currentUser.role === 'guru';
    const canAddSubject = currentUser.role === 'admin';
    const isAdmin = canAddSubject;
    const filterId = preferredSubjectId === '' ? 'Semua' : Number(preferredSubjectId);
    const embedded = currentPage === 'pembelajaran';
    const target = embedded ? $('#learningMaterialsSection') : $('#pageContent');
    if (!target) return;
    const action = (canCreate || canAddSubject) ? `<button class="btn btn-primary" id="openMaterialCreate">+ ${canAddSubject ? 'Tambah mapel' : 'Tambah materi'}</button>` : '';
    const pageHeading = heading('PUSAT PEMBELAJARAN', 'Materi pembelajaran', 'Baca materi, buka tautan, dan unduh berkas yang dibagikan guru.', action);
    const panelHeading = `<div class="card-title learning-section-heading"><h3>Materi pembelajaran</h3>${action}</div>`;
    target.innerHTML = (embedded ? '' : pageHeading) + '<div class="empty-state">Memuat materi...</div>';
    let data;
    try {
        data = await api(`/api/materials${currentUser.role === 'guru' ? '?mine=1' : ''}`);
    } catch (error) {
        if (!target.isConnected || (embedded && currentPage !== 'pembelajaran')) return;
        target.innerHTML = (embedded ? '' : heading('PUSAT PEMBELAJARAN', 'Materi pembelajaran', 'Gagal memuat materi.')) + `<div class="empty-state error">${esc(error.message)}</div>`;
        return;
    }
    if (!target.isConnected || (embedded && currentPage !== 'pembelajaran')) return;
    allMaterials = data.materials || [];
    if (currentUser.role === 'guru') teacherMaterials = allMaterials;
    const subjects = isAdmin ? availableSubjects : teacherSubjects;
    const preselectNewSubject = isAdmin && subjects.length === 0;
    const filtered = filterId === 'Semua' ? allMaterials : allMaterials.filter(material => material.subjectId === filterId);
    const createForm = canCreate && (subjects.length || isAdmin) ? `
        <section class="card material-create-card" id="materialCreateCard">
            <div class="card-title"><h3>Tambah materi baru</h3><button class="text-action" id="closeMaterialCreate">Batal</button></div>
            <form id="materialCreateForm" class="grid two-col">
                <div>
                    <label class="field-label" for="materialSubject">Mata pelajaran</label>
                    <select id="materialSubject" class="field" required ${subjects.length === 1 && !isAdmin ? 'disabled' : ''}>
                        ${subjects.map(subject => `<option value="${subject.id}" ${Number(subject.id) === filterId ? 'selected' : ''}>${esc(subject.name)}</option>`).join('')}
                        ${isAdmin ? `<option value="__new__" ${preselectNewSubject ? 'selected' : ''}>＋ Tambah mata pelajaran</option>` : ''}
                    </select>
                    ${isAdmin ? `<div id="newMaterialSubjectGroup" class="${preselectNewSubject ? '' : 'hidden'}">
                        <label class="field-label" for="newMaterialSubjectName">Nama mata pelajaran baru</label>
                        <input id="newMaterialSubjectName" class="field" maxlength="80" placeholder="Contoh: Pemrograman Dasar" ${preselectNewSubject ? 'required' : ''}>
                    </div>` : ''}
                    ${subjects.length === 1 && !isAdmin ? '<p class="hint">Mata pelajaran terisi otomatis sesuai pilihan saat mendaftar.</p>' : isAdmin ? '<p class="hint">Mapel baru dapat dipilih guru saat mendaftar.</p>' : ''}
                    <label class="field-label" for="materialTitle">Judul materi</label>
                    <input id="materialTitle" class="field" required maxlength="150" placeholder="Judul materi...">
                    <label class="field-label" for="materialUrl">Tautan materi (Opsional)</label>
                    <input id="materialUrl" class="field" type="url" maxlength="500" placeholder="https://...">
                    <label class="field-label" for="materialFile">Berkas materi (Opsional, maksimal 25MB)</label>
                    <input id="materialFile" class="field" type="file">
                </div>
                <div>
                    <label class="field-label" for="materialContent">Isi materi</label>
                    <textarea id="materialContent" class="field" rows="9" required maxlength="20000" placeholder="Tulis penjelasan atau langkah belajar..."></textarea>
                </div>
                <div style="grid-column:1/-1"><button class="btn btn-primary" type="submit" id="saveMaterialBtn">Simpan materi</button></div>
            </form>
        </section>` : canAddSubject ? `
        <section class="card material-create-card" id="materialCreateCard">
            <div class="card-title"><h3>Tambah mata pelajaran</h3><button class="text-action" id="closeMaterialCreate">Batal</button></div>
            <form id="adminSubjectCreateForm">
                <label class="field-label" for="newMaterialSubjectName">Nama mata pelajaran baru</label>
                <input id="newMaterialSubjectName" class="field" maxlength="80" placeholder="Contoh: Pemrograman Dasar" required>
                <p class="hint">Mata pelajaran baru akan muncul saat guru mendaftar.</p>
                <button class="btn btn-primary" type="submit" id="saveSubjectBtn">Simpan mata pelajaran</button>
            </form>
        </section>` : '';
    target.innerHTML = (embedded ? panelHeading : pageHeading) + createForm + `
        <div class="filter-row material-filter-row">
            <button class="filter-chip ${filterId === 'Semua' ? 'active' : ''}" data-material-filter="Semua">Semua</button>
            ${subjects.map(subject => `<button class="filter-chip ${filterId === subject.id ? 'active' : ''}" data-material-filter="${subject.id}">${esc(subject.name)}</button>`).join('')}
        </div>
        <div class="card-title"><h3>Daftar materi</h3><small>${filtered.length} MATERI</small></div>
        <div class="grid two-col material-grid">
            ${filtered.map(material => `<article class="card material-card">
                <div class="task-top"><span class="task-kind">${esc(material.subject)}</span>${material.hasFile ? '<span class="status status-selesai">Ada berkas</span>' : ''}</div>
                <h3>${esc(material.title)}</h3>
                <div class="material-content">${esc(material.content)}</div>
                <div class="material-meta"><span>Guru: <b>${esc(material.teacherName)}</b></span><span>${new Date(material.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                <div class="material-actions">
                    ${material.url ? `<a class="btn btn-outline" href="${esc(material.url)}" target="_blank" rel="noopener noreferrer">Buka tautan</a>` : ''}
                    ${material.hasFile ? `<a class="btn btn-outline" href="/api/materials/${encodeURIComponent(material.id)}/file" target="_blank" rel="noopener noreferrer">Unduh ${esc(material.fileOriginalName || 'berkas')}</a>` : ''}
                    ${material.createdBy === currentUser.id ? `<button class="text-action text-danger" data-delete-material="${esc(material.id)}" data-material-title="${esc(material.title)}">Hapus</button>` : ''}
                </div>
            </article>`).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">▤</div><b>Belum ada materi pada mata pelajaran ini.</b></div>'}
        </div>`;
    const createCard = $('#materialCreateCard');
    if ($('#openMaterialCreate')) $('#openMaterialCreate').onclick = () => {
        if (!createCard) return toast('Belum ada mata pelajaran yang dapat dipilih.');
        createCard.classList.toggle('hidden');
        createCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!createCard.classList.contains('hidden')) setTimeout(() => $(canAddSubject ? '#newMaterialSubjectName' : '#materialTitle')?.focus(), 200);
    };
    if ($('#closeMaterialCreate')) $('#closeMaterialCreate').onclick = () => createCard?.classList.add('hidden');
    if ($('#adminSubjectCreateForm')) $('#adminSubjectCreateForm').onsubmit = async event => {
        event.preventDefault();
        const button = $('#saveSubjectBtn');
        button.disabled = true;
        button.textContent = 'Menyimpan...';
        try {
            const subject = await api('/api/admin/subjects', { method: 'POST', body: JSON.stringify({ name: $('#newMaterialSubjectName').value.trim() }) });
            if (!availableSubjects.some(item => Number(item.id) === Number(subject.id))) availableSubjects.push(subject);
            toast('Mata pelajaran berhasil ditambahkan.');
            await renderMaterials();
        } catch (error) {
            button.disabled = false;
            button.textContent = 'Simpan mata pelajaran';
            toast(error.message);
        }
    };
    if ($('#materialCreateForm')) $('#materialCreateForm').onsubmit = async event => {
        event.preventDefault();
        const subjectId = $('#materialSubject').value;
        const formData = new FormData();
        formData.append('subjectId', subjectId);
        formData.append('title', $('#materialTitle').value.trim());
        formData.append('content', $('#materialContent').value.trim());
        formData.append('url', $('#materialUrl').value.trim());
        const file = $('#materialFile').files[0];
        if (file) formData.append('file', file);
        const button = $('#saveMaterialBtn');
        button.disabled = true;
        button.textContent = 'Menyimpan...';
        try {
            await api('/api/materials', { method: 'POST', body: formData });
            const teaching = await api('/api/teaching/me');
            teacherSubjects = teaching.subjects || [];
            teacherClasses = teaching.classes || [];
            teacherMaterials = teaching.materials || [];
            allMaterials = teaching.materials || [];
            toast('Materi berhasil disimpan.');
            await renderMaterials(subjectId);
            $('#newSubject')?.dispatchEvent(new Event('change'));
        } catch (error) {
            button.disabled = false;
            button.textContent = 'Simpan materi';
            toast(error.message);
        }
    };
    $$('[data-material-filter]').forEach(button => button.onclick = () => renderMaterials(button.dataset.materialFilter));
    $$('[data-delete-material]').forEach(button => button.onclick = async () => {
        if (!confirm(`Hapus materi "${button.dataset.materialTitle}"?`)) return;
        button.disabled = true;
        try {
            await api(`/api/materials/${encodeURIComponent(button.dataset.deleteMaterial)}`, { method: 'DELETE' });
            allMaterials = allMaterials.filter(material => material.id !== button.dataset.deleteMaterial);
            teacherMaterials = teacherMaterials.filter(material => material.id !== button.dataset.deleteMaterial);
            toast('Materi berhasil dihapus.');
            renderMaterials(filterId);
            $('#newSubject')?.dispatchEvent(new Event('change'));
        } catch (error) {
            button.disabled = false;
            toast(error.message);
        }
    });
}

function renderHome() {
    let action = currentUser.role === 'guru' ? '<button class="btn btn-primary" data-page="tugas">＋ Tambah tugas</button>' : '';
    $('#pageContent').innerHTML = heading('KOMUNITAS SEKOLAH', 'Halo, ' + esc(currentUser.name.split(' ')[0]) + '! 👋', 'Apa yang sedang terjadi di sekolah hari ini?', action) +
    `<div class="grid two-col">
        <section>
            <div class="hero-card">
                <div class="eyebrow">KOMUNITAS YANG PEDULI</div>
                <h2>Satu cerita kecil bisa membawa perubahan besar.</h2>
                <p>Bagikan informasi, ide, atau hal yang perlu diperhatikan di lingkungan sekolah.</p>
                <button class="btn" id="scrollToTopicForm">＋ Tulis topik</button>
            </div>
            <div class="card hidden" id="topicFormCard" style="margin-top:18px">
                <div class="card-title"><h3>Bagikan sesuatu</h3><div style="display:flex;align-items:center;gap:10px"><small>Anonim untuk semua</small><button type="button" class="text-action" id="closeTopicFormBtn">Tutup</button></div></div>
                <form id="topicForm">
                    <input id="topicTitle" class="field" maxlength="120" placeholder="Judul topik..." required>
                    <textarea id="topicBody" class="field" maxlength="500" rows="3" placeholder="Ceritakan informasi atau ide kamu..." required style="margin-top:9px;resize:vertical"></textarea>
                    <div style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                        <label class="btn btn-outline" style="cursor:pointer;padding:7px 13px;font-size:11px;display:inline-flex;align-items:center;gap:6px">
                            📷 Unggah Gambar
                            <input type="file" id="topicImageInput" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none">
                        </label>
                        <div id="topicImageBadge" class="hidden" style="display:inline-flex;align-items:center;gap:8px;background:var(--surface-soft);padding:4px 10px;border-radius:8px;border:1px solid var(--line);font-size:11px">
                            <span id="topicImageName"></span>
                            <button type="button" id="topicImageRemove" class="text-action text-danger" style="font-weight:700">✕</button>
                        </div>
                    </div>
                    <div class="compose-foot" style="margin-top:12px">
                        <span class="hint">Maks. 500 karakter · Gambar opsional</span>
                        <button class="btn btn-primary" id="publishTopicBtn" type="submit">Publikasikan ↗</button>
                    </div>
                </form>
            </div>
            <div class="card" style="margin-top:18px">
                <div class="card-title"><h3>Topik terbaru</h3><small>${topics.length} diskusi</small></div>
                <div id="topicFeed">${[...topics].sort((a, b) => b.time - a.time).map(topicHTML).join('') || '<div class="empty-state"><div class="empty-icon">✳</div><b>Belum ada topik</b>Mulai dengan menulis topik pertama.</div>'}</div>
            </div>
        </section>
        <aside class="grid" style="align-content:start">
            <div class="card">
                <div class="card-title"><h3>Agenda & pengingat</h3><small>SEKITAR KAMU</small></div>
                <div class="mini-list">
                    <div class="mini-item" data-page="tugas" style="cursor:pointer" title="Buka halaman Tugas"><div class="mini-icon">▦</div><div><b>Tenggat tugas terdekat</b><small>${tasks.filter(t => t.status !== 'Selesai').length} tugas menunggu diselesaikan</small></div></div>
                    <div class="mini-item" data-page="notifikasi" style="cursor:pointer" title="Buka pembaruan & notifikasi"><div class="mini-icon">◷</div><div><b>Periksa jadwal sekolah</b><small>Pantau informasi terbaru dari guru</small></div></div>
                    <div class="mini-item" id="reportComfortBtn" style="cursor:pointer" title="Buat topik atau laporan"><div class="mini-icon">✳</div><div><b>Jaga ruang tetap nyaman</b><small>Laporkan ancaman atau perundungan</small></div></div>
                </div>
            </div>
            <div class="side-note">
                <h4>🛡 Privasi adalah prioritas</h4>
                <p>Nama penulis dan pemberi komentar tidak ditampilkan kepada warga sekolah. Data penulis tetap tersimpan di server dan dapat diakses admin.</p>
            </div>
            <div class="card">
                <div class="card-title"><h3>Menu cepat</h3></div>
                <div class="mini-list">
                    <div class="mini-item" data-page="cari" style="cursor:pointer" title="Buka halaman Cari"><div class="mini-icon">⌕</div><div><b>Cari warga sekolah</b><small>Temukan profil siswa dan guru</small></div></div>
                    <div class="mini-item" data-page="tugas" style="cursor:pointer" title="Buka halaman Tugas"><div class="mini-icon">▤</div><div><b>Lihat tugas</b><small>Cek status dan tenggat</small></div></div>
                </div>
            </div>
        </aside>
    </div>`;

    function openTopicComposer() {
        let card = $('#topicFormCard');
        if (card) {
            card.classList.remove('hidden');
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => $('#topicTitle')?.focus({ preventScroll: true }), 250);
        }
    }
    $('#scrollToTopicForm').onclick = openTopicComposer;
    if ($('#closeTopicFormBtn')) {
        $('#closeTopicFormBtn').onclick = () => $('#topicFormCard')?.classList.add('hidden');
    }
    const reportBtn = $('#reportComfortBtn');
    if (reportBtn) {
        reportBtn.onclick = () => {
            openTopicComposer();
            toast('Silakan tulis laporan atau keluhan secara anonim pada formulir di samping.');
        };
    }
    $$('#pageContent [data-page]').forEach(el => {
        el.onclick = e => {
            e.preventDefault();
            goPage(el.dataset.page);
        };
    });
    bindTopicEvents();
}
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
    const embedded = currentPage === 'pembelajaran';
    const target = embedded ? $('#learningTasksSection') : $('#pageContent');
    if (!target) return;
    const pageHeading = heading('PUSAT PEMBELAJARAN', 'Tugas & penilaian', 'Pantau tugas, tenggat, dan perkembangan belajarmu.', action);
    const panelHeading = `<div class="card-title learning-section-heading"><h3>Tugas & penilaian</h3>${action}</div>`;

    target.innerHTML = (embedded ? panelHeading : pageHeading) +
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
                    ${t.materialTitle ? `<div class="task-material-label"><b>Materi:</b> ${esc(t.materialTitle)}</div>` : ''}
                    <div class="task-meta" style="margin-top:8px">
                        <span>▤ ${esc(t.subject)}${t.teacherName ? ` · Guru: ${esc(t.teacherName)}` : ''}</span>
                        <span>◷ Tenggat: ${prettyDate(t.due)}</span>
                    </div>
                    <div class="task-bottom" style="margin-top:10px">
                        <span>🎯 Kelas: <b>${esc(t.class)}</b></span>
                        ${bottomScore}
                    </div>
                    ${isStudent && t.submissionId && t.feedback ? `
                        <div style="margin-top:10px;padding:8px 10px;background:rgba(52,211,153,0.08);border-left:3px solid var(--emerald);border-radius:4px;font-size:12px">
                            <b>💬 Catatan Guru:</b> ${esc(t.feedback)}
                        </div>
                    ` : ''}
                    ${t.attachmentName ? `
                        <div style="margin-top:10px;padding:7px 10px;background:rgba(213,248,121,0.08);border:1px solid rgba(213,248,121,0.25);border-radius:6px;display:flex;align-items:center;justify-content:space-between;gap:6px">
                            <span style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📎 <b>Lampiran Guru:</b> ${esc(t.attachmentOriginalName || 'Berkas Tugas')}</span>
                            <a href="/api/assignments/${t.id}/attachment" download class="text-action" style="font-weight:700;text-decoration:underline;white-space:nowrap" target="_blank">Unduh ⬇</a>
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
                    ` : ''}
                    ${currentUser.role === 'admin' ? `
                        <button class="btn btn-outline" style="width:100%" data-view-submissions="${t.id}">
                            👥 Lihat Pengumpulan (${t.submissionCount || 0})
                        </button>
                    ` : ''}
                    ${isTeacher ? `
                        <button class="btn btn-outline" style="width:100%;color:#fda4af;border-color:rgba(244,63,94,0.35)" data-delete-task="${esc(t.id)}">
                            🗑 Hapus Tugas
                        </button>
                    ` : ''}
                </div>
            </article>`;
        }).join('') || '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">▤</div><b>Tidak ada tugas untuk kelas ini.</b>Coba ubah filter tugasmu.</div>'}
    </div>`;

    $$('[data-task-filter]').forEach(b => b.onclick = () => { taskFilter = b.dataset.taskFilter; renderTasks() });
    $$('[data-task-category]').forEach(b => b.onclick = () => { taskCategory = b.dataset.taskCategory; renderTasks() });
    if ($('#addTaskBtn')) $('#addTaskBtn').onclick = addTaskForm;
    $$('[data-submit-task]').forEach(b => b.onclick = () => openSubmitTaskModal(b.dataset.submitTask));
    $$('[data-view-submissions]').forEach(b => b.onclick = () => openSubmissionsModal(b.dataset.viewSubmissions));
    $$('[data-delete-task]').forEach(b => b.onclick = async () => {
        const id = b.dataset.deleteTask;
        if (!confirm('Hapus tugas ini? Semua pengumpulan siswa untuk tugas ini juga akan terhapus.')) return;
        b.disabled = true;
        b.textContent = 'Menghapus...';
        try {
            const res = await api(`/api/assignments/${encodeURIComponent(id)}`, { method: 'DELETE' });
            tasks = tasks.filter(item => String(item.id) !== String(id));
            renderTasks();
            toast(res.message || 'Tugas berhasil dihapus.');
        } catch (err) {
            b.disabled = false;
            b.textContent = '🗑 Hapus Tugas';
            toast(err.message || 'Gagal menghapus tugas.');
        }
    });
}
function addTaskForm() { return window.addTaskForm ? window.addTaskForm() : null }
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

            ${t.attachmentName ? `
            <div style="background:rgba(213,248,121,0.08);border:1px solid rgba(213,248,121,0.25);padding:10px 14px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;gap:10px">
                <span style="font-size:13px">📎 <b>Lampiran Berkas dari Guru:</b> ${esc(t.attachmentOriginalName || 'Berkas Tugas')}</span>
                <a href="/api/assignments/${t.id}/attachment" download class="btn btn-outline" style="padding:6px 12px;font-size:11px;text-decoration:none" target="_blank">Unduh File ⬇</a>
            </div>
            ` : ''}

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
                    ${hasSubmission ? 'Unggah File Pengganti / Revisi (Maks 25MB)' : 'Pilih File Tugas (PDF, Dokumen, Gambar, ZIP, dll - Maks 25MB)'}
                </label>
                <input id="submitFile" type="file" class="field" style="padding:8px">

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
            if (currentPage === 'tugas' || currentPage === 'pembelajaran') renderTasks();
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
    const canGrade = currentUser.role === 'guru';
    const maxScore = Number(t.maxScore) || 100;
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
        if (!container?.isConnected || !modal.open) return;

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
                `<span class="status status-selesai" style="font-size:13px;font-weight:700">Nilai: ${sub.score} / ${maxScore}</span>` :
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

                        ${canGrade ? `
                        <form class="grade-submission-form" data-sub-id="${sub.id}" style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
                            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                                <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px">
                                    Nilai (0–${maxScore}):
                                    <input type="number" min="0" max="${maxScore}" class="field compact-input" style="width:75px" value="${sub.score ?? ''}" placeholder="0-${maxScore}" required>
                                </label>
                                <input type="text" class="field" style="flex:1;min-width:200px;font-size:12px" placeholder="Beri catatan / koreksi untuk siswa..." value="${esc(sub.feedback || '')}">
                                <button type="submit" class="btn btn-primary" style="font-size:12px;padding:6px 14px">Simpan Nilai</button>
                            </div>
                        </form>` : ''}
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
                    if (modal.isConnected && modal.open) openSubmissionsModal(taskId);
                    if (currentPage === 'tugas' || currentPage === 'pembelajaran') {
                        let updated = await api('/api/assignments');
                        if (updated.availableClasses) window.availableClasses = updated.availableClasses;
                        tasks = (updated.assignments || []).map(mapAssignment);
                        renderTasks();
                    }
                } catch (err) {
                    toast(err.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Simpan Nilai';
                }
            };
        });
    } catch (err) {
        if ($('#submissionsListContainer')?.isConnected) $('#submissionsListContainer').innerHTML = `<div class="empty-state" style="color:var(--red)">Gagal memuat pengumpulan: ${esc(err.message)}</div>`;
    }
}
function renderProfile() {
    let isStudent = currentUser.role === 'siswa'; $('#pageContent').innerHTML = heading('AKUN SAYA', 'Profil pribadi', 'Kelola informasi yang ingin kamu bagikan kepada warga sekolah.') + `<div class="grid two-col"><section><div class="profile-cover"></div><div class="profile-info"><div class="profile-avatar">◌</div><h2>${esc(currentUser.name)}</h2><span class="role-tag">${currentUser.role.toUpperCase()}</span><p>${esc(currentUser.detail || 'Belum diatur')}</p><div class="profile-bio" id="bioDisplay">${bioText ? esc(bioText) : 'Belum ada bio. Tekan Edit profil untuk menulis deskripsi singkat.'}</div><button class="btn btn-outline" id="editBio" style="margin-top:15px">✎ Edit bio</button><div class="metric-row">${isStudent ? `<div class="metric"><b>${showAverage ? '86,5' : '—'}</b><small>Rata-rata nilai</small></div><div class="metric"><b>${showRank ? '#08' : '—'}</b><small>Peringkat kelas</small></div>` : `<div class="metric"><b>${tasks.filter(t => t.status !== 'Selesai').length}</b><small>Tugas aktif</small></div><div class="metric"><b>${people.length}</b><small>Warga demo</small></div>`}<div class="metric"><b>96%</b><small>Kehadiran</small></div></div></div></section><section class="card"><div class="card-title"><h3>Privasi profil</h3><small>ATUR SESUAI KEINGINAN</small></div><p class="muted">Pilih informasi yang boleh dilihat oleh warga sekolah lain.</p>${isStudent ? `<div class="toggle-row"><span><b>Rata-rata nilai</b><br><small class="muted">Tampilkan rata-rata semester</small></span><input class="toggle" id="showAverage" type="checkbox" ${showAverage ? 'checked' : ''}></div><div class="toggle-row"><span><b>Peringkat</b><br><small class="muted">Tampilkan posisi di kelas</small></span><input class="toggle" id="showRank" type="checkbox" ${showRank ? 'checked' : ''}></div>` : ''}<div class="side-note" style="margin-top:20px"><h4>🔒 Data sekolah terlindungi</h4><p>Nama, kelas, nomor absen, dan peran berasal dari sistem sekolah dan tidak dapat diubah dari halaman profil. Hubungi admin jika ada data yang salah.</p></div><div class="card-title" style="margin-top:22px"><h3>Ringkasan tugas</h3></div><div class="report-bar"><span style="width:${tasks.length ? Math.round(tasks.filter(t => t.status === 'Selesai').length / tasks.length * 100) : 0}%"></span></div><p class="muted">${tasks.filter(t => t.status === 'Selesai').length} dari ${tasks.length} tugas berstatus selesai.</p></section></div>`;
    $('#editBio').onclick = () => { let next = prompt('Tulis bio (maksimal 300 karakter). Jangan masukkan nomor HP atau alamat rumah.', bioText); if (next === null) return; if (next.length > 300) return toast('Bio maksimal 300 karakter.'); if (/(\+?\d[\d\s-]{8,}|\b(jalan|jl\.|alamat rumah)\b)/i.test(next)) return toast('Hindari nomor telepon atau alamat pribadi di bio.'); bioText = next.trim(); localStorage.setItem('sh_bio', bioText); renderProfile(); toast('Bio berhasil disimpan.') }; if ($('#showAverage')) $('#showAverage').onchange = e => { showAverage = e.target.checked; renderProfile() }; if ($('#showRank')) $('#showRank').onchange = e => { showRank = e.target.checked; renderProfile() }
}
async function renderReports() {
    if (currentUser.role !== 'admin') return;
    $('#pageContent').innerHTML = heading('ANALISIS & ARSIP', 'Laporan sekolah', 'Memuat ringkasan data langsung dari database sekolah_hub...') + '<div class="empty-state">Memuat laporan dari database...</div>';
    let report;
    try {
        report = await api('/api/admin/reports');
    } catch (err) {
        $('#pageContent').innerHTML = heading('ANALISIS & ARSIP', 'Laporan sekolah', 'Gagal memuat laporan dari database.') + `<div class="empty-state" style="color:var(--red)">${esc(err.message)}</div>`;
        return;
    }

    const totalSiswa = Math.max(report.users.students, 1);
    const attPct = report.users.students ? Math.round((report.attendance.approvedToday / totalSiswa) * 100) : 0;
    const attCounts = [
        { s: 'Hadir / Disetujui', n: report.attendance.approvedToday, color: 'var(--emerald)' },
        { s: 'Menunggu Verifikasi', n: report.attendance.pendingToday, color: 'var(--orange)' },
        { s: 'Ditolak', n: report.attendance.rejectedToday, color: 'var(--red)' },
        { s: 'Belum Absen Hari Ini', n: report.attendance.notYetToday, color: 'var(--muted)' }
    ];

    $('#pageContent').innerHTML = heading('ANALISIS & ARSIP', 'Laporan sekolah', `Ringkasan real-time dari database sekolah_hub (${esc(report.today)}).`) +
        `<div class="grid three-col" style="margin-bottom:18px">
            ${stat('◷', `${attPct}%`, 'Kehadiran hari ini', `${report.attendance.approvedToday} dari ${report.users.students} siswa aktif`)}
            ${stat('▤', report.assignments.total, 'Tugas tercatat', `${report.assignments.submissions} pengumpulan siswa`)}
            ${stat('✳', report.community.posts, 'Topik komunitas', `${report.community.comments} komentar · ${report.users.faceRegistered} wajah terdaftar`)}
        </div>
        <div class="grid two-col">
            <section class="card">
                <div class="card-title"><h3>Rekap kehadiran hari ini</h3><small>DATABASE SEKOLAH_HUB</small></div>
                ${attCounts.map(c => `<div style="margin:16px 0"><div style="display:flex;justify-content:space-between;font-size:11px"><span>${esc(c.s)}</span><b>${c.n} siswa</b></div><div class="report-bar"><span style="width:${Math.min(100, c.n / totalSiswa * 100)}%;background:${c.color}"></span></div></div>`).join('')}
                <p class="muted" style="margin-top:12px">Total seluruh riwayat absensi tersimpan: <b>${report.attendance.totalRecords}</b> catatan.</p>
            </section>
            <section class="card">
                <div class="card-title"><h3>Tugas, pengumpulan & warga</h3><small>DATABASE SEKOLAH_HUB</small></div>
                ${[
                    ['Tugas aktif (belum tenggat)', `${report.assignments.active} tugas`],
                    ['Tugas lewat tenggat', `${report.assignments.overdue} tugas`],
                    ['Pengumpulan sudah dinilai', `${report.assignments.graded} / ${report.assignments.submissions}`],
                    ['Siswa / Guru / Staf aktif', `${report.users.students} / ${report.users.teachers} / ${report.users.staff}`]
                ].map(([s, n]) => `<div style="display:flex;justify-content:space-between;padding:15px 0;border-bottom:1px solid var(--line);font-size:12px"><span>${esc(s)}</span><b>${esc(n)}</b></div>`).join('')}
            </section>
        </div>
        <div class="card" style="margin-top:18px">
            <div class="card-title"><h3>Ekspor ringkasan</h3><small>EXCEL &amp; WORD</small></div>
            <p class="muted">Unduh data ringkasan real-time dari database sekolah_hub sebagai file Excel (.xlsx) atau dokumen Word (.doc).</p>
            <div class="export-actions">
                <button class="btn btn-primary" type="button" data-report-export="xlsx">↓ Unduh Excel (.xlsx)</button>
                <button class="btn btn-outline" type="button" data-report-export="doc">↓ Unduh Word (.doc)</button>
            </div>
        </div>`;

    $$('[data-report-export]').forEach(button => button.onclick = async () => {
        const format = button.dataset.reportExport;
        button.disabled = true;
        const originalText = button.textContent;
        button.textContent = 'Menyiapkan laporan...';
        try {
            const response = await fetch(`/api/admin/reports/export?format=${encodeURIComponent(format)}`, { credentials: 'same-origin' });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Laporan gagal dibuat.');
            }
            const blob = await response.blob();
            const disposition = response.headers.get('Content-Disposition') || '';
            const fileName = disposition.match(/filename="?([^";]+)"?/i)?.[1] || `laporan-ringkasan-${report.today}.${format}`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast(`Laporan ${format === 'xlsx' ? 'Excel (.xlsx)' : 'Word (.doc)'} berhasil diunduh.`);
        } catch (err) {
            toast(err.message || 'Gagal mengunduh laporan.');
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });
}

async function fetchNotifications() {
    try {
        const res = await api('/api/notifications');
        notifications = (res.notifications || []).map(n => {
            const id = String(n.id);
            const serverRead = Boolean(n.isRead);
            if (serverRead) optimisticReadNotifIds.delete(id);
            return {
                id: n.id,
                title: n.title,
                message: n.message,
                time: n.createdAt ? new Date(n.createdAt).getTime() : Date.now(),
                read: serverRead || markAllReadPending || optimisticReadNotifIds.has(id)
            };
        });
        updateNotificationBadge();
    } catch (_) {}
}
function updateNotificationBadge() {
    const btn = $('#notificationBtn');
    if (!btn) return;
    const unread = notifications.filter(n => !n.read).length;
    btn.classList.toggle('has-unread', unread > 0);
    btn.setAttribute('aria-label', unread ? `${unread} notifikasi belum dibaca` : 'Buka notifikasi');
}
function addAdminShortcuts() { let shortcuts = [['akun', 'Pengelolaan akun', 'Aktivasi akun dan impor data'], ['kalender', 'Kalender sekolah', 'Atur hari efektif dan agenda'], ['aturan', 'Aturan kehadiran', 'Jam, radius GPS, dan batas alpha'], ['pengingat', 'Pengingat kehadiran', 'Warga yang belum absen'], ['identitas', 'Permintaan buka identitas', 'Tinjau permintaan dan riwayat']]; $('#pageContent').insertAdjacentHTML('beforeend', `<section class="admin-shortcuts"><div class="section-heading"><div><span class="eyebrow">PENGELOLAAN SEKOLAH</span><h2>Menu admin</h2></div></div><div class="shortcut-grid">${shortcuts.map(([id, title, desc]) => `<button class="shortcut-link" data-admin-page="${id}"><span><b>${title}</b><small>${desc}</small></span><strong>↗</strong></button>`).join('')}</div></section>`); $$('[data-admin-page]').forEach(button => button.onclick = () => goPage(button.dataset.adminPage)) }
function resolveNotificationTarget(n) {
    const text = `${n.title || ''} ${n.message || ''}`.toLowerCase();
    const isAdmin = currentUser && currentUser.role === 'admin';
    if (/(tugas|pengumpulan|nilai|tenggat)/.test(text)) return 'tugas';
    if (/(suka baru|komentar|balasan|pesan baru|topik)/.test(text)) return 'beranda';
    if (/(biometrik wajah|status akun|profil)/.test(text)) return 'profil';
    if (/(kehadiran|absen|foto kehadiran)/.test(text)) return isAdmin ? 'kehadiran' : 'absen';
    if (/(akun baru|pendaftaran|aktivasi)/.test(text)) return isAdmin ? 'akun' : 'beranda';
    return 'beranda';
}
async function renderNotifications() {
    await fetchNotifications();
    const unread = notifications.filter(n => !n.read).length;
    $('#pageContent').innerHTML = heading('PEMBARUAN', 'Notifikasi', `${unread} belum dibaca.`, '<button class="btn btn-outline" id="readAllNotifications">Tandai semua dibaca</button>') +
        `<section class="notification-list">${[...notifications].sort((a, b) => b.time - a.time).map(n => {
            const target = resolveNotificationTarget(n);
            return `<article class="notification-item ${n.read ? '' : 'unread'}" data-notif-id="${esc(n.id)}" data-notif-target="${esc(target)}" style="cursor:pointer"><span class="notification-mark">✳</span><div><b>${esc(n.title)}</b><p>${esc(n.message)}</p><small>${ago(n.time)} · Klik untuk buka halaman →</small></div>${n.read ? '' : '<span class="unread-dot"></span>'}</article>`;
        }).join('') || '<div class="empty-state">Belum ada notifikasi.</div>'}</section>`;
    $('#readAllNotifications').onclick = async () => {
        markAllReadPending = true;
        notifications = notifications.map(n => ({ ...n, read: true }));
        updateNotificationBadge();
        try {
            await api('/api/notifications/read-all', { method: 'PATCH' });
            optimisticReadNotifIds.clear();
            markAllReadPending = false;
            await renderNotifications();
        } catch (err) {
            markAllReadPending = false;
            await fetchNotifications();
            renderNotifications();
            toast(err.message || 'Gagal menandai notifikasi.');
        }
    };
    $$('.notification-item[data-notif-id]').forEach(el => {
        el.onclick = () => {
            const id = String(el.dataset.notifId);
            const targetPage = el.dataset.notifTarget || 'beranda';
            const target = notifications.find(n => String(n.id) === id);
            if (target && !target.read) {
                target.read = true;
                optimisticReadNotifIds.add(id);
                updateNotificationBadge();
                api(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).catch(() => {
                    optimisticReadNotifIds.delete(id);
                    target.read = false;
                    updateNotificationBadge();
                });
            }
            goPage(targetPage);
        };
    });
}
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
function persistAdminData() { localStorage.setItem('sh_settings', JSON.stringify(schoolSettings)); localStorage.setItem('sh_unlocks', JSON.stringify(identityRequests)) }
renderUserAttendance = function () {
    if (cameraStream) { cameraStream.getTracks().forEach(track => track.stop()); cameraStream = null } attendancePhotoUrls.forEach(url => URL.revokeObjectURL(url)); attendancePhotoUrls = []; let history = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); $('#pageContent').innerHTML = heading('KEHADIRAN HARI INI', 'Foto kehadiran', 'Ambil foto diri untuk catatan kehadiran. Foto disimpan hanya di browser/perangkat ini.') + `<div class="attendance-layout"><section class="card attendance-camera-card"><div class="card-title"><h3>Ambil foto</h3><span class="demo-chip">MENUNGGU VERIFIKASI</span></div><div class="camera-frame"><video id="attendanceVideo" autoplay muted playsinline></video><div class="face-guide"><span></span></div><div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai</div></div><div class="camera-actions"><button class="btn btn-outline" id="startCamera">Aktifkan kamera</button><button class="btn btn-outline" id="checkLocation">Periksa lokasi</button><button class="btn btn-primary" id="captureAttendance" disabled>Ambil & simpan foto</button></div><label class="photo-consent"><input id="photoConsent" type="checkbox"><span>Saya setuju foto kehadiran ini disimpan di browser/perangkat ini.</span></label><div class="location-status" id="locationStatus"><span class="status-dot"></span><span>Lokasi opsional belum diperiksa</span></div><p class="hint">Foto tidak diunggah atau dibagikan ke sekolah. Simpanan ini bukan bukti absen resmi dan belum diverifikasi oleh admin/server.</p></section><aside class="grid attendance-aside"><section class="card"><div class="card-title"><h3>Ketentuan sekolah</h3><small>HARI INI</small></div><div class="setting-row"><span>Jam absen</span><b>${schoolSettings.open}–10:00 WIB</b></div><div class="setting-row"><span>Batas terlambat</span><b>${schoolSettings.late} WIB</b></div><div class="setting-row"><span>Radius lokasi</span><b>${schoolSettings.radius} meter</b></div><div class="side-note"><h4>Privasi foto</h4><p>Foto disimpan lokal menggunakan penyimpanan browser. Hapus foto dari riwayat kapan saja atau hapus data situs browser.</p></div></section><section class="card"><div class="card-title"><h3>Riwayat foto</h3><small>${history.length} CATATAN</small></div>${history.slice(0, 8).map(item => `<div class="history-row"><span class="history-check">◷</span><span><b>${esc(item.status)}</b><small>${esc(item.date)} · ${esc(item.time)}</small></span>${item.photoId ? `<img class="attendance-thumb" data-photo-id="${esc(item.photoId)}" alt="Foto kehadiran ${esc(item.date)}"><button class="photo-delete" data-photo-delete="${esc(item.photoId)}" aria-label="Hapus foto kehadiran ${esc(item.date)}" title="Hapus foto">×</button>` : ''}</div>`).join('') || '<div class="empty-state" style="padding:15px 0">Belum ada foto kehadiran.</div>'}</section></aside></div><dialog id="photoDialog" class="photo-dialog"><button class="photo-close" id="closePhotoDialog" aria-label="Tutup foto">×</button><img id="photoPreview" alt="Foto kehadiran tersimpan"></dialog>`;
    let consent = $('#photoConsent'), capture = $('#captureAttendance'); consent.onchange = () => { capture.disabled = !consent.checked || !cameraStream }; $('#closePhotoDialog').onclick = () => $('#photoDialog').close(); $$('[data-photo-delete]').forEach(button => button.onclick = async () => { let id = button.dataset.photoDelete; try { await removeAttendancePhoto(id); let saved = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); localStorage.setItem('sh_my_attendance', JSON.stringify(saved.filter(item => item.photoId !== id))); renderUserAttendance(); toast('Foto kehadiran dihapus dari browser.') } catch (error) { toast('Foto tidak dapat dihapus saat ini.') } });
    $('#startCamera').onclick = async () => { try { if (!navigator.mediaDevices?.getUserMedia) throw new Error('secure-context'); cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); $('#attendanceVideo').srcObject = cameraStream; $('#cameraHint').classList.add('hidden'); capture.disabled = !consent.checked; toast('Kamera aktif. Foto hanya tersimpan di browser ini.') } catch (error) { toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak. Aktifkan melalui pengaturan browser.' : 'Kamera memerlukan HTTPS atau localhost dan perangkat yang mendukung.') } };
    $('#checkLocation').onclick = () => { if (!navigator.geolocation) return toast('Browser ini tidak mendukung lokasi.'); $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa lokasi...</span>'; navigator.geolocation.getCurrentPosition(position => { currentPosition = position.coords; let distance = Math.round(distanceMeters(position.coords.latitude, position.coords.longitude, Number(schoolSettings.latitude), Number(schoolSettings.longitude))), accuracy = Math.round(position.coords.accuracy); $('#locationStatus').innerHTML = `<span class="status-dot ${distance <= schoolSettings.radius && accuracy <= 50 ? 'good' : 'warning'}"></span><span>${distance <= schoolSettings.radius && accuracy <= 50 ? 'Dalam radius sekolah' : 'Di luar batas atau kurang akurat'} · ${distance} m · akurasi ${accuracy} m</span>` }, () => { $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Lokasi tidak dapat diakses. Periksa izin browser.</span>' }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }) };
    capture.onclick = async () => { if (!cameraStream) return toast('Aktifkan kamera sebelum mengambil foto.'); if (!consent.checked) return toast('Persetujuan penyimpanan foto diperlukan.'); let video = $('#attendanceVideo'); if (!video.videoWidth) return toast('Kamera belum siap. Coba lagi sebentar.'); let today = new Date(), dayKey = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), dayIso = today.toISOString().slice(0, 10), records = JSON.parse(localStorage.getItem('sh_my_attendance') || '[]'); if (records.some(item => item.dayIso === dayIso && item.photoId)) return toast('Foto kehadiran hari ini sudah tersimpan.'); capture.disabled = true; try { let canvas = document.createElement('canvas'), width = Math.min(video.videoWidth, 1280); canvas.width = width; canvas.height = Math.round(width * video.videoHeight / video.videoWidth); canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .82)); if (!blob) throw new Error('capture-failed'); let photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; await saveAttendancePhoto(photoId, blob); let time = today.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); records.unshift({ photoId, dayIso, date: dayKey, time, status: 'Menunggu verifikasi' }); localStorage.setItem('sh_my_attendance', JSON.stringify(records)); renderUserAttendance(); toast('Foto tersimpan di browser ini; status menunggu verifikasi.') } catch (error) { capture.disabled = false; toast('Foto gagal disimpan. Periksa ruang penyimpanan browser.') } }; hydrateAttendancePhotos()
}
async function renderAdminAccounts() {
    $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', 'Aktivasi, nonaktifkan, reset sandi, dan hapus akun warga sekolah.') + '<div class="empty-state">Memuat akun dari server...</div>';
    try {
        const result = await api('/api/admin/accounts');
        if (currentPage !== 'akun') return;
        adminAccounts = result.accounts || [];
        const pending = adminAccounts.filter(account => account.status === 'PENDING').length;
        $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', `${adminAccounts.length} akun · ${pending} menunggu aktivasi.`) + `
            <section class="card">
                <div class="card-title"><h3>Daftar akun</h3><input id="accountSearch" class="field compact-input" aria-label="Cari akun" placeholder="Cari nama, email, atau nomor induk"></div>
                <div class="table-wrap"><table><thead><tr><th>Nama</th><th>Peran</th><th>Nomor induk</th><th>Kelas / bidang</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="accountRows">${renderAccountRows(adminAccounts)}</tbody></table></div>
            </section>`;
        $('#accountSearch').oninput = () => {
            const query = $('#accountSearch').value.trim().toLowerCase();
            const filtered = adminAccounts.filter(account => `${account.name} ${account.email} ${account.identityNumber} ${account.detail}`.toLowerCase().includes(query));
            $('#accountRows').innerHTML = renderAccountRows(filtered);
            bindAccountActions();
        };
        bindAccountActions();
    } catch (error) {
        if (currentPage === 'akun') $('#pageContent').innerHTML = heading('ADMINISTRASI', 'Pengelolaan akun', 'Gagal memuat akun.') + `<div class="empty-state error">${esc(error.message)}</div>`;
    }
}
function accountStatusLabel(status) {
    return { PENDING: 'Menunggu', AKTIF: 'Aktif', NONAKTIF: 'Nonaktif' }[status] || status;
}
function renderAccountRows(accounts) {
    return accounts.map(account => {
        const isAdmin = account.role === 'ADMIN';
        const statusClass = account.status === 'AKTIF' ? 'status-selesai' : 'status-belum';
        return `<tr><td><b>${esc(account.name)}</b><small class="table-secondary">${esc(account.email || '')}</small></td><td>${esc(account.role)}</td><td>${esc(account.identityNumber)}</td><td>${esc(account.detail)}</td><td><span class="status ${statusClass}">${esc(accountStatusLabel(account.status))}</span></td><td>${isAdmin ? '<span class="muted">Dilindungi</span>' : `<button class="text-action" data-account-status="${esc(account.id)}">${account.status === 'AKTIF' ? 'Nonaktifkan' : 'Aktifkan'}</button><button class="text-action" data-account-reset="${esc(account.id)}">Reset sandi</button><button class="text-action text-danger" data-account-delete="${esc(account.id)}" data-account-name="${esc(account.name)}">Hapus</button>`}</td></tr>`;
    }).join('') || '<tr><td colspan="6">Tidak ada akun yang cocok.</td></tr>';
}
function bindAccountActions() {
    $$('[data-account-status]').forEach(button => button.onclick = async () => {
        const account = adminAccounts.find(item => item.id === button.dataset.accountStatus);
        if (!account) return;
        button.disabled = true;
        try {
            await api(`/api/admin/accounts/${encodeURIComponent(account.id)}/status`, { method: 'PATCH', body: JSON.stringify({ status: account.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF' }) });
            toast('Status akun diperbarui.');
            await renderAdminAccounts();
        } catch (error) {
            button.disabled = false;
            toast(error.message);
        }
    });
    $$('[data-account-reset]').forEach(button => button.onclick = async () => {
        const account = adminAccounts.find(item => item.id === button.dataset.accountReset);
        if (!account || !confirm(`Reset kata sandi akun ${account.name}?`)) return;
        button.disabled = true;
        try {
            const result = await api(`/api/admin/accounts/${encodeURIComponent(account.id)}/password`, { method: 'PATCH', body: '{}' });
            alert(`Kata sandi sementara untuk ${account.name}:\n\n${result.temporaryPassword}\n\nBerikan secara langsung dan minta pengguna segera menggantinya.`);
            toast('Kata sandi sementara dibuat.');
        } catch (error) {
            button.disabled = false;
            toast(error.message);
        }
    });
    $$('[data-account-delete]').forEach(button => button.onclick = async () => {
        const account = adminAccounts.find(item => item.id === button.dataset.accountDelete);
        if (!account || !confirm(`Hapus akun ${account.name}? Data akademik dan berkas terkait juga akan dihapus.`)) return;
        button.disabled = true;
        try {
            const result = await api(`/api/admin/accounts/${encodeURIComponent(account.id)}`, { method: 'DELETE' });
            toast(result.message || 'Akun dihapus.');
            await renderAdminAccounts();
        } catch (error) {
            button.disabled = false;
            toast(error.message);
        }
    });
}
function renderCalendar() {
    let events = JSON.parse(localStorage.getItem('sh_calendar') || 'null') || [{ title: 'Ujian Tengah Semester', start: '2026-11-02', end: '2026-11-07', type: 'Ujian' }, { title: 'Hari Guru Nasional', start: '2026-11-25', end: '2026-11-25', type: 'Efektif' }]; $('#pageContent').innerHTML = heading('AGENDA SEKOLAH', 'Kalender sekolah', 'Hari efektif, libur, dan agenda akademik.') + `<section class="card"><div class="card-title"><h3>Tambah agenda</h3><small>TERLIHAT OLEH WARGA SEKOLAH</small></div><form id="calendarForm" class="calendar-form"><input id="eventTitle" class="field" required maxlength="120" placeholder="Nama agenda"><select id="eventType" class="field"><option>Libur</option><option>Efektif</option><option>Ujian</option></select><input id="eventStart" class="field" type="date" required><input id="eventEnd" class="field" type="date" required><button class="btn btn-primary">Simpan agenda</button></form></section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Agenda mendatang</h3><small>${events.length} AGENDA</small></div><div class="table-wrap"><table><thead><tr><th>Agenda</th><th>Jenis</th><th>Mulai</th><th>Selesai</th><th></th></tr></thead><tbody>${events.sort((a, b) => a.start.localeCompare(b.start)).map((event, index) => `<tr><td><b>${esc(event.title)}</b></td><td>${esc(event.type)}</td><td>${prettyDate(event.start)}</td><td>${prettyDate(event.end)}</td><td><button class="text-action" data-event-delete="${index}">Hapus</button></td></tr>`).join('')}</tbody></table></div></section>`;
    $('#calendarForm').onsubmit = e => { e.preventDefault(); if ($('#eventEnd').value < $('#eventStart').value) return toast('Tanggal selesai harus setelah tanggal mulai.'); events.push({ title: $('#eventTitle').value.trim(), type: $('#eventType').value, start: $('#eventStart').value, end: $('#eventEnd').value }); localStorage.setItem('sh_calendar', JSON.stringify(events)); renderCalendar(); toast('Agenda sekolah ditambahkan.') }; $$('[data-event-delete]').forEach(btn => btn.onclick = () => { events.splice(Number(btn.dataset.eventDelete), 1); localStorage.setItem('sh_calendar', JSON.stringify(events)); renderCalendar() })
}
function renderAttendanceSettings() {
    $('#pageContent').innerHTML = heading('PENGATURAN SEKOLAH', 'Aturan kehadiran', 'Tetapkan jam absen dan titik acuan sekolah.') + `
        <form id="attendanceSettingsForm" class="card settings-form">
            <div class="settings-grid">
                <label>Koordinat lintang<input class="field" id="settingLatitude" type="number" min="-90" max="90" step="any" value="${esc(schoolSettings.latitude)}" required></label>
                <label>Koordinat bujur<input class="field" id="settingLongitude" type="number" min="-180" max="180" step="any" value="${esc(schoolSettings.longitude)}" required></label>
                <label>Radius absen (meter)<input class="field" id="settingRadius" type="number" min="30" max="500" value="${schoolSettings.radius}" required></label>
                <label>Jam mulai<input class="field" id="settingOpen" type="time" value="${schoolSettings.open}" required></label>
                <label>Batas terlambat<input class="field" id="settingLate" type="time" value="${schoolSettings.late}" required></label>
                <label>Batas koreksi<input class="field" id="settingCutoff" type="time" value="${schoolSettings.cutoff}" required></label>
                <label>Batas alpha per bulan<input class="field" id="settingAlpha" type="number" min="1" max="31" value="${schoolSettings.alpha}" required></label>
            </div>
            <div class="side-note">
                <h4>Lokasi sekolah</h4>
                <p>Koordinat, radius, dan jam absen disimpan di database server. Batas alpha tetap tersimpan di browser admin.</p>
            </div>
            <p id="attendanceSettingsMessage" class="hint" role="status"></p>
            <button class="btn btn-primary" type="submit">Simpan pengaturan</button>
        </form>
    `;

    const form = $('#attendanceSettingsForm');
    const submitButton = form.querySelector('button[type="submit"]');
    const message = $('#attendanceSettingsMessage');
    form.onsubmit = async event => {
        event.preventDefault();
        const payload = {
            latitude: Number($('#settingLatitude').value),
            longitude: Number($('#settingLongitude').value),
            radiusMeters: Number($('#settingRadius').value),
            openTime: $('#settingOpen').value,
            closeTime: $('#settingCutoff').value,
            lateAfter: $('#settingLate').value
        };
        submitButton.disabled = true;
        submitButton.textContent = 'Menyimpan...';
        message.textContent = '';
        message.classList.remove('error');
        try {
            await api('/api/admin/attendance/settings', { method: 'PUT', body: JSON.stringify(payload) });
            schoolSettings = {
                ...schoolSettings,
                latitude: String(payload.latitude),
                longitude: String(payload.longitude),
                radius: payload.radiusMeters,
                open: payload.openTime,
                late: payload.lateAfter,
                cutoff: payload.closeTime,
                close: payload.closeTime,
                alpha: Number($('#settingAlpha').value)
            };
            persistAdminData();
            message.textContent = 'Pengaturan lokasi dan jam absen tersimpan di server.';
            toast('Aturan kehadiran tersimpan di database.');
            renderAttendanceSettings();
        } catch (error) {
            message.textContent = error.message;
            message.classList.add('error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Simpan pengaturan';
        }
    };
}
function renderReminders() { let missing = attendance.filter(item => !['Hadir', 'Terlambat', 'Izin', 'Sakit'].includes(item.status)); $('#pageContent').innerHTML = heading('TINDAK LANJUT', 'Pengingat kehadiran', 'Kirim pengingat aplikasi kepada warga yang belum mengisi kehadiran.') + `<section class="card"><div class="card-title"><h3>Belum mengisi kehadiran</h3><span class="status status-belum">${missing.length} warga</span></div><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead><tbody>${missing.map(item => `<tr><td><b>${esc(item.name)}</b></td><td>${esc(item.kelas)}</td><td>Belum absen</td></tr>`).join('') || '<tr><td colspan="3">Semua warga sudah mengisi kehadiran.</td></tr>'}</tbody></table></div><button class="btn btn-primary" id="sendReminders" style="margin-top:18px" ${missing.length ? '' : 'disabled'}>Kirim pengingat aplikasi</button><p class="hint">Pengiriman demo hanya membuat notifikasi lokal, tidak mengirim email atau WhatsApp.</p></section>`; $('#sendReminders').onclick = () => { missing.forEach(item => notifications.unshift({ id: Date.now() + Math.random(), title: 'Pengingat kehadiran', message: `Silakan isi kehadiran hari ini, ${item.name}.`, time: Date.now(), read: false })); localStorage.setItem('sh_notifications', JSON.stringify(notifications)); updateNotificationBadge(); toast(`Pengingat demo dibuat untuk ${missing.length} warga.`) } }
function renderIdentityRequests() {
    let waiting = identityRequests.filter(item => item.status === 'Menunggu'), history = identityRequests.filter(item => item.status !== 'Menunggu'); $('#pageContent').innerHTML = heading('PRIVASI & KEAMANAN', 'Permintaan buka identitas', 'Setiap persetujuan pada versi produksi harus dilakukan admin lain dan tercatat dalam audit log.') + `<section class="card"><div class="card-title"><h3>Ajukan permintaan</h3><small>ALASAN MIN. 20 KARAKTER</small></div><form id="unlockRequestForm" class="unlock-form"><select id="unlockPost" class="field">${topics.map(topic => `<option value="${topic.id}">${esc(topic.title)}</option>`).join('')}</select><textarea id="unlockReason" class="field" required minlength="20" maxlength="500" rows="3" placeholder="Jelaskan alasan kebutuhan peninjauan..."></textarea><button class="btn btn-primary">Ajukan untuk ditinjau</button></form></section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Menunggu keputusan</h3><small>${waiting.length} PERMINTAAN</small></div>${waiting.map(request => `<article class="unlock-item"><div><b>${esc(request.post)}</b><p>${esc(request.reason)}</p><small>Diajukan ${ago(request.date)}</small></div><div><button class="btn btn-outline" data-unlock-decision="${request.id}" data-decision="Ditolak">Tolak</button><button class="btn btn-primary" data-unlock-decision="${request.id}" data-decision="Disetujui">Setujui</button></div></article>`).join('') || '<div class="empty-state">Tidak ada permintaan yang menunggu.</div>'}</section><section class="card" style="margin-top:18px"><div class="card-title"><h3>Riwayat keputusan</h3><small>${history.length} KEPUTUSAN</small></div>${history.map(request => `<div class="history-row"><span class="history-check">${request.status === 'Disetujui' ? '✓' : '×'}</span><span><b>${esc(request.post)}</b><small>${esc(request.status)} · ${ago(request.date)}</small></span></div>`).join('') || '<div class="empty-state">Riwayat masih kosong.</div>'}</section>`;
    $('#unlockRequestForm').onsubmit = e => { e.preventDefault(); let reason = $('#unlockReason').value.trim(); if (reason.length < 20) return toast('Alasan harus minimal 20 karakter.'); let topic = topics.find(item => item.id === $('#unlockPost').value); identityRequests.unshift({ id: Date.now(), post: topic?.title || 'Topik sekolah', reason, status: 'Menunggu', date: Date.now() }); persistAdminData(); renderIdentityRequests(); toast('Permintaan dicatat untuk peninjauan admin lain.') }; $$('[data-unlock-decision]').forEach(btn => btn.onclick = () => { let request = identityRequests.find(item => item.id == btn.dataset.unlockDecision); request.status = btn.dataset.decision; request.date = Date.now(); persistAdminData(); renderIdentityRequests(); toast(`Permintaan ${request.status.toLowerCase()}. Akses demo berlaku 24 jam.`) })
}
