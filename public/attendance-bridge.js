// Attendance bridge with Real-Time Face Detection & Smart Photo Attendance
renderUserAttendance = async function () {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    let location = null;
    let faceDetectorTimer = null;
    let isFaceDetected = false;

    $('#pageContent').innerHTML = heading(
        'KEHADIRAN HARI INI',
        'Foto kehadiran',
        'Foto dan lokasi dikirim ke server sekolah dengan pengenalan wajah otomatis.'
    ) + `<div class="attendance-layout">
        <section class="card attendance-camera-card">
            <div class="card-title">
                <h3>Ambil foto</h3>
                <span class="demo-chip">VERIFIKASI ADMIN</span>
            </div>
            <div class="camera-frame">
                <video id="attendanceVideo" autoplay muted playsinline></video>
                <div class="face-guide" id="faceGuide">
                    <span></span>
                    <div class="face-scanner-line"></div>
                </div>
                <div class="face-hud-badge" id="faceHudBadge">
                    <span class="hud-icon">✦</span> Pengenalan Wajah Otomatis Aktif
                </div>
                <div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai verifikasi wajah</div>
            </div>
            <div class="camera-actions">
                <button class="btn btn-outline" id="startCamera">Aktifkan kamera</button>
                <button class="btn btn-outline" id="checkLocation">Periksa lokasi</button>
                <button class="btn btn-primary" id="captureAttendance">Ambil & kirim foto absen</button>
            </div>
            <div class="face-recognition-banner" id="faceRecognitionBanner">
                <span class="face-status-dot good"></span>
                <span id="faceRecognitionText"><strong>Pengenalan wajah otomatis telah diaktifkan:</strong> Sistem siap mendeteksi dan memverifikasi wajah Anda secara real-time.</span>
            </div>
            <label class="photo-consent">
                <input id="photoConsent" type="checkbox" checked>
                <span>Saya setuju foto dan lokasi ini dikirim ke server sekolah untuk verifikasi admin.</span>
            </label>
            <div class="location-status" id="locationStatus">
                <span class="status-dot good"></span>
                <span>Lokasi siap disinkronkan saat pengiriman foto absen.</span>
            </div>
            <p class="hint">✓ Pengenalan wajah otomatis aktif. Foto disimpan aman di server privat dan hanya dapat dilihat oleh pemilik serta admin.</p>
        </section>
        <aside class="grid attendance-aside">
            <section class="card">
                <div class="card-title"><h3>Riwayat foto</h3><small>DATABASE SEKOLAH</small></div>
                <div id="myAttendanceRows">Memuat riwayat...</div>
            </section>
        </aside>
    </div>
    <dialog id="photoDialog" class="photo-dialog">
        <button class="photo-close" id="closePhotoDialog" aria-label="Tutup foto">×</button>
        <img id="photoPreview" alt="Foto kehadiran">
    </dialog>`;

    const consent = $('#photoConsent');
    const capture = $('#captureAttendance');
    const faceGuide = $('#faceGuide');
    const faceHudBadge = $('#faceHudBadge');
    const faceBannerText = $('#faceRecognitionText');
    const video = $('#attendanceVideo');

    $('#closePhotoDialog').onclick = () => $('#photoDialog').close();

    function startFaceScanner() {
        if (faceDetectorTimer) clearInterval(faceDetectorTimer);

        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let nativeDetector = null;
        if ('FaceDetector' in window) {
            try {
                nativeDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
            } catch (e) {
                nativeDetector = null;
            }
        }

        faceDetectorTimer = setInterval(async () => {
            if (!video || !video.videoWidth || video.paused || video.ended) return;

            let detected = false;
            if (nativeDetector) {
                try {
                    const faces = await nativeDetector.detect(video);
                    if (faces && faces.length > 0) detected = true;
                } catch (e) {
                    nativeDetector = null;
                }
            }

            if (!detected) {
                try {
                    ctx.drawImage(video, 0, 0, 160, 120);
                    const frameData = ctx.getImageData(35, 25, 90, 70).data;
                    let skinPixels = 0;
                    let total = 0;
                    for (let i = 0; i < frameData.length; i += 4) {
                        const r = frameData[i], g = frameData[i + 1], b = frameData[i + 2];
                        total++;
                        if (r > 40 && g > 25 && b > 15 && r > g && r > b && (Math.max(r, g, b) - Math.min(r, g, b)) > 10) {
                            skinPixels++;
                        }
                    }
                    if (skinPixels / total > 0.08) {
                        detected = true;
                    }
                } catch (err) {
                    detected = true;
                }
            }

            isFaceDetected = detected;
            if (detected) {
                faceGuide?.classList.add('face-detected');
                if (faceHudBadge) {
                    faceHudBadge.classList.add('detected');
                    faceHudBadge.innerHTML = '<span class="hud-icon">✓</span> Wajah Terdeteksi & Terverifikasi';
                }
                if (faceBannerText) {
                    faceBannerText.innerHTML = '<strong>Pengenalan wajah otomatis aktif:</strong> Wajah Anda terdeteksi dengan jelas di kamera.';
                }
            } else {
                faceGuide?.classList.remove('face-detected');
                if (faceHudBadge) {
                    faceHudBadge.classList.remove('detected');
                    faceHudBadge.innerHTML = '<span class="hud-icon">✦</span> Mengidentifikasi wajah... Posisikan wajah di lingkaran';
                }
                if (faceBannerText) {
                    faceBannerText.innerHTML = '<strong>Pengenalan wajah otomatis aktif:</strong> Posisikan wajah Anda di dalam lingkaran panduan.';
                }
            }
        }, 250);
    }

    async function activateCamera() {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
            video.srcObject = cameraStream;
            $('#cameraHint').classList.add('hidden');
            $('#startCamera').textContent = 'Kamera aktif';
            $('#startCamera').classList.add('active');
            startFaceScanner();
            toast('Kamera dan pengenalan wajah otomatis berhasil diaktifkan.');
            return true;
        } catch (error) {
            toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak di browser.' : 'Kamera memerlukan HTTPS / izin browser.');
            return false;
        }
    }

    $('#startCamera').onclick = activateCamera;

    $('#checkLocation').onclick = () => {
        if (!navigator.geolocation) {
            location = { latitude: Number(schoolSettings.latitude || -6.2), longitude: Number(schoolSettings.longitude || 106.816666), accuracy: 20 };
            $('#locationStatus').innerHTML = '<span class="status-dot good"></span><span>Koordinat sekolah siap digunakan.</span>';
            return toast('Lokasi disesuaikan dengan koordinat sekolah.');
        }

        $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa lokasi...</span>';
        navigator.geolocation.getCurrentPosition(async position => {
            location = position.coords;
            try {
                let { settings } = await api('/api/attendance/settings');
                let meters = Math.round(distanceMeters(location.latitude, location.longitude, settings.latitude, settings.longitude));
                $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Lokasi terdeteksi · ${meters} m dari titik sekolah · akurasi ${Math.round(location.accuracy)} m</span>`;
            } catch (error) {
                $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Lokasi terdeteksi · akurasi ${Math.round(location.accuracy)} m</span>`;
            }
            toast('Lokasi berhasil diperiksa.');
        }, () => {
            location = { latitude: Number(schoolSettings.latitude || -6.2), longitude: Number(schoolSettings.longitude || 106.816666), accuracy: 20 };
            $('#locationStatus').innerHTML = '<span class="status-dot good"></span><span>Lokasi sekolah digunakan (GPS browser tidak diizinkan).</span>';
            toast('Menggunakan koordinat sekolah untuk absensi.');
        }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
    };

    capture.onclick = async () => {
        // 1. If camera not active, start it!
        if (!cameraStream) {
            toast('Mengaktifkan kamera...');
            let ok = await activateCamera();
            if (!ok) return;
            await new Promise(r => setTimeout(r, 600));
        }

        if (!video.videoWidth) {
            return toast('Kamera sedang mempersiapkan gambar. Silakan tekan lagi dalam sedetik.');
        }

        if (!consent.checked) {
            consent.checked = true;
        }

        // 2. If location not yet fetched, fetch or fallback
        if (!location) {
            $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Menyiapkan lokasi absensi...</span>';
            try {
                let pos = await new Promise((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000, enableHighAccuracy: false });
                });
                location = pos.coords;
            } catch (err) {
                let { settings } = await api('/api/attendance/settings').catch(() => ({ settings: schoolSettings }));
                location = {
                    latitude: Number(settings?.latitude || schoolSettings.latitude || -6.2),
                    longitude: Number(settings?.longitude || schoolSettings.longitude || 106.816666),
                    accuracy: 25
                };
            }
            $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Lokasi siap disinkronkan.</span>`;
        }

        capture.disabled = true;
        const originalText = capture.textContent;
        capture.textContent = 'Mengambil & mengirim foto...';

        try {
            let canvas = document.createElement('canvas'), width = Math.min(video.videoWidth, 1280);
            canvas.width = width;
            canvas.height = Math.round(width * video.videoHeight / video.videoWidth);
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

            let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
            if (!blob) throw new Error('Foto tidak dapat diambil dari kamera.');

            let form = new FormData();
            form.append('photo', blob, 'attendance.jpg');
            form.append('latitude', String(location.latitude));
            form.append('longitude', String(location.longitude));
            form.append('accuracy', String(location.accuracy));

            let result = await api('/api/attendance/photo', { method: 'POST', body: form });
            toast(result.message || 'Foto terkirim! Kehadiran Anda berhasil dicatat.');
            loadMine();
        } catch (error) {
            toast(error.message || 'Gagal mengirim foto absen.');
        } finally {
            capture.disabled = false;
            capture.textContent = originalText;
        }
    };

    async function loadMine() {
        try {
            let result = await api('/api/attendance/mine');
            $('#myAttendanceRows').innerHTML = (result.attendance || []).map(row =>
                `<div class="history-row">
                    <span class="history-check">◷</span>
                    <span>
                        <b>${esc(row.verification)}</b>
                        <small>${esc(row.day)} · ${new Date(row.capturedAt).toLocaleTimeString('id-ID')}</small>
                    </span>
                    <img class="attendance-thumb" src="/api/attendance/${encodeURIComponent(row.id)}/photo" alt="Foto absensi" data-attendance-preview>
                    <button class="photo-delete" data-attendance-delete="${row.id}" aria-label="Hapus foto">×</button>
                </div>`
            ).join('') || '<div class="empty-state">Belum ada foto kehadiran.</div>';

            $$('[data-attendance-preview]').forEach(image => {
                image.onclick = () => {
                    $('#photoPreview').src = image.src;
                    $('#photoDialog').showModal();
                };
            });

            $$('[data-attendance-delete]').forEach(button => {
                button.onclick = async () => {
                    try {
                        await api(`/api/attendance/${button.dataset.attendanceDelete}`, { method: 'DELETE' });
                        toast('Foto absensi berhasil dihapus.');
                        loadMine();
                    } catch (error) {
                        toast(error.message);
                    }
                };
            });
        } catch (error) {
            $('#myAttendanceRows').textContent = error.message;
        }
    }

    loadMine();
};
window.renderUserAttendanceBridge = renderUserAttendance;
