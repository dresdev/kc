/**
 * VIDEO PLAYER LOGIC - NO EDITAR A MENOS QUE MODIFIQUES LA FUNCIONALIDAD
 *
 * Este archivo contiene toda la lógica del reproductor de video.
 * Los datos de configuración de la serie están en serie-data.js
 *
 * Para cambiar información de una serie (títulos, URLs, etc.):
 * - Edita serie-data.js
 *
 * Para modificar la funcionalidad del reproductor:
 * - Edita este archivo (player.js)
 */

// Dynamic HLS.js loader
let hlsLoaded = false;
let hlsLoadPromise = null;

function loadHLS() {
  if (hlsLoadPromise) {
    return hlsLoadPromise;
  }

  hlsLoadPromise = new Promise((resolve, reject) => {
    if (window.Hls) {
      hlsLoaded = true;
      resolve(window.Hls);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.onload = () => {
      hlsLoaded = true;
      resolve(window.Hls);
    };
    script.onerror = () => {
      reject(new Error("Failed to load HLS.js"));
    };
    document.head.appendChild(script);
  });

  return hlsLoadPromise;
}

// LocalStorage Management
class SerieStorage {
  static getWatchedData(serieId = window.SERIE_ID) {
    const data = localStorage.getItem(`serie_${serieId}`);
    const result = data
      ? JSON.parse(data)
      : {
          currentSeason: 1,
          currentEpisode: 1,
          watchedEpisodes: {},
          lastWatched: null,
        };
    return result;
  }

  static saveWatchedData(data, serieId = window.SERIE_ID) {
    try {
      localStorage.setItem(`serie_${serieId}`, JSON.stringify(data));
    } catch (error) {
      console.error("Error al guardar en localStorage:", error);
    }
  }

  static updateEpisodeProgress(
    season,
    episode,
    currentTime,
    duration,
    serieId = window.SERIE_ID
  ) {
    const data = this.getWatchedData(serieId);
    const episodeKey = `s${season}e${episode}`;

    data.watchedEpisodes[episodeKey] = {
      currentTime: currentTime,
      duration: duration,
      progress: (currentTime / duration) * 100,
      completed: currentTime / duration > 0.9,
      lastWatched: Date.now(),
    };

    data.currentSeason = season;
    data.currentEpisode = episode;
    data.lastWatched = Date.now();

    this.saveWatchedData(data, serieId);

    // Update Continue Watching list with current progress (only if serie data is available)
    if (window.SERIE_DATA && serieId === window.SERIE_DATA.id) {
      const episodeData = window.SERIE_DATA.episodesData[season]?.[episode - 1];
      if (episodeData) {
        const continueWatchingInfo = {
          serieId: serieId,
          serieTitle: window.SERIE_DATA.title,
          seriePoster: window.SERIE_DATA.poster,
          serieHeroImage: window.SERIE_DATA.heroImage,
          season: season,
          episode: episode,
          episodeTitle: episodeData.title,
          episodeThumbnail: episodeData.thumbnail,
          episodeDuration: episodeData.duration,
          currentTime: currentTime,
          progress: (currentTime / duration) * 100,
          lastWatched: Date.now(),
        };

        this.updateContinueWatching(serieId, continueWatchingInfo);
      }
    }
  }

  static getEpisodeProgress(season, episode, serieId = window.SERIE_ID) {
    const data = this.getWatchedData(serieId);
    const episodeKey = `s${season}e${episode}`;
    return data.watchedEpisodes[episodeKey] || { currentTime: 0, progress: 0 };
  }

  static hasAnyEpisodeWatched(serieId = window.SERIE_ID) {
    const data = this.getWatchedData(serieId);
    return Object.keys(data.watchedEpisodes || {}).length > 0;
  }

  static getLastWatchedEpisode(serieId = window.SERIE_ID) {
    const data = this.getWatchedData(serieId);
    if (!data.lastWatched || !data.currentSeason || !data.currentEpisode) {
      return null;
    }
    return {
      season: data.currentSeason,
      episode: data.currentEpisode,
      lastWatched: data.lastWatched,
    };
  }

  // Continue Watching Management
  static getContinueWatchingList() {
    const data = localStorage.getItem("continueWatching");
    return data ? JSON.parse(data) : [];
  }

  static saveContinueWatchingList(list) {
    try {
      localStorage.setItem("continueWatching", JSON.stringify(list));
    } catch (error) {
      console.error("Error al guardar lista de continuar viendo:", error);
    }
  }

  static updateContinueWatching(serieId, episodeInfo) {
    let continueList = this.getContinueWatchingList();

    // Remove existing entry for this series if it exists
    continueList = continueList.filter((item) => item.serieId !== serieId);

    // Add new entry at the beginning (most recent first)
    continueList.unshift(episodeInfo);

    // Keep only the last 20 entries to avoid localStorage bloat
    if (continueList.length > 20) {
      continueList = continueList.slice(0, 20);
    }

    this.saveContinueWatchingList(continueList);
  }

  static removeContinueWatching(serieId) {
    let continueList = this.getContinueWatchingList();
    continueList = continueList.filter((item) => item.serieId !== serieId);
    this.saveContinueWatchingList(continueList);
  }

  // Language preference management
  static getLanguagePreference(serieId = window.SERIE_ID) {
    try {
      const preference = localStorage.getItem(`kc-language-${serieId}`);
      return preference || "sub"; // Default to "sub" if no preference
    } catch (error) {
      console.error("Error loading language preference:", error);
      return "sub";
    }
  }

  static saveLanguagePreference(language, serieId = window.SERIE_ID) {
    try {
      localStorage.setItem(`kc-language-${serieId}`, language);
    } catch (error) {
      console.error("Error saving language preference:", error);
    }
  }

  static selectBestLanguage(availableLanguages, serieId = window.SERIE_ID) {
    const preferredLanguage = this.getLanguagePreference(serieId);

    // If preferred language is available, use it
    if (availableLanguages[preferredLanguage]) {
      return {
        language: preferredLanguage,
        isPreferred: true,
        fallbackUsed: false,
      };
    }

    // If preferred language is not available, try fallback order
    const fallbackOrder = ["sub", "lat", "esp", "eng"];

    for (const language of fallbackOrder) {
      if (availableLanguages[language]) {
        return {
          language: language,
          isPreferred: false,
          fallbackUsed: true,
          preferredLanguage: preferredLanguage,
        };
      }
    }

    // If none of the fallbacks are available, use the first available language
    const firstAvailable = Object.keys(availableLanguages)[0];
    return {
      language: firstAvailable,
      isPreferred: false,
      fallbackUsed: true,
      preferredLanguage: preferredLanguage,
    };
  }

  // Helper function for backward compatibility - returns just the language string
  static getBestLanguage(availableLanguages, serieId = window.SERIE_ID) {
    return this.selectBestLanguage(availableLanguages, serieId).language;
  }
}

// Global Variables
// Global Variables
// Serie Page Elements
const playFirstEpisode = document.getElementById("playFirstEpisode");
const playButtonText = document.getElementById("playButtonText");
const seasonSelectorBtn = document.getElementById("seasonSelectorBtn");
const currentSeasonLabel = document.getElementById("currentSeasonLabel");
const episodesGrid = document.getElementById("episodesGrid");
const playerModal = document.getElementById("playerModal");
const serieSeasonModal = document.getElementById("serieSeasonModal");
const serieSeasonList = document.getElementById("serieSeasonList");
const serieSeasonCloseBtn = document.getElementById("serieSeasonCloseBtn");

// Player Elements
const video = document.getElementById("video");

// Configuración inicial del video para evitar auto-reproducción en loop
video.loop = false;
video.preload = "metadata";

// Override agresivo de métodos del video para prevenir auto-reproducción después de completado
const originalPlay = video.play.bind(video);
video.play = function () {
  if (window.isVideoCompleted && video.currentTime >= video.duration - 0.5) {
    return Promise.resolve();
  }
  return originalPlay();
};

// Variable global para estado de video completado (se referencia en el override)
window.isVideoCompleted = false;

const controls = document.getElementById("controls");
const playPauseBtn = document.getElementById("playPauseBtn");
const rewindBtn = document.getElementById("rewindBtn");
const forwardBtn = document.getElementById("forwardBtn");
const progressBar = document.getElementById("progressBar");
const progress = document.getElementById("progress");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const playIcon = document.getElementById("playIcon");
const pauseIcon = document.getElementById("pauseIcon");
const backBtn = document.getElementById("backBtn");
const castBtn = document.getElementById("castBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const fullscreenIcon = document.getElementById("fullscreenIcon");
const loadingScreen = document.getElementById("loadingScreen");
const episodesBtn = document.getElementById("episodesBtn");
const languageBtn = document.getElementById("languageBtn");
const nextEpisodeBtn = document.getElementById("nextEpisodeBtn");
const languageOverlay = document.getElementById("languageOverlay");
const languageCancel = document.getElementById("languageCancel");
const episodeTitle = document.getElementById("episodeTitle");
const languageAccept = document.getElementById("languageAccept");
const episodesOverlay = document.getElementById("episodesOverlay");
const episodesBackBtn = document.getElementById("episodesBackBtn");
const seasonSelector = document.getElementById("seasonSelector");
const currentSeasonText = document.getElementById("currentSeasonText");
const episodesScroll = document.getElementById("episodesScroll");
const seasonOverlay = document.getElementById("seasonOverlay");
const seasonList = document.getElementById("seasonList");
const seasonCloseBtn = document.getElementById("seasonCloseBtn");
let selectedLanguage = "sub"; // Idioma por defecto
let currentLanguage = "sub"; // Idioma actual
let currentTime = 0; // Tiempo actual del video
let controlsTimeout;
let controlsVisible = true;
let isVideoReady = false;
let hasUserInteracted = false;
let isLanguageOverlayOpen = false; // Nueva variable para controlar el estado del overlay
let isEpisodesOverlayOpen = false; // Control del overlay de episodios
let isSeasonOverlayOpen = false; // Control del overlay de temporadas
let hls; // HLS.js instance

// Serie configuration
let currentSerie = window.SERIE_DATA;
let currentSeason = 1;
let currentEpisode = 1;

// Initialize serie page
function initializeSeriePage() {
  // Initialize language preference from localStorage
  selectedLanguage = SerieStorage.getLanguagePreference();
  currentLanguage = selectedLanguage;

  populateHeroSection();
  loadSerieProgress();
  updatePlayButton();
  updateSeasonLabel();
  generateEpisodesGrid();
  setVideoPoster();

  // Check if there are any watched episodes and auto-open player
  checkAndAutoOpenPlayer();
}

function checkAndAutoOpenPlayer() {
  // Only auto-open if there are episodes that have been watched
  if (SerieStorage.hasAnyEpisodeWatched()) {
    const lastWatched = SerieStorage.getLastWatchedEpisode();
    if (lastWatched) {
      // Set current episode to the last watched
      currentSeason = lastWatched.season;
      currentEpisode = lastWatched.episode;

      // Auto-open the player with the last watched episode
      setTimeout(() => {
        playEpisode(currentSeason, currentEpisode, false); // false = not a user action
      }, 100); // Small delay to ensure DOM is ready
    }
  }
}

function populateHeroSection() {
  // Apply dynamic hero background image with opacity overlay
  const heroSection = document.querySelector(".hero-section");
  if (heroSection && window.SERIE_DATA.heroImage) {
    // Apply background image directly to hero section
    heroSection.style.backgroundImage = `url('${window.SERIE_DATA.heroImage}')`;
    heroSection.style.backgroundSize = "cover";
    heroSection.style.backgroundPosition = "center center";
    heroSection.style.position = "relative";

    // Create opacity overlay using pseudo-element
    const styleId = "hero-opacity-style";
    let existingStyle = document.getElementById(styleId);

    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .hero-section::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.2);
        z-index: 1;
        pointer-events: none;
        width:100%;
        height: 100%;
      }
      .hero-section .hero-content {
        position: relative;
        z-index: 2;
      }
    `;
    document.head.appendChild(style);
  }

  // Populate title
  const serieTitle = document.getElementById("serieTitle");
  if (serieTitle) {
    serieTitle.textContent = window.SERIE_DATA.title;
  }

  // Populate meta information
  const serieMeta = document.getElementById("serieMeta");
  if (serieMeta) {
    serieMeta.innerHTML = `
      <span class="meta-item">${window.SERIE_DATA.year}</span>
      <span class="meta-item">•</span>
      <span class="meta-item">${window.SERIE_DATA.seasons} Temporada${
      window.SERIE_DATA.seasons > 1 ? "s" : ""
    }</span>
      <span class="meta-item">•</span>
      <span class="meta-item">${window.SERIE_DATA.rating}</span>
    `;
  }

  // Populate categories
  const serieCategories = document.getElementById("serieCategories");
  if (serieCategories) {
    serieCategories.innerHTML = window.SERIE_DATA.categories
      .map((category) => `<span class="category-tag">${category}</span>`)
      .join("");
  }

  // Update add to list button data attributes
  const addToListBtn = document.getElementById("addToListBtn");
  if (addToListBtn) {
    addToListBtn.setAttribute("data-serie-id", window.SERIE_DATA.id);
    addToListBtn.setAttribute("data-title", window.SERIE_DATA.title);
    addToListBtn.setAttribute("data-poster", window.SERIE_DATA.poster);
    addToListBtn.setAttribute("data-hero-image", window.SERIE_DATA.heroImage);
    addToListBtn.setAttribute("data-languages", window.SERIE_DATA.languages);
  }
}

function setVideoPoster() {
  const video = document.getElementById("video");
  if (video && currentSeason && currentEpisode) {
    const episodeData =
      window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1];
    if (episodeData?.thumbnail) {
      video.poster = episodeData.thumbnail;
    }
  }
}

function updateSeasonLabel() {
  currentSeasonLabel.textContent = `Temporada ${currentSeason}`;
}

function formatDuration(durationStr) {
  // Convierte "47 min" a formato "Xh Xm" si es más de 60 min
  const match = durationStr.match(/(\d+)\s*min/);
  if (match) {
    const totalMinutes = parseInt(match[1]);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${totalMinutes}m`;
  }
  return durationStr;
}

