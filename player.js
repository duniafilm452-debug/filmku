// player.js - VERSI HYBRID untuk Embed & MP4 dengan IMA SDK

const CONFIG = {
    SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o'
};

const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const urlParams = new URLSearchParams(window.location.search);
const movieId = urlParams.get('id');

let currentMovie = null;
let episodes = [];

// IMA SDK Variables
let imaAdDisplayContainer;
let imaAdsLoader;
let imaAdsManager;
let imaVideoContent;
let imaInitialized = false;
let pendingVideoUrl = null;

// ==================== DETEKSI JENIS URL ====================

// Deteksi apakah URL adalah embed (YouTube, Dailymotion, dll)
function isEmbedUrl(url) {
    if (!url) return false;
    return url.includes('youtube.com') || 
           url.includes('youtu.be') || 
           url.includes('dailymotion.com') || 
           url.includes('vimeo.com') ||
           url.includes('embed') ||
           url.includes('facebook.com') ||
           url.includes('instagram.com') ||
           url.includes('twitch.tv');
}

// Deteksi apakah URL adalah HLS (m3u8)
function isHlsUrl(url) {
    if (!url) return false;
    return url.includes('.m3u8');
}

// Deteksi apakah URL adalah file video langsung (MP4, WebM, dll)
function isDirectVideoUrl(url) {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.m4v'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}

// ==================== PLAYER FUNCTIONS ====================

// Reset player ke kondisi awal
function resetPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    const videoWrapper = document.getElementById('videoWrapper');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    // Hapus iframe yang mungkin ada
    const oldIframe = videoWrapper.querySelector('iframe');
    if (oldIframe) oldIframe.remove();
    
    // Tampilkan dan reset video tag
    videoPlayer.style.display = 'block';
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    
    // Sembunyikan loading
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    // Reset IMA jika ada
    if (imaAdsManager) {
        try {
            imaAdsManager.destroy();
        } catch (e) {}
        imaAdsManager = null;
    }
}

// Play video embed (YouTube, Dailymotion, dll) - TANPA IKLAN
function playEmbedVideo(url) {
    console.log('Playing embed video:', url);
    resetPlayer();
    
    const videoPlayer = document.getElementById('videoPlayer');
    const videoWrapper = document.getElementById('videoWrapper');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    // Sembunyikan video tag
    videoPlayer.style.display = 'none';
    
    // Konversi YouTube URL ke embed format jika perlu
    let embedUrl = url;
    
    // YouTube URL conversion
    if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1].split('&')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    } else if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0];
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
    }
    
    // Dailymotion URL conversion
    else if (url.includes('dailymotion.com/video/')) {
        const videoId = url.split('video/')[1].split('?')[0];
        embedUrl = `https://www.dailymotion.com/embed/video/${videoId}?autoplay=1`;
    }
    
    // Vimeo URL conversion
    else if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1].split('?')[0];
        embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }
    
    // Buat iframe
    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.allowFullscreen = true;
    iframe.frameBorder = 0;
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.position = 'absolute';
    iframe.style.top = '0';
    iframe.style.left = '0';
    
    // Tambahkan ke wrapper
    videoWrapper.appendChild(iframe);
    
    // Sembunyikan loading
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// Play HLS video dengan IMA SDK
function playHlsVideo(url) {
    console.log('Playing HLS video with ads:', url);
    
    // Cek apakah HLS.js tersedia
    if (typeof Hls === 'undefined') {
        // Load HLS.js jika belum ada
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = () => {
            playHlsVideoWithAds(url);
        };
        document.head.appendChild(script);
    } else {
        playHlsVideoWithAds(url);
    }
}

function playHlsVideoWithAds(url) {
    const videoPlayer = document.getElementById('videoPlayer');
    
    // Set src untuk IMA
    videoPlayer.src = url;
    
    // Play dengan IMA
    playVideoWithAds(url);
}

