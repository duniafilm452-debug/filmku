// player.js - FilmKu v7.1 - Versi dengan perbaikan IMA SDK dan loading overlay

// ==================== KONFIGURASI ====================
const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o'
};

// ==================== INISIALISASI SUPABASE ====================
let supabaseClient = null;

function initSupabase() {
  try {
    if (typeof supabase === 'undefined') {
      throw new Error('Library Supabase tidak termuat.');
    }
    supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('Supabase berhasil diinisialisasi');
    return true;
  } catch (err) {
    console.error('Gagal inisialisasi Supabase:', err.message);
    return false;
  }
}

// ==================== STATE ====================
const movieId = new URLSearchParams(window.location.search).get('id');
let currentMovie = null;
let currentEpisodes = [];

// IMA SDK
let imaAdDisplayContainer = null;
let imaAdsLoader = null;
let imaAdsManager = null;
let imaVideoContent = null;
let imaInitialized = false;
let pendingVideoUrl = null;

// ==================== HELPERS ====================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'Jt';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'Rb';
  return num.toString();
}

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || '-';
}

function showLoading(show, message) {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  
  if (show) {
    overlay.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>${escapeHtml(message || 'Memuat video...')}</span>`;
    overlay.style.display = 'flex';
    console.log('Loading overlay ditampilkan:', message);
  } else {
    overlay.style.display = 'none';
    console.log('Loading overlay disembunyikan');
  }
}

function showErrorOverlay(message) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.innerHTML = `<i class="fas fa-exclamation-circle" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
    overlay.style.display = 'flex';
    console.error('Error overlay:', message);
  }
}

// ==================== DETEKSI JENIS URL ====================
function isEmbedUrl(url) {
  if (!url) return false;
  const embedDomains = [
    'youtube.com', 'youtu.be', 'dailymotion.com',
    'vimeo.com', 'facebook.com', 'instagram.com',
    'twitch.tv', 'embed'
  ];
  return embedDomains.some(d => url.includes(d));
}

function isHlsUrl(url) {
  return url ? url.toLowerCase().includes('.m3u8') : false;
}

function isCloudflareR2Url(url) {
  if (!url) return false;
  return url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com');
}

function isDirectVideoUrl(url) {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.mkv', '.avi', '.m4v'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext)) || isCloudflareR2Url(url);
}

