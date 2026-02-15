/**
 * script.js - Halaman Utama FilmKu
 * Versi Profesional 3.0
 * 
 * Fitur:
 * - Manajemen state yang lebih baik
 * - Error handling yang komprehensif
 * - Performance optimasi
 * - Accessibility improvements
 */

// =====================================================
// KONFIGURASI
// =====================================================
const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
  ITEMS_PER_PAGE: 50,
  DEBOUNCE_DELAY: 300,
  SCROLL_THRESHOLD: 400
};

// =====================================================
// INITIALIZATION
// =====================================================
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================================
// STATE MANAGEMENT
// =====================================================
const State = {
  movies: [],
  currentTab: 'rekomendasi',
  currentCategory: 'all',
  currentPage: 1,
  isLoading: false,
  searchTerm: '',
  
  // Cache untuk hasil filter
  _filteredCache: null,
  
  getFilteredMovies() {
    if (this._filteredCache) return this._filteredCache;
    
    let filtered = this.movies.filter(movie => {
      if (!movie?.title) return false;
      
      const categoryMatch = this.currentCategory === 'all' || movie.category === this.currentCategory;
      const searchMatch = movie.title.toLowerCase().includes(this.searchTerm.toLowerCase());
      return categoryMatch && searchMatch;
    });
    
    // Apply tab logic
    switch (this.currentTab) {
      case 'rekomendasi':
        filtered = this._shuffleArray(filtered);
        break;
      case 'populer':
        filtered = filtered
          .filter(m => (m.views || 0) > 0)
          .sort((a, b) => (b.views || 0) - (a.views || 0));
        break;
      case 'terbaru':
        filtered.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
          const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
          return dateB - dateA;
        });
        break;
    }
    
    this._filteredCache = filtered;
    return filtered;
  },
  
  _shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },
  
  invalidateCache() {
    this._filteredCache = null;
  },
  
  resetPagination() {
    this.currentPage = 1;
  }
};

// =====================================================
// DOM ELEMENTS
// =====================================================
const DOM = {
  moviesList: document.getElementById('moviesList'),
  searchInput: document.getElementById('searchInput'),
  scrollTopBtn: document.getElementById('scrollTopBtn'),
  
  updateMoviesList(html) {
    if (this.moviesList) this.moviesList.innerHTML = html;
  },
  
  showLoading() {
    this.updateMoviesList(`
      <div class="loading-state" role="status" aria-label="Memuat">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <p>Memuat data...</p>
      </div>
    `);
  },
  
  showError(message) {
    this.updateMoviesList(`
      <div class="error-state" role="alert">
        <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
        <p>${message}</p>
        <button onclick="location.reload()" class="retry-btn">
          <i class="fas fa-redo" aria-hidden="true"></i>
          Coba Lagi
        </button>
      </div>
    `);
  },
  
  showNoResults() {
    this.updateMoviesList(`
      <div class="empty-state">
        <i class="fas fa-film" aria-hidden="true"></i>
        <p>Tidak ada film ditemukan</p>
      </div>
    `);
  }
};

// =====================================================
// DATA FETCHING
// =====================================================
const DataService = {
  async fetchMovies() {
    try {
      const { data, error } = await supabaseClient
        .from('movies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[DataService] Error fetching movies:', error);
      throw error;
    }
  },
  
  async fetchEpisodeCounts(movieIds) {
    if (!movieIds.length) return {};
    
    try {
      const { data: episodes, error } = await supabaseClient
        .from('episodes')
        .select('movie_id');
        
      if (error) throw error;
      
      const countMap = {};
      episodes?.forEach(ep => {
        countMap[ep.movie_id] = (countMap[ep.movie_id] || 0) + 1;
      });
      
      return countMap;
    } catch (error) {
      console.error('[DataService] Error fetching episode counts:', error);
      return {};
    }
  },
  
  async loadAllData() {
    if (State.isLoading) return;
    
    State.isLoading = true;
    DOM.showLoading();
    
    try {
      console.log('[FilmKu] Loading movies...');
      const movies = await this.fetchMovies();
      
      if (!movies.length) {
        DOM.showNoResults();
        return;
      }
      
      const episodeCounts = await this.fetchEpisodeCounts(movies.map(m => m.id));
      
      State.movies = movies.map(movie => ({
        ...movie,
        episode_count: episodeCounts[movie.id] || 0
      }));
      
      State.invalidateCache();
      State.resetPagination();
      UI.renderMovies();
      
      console.log(`[FilmKu] Loaded ${movies.length} movies successfully`);
    } catch (error) {
      console.error('[FilmKu] Failed to load data:', error);
      DOM.showError('Gagal memuat data. Periksa koneksi internet Anda.');
    } finally {
      State.isLoading = false;
    }
  }
};