// Main function untuk memutar video berdasarkan jenis URL
function playVideo(url) {
    if (!url) return;
    
    console.log('Playing video:', url);
    resetPlayer();
    
    if (isEmbedUrl(url)) {
        // Embed video - putar langsung tanpa iklan
        playEmbedVideo(url);
    } else if (isHlsUrl(url)) {
        // HLS video - putar dengan IMA
        playHlsVideo(url);
    } else if (isDirectVideoUrl(url)) {
        // Direct video file - putar dengan IMA
        playVideoWithAds(url);
    } else {
        // Unknown type - coba sebagai direct video
        console.warn('Unknown video type, trying as direct video:', url);
        playVideoWithAds(url);
    }
}

// ==================== IMA SDK FUNCTIONS ====================

// Initialize IMA SDK
function initImaSDK() {
    try {
        imaVideoContent = document.getElementById('videoPlayer');
        
        if (!imaVideoContent) {
            console.warn('Video player not found for IMA');
            return;
        }

        // Create ad display container
        imaAdDisplayContainer = new google.ima.AdDisplayContainer(
            document.getElementById('videoWrapper'),
            imaVideoContent
        );
        
        // Initialize ads loader
        imaAdsLoader = new google.ima.AdsLoader(imaAdDisplayContainer);
        
        // Add event listeners
        imaAdsLoader.addEventListener(
            google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
            onAdsManagerLoaded
        );
        
        imaAdsLoader.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            onAdError
        );
        
        imaInitialized = true;
        console.log('IMA SDK initialized successfully');
        
        // Request ads if there's a pending video
        if (pendingVideoUrl) {
            requestAds(pendingVideoUrl);
            pendingVideoUrl = null;
        }
    } catch (e) {
        console.error('Error initializing IMA:', e);
    }
}

// Request ads from server
function requestAds(videoUrl) {
    try {
        if (!imaInitialized || !imaAdsLoader) {
            pendingVideoUrl = videoUrl;
            return;
        }

        const adsRequest = new google.ima.AdsRequest();
        
        // VAST tag URL - GANTI DENGAN VAST TAG ANDA
        adsRequest.adTagUrl = 'https://plumprush.com/dVmtF.z/d/GaNtv/ZEGdUX/peUma9turZPUJlpkuPGTWYZ4MMhTqMfxGNvj/kftlN_j/g/xKMDzhEB3hMvynZgshaAWz1hp/dVD/0Yxt';
        
        // Set ukuran berdasarkan ukuran player
        const playerWidth = imaVideoContent.offsetWidth || 640;
        const playerHeight = imaVideoContent.offsetHeight || 360;
        
        adsRequest.linearAdSlotWidth = playerWidth;
        adsRequest.linearAdSlotHeight = playerHeight;
        adsRequest.nonLinearAdSlotWidth = playerWidth;
        adsRequest.nonLinearAdSlotHeight = Math.floor(playerHeight / 3);
        
        adsRequest.forceNonLinearFullSlot = true;
        adsRequest.adType = google.ima.AdType.VIDEO;
        
        // Store video URL for later use
        pendingVideoUrl = videoUrl;
        
        console.log('Requesting ads for video:', videoUrl, 'with size:', playerWidth, 'x', playerHeight);
        
        // Request ads
        imaAdsLoader.requestAds(adsRequest);
    } catch (e) {
        console.error('Error requesting ads:', e);
        // Fallback: play video without ads
        playVideoDirectly(videoUrl);
    }
}