function updatePlayButton() {
  const data = SerieStorage.getWatchedData();

  // Si no hay datos de visualización, mostrar T1E1
  if (!data.lastWatched || Object.keys(data.watchedEpisodes).length === 0) {
    playButtonText.textContent = "REPRODUCIR T1E1";
    return;
  }

  // Buscar el último episodio con progreso significativo
  let lastWatchedSeason = data.currentSeason || 1;
  let lastWatchedEpisode = data.currentEpisode || 1;
  let hasSignificantProgress = false;

  // Verificar si el episodio actual tiene progreso significativo (más del 10% pero menos del 90%)
  const currentEpisodeKey = `s${lastWatchedSeason}e${lastWatchedEpisode}`;
  const currentEpisodeProgress = data.watchedEpisodes[currentEpisodeKey];

  if (
    currentEpisodeProgress &&
    currentEpisodeProgress.progress > 10 &&
    currentEpisodeProgress.progress < 90
  ) {
    hasSignificantProgress = true;
  }

  // Si el episodio actual está completado, buscar el siguiente episodio disponible
  if (currentEpisodeProgress && currentEpisodeProgress.progress >= 90) {
    // Buscar siguiente episodio en la misma temporada
    const currentSeasonEpisodes =
      window.SERIE_DATA.episodesData[lastWatchedSeason];
    if (
      currentSeasonEpisodes &&
      lastWatchedEpisode < currentSeasonEpisodes.length
    ) {
      lastWatchedEpisode++;
      hasSignificantProgress = false; // Es un nuevo episodio
    } else {
      // Buscar siguiente temporada
      const nextSeason = lastWatchedSeason + 1;
      if (window.SERIE_DATA.episodesData[nextSeason]) {
        lastWatchedSeason = nextSeason;
        lastWatchedEpisode = 1;
        hasSignificantProgress = false; // Es un nuevo episodio
      }
    }
  }

  // Actualizar el texto del botón
  let buttonText;
  if (hasSignificantProgress) {
    buttonText = `CONTINUAR T${lastWatchedSeason}E${lastWatchedEpisode}`;
  } else {
    buttonText = `REPRODUCIR T${lastWatchedSeason}E${lastWatchedEpisode}`;
  }

  playButtonText.textContent = buttonText;

  // Actualizar las variables globales para que el botón reproduzca el episodio correcto
  currentSeason = lastWatchedSeason;
  currentEpisode = lastWatchedEpisode;
}

function generateEpisodesGrid() {
  const episodes = window.SERIE_DATA.episodesData[currentSeason] || [];
  episodesGrid.innerHTML = "";

  episodes.forEach((episode, index) => {
    const episodeCard = document.createElement("div");
    episodeCard.className = "serie-episode-card";

    // Obtener progreso actualizado del localStorage
    const progress = SerieStorage.getEpisodeProgress(currentSeason, index + 1);
    const progressPercent = progress
      ? Math.max(0, Math.min(100, progress.progress))
      : 0;
    const isWatched = progressPercent > 90;

    episodeCard.innerHTML = `
          <div class="serie-episode-thumbnail" style="background-image: url('${
            episode.thumbnail
          }')">
            ${
              isWatched
                ? '<div class="watched-indicator"><span class="material-symbols-outlined">check_circle</span></div>'
                : ""
            }
            <span class="material-symbols-outlined play-icon">play_circle</span>
            <div class="serie-episode-progress-bar">
              <div class="serie-episode-progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          </div>
          <div class="serie-episode-info">
            <h3 class="serie-episode-title">${episode.number}. ${
      episode.title
    }</h3>
            <div class="serie-episode-duration">${formatDuration(
              episode.duration
            )}</div>
          </div>
        `;

    episodeCard.addEventListener("click", () => {
      currentEpisode = index + 1;
      playEpisode(currentSeason, currentEpisode);
      updateNextEpisodeButton();
    });

    episodesGrid.appendChild(episodeCard);
  });
}

