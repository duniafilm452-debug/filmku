// player.js - FilmKu v7.4 - IMA SDK + Custom Skip Button Countdown (FIXED)

// ==================== KONFIGURASI ====================
const CONFIG = {
  SUPABASE_URL: 'https://jsbqmtzkayvnpzmnycyv.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYnFtdHprYXl2bnB6bW55Y3l2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjQyNTksImV4cCI6MjA3NzgwMDI1OX0.fpIU4CPrV0CwedXpLSzoLM_ZYLgl7VDYRZcYE55hy6o',
  VAST_AD_TAG_URL: 'https://plumprush.com/dimAFNzdd.GvNQvEZFGqUm/UeAmf9hucZNUalKkEPjT/Yq4qMVTqM/xeNbjskMt/Nijzg/xPMHz/Eg3/MRyIZKsSa_Wq1OpXdBDp0ExE'
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

// ==================== IMA SDK STATE ====================
let imaAdDisplayContainer = null;
let imaAdsLoader = null;
let imaAdsManager = null;
let imaVideoContent = null;
let imaAdContainerEl = null;
let imaInitialized = false;
let imaContainerInitialized = false;
let pendingVideoUrl = null;

// ==================== SKIP BUTTON STATE ====================
let skipButtonEl = null;
let skipCountdownInterval = null;
let skipOffsetSeconds = 5;
let adDurationSeconds = 0;

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
    overlay.style.zIndex = '5';
  } else {
    overlay.style.display = 'none';
  }
}

