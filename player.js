/**
 * player.js - Halaman Player FilmKu
 * Version: 2.0 - Professional
 * 
 * Fitur:
 * - Modular architecture
 * - Comprehensive error handling
 * - Optimized performance
 * - Accessibility support
 */

// =====================================================
// KONFIGURASI
// =====================================================
const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
  MAX_RECOMMENDATIONS: 8,
  MAX_COMMENT_LENGTH: 500,
  TOAST_DURATION: 3000
};

// =====================================================
// INITIALIZATION
// =====================================================
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================================
// STATE MANAGEMENT
// =====================================================
const State = {
  currentMovie: null,
  allMovies: [],
  episodes: [],
  currentEpisode: 1,
  comments: [],
  isLoading: true,
  
  get totalEpisodes() {
    return this.episodes.length;
  },
  
  get videoUrl() {
    if (!this.currentMovie) return '';
    
    // Cari di episodes dulu
    if (this.episodes.length > 0) {
      const episode = this.episodes.find(ep => ep.episode_number === this.currentEpisode);
      if (episode?.video_url) return episode.video_url;
    }
    
    // Fallback ke video_url di movies
    return this.currentMovie.video_url || '';
  },
  
  reset() {
    this.currentMovie = null;
    this.episodes = [];
    this.currentEpisode = 1;
    this.comments = [];
  }
};

// =====================================================
// URL PARAMETERS
// =====================================================
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
const episodeParam = urlParams.get('ep') ? parseInt(urlParams.get('ep')) : 1;

if (!movieId) {
  showError('ID film tidak ditemukan');
}

// =====================================================
// DOM ELEMENTS
// =====================================================
const DOM = {
  wrapper: document.getElementById('playerWrapper'),
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toastMessage'),
  loadingState: document.getElementById('loadingState'),
  shareModal: document.getElementById('shareModal'),
  shareLink: document.getElementById('shareLink'),
  
  showLoading() {
    if (this.loadingState) {
      this.loadingState.style.display = 'flex';
    }
  },
  
  hideLoading() {
    if (this.loadingState) {
      this.loadingState.style.display = 'none';
    }
  },
  
  updateContent(html) {
    if (this.wrapper) {
      this.wrapper.innerHTML = html;
    }
  }
};

// =====================================================
// DATA SERVICE
// =====================================================
const DataService = {
  async fetchMovie() {
    const { data, error } = await supabaseClient
      .from('movies')
      .select('*')
      .eq('id', movieId)
      .single();
      
    if (error) throw error;
    return data;
  },
  
  async fetchEpisodes() {
    const { data, error } = await supabaseClient
      .from('episodes')
      .select('*')
      .eq('movie_id', movieId)
      .order('episode_number', { ascending: true });
      
    if (error) throw error;
    return data || [];
  },
  
  async fetchAllMovies() {
    const { data, error } = await supabaseClient
      .from('movies')
      .select('*')
      .limit(20);
      
    if (error) throw error;
    return data || [];
  },
  
  async fetchComments() {
    const { data, error } = await supabaseClient
      .from('comments')
      .select('*')
      .eq('movie_id', movieId)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    return data || [];
  },
  
  async updateViews() {
    if (!State.currentMovie) return;
    
    try {
      await supabaseClient
        .from('movies')
        .update({ 
          views: (State.currentMovie.views || 0) + 1,
          last_watched: new Date().toISOString()
        })
        .eq('id', movieId);
    } catch (error) {
      console.error('[DataService] Error updating views:', error);
    }
  },
  
  async postComment(content) {
    const { error } = await supabaseClient
      .from('comments')
      .insert([{
        movie_id: movieId,
        content: content,
        username: 'Pengguna' + Math.floor(Math.random() * 1000),
        created_at: new Date().toISOString(),
        likes: 0
      }]);
      
    if (error) throw error;
  },
  
  async likeComment(commentId, currentLikes) {
    const { error } = await supabaseClient
      .from('comments')
      .update({ likes: (currentLikes || 0) + 1 })
      .eq('id', commentId);
      
    if (error) throw error;
  }
};