function loadSerieProgress() {
  const data = SerieStorage.getWatchedData();
  if (data.currentSeason && data.currentEpisode) {
    // Solo actualizar currentSeason/currentEpisode si no se han establecido por updatePlayButton
    if (currentSeason === 1 && currentEpisode === 1) {
      currentSeason = data.currentSeason;
      currentEpisode = data.currentEpisode;
    }
    updateSeasonLabel();
    generateEpisodesGrid();
  }
}

// Serie Season Modal Functions
function showSerieSeasonModal() {
  serieSeasonModal.classList.add("show");
  renderSerieSeasons();
}

function hideSerieSeasonModal() {
  serieSeasonModal.classList.remove("show");
}

function renderSerieSeasons() {
  serieSeasonList.innerHTML = "";

  Object.keys(window.SERIE_DATA.seasonsData).forEach((seasonNum) => {
    const season = window.SERIE_DATA.seasonsData[seasonNum];
    const seasonOption = document.createElement("button");
    seasonOption.className = `serie-season-option ${
      currentSeason == seasonNum ? "active" : ""
    }`;
    seasonOption.textContent = season.name;

    seasonOption.addEventListener("click", () => {
      currentSeason = parseInt(seasonNum);
      updateSeasonLabel();
      generateEpisodesGrid();
      hideSerieSeasonModal();
    });

    serieSeasonList.appendChild(seasonOption);
  });
}

function playEpisode(season, episode, isUserAction = true) {
  currentSeason = season;
  currentEpisode = episode;

  const episodeData = window.SERIE_DATA.episodesData[season][episode - 1];

  // Use the best available language based on user preference
  const languageSelection = SerieStorage.selectBestLanguage(
    episodeData.languages
  );
  selectedLanguage = languageSelection.language;
  currentLanguage = languageSelection.language;

  // Show notification if fallback language is used
  if (languageSelection.fallbackUsed && isUserAction) {
    console.log(
      `Idioma preferido "${languageSelection.preferredLanguage}" no disponible. Usando "${languageSelection.language}" como alternativa.`
    );
  }

  const videoUrl = episodeData.languages[selectedLanguage].videoUrl;

  // Update episode title in player
  episodeTitle.textContent = `T${season}:E${episode} - ${episodeData.title}`;

  // Set video poster to episode thumbnail
  video.poster = episodeData.thumbnail;

  // Update cast button based on current episode and language
  updateCastButton();

  // Update language button visibility based on available languages
  updateLanguageButton();

  // Show loading screen when changing episodes
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hide");

  // Reset video ready state
  isVideoReady = false;

  // Open player modal and disable body scroll
  playerModal.style.display = "block";
  playerModal.classList.add("active");
  document.body.classList.add("player-active");

  // Asegurar que el body tenga overflow hidden
  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";

  // Hide controls initially while loading
  hideControls();

  // Configurar propiedades del video para evitar loop
  video.loop = false;
  video.autoplay = true; // Mantener autoplay pero sin loop

  // Remover cualquier evento anterior que pueda estar causando auto-replay
  video.removeAttribute("loop");

  // Load video with dynamic HLS loading
  loadHLS()
    .then((Hls) => {
      // Check if the video URL is HLS (.m3u8) or regular video (.mp4, .webm, etc.)
      const isHLSVideo =
        videoUrl.includes(".m3u8") || videoUrl.includes("m3u8");

      if (isHLSVideo && Hls.isSupported()) {
        // Use HLS.js for streaming videos (.m3u8)
        if (hls) {
          hls.destroy();
        }
        hls = new Hls({
          // Configuración específica para evitar auto-replay
          autoStartLoad: true,
          startPosition: -1,
          capLevelToPlayerSize: false,
          debug: false,
          // Configuraciones adicionales para prevenir loop automático
          liveDurationInfinity: false,
          backBufferLength: 30, // Limitar buffer trasero
          maxBufferLength: 30, // Limitar buffer adelante
          maxMaxBufferLength: 60, // Límite máximo absoluto
          enableWorker: true,
          // Configuración para VoD (Video on Demand) - no streaming en vivo
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
        });
        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        // Reset estado de video completado al cargar nuevo video
        setVideoCompletedState(false);

        // Configuraciones adicionales del elemento video para prevenir loop
        video.loop = false;
        video.removeAttribute("loop");
        video.removeAttribute("autoplay"); // Extra seguridad

        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          isVideoReady = true;
          restoreVideoControls();

          // Asegurar que no hay loop configurado
          video.loop = false;
          video.removeAttribute("loop");
          video.removeAttribute("autoplay");

          // Restore progress if exists
          const progress = SerieStorage.getEpisodeProgress(season, episode);
          if (progress && progress.currentTime > 30) {
            // Resume if more than 30 seconds
            video.currentTime = progress.currentTime;
          }

          video.play();
          hasUserInteracted = true;
          showControls();

          // Actualizar el botón de siguiente episodio
          updateNextEpisodeButton();
        });

        hls.on(Hls.Events.ERROR, function (event, data) {
          console.error("HLS Error:", data);
          // Solo mostrar error para errores fatales o de red persistentes
          if (
            data.fatal ||
            (data.type === Hls.ErrorTypes.NETWORK_ERROR &&
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR)
          ) {
            // Permitir retry para errores de red
            const allowRetry = data.type === Hls.ErrorTypes.NETWORK_ERROR;
            showVideoError("Error al cargar el video", allowRetry);
          }
        });
      } else if (
        isHLSVideo &&
        video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Safari native HLS support for .m3u8 files
        video.src = videoUrl;
        video.addEventListener("loadedmetadata", () => {
          isVideoReady = true;
          restoreVideoControls();

          const progress = SerieStorage.getEpisodeProgress(season, episode);
          if (progress && progress.currentTime > 30) {
            video.currentTime = progress.currentTime;
          }

          video.play();
          hasUserInteracted = true;
          showControls();
        });
      } else {
        // Native browser support for regular video files (.mp4, .webm, .ogg, etc.)
        video.src = videoUrl;

        // Reset estado de video completado al cargar nuevo video
        setVideoCompletedState(false);

        // Configuraciones para prevenir loop
        video.loop = false;
        video.removeAttribute("loop");
        video.removeAttribute("autoplay");

        video.addEventListener("loadedmetadata", () => {
          isVideoReady = true;
          restoreVideoControls();

          // Restore progress if exists
          const progress = SerieStorage.getEpisodeProgress(season, episode);
          if (progress && progress.currentTime > 30) {
            video.currentTime = progress.currentTime;
          }

          video.play();
          hasUserInteracted = true;
          showControls();

          // Actualizar el botón de siguiente episodio
          updateNextEpisodeButton();
        });

        video.addEventListener("error", (e) => {
          console.error("Video Error:", e);
          showVideoError("Error al cargar el video");
        });
      }
    })
    .catch((error) => {
      console.error("Failed to load HLS:", error);
      showVideoError("Error al cargar el reproductor", false); // No retry para errores del reproductor
    });

  // Actualizar el botón de siguiente episodio
  updateNextEpisodeButton();

  // Execute navigation command only for user actions (not auto-opening)
  if (isUserAction) {
    // Update localStorage to mark this episode as the most recent before redirecting
    // This ensures that when the page reloads, this episode will be the one auto-opened
    const data = SerieStorage.getWatchedData();
    data.currentSeason = season;
    data.currentEpisode = episode;
    data.lastWatched = Date.now();

    // If episode doesn't exist in watchedEpisodes, create minimal entry
    const episodeKey = `s${season}e${episode}`;
    if (!data.watchedEpisodes[episodeKey]) {
      data.watchedEpisodes[episodeKey] = {
        currentTime: 0,
        duration: 0,
        progress: 0,
        completed: false,
        lastWatched: Date.now(),
      };
    } else {
      // Update lastWatched timestamp for existing episode
      data.watchedEpisodes[episodeKey].lastWatched = Date.now();
    }

    SerieStorage.saveWatchedData(data);

    // Update Continue Watching list with detailed episode information
    const continueWatchingInfo = {
      serieId: window.SERIE_ID,
      serieTitle: window.SERIE_DATA.title,
      seriePoster: window.SERIE_DATA.poster,
      serieBackgroundImage: window.SERIE_DATA.heroImage,
      season: season,
      episode: episode,
      episodeTitle: episodeData.title,
      episodeThumbnail: episodeData.thumbnail,
      episodeDuration: episodeData.duration,
      currentTime: data.watchedEpisodes[episodeKey].currentTime || 0,
      progress: data.watchedEpisodes[episodeKey].progress || 0,
      lastWatched: Date.now(),
    };

    SerieStorage.updateContinueWatching(window.SERIE_ID, continueWatchingInfo);

    // Now redirect
    window.location.href = `go:${window.SERIE_ID}`;
  }
}

// Ocultar loader y mostrar controles cuando el video esté listo
function hideLoader() {
  loadingScreen.classList.add("hide");
  loadingScreen.style.display = "none";
  isVideoReady = true;

  // Limpiar completamente cualquier estado de error cuando el video carga exitosamente
  restoreVideoControls();

  // Mostrar controles permanentemente hasta la primera interacción
  showControls(false); // false = no auto-hide
  // Intentar reproducir automáticamente
  video.play().catch((err) => {
    // Autoplay was prevented
  });
}

