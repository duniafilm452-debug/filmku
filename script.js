// script.js - VERSI TERBAIK dengan struktur tabel movie_details

const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
  ITEMS_PER_PAGE: 20,
  DEBOUNCE_DELAY: 300
};

// Initialize Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// App State
const State = {
  movies: [],
  currentTab: 'rekomendasi',
  currentCategory: 'all',
  currentPage: 1,
  searchTerm: '',
  filteredCache: null,
  isLoading: false,
  
  getFilteredMovies() {
    if (this.filteredCache) return this.filteredCache;
    
    let filtered = this.movies.filter(movie => {
      const catMatch = this.currentCategory === 'all' || movie.category === this.currentCategory;
      const searchMatch = movie.title.toLowerCase().includes(this.searchTerm.toLowerCase());
      return catMatch && searchMatch;
    });

    if (this.currentTab === 'populer') {
      filtered.sort((a, b) => (b.views || 0) - (a.views || 0));
    } else if (this.currentTab === 'terbaru') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else {
      filtered = [...filtered].sort(() => Math.random() - 0.5);
    }
    
    this.filteredCache = filtered;
    return filtered;
  },
  
  invalidateCache() {
    this.filteredCache = null;
  },
  
  resetPagination() {
    this.currentPage = 1;
  }
};

// DOM Elements
const DOM = {
  moviesList: document.getElementById('moviesList'),
  searchInput: document.getElementById('searchInput'),
  scrollTopBtn: document.getElementById('scrollTopBtn'),
  tabButtons: {
    rekomendasi: document.getElementById('tabRekomendasi'),
    populer: document.getElementById('tabPopuler'),
    terbaru: document.getElementById('tabTerbaru')
  },
  categoryButtons: {
    all: document.getElementById('catAll'),
    film: document.getElementById('catFilm'),
    donghua: document.getElementById('catDonghua')
  }
};

// UI Functions
const UI = {
  createMovieCard(movie) {
    const thumb = movie.thumbnail || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'450\' viewBox=\'0 0 300 450\'%3E%3Crect width=\'300\' height=\'450\' fill=\'%23252525\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23666666\' font-family=\'Arial\' font-size=\'20\'%3ENo Image%3C/text%3E%3C/svg%3E';
    
    const episodeCount = movie.total_episodes || (movie.episode_urls ? movie.episode_urls.length : 0) || movie.episodes || 0;
    
    return `
      <article class="movie-card" onclick="window.location.href='player.html?id=${movie.id}'">
        <div class="movie-poster">
          <img src="${thumb}" alt="${movie.title}" loading="lazy" 
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'300\' height=\'450\' viewBox=\'0 0 300 450\'%3E%3Crect width=\'300\' height=\'450\' fill=\'%23252525\'/%3E%3Ctext x=\'50%25\' y=\'50%25\' dominant-baseline=\'middle\' text-anchor=\'middle\' fill=\'%23666666\' font-family=\'Arial\' font-size=\'20\'%3EError%3C/text%3E%3C/svg%3E'">
          <span class="movie-category ${movie.category}">${movie.category}</span>
        </div>
        <div class="movie-info">
          <h3 class="movie-title">${movie.title}</h3>
          <div class="movie-meta">
            <span><i class="fas fa-eye"></i> ${movie.views || 0}</span>
            ${episodeCount > 0 ? `<span><i class="fas fa-list"></i> ${episodeCount} eps</span>` : ''}
            ${movie.year ? `<span><i class="fas fa-calendar"></i> ${movie.year}</span>` : ''}
          </div>
        </div>
      </article>`;
  },

  renderMovies() {
    const filtered = State.getFilteredMovies();
    
    if (!filtered.length) {
      DOM.moviesList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-film"></i>
          <p>Tidak ada film ditemukan</p>
        </div>`;
      return;
    }

    const start = (State.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const end = start + CONFIG.ITEMS_PER_PAGE;
    const paginated = filtered.slice(start, end);
    
    let html = paginated.map(m => this.createMovieCard(m)).join('');
    
    const totalPages = Math.ceil(filtered.length / CONFIG.ITEMS_PER_PAGE);
    if (totalPages > 1) {
      html += `
        <div class="pagination-controls">
          <button class="pagination-btn" onclick="prevPage()" ${State.currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Prev
          </button>
          <span class="page-info">${State.currentPage} / ${totalPages}</span>
          <button class="pagination-btn" onclick="nextPage()" ${State.currentPage === totalPages ? 'disabled' : ''}>
            Next <i class="fas fa-chevron-right"></i>
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
      if (DOM.tabButtons[key]) DOM.tabButtons[key].classList.remove('active');
    });
    if (DOM.tabButtons[tab]) DOM.tabButtons[tab].classList.add('active');
  },

  setActiveCategory(cat) {
    Object.keys(DOM.categoryButtons).forEach(key => {
      if (DOM.categoryButtons[key]) DOM.categoryButtons[key].classList.remove('active');
    });
    if (DOM.categoryButtons[cat]) DOM.categoryButtons[cat].classList.add('active');
  },

  showLoading() {
    DOM.moviesList.innerHTML = `
      <div class="loading-state">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Memuat data...</p>
      </div>`;
  },

  hideLoading() {}
};

// Global functions
window.loadTab = (tab) => {
  State.currentTab = tab;
  State.resetPagination();
  State.invalidateCache();
  UI.setActiveTab(tab);
  UI.renderMovies();
};

window.filterCategory = (cat) => {
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

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  UI.showLoading();
  
  try {
    const { data, error } = await supabaseClient
      .from('movie_details')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    State.movies = data || [];
    UI.renderMovies();
    
    let searchTimeout;
    DOM.searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        State.searchTerm = e.target.value;
        State.resetPagination();
        State.invalidateCache();
        UI.renderMovies();
      }, CONFIG.DEBOUNCE_DELAY);
    });
    
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        DOM.scrollTopBtn.classList.add('show');
      } else {
        DOM.scrollTopBtn.classList.remove('show');
      }
    });
    
  } catch (error) {
    console.error('Error loading movies:', error);
    DOM.moviesList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <p>Gagal memuat data: ${error.message}</p>
        <button onclick="location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #e50914; border: none; border-radius: 4px; color: white; cursor: pointer;">Refresh</button>
      </div>`;
  }
});