function showErrorOverlay(message) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.innerHTML = `<i class="fas fa-exclamation-circle" aria-hidden="true"></i><span>${escapeHtml(message)}</span>`;
    overlay.style.display = 'flex';
    overlay.style.zIndex = '5';
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
    const { error: rpcError } = await supabaseClient.rpc('increment_views', { movie_id: id });

    if (!rpcError) {
      console.log('Views berhasil diincrement via RPC');
      const { data: updated } = await supabaseClient
        .from('movie_details')
        .select('views')
        .eq('id', id)
        .single();
      if (updated) {
        const viewsEl = document.getElementById('movieViews');
        if (viewsEl) viewsEl.textContent = formatNumber(updated.views || 0);
      }
    } else {
      console.warn('RPC increment_views tidak tersedia, pakai fallback:', rpcError.message);
      const newViews = (currentViews || 0) + 1;
      const { error: updateError } = await supabaseClient
        .from('movie_details')
        .update({ views: newViews })
        .eq('id', id);

      if (!updateError) {
        const viewsEl = document.getElementById('movieViews');
        if (viewsEl) viewsEl.textContent = formatNumber(newViews);
      } else {
        console.error('Gagal update views:', updateError.message);
      }
    }
  } catch (err) {
    console.warn('Error incrementViews:', err.message);
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

  if (Array.isArray(movie.episode_urls) && movie.episode_urls.length > 0) {
    return movie.episode_urls.map((url, i) => ({
      id: `ep-${i + 1}`,
      title: `Episode ${i + 1}`,
      url: url,
      number: i + 1
    }));
  }

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

// ==================== DISPLAY FILM ====================
function displayMovie(movie, episodes) {
  if (!movie) return;

  setTextContent('movieTitle', movie.title);
  setTextContent('movieDesc', movie.description || 'Deskripsi tidak tersedia.');
  setTextContent('movieViews', formatNumber(movie.views || 0));

  document.title = `${movie.title || 'Film'} - FilmKu`;

  const catEl = document.getElementById('movieCategory');
  if (catEl) {
    const cat = movie.category || 'film';
    catEl.textContent = cat === 'donghua' ? 'Donghua' : 'Film';
    catEl.className = `badge ${cat}`;
  }

  const dateEl = document.getElementById('movieDate');
  if (dateEl) {
    const year = movie.year || (movie.release_date ? new Date(movie.release_date).getFullYear() : null);
    if (year) {
      dateEl.innerHTML = `<i class="fas fa-calendar-alt" aria-hidden="true"></i> ${year}`;
    }
  }

  const ratingEl = document.getElementById('movieRating');
  const ratingVal = document.getElementById('movieRatingValue');
  if (ratingEl && ratingVal && movie.rating) {
    ratingVal.textContent = movie.rating;
    ratingEl.style.display = 'flex';
  }

  renderEpisodes(movie, episodes);
}

// ==================== RENDER EPISODE ====================
function renderEpisodes(movie, episodes) {
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

// ==================== PLAYER FUNCTIONS ====================
function resetPlayer() {
  const player = document.getElementById('videoPlayer');
  const wrapper = document.getElementById('videoWrapper');
  if (!player || !wrapper) return;

  wrapper.querySelectorAll('iframe').forEach(el => el.remove());

  player.style.display = 'block';
  player.pause();
  player.removeAttribute('src');
  player.load();

  if (imaAdsManager) {
    try {
      imaAdsManager.destroy();
      console.log('IMA Manager di-destroy');
    } catch (e) {}
    imaAdsManager = null;
  }

  if (imaAdContainerEl) {
    imaAdContainerEl.style.display = 'none';
  }

  showLoading(false);
}

function playVideoDirectly(url) {
  const player = document.getElementById('videoPlayer');
  if (!player || !url) return;

  console.log('Memutar video langsung (tanpa iklan):', url);

  if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';

  player.style.display = 'block';
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
  iframe.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;border:none;z-index:2;';
  iframe.title = 'Video Player';

  wrapper.appendChild(iframe);
  showLoading(false);
}

function playHlsVideo(url) {
  console.log('Memutar video HLS:', url);

  const player = document.getElementById('videoPlayer');
  if (player && player.canPlayType('application/vnd.apple.mpegurl')) {
    playVideoDirectly(url);
    return;
  }

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
    imaAdContainerEl = document.getElementById('adContainer');

    if (!imaVideoContent || !imaAdContainerEl) {
      console.warn('Elemen video atau adContainer tidak ditemukan.');
      return;
    }

    imaAdDisplayContainer = new google.ima.AdDisplayContainer(imaAdContainerEl, imaVideoContent);
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
    console.log('IMA SDK berhasil diinisialisasi dengan adContainer terpisah.');

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

  if (!imaInitialized || !imaAdsLoader || !imaAdDisplayContainer) {
    console.log('IMA belum siap, langsung putar video');
    playVideoDirectly(videoUrl);
    return;
  }

  try {
    pendingVideoUrl = videoUrl;

    if (!imaContainerInitialized) {
      imaAdDisplayContainer.initialize();
      imaContainerInitialized = true;
      console.log('IMA: AdDisplayContainer.initialize() dipanggil');
    }

    if (imaAdContainerEl) {
      imaAdContainerEl.style.display = 'block';
    }

    const adsRequest = new google.ima.AdsRequest();
    adsRequest.adTagUrl = CONFIG.VAST_AD_TAG_URL;

    const playerWidth = (imaVideoContent && imaVideoContent.offsetWidth) || 640;
    const playerHeight = (imaVideoContent && imaVideoContent.offsetHeight) || 360;

    adsRequest.linearAdSlotWidth = playerWidth;
    adsRequest.linearAdSlotHeight = playerHeight;
    adsRequest.nonLinearAdSlotWidth = playerWidth;
    adsRequest.nonLinearAdSlotHeight = Math.floor(playerHeight / 3);

    imaAdsLoader.requestAds(adsRequest);
    console.log('Request iklan dikirim ke IMA SDK');
  } catch (e) {
    console.error('Error request ads:', e);
    playVideoDirectly(videoUrl);
  }
}

function onAdsManagerLoaded(event) {
  console.log('IMA: AdsManager berhasil dimuat');

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
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.STARTED, onAdStarted);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, onAdComplete);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.SKIPPED, onAdSkipped);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.FIRST_QUARTILE, onAdProgress);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.MIDPOINT, onAdProgress);
    imaAdsManager.addEventListener(google.ima.AdEvent.Type.THIRD_QUARTILE, onAdProgress);

    const w = (imaVideoContent.offsetWidth) || 640;
    const h = (imaVideoContent.offsetHeight) || 360;

    imaAdsManager.init(w, h, google.ima.ViewMode.NORMAL);
    imaAdsManager.setVolume(1.0);

    if (pendingVideoUrl) {
      console.log('Memulai iklan, video menunggu:', pendingVideoUrl);

      imaVideoContent.src = pendingVideoUrl;
      imaVideoContent.load();

      showLoading(false);
      if (imaAdContainerEl) {
        imaAdContainerEl.style.display = 'block';
        imaAdContainerEl.style.zIndex = '20';
      }

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

// ==================== SKIP BUTTON FUNCTIONS ====================
// Handler untuk klik tombol skip
function handleSkipClick(event) {
  event.preventDefault();
  event.stopPropagation();
  console.log('🖱️ User menekan tombol skip iklan');
  doSkipAd();
}

function createSkipButton() {
  removeSkipButton();

  const btn = document.createElement('div');
  btn.id = 'customSkipBtn';
  btn.className = 'skip-btn skip-btn--waiting';
  btn.innerHTML = `
    <span class="skip-countdown-text">Iklan dapat diskip dalam <strong id="skipCountdownNum">5</strong> detik</span>
    <span class="skip-ready-text" style="display:none;">Lewati Iklan <span class="skip-arrow">&#9654;</span></span>
  `;

  document.body.appendChild(btn);
  skipButtonEl = btn;

  // ✅ FIX: Pasang event listener setelah elemen di DOM
  setTimeout(() => {
    const skipBtn = document.getElementById('customSkipBtn');
    if (skipBtn) {
      skipBtn.removeEventListener('click', handleSkipClick);
      skipBtn.addEventListener('click', handleSkipClick);
      console.log('✅ Event listener skip button terpasang');
    }
  }, 50);

  positionSkipButton();
  window.addEventListener('resize', positionSkipButton, { passive: true });

  console.log('Skip button dibuat dan dipasang ke body');
}

function positionSkipButton() {
  if (!skipButtonEl) return;
  const wrapper = document.getElementById('videoWrapper');
  if (!wrapper) return;

  const rect = wrapper.getBoundingClientRect();
  const scrollY = window.scrollY || window.pageYOffset;
  const scrollX = window.scrollX || window.pageXOffset;

  skipButtonEl.style.position = 'fixed';
  skipButtonEl.style.bottom = (window.innerHeight - rect.bottom) + 16 + 'px';
  skipButtonEl.style.right = (window.innerWidth - rect.right) + 16 + 'px';
  skipButtonEl.style.zIndex = '9999';
}

function doSkipAd() {
  console.log('doSkipAd() dipanggil');
  
  if (skipButtonEl) {
    skipButtonEl.style.pointerEvents = 'none';
    skipButtonEl.style.opacity = '0.5';
  }

  if (imaAdsManager) {
    try {
      console.log('Mencoba skip via IMA AdsManager...');
      imaAdsManager.skip();
      console.log('✅ IMA: skip() berhasil dipanggil');
      
      setTimeout(() => {
        removeSkipButton();
        if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';
      }, 1000);
      
    } catch (e) {
      console.warn('⚠️ IMA skip() gagal:', e);
      hideAdAndPlayContent();
    }
  } else {
    console.warn('⚠️ imaAdsManager tidak tersedia');
    hideAdAndPlayContent();
  }
}

function removeSkipButton() {
  console.log('removeSkipButton() dipanggil');
  
  if (skipCountdownInterval) {
    clearInterval(skipCountdownInterval);
    skipCountdownInterval = null;
  }
  
  window.removeEventListener('resize', positionSkipButton);

  if (skipButtonEl) {
    skipButtonEl.removeEventListener('click', handleSkipClick);
    skipButtonEl.remove();
    skipButtonEl = null;
  }
  
  const oldBtn = document.getElementById('customSkipBtn');
  if (oldBtn) {
    oldBtn.removeEventListener('click', handleSkipClick);
    oldBtn.remove();
  }
  
  console.log('Skip button dihapus');
}

function startSkipCountdown(skipOffset) {
  if (!skipButtonEl) return;

  let remaining = Math.ceil(skipOffset);
  const countdownNum = skipButtonEl.querySelector('#skipCountdownNum');
  if (countdownNum) countdownNum.textContent = remaining;

  if (remaining <= 0) {
    setSkipButtonReady();
    return;
  }

  skipCountdownInterval = setInterval(() => {
    remaining--;
    if (countdownNum) countdownNum.textContent = remaining;

    if (remaining <= 0) {
      clearInterval(skipCountdownInterval);
      skipCountdownInterval = null;
      setSkipButtonReady();
    }
  }, 1000);
}

function setSkipButtonReady() {
  if (!skipButtonEl) return;
  skipButtonEl.classList.remove('skip-btn--waiting');
  skipButtonEl.classList.add('skip-btn--ready');

  const countdownText = skipButtonEl.querySelector('.skip-countdown-text');
  const readyText = skipButtonEl.querySelector('.skip-ready-text');
  if (countdownText) countdownText.style.display = 'none';
  if (readyText) readyText.style.display = 'inline-flex';
  
  // ✅ FIX: Pastikan tombol bisa diklik saat ready
  skipButtonEl.style.pointerEvents = 'auto';
  skipButtonEl.style.cursor = 'pointer';
  
  console.log('Skip button: siap diskip ✅');
}

function hideAdAndPlayContent() {
  removeSkipButton();
  if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';
  if (imaVideoContent) {
    imaVideoContent.play().catch(e => console.info('Resume play diblokir:', e.message));
  }
}

// ==================== EVENT HANDLER IKLAN ====================
function onAdStarted(event) {
  console.log('IMA: Iklan mulai diputar ✅');
  showLoading(false);

  if (imaAdContainerEl) {
    imaAdContainerEl.style.display = 'block';
    imaAdContainerEl.style.zIndex = '20';
  }

  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';

  let skipOffset = 5;
  try {
    const ad = event.getAd();
    if (ad) {
      if (typeof ad.getSkipTimeOffset === 'function') {
        const offset = ad.getSkipTimeOffset();
        if (offset >= 0) {
          skipOffset = offset;
          console.log('Skip offset dari VAST:', skipOffset, 'detik');
        } else {
          console.log('VAST tidak menentukan skip offset, pakai default:', skipOffset, 'detik');
        }
      }
      if (typeof ad.getDuration === 'function') {
        const dur = ad.getDuration();
        if (dur > 0) adDurationSeconds = dur;
      }
    }
  } catch (e) {
    console.warn('Tidak bisa baca data iklan dari IMA, pakai default skip offset:', skipOffset);
  }

  createSkipButton();
  startSkipCountdown(skipOffset);
}

function onAdProgress(event) {}

function onAdComplete(event) {
  console.log('IMA: Iklan selesai diputar');
  removeSkipButton();
}

function onAdSkipped(event) {
  console.log('IMA: Iklan di-skip');
  removeSkipButton();
}

function onAdError(event) {
  const errMsg = event.getError ? event.getError().toString() : 'Unknown ad error';
  console.warn('IMA Ad error:', errMsg);

  removeSkipButton();

  if (imaAdsManager) {
    try { imaAdsManager.destroy(); } catch (e) {}
    imaAdsManager = null;
  }

  if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';
  showLoading(false);

  if (pendingVideoUrl) {
    const url = pendingVideoUrl;
    pendingVideoUrl = null;
    playVideoDirectly(url);
  }
}

function onContentPauseRequested() {
  console.log('IMA: Video dijeda untuk iklan');
  if (imaVideoContent) imaVideoContent.pause();

  showLoading(false);
  if (imaAdContainerEl) {
    imaAdContainerEl.style.display = 'block';
    imaAdContainerEl.style.zIndex = '20';
  }
}

function onContentResumeRequested() {
  console.log('IMA: Iklan selesai, melanjutkan video konten');

  removeSkipButton();

  if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';
  showLoading(false);

  if (imaVideoContent) {
    imaVideoContent.play().catch(e => console.info('Resume play diblokir:', e.message));
  }
}

function onAllAdsCompleted() {
  console.log('IMA: Semua iklan selesai');

  removeSkipButton();
  if (imaAdContainerEl) imaAdContainerEl.style.display = 'none';
  showLoading(false);
  pendingVideoUrl = null;
}

// ==================== PLAY VIDEO WITH ADS ====================
function playVideoWithAds(url) {
  if (!url) return;

  console.log('Memutar video dengan iklan VAST:', url);
  showLoading(true, 'Menyiapkan video...');

  const player = document.getElementById('videoPlayer');
  if (player) {
    player.style.display = 'block';
    player.pause();
    player.removeAttribute('src');
    player.load();
  }

  const imaAvailable = typeof google !== 'undefined' && google.ima && !window.imaLoadFailed;

  console.log('Status IMA SDK:', {
    imaAvailable,
    imaInitialized,
    imaLoadFailed: window.imaLoadFailed
  });

  if (imaAvailable) {
    if (!imaInitialized) {
      initImaSDK();
      if (imaInitialized) {
        requestAds(url);
      } else {
        console.warn('IMA gagal diinisialisasi, fallback ke direct play');
        playVideoDirectly(url);
      }
    } else {
      requestAds(url);
    }
  } else {
    console.log('IMA tidak tersedia, langsung putar video');
    playVideoDirectly(url);
  }
}

// ==================== FUNGSI UTAMA PLAY VIDEO ====================
function playVideo(url) {
  if (!url) {
    showErrorOverlay('URL video tidak tersedia.');
    return;
  }

  console.log('playVideo dipanggil:', url);
  resetPlayer();
  showLoading(true, 'Memuat video...');

  if (isEmbedUrl(url)) {
    playEmbedVideo(url);
  } else if (isHlsUrl(url)) {
    playHlsVideo(url);
  } else if (isCloudflareR2Url(url) || isDirectVideoUrl(url)) {
    playVideoWithAds(url);
  } else {
    console.warn('Tipe URL tidak dikenali, mencoba putar dengan iklan:', url);
    playVideoWithAds(url);
  }
}

// ==================== SETUP VIDEO PLAYER EVENTS ====================
function setupVideoPlayer() {
  const player = document.getElementById('videoPlayer');
  const overlay = document.getElementById('loadingOverlay');
  if (!player || !overlay) return;

  player.addEventListener('loadstart', () => {
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
    if (!imaAdsManager) showLoading(true, 'Buffering...');
  });

  player.addEventListener('error', (e) => {
    console.error('Video error:', e);
    showErrorOverlay('Gagal memuat video. Coba refresh halaman.');
  });

  player.addEventListener('stalled', () => {
    if (!imaAdsManager) showLoading(true, 'Koneksi lambat...');
  });
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
    } catch (e) {
      console.warn('Error resize IMA:', e);
    }
  }
}, { passive: true });