// Eventos para detectar cuando el video está listo
video.addEventListener("canplay", hideLoader);
video.addEventListener("loadeddata", () => {
  // Asegurar que se oculte el loader si ya tiene datos suficientes
  if (video.readyState >= 2) {
    hideLoader();
  }
});

// Eventos adicionales para detectar recuperación de errores
video.addEventListener("loadedmetadata", () => {
  // Si hay metadata, el video ha cargado exitosamente - limpiar errores
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && video.duration > 0) {
    restoreVideoControls();
  }
});

video.addEventListener("canplaythrough", () => {
  // El video puede reproducirse completamente - limpiar cualquier error
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay) {
    restoreVideoControls();
  }
});

// Verificación periódica para limpiar errores cuando el video se vuelve reproducible
setInterval(() => {
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && errorOverlay.style.display === "flex") {
    // Si hay un overlay de error pero el video es reproducible, limpiarlo
    if (video.readyState >= 3 && video.duration > 0) {
      console.log("Video recuperado, limpiando overlay de error");
      restoreVideoControls();
    }
  }
}, 2000); // Verificar cada 2 segundos

// Controles de visibilidad
function showControls(autoHide = true) {
  // No mostrar controles si el video aún no está listo
  if (!isVideoReady) return;

  controls.classList.remove("hide");
  controlsVisible = true;
  clearTimeout(controlsTimeout);

  // Solo auto-hide si el usuario ya ha interactuado al menos una vez
  // Y si ningún overlay está abierto
  if (
    autoHide &&
    hasUserInteracted &&
    !isLanguageOverlayOpen &&
    !isEpisodesOverlayOpen &&
    !isSeasonOverlayOpen
  ) {
    controlsTimeout = setTimeout(() => {
      controls.classList.add("hide");
      controlsVisible = false;
    }, 3000);
  }
}

function hideControls() {
  controls.classList.add("hide");
  controlsVisible = false;
  clearTimeout(controlsTimeout);
}

// Función para marcar que el usuario ha interactuado
function markUserInteraction() {
  hasUserInteracted = true;
}

// Funciones para manejar navegación de episodios
function getNextEpisodeInfo() {
  const currentSeasonData = window.SERIE_DATA.seasonsData[currentSeason];
  const totalSeasons = window.SERIE_DATA.seasons;

  // Si hay más episodios en la temporada actual
  if (currentEpisode < currentSeasonData.episodes) {
    return {
      season: currentSeason,
      episode: currentEpisode + 1,
      isNewSeason: false,
    };
  }

  // Si hay más temporadas disponibles
  if (currentSeason < totalSeasons) {
    return {
      season: currentSeason + 1,
      episode: 1,
      isNewSeason: true,
    };
  }

  // No hay más episodios
  return null;
}

function updateNextEpisodeButton() {
  const nextInfo = getNextEpisodeInfo();
  const nextBtnText = nextEpisodeBtn.querySelector(".bottom-btn-text");

  if (!nextInfo) {
    // Es el último episodio de la última temporada - ocultar botón
    nextEpisodeBtn.style.display = "none";
    return;
  }

  // Mostrar botón si estaba oculto
  nextEpisodeBtn.style.display = "flex";

  if (nextInfo.isNewSeason) {
    // Próxima temporada
    nextBtnText.textContent = `Temporada ${nextInfo.season}`;
  } else {
    // Próximo episodio
    nextBtnText.textContent = "Siguiente";
  }
}

function updateCastButton() {
  if (!castBtn) return;

  // Obtener datos del episodio actual
  const episodeData =
    window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1];

  if (!episodeData) {
    castBtn.style.display = "none";
    return;
  }

  // Verificar si el idioma actual tiene configurado un enlace de cast
  const currentLanguageData = episodeData.languages[currentLanguage];

  if (currentLanguageData && currentLanguageData.cast) {
    // Mostrar botón y configurar enlace
    castBtn.style.display = "flex";
    castBtn.href = currentLanguageData.cast;
  } else {
    // Ocultar botón si no hay enlace de cast
    castBtn.style.display = "none";
  }
}

function updateLanguageButton() {
  if (!languageBtn) return;

  // Obtener datos del episodio actual
  const episodeData =
    window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1];

  if (!episodeData) {
    languageBtn.style.display = "none";
    return;
  }

  // Verificar cuántos idiomas están disponibles
  const availableLanguages = Object.keys(episodeData.languages);

  if (availableLanguages.length >= 1) {
    // Mostrar botón siempre que haya al menos un idioma
    languageBtn.style.display = "flex";
  } else {
    // Ocultar botón solo si no hay idiomas disponibles
    languageBtn.style.display = "none";
  }
}