// =====================================================
// UI RENDERING
// =====================================================
const UI = {
  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'jt';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'rb';
    return num.toString();
  },
  
  createMovieCard(movie) {
    const year = movie.year || '-';
    const thumbnail = movie.thumbnail || 'https://via.placeholder.com/300x450?text=No+Image';
    const categoryLabel = movie.category === 'film' ? '🎬 Film' : '📺 Donghua';
    const categoryClass = movie.category || 'film';
    const episodeCount = movie.episode_count || 0;
    
    const episodeBadge = episodeCount > 1 
      ? `<span class="episode-badge"><i class="fas fa-list"></i> ${episodeCount} ep</span>` 
      : '';
    
    const viewsBadge = movie.views 
      ? `<span class="views-badge"><i class="fas fa-eye"></i> ${this.formatNumber(movie.views)}</span>` 
      : '';
    
    return `
      <article class="movie-card" onclick="window.location.href='player.html?id=${movie.id}'">
        <div class="movie-poster">
          <img 
            src="${thumbnail}" 
            alt="${movie.title}" 
            loading="lazy"
            onerror="this.src='https://via.placeholder.com/300x450?text=Error'"
          >
          <span class="movie-category ${categoryClass}">${categoryLabel}</span>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${movie.title}</h3>
          <div class="movie-meta">
            ${year !== '-' ? `<span class="movie-year"><i class="fas fa-calendar-alt"></i> ${year}</span>` : ''}
            ${viewsBadge}
            ${episodeBadge}
          </div>
        </div>
      </article>
    `;
  },
  
  renderMovies() {
    if (!DOM.moviesList) return;
    
    const filteredMovies = State.getFilteredMovies();
    
    if (!filteredMovies.length) {
      DOM.showNoResults();
      return;
    }
    
    const totalPages = Math.ceil(filteredMovies.length / CONFIG.ITEMS_PER_PAGE);
    const start = (State.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = Math.min(start + CONFIG.ITEMS_PER_PAGE, filteredMovies.length);
    const paginatedMovies = filteredMovies.slice(start, end);
    
    let html = '<div class="movies-grid">';
    paginatedMovies.forEach(movie => {
      html += this.createMovieCard(movie);
    });
    html += '</div>';
    
    // Pagination info
    html += `
      <div class="pagination-info" role="status" aria-label="Informasi halaman">
        <p>Menampilkan <strong>${start + 1}</strong> - <strong>${end}</strong> dari <strong>${filteredMovies.length}</strong> film</p>
      </div>
    `;
    
    // Pagination controls
    if (totalPages > 1) {
      html += `
        <div class="pagination-controls" role="navigation" aria-label="Navigasi halaman">
          <button 
            class="pagination-btn" 
            onclick="Navigation.prevPage()" 
            ${State.currentPage === 1 ? 'disabled' : ''}
            aria-label="Halaman sebelumnya"
          >
            <i class="fas fa-chevron-left" aria-hidden="true"></i>
            <span>Sebelumnya</span>
          </button>
          <span class="page-info">Halaman ${State.currentPage} dari ${totalPages}</span>
          <button 
            class="pagination-btn" 
            onclick="Navigation.nextPage()" 
            ${State.currentPage === totalPages ? 'disabled' : ''}
            aria-label="Halaman berikutnya"
          >
            <span>Selanjutnya</span>
            <i class="fas fa-chevron-right" aria-hidden="true"></i>
          </button>
        </div>
      `;
    }
    
    DOM.updateMoviesList(html);
  }
};

