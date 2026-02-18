// player.js - Versi Rapi dengan Struktur Modular

// =====================================================
// KONFIGURASI
// =====================================================
const CONFIG = {
    SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o'
};

// =====================================================
// INISIALISASI SUPABASE
// =====================================================
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// =====================================================
// STATE & VARIABEL GLOBAL
// =====================================================
const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');

let currentMovie = null;
let episodes = [];

// =====================================================
// FUNGSI UTAMA LOAD DATA
// =====================================================
async function loadMovieData() {
    try {
        showLoading(true);
        
        // Load movie details
        const { data: movie, error: movieError } = await supabaseClient
            .from('movie_details')
            .select('*')
            .eq('id', movieId)
            .single();
        
        if (movieError) throw movieError;
        if (!movie) throw new Error('Movie tidak ditemukan');
        
        currentMovie = movie;
        
        // Load episodes
        await loadEpisodes(movieId);
        
        // Tampilkan data
        displayMovie(movie, episodes);
        
        // Increment views (async, tidak perlu ditunggu)
        incrementViews(movie.id, movie.views || 0);
        
        // Load rekomendasi
        loadRecommendations(movie.category);
        
    } catch (err) {
        console.error('Error loading data:', err);
        showError(err.message);
    } finally {
        showLoading(false);
    }
}

// =====================================================
// FUNGSI LOAD EPISODES
// =====================================================
async function loadEpisodes(movieId) {
    try {
        const { data: episodesData, error: episodesError } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('movie_id', movieId)
            .order('episode_number', { ascending: true });
        
        if (episodesError) {
            console.warn('Error loading episodes:', episodesError);
            episodes = [];
        } else {
            episodes = (episodesData || []).map(ep => ({
                id: ep.id,
                title: ep.title || `Episode ${ep.episode_number}`,
                url: ep.video_url,
                number: ep.episode_number,
                duration: ep.duration
            }));
        }
        
        console.log('Episodes loaded:', episodes.length);
    } catch (error) {
        console.error('Error in loadEpisodes:', error);
        episodes = [];
    }
}

// =====================================================
// FUNGSI INCREMENT VIEWS
// =====================================================
async function incrementViews(movieId, currentViews) {
    try {
        await supabaseClient
            .from('movie_details')
            .update({ views: currentViews + 1 })
            .eq('id', movieId);
    } catch (error) {
        console.warn('Failed to increment views:', error);
    }
}

