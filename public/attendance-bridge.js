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
                <span class="demo-chip" style="${hasRegisteredFace ? 'background:var(--green2);color:var(--emerald)' : 'background:rgba(244,63,94,0.15);color:var(--red)'}">
                    ${hasRegisteredFace ? 'WAJAH TERDAFTAR' : 'WAJAH BELUM TERDAFTAR'}
                </span>
            </div>

            ${!hasRegisteredFace ? `
                <div class="face-recognition-banner" style="background:rgba(244,63,94,0.14);border-color:rgba(244,63,94,0.4);color:#fda4af;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
                    <div style="display:flex;align-items:center;gap:10px;flex:1">
                        <span class="face-status-dot" style="background:#f43f5e"></span>
                        <span><strong>Wajah Belum Terdaftar:</strong> Anda tidak bisa melakukan absensi sebelum mendaftarkan wajah di sistem. Harap daftarkan wajah Anda terlebih dahulu agar sistem dapat mengenali Anda saat absen.</span>
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
                    <span class="hud-icon">✦</span> ${hasRegisteredFace ? 'Arahkan wajah ke dalam lingkaran' : 'Wajah Belum Terdaftar'}
                </div>
                <div id="cameraHint" class="camera-hint">Aktifkan kamera untuk memulai verifikasi wajah akun</div>
            </div>

            <div class="camera-actions">
                <button class="btn btn-outline" id="startCamera">Aktifkan kamera</button>
                <button class="btn btn-outline" id="checkLocation">Periksa lokasi</button>
                <button class="btn btn-primary locked" id="captureAttendance" title="${hasRegisteredFace ? 'Pemeriksaan awal wajah diperlukan sebelum mengirim absensi' : 'Daftarkan wajah Anda terlebih dahulu'}">
                    ${hasRegisteredFace ? 'Posisikan wajah di lingkaran...' : '✕ Wajah belum terdaftar (Daftar dulu)'}
                </button>
            </div>

            <div class="face-recognition-banner" id="faceRecognitionBanner">
                <span class="face-status-dot ${hasRegisteredFace ? 'good' : 'warning'}"></span>
                <span id="faceRecognitionText">
                    ${hasRegisteredFace
                        ? `<strong>Pemeriksaan biometrik aktif:</strong> Sistem akan memverifikasi kecocokan wajah di kamera dengan pemilik akun <strong>${esc(accountOwnerName)}</strong>. Wajah orang lain tidak dapat digunakan untuk absen.`
                        : `<strong style="color:var(--red)">Wajah belum terdaftar:</strong> Anda harus mendaftarkan wajah terlebih dahulu sebelum bisa absen. Silakan klik tombol "Daftarkan Wajah Sekarang" di atas.`
                    }
                </span>
            </div>

            <label class="photo-consent">
                <input id="photoConsent" type="checkbox" checked>
                <span>Saya setuju foto kehadiran, hasil verifikasi biometrik wajah, dan koordinat lokasi disimpan untuk pencatatan serta verifikasi admin sekolah.</span>
            </label>

            <div class="location-status" id="locationStatus">
                <span class="status-dot"></span>
                <span>Koordinat lokasi GPS sekolah akan diverifikasi saat tombol absen ditekan.</span>
            </div>

            <p class="hint">Pemeriksaan wajah berjalan secara biometrik untuk memastikan akun hanya diabsen oleh pemilik aslinya. Absensi di luar koordinat sekolah otomatis ditolak.</p>
        </section>

        <aside class="grid attendance-aside">
            <section class="card">
                <div class="card-title"><h3>Riwayat foto</h3><small>STATUS ABSENSI HARI INI</small></div>
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

    let isLockedAbsentToday = false;
    let isApprovedToday = false;
    let lastCheckTime = 0;
    let isVerifyingFace = false;
    let faceVerificationResult = null;

    function updateCaptureState() {
        if (!capture?.isConnected) return;
        if (isLockedAbsentToday) {
            capture.className = 'btn btn-primary locked';
            capture.disabled = true;
            capture.textContent = '✕ Absen ditolak (Di luar koordinat sekolah)';
            return;
        }
        if (isApprovedToday) {
            capture.className = 'btn btn-primary locked';
            capture.disabled = true;
            capture.textContent = '✓ Kehadiran hari ini sudah disetujui';
            return;
        }
        if (!hasRegisteredFace) {
            capture.className = 'btn btn-primary locked';
            capture.disabled = false;
            capture.textContent = '✕ Wajah belum terdaftar (Daftar dulu)';
            return;
        }
        capture.disabled = false;
        if (consent.checked && isFaceInGuide && latestFaceDescriptor) {
            capture.className = 'btn btn-primary';
            capture.textContent = '✓ Kirim foto absensi';
        } else {
            capture.className = 'btn btn-primary locked';
            if (!isFaceInGuide) {
                capture.textContent = 'Posisikan wajah di lingkaran...';
            } else if (faceVerificationResult === false) {
                capture.textContent = '✕ Wajah tidak cocok dengan akun';
            } else if (!consent.checked) {
                capture.textContent = 'Setujui penyimpanan data...';
            } else {
                capture.textContent = 'Memverifikasi kecocokan wajah...';
            }
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
                            faceVerificationResult = null;
                            faceGuide.className = 'face-guide face-warning';
                            if (faceHudBadge) {
                                faceHudBadge.className = 'face-hud-badge warning';
                                faceHudBadge.innerHTML = '<span class="hud-icon">⚠</span> Wajah Belum Terdaftar';
                            }
                            if (faceBannerText) {
                                faceBannerText.innerHTML = '<strong style="color:var(--red)">Wajah belum terdaftar:</strong> Anda tidak bisa absen sebelum mendaftarkan wajah. Silakan klik tombol "Daftarkan Wajah Sekarang" di atas.';
                            }
                            if (capture) {
                                capture.className = 'btn btn-primary locked';
                                capture.textContent = '✕ Wajah belum terdaftar (Daftar dulu)';
                            }
                        } else {
                            // Verifikasi biometrik kecocokan dengan pemilik akun
                            const now = Date.now();
                            if (!isVerifyingFace && (faceVerificationResult === null || now - lastCheckTime > 1200)) {
                                isVerifyingFace = true;
                                lastCheckTime = now;
                                const desc = Array.from(detection.descriptor);
                                api('/api/profile/face/check', {
                                    method: 'POST',
                                    body: JSON.stringify({ descriptor: desc })
                                }).then(res => {
                                    faceVerificationResult = Boolean(res && res.matched);
                                    if (faceVerificationResult) {
                                        latestFaceDescriptor = desc;
                                        faceGuide.className = 'face-guide face-detected';
                                        if (faceHudBadge) {
                                            faceHudBadge.className = 'face-hud-badge detected';
                                            faceHudBadge.innerHTML = `<span class="hud-icon">✓</span> Wajah Cocok (${esc(accountOwnerName)})`;
                                        }
                                        if (faceBannerText) {
                                            faceBannerText.innerHTML = `<strong>Wajah terverifikasi:</strong> Cocok dengan data akun <strong>${esc(accountOwnerName)}</strong>. Silakan kirim absensi.`;
                                        }
                                    } else {
                                        latestFaceDescriptor = null;
                                        faceGuide.className = 'face-guide face-error';
                                        if (faceHudBadge) {
                                            faceHudBadge.className = 'face-hud-badge error';
                                            faceHudBadge.innerHTML = '<span class="hud-icon">✕</span> Wajah Tidak Cocok dengan Akun';
                                        }
                                        if (faceBannerText) {
                                            faceBannerText.innerHTML = `<strong style="color:var(--red)">Wajah tidak cocok:</strong> Wajah di kamera tidak cocok dengan wajah terdaftar akun <strong>${esc(accountOwnerName)}</strong>. Wajah lain tidak dapat digunakan untuk absen.`;
                                        }
                                    }
                                    updateCaptureState();
                                }).catch(() => {}).finally(() => {
                                    isVerifyingFace = false;
                                });
                            }

                            if (faceVerificationResult === true) {
                                latestFaceDescriptor = Array.from(detection.descriptor);
                                faceGuide.className = 'face-guide face-detected';
                                if (faceHudBadge) {
                                    faceHudBadge.className = 'face-hud-badge detected';
                                    faceHudBadge.innerHTML = `<span class="hud-icon">✓</span> Wajah Cocok (${esc(accountOwnerName)})`;
                                }
                                updateCaptureState();
                            } else if (faceVerificationResult === false) {
                                latestFaceDescriptor = null;
                                faceGuide.className = 'face-guide face-error';
                                if (faceHudBadge) {
                                    faceHudBadge.className = 'face-hud-badge error';
                                    faceHudBadge.innerHTML = '<span class="hud-icon">✕</span> Wajah Tidak Cocok dengan Akun';
                                }
                                if (capture) {
                                    capture.className = 'btn btn-primary locked';
                                    capture.textContent = '✕ Wajah tidak cocok dengan akun';
                                }
                            } else {
                                if (faceHudBadge) {
                                    faceHudBadge.className = 'face-hud-badge';
                                    faceHudBadge.innerHTML = '<span class="hud-icon">⏳</span> Memverifikasi kecocokan wajah...';
                                }
                            }
                        }
                    } else {
                        isFaceInGuide = false;
                        latestFaceDescriptor = null;
                        faceVerificationResult = null;
                        currentGuideReason = evalRes.reason;
                        faceGuide.className = 'face-guide face-warning';
                        if (faceHudBadge) {
                            faceHudBadge.className = 'face-hud-badge warning';
                            faceHudBadge.innerHTML = `<span class="hud-icon">⚠</span> ${evalRes.reason}`;
                        }
                        if (faceBannerText) {
                            faceBannerText.innerHTML = `<strong>Posisikan wajah:</strong> ${evalRes.reason} agar pemeriksaan biometrik dapat dilakukan.`;
                        }
                        if (capture) {
                            capture.className = 'btn btn-primary locked';
                            capture.textContent = evalRes.reason + '...';
                        }
                    }
                } else {
                    isFaceInGuide = false;
                    latestFaceDescriptor = null;
                    faceVerificationResult = null;
                    currentGuideReason = 'Wajah tidak terdeteksi di dalam lingkaran';
                    faceGuide.className = 'face-guide';
                    if (faceHudBadge) {
                        faceHudBadge.className = 'face-hud-badge';
                        faceHudBadge.innerHTML = '<span class="hud-icon">✦</span> Arahkan wajah ke dalam lingkaran';
                    }
                    if (faceBannerText) {
                        faceBannerText.innerHTML = hasRegisteredFace
                            ? `<strong>Pengenalan biometrik aktif:</strong> Posisikan wajah Anda tepat di dalam lingkaran panduan untuk diverifikasi sebagai <strong>${esc(accountOwnerName)}</strong>.`
                            : `<strong style="color:var(--red)">Wajah belum terdaftar:</strong> Anda harus mendaftarkan wajah Anda terlebih dahulu sebelum bisa absen.`;
                    }
                    if (capture) {
                        capture.className = 'btn btn-primary locked';
                        capture.textContent = hasRegisteredFace ? 'Posisikan wajah di lingkaran...' : '✕ Wajah belum terdaftar (Daftar dulu)';
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
        const accuracy = Math.round(position.coords.accuracy);
        if (position.coords.accuracy > 100) throw new Error(`Akurasi GPS terlalu rendah (${accuracy} meter).`);
        location = position.coords;
        return { meters, accuracy, inside: meters + position.coords.accuracy <= Number(settings.radiusMeters) };
    }

    $('#checkLocation').onclick = async () => {
        $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memeriksa koordinat lokasi...</span>';
        try {
            const result = await verifySchoolLocation();
            if (result.inside) {
                $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Dalam radius sekolah · ${result.meters} m · akurasi ${result.accuracy} m</span>`;
                toast('Lokasi berada di dalam radius sekolah.');
            } else {
                $('#locationStatus').innerHTML = `<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: Di luar koordinat sekolah (${result.meters} meter dari sekolah). Anda tercatat Tidak Masuk jika absen dikirim.</span>`;
                toast(`Absen ditolak! Anda berada ${result.meters} meter di luar radius sekolah.`);
            }
        } catch (error) {
            location = null;
            $('#locationStatus').innerHTML = `<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: ${esc(error.message)}</span>`;
            toast(`Absen ditolak: ${error.message}`);
        }
    };

    capture.onclick = async () => {
        if (isLockedAbsentToday) {
            return toast('Absen ditolak! Anda berada di luar koordinat sekolah hari ini dan tercatat Tidak Masuk.');
        }
        if (isApprovedToday) {
            return toast('Kehadiran Anda hari ini sudah disetujui Admin.');
        }
        // 1. Cek pendaftaran wajah
        if (!hasRegisteredFace) {
            toast('⚠️ Absen ditolak! Anda belum mendaftarkan wajah di sistem. Harap daftarkan wajah terlebih dahulu sebelum absen.');
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

        // 3. WAJAH HARUS DI DALAM LINGKARAN
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

        // 4. WAJAH HARUS COCOK DENGAN PEMILIK AKUN
        if (!latestFaceDescriptor || faceVerificationResult === false) {
            faceGuide?.classList.remove('face-detected', 'face-warning');
            faceGuide?.classList.add('face-error');
            setTimeout(() => { faceGuide?.classList.remove('face-error'); }, 700);
            return toast(`⚠️ Absen ditolak! Wajah di kamera tidak cocok dengan akun terdaftar ${accountOwnerName}. Wajah lain tidak dapat digunakan untuk absen.`);
        }

        if (!consent.checked) return toast('Persetujuan penyimpanan foto dan data kehadiran diperlukan.');

        // 5. Lokasi GPS
        $('#locationStatus').innerHTML = '<span class="status-dot pending"></span><span>Memverifikasi koordinat lokasi sekolah...</span>';
        let locationResult;
        try {
            locationResult = await verifySchoolLocation();
            if (!locationResult.inside) {
                $('#locationStatus').innerHTML = `<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: Di luar koordinat sekolah (${locationResult.meters} m). Anda tercatat Tidak Masuk.</span>`;
            } else {
                $('#locationStatus').innerHTML = `<span class="status-dot good"></span><span>Lokasi terverifikasi · ${locationResult.meters} m · akurasi ${locationResult.accuracy} m</span>`;
            }
        } catch (error) {
            location = null;
            $('#locationStatus').innerHTML = `<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: ${esc(error.message)}</span>`;
            toast(`Absen ditolak: ${error.message}`);
            return;
        }

        capture.disabled = true;
        capture.textContent = 'Mengirim foto absensi...';

        try {
            const faceResult = await api('/api/profile/face/check', {
                method: 'POST',
                body: JSON.stringify({ descriptor: latestFaceDescriptor })
            });
            if (!faceResult.matched) throw new Error(`Absen ditolak! Wajah di kamera tidak cocok dengan akun terdaftar ${accountOwnerName}.`);

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
            ctx.fillText(`✓ BIOMETRIK VALID • ${accountOwnerName.toUpperCase()} • ${new Date().toLocaleTimeString('id-ID')}`, 26, canvas.height - 26);

            let blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
            if (!blob || blob.size < 1000) throw new Error('Foto tidak valid atau korup dari kamera. Pastikan pencahayaan cukup dan coba lagi.');

            let form = new FormData();
            form.append('photo', blob, 'attendance.jpg');
            form.append('latitude', String(location.latitude));
            form.append('longitude', String(location.longitude));
            form.append('accuracy', String(location.accuracy));
            form.append('faceDescriptor', JSON.stringify(latestFaceDescriptor));

            let result = await api('/api/attendance/photo', { method: 'POST', body: form });
            toast(result.message || 'Wajah terverifikasi biometrik! Kehadiran berhasil tercatat.');
            await loadMine();
        } catch (error) {
            const isLocationRejection = error.message && (error.message.includes('radius') || error.message.includes('jangkauan') || error.message.includes('koordinat') || error.message.includes('Tidak Masuk'));
            if (isLocationRejection) {
                isLockedAbsentToday = true;
                $('#locationStatus').innerHTML = '<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: Di luar koordinat sekolah. Anda tercatat Tidak Masuk hari ini.</span>';
                toast('Absen ditolak: Anda berada di luar koordinat sekolah dan otomatis tercatat Tidak Masuk.');
            } else {
                toast(error.message || 'Gagal mengirim foto absen.');
            }
            await loadMine();
        } finally {
            updateCaptureState();
        }
    };

    async function loadMine() {
        try {
            let result = await api('/api/attendance/mine');
            const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            const rows = result.attendance || [];
            const todayRow = rows.find(r => r.day === todayIso);
            isLockedAbsentToday = Boolean(todayRow && todayRow.verification === 'DITOLAK' && todayRow.rejectionReason === 'LOKASI');
            isApprovedToday = Boolean(todayRow && todayRow.verification === 'DISETUJUI');
            if (isLockedAbsentToday) {
                $('#locationStatus').innerHTML = '<span class="status-dot" style="background:var(--red)"></span><span style="color:var(--red);font-weight:700">Absen ditolak: Di luar koordinat sekolah. Anda tercatat Tidak Masuk hari ini.</span>';
            }
            updateCaptureState();
            $('#myAttendanceRows').innerHTML = rows.map(row => {
                let isApproved = row.verification === 'DISETUJUI';
                let isRejected = row.verification === 'DITOLAK';
                let label = isApproved ? 'Disetujui Admin' : isRejected ? (row.rejectionReason === 'LOKASI' ? 'Absen Ditolak · Tidak Masuk (Di Luar Koordinat Sekolah)' : 'Absen Ditolak Admin') : row.verification === 'MENUNGGU' ? 'Menunggu Admin' : esc(row.verification);
                let badgeStyle = isApproved ? 'style="background:var(--green2);color:var(--emerald)"' : isRejected ? 'style="background:rgba(251,113,133,.12);color:var(--red)"' : '';
                return `<div class="history-row">
                    <span class="history-check" ${badgeStyle}>${isApproved ? '✓' : isRejected ? '×' : '◷'}</span>
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