// =====================================================
// NAVIGATION
// =====================================================
const Navigation = {
  nextPage() {
    const filteredMovies = State.getFilteredMovies();
    const totalPages = Math.ceil(filteredMovies.length / CONFIG.ITEMS_PER_PAGE);
    
    if (State.currentPage < totalPages) {
      State.currentPage++;
      UI.renderMovies();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },
  
  prevPage() {
    if (State.currentPage > 1) {
      State.currentPage--;
      UI.renderMovies();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },
  
  loadTab(tab) {
    console.log('[Navigation] Switching to tab:', tab);
    State.currentTab = tab;
    State.resetPagination();
    State.invalidateCache();
    
    // Update active tab
    document.querySelectorAll('.tabs button').forEach(btn => btn.classList.remove('active'));
    const tabMap = { rekomendasi: 'tabRekomendasi', populer: 'tabPopuler', terbaru: 'tabTerbaru' };
    document.getElementById(tabMap[tab])?.classList.add('active');
    
    UI.renderMovies();
  },
  
  filterCategory(cat) {
    console.log('[Navigation] Filtering category:', cat);
    State.currentCategory = cat;
    State.resetPagination();
    State.invalidateCache();
    
    // Update active category
    document.querySelectorAll('.kategori button').forEach(btn => btn.classList.remove('active'));
    const catMap = { all: 'catAll', film: 'catFilm', donghua: 'catDonghua' };
    document.getElementById(catMap[cat])?.classList.add('active');
    
    UI.renderMovies();
  },
  
  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// =====================================================
// SEARCH HANDLER
// =====================================================
const SearchHandler = {
  debounceTimer: null,
  
  handleInput(value) {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      State.searchTerm = value;
      State.resetPagination();
      State.invalidateCache();
      UI.renderMovies();
      console.log('[Search] Term:', value);
    }, CONFIG.DEBOUNCE_DELAY);
  }
};

// =====================================================
// EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  // Search input
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', (e) => {
      SearchHandler.handleInput(e.target.value);
    });
  }
  
  // Scroll to top button visibility
  window.addEventListener('scroll', () => {
    if (DOM.scrollTopBtn) {
      DOM.scrollTopBtn.classList.toggle('show', window.scrollY > CONFIG.SCROLL_THRESHOLD);
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // ESC to clear search
    if (e.key === 'Escape' && DOM.searchInput === document.activeElement) {
      DOM.searchInput.value = '';
      SearchHandler.handleInput('');
      DOM.searchInput.blur();
    }
  });
}

// =====================================================
// EXPOSE GLOBALS
// =====================================================
window.loadTab = Navigation.loadTab.bind(Navigation);
window.filterCategory = Navigation.filterCategory.bind(Navigation);
window.scrollToTop = Navigation.scrollToTop.bind(Navigation);
window.nextPage = Navigation.nextPage.bind(Navigation);
window.prevPage = Navigation.prevPage.bind(Navigation);

// =====================================================
// INITIALIZE
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[FilmKu] Application starting...');
  
  // Verify DOM elements
  if (!DOM.moviesList) console.error('[FilmKu] Critical: #moviesList not found');
  if (!DOM.searchInput) console.warn('[FilmKu] #searchInput not found');
  
  setupEventListeners();
  await DataService.loadAllData();
  
  console.log('[FilmKu] Application ready');
});

// =====================================================
// DEBUG TOOLS
// =====================================================
window.debug = {
  getState: () => State,
  reload: () => DataService.loadAllData(),
  testConnection: async () => {
    const { data, error } = await supabaseClient.from('movies').select('count');
    console.log('Connection test:', { data, error });
  }
};