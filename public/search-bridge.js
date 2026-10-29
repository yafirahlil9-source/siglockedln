renderSearch = async function () {
  $('#pageContent').innerHTML = heading(
    'JELAJAHI SEKOLAH',
    'Cari warga sekolah',
    'Cari akun aktif berdasarkan nama, kelas, atau bidang tugas.'
  ) + `<div class="search-row"><input id="peopleSearch" class="search-field" value="${esc(searchQuery)}" placeholder="Cari nama, kelas, atau bidang..."><button class="btn btn-outline" id="searchReset">Reset</button></div><div class="filter-row">${['Semua','Siswa','Guru','Staf'].map(role => `<button class="filter-chip ${searchRole === role ? 'active' : ''}" data-db-role="${role}">${role}</button>`).join('')}</div><div class="card-title"><h3>Hasil pencarian</h3><small id="searchCount">Memuat akun...</small></div><div class="people-grid" id="peopleResults"></div>`;

  const loadPeople = async () => {
    const query = $('#peopleSearch').value.trim();
    searchQuery = query;
    if (query.length === 1) {
      $('#searchCount').textContent = 'Masukkan minimal 2 karakter';
      $('#peopleResults').innerHTML = '';
      return;
    }

    try {
      const role = searchRole === 'Semua' ? '' : searchRole.toUpperCase();
      const result = await api(`/api/search?q=${encodeURIComponent(query)}&role=${encodeURIComponent(role)}`);
      const isAdmin = currentUser && currentUser.role === 'admin';
      $('#peopleResults').innerHTML = result.people.map(person => {
        const canDelete = isAdmin && person.role !== 'ADMIN' && person.id !== currentUser.id;
        return `<article class="person-card">
          <div class="person-avatar">◌</div>
          <span class="role-tag">${esc(person.role)}</span>
          <h3>${esc(person.name)}</h3>
          <p>${esc(person.detail || '')}</p>
          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn btn-outline" style="flex:1" data-db-person="${esc(person.id)}">Lihat profil</button>
            ${canDelete ? `<button class="btn btn-outline text-danger" style="padding:9px 12px" data-quick-delete-person="${esc(person.id)}" data-person-name="${esc(person.name)}" title="Hapus warga sekolah">🗑 Hapus</button>` : ''}
          </div>
        </article>`;
      }).join('') || '<div class="empty-state" style="grid-column:1/-1"><b>Tidak ada akun aktif yang cocok.</b></div>';

      $$('[data-quick-delete-person]').forEach(button => button.onclick = async (e) => {
        e.stopPropagation();
        const id = button.dataset.quickDeletePerson;
        const name = button.dataset.personName;
        if (!confirm(`Hapus warga sekolah "${name}"? Seluruh data yang terkait akan dihapus secara permanen.`)) return;
        try {
          await api(`/api/admin/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' });
          toast(`Warga sekolah "${name}" berhasil dihapus.`);
          await loadPeople();
        } catch (error) {
          toast(error.message);
        }
      });

      $$('[data-db-person]').forEach(button => button.onclick = async () => {
        try {
          const profile = await api(`/api/search/${encodeURIComponent(button.dataset.dbPerson)}/profile`);
          const person = profile.person;
          const roleName = { SISWA: 'Siswa', GURU: 'Guru', STAF: 'Staf', ADMIN: 'Admin' }[person.role] || person.role;
          const detailLabel = { SISWA: 'Identitas', GURU: 'Identitas', STAF: 'Identitas', ADMIN: 'Bagian' }[person.role] || 'Identitas';
          const canSeeMetrics = profile.canSeeAcademicMetrics;
          const isStudent = person.role === 'SISWA';
          const average = !isStudent || !canSeeMetrics ? '—' : profile.averageScore === null ? 'Belum ada' : profile.averageScore;
          const rank = !isStudent || !canSeeMetrics ? '—' : profile.rank === null ? 'Belum ada' : `#${profile.rank}`;
          const attendance = canSeeMetrics ? profile.approvedAttendance : '—';
          const attendanceLabel = canSeeMetrics ? 'Absen disetujui' : 'Kehadiran privat';
          const canDeletePerson = (currentUser && currentUser.role === 'admin' && person.role !== 'ADMIN' && person.id !== currentUser.id);
          const deletePersonHtml = canDeletePerson ? `<button class="btn btn-outline text-danger" id="deletePersonBtn" style="margin-left:10px">Hapus warga sekolah</button>` : '';
          $('#pageContent').innerHTML = heading('PROFIL WARGA SEKOLAH', esc(person.name), 'Informasi profil dari database sekolah.') + `<section class="card person-detail"><div class="person-avatar">◌</div><span class="role-tag">${esc(roleName.toUpperCase())}</span><h2>${esc(person.name)}</h2><p class="person-detail-field"><small class="muted">${esc(detailLabel)}:</small> ${esc(person.detail || 'Belum diisi')}</p><p class="profile-bio">${esc(person.bio || 'Bio belum diisi.')}</p><div class="metric-row"><div class="metric"><b>${esc(average)}</b><small>Rata-rata nilai</small></div><div class="metric"><b>${esc(rank)}</b><small>Peringkat kelas</small></div><div class="metric"><b>${esc(attendance)}</b><small>${attendanceLabel}</small></div></div><p class="hint">Nilai dan peringkat hanya dapat dilihat sendiri, admin, atau guru yang membuat tugas untuk kelas siswa tersebut.</p><div style="display:flex;gap:10px;margin-top:15px"><button class="btn btn-outline" id="backToSearch">Kembali ke hasil pencarian</button>${deletePersonHtml}</div></section>`;
          $('#backToSearch').onclick = () => renderSearch();
          if ($('#deletePersonBtn')) {
            $('#deletePersonBtn').onclick = async () => {
              if (!confirm(`Hapus warga sekolah "${person.name}"? Semua data yang terkait akan dihapus secara permanen.`)) return;
              try {
                await api(`/api/admin/accounts/${encodeURIComponent(person.id)}`, { method: 'DELETE' });
                toast(`Warga sekolah "${person.name}" berhasil dihapus.`);
                renderSearch();
              } catch (error) {
                toast(error.message);
              }
            };
          }
        } catch (error) {
          toast(error.message);
        }
      });
    } catch (error) {
      $('#searchCount').textContent = error.message;
      $('#peopleResults').innerHTML = '';
    }
  };

  let searchTimer;
  $('#peopleSearch').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadPeople, 250);
  };
  $('#searchReset').onclick = () => {
    searchRole = 'Semua';
    $('#peopleSearch').value = '';
    $$('[data-db-role]').forEach(button => button.classList.toggle('active', button.dataset.dbRole === 'Semua'));
    loadPeople();
  };
  $$('[data-db-role]').forEach(button => button.onclick = () => {
    searchRole = button.dataset.dbRole;
    $$('[data-db-role]').forEach(item => item.classList.toggle('active', item === button));
    loadPeople();
  });

  await loadPeople();
};