// =====================================================
// UI RENDERER
// =====================================================
const UIRenderer = {
  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'jt';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'rb';
    return num.toString();
  },
  
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  },
  
  renderEpisodes() {
    if (!State.episodes.length || State.episodes.length <= 1) return '';
    
    const episodesHtml = State.episodes.map(ep => {
      const episodeNum = ep.episode_number;
      const isActive = episodeNum === State.currentEpisode;
      
      return `
        <div class="episode-card ${isActive ? 'active' : ''}" 
             onclick="Player.changeEpisode(${episodeNum})"
             role="button"
             tabindex="0"
             aria-label="Episode ${episodeNum}">
          <div class="episode-number">${episodeNum}</div>
          <div class="episode-info">
            <div class="episode-title">${ep.title || `Episode ${episodeNum}`}</div>
            <div class="episode-duration">
              <i class="fas fa-clock" aria-hidden="true"></i>
              ${ep.duration || '24'} menit
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <section class="episodes-section" aria-label="Daftar Episode">
        <h2 class="section-title">
          <i class="fas fa-list" aria-hidden="true"></i>
          Daftar Episode
          <span>${State.episodes.length} episode</span>
        </h2>
        <div class="episodes-grid">
          ${episodesHtml}
        </div>
      </section>
    `;
  },
  
  renderRecommendations() {
    if (!State.allMovies.length) {
      return '<p class="no-results">Tidak ada rekomendasi</p>';
    }
    
    const recommendations = State.allMovies
      .filter(m => m.id !== movieId)
      .sort(() => 0.5 - Math.random())
      .slice(0, CONFIG.MAX_RECOMMENDATIONS);
    
    const recommendationsHtml = recommendations.map(movie => {
      const thumbnail = movie.thumbnail || 'https://via.placeholder.com/300x450?text=No+Image';
      
      return `
        <div class="recommend-card" 
             onclick="window.location.href='player.html?id=${movie.id}'"
             role="button"
             tabindex="0"
             aria-label="${movie.title}">
          <img src="${thumbnail}" alt="${movie.title}" loading="lazy">
          <div class="recommend-info">
            <h4>${movie.title}</h4>
            <p>
              <i class="fas fa-eye" aria-hidden="true"></i>
              ${this.formatNumber(movie.views || 0)} ditonton
            </p>
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <section class="recommendations-section" aria-label="Rekomendasi">
        <h2 class="section-title">
          <i class="fas fa-thumbs-up" aria-hidden="true"></i>
          Rekomendasi Lainnya
        </h2>
        <div class="recommendations-grid">
          ${recommendationsHtml}
        </div>
      </section>
    `;
  },
  
  renderComments() {
    if (!State.comments.length) {
      return '<p class="no-results">Belum ada komentar. Jadilah yang pertama!</p>';
    }
    
    const commentsHtml = State.comments.map(comment => `
      <div class="comment-item">
        <div class="comment-avatar">
          <i class="fas fa-user" aria-hidden="true"></i>
        </div>
        <div class="comment-content">
          <div class="comment-header">
            <span class="comment-author">${comment.username || 'Pengguna'}</span>
            <span class="comment-date">${this.formatDate(comment.created_at)}</span>
          </div>
          <p class="comment-text">${comment.content}</p>
          <div class="comment-actions">
            <button class="comment-action" onclick="Player.likeComment('${comment.id}')">
              <i class="far fa-heart" aria-hidden="true"></i>
              ${comment.likes || 0}
            </button>
          </div>
        </div>
      </div>
    `).join('');
    
    return `
      <section class="comments-section" aria-label="Komentar">
        <h2 class="section-title">
          <i class="fas fa-comments" aria-hidden="true"></i>
          Komentar (${State.comments.length})
        </h2>
        
        <div class="comment-form">
          <div class="comment-avatar">
            <i class="fas fa-user" aria-hidden="true"></i>
          </div>
          <div class="comment-input-wrapper">
            <input type="text" 
                   id="commentInput" 
                   placeholder="Tulis komentar Anda..." 
                   maxlength="${CONFIG.MAX_COMMENT_LENGTH}"
                   aria-label="Tulis komentar">
            <button onclick="Player.postComment()" aria-label="Kirim komentar">
              <i class="fas fa-paper-plane" aria-hidden="true"></i>
              Kirim
            </button>
          </div>
        </div>
        
        <div class="comments-list">
          ${commentsHtml}
        </div>
      </section>
    `;
  },
  
  renderMainContent() {
    if (!State.currentMovie) return;
    
    const movie = State.currentMovie;
    const year = movie.year || '-';
    
    const html = `
      <div class="video-container">
        <video id="videoPlayer" class="video-player" controls controlslist="nodownload">
          <source src="${State.videoUrl}" type="video/mp4">
          Browser Anda tidak mendukung tag video.
        </video>
      </div>
      
      <div class="video-info-bar">
        <div class="video-stats">
          <div class="stat-item">
            <i class="fas fa-eye" aria-hidden="true"></i>
            <span><strong>${this.formatNumber(movie.views || 0)}</strong> ditonton</span>
          </div>
          <div class="stat-item">
            <i class="fas fa-calendar-alt" aria-hidden="true"></i>
            <span><strong>${year}</strong></span>
          </div>
          ${movie.duration ? `
          <div class="stat-item">
            <i class="fas fa-clock" aria-hidden="true"></i>
            <span><strong>${movie.duration}</strong> menit</span>
          </div>
          ` : ''}
          ${movie.rating ? `
          <div class="stat-item">
            <i class="fas fa-star" aria-hidden="true"></i>
            <span><strong>${movie.rating}</strong> / 10</span>
          </div>
          ` : ''}
        </div>
        
        <div class="video-actions">
          <button class="action-btn" onclick="Player.share()" aria-label="Bagikan">
            <i class="fas fa-share-alt" aria-hidden="true"></i>
            Bagikan
          </button>
          <button class="action-btn primary" onclick="Player.download()" aria-label="Unduh">
            <i class="fas fa-download" aria-hidden="true"></i>
            Unduh
          </button>
        </div>
      </div>
      
      <section class="movie-details" aria-label="Detail Film">
        <h1 class="movie-title">${movie.title}</h1>
        
        <div class="movie-meta">
          <div class="meta-item">
            <i class="fas fa-film" aria-hidden="true"></i>
            <span>Kategori: <strong>${movie.category === 'film' ? 'Film' : 'Donghua'}</strong></span>
          </div>
          ${movie.year ? `
          <div class="meta-item">
            <i class="fas fa-calendar-alt" aria-hidden="true"></i>
            <span>Tahun: <strong>${movie.year}</strong></span>
          </div>
          ` : ''}
          ${movie.duration ? `
          <div class="meta-item">
            <i class="fas fa-clock" aria-hidden="true"></i>
            <span>Durasi: <strong>${movie.duration} menit</strong></span>
          </div>
          ` : ''}
          ${movie.rating ? `
          <div class="meta-item">
            <i class="fas fa-star" aria-hidden="true"></i>
            <span>Rating: <strong>${movie.rating}/10</strong></span>
          </div>
          ` : ''}
        </div>
        
        <p class="movie-description">${movie.description || 'Deskripsi tidak tersedia.'}</p>
        
        ${State.episodes.length > 0 ? `
        <div class="movie-tags">
          <span class="tag">
            <i class="fas fa-list" aria-hidden="true"></i>
            ${State.episodes.length} Episode
          </span>
        </div>
        ` : ''}
      </section>
      
      ${this.renderEpisodes()}
      ${this.renderRecommendations()}
      ${this.renderComments()}
    `;
    
    DOM.updateContent(html);
    
    // Initialize video element
    const videoElement = document.getElementById('videoPlayer');
    if (videoElement) {
      videoElement.addEventListener('error', Player.handleVideoError);
    }
  }
};

// =====================================================
// PLAYER ACTIONS
// =====================================================
const Player = {
  async init() {
    DOM.showLoading();
    
    try {
      await this.loadData();
      
      if (State.currentMovie) {
        UIRenderer.renderMainContent();
        this.setupEventListeners();
        await DataService.updateViews();
      }
    } catch (error) {
      console.error('[Player] Initialization error:', error);
      showError('Gagal memuat data. Silakan coba lagi.');
    } finally {
      DOM.hideLoading();
    }
  },
  
  async loadData() {
    State.currentMovie = await DataService.fetchMovie();
    State.episodes = await DataService.fetchEpisodes();
    State.allMovies = await DataService.fetchAllMovies();
    State.comments = await DataService.fetchComments();
    
    // Set current episode
    State.currentEpisode = episodeParam;
    if (episodeParam > State.totalEpisodes) {
      State.currentEpisode = 1;
    }
  },
  
  changeEpisode(episode) {
    if (episode === State.currentEpisode) return;
    
    State.currentEpisode = episode;
    const newUrl = `player.html?id=${movieId}&ep=${episode}`;
    window.history.pushState({}, '', newUrl);
    
    // Update video source
    const videoElement = document.getElementById('videoPlayer');
    if (videoElement) {
      videoElement.src = State.videoUrl;
      videoElement.load();
      videoElement.play();
    }
    
    // Re-render to update active state
    UIRenderer.renderMainContent();
  },
  
  share() {
    if (!State.currentMovie) return;
    
    const modal = DOM.shareModal;
    const linkInput = DOM.shareLink;
    
    if (modal && linkInput) {
      linkInput.value = window.location.href;
      modal.classList.add('active');
    }
  },
  
  download() {
    if (!State.videoUrl) {
      showToast('Video tidak tersedia untuk diunduh', 'error');
      return;
    }
    
    const link = document.createElement('a');
    link.href = State.videoUrl;
    link.download = `${State.currentMovie.title} - Episode ${State.currentEpisode}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Download dimulai...');
  },
  
  async postComment() {
    const input = document.getElementById('commentInput');
    if (!input) return;
    
    const content = input.value.trim();
    
    if (!content) {
      showToast('Komentar tidak boleh kosong', 'error');
      return;
    }
    
    if (content.length > CONFIG.MAX_COMMENT_LENGTH) {
      showToast(`Komentar maksimal ${CONFIG.MAX_COMMENT_LENGTH} karakter`, 'error');
      return;
    }
    
    try {
      await DataService.postComment(content);
      
      input.value = '';
      showToast('Komentar berhasil diposting');
      
      // Refresh comments
      State.comments = await DataService.fetchComments();
      UIRenderer.renderMainContent();
      
    } catch (error) {
      console.error('[Player] Error posting comment:', error);
      showToast('Gagal memposting komentar', 'error');
    }
  },
  
  async likeComment(commentId) {
    try {
      const comment = State.comments.find(c => c.id === commentId);
      if (!comment) return;
      
      await DataService.likeComment(commentId, comment.likes);
      
      // Refresh comments
      State.comments = await DataService.fetchComments();
      UIRenderer.renderMainContent();
      
    } catch (error) {
      console.error('[Player] Error liking comment:', error);
    }
  },
  
  handleVideoError(e) {
    console.error('[Player] Video error:', e);
    showToast('Gagal memuat video', 'error');
  },
  
  setupEventListeners() {
    const videoElement = document.getElementById('videoPlayer');
    if (!videoElement) return;
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Space for play/pause
      if (e.code === 'Space' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        videoElement.paused ? videoElement.play() : videoElement.pause();
      }
      
      // F for fullscreen
      if (e.code === 'KeyF') {
        e.preventDefault();
        document.fullscreenElement 
          ? document.exitFullscreen() 
          : videoElement.requestFullscreen();
      }
      
      // M for mute
      if (e.code === 'KeyM') {
        e.preventDefault();
        videoElement.muted = !videoElement.muted;
      }
    });
  }
};

// =====================================================
// SHARE FUNCTIONS
// =====================================================
window.shareVia = (platform) => {
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(State.currentMovie?.title || 'FilmKu');
  
  const shareUrls = {
    whatsapp: `https://wa.me/?text=${title}%20-%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    twitter: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${title}`
  };
  
  const shareUrl = shareUrls[platform];
  if (shareUrl) {
    window.open(shareUrl, '_blank', 'width=600,height=400');
    closeModal();
  }
};

window.copyShareLink = () => {
  const linkInput = document.getElementById('shareLink');
  if (linkInput) {
    linkInput.select();
    document.execCommand('copy');
    showToast('Link berhasil disalin!');
    closeModal();
  }
};

window.closeModal = () => {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================
function showToast(message, type = 'success') {
  if (!DOM.toast || !DOM.toastMessage) return;
  
  DOM.toastMessage.textContent = message;
  DOM.toast.classList.add('show');
  
  if (type === 'error') {
    DOM.toast.classList.add('error');
  } else {
    DOM.toast.classList.remove('error');
  }
  
  setTimeout(() => {
    DOM.toast.classList.remove('show');
  }, CONFIG.TOAST_DURATION);
}

function showError(message) {
  DOM.updateContent(`
    <div class="error-message">
      <i class="fas fa-exclamation-circle" aria-hidden="true"></i>
      <p>${message}</p>
      <a href="index.html" class="back-btn" aria-label="Kembali ke beranda">
        <i class="fas fa-home" aria-hidden="true"></i>
        Kembali ke Beranda
      </a>
    </div>
  `);
}

// =====================================================
// EXPOSE GLOBALS
// =====================================================
window.Player = Player;
window.shareVia = shareVia;
window.copyShareLink = copyShareLink;
window.closeModal = closeModal;

// =====================================================
// INITIALIZE
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Player] Initializing...');
  Player.init();
});

// Handle popstate (back/forward)
window.addEventListener('popstate', () => {
  window.location.reload();
});