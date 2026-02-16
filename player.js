/**
 * player.js - Halaman Player FilmKu
 * Version: 3.0 - Fixed Episode Selection, No Comments
 */

// =====================================================
// KONFIGURASI
// =====================================================
const CONFIG = {
    SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
    EPISODES_PER_PAGE: 5,
    TOAST_DURATION: 3000
};

// =====================================================
// SUPABASE INIT
// =====================================================
if (typeof supabase === 'undefined') {
    alert('Gagal memuat library. Refresh halaman.');
    throw new Error('Supabase not loaded');
}

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================================
// URL PARAMS
// =====================================================
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');
let currentEpisode = urlParams.get('ep') ? parseInt(urlParams.get('ep')) : 1;

if (!movieId) {
    document.body.innerHTML = '<div style="color:white; text-align:center; padding:50px;">ID film tidak ditemukan</div>';
    throw new Error('No movie ID');
}

// =====================================================
// STATE
// =====================================================
const State = {
    movie: null,
    episodes: [],
    allMovies: [],
    currentEpisode: currentEpisode,
    showAllEpisodes: false,
    
    get filteredEpisodes() {
        if (!this.episodes.length) return [];
        // Urut descending (terbaru di atas)
        const sorted = [...this.episodes].sort((a, b) => b.episode_number - a.episode_number);
        if (this.showAllEpisodes) return sorted;
        return sorted.slice(0, CONFIG.EPISODES_PER_PAGE);
    },
    
    get hasMoreEpisodes() {
        return this.episodes.length > CONFIG.EPISODES_PER_PAGE && !this.showAllEpisodes;
    },
    
    get hiddenCount() {
        return Math.max(0, this.episodes.length - CONFIG.EPISODES_PER_PAGE);
    },
    
    // Mendapatkan URL video berdasarkan episode saat ini
    getCurrentVideoUrl() {
        if (!this.movie) return '';
        
        // Cari di episodes dulu
        if (this.episodes.length > 0) {
            const episode = this.episodes.find(ep => ep.episode_number === this.currentEpisode);
            if (episode && episode.video_url) {
                return episode.video_url;
            }
        }
        
        // Fallback ke video_url di movie
        return this.movie.video_url || '';
    }
};