// Handle ads manager loaded
function onAdsManagerLoaded(event) {
    try {
        const adsRenderingSettings = new google.ima.AdsRenderingSettings();
        adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
        adsRenderingSettings.enablePreloading = true;
        adsRenderingSettings.useStyledLinearAds = true;
        adsRenderingSettings.useStyledNonLinearAds = true;
        
        imaAdsManager = event.getAdsManager(
            imaVideoContent,
            adsRenderingSettings
        );
        
        // Add event listeners
        imaAdsManager.addEventListener(
            google.ima.AdErrorEvent.Type.AD_ERROR,
            onAdError
        );
        
        imaAdsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
            onContentPauseRequested
        );
        
        imaAdsManager.addEventListener(
            google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
            onContentResumeRequested
        );
        
        imaAdsManager.addEventListener(
            google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
            onAllAdsCompleted
        );
        
        imaAdsManager.addEventListener(
            google.ima.AdEvent.Type.STARTED,
            onAdStarted
        );
        
        imaAdsManager.addEventListener(
            google.ima.AdEvent.Type.LOADED,
            onAdLoaded
        );
        
        // Initialize ad container
        imaAdDisplayContainer.initialize();
        
        try {
            const videoWidth = imaVideoContent.offsetWidth || 640;
            const videoHeight = imaVideoContent.offsetHeight || 360;
            
            console.log('Initializing ads manager with size:', videoWidth, 'x', videoHeight);
            
            imaAdsManager.init(
                videoWidth,
                videoHeight,
                google.ima.ViewMode.NORMAL
            );
            
            imaAdsManager.setVolume(1.0);
            
            if (pendingVideoUrl) {
                imaVideoContent.src = pendingVideoUrl;
                imaVideoContent.load();
                console.log('Starting ads...');
                imaAdsManager.start();
            }
        } catch (adError) {
            console.error('Error starting ads:', adError);
            if (pendingVideoUrl) {
                playVideoDirectly(pendingVideoUrl);
            }
        }
    } catch (e) {
        console.error('Error in onAdsManagerLoaded:', e);
    }
}

// Handle ad error
function onAdError(event) {
    console.warn('Ad error:', event.getError());
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '<i class="fas fa-exclamation-circle"></i> Iklan gagal, memutar video...';
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 2000);
    }
    
    if (pendingVideoUrl) {
        playVideoDirectly(pendingVideoUrl);
    }
}

// Handle content pause (ad starting)
function onContentPauseRequested() {
    console.log('Content pause requested - ad starting');
    imaVideoContent.pause();
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '<i class="fas fa-ad"></i> Memutar iklan...';
        loadingOverlay.style.display = 'flex';
    }
}

// Handle content resume (ad finished)
function onContentResumeRequested() {
    console.log('Content resume requested - ad finished');
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    imaVideoContent.play();
}

// Handle all ads completed
function onAllAdsCompleted() {
    console.log('All ads completed');
}

// Handle ad started
function onAdStarted(event) {
    console.log('Ad started:', event);
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '<i class="fas fa-ad"></i> Iklan sedang diputar...';
        loadingOverlay.style.display = 'flex';
    }
    
    setTimeout(() => {
        const adContainer = document.querySelector('.ima-ad-container');
        if (adContainer) {
            adContainer.style.display = 'block';
            adContainer.style.visibility = 'visible';
            adContainer.style.opacity = '1';
            adContainer.style.zIndex = '1000';
        }
    }, 100);
}

// Handle ad loaded
function onAdLoaded(event) {
    console.log('Ad loaded:', event);
}

// Play video directly without ads (fallback)
function playVideoDirectly(url) {
    const videoPlayer = document.getElementById('videoPlayer');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    if (!videoPlayer) return;
    
    console.log('Playing video directly (fallback):', url);
    
    videoPlayer.src = url;
    videoPlayer.load();
    videoPlayer.play().catch(e => {
        console.warn('Autoplay failed:', e);
    });
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    pendingVideoUrl = null;
}

// Main function to play video with ads (untuk direct video)
function playVideoWithAds(url) {
    if (!url) return;
    
    console.log('Playing video with ads:', url);
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan video...';
    }
    
    // Reset player
    const videoPlayer = document.getElementById('videoPlayer');
    if (videoPlayer) {
        videoPlayer.style.display = 'block';
        videoPlayer.pause();
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
    }
    
    // Check if IMA is available
    if (typeof google !== 'undefined' && google.ima) {
        if (!imaInitialized) {
            initImaSDK();
            setTimeout(() => requestAds(url), 1000);
        } else {
            requestAds(url);
        }
    } else {
        console.warn('IMA SDK not available, playing directly');
        playVideoDirectly(url);
    }
}

// ==================== SUPABASE FUNCTIONS ====================

