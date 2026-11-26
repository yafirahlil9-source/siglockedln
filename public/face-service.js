/**
 * SigFace: Modul Pengenalan Wajah & Biometrik untuk Siglockedin
 * Menggunakan @vladmandic/face-api dengan model lokal offline (/models)
 */
(function (window) {
    'use strict';

    let modelsLoaded = false;
    let loadingPromise = null;

    const SigFace = {
        MATCH_THRESHOLD: 0.48, // Euclidean distance < 0.48 berarti orang yang sama (kecocokan > 80%)

        /**
         * Memastikan model jaringan saraf tiruan (neural network) termuat dari direktori lokal /models
         */
        async ensureModelsLoaded() {
            if (modelsLoaded) return true;
            if (loadingPromise) return loadingPromise;

            loadingPromise = (async () => {
                if (!window.faceapi) {
                    throw new Error('Pustaka face-api.js belum termuat. Pastikan file script sudah disertakan.');
                }
                const MODEL_URL = '/models';
                await Promise.all([
                    window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
                    window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
                ]);
                modelsLoaded = true;
                return true;
            })();

            return loadingPromise;
        },

        /**
         * Mendeteksi wajah tunggal, landmark 68-titik, dan deskriptor biometrik 128-float
         */
        async detectFace(videoEl) {
            if (!videoEl || !videoEl.videoWidth || videoEl.paused || videoEl.ended) return null;
            await this.ensureModelsLoaded();
            const options = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
            return await window.faceapi
                .detectSingleFace(videoEl, options)
                .withFaceLandmarks(true)
                .withFaceDescriptor();
        },

        /**
         * Menghitung kecocokan antara dua vektor biometrik wajah (128-d)
         */
        compareDescriptors(currentDescriptor, registeredDescriptor, threshold = SigFace.MATCH_THRESHOLD) {
            if (!currentDescriptor || !registeredDescriptor) {
                return { isMatched: false, distance: 1.0, similarity: 0 };
            }
            const currArray = Array.isArray(currentDescriptor) ? currentDescriptor : Array.from(currentDescriptor);
            const regArray = Array.isArray(registeredDescriptor) ? registeredDescriptor : Array.from(registeredDescriptor);
            if (currArray.length !== regArray.length || currArray.length === 0) {
                return { isMatched: false, distance: 1.0, similarity: 0 };
            }

            const distance = window.faceapi.euclideanDistance(currArray, regArray);
            // Skala kemiripan perkiraan (0% - 100%)
            // Jarak 0.0 -> 100%, 0.3 -> ~85%, 0.48 -> ~75%, >=0.65 -> 0%
            const rawSimilarity = (1 - (distance / 0.65)) * 100;
            const similarity = Math.max(0, Math.min(100, Math.round(rawSimilarity)));

            return {
                isMatched: distance < threshold,
                distance: Number(distance.toFixed(3)),
                similarity
            };
        },

        /**
         * Mengevaluasi apakah bounding box wajah berada tepat di dalam lingkaran panduan UI
         */
        evaluateFaceInGuide(faceBox, videoEl, guideEl) {
            if (!faceBox || !videoEl || !guideEl) {
                return { inCircle: false, reason: 'Posisikan wajah Anda di dalam lingkaran' };
            }

            const frame = videoEl.parentElement;
            const guideRect = guideEl.getBoundingClientRect();
            const frameRect = frame ? frame.getBoundingClientRect() : guideRect;

            const videoW = videoEl.videoWidth || 640;
            const videoH = videoEl.videoHeight || 480;

            // Video di CSS menggunakan object-fit: cover dan transform: scaleX(-1) (mirror kamera selfie)
            const scale = Math.max(frameRect.width / videoW, frameRect.height / videoH);
            const displayedW = videoW * scale;
            const displayedH = videoH * scale;
            const offsetX = (frameRect.width - displayedW) / 2;
            const offsetY = (frameRect.height - displayedH) / 2;

            const faceW = faceBox.width || faceBox.w;
            const faceH = faceBox.height || faceBox.h;
            const faceX = faceBox.x;
            const faceY = faceBox.y;

            // Koordinat dicerminkan secara horizontal karena tampilan video memakai scaleX(-1)
            const mirroredX = videoW - (faceX + faceW);

            const faceScreenX = offsetX + (mirroredX * scale);
            const faceScreenY = offsetY + (faceY * scale);
            const faceScreenW = faceW * scale;
            const faceScreenH = faceH * scale;

            const faceCenterX = faceScreenX + (faceScreenW / 2);
            const faceCenterY = faceScreenY + (faceScreenH / 2);

            const guideCenterX = (guideRect.left - frameRect.left) + (guideRect.width / 2);
            const guideCenterY = (guideRect.top - frameRect.top) + (guideRect.height / 2);
            const rx = guideRect.width / 2;
            const ry = guideRect.height / 2;

            const nx = (faceCenterX - guideCenterX) / rx;
            const ny = (faceCenterY - guideCenterY) / ry;
            const distSq = (nx * nx) + (ny * ny);

            // 1. Cek ukuran proporsional wajah
            if (faceScreenW < guideRect.width * 0.38) {
                return { inCircle: false, reason: 'Dekatkan wajah ke lingkaran' };
            }
            if (faceScreenW > guideRect.width * 1.35) {
                return { inCircle: false, reason: 'Mundurkan wajah sedikit' };
            }

            // 2. Cek apakah pusat wajah berada di dalam elips (distSq <= 0.65)
            if (distSq > 0.65) {
                if (nx > 0.35) return { inCircle: false, reason: 'Geser wajah sedikit ke kiri' };
                if (nx < -0.35) return { inCircle: false, reason: 'Geser wajah sedikit ke kanan' };
                if (ny > 0.35) return { inCircle: false, reason: 'Geser wajah sedikit ke atas' };
                if (ny < -0.35) return { inCircle: false, reason: 'Geser wajah sedikit ke bawah' };
                return { inCircle: false, reason: 'Posisikan wajah tepat di dalam lingkaran' };
            }

            return { inCircle: true, reason: 'Wajah tepat di dalam lingkaran' };
        },

        /**
         * Mengambil data biometrik wajah terdaftar dari server untuk akun saat ini
         */
        async getRegisteredFace() {
            try {
                return await api('/api/profile/face');
            } catch (err) {
                return { hasFace: false, descriptor: null, name: '' };
            }
        },

        /**
         * Membuka modal pendaftaran wajah mandiri
         */
        openEnrollmentModal({ onSuccess, onCancel } = {}) {
            let dialog = document.getElementById('faceEnrollDialog');
            if (dialog) dialog.remove();

            dialog = document.createElement('dialog');
            dialog.id = 'faceEnrollDialog';
            dialog.className = 'photo-dialog modal-dialog';
            dialog.style.maxWidth = '520px';
            dialog.style.padding = '22px';
            dialog.style.borderRadius = 'var(--r-xl)';
            dialog.style.background = 'var(--card, #111c17)';
            dialog.style.color = 'var(--ink, #e8f5ee)';
            dialog.style.border = '1px solid var(--line, rgba(255,255,255,0.12))';

            dialog.innerHTML = `
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                    <div>
                        <div style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;color:var(--emerald, #34d399);letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px">
                            <span>✦</span> SISTEM BIOMETRIK KEDAP PENIPUAN
                        </div>
                        <h3 style="margin:0;font-size:17px;font-weight:800;color:var(--ink)">Pendaftaran Wajah Akun</h3>
                        <p style="margin:4px 0 0 0;font-size:12.5px;color:var(--muted)">Sistem akan menyimpan profil biometrik 128-titik wajah Anda agar absensi hanya bisa dilakukan oleh Anda sendiri.</p>
                    </div>
                    <button class="btn btn-outline" id="closeFaceEnrollBtn" style="padding:4px 10px;font-size:16px;line-height:1;margin-left:12px" aria-label="Tutup">×</button>
                </div>

                <div class="camera-frame" style="height:320px;border-radius:var(--r-md);overflow:hidden;position:relative;background:#0d0607;margin-bottom:12px">
                    <video id="enrollVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
                    <div class="face-guide" id="enrollGuide" style="width:180px;height:235px">
                        <span></span>
                        <div class="face-scanner-line"></div>
                    </div>
                    <div class="face-hud-badge" id="enrollHudBadge" style="top:12px">
                        <span class="hud-icon">⏳</span> Mengaktifkan kamera & model AI...
                    </div>
                    <div id="enrollCameraHint" class="camera-hint">Pastikan wajah terlihat jelas dengan pencahayaan memadai</div>
                </div>

                <div id="enrollMessage" class="face-recognition-banner" style="margin-bottom:14px;font-size:12px">
                    <span class="face-status-dot pending"></span>
                    <span id="enrollMessageText">Sedang mempersiapkan pemindai biometrik wajah...</span>
                </div>

                <div style="display:flex;gap:10px;justify-content:flex-end">
                    <button class="btn btn-outline" id="cancelFaceEnrollBtn" type="button">Batal</button>
                    <button class="btn btn-primary locked" id="saveFaceEnrollBtn" type="button" disabled>
                        Posisikan wajah di lingkaran...
                    </button>
                </div>
            `;

            document.body.appendChild(dialog);
            dialog.showModal();

            let localStream = null;
            let scannerInterval = null;
            let lastValidDescriptor = null;
            let isProcessing = false;
            let isCleanedUp = false;

            const video = dialog.querySelector('#enrollVideo');
            const guide = dialog.querySelector('#enrollGuide');
            const hud = dialog.querySelector('#enrollHudBadge');
            const saveBtn = dialog.querySelector('#saveFaceEnrollBtn');
            const msgText = dialog.querySelector('#enrollMessageText');
            const msgBanner = dialog.querySelector('#enrollMessage');

            function cleanup() {
                if (isCleanedUp) return;
                isCleanedUp = true;
                if (scannerInterval) {
                    clearInterval(scannerInterval);
                    scannerInterval = null;
                }
                if (localStream) {
                    localStream.getTracks().forEach(t => t.stop());
                    localStream = null;
                }
                if (dialog.open) dialog.close();
                dialog.remove();
            }

            dialog.addEventListener('cancel', (e) => {
                e.preventDefault();
                cleanup();
                if (onCancel) onCancel();
            });
            dialog.querySelector('#closeFaceEnrollBtn').onclick = () => {
                cleanup();
                if (onCancel) onCancel();
            };
            dialog.querySelector('#cancelFaceEnrollBtn').onclick = () => {
                cleanup();
                if (onCancel) onCancel();
            };

            // Memulai kamera & detektor
            (async () => {
                try {
                    await SigFace.ensureModelsLoaded();
                    localStream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                        audio: false
                    });
                    video.srcObject = localStream;
                    hud.innerHTML = '<span class="hud-icon">✦</span> Posisikan wajah Anda di dalam lingkaran';

                    scannerInterval = setInterval(async () => {
                        if (!video || !video.videoWidth || video.paused || video.ended) return;
                        if (isProcessing) return;
                        isProcessing = true;

                        try {
                            const detection = await SigFace.detectFace(video);
                            if (detection) {
                                const box = detection.detection.box;
                                const evalRes = SigFace.evaluateFaceInGuide(box, video, guide);

                                if (evalRes.inCircle) {
                                    lastValidDescriptor = Array.from(detection.descriptor);
                                    guide.className = 'face-guide face-detected';
                                    hud.className = 'face-hud-badge detected';
                                    hud.innerHTML = '<span class="hud-icon">✓</span> Wajah Pas & Biometrik Siap';
                                    msgBanner.style.background = 'rgba(16,185,129,0.14)';
                                    msgBanner.style.borderColor = 'rgba(52,211,153,0.45)';
                                    msgBanner.style.color = '#6ee7b7';
                                    msgText.innerHTML = '<strong>✓ Wajah terdeteksi jelas:</strong> Silakan klik "Simpan Biometrik Wajah" di bawah.';
                                    saveBtn.classList.remove('locked');
                                    saveBtn.disabled = false;
                                    saveBtn.textContent = '✓ Simpan Biometrik Wajah';
                                } else {
                                    lastValidDescriptor = null;
                                    guide.className = 'face-guide face-warning';
                                    hud.className = 'face-hud-badge warning';
                                    hud.innerHTML = `<span class="hud-icon">⚠</span> ${evalRes.reason}`;
                                    msgBanner.style.background = 'rgba(245,158,11,0.14)';
                                    msgBanner.style.borderColor = 'rgba(251,191,36,0.4)';
                                    msgBanner.style.color = '#fcd34d';
                                    msgText.innerHTML = `<strong>Posisikan wajah:</strong> ${evalRes.reason}.`;
                                    saveBtn.classList.add('locked');
                                    saveBtn.disabled = true;
                                    saveBtn.textContent = 'Posisikan wajah di lingkaran...';
                                }
                            } else {
                                lastValidDescriptor = null;
                                guide.className = 'face-guide';
                                hud.className = 'face-hud-badge';
                                hud.innerHTML = '<span class="hud-icon">✦</span> Arahkan wajah ke dalam lingkaran';
                                msgBanner.style.background = 'rgba(244,63,94,0.12)';
                                msgBanner.style.borderColor = 'rgba(244,63,94,0.35)';
                                msgBanner.style.color = '#fda4af';
                                msgText.innerHTML = 'Wajah belum terdeteksi. Harap menghadap lurus ke arah kamera.';
                                saveBtn.classList.add('locked');
                                saveBtn.disabled = true;
                                saveBtn.textContent = 'Posisikan wajah di lingkaran...';
                            }
                        } catch (scanErr) {
                            console.error('Scan error:', scanErr);
                        } finally {
                            isProcessing = false;
                        }
                    }, 250);
                } catch (err) {
                    hud.className = 'face-hud-badge error';
                    hud.innerHTML = '<span class="hud-icon">⚠</span> Akses kamera ditolak';
                    msgBanner.style.background = 'rgba(244,63,94,0.14)';
                    msgBanner.style.borderColor = 'rgba(244,63,94,0.4)';
                    msgBanner.style.color = '#fda4af';
                    msgText.textContent = 'Tidak dapat mengakses kamera: ' + (err.message || 'Izin kamera diperlukan.');
                }
            })();

            saveBtn.onclick = async () => {
                if (!lastValidDescriptor || lastValidDescriptor.length < 64) {
                    return toast('Biometrik wajah belum terbaca dengan cukup jelas. Posisikan kembali wajah Anda.');
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Menyimpan biometrik...';

                try {
                    const res = await api('/api/profile/face', {
                        method: 'POST',
                        body: JSON.stringify({ descriptor: lastValidDescriptor })
                    });
                    toast(res.message || 'Wajah Anda berhasil didaftarkan ke sistem!');
                    cleanup();
                    if (onSuccess) onSuccess();
                } catch (saveErr) {
                    toast(saveErr.message || 'Gagal menyimpan data biometrik.');
                    saveBtn.disabled = false;
                    saveBtn.textContent = '✓ Simpan Biometrik Wajah';
                }
            };
        }
    };

    window.SigFace = SigFace;
})(window);
