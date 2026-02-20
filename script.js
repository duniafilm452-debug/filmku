// script.js - FilmKu v7.0 - Versi stabil dengan perbaikan lengkap

// ==================== KONFIGURASI ====================
const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
  ITEMS_PER_PAGE: 20,
  DEBOUNCE_DELAY: 300
};

// ==================== INISIALISASI SUPABASE ====================
let supabaseClient = null;

function initSupabase() {
  try {
    if (typeof supabase === 'undefined') {
      throw new Error('Library Supabase tidak termuat. Periksa koneksi internet Anda.');
    }
    supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return true;
  } catch (err) {
    console.error('Gagal inisialisasi Supabase:', err.message);
    showFatalError(err.message);
    return false;
  }
}

// ==================== STATE APLIKASI ====================
const State = {
  movies: [],
  currentTab: 'rekomendasi',
  currentCategory: 'all',
  currentPage: 1,
  searchTerm: '',
  filteredCache: null,
  isLoading: false,
  // Urutan acak disimpan agar tidak berubah saat re-render
  shuffledOrder: [],

  getFilteredMovies() {
    if (this.filteredCache) return this.filteredCache;

    let filtered = this.movies.filter(movie => {
      const catMatch = this.currentCategory === 'all' || movie.category === this.currentCategory;
      const titleMatch = (movie.title || '').toLowerCase().includes(this.searchTerm.toLowerCase());
      return catMatch && titleMatch;
    });

    if (this.currentTab === 'populer') {
      // Gunakan tabel popular_movies_7days untuk tab populer
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (this.currentTab === 'terbaru') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      // Rekomendasi: gunakan urutan acak yang sudah tersimpan
      if (this.shuffledOrder.length === 0 || this.shuffledOrder.length !== filtered.length) {
        // Buat urutan acak baru hanya jika belum ada atau jumlah berubah
        this.shuffledOrder = [...filtered].sort(() => Math.random() - 0.5);
      }
      filtered = this.shuffledOrder.filter(m =>
        filtered.some(f => f.id === m.id)
      );
    }

    this.filteredCache = filtered;
    return filtered;
  },

  invalidateCache() {
    this.filteredCache = null;
  },

  invalidateCacheAndShuffle() {
    this.filteredCache = null;
    this.shuffledOrder = [];
  },

  resetPagination() {
    this.currentPage = 1;
  }
};

// ==================== ELEMEN DOM ====================
const DOM = {
  moviesList: null,
  searchInput: null,
  scrollTopBtn: null,
  tabButtons: {},
  categoryButtons: {},

  init() {
    this.moviesList = document.getElementById('moviesList');
    this.searchInput = document.getElementById('searchInput');
    this.scrollTopBtn = document.getElementById('scrollTopBtn');
    this.tabButtons = {
      rekomendasi: document.getElementById('tabRekomendasi'),
      populer: document.getElementById('tabPopuler'),
      terbaru: document.getElementById('tabTerbaru')
    };
    this.categoryButtons = {
      all: document.getElementById('catAll'),
      film: document.getElementById('catFilm'),
      donghua: document.getElementById('catDonghua')
    };
  }
};

// ==================== FUNGSI UI ====================
const UI = {
  // SVG placeholder inline untuk menghindari request 404
  PLACEHOLDER_SVG: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='450'%3E%3Crect width='300' height='450' fill='%23252525'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='16'%3ENo Image%3C/text%3E%3C/svg%3E",

  createMovieCard(movie) {
    const thumb = movie.thumbnail || this.PLACEHOLDER_SVG;
    // Hitung jumlah episode: prioritaskan total_episodes dari kolom DB
    const episodeCount = movie.total_episodes ||
      (Array.isArray(movie.episode_urls) ? movie.episode_urls.length : 0) ||
      movie.episodes || 0;

    const categoryLabel = movie.category === 'donghua' ? 'Donghua' : 'Film';
    const views = this.formatNumber(movie.views || 0);
    const year = movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : '');

    return `
      <article class="movie-card" onclick="window.location.href='player.html?id=${movie.id}'" 
               role="button" tabindex="0" aria-label="Tonton ${this.escapeHtml(movie.title)}"
               onkeydown="if(event.key==='Enter') window.location.href='player.html?id=${movie.id}'">
        <div class="movie-poster">
          <img src="${this.escapeHtml(thumb)}"
               alt="${this.escapeHtml(movie.title)}"
               loading="lazy"
               onerror="this.onerror=null;this.src='${this.PLACEHOLDER_SVG}'">
          <span class="movie-category ${this.escapeHtml(movie.category || 'film')}">${categoryLabel}</span>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${this.escapeHtml(movie.title || 'Judul tidak tersedia')}</h3>
          <div class="movie-meta">
            <span><i class="fas fa-eye" aria-hidden="true"></i> ${views}</span>
            ${episodeCount > 0 ? `<span><i class="fas fa-list" aria-hidden="true"></i> ${episodeCount} eps</span>` : ''}
            ${year ? `<span><i class="fas fa-calendar" aria-hidden="true"></i> ${year}</span>` : ''}
          </div>
        </div>
      </article>`;
  },

  renderMovies() {
    if (!DOM.moviesList) return;

    const filtered = State.getFilteredMovies();

    if (!filtered.length) {
      DOM.moviesList.innerHTML = `
        <div class="empty-state" role="status">
          <i class="fas fa-film" aria-hidden="true"></i>
          <p>${State.searchTerm ? 'Tidak ada hasil untuk "' + this.escapeHtml(State.searchTerm) + '"' : 'Tidak ada film ditemukan'}</p>
        </div>`;
      return;
    }

    const start = (State.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, end);
    const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE);

    let html = paginated.map(m => this.createMovieCard(m)).join('');

    if (totalPages > 1) {
      html += `
        <div class="pagination-controls" role="navigation" aria-label="Navigasi halaman">
          <button class="pagination-btn" onclick="prevPage()" ${State.currentPage === 1 ? 'disabled aria-disabled="true"' : ''} aria-label="Halaman sebelumnya">
            <i class="fas fa-chevron-left" aria-hidden="true"></i> Prev
          </button>
          <span class="page-info" aria-live="polite">${State.currentPage} / ${totalPages}</span>
          <button class="pagination-btn" onclick="nextPage()" ${State.currentPage === totalPages ? 'disabled aria-disabled="true"' : ''} aria-label="Halaman berikutnya">
            Next <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>`;
    }

    DOM.moviesList.innerHTML = html;

    if (State.currentPage > 1) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  setActiveTab(tab) {
    Object.keys(DOM.tabButtons).forEach(key => {
      const btn = DOM.tabButtons[key];
      if (btn) {
        btn.classList.toggle('active', key === tab);
        btn.setAttribute('aria-pressed', key === tab ? 'true' : 'false');
      }
    });
  },

  setActiveCategory(cat) {
    Object.keys(DOM.categoryButtons).forEach(key => {
      const btn = DOM.categoryButtons[key];
      if (btn) {
        btn.classList.toggle('active', key === cat);
        btn.setAttribute('aria-pressed', key === cat ? 'true' : 'false');
      }
    });
  },

  showLoading() {
    if (DOM.moviesList) {
      DOM.moviesList.innerHTML = `
        <div class="loading-state" role="status" aria-live="polite">
          <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
          <p>Memuat data...</p>
        </div>`;
    }
  },

  // Sanitasi HTML untuk mencegah XSS
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  // Format angka dengan suffix K/Jt
  formatNumber(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
    return num.toString();
  }
};