// =====================================================
// FUNGSI TAMPIL DATA
// =====================================================
function displayMovie(movie, episodes) {
    document.title = `FilmKu - ${movie.title}`;
    
    setTextContent('movieTitle', movie.title);
    setTextContent('movieDesc', movie.description || 'Tidak ada deskripsi.');
    
    // Set kategori
    const catEl = document.getElementById('movieCategory');
    if (catEl) {
        catEl.innerText = movie.category === 'film' ? 'Film' : 'Donghua';
        catEl.className = `badge ${movie.category}`;
    }
    
    setTextContent('movieViews', formatNumber(movie.views || 0));
    
    // Set tanggal
    const dateEl = document.getElementById('movieDate');
    if (dateEl && movie.created_at) {
        const date = new Date(movie.created_at).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
        dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${date}`;
    }
    
    displayEpisodes(episodes, movie);
}

// Helper function untuk set text content
function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// =====================================================
// FUNGSI TAMPIL EPISODE
// =====================================================
function displayEpisodes(episodes, movie) {
    const episodesList = document.getElementById('episodesList');
    const episodesSection = document.getElementById('episodesSection');
    const videoPlayer = document.getElementById('videoPlayer');
    
    if (!episodesList || !videoPlayer) return;
    
    episodesList.innerHTML = '';
    
    if (movie.category === 'donghua') {
        handleDonghuaEpisodes(episodes, movie, episodesList, episodesSection, videoPlayer);
    } else {
        handleFilmVideo(movie, episodes, episodesList, episodesSection, videoPlayer);
    }
}

function handleDonghuaEpisodes(episodes, movie, episodesList, episodesSection, videoPlayer) {
    if (episodes.length === 0) {
        episodesList.innerHTML = `
            <div class="error-episodes">
                <i class="fas fa-exclamation-circle"></i> Tidak ada episode tersedia
            </div>
        `;
        
        if (movie.video_url) {
            videoPlayer.src = movie.video_url;
        }
        return;
    }
    
    if (episodesSection) {
        episodesSection.style.display = 'block';
    }
    
    episodes.forEach((ep, index) => {
        const episodeCard = createEpisodeCard(ep, index);
        episodesList.appendChild(episodeCard);
    });
    
    // Set video pertama
    if (episodes[0]?.url) {
        videoPlayer.src = episodes[0].url;
    }
}

function handleFilmVideo(movie, episodes, episodesList, episodesSection, videoPlayer) {
    if (episodesSection) {
        episodesSection.style.display = 'none';
    }
    
    if (movie.video_url) {
        videoPlayer.src = movie.video_url;
    } else if (episodes.length > 0 && episodes[0]?.url) {
        videoPlayer.src = episodes[0].url;
    } else {
        episodesList.innerHTML = `
            <div class="error-episodes">
                <i class="fas fa-exclamation-circle"></i> Video tidak tersedia
            </div>
        `;
    }
}

function createEpisodeCard(episode, index) {
    const card = document.createElement('div');
    card.className = `episode-card ${index === 0 ? 'active' : ''}`;
    card.setAttribute('data-episode-index', index);
    
    const episodeTitle = episode.title || `Episode ${episode.number || index + 1}`;
    card.innerHTML = `<span>${episodeTitle}</span>`;
    
    card.onclick = () => {
        document.querySelectorAll('.episode-card').forEach(c => 
            c.classList.remove('active')
        );
        card.classList.add('active');
        
        if (episode.url) {
            document.getElementById('videoPlayer').src = episode.url;
        }
    };
    
    return card;
}

// =====================================================
// FUNGSI LOAD REKOMENDASI
// =====================================================
async function loadRecommendations(category) {
    try {
        const { data, error } = await supabaseClient
            .from('movie_details')
            .select('*')
            .eq('category', category)
            .neq('id', movieId)
            .limit(6);

        if (error) throw error;

        const recList = document.getElementById('recommendationsList');
        if (!recList) return;
        
        if (data && data.length > 0) {
            recList.innerHTML = data.map(createRecommendationCard).join('');
        } else {
            recList.innerHTML = '<p class="no-recommendations">Tidak ada rekomendasi serupa.</p>';
        }
    } catch (error) {
        console.error('Error loading recommendations:', error);
    }
}

function createRecommendationCard(movie) {
    const thumb = movie.thumbnail || 'https://via.placeholder.com/200x300?text=No+Image';
    return `
        <div class="movie-card" onclick="window.location.href='player.html?id=${movie.id}'">
            <div class="movie-poster">
                <img src="${thumb}" alt="${movie.title}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
            </div>
            <h4>${movie.title}</h4>
        </div>
    `;
}

// =====================================================
// FUNGSI UTILITY
// =====================================================
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
    return num.toString();
}

function showLoading(show) {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const episodesList = document.getElementById('episodesList');
    if (episodesList) {
        episodesList.innerHTML = `
            <div class="error-episodes">
                <i class="fas fa-exclamation-circle"></i> ${message}
            </div>
        `;
    }
    
    setTextContent('movieTitle', 'Error');
}

// =====================================================
// FUNGSI VIDEO PLAYER
// =====================================================
function setupVideoPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    if (!videoPlayer || !loadingOverlay) return;
    
    const videoEvents = {
        loadstart: () => loadingOverlay.classList.remove('hidden'),
        canplay: () => loadingOverlay.classList.add('hidden'),
        error: () => {
            loadingOverlay.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal memuat video';
            loadingOverlay.classList.remove('hidden');
        }
    };
    
    Object.entries(videoEvents).forEach(([event, handler]) => {
        videoPlayer.addEventListener(event, handler);
    });
}

// =====================================================
// FUNGSI SHARE
// =====================================================
const ShareFunctions = {
    openModal: () => {
        const modal = document.getElementById('shareModal');
        const link = document.getElementById('shareLink');
        if (modal) modal.classList.add('active');
        if (link) link.value = window.location.href;
    },
    
    closeModal: () => {
        const modal = document.getElementById('shareModal');
        if (modal) modal.classList.remove('active');
    },
    
    copyLink: () => {
        const input = document.getElementById('shareLink');
        if (input) {
            input.select();
            document.execCommand('copy');
            
            const toast = document.getElementById('toast');
            if (toast) {
                toast.style.display = 'block';
                setTimeout(() => toast.style.display = 'none', 2000);
            }
            
            ShareFunctions.closeModal();
        }
    },
    
    shareVia: (platform) => {
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.getElementById('movieTitle')?.innerText || 'FilmKu');
        let shareUrl = '';
        
        const platforms = {
            whatsapp: `https://wa.me/?text=${title}%20-%20${url}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
            telegram: `https://t.me/share/url?url=${url}&text=${title}`
        };
        
        if (platforms[platform]) {
            window.open(platforms[platform], '_blank', 'width=600,height=400');
        }
    }
};

// Expose functions to window
window.openShareModal = ShareFunctions.openModal;
window.closeModal = ShareFunctions.closeModal;
window.copyShareLink = ShareFunctions.copyLink;
window.shareVia = ShareFunctions.shareVia;

// Close modal on outside click
window.onclick = (e) => {
    const modal = document.getElementById('shareModal');
    if (e.target === modal) {
        ShareFunctions.closeModal();
    }
};

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }
    
    loadMovieData();
    setupVideoPlayer();
});