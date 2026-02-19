// player.js - Versi Final dengan Tampilan Episode untuk Semua Konten
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
        
        // Load movie details dari tabel movies
        const { data: movie, error: movieError } = await supabaseClient
            .from('movies')
            .select('*')
            .eq('id', movieId)
            .single();
        
        if (movieError) {
            console.error('Movie error:', movieError);
            throw movieError;
        }
        
        if (!movie) throw new Error('Movie tidak ditemukan');
        
        currentMovie = movie;
        console.log('Movie loaded:', movie);
        
        // Load episodes
        await loadEpisodes(movieId);
        
        // Tampilkan data
        displayMovie(movie, episodes);
        
        // Increment views
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
            .from('movies')
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

function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// =====================================================
// FUNGSI TAMPIL EPISODE - VERSI FINAL OPSI 1
// =====================================================
function displayEpisodes(episodes, movie) {
    const episodesList = document.getElementById('episodesList');
    const episodesSection = document.getElementById('episodesSection');
    const videoPlayer = document.getElementById('videoPlayer');
    
    if (!episodesList || !videoPlayer) return;
    
    episodesList.innerHTML = '';
    
    console.log('Displaying episodes:', episodes.length, 'for category:', movie.category);
    
    // =============== JIKA ADA EPISODE ===============
    if (episodes.length > 0) {
        // Tampilkan section episode (untuk semua kategori)
        if (episodesSection) {
            episodesSection.style.display = 'block';
        }
        
        // Tampilkan semua episode
        episodes.forEach((ep, index) => {
            const episodeCard = createEpisodeCard(ep, index);
            episodesList.appendChild(episodeCard);
        });
        
        // Tentukan video yang akan diputar pertama kali
        if (movie.category === 'film' && movie.video_url) {
            // Untuk film: putar video utama dari tabel movies
            // Tapi tetap tampilkan episode sebagai opsi
            console.log('Playing film video from movie.video_url:', movie.video_url);
            videoPlayer.src = movie.video_url;
            
            // Tandai bahwa tidak ada episode yang aktif (karena yang diputar adalah video utama)
            setTimeout(() => {
                document.querySelectorAll('.episode-card').forEach(c => 
                    c.classList.remove('active')
                );
            }, 100);
        } else {
            // Untuk donghua atau film tanpa video_url: putar episode pertama
            console.log('Playing first episode:', episodes[0]?.url);
            if (episodes[0]?.url) {
                videoPlayer.src = episodes[0].url;
                
                // Tandai episode pertama sebagai aktif
                setTimeout(() => {
                    const firstCard = document.querySelector('.episode-card');
                    if (firstCard) firstCard.classList.add('active');
                }, 100);
            }
        }
    } 
    
    // =============== JIKA TIDAK ADA EPISODE ===============
    else {
        if (movie.category === 'donghua') {
            // Donghua tanpa episode - tampilkan pesan error
            if (episodesSection) {
                episodesSection.style.display = 'block';
            }
            episodesList.innerHTML = `
                <div class="error-episodes">
                    <i class="fas fa-exclamation-circle"></i> Tidak ada episode tersedia
                </div>
            `;
            
            // Fallback ke video_url jika ada
            if (movie.video_url) {
                console.log('No episodes, playing movie.video_url:', movie.video_url);
                videoPlayer.src = movie.video_url;
            }
        } else {
            // Film tanpa episode
            if (episodesSection) {
                episodesSection.style.display = 'none';
            }
            
            // Putar video_url jika ada
            if (movie.video_url) {
                console.log('Playing film video from movie.video_url:', movie.video_url);
                videoPlayer.src = movie.video_url;
            } else {
                // Tidak ada video sama sekali
                episodesList.innerHTML = `
                    <div class="error-episodes">
                        <i class="fas fa-exclamation-circle"></i> Video tidak tersedia
                    </div>
                `;
            }
        }
    }
}

// =====================================================
// FUNGSI MEMBUAT EPISODE CARD
// =====================================================
function createEpisodeCard(episode, index) {
    const card = document.createElement('div');
    card.className = 'episode-card';
    card.setAttribute('data-episode-index', index);
    
    const episodeTitle = episode.title || `Episode ${episode.number || index + 1}`;
    card.innerHTML = `<span>${episodeTitle}</span>`;
    
    card.onclick = () => {
        // Hapus class active dari semua episode
        document.querySelectorAll('.episode-card').forEach(c => 
            c.classList.remove('active')
        );
        
        // Tambahkan class active ke episode yang diklik
        card.classList.add('active');
        
        // Putar video episode
        if (episode.url) {
            console.log('Playing selected episode:', episode.url);
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
            .from('movies')
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
    
    videoPlayer.addEventListener('loadstart', () => {
        loadingOverlay.classList.remove('hidden');
        loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat video...';
    });
    
    videoPlayer.addEventListener('canplay', () => {
        loadingOverlay.classList.add('hidden');
    });
    
    videoPlayer.addEventListener('error', (e) => {
        console.error('Video error:', e);
        loadingOverlay.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal memuat video';
        loadingOverlay.classList.remove('hidden');
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
        
        if (platform === 'whatsapp') {
            shareUrl = `https://wa.me/?text=${title}%20-%20${url}`;
        } else if (platform === 'facebook') {
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        } else if (platform === 'telegram') {
            shareUrl = `https://t.me/share/url?url=${url}&text=${title}`;
        }
        
        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    }
};

// Fungsi untuk inisialisasi iklan
function initAds() {
    try {
        if (window.adsbygoogle) {
            (adsbygoogle = window.adsbygoogle || []).push({});
        }
    } catch (e) {
        console.log('AdSense init error:', e);
    }
}

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
    
    console.log('Loading movie with ID:', movieId);
    loadMovieData();
    setupVideoPlayer();
    
    // Inisialisasi iklan Google AdSense
    setTimeout(initAds, 500);
});