// Konversi URL share YouTube/Dailymotion/Vimeo ke format embed
function toEmbedUrl(url) {
  try {
    if (url.includes('youtube.com/watch')) {
      const id = new URL(url).searchParams.get('v');
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : url;
    }
    if (url.includes('youtu.be/')) {
      const id = url.split('youtu.be/')[1].split('?')[0];
      return `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
    }
    if (url.includes('dailymotion.com/video/')) {
      const id = url.split('video/')[1].split('?')[0];
      return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
    }
    if (url.includes('vimeo.com/')) {
      const id = url.split('vimeo.com/')[1].split('?')[0];
      return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }
  } catch (e) {
    console.warn('Gagal parse URL embed:', e);
  }
  return url;
}

// ==================== SUPABASE FUNCTIONS ====================
async function incrementViews(id, currentViews) {
  if (!supabaseClient || !id) return;
  try {
    await supabaseClient
      .from('movie_details')
      .update({ views: (currentViews || 0) + 1 })
      .eq('id', id);
    console.log('Views berhasil diupdate');
  } catch (err) {
    console.warn('Gagal update views:', err.message);
  }
}

async function loadEpisodes(id, movie) {
  if (!id || !movie) return [];

  try {
    if (supabaseClient) {
      const { data, error } = await supabaseClient
        .from('episodes')
        .select('id, episode_number, title, video_url, thumbnail, duration, views')
        .eq('movie_id', id)
        .order('episode_number', { ascending: true });

      if (!error && data && data.length > 0) {
        console.log(`Memuat ${data.length} episode dari database`);
        return data.map(ep => ({
          id: ep.id,
          title: ep.title || `Episode ${ep.episode_number}`,
          url: ep.video_url,
          number: ep.episode_number,
          thumbnail: ep.thumbnail,
          duration: ep.duration,
          views: ep.views
        }));
      }
    }
  } catch (err) {
    console.warn('Error query tabel episodes:', err.message);
  }

  // Fallback ke episode_urls dari movie_details
  if (Array.isArray(movie.episode_urls) && movie.episode_urls.length > 0) {
    return movie.episode_urls.map((url, i) => ({
      id: `ep-${i + 1}`,
      title: `Episode ${i + 1}`,
      url: url,
      number: i + 1
    }));
  }

  // Fallback ke video_url tunggal
  if (movie.video_url) {
    return [{
      id: 'main',
      title: 'Full Movie',
      url: movie.video_url,
      number: 1
    }];
  }

  return [];
}

async function loadRecommendations(category) {
  const recList = document.getElementById('recommendationsList');
  if (!recList || !supabaseClient) return;

  try {
    const { data, error } = await supabaseClient
      .from('movie_details')
      .select('id, title, category, thumbnail, views, total_episodes, episode_urls, episodes, year')
      .eq('category', category || 'film')
      .neq('id', movieId)
      .limit(6);

    if (error) throw error;

    if (data && data.length > 0) {
      recList.innerHTML = data.map(createRecommendationCard).join('');
      console.log('Rekomendasi dimuat:', data.length);
    } else {
      recList.innerHTML = '<p class="no-recommendations">Tidak ada rekomendasi serupa.</p>';
    }
  } catch (err) {
    console.error('Gagal memuat rekomendasi:', err.message);
    recList.innerHTML = '<p class="no-recommendations">Gagal memuat rekomendasi.</p>';
  }
}

const PLACEHOLDER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='%23252525'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";

function createRecommendationCard(movie) {
  const thumb = movie.thumbnail || PLACEHOLDER_SVG;
  const epCount = movie.total_episodes ||
    (Array.isArray(movie.episode_urls) ? movie.episode_urls.length : 0) ||
    movie.episodes || 0;

  return `
    <div class="movie-card" onclick="window.location.href='player.html?id=${escapeHtml(String(movie.id))}'"
         role="button" tabindex="0" aria-label="Tonton ${escapeHtml(movie.title)}"
         onkeydown="if(event.key==='Enter') window.location.href='player.html?id=${escapeHtml(String(movie.id))}'">
      <div class="movie-poster">
        <img src="${escapeHtml(thumb)}" alt="${escapeHtml(movie.title || 'Movie')}" loading="lazy"
             onerror="this.onerror=null;this.src='${PLACEHOLDER_SVG}'">
        <span class="movie-category ${escapeHtml(movie.category || 'film')}">${movie.category === 'donghua' ? 'Donghua' : 'Film'}</span>
      </div>
      <div class="movie-info">
        <h4 class="movie-title">${escapeHtml(movie.title || 'Unknown')}</h4>
        <div class="movie-meta">
          <span><i class="fas fa-eye" aria-hidden="true"></i> ${formatNumber(movie.views || 0)}</span>
          ${epCount > 0 ? `<span><i class="fas fa-list" aria-hidden="true"></i> ${epCount} eps</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ==================== PLAYER FUNCTIONS ====================
function resetPlayer() {
  const player = document.getElementById('videoPlayer');
  const wrapper = document.getElementById('videoWrapper');
  if (!player || !wrapper) return;

  // Hapus iframe jika ada
  wrapper.querySelectorAll('iframe').forEach(el => el.remove());

  // Reset video element
  player.style.display = 'block';
  player.pause();
  player.removeAttribute('src');
  player.load();

  // Destroy IMA manager jika ada
  if (imaAdsManager) {
    try { 
      imaAdsManager.destroy(); 
      console.log('IMA Manager di-destroy');
    } catch (e) {}
    imaAdsManager = null;
  }
  
  // Hapus container iklan lama
  const oldAdContainer = wrapper.querySelector('.ima-ad-container');
  if (oldAdContainer) oldAdContainer.remove();
  
  showLoading(false);
}

function playVideoDirectly(url) {
  const player = document.getElementById('videoPlayer');
  if (!player || !url) return;

  console.log('Memutar video langsung:', url);
  player.src = url;
  player.load();
  player.play().catch(e => {
    console.info('Autoplay diblokir, user perlu klik play:', e.message);
  });

  showLoading(false);
  pendingVideoUrl = null;
}

function playEmbedVideo(url) {
  resetPlayer();

  const player = document.getElementById('videoPlayer');
  const wrapper = document.getElementById('videoWrapper');
  if (!player || !wrapper) return;

  player.style.display = 'none';

  const embedUrl = toEmbedUrl(url);
  console.log('Memutar video embed:', embedUrl);

  const iframe = document.createElement('iframe');
  iframe.src = embedUrl;
  iframe.allowFullscreen = true;
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;';
  iframe.title = 'Video Player';

  wrapper.appendChild(iframe);
  showLoading(false);
}

function playHlsVideo(url) {
  console.log('Memutar video HLS:', url);
  
  // Coba native HLS dulu (Safari support)
  const player = document.getElementById('videoPlayer');
  if (player && player.canPlayType('application/vnd.apple.mpegurl')) {
    playVideoDirectly(url);
    return;
  }

  // Load HLS.js untuk browser lain
  if (typeof Hls !== 'undefined') {
    loadHlsWithLibrary(url);
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = () => loadHlsWithLibrary(url);
    script.onerror = () => {
      console.warn('Gagal load HLS.js, mencoba direct play');
      playVideoDirectly(url);
    };
    document.head.appendChild(script);
  }
}

function loadHlsWithLibrary(url) {
  const player = document.getElementById('videoPlayer');
  if (!player) return;

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(player);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      player.play().catch(e => console.info('Autoplay diblokir:', e.message));
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        console.error('HLS error fatal:', data);
        showErrorOverlay('Gagal memuat video HLS.');
      }
    });
  } else {
    playVideoDirectly(url);
  }

  showLoading(false);
  pendingVideoUrl = null;
}

// ==================== IMA SDK FUNCTIONS ====================
function initImaSDK() {
  console.log('Inisialisasi IMA SDK...');
  
  if (window.imaLoadFailed) {
    console.warn('IMA SDK gagal dimuat, iklan dinonaktifkan.');
    imaInitialized = false;
    return;
  }

  try {
    if (typeof google === 'undefined' || !google.ima) {
      console.warn('IMA SDK tidak tersedia.');
      return;
    }

    imaVideoContent = document.getElementById('videoPlayer');
    const wrapper = document.getElementById('videoWrapper');
    if (!imaVideoContent || !wrapper) return;

    imaAdDisplayContainer = new google.ima.AdDisplayContainer(wrapper, imaVideoContent);
    imaAdsLoader = new google.ima.AdsLoader(imaAdDisplayContainer);

    imaAdsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      onAdsManagerLoaded
    );
    imaAdsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      onAdError
    );

    imaInitialized = true;
    console.log('IMA SDK berhasil diinisialisasi.');

    if (pendingVideoUrl) {
      const url = pendingVideoUrl;
      pendingVideoUrl = null;
      requestAds(url);
    }
  } catch (e) {
    console.error('Error inisialisasi IMA:', e);
    imaInitialized = false;
  }
}

function requestAds(videoUrl) {
  console.log('Request iklan untuk video:', videoUrl);
  
  if (!imaInitialized || !imaAdsLoader) {
    console.log('IMA belum siap, langsung putar video');
    playVideoDirectly(videoUrl);
    return;
  }

  try {
    pendingVideoUrl = videoUrl;

    const adsRequest = new google.ima.AdsRequest();
    adsRequest.adTagUrl = 'https://plumprush.com/dnm_FJzLd.GgN/vwZZGDUs/petmv9tuEZyUdlhkiPmTlY-4RMGTkMtxDNcjRkatuNzjcgBx/MTzLEq3lM/yyZJsUavWo1HpwdBDQ0rxi';

    const playerWidth = (imaVideoContent && imaVideoContent.offsetWidth) || 640;
    const playerHeight = (imaVideoContent && imaVideoContent.offsetHeight) || 360;

    adsRequest.linearAdSlotWidth = playerWidth;
    adsRequest.linearAdSlotHeight = playerHeight;
    adsRequest.nonLinearAdSlotWidth = playerWidth;
    adsRequest.nonLinearAdSlotHeight = Math.floor(playerHeight / 3);

    imaAdsLoader.requestAds(adsRequest);
    console.log('Request iklan dikirim');
  } catch (e) {
    console.error('Error request ads:', e);
    playVideoDirectly(videoUrl);
  }
}

function onAdsManagerLoaded(event) {
  console.log('IMA: AdsManager loaded');
  
  try {
    if (!imaVideoContent) return;

    const settings = new google.ima.AdsRenderingSettings();
    settings.restoreCustomPlaybackStateOnAdBreakComplete = true;
    settings.enablePreloading = true;

    imaAdsManager = event.getAdsManager(imaVideoContent, settings);

    imaAdsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, onAdError);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED, onContentPauseRequested);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED, onContentResumeRequested);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, onAllAdsCompleted);
    
    // Tambahkan listener untuk event iklan
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.STARTED, onAdStarted);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.RESUMED, onAdResumed);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.FIRST_QUARTILE, onAdProgress);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.MIDPOINT, onAdProgress);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.THIRD_QUARTILE, onAdProgress);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, onAdComplete);

    if (imaAdDisplayContainer) {
      imaAdDisplayContainer.initialize();
    }

    const w = (imaVideoContent.offsetWidth) || 640;
    const h = (imaVideoContent.offsetHeight) || 360;

    imaAdsManager.init(w, h, google.ima.ViewMode.NORMAL);
    imaAdsManager.setVolume(1.0);

    if (pendingVideoUrl) {
      console.log('Memulai iklan dengan video:', pendingVideoUrl);
      imaVideoContent.src = pendingVideoUrl;
      imaVideoContent.load();
      imaAdsManager.start();
    }
  } catch (e) {
    console.error('Error di onAdsManagerLoaded:', e);
    if (pendingVideoUrl) {
      const url = pendingVideoUrl;
      pendingVideoUrl = null;
      playVideoDirectly(url);
    }
  }
}

function onAdStarted(event) {
  console.log('IMA: Ad started - iklan mulai diputar');
  showLoading(false); // Pastikan loading hilang saat iklan mulai
  
  // Pastikan container iklan terlihat
  const wrapper = document.getElementById('videoWrapper');
  const adContainer = wrapper.querySelector('.ima-ad-container');
  if (adContainer) {
    adContainer.style.zIndex = '20';
    adContainer.style.display = 'block';
    console.log('IMA: Ad container visible');
  }
}

function onAdResumed(event) {
  console.log('IMA: Ad resumed');
  showLoading(false);
}

function onAdProgress(event) {
  console.log('IMA: Ad progress -', event.type);
  showLoading(false);
}

function onAdComplete(event) {
  console.log('IMA: Ad completed');
  showLoading(false);
}

function onAdError(event) {
  const errMsg = event.getError ? event.getError().toString() : 'Unknown ad error';
  console.warn('Ad error:', errMsg);

  if (imaAdsManager) {
    try { imaAdsManager.destroy(); } catch (e) {}
    imaAdsManager = null;
  }

  showLoading(false);

  if (pendingVideoUrl) {
    const url = pendingVideoUrl;
    pendingVideoUrl = null;
    playVideoDirectly(url);
  }
}

function onContentPauseRequested() {
  console.log('IMA: Content paused requested - iklan akan diputar');
  if (imaVideoContent) imaVideoContent.pause();
  
  // JANGAN tampilkan loading overlay
  showLoading(false); // Pastikan loading hilang
}

function onContentResumeRequested() {
  console.log('IMA: Content resume requested - iklan selesai');
  showLoading(false);
  if (imaVideoContent) {
    imaVideoContent.play().catch(e => console.info('Resume play diblokir:', e.message));
  }
}

function onAllAdsCompleted() {
  console.log('IMA: All ads completed');
  showLoading(false);
  pendingVideoUrl = null;
}

function playVideoWithAds(url) {
  if (!url) return;

  console.log('Memutar video dengan iklan:', url);
  showLoading(true, 'Menyiapkan video...');

  const player = document.getElementById('videoPlayer');
  const wrapper = document.getElementById('videoWrapper');
  
  if (player) {
    player.style.display = 'block';
    player.pause();
    player.removeAttribute('src');
    player.load();
  }

  // Hapus container iklan lama jika ada
  const oldAdContainer = wrapper.querySelector('.ima-ad-container');
  if (oldAdContainer) oldAdContainer.remove();

  // Cek status IMA
  console.log('Status IMA:', {
    googleExists: typeof google !== 'undefined',
    imaExists: typeof google !== 'undefined' && google.ima,
    imaInitialized: imaInitialized,
    imaLoadFailed: window.imaLoadFailed
  });

  if (typeof google !== 'undefined' && google.ima && !window.imaLoadFailed) {
    if (!imaInitialized) {
      console.log('Inisialisasi IMA SDK...');
      initImaSDK();
      setTimeout(() => {
        if (!imaInitialized) {
          console.log('IMA gagal diinisialisasi, fallback ke direct play');
          playVideoDirectly(url);
        } else if (imaInitialized && !imaAdsManager) {
          console.log('Request iklan setelah inisialisasi');
          requestAds(url);
        }
      }, 2000);
    } else {
      console.log('IMA sudah siap, request iklan');
      requestAds(url);
    }
  } else {
    console.log('IMA tidak tersedia, langsung putar video');
    playVideoDirectly(url);
  }
}

// Fungsi utama: pilih cara putar berdasarkan tipe URL
function playVideo(url) {
  if (!url) {
    showErrorOverlay('URL video tidak tersedia.');
    return;
  }

  console.log('Memutar video dengan tipe URL:', url);
  resetPlayer();
  showLoading(true, 'Memuat video...');

  if (isEmbedUrl(url)) {
    playEmbedVideo(url);
  } else if (isHlsUrl(url)) {
    playHlsVideo(url);
  } else if (isCloudflareR2Url(url) || isDirectVideoUrl(url)) {
    playVideoWithAds(url);
  } else {
    console.warn('Tipe URL tidak dikenali, mencoba direct play:', url);
    playVideoWithAds(url);
  }
}

// ==================== SETUP VIDEO PLAYER EVENTS ====================
function setupVideoPlayer() {
  const player = document.getElementById('videoPlayer');
  const overlay = document.getElementById('loadingOverlay');
  if (!player || !overlay) return;

  player.addEventListener('loadstart', () => {
    console.log('Video: loadstart');
    if (!imaAdsManager) showLoading(true, 'Memuat video...');
  });

  player.addEventListener('canplay', () => {
    console.log('Video: canplay');
    if (!imaAdsManager) showLoading(false);
  });

  player.addEventListener('playing', () => {
    console.log('Video: playing');
    showLoading(false);
  });

  player.addEventListener('waiting', () => {
    console.log('Video: waiting');
    if (!imaAdsManager) showLoading(true, 'Buffering...');
  });

  player.addEventListener('error', () => {
    const err = player.error;
    let msg = 'Gagal memuat video.';
    if (err) {
      switch (err.code) {
        case MediaError.MEDIA_ERR_NETWORK: msg = 'Error jaringan saat memuat video.'; break;
        case MediaError.MEDIA_ERR_DECODE: msg = 'Format video tidak didukung.'; break;
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED: msg = 'Sumber video tidak dapat diputar (mungkin masalah CORS).'; break;
        default: msg = `Error video: ${err.message || 'Tidak diketahui'}.`;
      }
    }
    console.error('Video error:', msg);
    showErrorOverlay(msg);
  });

  player.addEventListener('stalled', () => {
    console.log('Video: stalled');
  });

  player.addEventListener('suspend', () => {
    console.log('Video: suspend');
  });

  console.log('Video player events setup selesai');
}

// ==================== DISPLAY FILM ====================
function displayMovie(movie, episodes) {
  if (!movie) return;

  console.log('Menampilkan film:', movie.title);
  document.title = `FilmKu - ${movie.title || 'Movie'}`;

  setTextContent('movieTitle', movie.title);
  setTextContent('movieDesc', movie.description || 'Tidak ada deskripsi.');

  const catEl = document.getElementById('movieCategory');
  if (catEl) {
    const catLabel = movie.category === 'donghua' ? 'Donghua' : 'Film';
    catEl.textContent = catLabel;
    catEl.className = `badge ${movie.category || 'film'}`;
  }

  setTextContent('movieViews', formatNumber(movie.views || 0));

  const dateEl = document.getElementById('movieDate');
  if (dateEl) {
    let year = movie.year;
    if (!year && movie.release_date) year = new Date(movie.release_date).getFullYear();
    if (!year && movie.created_at) year = new Date(movie.created_at).getFullYear();
    dateEl.innerHTML = year
      ? `<i class="fas fa-calendar-alt" aria-hidden="true"></i> ${year}`
      : `<i class="fas fa-calendar-alt" aria-hidden="true"></i> -`;
  }

  // Tampilkan rating jika ada
  if (movie.rating) {
    const ratingSection = document.getElementById('movieRating');
    if (ratingSection) ratingSection.style.display = '';
    setTextContent('movieRatingValue', Number(movie.rating).toFixed(1));
  }

  displayEpisodes(episodes, movie);
}

function displayEpisodes(episodes, movie) {
  const list = document.getElementById('episodesList');
  const section = document.getElementById('episodesSection');
  if (!list) return;

  list.innerHTML = '';

  if (episodes && episodes.length > 0) {
    console.log(`Menampilkan ${episodes.length} episode`);
    if (section) section.style.display = 'block';

    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'episodes-scroll-container';
    scrollContainer.setAttribute('role', 'list');

    episodes.forEach((ep, index) => {
      const card = document.createElement('div');
      card.className = 'episode-card';
      card.setAttribute('role', 'listitem');
      card.setAttribute('tabindex', '0');
      card.setAttribute('data-episode-index', index);
      card.setAttribute('data-episode-number', ep.number || index + 1);
      card.setAttribute('aria-label', ep.title || `Episode ${ep.number || index + 1}`);

      card.innerHTML = `<span>${escapeHtml(ep.title || `Episode ${ep.number || index + 1}`)}</span>`;

      const onPlay = () => {
        console.log('Memilih episode:', ep.title);
        document.querySelectorAll('.episode-card').forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-current', 'false');
        });
        card.classList.add('active');
        card.setAttribute('aria-current', 'true');
        if (ep.url) playVideo(ep.url);
      };

      card.addEventListener('click', onPlay);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay();
        }
      });

      scrollContainer.appendChild(card);
    });

    list.appendChild(scrollContainer);

    // Auto play episode pertama
    if (episodes[0]?.url) {
      console.log('Auto play episode pertama');
      playVideo(episodes[0].url);
      setTimeout(() => {
        const firstCard = list.querySelector('.episode-card');
        if (firstCard) {
          firstCard.classList.add('active');
          firstCard.setAttribute('aria-current', 'true');
        }
      }, 100);
    }
  } else {
    // Tidak ada episode
    console.log('Tidak ada episode, mencoba video_url langsung');
    if (section) section.style.display = 'none';
    if (movie && movie.video_url) {
      playVideo(movie.video_url);
    } else {
      list.innerHTML = `
        <div class="error-episodes" role="alert">
          <i class="fas fa-exclamation-circle" aria-hidden="true"></i> Video tidak tersedia.
        </div>`;
    }
  }
}

// ==================== RESIZE IMA ====================
window.addEventListener('resize', () => {
  if (imaAdsManager && imaVideoContent) {
    try {
      imaAdsManager.resize(
        imaVideoContent.offsetWidth || 640,
        imaVideoContent.offsetHeight || 360,
        google.ima.ViewMode.NORMAL
      );
      console.log('IMA: Resize');
    } catch (e) {
      console.warn('Error resize IMA:', e);
    }
  }
}, { passive: true });

// ==================== SHARE FUNCTIONS ====================
window.openShareModal = function() {
  const modal = document.getElementById('shareModal');
  const linkInput = document.getElementById('shareLink');
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
  if (linkInput) linkInput.value = window.location.href;
  console.log('Modal share dibuka');
};

window.closeModal = function() {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
  console.log('Modal share ditutup');
};

window.copyShareLink = function() {
  const input = document.getElementById('shareLink');
  if (!input) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => showToast()).catch(() => {
      fallbackCopy(input);
    });
  } else {
    fallbackCopy(input);
  }
};

function fallbackCopy(input) {
  input.select();
  input.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    showToast();
  } catch (e) {
    console.warn('Gagal copy:', e);
  }
}

function showToast() {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2500);
  }
  window.closeModal();
}

window.shareVia = function(platform) {
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.getElementById('movieTitle')?.textContent || 'FilmKu');
  let shareUrl = '';

  if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${title}%20-%20${url}`;
  else if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  else if (platform === 'telegram') shareUrl = `https://t.me/share/url?url=${url}&text=${title}`;

  if (shareUrl) {
    window.open(shareUrl, '_blank', 'noopener,width=600,height=400');
    console.log('Share via:', platform);
  }
};

// Tutup modal saat klik di luar
window.addEventListener('click', (e) => {
  const modal = document.getElementById('shareModal');
  if (e.target === modal) window.closeModal();
});

// Tutup modal dengan tombol Escape
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeModal();
});

// ==================== INISIALISASI UTAMA ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded - Memulai inisialisasi player');
  console.log('Movie ID:', movieId);

  // Cek movie ID
  if (!movieId) {
    console.log('Tidak ada movie ID, redirect ke index');
    window.location.replace('index.html');
    return;
  }

  // Setup event player
  setupVideoPlayer();

  // Inisialisasi Supabase
  if (!initSupabase()) {
    document.getElementById('episodesList').innerHTML = `
      <div class="error-episodes" role="alert">
        <i class="fas fa-exclamation-circle"></i> Gagal menghubungkan ke database.
      </div>`;
    return;
  }

  try {
    showLoading(true, 'Memuat data film...');

    // Query movie_details
    console.log('Mengambil data film...');
    const { data: movie, error } = await supabaseClient
      .from('movie_details')
      .select('id, title, category, description, year, thumbnail, video_url, episode_urls, episodes, views, rating, release_date, created_at, total_episodes')
      .eq('id', movieId)
      .single();

    if (error) throw error;
    if (!movie) throw new Error('Film tidak ditemukan.');

    console.log('Data film berhasil dimuat:', movie.title);
    currentMovie = movie;

    // Muat episode
    const episodes = await loadEpisodes(movieId, movie);
    currentEpisodes = episodes;

    // Tampilkan info film
    displayMovie(movie, episodes);

    // Update view count
    incrementViews(movie.id, movie.views || 0);

    // Muat rekomendasi
    loadRecommendations(movie.category);

    // Inisialisasi IMA SDK setelah semua siap
    setTimeout(() => {
      if (!window.imaLoadFailed && typeof google !== 'undefined' && google.ima) {
        console.log('Memulai inisialisasi IMA SDK...');
        initImaSDK();
      } else {
        console.log('IMA SDK tidak tersedia atau gagal dimuat');
      }
    }, 1000);

  } catch (err) {
    console.error('Error memuat data film:', err);
    showLoading(false);
    setTextContent('movieTitle', 'Gagal Memuat Film');
    const epList = document.getElementById('episodesList');
    if (epList) {
      epList.innerHTML = `
        <div class="error-episodes" role="alert">
          <i class="fas fa-exclamation-circle"></i>
          ${escapeHtml(err.message || 'Terjadi kesalahan.')}
          <br><br>
          <button onclick="location.reload()" style="margin-top:8px;padding:8px 16px;background:#e50914;border:none;border-radius:6px;color:#fff;cursor:pointer;">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
        </div>`;
      const section = document.getElementById('episodesSection');
      if (section) section.style.display = 'block';
    }
  }
});