// ==================== SHARE FUNCTIONS ====================
window.openShareModal = function () {
  const modal = document.getElementById('shareModal');
  const linkInput = document.getElementById('shareLink');
  if (modal) {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  }
  if (linkInput) linkInput.value = window.location.href;
};

window.closeModal = function () {
  const modal = document.getElementById('shareModal');
  if (modal) {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  }
};

window.copyShareLink = function () {
  const input = document.getElementById('shareLink');
  if (!input) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(() => showToast()).catch(() => fallbackCopy(input));
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

window.shareVia = function (platform) {
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.getElementById('movieTitle')?.textContent || 'FilmKu');
  let shareUrl = '';

  if (platform === 'whatsapp') shareUrl = `https://wa.me/?text=${title}%20-%20${url}`;
  else if (platform === 'facebook') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
  else if (platform === 'telegram') shareUrl = `https://t.me/share/url?url=${url}&text=${title}`;

  if (shareUrl) {
    window.open(shareUrl, '_blank', 'noopener,width=600,height=400');
  }
};

window.addEventListener('click', (e) => {
  const modal = document.getElementById('shareModal');
  if (e.target === modal) window.closeModal();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.closeModal();
});

// ==================== DEBUG FUNCTION ====================
window.debugSkipButton = function() {
  const btn = document.getElementById('customSkipBtn');
  if (btn) {
    console.log('✅ Tombol skip ditemukan:', btn);
    console.log('- Class:', btn.className);
    console.log('- Style pointerEvents:', btn.style.pointerEvents);
    console.log('- Style display:', btn.style.display);
    console.log('- Event listeners:', getEventListeners ? getEventListeners(btn) : 'Tidak bisa dicek');
    
    btn.classList.add('debug-mode');
    setTimeout(() => btn.classList.remove('debug-mode'), 2000);
  } else {
    console.log('❌ Tombol skip TIDAK ditemukan');
  }
  return btn;
};

