// admin.js - JavaScript untuk halaman admin
// Versi Final - Disesuaikan dengan struktur tabel Supabase

// =====================================================
// KONFIGURASI SUPABASE
// =====================================================
const SUPABASE_URL = 'https://jsbqmtzkayvnpzmnycyv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o';

// Inisialisasi Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE MANAGEMENT
// =====================================================
let currentMoviesId = null;
let moviesData = [];
let currentFilter = 'all';
let deleteMoviesId = null;
let deleteEpisodeIndex = null;
let deleteEpisodeId = null;
let episodesData = [];
let sortableInstance = null;

// =====================================================
// EKSPOS FUNGSI KE GLOBAL SCOPE
// =====================================================
window.openAddModal = openAddModal;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;
window.closeDeleteEpisodeModal = closeDeleteEpisodeModal;
window.editMovies = editMovies;
window.deleteMovies = deleteMovies;
window.logout = logout;
window.filterMovies = filterMovies;
window.switchModalTab = switchModalTab;
window.addEpisodeField = addEpisodeField;
window.removeEpisode = removeEpisode;
window.moveEpisodeUp = moveEpisodeUp;
window.moveEpisodeDown = moveEpisodeDown;
window.sortEpisodesAscending = sortEpisodesAscending;
window.sortEpisodesDescending = sortEpisodesDescending;
window.saveAllData = saveAllData;
window.handleCategoryChange = handleCategoryChange;
window.updateEpisodeData = updateEpisodeData;
window.confirmRemoveEpisode = confirmRemoveEpisode;

// =====================================================
// INISIALISASI
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Admin page loaded');
    await checkAuth();
    setupEventListeners();
});

// =====================================================
// FUNGSI AUTENTIKASI
// =====================================================
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();
        
        if (error || !user) {
            console.log('No user found, redirecting to login');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('User authenticated:', user.email);
        document.querySelector('.admin-header').setAttribute('data-user', user.email);
        await loadMovies();
    } catch (error) {
        console.error('Auth error:', error);
        window.location.href = 'login.html';
    }
}

// =====================================================
// SETUP EVENT LISTENERS
// =====================================================
function setupEventListeners() {
    console.log('Setting up event listeners');
    
    const thumbnailInput = document.getElementById('thumbnail');
    if (thumbnailInput) {
        thumbnailInput.addEventListener('input', handleThumbnailPreview);
    }
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    
    const description = document.getElementById('description');
    if (description) {
        description.addEventListener('input', updateCharCount);
    }
    
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('moviesModal');
        const deleteModal = document.getElementById('deleteModal');
        const deleteEpisodeModal = document.getElementById('deleteEpisodeModal');
        
        if (e.target === modal) closeModal();
        if (e.target === deleteModal) closeDeleteModal();
        if (e.target === deleteEpisodeModal) closeDeleteEpisodeModal();
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
            closeDeleteEpisodeModal();
        }
    });
    
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDelete);
    }
    
    const confirmDeleteEpisodeBtn = document.getElementById('confirmDeleteEpisodeBtn');
    if (confirmDeleteEpisodeBtn) {
        confirmDeleteEpisodeBtn.addEventListener('click', confirmDeleteEpisode);
    }
}

// =====================================================
// FUNGSI HANDLER
// =====================================================
function handleCategoryChange() {
    const category = document.getElementById('category')?.value;
    const episodeInfo = document.getElementById('episodeInfo');
    const videoUrlGroup = document.getElementById('videoUrlGroup');
    const videoUrlInput = document.getElementById('videoUrl');
    const videoUrlRequired = document.getElementById('videoUrlRequired');
    
    if (category === 'donghua') {
        if (videoUrlInput) {
            videoUrlInput.required = false;
            videoUrlInput.placeholder = 'Opsional - Gunakan tab episode';
        }
        if (videoUrlRequired) {
            videoUrlRequired.style.opacity = '0.3';
        }
        if (episodeInfo && episodesData.length > 0) {
            episodeInfo.style.display = 'flex';
        } else if (episodeInfo) {
            episodeInfo.style.display = 'none';
        }
    } else {
        if (videoUrlInput) {
            videoUrlInput.required = true;
            videoUrlInput.placeholder = 'https://example.com/video.mp4';
        }
        if (videoUrlRequired) {
            videoUrlRequired.style.opacity = '1';
        }
        if (episodeInfo) {
            episodeInfo.style.display = 'none';
        }
    }
}

