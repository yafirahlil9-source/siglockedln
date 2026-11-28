// Attendance bridge with Biometric Face Recognition & Identity Verification (Dark Theme)
renderUserAttendance = async function () {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    let location = null;
    let faceDetectorTimer = null;
    let isFaceInGuide = false;
    let latestFaceDescriptor = null;
    let currentGuideReason = 'Posisikan wajah Anda di dalam lingkaran panduan.';
    let isScannerRunning = false;
    let userFaceData = { hasFace: false, name: currentUser ? currentUser.name : '' };

    // Ambil data biometrik wajah terdaftar dari server
    if (window.SigFace) {
        try {
            userFaceData = await window.SigFace.getRegisteredFace();
        } catch (_) {}
    }
    const hasRegisteredFace = Boolean(userFaceData.hasFace);
    const accountOwnerName = userFaceData.name || (currentUser ? currentUser.name : 'Pengguna');

    $('#pageContent').innerHTML = heading(
        'KEHADIRAN HARI INI',
        'Absensi wajah',
        'Lakukan pemeriksaan awal wajah dan lokasi di perangkat. Foto kehadiran tetap diperiksa admin sebelum disetujui.'
    ) + `<div class="attendance-layout">
        <section class="card attendance-camera-card">
            <div class="card-title">
                <h3>Ambil foto kehadiran</h3>
                <span class="demo-chip" style="background:var(--green2);color:var(--emerald)">${hasRegisteredFace ? 'PEMERIKSAAN AWAL AKTIF' : 'WAJAH BELUM TERDAFTAR'}</span>
            </div>

            ${!hasRegisteredFace ? `
                <div class="face-recognition-banner" style="background:rgba(244,63,94,0.12);border-color:rgba(244,63,94,0.35);color:#fda4af;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:10px;flex:1">
                        <span class="face-status-dot" style="background:#f43f5e"></span>
                        <span><strong>Perhatian:</strong> Wajah Anda belum didaftarkan di sistem. Anda harus mendaftarkan wajah Anda terlebih dahulu agar sistem dapat mengenali Anda saat absen.</span>
                    </div>
                    <button class="btn btn-primary" id="directEnrollBtn" type="button" style="padding:6px 14px;font-size:12px;white-space:nowrap">
                        ✦ Daftarkan Wajah Sekarang
                    </button>
                </div>
            ` : ''}

            <div class="camera-frame">
                <video id="attendanceVideo" autoplay muted playsinline></video>
                <div class="face-guide" id="faceGuide">
                    <span></span>
                    <div class="face-scanner-line"></div>
                </div>
                <div class="face-hud-badge" id="faceHudBadge">
                    <span class="hud-icon">✦</span> Arahkan wajah ke dalam lingkaran
                </div>
                <div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai verifikasi wajah akun</div>
            </div>

            <div class="camera-actions">
                <button class="btn btn-outline" id="startCamera">Aktifkan kamera</button>
                <button class="btn btn-outline" id="checkLocation">Periksa lokasi</button>
                <button class="btn btn-primary locked" id="captureAttendance" title="${hasRegisteredFace ? 'Pemeriksaan awal wajah dan persetujuan data diperlukan sebelum mengirim foto' : 'Daftarkan wajah Anda terlebih dahulu'}">
                    ${hasRegisteredFace ? 'Posisikan wajah di lingkaran...' : 'Daftarkan wajah terlebih dahulu...'}
                </button>
            </div>

            <div class="face-recognition-banner" id="faceRecognitionBanner">
                <span class="face-status-dot ${hasRegisteredFace ? 'good' : 'warning'}"></span>
                <span id="faceRecognitionText">
                    ${hasRegisteredFace
                        ? `<strong>Pemeriksaan awal biometrik aktif:</strong> Sistem akan membandingkan wajah di kamera dengan data akun <strong>${esc(accountOwnerName)}</strong>. Admin tetap memeriksa foto sebelum kehadiran disetujui.`
                        : `<strong>Wajah belum terdaftar:</strong> Silakan klik "Daftarkan Wajah Sekarang" di atas agar pemeriksaan awal dapat dilakukan.`
                    }
                </span>
            </div>

            <label class="photo-consent">
                <input id="photoConsent" type="checkbox">
                <span>Saya setuju foto kehadiran, hasil pemeriksaan awal wajah, dan koordinat lokasi disimpan untuk pencatatan serta verifikasi admin sekolah.</span>
            </label>

            <div class="location-status" id="locationStatus">
                <span class="status-dot"></span>
                <span>Lokasi GPS akan diverifikasi ulang saat foto absen dikirim.</span>
            </div>

            <p class="hint">Pemeriksaan wajah berjalan di perangkat sebagai pemeriksaan awal, bukan jaminan anti-titip absen. Foto akan berstatus menunggu sampai diperiksa admin.</p>
        </section>

        <aside class="grid attendance-aside">
            ${geofenceCardHtml(true)}
            <section class="card">
                <div class="card-title"><h3>Riwayat foto</h3><small>MENUNGGU / DIPERIKSA ADMIN</small></div>
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

    function updateCaptureState() {
        if (!capture?.isConnected) return;
        if (consent.checked && isFaceInGuide && latestFaceDescriptor && hasRegisteredFace) {
            capture.className = 'btn btn-primary';
            capture.textContent = '✓ Kirim foto untuk diperiksa admin';
        } else {
            capture.className = 'btn btn-primary locked';
            capture.textContent = consent.checked ? 'Posisikan wajah di lingkaran...' : 'Setujui penyimpanan data terlebih dahulu...';
        }
    }
    consent.onchange = updateCaptureState;
    updateCaptureState();

    $('#closePhotoDialog').onclick = () => $('#photoDialog').close();

    // Tombol pendaftaran wajah instan jika belum daftar
    const directEnrollBtn = $('#directEnrollBtn');
    if (directEnrollBtn) {
        directEnrollBtn.onclick = () => {
            if (window.SigFace) {
                window.SigFace.openEnrollmentModal({
                    onSuccess: () => renderUserAttendance()
                });
            }
        };
    }

    // Memulai pemindai wajah real-time
    function startFaceScanner() {
        if (faceDetectorTimer) clearInterval(faceDetectorTimer);

        faceDetectorTimer = setInterval(async () => {
            if (!video || !document.body.contains(video)) {
                clearInterval(faceDetectorTimer);
                faceDetectorTimer = null;
                return;
            }
            if (!video.videoWidth || video.paused || video.ended) return;
            if (isScannerRunning) return;
            isScannerRunning = true;

            try {
                if (!window.SigFace) return;
                const detection = await window.SigFace.detectFace(video);

                if (detection) {
                    const box = detection.detection.box;
                    const evalRes = window.SigFace.evaluateFaceInGuide(box, video, faceGuide);

                    if (evalRes.inCircle) {
                        isFaceInGuide = true;

                        if (!hasRegisteredFace) {
                            latestFaceDescriptor = null;
                            faceGuide.className = 'face-guide face-warning';
                            if (faceHudBadge) {
                                faceHudBadge.className = 'face-hud-badge warning';
                                faceHudBadge.innerHTML = '<span class="hud-icon">⚠</span> Wajah Belum Didaftarkan';
                            }
                            if (faceBannerText) {
                                faceBannerText.innerHTML = '<strong>Wajah belum terdaftar:</strong> Harap daftarkan wajah Anda terlebih dahulu dengan mengklik tombol "Daftarkan Wajah Sekarang".';
                            }
                            if (capture) {
                                capture.className = 'btn btn-primary locked';
                                capture.textContent = 'Daftarkan wajah terlebih dahulu...';
                            }
                        } else {
                            latestFaceDescriptor = Array.from(detection.descriptor);
                            faceGuide.className = 'face-guide face-detected';
                            if (faceHudBadge) {
                                faceHudBadge.className = 'face-hud-badge detected';
                                faceHudBadge.innerHTML = '<span class="hud-icon">✓</span> Wajah terdeteksi dalam panduan';
                            }
                            if (faceBannerText) {
                                faceBannerText.innerHTML = '<strong>Wajah terdeteksi:</strong> Pemeriksaan awal terhadap data akun dilakukan saat foto dikirim. Admin tetap memeriksa foto kehadiran.';
                            }
                            updateCaptureState();
                        }
                    } else {
                        isFaceInGuide = false;
                        latestFaceDescriptor = null;
                        currentGuideReason = evalRes.reason;
                        faceGuide.className = 'face-guide face-warning';
                        if (faceHudBadge) {
                            faceHudBadge.className = 'face-hud-badge warning';
                            faceHudBadge.innerHTML = `<span class="hud-icon">⚠</span> ${evalRes.reason}`;
                        }
                        if (faceBannerText) {
                            faceBannerText.innerHTML = `<strong>Posisikan wajah:</strong> ${evalRes.reason} agar pemeriksaan awal dapat dilakukan.`;
                        }
                        if (capture) {
                            capture.className = 'btn btn-primary locked';
                            capture.textContent = evalRes.reason + '...';
                        }
                    }
                } else {
                    isFaceInGuide = false;
                    latestFaceDescriptor = null;
                    currentGuideReason = 'Wajah tidak terdeteksi di dalam lingkaran';
                    faceGuide.className = 'face-guide';
                    if (faceHudBadge) {
                        faceHudBadge.className = 'face-hud-badge';
                        faceHudBadge.innerHTML = '<span class="hud-icon">✦</span> Arahkan wajah ke dalam lingkaran';
                    }
                    if (faceBannerText) {
                        faceBannerText.innerHTML = `<strong>Pengenalan biometrik aktif:</strong> Posisikan wajah Anda tepat di dalam lingkaran panduan untuk diverifikasi sebagai <strong>${esc(accountOwnerName)}</strong>.`;
                    }
                    if (capture) {
                        capture.className = 'btn btn-primary locked';
                        capture.textContent = 'Posisikan wajah di lingkaran...';
                    }
                }
            } catch (scanErr) {
                console.error('Scan tick error:', scanErr);
            } finally {
                isScannerRunning = false;
            }
        }, 220);
    }

    async function activateCamera() {
        try {
            if (window.SigFace) {
                $('#faceHudBadge').innerHTML = '<span class="hud-icon">⏳</span> Memuat modul AI biometrik...';
                await window.SigFace.ensureModelsLoaded();
            }
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            video.srcObject = cameraStream;
            $('#cameraHint').classList.add('hidden');
            $('#startCamera').textContent = 'Kamera aktif';
            $('#startCamera').classList.add('active');
            startFaceScanner();
            toast('Kamera dan pemindai biometrik wajah berhasil diaktifkan.');
            return true;
        } catch (error) {
            toast(error.name === 'NotAllowedError' ? 'Izin kamera ditolak di browser.' : 'Kamera memerlukan izin browser.');
            return false;
        }
    }

    $('#startCamera').onclick = activateCamera;

    async function verifySchoolLocation() {
        location = null;
        if (!navigator.geolocation) throw new Error('Browser ini tidak mendukung lokasi GPS.');
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, error => {
                reject(new Error(error.code === 1
                    ? 'Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.'
                    : 'Lokasi GPS tidak dapat dibaca. Pastikan GPS aktif dan coba lagi.'));
            }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
        });
        const { settings } = await api('/api/attendance/settings');
        const meters = Math.round(distanceMeters(position.coords.latitude, position.coords.longitude, settings.latitude, settings.longitude));
        if (position.coords.accuracy > 100) throw new Error(`Akurasi GPS terlalu rendah (${Math.round(position.coords.accuracy)} meter).`);
        if (meters + position.coords.accuracy > Number(settings.radiusMeters)) throw new Error(`Di luar radius sekolah (${meters} meter + akurasi ${Math.round(position.coords.accuracy)} meter).`);
        location = position.coords;
        return { meters, accuracy: Math.round(position.coords.accuracy) };
    }

    $('#checkLocation').onclick = async () => {
        $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa lokasi...</span>';
        try {
            const result = await verifySchoolLocation();
            $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Dalam radius sekolah · ${result.meters} m · akurasi ${result.accuracy} m</span>`;
            toast('Lokasi berada di dalam radius sekolah.');
        } catch (error) {
            location = null;
            $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Lokasi belum valid untuk absensi.</span>';
            toast(error.message);
        }
    };

    capture.onclick = async () => {
        // 1. Cek pendaftaran wajah
        if (!hasRegisteredFace) {
            toast('⚠️ Anda belum mendaftarkan wajah di sistem! Harap daftarkan wajah terlebih dahulu.');
            if (window.SigFace) {
                window.SigFace.openEnrollmentModal({
                    onSuccess: () => renderUserAttendance()
                });
            }
            return;
        }

        // 2. Aktifkan kamera jika belum
        if (!cameraStream) {
            toast('Mengaktifkan kamera untuk verifikasi wajah...');
            let ok = await activateCamera();
            if (!ok) return;
            await new Promise(r => setTimeout(r, 600));
        }

        if (!video.videoWidth) {
            return toast('Kamera sedang mempersiapkan gambar. Silakan tunggu beberapa detik.');
        }

        // 3. PENGECEKAN KETAT 1: WAJAH HARUS DI DALAM LINGKARAN
        if (!isFaceInGuide) {
            faceGuide?.classList.remove('face-detected', 'face-warning');
            faceGuide?.classList.add('face-error');
            setTimeout(() => {
                faceGuide?.classList.remove('face-error');
                if (faceGuide && !isFaceInGuide) faceGuide.classList.add('face-warning');
            }, 650);
            const reason = currentGuideReason || 'Wajah tidak terdeteksi di dalam lingkaran';
            return toast(`⚠️ Absen ditolak! ${reason}. Absensi hanya bisa dilakukan jika wajah berada tepat di dalam lingkaran panduan.`);
        }

        // 4. PENGECEKAN KETAT 2: WAJAH HARUS COCOK DENGAN PEMILIK AKUN
        if (!latestFaceDescriptor) {
            faceGuide?.classList.remove('face-detected', 'face-warning');
            faceGuide?.classList.add('face-error');
            setTimeout(() => { faceGuide?.classList.remove('face-error'); }, 700);
            return toast('Wajah belum terdeteksi dengan jelas. Posisikan wajah di dalam lingkaran lalu coba lagi.');
        }

        if (!consent.checked) return toast('Persetujuan penyimpanan foto dan data kehadiran diperlukan.');

        // 5. Lokasi
        $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memverifikasi lokasi absensi...</span>';
        try {
            const verifiedLocation = await verifySchoolLocation();
            $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Lokasi terverifikasi · ${verifiedLocation.meters} m · akurasi ${verifiedLocation.accuracy} m</span>`;
        } catch (error) {
            location = null;
            $('#locationStatus').innerHTML = '<span class="status-dot warning"></span><span>Absen ditolak karena lokasi tidak valid.</span>';
            toast(error.message);
            return;
        }

        capture.disabled = true;
        const originalText = capture.textContent;
        capture.textContent = 'Mengirim foto untuk diperiksa admin...';

        try {
            const faceResult = await api('/api/profile/face/check', {
                method: 'POST',
                body: JSON.stringify({ descriptor: latestFaceDescriptor })
            });
            if (!faceResult.matched) throw new Error('Pemeriksaan awal wajah belum cocok dengan data akun.');

            let canvas = document.createElement('canvas'), width = Math.min(video.videoWidth, 1280);
            canvas.width = width;
            canvas.height = Math.round(width * video.videoHeight / video.videoWidth);
            let ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const boxW = Math.min(canvas.width - 32, 480);
            ctx.fillStyle = 'rgba(10, 20, 15, 0.72)';
            ctx.fillRect(16, canvas.height - 48, boxW, 34);
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 12.5px sans-serif';
            ctx.fillText(`✓ PEMERIKSAAN AWAL • ${accountOwnerName.toUpperCase()} • ${new Date().toLocaleTimeString('id-ID')}`, 26, canvas.height - 26);

            let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
            if (!blob) throw new Error('Foto tidak dapat diambil dari kamera.');

            let form = new FormData();
            form.append('photo', blob, 'attendance.jpg');
            form.append('latitude', String(location.latitude));
            form.append('longitude', String(location.longitude));
            form.append('accuracy', String(location.accuracy));
            form.append('faceDescriptor', JSON.stringify(latestFaceDescriptor));

            let result = await api('/api/attendance/photo', { method: 'POST', body: form });
            toast(result.message || 'Wajah terverifikasi biometrik! Kehadiran berhasil tercatat.');
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
            $('#myAttendanceRows').innerHTML = (result.attendance || []).map(row => {
                let isApproved = row.verification === 'DISETUJUI';
                let label = isApproved ? 'Disetujui Admin' : row.verification === 'MENUNGGU' ? 'Menunggu Admin' : esc(row.verification);
                let badgeStyle = isApproved ? 'style="background:var(--green2);color:var(--emerald)"' : '';
                return `<div class="history-row">
                    <span class="history-check" ${badgeStyle}>${isApproved ? '✓' : '◷'}</span>
                    <span>
                        <b>${label}</b>
                        <small>${esc(row.day)} · ${new Date(row.capturedAt).toLocaleTimeString('id-ID')}</small>
                    </span>
                    <img class="attendance-thumb" src="/api/attendance/${encodeURIComponent(row.id)}/photo" alt="Foto absensi" data-attendance-preview>
                    ${row.verification === 'MENUNGGU' ? `<button class="photo-delete" data-attendance-delete="${esc(row.id)}" aria-label="Hapus foto">×</button>` : ''}
                </div>`;
            }).join('') || '<div class="empty-state">Belum ada foto kehadiran.</div>';

            $$('[data-attendance-preview]').forEach(image => {
                image.onclick = () => {
                    $('#photoPreview').src = image.src;
                    $('#photoDialog').showModal();
                };
            });

            $$('[data-attendance-delete]').forEach(button => {
                button.onclick = async () => {
                    try {
                        await api(`/api/attendance/${encodeURIComponent(button.dataset.attendanceDelete)}`, { method: 'DELETE' });
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