// =====================================================
// DOM
// =====================================================
const DOM = {
    wrapper: document.getElementById('playerWrapper'),
    loading: document.getElementById('loadingState'),
    toast: document.getElementById('toast'),
    toastMsg: document.getElementById('toastMessage'),
    
    showLoading() {
        if (this.loading) this.loading.style.display = 'flex';
    },
    
    hideLoading() {
        if (this.loading) this.loading.style.display = 'none';
    },
    
    showError(msg) {
        if (this.wrapper) {
            this.wrapper.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${msg}</p>
                    <button onclick="location.reload()" class="retry-btn">
                        <i class="fas fa-redo"></i> Refresh
                    </button>
                </div>
            `;
        }
        this.hideLoading();
    },
    
    toast(msg, type = 'success') {
        if (!this.toast || !this.toastMsg) return;
        this.toastMsg.textContent = msg;
        this.toast.classList.add('show');
        this.toast.classList.toggle('error', type === 'error');
        setTimeout(() => this.toast.classList.remove('show'), CONFIG.TOAST_DURATION);
    }
};

// =====================================================
// API SERVICE
// =====================================================
const API = {
    async getMovie() {
        const { data, error } = await supabaseClient
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .single();
        if (error) throw error;
        return data;
    },
    
    async getEpisodes() {
        const { data, error } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('movie_id', movieId)
            .order('episode_number');
        if (error && error.code !== '42P01') throw error;
        return data || [];
    },
    
    async getAllMovies() {
        const { data, error } = await supabaseClient
            .from('movies')
            .select('*')
            .limit(10);
        if (error) throw error;
        return data || [];
    },
    
    async updateViews(views) {
        await supabaseClient
            .from('movies')
            .update({ views: (views || 0) + 1 })
            .eq('id', movieId);
    }
};

// =====================================================
// VIDEO RENDERER
// =====================================================
const VideoRenderer = {
    render(videoUrl, poster) {
        if (!videoUrl) {
            return '<div class="video-error">Tidak ada video</div>';
        }
        
        // YouTube
        if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
            return this.renderYouTube(videoUrl);
        }
        
        // Vimeo
        if (videoUrl.includes('vimeo.com')) {
            return this.renderVimeo(videoUrl);
        }
        
        // StreamSB
        if (videoUrl.includes('streamsb') || videoUrl.includes('sbembed')) {
            return this.renderEmbed(videoUrl);
        }
        
        // MixDrop
        if (videoUrl.includes('mixdrop')) {
            return this.renderMixDrop(videoUrl);
        }
        
        // Google Drive
        if (videoUrl.includes('drive.google.com')) {
            return this.renderGoogleDrive(videoUrl);
        }
        
        // Default: direct video
        return this.renderDirectVideo(videoUrl, poster);
    },
    
    renderYouTube(url) {
        let videoId = '';
        const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?]+)/);
        if (match) videoId = match[1];
        
        if (!videoId) return this.renderDirectVideo(url);
        
        return `
            <div class="video-container">
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0"
                    class="video-iframe"
                    allowfullscreen
                    allow="autoplay; encrypted-media"
                ></iframe>
            </div>
        `;
    },
    
    renderVimeo(url) {
        let videoId = '';
        const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
        if (match) videoId = match[1];
        
        if (!videoId) return this.renderDirectVideo(url);
        
        return `
            <div class="video-container">
                <iframe 
                    src="https://player.vimeo.com/video/${videoId}?autoplay=1"
                    class="video-iframe"
                    allowfullscreen
                    allow="autoplay"
                ></iframe>
            </div>
        `;
    },
    
    renderEmbed(url) {
        // Ubah ke format embed
        let embedUrl = url;
        if (url.includes('streamsb.net')) {
            embedUrl = url.replace('streamsb.net', 'streamsb.net/embed');
        } else if (url.includes('sbembed.com')) {
            embedUrl = url.replace('sbembed.com', 'sbembed.com/embed');
        }
        
        return `
            <div class="video-container">
                <iframe 
                    src="${embedUrl}"
                    class="video-iframe"
                    allowfullscreen
                    allow="autoplay"
                ></iframe>
            </div>
        `;
    },
    
    renderMixDrop(url) {
        let embedUrl = url;
        if (url.includes('mixdrop.co')) {
            embedUrl = url.replace('mixdrop.co', 'mixdrop.co/e');
        } else if (url.includes('mixdrop.to')) {
            embedUrl = url.replace('mixdrop.to', 'mixdrop.to/e');
        }
        
        return `
            <div class="video-container">
                <iframe 
                    src="${embedUrl}"
                    class="video-iframe"
                    allowfullscreen
                    allow="autoplay"
                ></iframe>
            </div>
        `;
    },
    
    renderGoogleDrive(url) {
        let fileId = '';
        const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
        if (match) fileId = match[1];
        
        if (!fileId) return this.renderDirectVideo(url);
        
        return `
            <div class="video-container">
                <iframe 
                    src="https://drive.google.com/file/d/${fileId}/preview"
                    class="video-iframe"
                    allowfullscreen
                    allow="autoplay"
                ></iframe>
            </div>
        `;
    },
    
    renderDirectVideo(url, poster) {
        return `
            <div class="video-container">
                <video id="videoPlayer" class="video-player" controls poster="${poster}" autoplay>
                    <source src="${url}" type="video/mp4">
                    <source src="${url}" type="video/webm">
                    Browser Anda tidak mendukung tag video.
                </video>
            </div>
        `;
    }
};

// =====================================================
// UI RENDERER
// =====================================================
const UIRenderer = {
    escape(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    
    formatNumber(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'jt';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'rb';
        return num.toString();
    },
    
    render() {
        if (!State.movie) {
            DOM.showError('Film tidak ditemukan');
            return;
        }
        
        const videoUrl = State.getCurrentVideoUrl();
        
        const html = `
            ${VideoRenderer.render(videoUrl, State.movie.thumbnail)}
            
            <div class="video-info-bar">
                <div class="video-stats">
                    <div class="stat-item">
                        <i class="fas fa-eye"></i>
                        <span><strong>${this.formatNumber(State.movie.views)}</strong> ditonton</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar"></i>
                        <span><strong>${State.movie.year || '-'}</strong></span>
                    </div>
                    ${State.episodes.length > 0 ? `
                    <div class="stat-item">
                        <i class="fas fa-list"></i>
                        <span><strong>${State.episodes.length}</strong> episode</span>
                    </div>
                    ` : ''}
                </div>
                <div class="video-actions">
                    <button class="action-btn" onclick="App.share()">
                        <i class="fas fa-share-alt"></i> Bagikan
                    </button>
                </div>
            </div>
            
            <section class="movie-details">
                <h1 class="movie-title">${this.escape(State.movie.title)}</h1>
                <p class="movie-description">${this.escape(State.movie.description) || 'Tidak ada deskripsi'}</p>
            </section>
            
            ${this.renderEpisodes()}
            ${this.renderRecommendations()}
        `;
        
        DOM.wrapper.innerHTML = html;
        DOM.hideLoading();
    },
    
    renderEpisodes() {
        if (!State.episodes.length) return '';
        
        const episodes = State.filteredEpisodes;
        
        const episodesHtml = episodes.map(ep => {
            const isActive = ep.episode_number === State.currentEpisode;
            return `
                <div class="episode-card ${isActive ? 'active' : ''}" 
                     onclick="App.changeEpisode(${ep.episode_number})"
                     data-episode="${ep.episode_number}">
                    <div class="episode-number">${ep.episode_number}</div>
                    <div class="episode-info">
                        <div class="episode-title">${this.escape(ep.title) || 'Episode ' + ep.episode_number}</div>
                        <div class="episode-duration">
                            <i class="fas fa-clock"></i> ${ep.duration || '24'} menit
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        let toggleButton = '';
        if (State.hasMoreEpisodes) {
            toggleButton = `
                <div class="episodes-toggle">
                    <button class="toggle-episodes-btn" onclick="App.showMoreEpisodes()">
                        <i class="fas fa-chevron-down"></i> Tampilkan ${State.hiddenCount} Episode Lainnya
                    </button>
                </div>
            `;
        } else if (State.episodes.length > CONFIG.EPISODES_PER_PAGE && State.showAllEpisodes) {
            toggleButton = `
                <div class="episodes-toggle">
                    <button class="toggle-episodes-btn" onclick="App.showLessEpisodes()">
                        <i class="fas fa-chevron-up"></i> Tampilkan Lebih Sedikit
                    </button>
                </div>
            `;
        }
        
        return `
            <section class="episodes-section">
                <h2 class="section-title">
                    <i class="fas fa-list"></i> Daftar Episode
                    <span>${State.episodes.length} episode</span>
                </h2>
                <div class="episodes-grid">
                    ${episodesHtml}
                </div>
                ${toggleButton}
            </section>
        `;
    },
    
    renderRecommendations() {
        if (!State.allMovies.length) return '';
        
        const recommendations = State.allMovies
            .filter(m => m.id !== movieId)
            .sort(() => 0.5 - Math.random())
            .slice(0, 6);
        
        if (!recommendations.length) return '';
        
        const html = recommendations.map(m => `
            <div class="recommend-card" onclick="location.href='player.html?id=${m.id}'">
                <img src="${m.thumbnail || ''}" alt="${this.escape(m.title)}" 
                     onerror="this.src='https://via.placeholder.com/300x450?text=No+Image'">
                <div class="recommend-info">
                    <h4>${this.escape(m.title)}</h4>
                    <p><i class="fas fa-eye"></i> ${this.formatNumber(m.views)}</p>
                </div>
            </div>
        `).join('');
        
        return `
            <section class="recommendations-section">
                <h2 class="section-title"><i class="fas fa-thumbs-up"></i> Rekomendasi Lainnya</h2>
                <div class="recommendations-grid">${html}</div>
            </section>
        `;
    }
};

// =====================================================
// APP
// =====================================================
const App = {
    async init() {
        console.log('App starting...');
        DOM.showLoading();
        
        try {
            // Load data
            const [movie, episodes, allMovies] = await Promise.all([
                API.getMovie(),
                API.getEpisodes(),
                API.getAllMovies()
            ]);
            
            State.movie = movie;
            State.episodes = episodes;
            State.allMovies = allMovies;
            
            // Validasi episode
            if (State.episodes.length > 0) {
                // Cek apakah episode yang diminta valid
                const episodeExists = State.episodes.some(ep => ep.episode_number === State.currentEpisode);
                if (!episodeExists) {
                    State.currentEpisode = State.episodes[0].episode_number;
                    // Update URL
                    this.updateUrl(State.currentEpisode);
                }
            }
            
            // Render
            UIRenderer.render();
            
            // Update views
            API.updateViews(movie.views).catch(console.warn);
            
        } catch (error) {
            console.error('Init error:', error);
            DOM.showError('Gagal memuat data: ' + error.message);
        }
    },
    
    updateUrl(episode) {
        const url = new URL(window.location);
        url.searchParams.set('ep', episode);
        window.history.pushState({}, '', url);
    },
    
    changeEpisode(episodeNumber) {
        console.log('Changing to episode:', episodeNumber);
        
        // Update state
        State.currentEpisode = episodeNumber;
        
        // Update URL
        this.updateUrl(episodeNumber);
        
        // Dapatkan URL video baru
        const newVideoUrl = State.getCurrentVideoUrl();
        
        // Update video player
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            videoContainer.outerHTML = VideoRenderer.render(newVideoUrl, State.movie.thumbnail);
        }
        
        // Update active state di episode cards
        document.querySelectorAll('.episode-card').forEach(card => {
            const ep = parseInt(card.dataset.episode);
            if (ep === episodeNumber) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        
        // Scroll ke video
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        DOM.toast('Episode ' + episodeNumber);
    },
    
    showMoreEpisodes() {
        State.showAllEpisodes = true;
        const section = document.querySelector('.episodes-section');
        if (section) {
            section.outerHTML = UIRenderer.renderEpisodes();
        }
    },
    
    showLessEpisodes() {
        State.showAllEpisodes = false;
        const section = document.querySelector('.episodes-section');
        if (section) {
            section.outerHTML = UIRenderer.renderEpisodes();
        }
    },
    
    share() {
        const modal = document.getElementById('shareModal');
        const input = document.getElementById('shareLink');
        if (modal && input) {
            input.value = window.location.href;
            modal.classList.add('active');
        }
    }
};

// =====================================================
// GLOBAL FUNCTIONS (untuk modal share)
// =====================================================
window.shareVia = (platform) => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(State.movie?.title || 'FilmKu');
    
    const links = {
        whatsapp: `https://wa.me/?text=${title}%20-%20${url}`,
        facebook: `https://www.facebook.com/sharer.php?u=${url}`,
        twitter: `https://twitter.com/intent/tweet?text=${title}&url=${url}`,
        telegram: `https://t.me/share/url?url=${url}&text=${title}`
    };
    
    if (links[platform]) {
        window.open(links[platform], '_blank', 'width=600,height=400');
        closeModal();
    }
};

window.copyShareLink = () => {
    const input = document.getElementById('shareLink');
    if (input) {
        input.select();
        document.execCommand('copy');
        DOM.toast('Link disalin');
        closeModal();
    }
};

window.closeModal = () => {
    document.getElementById('shareModal')?.classList.remove('active');
};

// =====================================================
// START
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});