// ==================== TAMPILAN ERROR FATAL ====================
function showFatalError(message) {
  const container = document.getElementById('moviesList');
  if (container) {
    container.innerHTML = `
      <div class="empty-state" role="alert">
        <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
        <p>Gagal memuat: ${UI.escapeHtml(message)}</p>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 20px;background:#e50914;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:14px;">
          <i class="fas fa-redo"></i> Coba Lagi
        </button>
      </div>`;
  }
}

// ==================== FUNGSI GLOBAL (dipanggil dari HTML) ====================
window.loadTab = (tab) => {
  if (State.currentTab === tab) return; // Tidak perlu reload jika tab sama
  State.currentTab = tab;
  State.resetPagination();
  // Jika pindah ke rekomendasi, buat urutan acak baru
  if (tab === 'rekomendasi') {
    State.invalidateCacheAndShuffle();
  } else {
    State.invalidateCache();
  }
  UI.setActiveTab(tab);
  UI.renderMovies();
};

window.filterCategory = (cat) => {
  if (State.currentCategory === cat) return;
  State.currentCategory = cat;
  State.resetPagination();
  State.invalidateCache();
  UI.setActiveCategory(cat);
  UI.renderMovies();
};

window.prevPage = () => {
  if (State.currentPage > 1) {
    State.currentPage--;
    UI.renderMovies();
  }
};

window.nextPage = () => {
  const filtered = State.getFilteredMovies();
  const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE);
  if (State.currentPage < totalPages) {
    State.currentPage++;
    UI.renderMovies();
  }
};

window.scrollToTop = () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ==================== INISIALISASI UTAMA ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Inisialisasi elemen DOM
  DOM.init();
  UI.showLoading();

  // Inisialisasi Supabase — hentikan jika gagal
  if (!initSupabase()) return;

  try {
    // Ambil data dari tabel movie_details
    // Kolom yang diambil sesuai struktur tabel: id, title, category, description,
    // year, thumbnail, video_url, episode_urls, episodes, rating, views,
    // created_at, total_episodes
    const { data, error } = await supabaseClient
      .from('movie_details')
      .select('id, title, category, thumbnail, video_url, episode_urls, episodes, views, year, release_date, created_at, total_episodes, rating')
      .order('created_at', { ascending: false });

    if (error) throw error;

    State.movies = data || [];

    // Buat urutan acak awal untuk tab rekomendasi
    State.shuffledOrder = [...State.movies].sort(() => Math.random() - 0.5);

    UI.renderMovies();

    // ---- EVENT: Pencarian dengan debounce ----
    if (DOM.searchInput) {
      let searchTimeout;
      DOM.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          State.searchTerm = e.target.value.trim();
          State.resetPagination();
          State.invalidateCache();
          UI.renderMovies();
        }, CONFIG.DEBOUNCE_DELAY);
      });
    }

    // ---- EVENT: Scroll to top button ----
    window.addEventListener('scroll', () => {
      if (DOM.scrollTopBtn) {
        DOM.scrollTopBtn.classList.toggle('show', window.scrollY > 400);
      }
    }, { passive: true });

  } catch (err) {
    console.error('Error memuat data film:', err);
    showFatalError(err.message || 'Terjadi kesalahan saat memuat data.');
  }
});