function showVideoError(
  errorMessage = "Error al cargar el video",
  allowRetry = true
) {
  // Asegurar que el reproductor esté abierto y visible
  playerModal.style.display = "block";
  playerModal.classList.add("active");
  document.body.classList.add("player-active");
  document.body.style.overflow = "hidden";
  document.body.style.height = "100vh";

  // Ocultar el loading screen completamente
  loadingScreen.style.display = "none";
  loadingScreen.classList.add("hide");

  // Crear overlay de error solo sobre el área del video
  let errorOverlay = document.getElementById("videoErrorOverlay");
  if (!errorOverlay) {
    errorOverlay = document.createElement("div");
    errorOverlay.id = "videoErrorOverlay";
    errorOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
      color: white;
      font-size: 18px;
      text-align: center;
      pointer-events: none;
    `;

    // Insertar el overlay dentro del contenedor del video
    const videoContainer = document.querySelector("#video").parentElement;
    videoContainer.style.position = "relative";
    videoContainer.appendChild(errorOverlay);
  }

  errorOverlay.innerHTML = `<div style="text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0px 0px 8px rgba(0, 0, 0, 0.6);">${errorMessage}</div>`;
  errorOverlay.style.display = "flex";

  // Agregar opacidad al video para que el poster se vea opaco
  video.style.opacity = "0.3";

  // Permitir mostrar controles pero ocultar botones de reproducción
  isVideoReady = true;

  // Ocultar botones de control principal (play, adelantar, atrasar)
  const mainControls = document.querySelector(".main-controls");
  if (mainControls) {
    mainControls.style.display = "none";
  }

  // Asegurar que los controles estén por encima del overlay de error
  const controlsElement = document.getElementById("controls");
  if (controlsElement) {
    controlsElement.style.zIndex = "15";
  }

  // Mostrar controles sin auto-hide y mantenerlos siempre visibles
  showControls(false);

  // Evitar que se oculten automáticamente
  clearTimeout(controlsTimeout);

  // Actualizar botones según episodio actual
  updateNextEpisodeButton();
  updateLanguageButton();

  // Retry automático después de 5 segundos para errores temporales
  if (allowRetry) {
    setTimeout(() => {
      const currentErrorOverlay = document.getElementById("videoErrorOverlay");
      if (currentErrorOverlay && currentErrorOverlay.style.display === "flex") {
        // Intentar cargar el video nuevamente
        console.log("Intentando recuperar video automáticamente...");
        playEpisode(currentSeason, currentEpisode, false);
      }
    }, 5000);
  }
}

function restoreVideoControls() {
  // Restaurar botones de control principal
  const mainControls = document.querySelector(".main-controls");
  if (mainControls) {
    mainControls.style.display = "flex";
  }

  // Restaurar z-index normal de los controles
  const controlsElement = document.getElementById("controls");
  if (controlsElement) {
    controlsElement.style.zIndex = "";
  }

  // Restaurar opacidad normal del video
  video.style.opacity = "1";

  // Ocultar loading screen
  loadingScreen.style.display = "none";
  loadingScreen.classList.add("hide");

  // Ocultar y eliminar overlay de error si existe
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay) {
    errorOverlay.style.display = "none";
    // Eliminar completamente el overlay para evitar problemas de estado
    errorOverlay.remove();
  }

  // Marcar que el video está listo después de limpiar errores
  isVideoReady = true;
}

// Tap para mostrar/ocultar controles
function onPlayerTap(e) {
  e.preventDefault();
  e.stopPropagation();

  // No hacer nada si el video aún no está listo
  if (!isVideoReady) return;

  // No hacer nada si se toca un botón de control o la barra de progreso
  if (
    e.target.closest(".control-btn") ||
    e.target.closest(".header-btn") ||
    e.target.closest(".progress-container") ||
    e.target.closest(".progress-bar") ||
    e.target.closest(".progress-thumb") ||
    e.target.closest(".bottom-btn")
  ) {
    return;
  }

  // Marcar interacción del usuario
  markUserInteraction();

  // Intentar entrar en pantalla completa en el primer toque
  attemptFullscreen();

  if (controlsVisible) {
    hideControls();
  } else {
    showControls();
  }
}

// Solo usar un evento para evitar duplicados
document
  .getElementById("playerContainer")
  .addEventListener("click", onPlayerTap);

// Play/Pause
function updatePlayPause() {
  if (video.paused) {
    // Si el video está completado, mostrar icono de replay
    if (isVideoCompleted) {
      playIcon.textContent = "replay"; // Icono de replay
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
    } else {
      playIcon.textContent = "play_arrow"; // Icono de play normal
      playIcon.style.display = "";
      pauseIcon.style.display = "none";
    }
  } else {
    playIcon.style.display = "none";
    pauseIcon.style.display = "";
  }
}
playPauseBtn.addEventListener("click", (e) => {
  e.stopPropagation();

  // Marcar interacción del usuario
  markUserInteraction();

  // Intentar entrar en pantalla completa en el primer clic
  attemptFullscreen();

  if (video.paused) {
    // Si el video está completado, reiniciar desde el principio
    if (isVideoCompleted) {
      video.currentTime = 0;
      setVideoCompletedState(false);
      video.play();
      showControls();
      return; // Salir temprano para evitar la lógica normal
    }
    video.play();
  } else {
    video.pause();
  }
  showControls();
});
video.addEventListener("play", updatePlayPause);
video.addEventListener("pause", updatePlayPause);

// Variable global para rastrear si el video ha terminado
let isVideoCompleted = false;

// Función para sincronizar el estado global
function setVideoCompletedState(completed) {
  isVideoCompleted = completed;
  window.isVideoCompleted = completed;

  // Actualizar la interfaz inmediatamente
  updatePlayPause();
}

// Evento cuando el video termina - evitar auto-reproducción (ÚNICO LISTENER)
video.addEventListener("ended", () => {
  setVideoCompletedState(true);

  // Pausar el video explícitamente múltiples veces para asegurar
  video.pause();

  // Desactivar atributos que puedan causar auto-reproducción
  video.loop = false;
  video.removeAttribute("loop");
  video.removeAttribute("autoplay");

  // Mantener el tiempo en el final del video
  video.currentTime = video.duration;

  // Actualizar la interfaz inmediatamente
  updatePlayPause();
  showControls(false);

  // Múltiples verificaciones con timeouts progresivos
  setTimeout(() => {
    video.pause();
    video.loop = false;
    video.currentTime = video.duration;
    updatePlayPause();
  }, 50);

  setTimeout(() => {
    if (!video.paused) {
      video.pause();
      video.currentTime = video.duration;
      updatePlayPause();
    }
  }, 200);

  setTimeout(() => {
    if (!video.paused) {
      video.pause();
      video.currentTime = video.duration;
      updatePlayPause();
    }
  }, 500);

  // Guardar el progreso como completado
  if (currentEpisode && currentSeason && video.duration) {
    SerieStorage.updateEpisodeProgress(
      currentSeason,
      currentEpisode,
      video.duration,
      video.duration
    );
  }
});

// Event listener interceptor para prevenir ANY play después de completado
video.addEventListener("play", () => {
  if (isVideoCompleted && video.currentTime >= video.duration - 0.5) {
    video.pause();
    video.currentTime = video.duration;
    updatePlayPause();
    return false;
  }
});

// Event listener para detectar cambios en currentTime que podrían reiniciar el video
video.addEventListener("timeupdate", () => {
  // Si el video está completado pero currentTime no está al final, mantenerlo ahí
  if (isVideoCompleted && video.currentTime < video.duration) {
    if (!video.paused) {
      video.pause();
      video.currentTime = video.duration;
      updatePlayPause();
    }
  }

  // Solo actuar si el video está muy cerca del final o en el final exacto
  if (video.duration > 0 && video.currentTime >= video.duration - 0.1) {
    if (!isVideoCompleted) {
      setVideoCompletedState(true);
    }
    if (!video.paused) {
      video.pause();
      updatePlayPause();
    }
  }
});

// Monitoreo agresivo cada 500ms para asegurar que el video permanezca pausado cuando debe estarlo
setInterval(() => {
  if (isVideoCompleted && !video.paused) {
    video.pause();
    video.currentTime = video.duration;
    updatePlayPause();
  }
}, 500);

// Reset del estado cuando el usuario busca manualmente a una posición anterior
video.addEventListener("seeking", () => {
  if (isVideoCompleted && video.currentTime < video.duration - 2) {
    setVideoCompletedState(false);
  }
});

// Prevenir que el video se reproduzca automáticamente al cambiar currentTime cerca del final
video.addEventListener("seeked", () => {
  if (video.currentTime >= video.duration - 0.1 && !video.paused) {
    video.pause();
    setVideoCompletedState(true);
    updatePlayPause();
  }
});

// Retroceder 10 segundos
rewindBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();
  video.currentTime = Math.max(0, video.currentTime - 10);
  showControls();
});
// Avanzar 10 segundos
forwardBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();
  video.currentTime = Math.min(video.duration, video.currentTime + 10);
  showControls();
});

// Botones inferiores - Event listeners
episodesBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();
  showEpisodesOverlay();
});

languageBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();
  showLanguageOverlay();
  showControls();
});

// Funciones del overlay de idiomas
function showLanguageOverlay() {
  // Guardar tiempo actual
  currentTime = video.currentTime;

  // Marcar que el overlay está abierto
  isLanguageOverlayOpen = true;

  // Mostrar overlay
  languageOverlay.classList.add("show");

  // Resetear selección al idioma actual
  selectedLanguage = currentLanguage;

  // Generar opciones de idioma dinámicamente
  generateLanguageOptions();
  updateLanguageSelection();

  // Asegurar que los controles estén visibles y no se oculten automáticamente
  showControls(false);
}

function generateLanguageOptions() {
  const languageOptionsContainer = document.querySelector(".language-options");
  if (!languageOptionsContainer) return;

  // Limpiar opciones existentes
  languageOptionsContainer.innerHTML = "";

  // Obtener idiomas del episodio actual
  const episodeData =
    window.SERIE_DATA.episodesData[currentSeason][currentEpisode - 1];
  const availableLanguages = episodeData.languages;

  // Generar opciones para cada idioma disponible
  Object.keys(availableLanguages).forEach((langCode) => {
    const language = availableLanguages[langCode];
    const button = document.createElement("button");
    button.className = "language-option";
    button.setAttribute("data-language", langCode);

    button.innerHTML = `
      <span>${language.name}</span>
      <span class="checkmark material-symbols-outlined">check</span>
    `;

    // Agregar event listener
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      selectedLanguage = langCode;
      updateLanguageSelection();
    });

    languageOptionsContainer.appendChild(button);
  });
}

function hideLanguageOverlay() {
  languageOverlay.classList.remove("show");

  // Marcar que el overlay está cerrado
  isLanguageOverlayOpen = false;

  // Volver al comportamiento normal de los controles
  showControls(true);
}

function updateLanguageSelection() {
  const options = document.querySelectorAll(".language-option");
  options.forEach((option) => {
    if (option.dataset.language === selectedLanguage) {
      option.classList.add("active");
    } else {
      option.classList.remove("active");
    }
  });
}

function changeVideoLanguage(newLanguage) {
  if (newLanguage === currentLanguage) return;

  // Save language preference for this series
  SerieStorage.saveLanguagePreference(newLanguage);

  // Guardar el idioma anterior y tiempo actual antes de empezar el cambio
  const previousLanguage = currentLanguage;
  const timeToRestore = video.currentTime;

  // Guardar progreso del idioma actual antes de cambiar (por si el cambio falla)
  if (video.currentTime > 0 && video.duration > 0) {
    SerieStorage.updateEpisodeProgress(
      currentSeason,
      currentEpisode,
      video.currentTime,
      video.duration
    );
  }

  // Mostrar loader durante el cambio de idioma
  loadingScreen.style.display = "flex";
  loadingScreen.classList.remove("hide");
  loadingScreen.innerHTML = `
    <span class="loader"></span>
    <div class="loading-text">Cambiando idioma...</div>
  `;
  isVideoReady = false;

  // Obtener la URL del episodio actual en el nuevo idioma
  const episodeData =
    window.SERIE_DATA.episodesData[currentSeason][currentEpisode - 1];

  // Verificar que el idioma existe
  if (!episodeData.languages[newLanguage]) {
    loadingScreen.innerHTML = `
      <span class="loader"></span>
      <div class="loading-text">Idioma no disponible</div>
    `;
    setTimeout(() => {
      loadingScreen.style.display = "none";
      loadingScreen.classList.add("hide");
      isVideoReady = true;
      showControls();
      // No cambiar currentLanguage si el idioma no está disponible
    }, 2000);
    return;
  }

  const newUrl = episodeData.languages[newLanguage].videoUrl;

  // Configurar propiedades del video para evitar loop
  video.loop = false;
  video.autoplay = true;

  // Función común para manejar éxito del cambio de idioma
  function handleLanguageChangeSuccess() {
    setTimeout(() => {
      if (video.duration && timeToRestore < video.duration) {
        video.currentTime = timeToRestore;
      }
      // Solo cambiar currentLanguage si el cambio fue exitoso
      currentLanguage = newLanguage;
      selectedLanguage = newLanguage;

      // Update cast button for new language
      updateCastButton();

      isVideoReady = true;
      restoreVideoControls();
      showControls();
    }, 500); // Pequeño delay para asegurar que el video esté listo
  }

  // Función para manejar error del cambio de idioma
  function handleLanguageChangeError() {
    console.error("Error al cambiar idioma, revirtiendo al idioma anterior");

    // Revertir al idioma anterior
    currentLanguage = previousLanguage;
    selectedLanguage = previousLanguage;

    // Obtener URL del idioma anterior
    const previousUrl = episodeData.languages[previousLanguage].videoUrl;

    // Restaurar video con el idioma anterior
    loadHLS()
      .then((Hls) => {
        const isHLSVideo =
          previousUrl.includes(".m3u8") || previousUrl.includes("m3u8");

        if (isHLSVideo && Hls.isSupported() && hls) {
          hls.destroy();
          hls = new Hls({
            autoStartLoad: true,
            startPosition: -1,
            capLevelToPlayerSize: false,
            debug: false,
            liveDurationInfinity: false,
            backBufferLength: 30,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            enableWorker: true,
            liveSyncDurationCount: 3,
            liveMaxLatencyDurationCount: Infinity,
          });

          hls.on(Hls.Events.MANIFEST_PARSED, handleLanguageChangeSuccess);
          hls.loadSource(previousUrl);
          hls.attachMedia(video);
        } else if (
          isHLSVideo &&
          video.canPlayType("application/vnd.apple.mpegurl")
        ) {
          video.src = previousUrl;
          video.addEventListener(
            "loadedmetadata",
            handleLanguageChangeSuccess,
            { once: true }
          );
        } else {
          video.src = previousUrl;
          video.addEventListener(
            "loadedmetadata",
            handleLanguageChangeSuccess,
            { once: true }
          );
        }
      })
      .catch(() => {
        // Si también falla la reversión, mostrar error
        showVideoError("Error al cargar idioma", false);
      });
  }

  // Cambiar fuente de video
  loadHLS()
    .then((Hls) => {
      // Check if the new URL is HLS (.m3u8) or regular video
      const isHLSVideo = newUrl.includes(".m3u8") || newUrl.includes("m3u8");

      if (isHLSVideo && Hls.isSupported() && hls) {
        // Destruir instancia anterior
        hls.destroy();

        // Crear nueva instancia
        hls = new Hls({
          autoStartLoad: true,
          startPosition: -1,
          capLevelToPlayerSize: false,
          debug: false,
          liveDurationInfinity: false,
          backBufferLength: 30,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
        });

        let manifestParsed = false;
        let errorOccurred = false;

        // Event listener para cuando el manifest se parsea correctamente
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          if (!manifestParsed) {
            manifestParsed = true;
            handleLanguageChangeSuccess();
          }
        });

        // Event listener para errores
        hls.on(Hls.Events.ERROR, function (event, data) {
          if (!errorOccurred) {
            errorOccurred = true;
            console.error("HLS Error al cambiar idioma:", data);

            // Solo mostrar error para errores realmente críticos
            if (
              data.fatal ||
              (data.type === Hls.ErrorTypes.NETWORK_ERROR &&
                data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR)
            ) {
              handleLanguageChangeError("Error al cargar idioma");
            } else {
              // Para errores no fatales, intentar recuperar después de un delay
              setTimeout(() => {
                if (video.readyState >= 2) {
                  handleLanguageChangeSuccess();
                }
              }, 3000);
            }
          }
        });

        // Cargar nueva fuente
        hls.loadSource(newUrl);
        hls.attachMedia(video);
      } else if (
        isHLSVideo &&
        video.canPlayType("application/vnd.apple.mpegurl")
      ) {
        // Safari nativo para HLS
        video.src = newUrl;

        let metadataLoaded = false;

        function handleLoadedMetadata() {
          if (!metadataLoaded) {
            metadataLoaded = true;
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            handleLanguageChangeSuccess();
          }
        }

        function handleError() {
          video.removeEventListener("error", handleError);
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          handleLanguageChangeError("Error al cargar idioma");
        }

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("error", handleError);
      } else {
        // Native browser support for regular video files (.mp4, .webm, .ogg, etc.)
        video.src = newUrl;

        let metadataLoaded = false;

        function handleLoadedMetadata() {
          if (!metadataLoaded) {
            metadataLoaded = true;
            video.removeEventListener("loadedmetadata", handleLoadedMetadata);
            handleLanguageChangeSuccess();
          }
        }

        function handleError() {
          video.removeEventListener("error", handleError);
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          handleLanguageChangeError("Error al cargar idioma");
        }

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
        video.addEventListener("error", handleError);
      }
    })
    .catch((error) => {
      console.error("Failed to load HLS for language change:", error);
      handleLanguageChangeError("Error al cargar el reproductor");
    });
}

// Event listeners del overlay de idiomas (dinámicos - se crean en generateLanguageOptions)

languageCancel.addEventListener("click", (e) => {
  e.stopPropagation();
  hideLanguageOverlay();
});

languageAccept.addEventListener("click", (e) => {
  e.stopPropagation();
  changeVideoLanguage(selectedLanguage);
  hideLanguageOverlay();
});

// Cerrar overlay al hacer clic fuera del modal
languageOverlay.addEventListener("click", (e) => {
  if (e.target === languageOverlay) {
    hideLanguageOverlay();
  }
});

// Funciones del overlay de episodios
function showEpisodesOverlay() {
  isEpisodesOverlayOpen = true;
  episodesOverlay.classList.add("show");
  hideControls();
  updateCurrentSeason();
  renderEpisodes();
  renderSeasons();
}

function hideEpisodesOverlay() {
  episodesOverlay.classList.remove("show");
  isEpisodesOverlayOpen = false;
  showControls(true);
}

function showSeasonOverlay() {
  isSeasonOverlayOpen = true;
  seasonOverlay.classList.add("show");
}

function hideSeasonOverlay() {
  seasonOverlay.classList.remove("show");
  isSeasonOverlayOpen = false;
}

function updateCurrentSeason() {
  currentSeasonText.textContent =
    window.SERIE_DATA.seasonsData[currentSeason].name;
}

function renderEpisodes() {
  const episodes = window.SERIE_DATA.episodesData[currentSeason] || [];
  episodesScroll.innerHTML = "";

  episodes.forEach((episode) => {
    const episodeCard = document.createElement("div");
    episodeCard.className = "episode-card";

    // Marcar el episodio actual si es el que se está reproduciendo
    if (episode.number === currentEpisode) {
      episodeCard.classList.add("current-episode");
    }

    episodeCard.innerHTML = `
          <div class="episode-thumbnail">
            <img src="${episode.thumbnail}" alt="Episodio ${episode.number}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE2OCIgdmlld0JveD0iMCAwIDMwMCAxNjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMTY4IiBmaWxsPSIjMzMzIi8+CjxyZWN0IHg9IjEyNSIgeT0iNjkiIHdpZHRoPSI1MCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzU1NSIvPgo8L3N2Zz4K'">
            <div class="episode-play-overlay">
              <span class="material-symbols-outlined">play_arrow</span>
            </div>
            <div class="episode-progress-bar" data-season="${currentSeason}" data-episode="${episode.number}">
              <div class="episode-progress-fill"></div>
            </div>
          </div>
          <div class="episode-info">
            <div class="episode-number">Episodio ${episode.number}</div>
            <div class="season-episode-title">${episode.title}</div>
          </div>
        `;

    episodeCard.addEventListener("click", () => {
      hideEpisodesOverlay();
      // Reproducir el episodio seleccionado
      playEpisode(currentSeason, episode.number);
      // Actualizar botón de siguiente episodio
      updateNextEpisodeButton();
    });

    episodesScroll.appendChild(episodeCard);
  });

  // Actualizar progreso de episodios después de renderizar
  updateEpisodesProgress();

  // Hacer scroll automático al episodio actual
  scrollToCurrentEpisode();
}

function updateEpisodesProgress() {
  const progressBars = document.querySelectorAll(".episode-progress-bar");

  progressBars.forEach((progressBar) => {
    const season = parseInt(progressBar.getAttribute("data-season"));
    const episode = parseInt(progressBar.getAttribute("data-episode"));
    const progressFill = progressBar.querySelector(".episode-progress-fill");

    // Obtener progreso del localStorage
    const watchedData = SerieStorage.getWatchedData();
    const episodeKey = `s${season}e${episode}`; // Formato correcto: s1e1
    const episodeData = watchedData.watchedEpisodes[episodeKey]; // Usar watchedEpisodes en lugar de episodes

    if (episodeData && episodeData.duration > 0) {
      const progressPercent =
        (episodeData.currentTime / episodeData.duration) * 100;
      progressFill.style.width = `${Math.min(progressPercent, 100)}%`;

      // Si el episodio está completado (más del 95%), mostrar como completado
      if (progressPercent >= 95) {
        progressBar.classList.add("completed");
      } else {
        progressBar.classList.remove("completed");
      }
    } else {
      // Sin progreso
      progressFill.style.width = "0%";
      progressBar.classList.remove("completed");
    }
  });
}

// Función para hacer scroll automático al episodio actual
function scrollToCurrentEpisode() {
  setTimeout(() => {
    const episodeCards = document.querySelectorAll(".episode-card");
    const currentEpisodeCard = episodeCards[currentEpisode - 1]; // currentEpisode es 1-indexed

    if (currentEpisodeCard && episodesScroll) {
      // Calcular la posición de scroll
      const cardWidth = currentEpisodeCard.offsetWidth;
      const cardOffsetLeft = currentEpisodeCard.offsetLeft;
      const scrollContainerWidth = episodesScroll.offsetWidth;

      // Centrar el episodio actual en el contenedor
      const scrollPosition =
        cardOffsetLeft - scrollContainerWidth / 2 + cardWidth / 2;

      // Hacer scroll suave
      episodesScroll.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: "smooth",
      });
    }
  }, 100); // Pequeño delay para asegurar que el DOM esté renderizado
}

function renderSeasons() {
  seasonList.innerHTML = "";

  Object.keys(window.SERIE_DATA.seasonsData).forEach((seasonNum) => {
    const season = window.SERIE_DATA.seasonsData[seasonNum];
    const seasonOption = document.createElement("div");
    seasonOption.className = `season-option ${
      currentSeason == seasonNum ? "active" : ""
    }`;
    seasonOption.textContent = season.name;

    seasonOption.addEventListener("click", () => {
      currentSeason = parseInt(seasonNum);
      hideSeasonOverlay();
      updateCurrentSeason();
      renderEpisodes();
      renderSeasons();
    });

    seasonList.appendChild(seasonOption);
  });
}

// Event listeners para los overlays de episodios
episodesBackBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  hideEpisodesOverlay();
});

seasonSelector.addEventListener("click", (e) => {
  e.stopPropagation();
  showSeasonOverlay();
});

seasonCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  hideSeasonOverlay();
});

// Cerrar overlay de temporadas al hacer clic fuera
seasonOverlay.addEventListener("click", (e) => {
  if (e.target === seasonOverlay) {
    hideSeasonOverlay();
  }
});

nextEpisodeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();

  const nextInfo = getNextEpisodeInfo();
  if (nextInfo) {
    playEpisode(nextInfo.season, nextInfo.episode);
  }

  showControls();
});

// Botón de fullscreen
fullscreenBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();
  toggleFullscreen();
  showControls();
});

// Botón de cast - evitar que oculte los controles
if (castBtn) {
  castBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    markUserInteraction();
    showControls();
  });
}

// Función para alternar fullscreen
function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().then(() => {
      fullscreenIcon.textContent = "fullscreen";
    });
  } else {
    enterFullscreen().then(() => {
      fullscreenIcon.textContent = "fullscreen_exit";
    });
  }
}

// Actualizar icono de fullscreen cuando cambie el estado
document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    fullscreenIcon.textContent = "fullscreen_exit";
  } else {
    fullscreenIcon.textContent = "fullscreen";
  }
});

// Barra de progreso
function formatTime(t) {
  t = Math.floor(t);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
video.addEventListener("timeupdate", () => {
  if (isDragging && dragPercent !== null) return; // No actualizar durante drag

  // Verificar si el video está cerca del final ANTES de actualizar la UI
  if (video.duration > 0 && video.currentTime > 0) {
    const timeRemaining = video.duration - video.currentTime;

    // Si quedan menos de 0.8 segundos, pausar inmediatamente
    if (timeRemaining <= 0.8 && !video.paused) {
      video.pause();
      video.currentTime = video.duration;
      updatePlayPause();
      showControls(false);

      // Guardar progreso como completado
      if (currentEpisode && currentSeason && video.duration) {
        SerieStorage.updateEpisodeProgress(
          currentSeason,
          currentEpisode,
          video.duration,
          video.duration
        );
      }
      return; // Salir temprano para evitar actualizar la UI
    }
  }

  const percent = video.currentTime / video.duration;
  progress.style.width = percent * 100 + "%";
  progressThumb.style.left = percent * 100 + "%";
  currentTimeEl.textContent = formatTime(video.currentTime);

  // Actualizar progreso en la lista de episodios si está visible
  updateEpisodesProgress();

  // Guardar progreso cada 10 segundos durante la reproducción (solo si no está cerca del final)
  if (
    video.currentTime % 10 < 0.5 &&
    video.currentTime > 0 &&
    video.currentTime < video.duration - 2
  ) {
    SerieStorage.updateEpisodeProgress(
      currentSeason,
      currentEpisode,
      video.currentTime,
      video.duration
    );
  }
});
video.addEventListener("durationchange", () => {
  durationEl.textContent = formatTime(video.duration);
});
// Evitar que el click/touch en la barra de progreso o el thumb oculten los controles
progressBar.addEventListener("click", (e) => {
  e.stopPropagation();
  markUserInteraction();

  // Verificar si hay error de video antes de permitir la navegación
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && errorOverlay.style.display === "flex") {
    return; // No permitir navegación durante errores
  }

  // Verificar que el video tenga duración válida
  if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
    return; // No permitir navegación si no hay duración válida
  }

  const rect = progressBar.getBoundingClientRect();
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const percent = Math.max(0, Math.min(1, (x - rect.left) / rect.width));

  // Actualizar inmediatamente la UI
  progress.style.width = percent * 100 + "%";
  progressThumb.style.left = percent * 100 + "%";
  currentTimeEl.textContent = formatTime(percent * video.duration);

  // Luego actualizar el tiempo del video
  const newTime = percent * video.duration;
  if (!isNaN(newTime) && newTime >= 0 && newTime <= video.duration) {
    video.currentTime = newTime;
  }
  showControls(true); // Aplicar timing de auto-hide
});

// Drag & drop para el thumb del slider
const progressThumb = document.getElementById("progressThumb");
let isDragging = false;
// Feedback visual en drag
let dragPercent = null;
function updateSliderUI(percent, duration) {
  progress.style.width = percent * 100 + "%";
  progressThumb.style.left = percent * 100 + "%";

  // Solo actualizar el tiempo si la duración es válida
  if (duration && !isNaN(duration) && duration > 0) {
    const time = percent * duration;
    if (!isNaN(time) && time >= 0) {
      currentTimeEl.textContent = formatTime(time);
    }
  } else {
    currentTimeEl.textContent = "0:00";
  }
}
function seekToClientX(clientX, updateOnlyUI = false) {
  // Verificar si hay un error de video o si el video no está listo
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && errorOverlay.style.display === "flex") {
    return; // No permitir navegación durante errores
  }

  // Verificar que el video tenga duración válida
  if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
    return; // No permitir navegación si no hay duración válida
  }

  const rect = progressBar.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  dragPercent = percent;
  updateSliderUI(percent, video.duration);
  if (!updateOnlyUI) {
    const newTime = percent * video.duration;
    if (!isNaN(newTime) && newTime >= 0 && newTime <= video.duration) {
      video.currentTime = newTime;
    }
  }
}
// Mouse events
progressThumb.addEventListener("mousedown", (e) => {
  e.stopPropagation();
  markUserInteraction();

  // Verificar si hay error de video antes de permitir el drag
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && errorOverlay.style.display === "flex") {
    return; // No permitir drag durante errores
  }

  // Verificar que el video tenga duración válida
  if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
    return; // No permitir drag si no hay duración válida
  }

  isDragging = true;
  showControls(false); // Durante el drag, no ocultar automáticamente
  document.body.style.userSelect = "none";
});
document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    seekToClientX(e.clientX, true);
    showControls(false); // Mantener visible durante el drag
  }
});
document.addEventListener("mouseup", (e) => {
  if (isDragging) {
    seekToClientX(e.clientX, false);
    isDragging = false;
    dragPercent = null;
    document.body.style.userSelect = "";
    showControls(true); // Aplicar timing de auto-hide
  }
});
// Touch events
progressThumb.addEventListener("touchstart", (e) => {
  e.stopPropagation();
  e.preventDefault();
  markUserInteraction();

  // Verificar si hay error de video antes de permitir el drag
  const errorOverlay = document.getElementById("videoErrorOverlay");
  if (errorOverlay && errorOverlay.style.display === "flex") {
    return; // No permitir drag durante errores
  }

  // Verificar que el video tenga duración válida
  if (!video.duration || isNaN(video.duration) || video.duration <= 0) {
    return; // No permitir drag si no hay duración válida
  }

  isDragging = true;
  showControls(false); // Durante el drag, no ocultar automáticamente
  document.body.style.userSelect = "none";
});
document.addEventListener("touchmove", (e) => {
  if (isDragging && e.touches && e.touches.length) {
    e.preventDefault();
    seekToClientX(e.touches[0].clientX, true);
    showControls(false); // Mantener visible durante el drag
  }
});
document.addEventListener("touchend", (e) => {
  if (isDragging) {
    if (e.changedTouches && e.changedTouches.length) {
      seekToClientX(e.changedTouches[0].clientX, false);
    }
    isDragging = false;
    dragPercent = null;
    document.body.style.userSelect = "";
    showControls(true); // Aplicar timing de auto-hide
  }
});

// Inicialización
video.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(video.duration);
  currentTimeEl.textContent = formatTime(video.currentTime);
});

// Variable para controlar si ya se intentó entrar en pantalla completa
let fullscreenAttempted = false;

// Función para entrar en pantalla completa
function enterFullscreen() {
  const playerContainer = document.getElementById("playerContainer");

  if (playerContainer.requestFullscreen) {
    return playerContainer.requestFullscreen().catch(() => {
      // Error entering fullscreen - silently handle
    });
  } else if (playerContainer.webkitRequestFullscreen) {
    return playerContainer.webkitRequestFullscreen();
  } else if (playerContainer.mozRequestFullScreen) {
    return playerContainer.mozRequestFullScreen();
  } else if (playerContainer.msRequestFullscreen) {
    return playerContainer.msRequestFullscreen();
  }
  return Promise.resolve();
}

// Entrar en pantalla completa en la primera interacción del usuario
function attemptFullscreen() {
  if (!fullscreenAttempted) {
    fullscreenAttempted = true;
    enterFullscreen();
  }
}

// Ocultar controles tras 3s (solo si el video está listo)
if (isVideoReady) {
  showControls();
} else {
  // Ocultar controles inicialmente hasta que el video esté listo
  hideControls();
}
updatePlayPause();

// Serie page event listeners
playFirstEpisode.addEventListener("click", () => {
  playEpisode(currentSeason, currentEpisode);
  updateNextEpisodeButton();
});

seasonSelectorBtn.addEventListener("click", () => {
  showSerieSeasonModal();
});

// Serie season modal event listeners
serieSeasonCloseBtn.addEventListener("click", () => {
  hideSerieSeasonModal();
});

// Close season modal when clicking outside
serieSeasonModal.addEventListener("click", (e) => {
  if (e.target === serieSeasonModal) {
    hideSerieSeasonModal();
  }
});

// Función para limpiar el estado del reproductor y restaurar el scroll
function cleanupPlayerState() {
  // Remover clases del modal y body
  playerModal.classList.remove("active");
  playerModal.style.display = "none";
  document.body.classList.remove("player-active");

  // Restaurar propiedades de scroll del body por si acaso
  document.body.style.overflow = "";
  document.body.style.height = "";

  // Pausar video
  video.pause();

  // Actualizar las cards de la página principal con el progreso actualizado
  updateMainPageProgress();
}

// Función para actualizar el progreso en las cards de la página principal
function updateMainPageProgress() {
  // Regenerar la grilla de episodios para mostrar el progreso actualizado
  generateEpisodesGrid();

  // También actualizar el botón principal de reproducir
  setTimeout(() => {
    updatePlayButton();
  }, 100);

  // Si hay cambio de temporada debido a completar episodios, actualizar label
  updateSeasonLabel();
}

// Función de verificación de scroll - ejecutar si hay problemas
function forceScrollRestore() {
  document.body.classList.remove("player-active");
  document.body.style.overflow = "";
  document.body.style.height = "";
  document.body.style.position = "";

  // Forzar reflow del DOM
  document.body.offsetHeight;
}

backBtn.addEventListener("click", () => {
  // Si estamos en pantalla completa, primero salir de pantalla completa
  if (document.fullscreenElement) {
    document
      .exitFullscreen()
      .then(() => {
        // Después de salir de pantalla completa, proceder con el cierre
        handleBackButtonAction();
      })
      .catch(() => {
        // Si hay error al salir de pantalla completa, proceder de todas formas
        handleBackButtonAction();
      });
  } else {
    // Si no estamos en pantalla completa, proceder directamente
    handleBackButtonAction();
  }
});

function handleBackButtonAction() {
  // Save progress before cleanup
  if (video.currentTime && video.duration) {
    SerieStorage.updateEpisodeProgress(
      currentSeason,
      currentEpisode,
      video.currentTime,
      video.duration
    );
  }

  // Cleanup player state and update main page progress
  cleanupPlayerState();
}

// Save progress periodically
setInterval(() => {
  if (
    !playerModal.classList.contains("active") ||
    !video.currentTime ||
    !video.duration
  )
    return;

  SerieStorage.updateEpisodeProgress(
    currentSeason,
    currentEpisode,
    video.currentTime,
    video.duration
  );

  // Update play button text periodically (solo si no está el reproductor activo en la vista)
  if (!playerModal.classList.contains("active")) {
    updatePlayButton();
  }
}, 30000); // Save every 30 seconds

// Synopsis Read More Functionality
function initializeSynopsis() {
  const synopsisText = document.getElementById("synopsisText");
  const readMoreBtn = document.getElementById("readMoreBtn");

  if (synopsisText && readMoreBtn) {
    const shortText = window.SERIE_DATA.synopsis.short;
    const fullText = window.SERIE_DATA.synopsis.full;

    // Set initial text
    synopsisText.textContent = shortText;

    readMoreBtn.addEventListener("click", () => {
      const isExpanded = synopsisText.classList.contains("expanded");

      if (isExpanded) {
        synopsisText.classList.remove("expanded");
        synopsisText.textContent = shortText;
        readMoreBtn.textContent = "Leer más";
      } else {
        synopsisText.classList.add("expanded");
        synopsisText.textContent = fullText;
        readMoreBtn.textContent = "Leer menos";
      }
    });
  }
}

// Initialize the serie page when DOM is loaded
initializeSeriePage();
initializeSynopsis();

// Inicializar el botón de siguiente episodio
updateNextEpisodeButton();

// Cleanup adicional para asegurar que el scroll funcione correctamente
// Limpiar estado si el usuario navega fuera de la página
window.addEventListener("beforeunload", () => {
  cleanupPlayerState();
});

// Limpiar estado si el usuario presiona ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && playerModal.classList.contains("active")) {
    // Si estamos en pantalla completa, primero salir de pantalla completa
    if (document.fullscreenElement) {
      document
        .exitFullscreen()
        .then(() => {
          // Después de salir de pantalla completa, proceder con el cierre
          handleEscapeAction();
        })
        .catch(() => {
          // Si hay error al salir de pantalla completa, proceder de todas formas
          handleEscapeAction();
        });
    } else {
      // Si no estamos en pantalla completa, proceder directamente
      handleEscapeAction();
    }
  }
});

function handleEscapeAction() {
  // Save progress before cleanup
  if (video.currentTime && video.duration) {
    SerieStorage.updateEpisodeProgress(
      currentSeason,
      currentEpisode,
      video.currentTime,
      video.duration
    );
  }

  // Cleanup player state and update main page progress
  cleanupPlayerState();
}

// Verificación de seguridad: asegurar que el body no tenga player-active al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.remove("player-active");
  document.body.style.overflow = "";
  document.body.style.height = "";
});

// Limpiar estado cuando la página se vuelve visible (útil para detectar problemas de scroll)
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !playerModal.classList.contains("active")) {
    // Si la página es visible pero el reproductor no está activo, limpiar estado
    forceScrollRestore();
  }
});

// My List Management
class MyListStorage {
  static getMyList() {
    const data = localStorage.getItem("myList");
    return data ? JSON.parse(data) : [];
  }

  static saveMyList(list) {
    try {
      localStorage.setItem("myList", JSON.stringify(list));
    } catch (error) {
      console.error("Error al guardar mi lista:", error);
    }
  }

  static addToList(serieData) {
    const myList = this.getMyList();
    const exists = myList.find((item) => item.id === serieData.id);

    if (!exists) {
      myList.push({
        id: serieData.id,
        title: serieData.title,
        poster: serieData.poster,
        heroImage: serieData.heroImage,
        addedAt: Date.now(),
      });
      this.saveMyList(myList);
      return true;
    }
    return false;
  }

  static removeFromList(serieId) {
    const myList = this.getMyList();
    const filteredList = myList.filter((item) => item.id !== serieId);
    this.saveMyList(filteredList);
    return filteredList.length !== myList.length;
  }

  static isInList(serieId) {
    const myList = this.getMyList();
    return myList.some((item) => item.id === serieId);
  }
}

// Initialize Add to List Button
function initializeAddToListButton() {
  const addToListBtn = document.getElementById("addToListBtn");
  if (!addToListBtn) return;

  const serieId = addToListBtn.dataset.serieId;

  // Set initial state
  updateAddToListButton();

  // Add click event listener
  addToListBtn.addEventListener("click", () => {
    const isInList = MyListStorage.isInList(serieId);

    if (isInList) {
      // Remove from list
      MyListStorage.removeFromList(serieId);
    } else {
      // Add to list
      const serieData = {
        id: addToListBtn.dataset.serieId,
        title: addToListBtn.dataset.title,
        poster: addToListBtn.dataset.poster || "",
        heroImage: addToListBtn.dataset.heroImage,
      };
      MyListStorage.addToList(serieData);
    }

    // Update button state
    updateAddToListButton();
  });
}

function updateAddToListButton() {
  const addToListBtn = document.getElementById("addToListBtn");
  if (!addToListBtn) return;

  const serieId = addToListBtn.dataset.serieId;
  const isInList = MyListStorage.isInList(serieId);

  if (isInList) {
    addToListBtn.classList.add("in-list");
  } else {
    addToListBtn.classList.remove("in-list");
  }
}

// Initialize Add to List functionality
initializeAddToListButton();

// Funciones globales para botones de error (llamadas desde HTML generado)
// eslint-disable-next-line no-unused-vars
function changeLanguage() {
  showLanguageOverlay();
}

// eslint-disable-next-line no-unused-vars
function closePlayer() {
  handleEscapeAction();
  playerModal.classList.remove("active");
  playerModal.style.display = "none";
  document.body.classList.remove("player-active");
  document.body.style.overflow = "";
  document.body.style.height = "";
}