// ==================== INISIALISASI UTAMA ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM loaded - Memulai inisialisasi player v7.4');
  console.log('Movie ID:', movieId);

  if (!movieId) {
    console.log('Tidak ada movie ID, redirect ke index');
    window.location.replace('index.html');
    return;
  }

  setupVideoPlayer();

  if (!initSupabase()) {
    document.getElementById('episodesList').innerHTML = `
      <div class="error-episodes" role="alert">
        <i class="fas fa-exclamation-circle"></i> Gagal menghubungkan ke database.
      </div>`;
    return;
  }

  try {
    showLoading(true, 'Memuat data film...');

    const { data: movie, error } = await supabaseClient
      .from('movie_details')
      .select('id, title, category, description, year, thumbnail, video_url, episode_urls, episodes, views, rating, release_date, created_at, total_episodes')
      .eq('id', movieId)
      .single();

    if (error) throw error;
    if (!movie) throw new Error('Film tidak ditemukan.');

    console.log('Data film berhasil dimuat:', movie.title);
    currentMovie = movie;

    const episodes = await loadEpisodes(movieId, movie);
    currentEpisodes = episodes;

    displayMovie(movie, episodes);
    incrementViews(movie.id, movie.views || 0);
    loadRecommendations(movie.category);

    setTimeout(() => {
      if (!window.imaLoadFailed && typeof google !== 'undefined' && google.ima) {
        if (!imaInitialized) {
          console.log('Pre-inisialisasi IMA SDK di background...');
          try {
            imaVideoContent = document.getElementById('videoPlayer');
            imaAdContainerEl = document.getElementById('adContainer');

            if (imaVideoContent && imaAdContainerEl) {
              imaAdDisplayContainer = new google.ima.AdDisplayContainer(imaAdContainerEl, imaVideoContent);
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
              console.log('IMA SDK pre-inisialisasi berhasil');
            }
          } catch (e) {
            console.warn('Gagal pre-inisialisasi IMA:', e);
          }
        }
      } else {
        console.log('IMA SDK tidak tersedia atau gagal dimuat');
      }
    }, 500);

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