// Main function to load all data
async function loadMovieData() {
    try {
        showLoading(true);
        
        const { data: movie, error: movieError } = await supabaseClient
            .from('movie_details')
            .select('*')
            .eq('id', movieId)
            .single();
        
        if (movieError) throw movieError;
        if (!movie) throw new Error('Movie tidak ditemukan');
        
        currentMovie = movie;
        
        await loadEpisodes(movieId, movie);
        displayMovie(movie, episodes);
        incrementViews(movie.id, movie.views || 0);
        loadRecommendations(movie.category);
        checkSelectedEpisode();
        
    } catch (err) {
        console.error('Error loading data:', err);
        showError(err.message);
    } finally {
        showLoading(false);
    }
}

// Check for previously selected episode
function checkSelectedEpisode() {
    try {
        const saved = localStorage.getItem('selectedEpisode');
        if (saved) {
            const data = JSON.parse(saved);
            if (data.movieId === movieId && data.videoUrl) {
                setTimeout(() => {
                    playVideo(data.videoUrl);
                    
                    setTimeout(() => {
                        document.querySelectorAll('.episode-card').forEach(card => {
                            const cardNumber = card.getAttribute('data-episode-number');
                            if (cardNumber && parseInt(cardNumber) === data.episodeNumber) {
                                card.classList.add('active');
                                card.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'nearest',
                                    inline: 'center'
                                });
                            }
                        });
                    }, 500);
                }, 1000);
                
                localStorage.removeItem('selectedEpisode');
            }
        }
    } catch (e) {
        console.log('Error checking selected episode:', e);
    }
}

// Load episodes
async function loadEpisodes(movieId, movie) {
    try {
        const { data: episodesData, error: episodesError } = await supabaseClient
            .from('episodes')
            .select('*')
            .eq('movie_id', movieId)
            .order('episode_number', { ascending: true });
        
        if (!episodesError && episodesData && episodesData.length > 0) {
            episodes = episodesData.map(ep => ({
                id: ep.id,
                title: ep.title || `Episode ${ep.episode_number}`,
                url: ep.video_url,
                number: ep.episode_number
            }));
        } 
        else if (movie.episode_urls && Array.isArray(movie.episode_urls) && movie.episode_urls.length > 0) {
            episodes = movie.episode_urls.map((url, index) => ({
                id: `ep-${index + 1}`,
                title: `Episode ${index + 1}`,
                url: url,
                number: index + 1
            }));
        }
        else if (movie.video_url) {
            episodes = [{
                id: 'main',
                title: 'Full Movie',
                url: movie.video_url,
                number: 1
            }];
        } else {
            episodes = [];
        }
    } catch (error) {
        console.warn('Error loading episodes:', error);
        if (movie.episode_urls && Array.isArray(movie.episode_urls)) {
            episodes = movie.episode_urls.map((url, index) => ({
                id: `ep-${index + 1}`,
                title: `Episode ${index + 1}`,
                url: url,
                number: index + 1
            }));
        } else if (movie.video_url) {
            episodes = [{
                id: 'main',
                title: 'Full Movie',
                url: movie.video_url,
                number: 1
            }];
        } else {
            episodes = [];
        }
    }
}

// Display movie information
function displayMovie(movie, episodes) {
    document.title = `FilmKu - ${movie.title}`;
    
    setTextContent('movieTitle', movie.title);
    setTextContent('movieDesc', movie.description || 'Tidak ada deskripsi.');
    
    const catEl = document.getElementById('movieCategory');
    if (catEl) {
        catEl.innerText = movie.category === 'film' ? 'Film' : 'Donghua';
        catEl.className = `badge ${movie.category}`;
    }
    
    setTextContent('movieViews', formatNumber(movie.views || 0));
    
    const dateEl = document.getElementById('movieDate');
    if (dateEl) {
        if (movie.year) {
            dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${movie.year}`;
        } else {
            dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> -`;
        }
    }
    
    displayEpisodes(episodes, movie);
}

// Helper to set text content
function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

