// player.js - VERSI FINAL dengan IMA SDK Integration

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
        adsRequest.adTagUrl = 'https://plumprush.com/damTFQz.dAGXNbvnZ/GPUo/zeImG9tueZOU/l_kIPNT/YZ4/MbTEMoxSNPj/kotuN/jag/xXMnzAE/3CMqyqZYsKatWI1/pNd/DA0Fxv';
        
        // Specify the ad sizes
        adsRequest.linearAdSlotWidth = 640;
        adsRequest.linearAdSlotHeight = 360;
        adsRequest.nonLinearAdSlotWidth = 640;
        adsRequest.nonLinearAdSlotHeight = 150;
        
        // Store video URL for later use
        pendingVideoUrl = videoUrl;
        
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
        
        // Initialize ad container
        imaAdDisplayContainer.initialize();
        
        try {
            // Initialize ads manager
            imaAdsManager.init(
                imaVideoContent.offsetWidth,
                imaVideoContent.offsetHeight,
                google.ima.ViewMode.NORMAL
            );
            
            // Start ads if we have a pending video
            if (pendingVideoUrl) {
                // Set video source but don't play yet
                imaVideoContent.src = pendingVideoUrl;
                imaVideoContent.load();
                
                // Start ads
                imaAdsManager.start();
            }
        } catch (adError) {
            console.error('Error starting ads:', adError);
            // If ads fail, play video normally
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
    // Resume content
    if (pendingVideoUrl) {
        playVideoDirectly(pendingVideoUrl);
    }
}

// Handle content pause (ad starting)
function onContentPauseRequested() {
    imaVideoContent.pause();
    // Show loading overlay with ad indicator
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.innerHTML = '<i class="fas fa-ad"></i> Memutar iklan...';
        loadingOverlay.style.display = 'flex';
    }
}

// Handle content resume (ad finished)
function onContentResumeRequested() {
    // Hide loading overlay
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    // Play the video
    imaVideoContent.play();
}

// Handle all ads completed
function onAllAdsCompleted() {
    console.log('All ads completed');
}

// Play video directly without ads (fallback)
function playVideoDirectly(url) {
    const videoPlayer = document.getElementById('videoPlayer');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    if (!videoPlayer) return;
    
    videoPlayer.src = url;
    videoPlayer.load();
    videoPlayer.play();
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
    
    pendingVideoUrl = null;
}

// Main function to play video with ads
function playVideoWithAds(url) {
    if (!url) return;
    
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan video...';
    }
    
    // Check if IMA is available
    if (typeof google !== 'undefined' && google.ima && !imaInitialized) {
        initImaSDK();
        setTimeout(() => requestAds(url), 500);
    } else if (imaInitialized) {
        requestAds(url);
    } else {
        // Fallback: play without ads
        playVideoDirectly(url);
    }
}

// ==================== SUPABASE FUNCTIONS ====================

// Main function to load all data
async function loadMovieData() {
    try {
        showLoading(true);
        
        // Get movie details from movie_details table
        const { data: movie, error: movieError } = await supabaseClient
            .from('movie_details')
            .select('*')
            .eq('id', movieId)
            .single();
        
        if (movieError) throw movieError;
        if (!movie) throw new Error('Movie tidak ditemukan');
        
        currentMovie = movie;
        
        // Load episodes
        await loadEpisodes(movieId, movie);
        
        // Display movie info
        displayMovie(movie, episodes);
        
        // Increment view count
        incrementViews(movie.id, movie.views || 0);
        
        // Load recommendations
        loadRecommendations(movie.category);
        
        // Check if there's a selected episode from localStorage
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
                    playVideoWithAds(data.videoUrl);
                    
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

// Load episodes from episodes table or episode_urls
async function loadEpisodes(movieId, movie) {
    try {
        // Try to get from episodes table first
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
                number: ep.episode_number,
                duration: ep.duration,
                thumbnail: ep.thumbnail,
                views: ep.views
            }));
        } 
        // Fallback to episode_urls from movie_details
        else if (movie.episode_urls && Array.isArray(movie.episode_urls) && movie.episode_urls.length > 0) {
            episodes = movie.episode_urls.map((url, index) => ({
                id: `ep-${index + 1}`,
                title: `Episode ${index + 1}`,
                url: url,
                number: index + 1
            }));
        }
        // If it's a movie with single video
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
        
        // Final fallback
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

// Increment view count
async function incrementViews(movieId, currentViews) {
    try {
        await supabaseClient
            .from('movie_details')
            .update({ views: (currentViews || 0) + 1 })
            .eq('id', movieId);
    } catch (error) {
        console.warn('Failed to increment views:', error);
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
        } else if (movie.release_date) {
            const year = new Date(movie.release_date).getFullYear();
            dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${year}`;
        } else if (movie.created_at) {
            const year = new Date(movie.created_at).getFullYear();
            dateEl.innerHTML = `<i class="fas fa-calendar-alt"></i> ${year}`;
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
                    playVideoWithAds(ep.url);
                }
            };
            
            scrollContainer.appendChild(episodeCard);
        });
        
        episodesList.appendChild(scrollContainer);
        
        // Auto play first episode with ads
        if (episodes[0]?.url) {
            playVideoWithAds(episodes[0].url);
            setTimeout(() => {
                const firstCard = document.querySelector('.episode-card');
                if (firstCard) firstCard.classList.add('active');
            }, 100);
        }
    } else {
        if (episodesSection) episodesSection.style.display = 'none';
        if (movie.video_url) {
            playVideoWithAds(movie.video_url);
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

// Format number with K/M suffix
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
    return num.toString();
}

// Show/hide loading overlay
function showLoading(show) {
    const loadingOverlay = document.querySelector('.loading-overlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        if (show) {
            loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat video...';
        }
    }
}

// Show error message
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

// Setup video player event listeners
function setupVideoPlayer() {
    const videoPlayer = document.getElementById('videoPlayer');
    const loadingOverlay = document.querySelector('.loading-overlay');
    
    if (!videoPlayer || !loadingOverlay) return;
    
    videoPlayer.addEventListener('loadstart', () => {
        if (!imaAdsManager) { // Only show if not playing ads
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat video...';
        }
    });
    
    videoPlayer.addEventListener('canplay', () => {
        if (!imaAdsManager) {
            loadingOverlay.classList.add('hidden');
        }
    });
    
    videoPlayer.addEventListener('error', (e) => {
        console.error('Video error:', e);
        loadingOverlay.innerHTML = '<i class="fas fa-exclamation-circle"></i> Gagal memuat video';
        loadingOverlay.classList.remove('hidden');
    });
}

// Handle resize events for ads
window.addEventListener('resize', () => {
    if (imaAdsManager && imaVideoContent) {
        try {
            imaAdsManager.resize(
                imaVideoContent.offsetWidth,
                imaVideoContent.offsetHeight,
                google.ima.ViewMode.NORMAL
            );
        } catch (e) {
            console.error('Error resizing ads:', e);
        }
    }
});

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
    setupVideoPlayer();
    
    // Initialize IMA SDK after a short delay
    setTimeout(() => {
        if (typeof google !== 'undefined' && google.ima) {
            initImaSDK();
        } else {
            console.warn('IMA SDK not loaded yet, retrying...');
            // Retry after 1 second
            setTimeout(() => {
                if (typeof google !== 'undefined' && google.ima) {
                    initImaSDK();
                }
            }, 1000);
        }
    }, 500);
});