function handleThumbnailPreview(e) {
    const preview = document.getElementById('thumbnailPreview');
    const placeholder = document.getElementById('previewPlaceholder');
    const value = e.target.value;
    
    if (preview && placeholder) {
        if (value) {
            preview.src = value;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
            preview.onerror = function() {
                this.src = 'https://via.placeholder.com/300x450?text=Invalid+Image';
                this.style.border = '2px solid #ff3c3c';
            };
        } else {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }
}

function updateCharCount() {
    const description = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (charCount && description) {
        charCount.textContent = description.value.length;
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    filterAndDisplayMovies(searchTerm, currentFilter);
}

// =====================================================
// FUNGSI FILTER DAN DISPLAY MOVIES
// =====================================================
function filterMovies(category) {
    currentFilter = category;
    
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (category === 'all') document.getElementById('filterAll')?.classList.add('active');
    if (category === 'film') document.getElementById('filterFilm')?.classList.add('active');
    if (category === 'donghua') document.getElementById('filterDonghua')?.classList.add('active');
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    filterAndDisplayMovies(searchTerm, category);
}

function filterAndDisplayMovies(searchTerm, category) {
    const moviesList = document.getElementById('moviesList');
    if (!moviesList) return;
    
    let filteredMovies = moviesData;
    
    if (category !== 'all') {
        filteredMovies = filteredMovies.filter(m => m.category === category);
    }
    
    if (searchTerm) {
        filteredMovies = filteredMovies.filter(m => 
            m.title.toLowerCase().includes(searchTerm)
        );
    }
    
    displayMovies(filteredMovies);
}

function displayMovies(movies) {
    const moviesList = document.getElementById('moviesList');
    if (!moviesList) return;
    
    if (movies.length === 0) {
        moviesList.innerHTML = '<div class="loading">Tidak ada konten yang ditemukan</div>';
        return;
    }
    
    moviesList.innerHTML = '';
    movies.forEach(movie => {
        moviesList.appendChild(createMoviesRow(movie));
    });
}

// =====================================================
// FUNGSI CRUD MOVIES
// =====================================================
async function loadMovies() {
    const moviesList = document.getElementById('moviesList');
    if (!moviesList) return;
    
    moviesList.innerHTML = '<div class="loading">Memuat data...</div>';
    
    try {
        const { data, error } = await supabaseClient
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        
        moviesData = data || [];
        
        // Hitung episode untuk setiap movie
        for (let movie of moviesData) {
            const { count, error: countError } = await supabaseClient
                .from('episodes')
                .select('*', { count: 'exact', head: true })
                .eq('movie_id', movie.id);
                
            if (!countError) {
                movie.episode_count = count;
            }
        }
        
        updateStats(moviesData);
        filterAndDisplayMovies('', currentFilter);
        
    } catch (error) {
        console.error('Error loading movies:', error);
        moviesList.innerHTML = '<div class="loading">Error memuat data: ' + error.message + '</div>';
        showToast('Gagal memuat data: ' + error.message, 'error');
    }
}

function updateStats(movies) {
    const totalMovies = document.getElementById('totalMovies');
    const totalFilms = document.getElementById('totalFilms');
    const totalDonghua = document.getElementById('totalDonghua');
    
    if (totalMovies) totalMovies.textContent = movies.length;
    if (totalFilms) totalFilms.textContent = movies.filter(m => m.category === 'film').length;
    if (totalDonghua) totalDonghua.textContent = movies.filter(m => m.category === 'donghua').length;
}

function createMoviesRow(movie) {
    const row = document.createElement('div');
    row.className = 'table-row';
    
    const createdDate = movie.created_at ? new Date(movie.created_at).toLocaleDateString('id-ID') : '-';
    const views = movie.views || 0;
    const episodeCount = movie.episode_count || 0;
    
    row.innerHTML = `
        <img src="${movie.thumbnail || 'https://via.placeholder.com/300x450?text=No+Image'}" 
             onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'"
             alt="${movie.title}">
        <div><strong>${movie.title}</strong></div>
        <div><span class="badge ${movie.category === 'film' ? 'badge-film' : 'badge-donghua'}">${movie.category === 'film' ? '🎬 Film' : '📺 Donghua'}</span></div>
        <div>${movie.year || '-'}</div>
        <div>
            <span class="badge" style="background: ${episodeCount > 0 ? '#ff3c3c' : '#666'}">
                <i class="fas fa-list"></i> ${episodeCount} Episode
            </span>
        </div>
        <div class="views"><i class="fas fa-eye"></i> ${formatNumber(views)}</div>
        <div><small>${createdDate}</small></div>
        <div class="actions">
            <button onclick="editMovies('${movie.id}')" class="btn-icon edit" title="Edit">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="deleteMovies('${movie.id}')" class="btn-icon delete" title="Hapus">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    return row;
}

function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// =====================================================
// FUNGSI MODAL TAB
// =====================================================
function switchModalTab(tab) {
    const tabInfo = document.getElementById('tabInfo');
    const tabEpisodes = document.getElementById('tabEpisodes');
    const infoTab = document.getElementById('infoTab');
    const episodesTab = document.getElementById('episodesTab');
    
    if (tabInfo) tabInfo.classList.remove('active');
    if (tabEpisodes) tabEpisodes.classList.remove('active');
    if (infoTab) infoTab.classList.remove('active');
    if (episodesTab) episodesTab.classList.remove('active');
    
    if (tab === 'info') {
        if (tabInfo) tabInfo.classList.add('active');
        if (infoTab) infoTab.classList.add('active');
    } else {
        if (tabEpisodes) tabEpisodes.classList.add('active');
        if (episodesTab) episodesTab.classList.add('active');
        renderEpisodesList();
    }
}

// =====================================================
// FUNGSI EPISODE MANAGEMENT (MENGGUNAKAN TABEL EPISODES)
// =====================================================
function renderEpisodesList() {
    const container = document.getElementById('episodesList');
    if (!container) return;
    
    if (episodesData.length === 0) {
        container.innerHTML = `
            <div class="episodes-empty">
                <i class="fas fa-film"></i>
                <p>Belum ada episode. Klik "Tambah Episode" untuk menambahkan episode pertama.</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    episodesData.forEach((episode, index) => {
        html += `
            <div class="episode-item" data-index="${index}" data-episode-id="${episode.id || ''}">
                <div class="episode-drag-handle">
                    <i class="fas fa-grip-lines"></i>
                    <i class="fas fa-grip-lines"></i>
                </div>
                <div class="episode-number-badge">${index + 1}</div>
                <div class="episode-content">
                    <input type="text" class="episode-title-input" 
                           placeholder="Judul Episode ${index + 1}" 
                           value="${episode.title || ''}"
                           onchange="updateEpisodeData(${index}, 'title', this.value)">
                    <input type="url" class="episode-url-input" 
                           placeholder="URL Video Episode ${index + 1}" 
                           value="${episode.url || ''}"
                           required
                           onchange="updateEpisodeData(${index}, 'url', this.value)">
                    <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                        <input type="number" class="episode-duration-input" 
                               placeholder="Durasi (menit)" 
                               value="${episode.duration || ''}"
                               min="1" max="300"
                               onchange="updateEpisodeData(${index}, 'duration', this.value)">
                        <span style="color: #888; font-size: 12px;">menit</span>
                    </div>
                </div>
                <div class="episode-actions">
                    <button class="episode-btn move-up" onclick="moveEpisodeUp(${index})" ${index === 0 ? 'disabled' : ''} title="Pindah ke atas">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                    <button class="episode-btn move-down" onclick="moveEpisodeDown(${index})" ${index === episodesData.length - 1 ? 'disabled' : ''} title="Pindah ke bawah">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <button class="episode-btn delete" onclick="confirmRemoveEpisode(${index})" title="Hapus episode">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    
    sortableInstance = new Sortable(container, {
        animation: 150,
        handle: '.episode-drag-handle',
        onEnd: function(evt) {
            const oldIndex = evt.oldIndex;
            const newIndex = evt.newIndex;
            
            if (oldIndex !== newIndex) {
                const item = episodesData.splice(oldIndex, 1)[0];
                episodesData.splice(newIndex, 0, item);
                renderEpisodesList();
                updateEpisodeCount();
            }
        }
    });
}

function updateEpisodeData(index, field, value) {
    if (!episodesData[index]) return;
    episodesData[index][field] = value;
}

function addEpisodeField() {
    const newEpisode = {
        id: null, // ID null berarti episode baru
        title: '',
        url: '',
        duration: ''
    };
    episodesData.push(newEpisode);
    renderEpisodesList();
    updateEpisodeCount();
}

function confirmRemoveEpisode(index) {
    deleteEpisodeIndex = index;
    deleteEpisodeId = episodesData[index]?.id || null;
    
    const episodeNum = index + 1;
    const messageEl = document.getElementById('deleteEpisodeMessage');
    if (messageEl) {
        messageEl.textContent = `Apakah Anda yakin ingin menghapus Episode ${episodeNum}?`;
    }
    const modal = document.getElementById('deleteEpisodeModal');
    if (modal) modal.classList.add('show');
}

function removeEpisode() {
    if (deleteEpisodeIndex !== null) {
        episodesData.splice(deleteEpisodeIndex, 1);
        renderEpisodesList();
        updateEpisodeCount();
        closeDeleteEpisodeModal();
    }
}

function confirmDeleteEpisode() {
    removeEpisode();
}

function moveEpisodeUp(index) {
    if (index > 0) {
        const temp = episodesData[index];
        episodesData[index] = episodesData[index - 1];
        episodesData[index - 1] = temp;
        renderEpisodesList();
    }
}

function moveEpisodeDown(index) {
    if (index < episodesData.length - 1) {
        const temp = episodesData[index];
        episodesData[index] = episodesData[index + 1];
        episodesData[index + 1] = temp;
        renderEpisodesList();
    }
}

function sortEpisodesAscending() {
    episodesData.sort((a, b) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleA.localeCompare(titleB);
    });
    renderEpisodesList();
}

function sortEpisodesDescending() {
    episodesData.sort((a, b) => {
        const titleA = a.title || '';
        const titleB = b.title || '';
        return titleB.localeCompare(titleA);
    });
    renderEpisodesList();
}

function updateEpisodeCount() {
    const episodeInfo = document.getElementById('episodeInfo');
    const episodeCountDisplay = document.getElementById('episodeCountDisplay');
    const category = document.getElementById('category')?.value;
    
    if (episodeCountDisplay) {
        episodeCountDisplay.textContent = episodesData.length;
    }
    
    if (episodeInfo) {
        if (category === 'donghua' && episodesData.length > 0) {
            episodeInfo.style.display = 'flex';
        } else {
            episodeInfo.style.display = 'none';
        }
    }
}

// =====================================================
// FUNGSI SAVE EPISODE KE TABEL EPISODES
// =====================================================
async function saveEpisodes(movieId) {
    if (!episodesData.length) return;
    
    // Hapus episode lama jika ada ID (edit mode)
    if (currentMoviesId) {
        await supabaseClient
            .from('episodes')
            .delete()
            .eq('movie_id', movieId);
    }
    
    // Filter episode yang valid (punya URL)
    const validEpisodes = episodesData.filter(ep => ep.url && isValidUrl(ep.url));
    
    if (validEpisodes.length === 0) return;
    
    // Siapkan data untuk insert
    const episodesToInsert = validEpisodes.map((ep, index) => ({
        movie_id: movieId,
        episode_number: index + 1,
        title: ep.title || `Episode ${index + 1}`,
        video_url: ep.url,
        duration: ep.duration ? parseInt(ep.duration) : null
    }));
    
    const { error } = await supabaseClient
        .from('episodes')
        .insert(episodesToInsert);
        
    if (error) throw error;
    
    console.log(`${episodesToInsert.length} episode saved`);
}

// =====================================================
// FUNGSI VALIDASI
// =====================================================
function validateFormData(data) {
    const errors = [];
    
    if (!data.title || data.title.trim().length < 3) {
        errors.push('Judul harus minimal 3 karakter');
    }
    
    if (!data.thumbnail || !isValidUrl(data.thumbnail)) {
        errors.push('URL thumbnail tidak valid');
    }
    
    if (!data.category) {
        errors.push('Kategori harus dipilih');
    }
    
    if (data.category === 'film') {
        if (!data.video_url || !isValidUrl(data.video_url)) {
            errors.push('URL video harus diisi untuk film');
        }
    } else if (data.category === 'donghua') {
        const validEpisodes = episodesData.filter(ep => ep.url && isValidUrl(ep.url));
        if (validEpisodes.length === 0) {
            errors.push('Minimal harus ada 1 episode dengan URL valid untuk donghua');
        }
    }
    
    return errors;
}

function isValidUrl(string) {
    if (!string) return false;
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// =====================================================
// FUNGSI SAVE DATA - VERSI DENGAN TABEL EPISODES
// =====================================================
async function saveAllData() {
    const titleField = document.getElementById('title');
    const thumbnailField = document.getElementById('thumbnail');
    const categoryField = document.getElementById('category');
    const yearField = document.getElementById('year');
    const descriptionField = document.getElementById('description');
    const videoUrlField = document.getElementById('videoUrl');
    const durationField = document.getElementById('duration');
    const ratingField = document.getElementById('rating');
    
    const movieData = {
        title: titleField ? titleField.value.trim() : '',
        thumbnail: thumbnailField ? thumbnailField.value.trim() : '',
        category: categoryField ? categoryField.value : '',
        year: yearField && yearField.value ? parseInt(yearField.value) : null,
        description: descriptionField ? descriptionField.value.trim() || null : null,
        video_url: videoUrlField ? videoUrlField.value.trim() : null,
        updated_at: new Date()
    };
    
    if (durationField && durationField.value) {
        movieData.duration = parseInt(durationField.value);
    }
    
    if (ratingField && ratingField.value) {
        movieData.rating = parseFloat(ratingField.value);
    }
    
    const errors = validateFormData(movieData);
    if (errors.length > 0) {
        showToast(errors.join('\n'), 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    if (!submitBtn) return;
    
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;
    
    const moviesId = document.getElementById('moviesId')?.value;
    
    try {
        let movieId;
        
        if (moviesId) {
            // Update existing movie
            const { error } = await supabaseClient
                .from('movies')
                .update(movieData)
                .eq('id', moviesId);
                
            if (error) throw error;
            movieId = moviesId;
            showToast('Konten berhasil diupdate', 'success');
        } else {
            // Insert new movie
            const { data, error } = await supabaseClient
                .from('movies')
                .insert([{ 
                    ...movieData, 
                    created_at: new Date(), 
                    views: 0
                }])
                .select();
                
            if (error) throw error;
            movieId = data[0].id;
            showToast('Konten berhasil ditambahkan', 'success');
        }
        
        // Simpan episode ke tabel episodes
        await saveEpisodes(movieId);
        
        closeModal();
        await loadMovies();
        
    } catch (error) {
        console.error('Error saving movies:', error);
        showToast('Gagal menyimpan: ' + error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// =====================================================
// FUNGSI MODAL
// =====================================================
function openAddModal() {
    console.log('Opening add modal');
    currentMoviesId = null;
    episodesData = [];
    
    const modalTitle = document.getElementById('modalTitle');
    const moviesForm = document.getElementById('moviesForm');
    const moviesId = document.getElementById('moviesId');
    const thumbnailPreview = document.getElementById('thumbnailPreview');
    const previewPlaceholder = document.getElementById('previewPlaceholder');
    const charCount = document.getElementById('charCount');
    const episodeInfo = document.getElementById('episodeInfo');
    const videoUrlInput = document.getElementById('videoUrl');
    
    if (modalTitle) modalTitle.textContent = 'Tambah Konten Baru';
    if (moviesForm) moviesForm.reset();
    if (moviesId) moviesId.value = '';
    if (thumbnailPreview) thumbnailPreview.style.display = 'none';
    if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
    if (charCount) charCount.textContent = '0';
    if (episodeInfo) episodeInfo.style.display = 'none';
    
    if (videoUrlInput) {
        videoUrlInput.required = true;
        videoUrlInput.placeholder = 'https://example.com/video.mp4';
    }
    
    switchModalTab('info');
    
    const modal = document.getElementById('moviesModal');
    if (modal) modal.classList.add('show');
}

function closeModal() {
    console.log('Closing modal');
    const modal = document.getElementById('moviesModal');
    if (modal) modal.classList.remove('show');
    
    const moviesForm = document.getElementById('moviesForm');
    if (moviesForm) moviesForm.reset();
    
    episodesData = [];
    currentMoviesId = null;
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.remove('show');
    deleteMoviesId = null;
}

function closeDeleteEpisodeModal() {
    const modal = document.getElementById('deleteEpisodeModal');
    if (modal) modal.classList.remove('show');
    deleteEpisodeIndex = null;
    deleteEpisodeId = null;
}

// =====================================================
// FUNGSI EDIT MOVIES - DENGAN LOAD EPISODE DARI TABEL EPISODES
// =====================================================
async function editMovies(id) {
    console.log('Editing movies:', id);
    
    showToast('Memuat data...', 'info');
    
    try {
        const { data: movie, error } = await supabaseClient
            .from('movies')
            .select('*')
            .eq('id', id)
            .single();
            
        if (error) throw error;
        if (!movie) throw new Error('Data tidak ditemukan');
        
        console.log('Movies data loaded:', movie);
        currentMoviesId = id;
        
        // Load episodes dari tabel episodes
        const { data: episodes, error: episodesError } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('movie_id', id)
            .order('episode_number', { ascending: true });
            
        if (!episodesError && episodes) {
            episodesData = episodes.map(ep => ({
                id: ep.id,
                title: ep.title || '',
                url: ep.video_url || '',
                duration: ep.duration || ''
            }));
        } else {
            episodesData = [];
        }
        
        // Set form values
        document.getElementById('modalTitle').textContent = 'Edit Konten';
        document.getElementById('moviesId').value = movie.id || '';
        document.getElementById('title').value = movie.title || '';
        document.getElementById('thumbnail').value = movie.thumbnail || '';
        document.getElementById('category').value = movie.category || '';
        document.getElementById('year').value = movie.year || '';
        document.getElementById('description').value = movie.description || '';
        document.getElementById('videoUrl').value = movie.video_url || '';
        document.getElementById('duration').value = movie.duration || '';
        document.getElementById('rating').value = movie.rating || '';
        
        updateCharCount();
        
        const preview = document.getElementById('thumbnailPreview');
        const placeholder = document.getElementById('previewPlaceholder');
        
        if (preview && placeholder && movie.thumbnail) {
            preview.src = movie.thumbnail;
            preview.style.display = 'block';
            placeholder.style.display = 'none';
        }
        
        handleCategoryChange();
        updateEpisodeCount();
        switchModalTab('info');
        
        const modal = document.getElementById('moviesModal');
        if (modal) modal.classList.add('show');
        
    } catch (error) {
        console.error('Error loading movies for edit:', error);
        showToast('Gagal memuat data: ' + error.message, 'error');
    }
}

// =====================================================
// FUNGSI DELETE MOVIES
// =====================================================
function deleteMovies(id) {
    console.log('Preparing to delete movies:', id);
    deleteMoviesId = id;
    
    const movie = moviesData.find(m => m.id === id);
    const message = movie ? `Apakah Anda yakin ingin menghapus "${movie.title}"?` : 'Apakah Anda yakin ingin menghapus konten ini?';
    
    const deleteMessage = document.getElementById('deleteMessage');
    if (deleteMessage) deleteMessage.textContent = message;
    
    const modal = document.getElementById('deleteModal');
    if (modal) modal.classList.add('show');
}

async function confirmDelete() {
    if (!deleteMoviesId) return;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    if (!confirmBtn) return;
    
    const originalText = confirmBtn.innerHTML;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menghapus...';
    confirmBtn.disabled = true;
    
    try {
        // Episode akan otomatis terhapus karena foreign key CASCADE
        const { error } = await supabaseClient
            .from('movies')
            .delete()
            .eq('id', deleteMoviesId);
            
        if (error) throw error;
        
        showToast('Konten berhasil dihapus', 'success');
        closeDeleteModal();
        await loadMovies();
        
    } catch (error) {
        console.error('Error deleting movies:', error);
        showToast('Gagal menghapus: ' + error.message, 'error');
    } finally {
        confirmBtn.innerHTML = originalText;
        confirmBtn.disabled = false;
    }
}

// =====================================================
// FUNGSI LOGOUT
// =====================================================
async function logout() {
    console.log('Logging out');
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        
        localStorage.removeItem('isAdmin');
        showToast('Berhasil keluar', 'success');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Gagal keluar', 'error');
    }
}

// =====================================================
// FUNGSI TOAST NOTIFICATION
// =====================================================
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const messages = message.split('\n');
    const messageHtml = messages.map(msg => `<div>${msg}</div>`).join('');
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <div class="toast-content">${messageHtml}</div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}