// Display episodes list
function displayEpisodes(episodes, movie) {
    const episodesList = document.getElementById('episodesList');
    const episodesSection = document.getElementById('episodesSection');
    
    if (!episodesList) return;
    
    episodesList.innerHTML = '';
    
    if (episodes.length > 0) {
        if (episodesSection) episodesSection.style.display = 'block';
        
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'episodes-scroll-container';
        
        episodes.forEach((ep, index) => {
            const episodeCard = document.createElement('div');
            episodeCard.className = 'episode-card';
            episodeCard.setAttribute('data-episode-index', index);
            episodeCard.setAttribute('data-episode-number', ep.number || index + 1);
            episodeCard.setAttribute('data-video-url', ep.url);
            
            const episodeTitle = ep.title || `Episode ${ep.number || index + 1}`;
            episodeCard.innerHTML = `<span>${episodeTitle}</span>`;
            
            episodeCard.onclick = () => {
                document.querySelectorAll('.episode-card').forEach(c => c.classList.remove('active'));
                episodeCard.classList.add('active');
                if (ep.url) {
                    playVideo(ep.url); // Menggunakan playVideo yang sudah ditingkatkan
                }
            };
            
            scrollContainer.appendChild(episodeCard);
        });
        
        episodesList.appendChild(scrollContainer);
        
        // Auto play first episode
        if (episodes[0]?.url) {
            playVideo(episodes[0].url);
            setTimeout(() => {
                const firstCard = document.querySelector('.episode-card');
                if (firstCard) firstCard.classList.add('active');
            }, 100);
        }
    } else {
        if (episodesSection) episodesSection.style.display = 'none';
        if (movie.video_url) {
            playVideo(movie.video_url);
        } else {
            episodesList.innerHTML = `
                <div class="error-episodes">
                    <i class="fas fa-exclamation-circle"></i> Video tidak tersedia
                </div>
            `;
        }
    }
}

// Load recommendations
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

// Create recommendation card
function createRecommendationCard(movie) {
    const thumb = movie.thumbnail || 'https://via.placeholder.com/200x300?text=No+Image';
    const episodeCount = movie.total_episodes || (movie.episode_urls ? movie.episode_urls.length : 0) || movie.episodes || 0;
    
    return `
        <div class="movie-card" onclick="window.location.href='player.html?id=${movie.id}'">
            <div class="movie-poster">
                <img src="${thumb}" alt="${movie.title}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/200x300?text=Error'">
                <span class="movie-category ${movie.category}">${movie.category}</span>
            </div>
            <div class="movie-info">
                <h4 class="movie-title">${movie.title}</h4>
                <div class="movie-meta">
                    <span><i class="fas fa-eye"></i> ${movie.views || 0}</span>
                    ${episodeCount > 0 ? `<span><i class="fas fa-list"></i> ${episodeCount}</span>` : ''}
                </div>
            </div>
        </div>
    `;
}

// Format number
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
    return num.toString();
}

// Show/hide loading
function showLoading(show) {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        if (show) {
            loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat video...';
        }
    }
}

// Show error
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

// ==================== SHARE FUNCTIONS ====================

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
        
        if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${title}%20-%20${url}`;
        else if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        else if (platform === 'telegram') shareUrl = `https://t.me/share/url?url=${url}&text=${title}`;
        
        if (shareUrl) window.open(shareUrl, '_blank', 'width=600,height=400');
    }
};

// Make share functions global
window.openShareModal = ShareFunctions.openModal;
window.closeModal = ShareFunctions.closeModal;
window.copyShareLink = ShareFunctions.copyLink;
window.shareVia = ShareFunctions.shareVia;

// Close modal when clicking outside
window.onclick = (e) => {
    const modal = document.getElementById('shareModal');
    if (e.target === modal) ShareFunctions.closeModal();
};

// ==================== INITIALIZATION ====================

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    if (!movieId) {
        window.location.href = 'index.html';
        return;
    }
    
    loadMovieData();
    
    // Initialize IMA SDK after a short delay
    setTimeout(() => {
        if (typeof google !== 'undefined' && google.ima) {
            initImaSDK();
        } else {
            console.warn('IMA SDK not loaded yet, retrying...');
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.ima) {
                    initImaSDK();
                }
            }, 1000);
        }
    }, 500);
});