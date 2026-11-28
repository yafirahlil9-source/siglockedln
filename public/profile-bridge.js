renderProfile = async function () {
  let result;
  try {
    result = await api('/api/profile/me');
  } catch (error) {
    $('#pageContent').innerHTML = heading('AKUN SAYA', 'Profil pribadi', error.message);
    return;
  }

  const profile = result.user;
  const roleLabel = { siswa: 'Siswa', guru: 'Guru', staf: 'Staf', admin: 'Admin' }[profile.role] || profile.role;
  const detailLabels = { siswa: 'Kelas', guru: 'Mata pelajaran', staf: 'Bidang tugas', admin: 'Bagian' };
  const detailLabel = detailLabels[profile.role] || 'Detail';
  const isGuru = profile.role === 'guru';
  const hasFace = Boolean(profile.hasFaceRegistered);

  function syncTopAvatar(avatarUrl) {
    const topAv = $('#profileShortcut .avatar');
    if (!topAv) return;
    if (avatarUrl) {
      topAv.innerHTML = `<img src="${esc(avatarUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block">`;
    } else {
      topAv.textContent = '◌';
    }
  }
  syncTopAvatar(profile.avatarUrl);

  $('#pageContent').innerHTML = heading('AKUN SAYA', 'Profil pribadi', 'Informasi akun aktif yang tersimpan di database sekolah.') + `
    <div class="grid two-col">
      <section>
        <div class="profile-cover ${profile.coverUrl ? 'has-cover' : ''}" id="profileCoverBox" style="${profile.coverUrl ? `background-image:url('${esc(profile.coverUrl)}')` : ''}">
          <div class="profile-cover-actions">
            <button class="profile-media-btn" id="uploadCoverBtn" type="button">📷 ${profile.coverUrl ? 'Ubah Sampul' : 'Foto Latar'}</button>
            ${profile.coverUrl ? '<button class="profile-media-btn" id="deleteCoverBtn" type="button" title="Hapus foto latar" style="color:#fda4af">×</button>' : ''}
          </div>
          <input type="file" id="coverFileInput" accept="image/jpeg,image/png,image/webp" hidden>
        </div>
        <div class="profile-info">
          <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px">
            <div class="profile-avatar-wrap">
              <div class="profile-avatar" id="profileAvatarBox" style="${profile.avatarUrl ? 'cursor:pointer' : ''}" title="${profile.avatarUrl ? 'Klik untuk melihat foto profil' : ''}">
                ${profile.avatarUrl ? `<img src="${esc(profile.avatarUrl)}" alt="Foto profil">` : '◌'}
              </div>
              <button class="profile-avatar-edit" id="uploadAvatarBtn" type="button" title="Ubah foto profil" aria-label="Ubah foto profil">📷</button>
              <input type="file" id="avatarFileInput" accept="image/jpeg,image/png,image/webp" hidden>
            </div>
            ${profile.avatarUrl ? '<button class="text-action" id="deleteAvatarBtn" type="button" style="color:#fda4af;font-size:11.5px;margin-bottom:4px">Hapus foto profil</button>' : ''}
          </div>
          <h2>${esc(profile.name)}</h2>
          <span class="role-tag">${esc(roleLabel.toUpperCase())}</span>
          <p><small class="muted">${esc(detailLabel)}:</small> ${esc(profile.detail || 'Belum diisi')}</p>
          <div class="profile-bio" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <span id="bioDisplay">${esc(profile.bio || 'Bio belum diisi.')}</span>
            <button class="text-action hidden" id="showBioEditBtn" type="button" style="white-space:nowrap;font-size:11.5px">✎ Edit bio</button>
          </div>
          <div class="metric-row">
            <div class="metric"><b>${result.assignmentCount}</b><small>${isGuru ? 'Tugas dibuat' : 'Tugas tersedia'}</small></div>
            <div class="metric"><b>${result.approvedAttendance}</b><small>Absen disetujui</small></div>
            <div class="metric"><b>—</b><small>Nilai / peringkat belum tersedia</small></div>
          </div>
        </div>
      </section>

      <div>
        <section class="card" id="bioEditCard" style="margin-bottom:18px">
          <div class="card-title"><h3>Ubah bio</h3><small>TERSIMPAN DI DATABASE</small></div>
          <form id="profileBioForm">
            <textarea id="profileBioInput" class="field" maxlength="300" rows="4" placeholder="Tulis bio singkat...">${esc(profile.bio || '')}</textarea>
            <p id="profileBioError" class="error hidden"></p>
            <button class="btn btn-primary" type="submit">Simpan bio</button>
          </form>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>Verifikasi Biometrik Wajah</h3>
            <span class="demo-chip" style="background:var(--green2);color:var(--emerald)">PEMERIKSAAN AWAL</span>
          </div>
          <div id="faceBiometricSection">
            ${hasFace ? `
              <div class="face-recognition-banner" style="margin-top:0">
                <span class="face-status-dot good"></span>
                <span><strong>Wajah Terdaftar:</strong> Data ini digunakan untuk pemeriksaan awal di server saat absensi. Foto kehadiran tetap diperiksa admin sebelum disetujui.</span>
              </div>
              <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
                <button class="btn btn-primary" id="reEnrollFaceBtn" type="button">Pindai / Perbarui Wajah</button>
                <button class="btn btn-outline" id="deleteFaceBtn" type="button" style="color:#f43f5e">Hapus Data Wajah</button>
              </div>
            ` : `
              <div class="face-recognition-banner" style="margin-top:0;background:rgba(244,63,94,0.12);border-color:rgba(244,63,94,0.35);color:#fda4af">
                <span class="face-status-dot" style="background:#f43f5e"></span>
                <span><strong>Wajah Belum Terdaftar:</strong> Daftarkan wajah untuk mengaktifkan pemeriksaan awal saat absensi. Pemeriksaan ini bukan jaminan anti-titip absen.</span>
              </div>
              <div style="margin-top:14px">
                <button class="btn btn-primary" id="enrollFaceBtn" type="button">✦ Daftarkan Wajah Saya Sekarang</button>
              </div>
            `}
          </div>
          <div class="side-note" style="margin-top:14px">
            <h4>Keamanan & Privasi Wajah</h4>
            <p>Data biometrik disimpan sebagai 128-vektor matematis yang dienkripsi di server sekolah. Foto kehadiran disimpan terpisah dan hanya dapat diakses oleh pemilik akun atau admin.</p>
          </div>
        </section>

        <div class="side-note" style="margin-top:18px">
          <h4>Privasi akun</h4>
          <p>Data dasar berasal dari akun aktif Anda. Nilai tugas dapat dilihat pada halaman Tugas; ringkasan peringkat belum tersedia.</p>
        </div>
      </div>
    </div>
  `;

  async function uploadProfileMedia(type, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return toast('Ukuran gambar maksimal 5 MB.');
    }
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await api(`/api/profile/media/${type}`, { method: 'POST', body: form });
      toast(res.message || 'Foto berhasil diperbarui.');
      if (type === 'avatar') syncTopAvatar(res.url);
      renderProfile();
    } catch (err) {
      toast(err.message || 'Gagal mengunggah foto.');
    }
  }

  async function deleteProfileMedia(type) {
    try {
      const res = await api(`/api/profile/media/${type}`, { method: 'DELETE' });
      toast(res.message || 'Foto dihapus.');
      if (type === 'avatar') syncTopAvatar(null);
      renderProfile();
    } catch (err) {
      toast(err.message || 'Gagal menghapus foto.');
    }
  }

  $('#uploadAvatarBtn').onclick = () => $('#avatarFileInput').click();
  $('#avatarFileInput').onchange = e => uploadProfileMedia('avatar', e.target.files?.[0]);
  if ($('#deleteAvatarBtn')) $('#deleteAvatarBtn').onclick = () => deleteProfileMedia('avatar');

  if (profile.avatarUrl) {
    $('#profileAvatarBox').onclick = () => {
      let dialog = $('#profileMediaPreviewDialog');
      if (dialog) dialog.remove();
      dialog = document.createElement('dialog');
      dialog.id = 'profileMediaPreviewDialog';
      dialog.className = 'photo-dialog';
      dialog.innerHTML = `<button class="photo-close" id="closeProfileMediaPreview" aria-label="Tutup foto">×</button><img src="${esc(profile.avatarUrl)}" alt="Foto profil ${esc(profile.name)}">`;
      document.body.appendChild(dialog);
      dialog.showModal();
      dialog.querySelector('#closeProfileMediaPreview').onclick = () => { dialog.close(); dialog.remove(); };
      dialog.onclick = e => { if (e.target === dialog) { dialog.close(); dialog.remove(); } };
    };
  }

  $('#uploadCoverBtn').onclick = () => $('#coverFileInput').click();
  $('#coverFileInput').onchange = e => uploadProfileMedia('cover', e.target.files?.[0]);
  if ($('#deleteCoverBtn')) $('#deleteCoverBtn').onclick = () => deleteProfileMedia('cover');

  $('#profileBioForm').onsubmit = async event => {
    event.preventDefault();
    try {
      const saved = await api('/api/profile/me', { method: 'PUT', body: JSON.stringify({ bio: $('#profileBioInput').value }) });
      profile.bio = saved.bio;
      $('#bioDisplay').textContent = saved.bio || 'Bio belum diisi.';
      $('#bioEditCard').classList.add('hidden');
      $('#showBioEditBtn').classList.remove('hidden');
      toast('Bio tersimpan di database.');
    } catch (error) {
      $('#profileBioError').textContent = error.message;
      $('#profileBioError').classList.remove('hidden');
    }
  };

  $('#showBioEditBtn').onclick = () => {
    $('#bioEditCard').classList.remove('hidden');
    $('#showBioEditBtn').classList.add('hidden');
    $('#profileBioInput').focus();
  };

  const enrollBtn = $('#enrollFaceBtn');
  if (enrollBtn) {
    enrollBtn.onclick = () => {
      if (window.SigFace) {
        window.SigFace.openEnrollmentModal({
          onSuccess: () => renderProfile()
        });
      } else {
        toast('Modul pengenalan wajah belum siap.');
      }
    };
  }

  const reEnrollBtn = $('#reEnrollFaceBtn');
  if (reEnrollBtn) {
    reEnrollBtn.onclick = () => {
      if (window.SigFace) {
        window.SigFace.openEnrollmentModal({
          onSuccess: () => renderProfile()
        });
      } else {
        toast('Modul pengenalan wajah belum siap.');
      }
    };
  }

  const deleteBtn = $('#deleteFaceBtn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm('Apakah Anda yakin ingin menghapus data biometrik wajah akun ini? Anda harus mendaftar ulang sebelum dapat melakukan absensi.')) {
        return;
      }
      try {
        const res = await api('/api/profile/face', { method: 'DELETE' });
        toast(res.message || 'Data wajah berhasil dihapus.');
        renderProfile();
      } catch (err) {
        toast(err.message || 'Gagal menghapus data wajah.');
      }
    };
  }
};
