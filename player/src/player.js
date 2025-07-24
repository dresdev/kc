let hlsLoaded = !1,
  hlsLoadPromise = null;
function loadHLS() {
  return (hlsLoadPromise =
    hlsLoadPromise ||
    new Promise((e, t) => {
      var o;
      window.Hls
        ? ((hlsLoaded = !0), e(window.Hls))
        : (((o = document.createElement("script")).src =
            "https://cdn.jsdelivr.net/npm/hls.js@latest"),
          (o.onload = () => {
            (hlsLoaded = !0), e(window.Hls);
          }),
          (o.onerror = () => {
            t(new Error("Failed to load HLS.js"));
          }),
          document.head.appendChild(o));
    }));
}
class SerieStorage {
  static getWatchedData(e = window.SERIE_ID) {
    return (e = localStorage.getItem("serie_" + e))
      ? JSON.parse(e)
      : {
          currentSeason: 1,
          currentEpisode: 1,
          watchedEpisodes: {},
          lastWatched: null,
        };
  }
  static saveWatchedData(e, t = window.SERIE_ID) {
    try {
      localStorage.setItem("serie_" + t, JSON.stringify(e));
    } catch (e) {
      console.error("Error al guardar en localStorage:", e);
    }
  }
  static updateEpisodeProgress(e, t, o, n, a = window.SERIE_ID) {
    var s = this.getWatchedData(a);
    (s.watchedEpisodes[`s${e}e` + t] = {
      currentTime: o,
      duration: n,
      progress: (o / n) * 100,
      completed: 0.9 < o / n,
      lastWatched: Date.now(),
    }),
      (s.currentSeason = e),
      (s.currentEpisode = t),
      (s.lastWatched = Date.now()),
      this.saveWatchedData(s, a),
      window.SERIE_DATA &&
        a === window.SERIE_DATA.id &&
        (s = window.SERIE_DATA.episodesData[e]?.[t - 1]) &&
        ((e = {
          serieId: a,
          serieTitle: window.SERIE_DATA.title,
          seriePoster: window.SERIE_DATA.poster,
          serieHeroImage: window.SERIE_DATA.heroImage,
          season: e,
          episode: t,
          episodeTitle: s.title,
          episodeThumbnail: s.thumbnail,
          episodeDuration: s.duration,
          currentTime: o,
          progress: (o / n) * 100,
          lastWatched: Date.now(),
        }),
        this.updateContinueWatching(a, e));
  }
  static getEpisodeProgress(e, t, o = window.SERIE_ID) {
    return (
      this.getWatchedData(o).watchedEpisodes[`s${e}e` + t] || {
        currentTime: 0,
        progress: 0,
      }
    );
  }
  static hasAnyEpisodeWatched(e = window.SERIE_ID) {
    return (
      (e = this.getWatchedData(e)),
      0 < Object.keys(e.watchedEpisodes || {}).length
    );
  }
  static getLastWatchedEpisode(e = window.SERIE_ID) {
    return (e = this.getWatchedData(e)).lastWatched &&
      e.currentSeason &&
      e.currentEpisode
      ? {
          season: e.currentSeason,
          episode: e.currentEpisode,
          lastWatched: e.lastWatched,
        }
      : null;
  }
  static getContinueWatchingList() {
    var e = localStorage.getItem("continueWatching");
    return e ? JSON.parse(e) : [];
  }
  static saveContinueWatchingList(e) {
    try {
      localStorage.setItem("continueWatching", JSON.stringify(e));
    } catch (e) {
      console.error("Error al guardar lista de continuar viendo:", e);
    }
  }
  static updateContinueWatching(e, t) {
    let o = this.getContinueWatchingList();
    (o = o.filter((t) => t.serieId !== e)).unshift(t),
      20 < o.length && (o = o.slice(0, 20)),
      this.saveContinueWatchingList(o);
  }
  static removeContinueWatching(e) {
    let t = this.getContinueWatchingList();
    (t = t.filter((t) => t.serieId !== e)), this.saveContinueWatchingList(t);
  }
  static getLanguagePreference(e = window.SERIE_ID) {
    try {
      return localStorage.getItem("kc-language-" + e) || "sub";
    } catch (e) {
      return console.error("Error loading language preference:", e), "sub";
    }
  }
  static saveLanguagePreference(e, t = window.SERIE_ID) {
    try {
      localStorage.setItem("kc-language-" + t, e);
    } catch (e) {
      console.error("Error saving language preference:", e);
    }
  }
  static selectBestLanguage(e, t = window.SERIE_ID) {
    var o = this.getLanguagePreference(t);
    if (e[o]) return { language: o, isPreferred: !0, fallbackUsed: !1 };
    for (const t of ["sub", "lat", "esp", "eng"])
      if (e[t])
        return {
          language: t,
          isPreferred: !1,
          fallbackUsed: !0,
          preferredLanguage: o,
        };
    return {
      language: Object.keys(e)[0],
      isPreferred: !1,
      fallbackUsed: !0,
      preferredLanguage: o,
    };
  }
  static getBestLanguage(e, t = window.SERIE_ID) {
    return this.selectBestLanguage(e, t).language;
  }
}
const playFirstEpisode = document.getElementById("playFirstEpisode"),
  playButtonText = document.getElementById("playButtonText"),
  seasonSelectorBtn = document.getElementById("seasonSelectorBtn"),
  currentSeasonLabel = document.getElementById("currentSeasonLabel"),
  episodesGrid = document.getElementById("episodesGrid"),
  playerModal = document.getElementById("playerModal"),
  serieSeasonModal = document.getElementById("serieSeasonModal"),
  serieSeasonList = document.getElementById("serieSeasonList"),
  serieSeasonCloseBtn = document.getElementById("serieSeasonCloseBtn"),
  video = document.getElementById("video"),
  originalPlay =
    ((video.loop = !1), (video.preload = "metadata"), video.play.bind(video)),
  controls =
    ((video.play = function () {
      return window.isVideoCompleted &&
        video.currentTime >= video.duration - 0.5
        ? (console.log("Play bloqueado: video completado"), Promise.resolve())
        : originalPlay();
    }),
    (window.isVideoCompleted = !1),
    document.getElementById("controls")),
  playPauseBtn = document.getElementById("playPauseBtn"),
  rewindBtn = document.getElementById("rewindBtn"),
  forwardBtn = document.getElementById("forwardBtn"),
  progressBar = document.getElementById("progressBar"),
  progress = document.getElementById("progress"),
  currentTimeEl = document.getElementById("currentTime"),
  durationEl = document.getElementById("duration"),
  playIcon = document.getElementById("playIcon"),
  pauseIcon = document.getElementById("pauseIcon"),
  backBtn = document.getElementById("backBtn"),
  castBtn = document.getElementById("castBtn"),
  fullscreenBtn = document.getElementById("fullscreenBtn"),
  fullscreenIcon = document.getElementById("fullscreenIcon"),
  loadingScreen = document.getElementById("loadingScreen"),
  episodesBtn = document.getElementById("episodesBtn"),
  languageBtn = document.getElementById("languageBtn"),
  nextEpisodeBtn = document.getElementById("nextEpisodeBtn"),
  languageOverlay = document.getElementById("languageOverlay"),
  languageCancel = document.getElementById("languageCancel"),
  episodeTitle = document.getElementById("episodeTitle"),
  languageAccept = document.getElementById("languageAccept"),
  episodesOverlay = document.getElementById("episodesOverlay"),
  episodesBackBtn = document.getElementById("episodesBackBtn"),
  seasonSelector = document.getElementById("seasonSelector"),
  currentSeasonText = document.getElementById("currentSeasonText"),
  episodesScroll = document.getElementById("episodesScroll"),
  seasonOverlay = document.getElementById("seasonOverlay"),
  seasonList = document.getElementById("seasonList"),
  seasonCloseBtn = document.getElementById("seasonCloseBtn");
let controlsTimeout,
  hls,
  selectedLanguage = "sub",
  currentLanguage = "sub",
  currentTime = 0,
  controlsVisible = !0,
  isVideoReady = !1,
  hasUserInteracted = !1,
  isLanguageOverlayOpen = !1,
  isEpisodesOverlayOpen = !1,
  isSeasonOverlayOpen = !1,
  currentSerie = window.SERIE_DATA,
  currentSeason = 1,
  currentEpisode = 1,
  playingSeason = 1,
  playingEpisode = 1;
function initializeSeriePage() {
  (selectedLanguage = SerieStorage.getLanguagePreference()),
    (currentLanguage = selectedLanguage),
    populateHeroSection(),
    loadSerieProgress(),
    updatePlayButton(),
    updateSeasonLabel(),
    generateEpisodesGrid(),
    setVideoPoster(),
    checkAndAutoOpenPlayer();
}
function checkAndAutoOpenPlayer() {
  var e = SerieStorage.getLastWatchedEpisode();
  (SerieStorage.hasAnyEpisodeWatched() || e) &&
    e &&
    ((currentSeason = e.season),
    (currentEpisode = e.episode),
    console.log(
      `Auto-abriendo reproductor para: T${currentSeason}E` + currentEpisode
    ),
    playEpisode(currentSeason, currentEpisode, !1));
}
function populateHeroSection() {
  var e,
    t =
      ((t = document.querySelector(".hero-section")) &&
        window.SERIE_DATA.heroImage &&
        ((t.style.backgroundImage = `url('${window.SERIE_DATA.heroImage}')`),
        (t.style.backgroundSize = "cover"),
        (t.style.backgroundPosition = "center center"),
        (t.style.position = "relative"),
        (t = "hero-opacity-style"),
        (e = document.getElementById(t)) && e.remove(),
        ((e = document.createElement("style")).id = t),
        (e.textContent =
          "\n      .hero-section::after {\n        content: '';\n        position: absolute;\n        top: 0;\n        left: 0;\n        right: 0;\n        bottom: 0;\n        background-color: rgba(0, 0, 0, 0.2);\n        z-index: 1;\n        pointer-events: none;\n        width:100%;\n        height: 100%;\n      }\n      .hero-section .hero-content {\n        position: relative;\n        z-index: 2;\n      }\n    "),
        document.head.appendChild(e)),
      document.getElementById("serieTitle"));
  (e =
    (t && (t.textContent = window.SERIE_DATA.title),
    document.getElementById("serieMeta"))) &&
    (e.innerHTML = `\n      <span class="meta-item">${
      window.SERIE_DATA.year
    }</span>\n      <span class="meta-item">•</span>\n      <span class="meta-item">${
      window.SERIE_DATA.seasons
    } Temporada${
      1 < window.SERIE_DATA.seasons ? "s" : ""
    }</span>\n      <span class="meta-item">•</span>\n      <span class="meta-item">${
      window.SERIE_DATA.rating
    }</span>\n    `),
    (t = document.getElementById("serieCategories"));
  (e =
    (t &&
      (t.innerHTML = window.SERIE_DATA.categories
        .map((e) => `<span class="category-tag">${e}</span>`)
        .join("")),
    document.getElementById("addToListBtn"))) &&
    (e.setAttribute("data-serie-id", window.SERIE_DATA.id),
    e.setAttribute("data-title", window.SERIE_DATA.title),
    e.setAttribute("data-poster", window.SERIE_DATA.poster),
    e.setAttribute("data-hero-image", window.SERIE_DATA.heroImage),
    e.setAttribute("data-languages", window.SERIE_DATA.languages));
}
function setVideoPoster() {
  var e,
    t = document.getElementById("video");
  t &&
    currentSeason &&
    currentEpisode &&
    (e = window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1])
      ?.thumbnail &&
    (t.poster = e.thumbnail);
}
function updateSeasonLabel() {
  currentSeasonLabel.textContent = "Temporada " + currentSeason;
}
function formatDuration(e) {
  var t,
    o,
    n = e.match(/(\d+)\s*min/);
  return n
    ? 60 <= (n = parseInt(n[1]))
      ? ((t = Math.floor(n / 60)), 0 < (o = n % 60) ? t + `h ${o}m` : t + "h")
      : n + "m"
    : e;
}
function updatePlayButton() {
  if (
    (e = SerieStorage.getWatchedData()).lastWatched &&
    0 !== Object.keys(e.watchedEpisodes).length
  ) {
    let o = e.currentSeason || 1,
      n = e.currentEpisode || 1,
      a = !1;
    var e,
      t = `s${o}e` + n;
    let s;
    (e = e.watchedEpisodes[t]) &&
      10 < e.progress &&
      e.progress < 90 &&
      (a = !0),
      e &&
        90 <= e.progress &&
        ((t = window.SERIE_DATA.episodesData[o]) && n < t.length
          ? (n++, (a = !1))
          : ((e = o + 1),
            window.SERIE_DATA.episodesData[e] && ((o = e), (n = 1), (a = !1)))),
      (s = a ? `CONTINUAR T${o}E` + n : `REPRODUCIR T${o}E` + n),
      (playButtonText.textContent = s),
      (currentSeason = o),
      (currentEpisode = n);
  } else playButtonText.textContent = "REPRODUCIR T1E1";
}
function generateEpisodesGrid() {
  var e = window.SERIE_DATA.episodesData[currentSeason] || [];
  (episodesGrid.innerHTML = ""),
    e.forEach((e, t) => {
      var o = document.createElement("div"),
        n = (n =
          ((o.className = "serie-episode-card"),
          SerieStorage.getEpisodeProgress(currentSeason, t + 1)))
          ? Math.max(0, Math.min(100, n.progress))
          : 0;
      (o.innerHTML = `\n          <div class="serie-episode-thumbnail" style="background-image: url('${
        e.thumbnail
      }')">\n            ${
        90 < n
          ? '<div class="watched-indicator"><span class="material-symbols-outlined">check_circle</span></div>'
          : ""
      }\n            <span class="material-symbols-outlined play-icon">play_circle</span>\n            <div class="serie-episode-progress-bar">\n              <div class="serie-episode-progress-fill" style="width: ${n}%"></div>\n            </div>\n          </div>\n          <div class="serie-episode-info">\n            <h3 class="serie-episode-title">${
        e.number
      }. ${
        e.title
      }</h3>\n            <div class="serie-episode-duration">${formatDuration(
        e.duration
      )}</div>\n          </div>\n        `),
        o.addEventListener("click", () => {
          (currentEpisode = t + 1),
            playEpisode(currentSeason, currentEpisode),
            updateNextEpisodeButton();
        }),
        episodesGrid.appendChild(o);
    });
}
function loadSerieProgress() {
  var e = SerieStorage.getWatchedData();
  e.currentSeason &&
    e.currentEpisode &&
    (1 === currentSeason &&
      1 === currentEpisode &&
      ((currentSeason = e.currentSeason), (currentEpisode = e.currentEpisode)),
    updateSeasonLabel(),
    generateEpisodesGrid());
}
function showSerieSeasonModal() {
  serieSeasonModal.classList.add("show"), renderSerieSeasons();
}
function hideSerieSeasonModal() {
  serieSeasonModal.classList.remove("show");
}
function renderSerieSeasons() {
  (serieSeasonList.innerHTML = ""),
    Object.keys(window.SERIE_DATA.seasonsData).forEach((e) => {
      var t = window.SERIE_DATA.seasonsData[e],
        o = document.createElement("button");
      (o.className =
        "serie-season-option " + (currentSeason == e ? "active" : "")),
        (o.textContent = t.name),
        o.addEventListener("click", () => {
          (currentSeason = parseInt(e)),
            updateSeasonLabel(),
            generateEpisodesGrid(),
            hideSerieSeasonModal();
        }),
        serieSeasonList.appendChild(o);
    }),
    scrollToActiveSeason(serieSeasonList);
}
function playEpisode(e, t, o = !0) {
  (playingSeason = e),
    (playingEpisode = t),
    (currentSeason = e),
    (currentEpisode = t);
  var n = window.SERIE_DATA.episodesData[e][t - 1],
    a = SerieStorage.selectBestLanguage(n.languages);
  (selectedLanguage = a.language),
    (currentLanguage = a.language),
    a.fallbackUsed &&
      o &&
      console.log(
        `Idioma preferido "${a.preferredLanguage}" no disponible. Usando "${a.language}" como alternativa.`
      );
  const s = n.languages[selectedLanguage].videoUrl;
  (episodeTitle.textContent = `T${e}:E${t} - ` + n.title),
    (video.poster = n.thumbnail),
    updateCastButton(),
    updateLanguageButton(),
    (loadingScreen.style.display = "flex"),
    loadingScreen.classList.remove("hide"),
    (isVideoReady = !1),
    (playerModal.style.display = "block"),
    playerModal.classList.add("active"),
    document.body.classList.add("player-active"),
    (document.body.style.overflow = "hidden"),
    (document.body.style.height = "100vh"),
    hideControls(),
    (video.loop = !1),
    (video.autoplay = !1),
    video.removeAttribute("loop"),
    video.removeAttribute("autoplay"),
    loadHLS()
      .then((o) => {
        var n = s.includes(".m3u8") || s.includes("m3u8");
        n && o.isSupported()
          ? (hls && hls.destroy(),
            (hls = new o({
              autoStartLoad: !0,
              startPosition: -1,
              capLevelToPlayerSize: !1,
              debug: !1,
              liveDurationInfinity: !1,
              backBufferLength: 30,
              maxBufferLength: 30,
              maxMaxBufferLength: 60,
              enableWorker: !0,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: 1 / 0,
            })).loadSource(s),
            hls.attachMedia(video),
            setVideoCompletedState(!1),
            (video.loop = !1),
            video.removeAttribute("loop"),
            video.removeAttribute("autoplay"),
            hls.on(o.Events.MANIFEST_PARSED, function () {
              (isVideoReady = !0),
                restoreVideoControls(),
                (video.loop = !1),
                video.removeAttribute("loop"),
                video.removeAttribute("autoplay");
              var o = SerieStorage.getEpisodeProgress(e, t);
              o && 30 < o.currentTime && (video.currentTime = o.currentTime),
                console.log(
                  "HLS: Video listo, esperando interacción del usuario"
                ),
                (hasUserInteracted = !1),
                showControls(),
                updateNextEpisodeButton();
            }),
            hls.on(o.Events.ERROR, function (e, t) {
              console.error("HLS Error:", t),
                (t.fatal ||
                  (t.type === o.ErrorTypes.NETWORK_ERROR &&
                    t.details === o.ErrorDetails.MANIFEST_LOAD_ERROR)) &&
                  showVideoError(
                    "Error al cargar el video",
                    t.type === o.ErrorTypes.NETWORK_ERROR
                  );
            }))
          : n && video.canPlayType("application/vnd.apple.mpegurl")
          ? ((video.src = s),
            video.addEventListener("loadedmetadata", () => {
              (isVideoReady = !0), restoreVideoControls();
              var o = SerieStorage.getEpisodeProgress(e, t);
              o && 30 < o.currentTime && (video.currentTime = o.currentTime),
                console.log(
                  "Safari HLS: Video listo, esperando interacción del usuario"
                ),
                (hasUserInteracted = !1),
                showControls();
            }))
          : ((video.src = s),
            setVideoCompletedState(!1),
            (video.loop = !1),
            video.removeAttribute("loop"),
            video.removeAttribute("autoplay"),
            video.addEventListener("loadedmetadata", () => {
              (isVideoReady = !0), restoreVideoControls();
              var o = SerieStorage.getEpisodeProgress(e, t);
              o && 30 < o.currentTime && (video.currentTime = o.currentTime),
                console.log(
                  "Video nativo: Video listo, esperando interacción del usuario"
                ),
                (hasUserInteracted = !1),
                showControls(),
                updateNextEpisodeButton();
            }),
            video.addEventListener("error", (e) => {
              console.error("Video Error:", e),
                showVideoError("Error al cargar el video");
            }));
      })
      .catch((e) => {
        console.error("Failed to load HLS:", e),
          showVideoError("Error al cargar el reproductor", !1);
      }),
    updateNextEpisodeButton(),
    o &&
      (((a = SerieStorage.getWatchedData()).currentSeason = e),
      (a.currentEpisode = t),
      (a.lastWatched = Date.now()),
      a.watchedEpisodes[(o = `s${e}e` + t)] &&
        (a.watchedEpisodes[o].lastWatched = Date.now()),
      SerieStorage.saveWatchedData(a),
      a.watchedEpisodes[o] &&
        ((n = {
          serieId: window.SERIE_ID,
          serieTitle: window.SERIE_DATA.title,
          seriePoster: window.SERIE_DATA.poster,
          serieBackgroundImage: window.SERIE_DATA.heroImage,
          season: e,
          episode: t,
          episodeTitle: n.title,
          episodeThumbnail: n.thumbnail,
          episodeDuration: n.duration,
          currentTime: a.watchedEpisodes[o].currentTime || 0,
          progress: a.watchedEpisodes[o].progress || 0,
          lastWatched: Date.now(),
        }),
        SerieStorage.updateContinueWatching(window.SERIE_ID, n)),
      (window.location.href = "go:" + window.SERIE_ID));
}
function hideLoader() {
  loadingScreen.classList.add("hide"),
    (loadingScreen.style.display = "none"),
    (isVideoReady = !0),
    restoreVideoControls(),
    showControls(!1);
}
function showControls(e = !0) {
  isVideoReady &&
    (controls.classList.remove("hide"),
    (controlsVisible = !0),
    clearTimeout(controlsTimeout),
    !e ||
      !hasUserInteracted ||
      isLanguageOverlayOpen ||
      isEpisodesOverlayOpen ||
      isSeasonOverlayOpen ||
      (controlsTimeout = setTimeout(() => {
        controls.classList.add("hide"), (controlsVisible = !1);
      }, 3e3)));
}
function hideControls() {
  controls.classList.add("hide"),
    (controlsVisible = !1),
    clearTimeout(controlsTimeout);
}
function markUserInteraction() {
  hasUserInteracted = !0;
}
function getNextEpisodeInfo() {
  var e = window.SERIE_DATA.seasonsData[currentSeason],
    t = window.SERIE_DATA.seasons;
  return currentEpisode < e.episodes
    ? { season: currentSeason, episode: currentEpisode + 1, isNewSeason: !1 }
    : currentSeason < t
    ? { season: currentSeason + 1, episode: 1, isNewSeason: !0 }
    : null;
}
function updateNextEpisodeButton() {
  var e = getNextEpisodeInfo(),
    t = nextEpisodeBtn.querySelector(".bottom-btn-text");
  e
    ? ((nextEpisodeBtn.style.display = "flex"),
      e.isNewSeason
        ? (t.textContent = "Temporada " + e.season)
        : (t.textContent = "Siguiente"))
    : (nextEpisodeBtn.style.display = "none");
}
function updateCastButton() {
  var e;
  castBtn &&
    ((e =
      window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1]) &&
    (e = e.languages[currentLanguage]) &&
    e.cast
      ? ((castBtn.style.display = "flex"), (castBtn.href = e.cast))
      : (castBtn.style.display = "none"));
}
function updateLanguageButton() {
  var e;
  languageBtn &&
    ((e =
      window.SERIE_DATA.episodesData[currentSeason]?.[currentEpisode - 1]) &&
    1 <= Object.keys(e.languages).length
      ? (languageBtn.style.display = "flex")
      : (languageBtn.style.display = "none"));
}
function showVideoError(e = "Error al cargar el video", t = !0) {
  (playerModal.style.display = "block"),
    playerModal.classList.add("active"),
    document.body.classList.add("player-active"),
    (document.body.style.overflow = "hidden"),
    (document.body.style.height = "100vh"),
    (loadingScreen.style.display = "none"),
    loadingScreen.classList.add("hide");
  let o = document.getElementById("videoErrorOverlay");
  o ||
    (((o = document.createElement("div")).id = "videoErrorOverlay"),
    (o.style.cssText =
      "\n      position: absolute;\n      top: 0;\n      left: 0;\n      width: 100%;\n      height: 100%;\n      background: rgba(0, 0, 0, 0.4);\n      display: flex;\n      align-items: center;\n      justify-content: center;\n      z-index: 5;\n      color: white;\n      font-size: 18px;\n      text-align: center;\n      pointer-events: none;\n    "),
    ((n = document.querySelector("#video").parentElement).style.position =
      "relative"),
    n.appendChild(o)),
    (o.innerHTML = `<div style="text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0px 0px 8px rgba(0, 0, 0, 0.6);">${e}</div>`),
    (o.style.display = "flex"),
    (video.style.opacity = "0.3"),
    (isVideoReady = !0);
  var n = document.querySelector(".main-controls");
  (e =
    (n && (n.style.display = "none"), document.getElementById("controls"))) &&
    (e.style.zIndex = "15"),
    showControls(!1),
    clearTimeout(controlsTimeout),
    updateNextEpisodeButton(),
    updateLanguageButton(),
    t &&
      setTimeout(() => {
        var e = document.getElementById("videoErrorOverlay");
        e &&
          "flex" === e.style.display &&
          playerModal &&
          playerModal.classList.contains("active") &&
          (isLanguageOverlayOpen ||
            isEpisodesOverlayOpen ||
            isSeasonOverlayOpen ||
            (console.log("Intentando recuperar video automáticamente..."),
            playEpisode(currentSeason, currentEpisode, !1)));
      }, 5e3);
}
function restoreVideoControls() {
  var e;
  (e =
    ((e =
      ((e = document.querySelector(".main-controls")) &&
        (e.style.display = "flex"),
      document.getElementById("controls"))) && (e.style.zIndex = ""),
    (video.style.opacity = "1"),
    (loadingScreen.style.display = "none"),
    loadingScreen.classList.add("hide"),
    document.getElementById("videoErrorOverlay"))) &&
    ((e.style.display = "none"), e.remove()),
    (isVideoReady = !0);
}
function onPlayerTap(e) {
  e.preventDefault(),
    e.stopPropagation(),
    !isVideoReady ||
      e.target.closest(".control-btn") ||
      e.target.closest(".header-btn") ||
      e.target.closest(".progress-container") ||
      e.target.closest(".progress-bar") ||
      e.target.closest(".progress-thumb") ||
      e.target.closest(".bottom-btn") ||
      (markUserInteraction(),
      attemptFullscreen(),
      (controlsVisible ? hideControls : showControls)());
}
function updatePlayPause() {
  video.paused
    ? ((playIcon.textContent = isVideoCompleted ? "replay" : "play_arrow"),
      (playIcon.style.display = ""),
      (pauseIcon.style.display = "none"))
    : ((playIcon.style.display = "none"), (pauseIcon.style.display = ""));
}
video.addEventListener("canplay", hideLoader),
  video.addEventListener("loadeddata", () => {
    2 <= video.readyState && hideLoader();
  }),
  video.addEventListener("loadedmetadata", () => {
    document.getElementById("videoErrorOverlay") &&
      0 < video.duration &&
      restoreVideoControls();
  }),
  video.addEventListener("canplaythrough", () => {
    document.getElementById("videoErrorOverlay") && restoreVideoControls();
  }),
  setInterval(() => {
    var e = document.getElementById("videoErrorOverlay");
    e &&
      "flex" === e.style.display &&
      playerModal &&
      playerModal.classList.contains("active") &&
      (isLanguageOverlayOpen ||
        isEpisodesOverlayOpen ||
        isSeasonOverlayOpen ||
        (3 <= video.readyState &&
          0 < video.duration &&
          (console.log("Video recuperado, limpiando overlay de error"),
          restoreVideoControls())));
  }, 2e3),
  document
    .getElementById("playerContainer")
    .addEventListener("click", onPlayerTap),
  playPauseBtn.addEventListener("click", (e) => {
    if ((e.stopPropagation(), controlsVisible))
      if ((markUserInteraction(), attemptFullscreen(), video.paused)) {
        if (isVideoCompleted)
          return (
            (video.currentTime = 0),
            setVideoCompletedState(!1),
            video.play(),
            void showControls()
          );
        video.play();
      } else video.pause();
    else markUserInteraction();
    showControls();
  }),
  video.addEventListener("play", updatePlayPause),
  video.addEventListener("pause", updatePlayPause);
let isVideoCompleted = !1;
function setVideoCompletedState(e) {
  (isVideoCompleted = e), (window.isVideoCompleted = e), updatePlayPause();
}
function showLanguageOverlay() {
  (currentTime = video.currentTime),
    (isLanguageOverlayOpen = !0),
    languageOverlay.classList.add("show"),
    (selectedLanguage = currentLanguage),
    generateLanguageOptions(),
    updateLanguageSelection(),
    showControls(!1);
}
function generateLanguageOptions() {
  const e = document.querySelector(".language-options");
  if (e) {
    e.innerHTML = "";
    const t =
      window.SERIE_DATA.episodesData[currentSeason][currentEpisode - 1]
        .languages;
    Object.keys(t).forEach((o) => {
      var n = t[o],
        a = document.createElement("button");
      (a.className = "language-option"),
        a.setAttribute("data-language", o),
        (a.innerHTML = `\n      <span>${n.name}</span>\n      <span class="checkmark material-symbols-outlined">check</span>\n    `),
        a.addEventListener("click", (e) => {
          e.stopPropagation(),
            (selectedLanguage = o),
            updateLanguageSelection();
        }),
        e.appendChild(a);
    });
  }
}
function hideLanguageOverlay() {
  languageOverlay.classList.remove("show"),
    showControls(!(isLanguageOverlayOpen = !1));
}
function updateLanguageSelection() {
  document.querySelectorAll(".language-option").forEach((e) => {
    e.dataset.language === selectedLanguage
      ? e.classList.add("active")
      : e.classList.remove("active");
  });
}
function changeVideoLanguage(e) {
  if (e !== currentLanguage) {
    SerieStorage.saveLanguagePreference(e);
    const n = currentLanguage,
      a = video.currentTime,
      s =
        (0 < video.currentTime &&
          0 < video.duration &&
          SerieStorage.updateEpisodeProgress(
            playingSeason,
            playingEpisode,
            video.currentTime,
            video.duration
          ),
        (loadingScreen.style.display = "flex"),
        loadingScreen.classList.remove("hide"),
        (loadingScreen.innerHTML =
          '\n    <span class="loader"></span>\n    <div class="loading-text">Cambiando idioma...</div>\n  '),
        (isVideoReady = !1),
        window.SERIE_DATA.episodesData[currentSeason][currentEpisode - 1]);
    if (s.languages[e]) {
      const i = s.languages[e].videoUrl;
      function t() {
        setTimeout(() => {
          video.duration && a < video.duration && (video.currentTime = a),
            (currentLanguage = e),
            (selectedLanguage = e),
            updateCastButton(),
            (isVideoReady = !0),
            restoreVideoControls(),
            showControls(),
            setTimeout(() => {
              video.paused &&
                !isVideoCompleted &&
                (console.log("Autoplay después de cambio de idioma"),
                video.play().catch((e) => {
                  console.log("Error en autoplay post-idioma:", e);
                }));
            }, 200);
        }, 500);
      }
      function o() {
        console.error(
          "Error al cambiar idioma, revirtiendo al idioma anterior"
        ),
          (currentLanguage = n),
          (selectedLanguage = n);
        const e = s.languages[n].videoUrl;
        loadHLS()
          .then((o) => {
            var n = e.includes(".m3u8") || e.includes("m3u8");
            n && o.isSupported() && hls
              ? (hls.destroy(),
                (hls = new o({
                  autoStartLoad: !0,
                  startPosition: -1,
                  capLevelToPlayerSize: !1,
                  debug: !1,
                  liveDurationInfinity: !1,
                  backBufferLength: 30,
                  maxBufferLength: 30,
                  maxMaxBufferLength: 60,
                  enableWorker: !0,
                  liveSyncDurationCount: 3,
                  liveMaxLatencyDurationCount: 1 / 0,
                })).on(o.Events.MANIFEST_PARSED, t),
                hls.loadSource(e),
                hls.attachMedia(video))
              : (n && video.canPlayType("application/vnd.apple.mpegurl"),
                (video.src = e),
                video.addEventListener("loadedmetadata", t, { once: !0 }));
          })
          .catch(() => {
            showVideoError("Error al cargar idioma", !1);
          });
      }
      (video.loop = !1),
        (video.autoplay = !1),
        loadHLS()
          .then((e) => {
            var n = i.includes(".m3u8") || i.includes("m3u8");
            if (n && e.isSupported() && hls) {
              hls.destroy(),
                (hls = new e({
                  autoStartLoad: !0,
                  startPosition: -1,
                  capLevelToPlayerSize: !1,
                  debug: !1,
                  liveDurationInfinity: !1,
                  backBufferLength: 30,
                  maxBufferLength: 30,
                  maxMaxBufferLength: 60,
                  enableWorker: !0,
                  liveSyncDurationCount: 3,
                  liveMaxLatencyDurationCount: 1 / 0,
                }));
              let s = !1,
                r = !1;
              hls.on(e.Events.MANIFEST_PARSED, function () {
                s || ((s = !0), t());
              }),
                hls.on(e.Events.ERROR, function (n, a) {
                  r ||
                    ((r = !0),
                    console.error("HLS Error al cambiar idioma:", a),
                    a.fatal ||
                    (a.type === e.ErrorTypes.NETWORK_ERROR &&
                      a.details === e.ErrorDetails.MANIFEST_LOAD_ERROR)
                      ? o()
                      : setTimeout(() => {
                          2 <= video.readyState && t();
                        }, 3e3));
                }),
                hls.loadSource(i),
                hls.attachMedia(video);
            } else {
              if (n && video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = i;
                let d = !1;
                function a() {
                  d ||
                    ((d = !0),
                    video.removeEventListener("loadedmetadata", a),
                    t());
                }
              } else {
                video.src = i;
                let l = !1;
                function a() {
                  l ||
                    ((l = !0),
                    video.removeEventListener("loadedmetadata", a),
                    t());
                }
              }
              video.addEventListener("loadedmetadata", a),
                video.addEventListener("error", function e() {
                  video.removeEventListener("error", e),
                    video.removeEventListener("loadedmetadata", a),
                    o();
                });
            }
          })
          .catch((e) => {
            console.error("Failed to load HLS for language change:", e), o();
          });
    } else
      (loadingScreen.innerHTML =
        '\n      <span class="loader"></span>\n      <div class="loading-text">Idioma no disponible</div>\n    '),
        setTimeout(() => {
          (loadingScreen.style.display = "none"),
            loadingScreen.classList.add("hide"),
            (isVideoReady = !0),
            showControls();
        }, 2e3);
  }
}
function showEpisodesOverlay() {
  (isEpisodesOverlayOpen = !0),
    episodesOverlay.classList.add("show"),
    hideControls(),
    updateCurrentSeason(),
    renderEpisodes();
}
function hideEpisodesOverlay() {
  episodesOverlay.classList.remove("show"),
    (isEpisodesOverlayOpen = !1),
    episodesScroll && (episodesScroll.innerHTML = ""),
    seasonOverlay.classList.contains("show") && hideSeasonOverlay(),
    showControls(!0);
}
function showSeasonOverlay() {
  (isSeasonOverlayOpen = !0),
    seasonOverlay.classList.add("show"),
    renderSeasons();
}
function hideSeasonOverlay() {
  seasonOverlay.classList.remove("show"), (isSeasonOverlayOpen = !1);
}
function updateCurrentSeason() {
  currentSeasonText.textContent =
    window.SERIE_DATA.seasonsData[currentSeason].name;
}
function renderEpisodes() {
  var e = window.SERIE_DATA.episodesData[currentSeason] || [];
  (episodesScroll.innerHTML = ""),
    e.forEach((e) => {
      var t = document.createElement("div");
      (t.className = "episode-card"),
        e.number === currentEpisode && t.classList.add("current-episode"),
        (t.innerHTML = `\n          <div class="episode-thumbnail">\n            <img src="${e.thumbnail}" alt="Episodio ${e.number}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE2OCIgdmlld0JveD0iMCAwIDMwMCAxNjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMTY4IiBmaWxsPSIjMzMzIi8+CjxyZWN0IHg9IjEyNSIgeT0iNjkiIHdpZHRoPSI1MCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzU1NSIvPgo8L3N2Zz4K'">\n            <div class="episode-play-overlay">\n              <span class="material-symbols-outlined">play_arrow</span>\n            </div>\n            <div class="episode-progress-bar" data-season="${currentSeason}" data-episode="${e.number}">\n              <div class="episode-progress-fill"></div>\n            </div>\n          </div>\n          <div class="episode-info">\n            <div class="episode-number">Episodio ${e.number}</div>\n            <div class="season-episode-title">${e.title}</div>\n          </div>\n        `),
        t.addEventListener("click", () => {
          hideEpisodesOverlay(),
            playEpisode(currentSeason, e.number),
            updateNextEpisodeButton();
        }),
        episodesScroll.appendChild(t);
    }),
    updateEpisodesProgress(),
    scrollToCurrentEpisode();
}
function updateEpisodesProgress() {
  document.querySelectorAll(".episode-progress-bar").forEach((e) => {
    var t = parseInt(e.getAttribute("data-season")),
      o = parseInt(e.getAttribute("data-episode"));
    e = e.querySelector(".episode-progress-fill");
    (t = SerieStorage.getWatchedData().watchedEpisodes[`s${t}e` + o]) &&
    0 < t.duration
      ? ((o = (t.currentTime / t.duration) * 100),
        (e.style.width = Math.min(o, 100) + "%"))
      : (e.style.width = "0%");
  });
}
function getLastWatchedEpisodeForSeason(e) {
  const t = SerieStorage.getWatchedData();
  let o = 1,
    n = 0;
  return (
    Object.keys(t.watchedEpisodes).forEach((a) => {
      var s,
        i = a.match(/^s(\d+)e(\d+)$/);
      i &&
        ((s = parseInt(i[1])),
        (i = parseInt(i[2])),
        (a = t.watchedEpisodes[a]),
        s === e) &&
        a.lastWatched &&
        5 < a.progress &&
        a.lastWatched > n &&
        ((n = a.lastWatched), (o = i));
    }),
    o
  );
}
function scrollToCurrentEpisode() {
  setTimeout(() => {
    var e = document.querySelectorAll(".episode-card");
    let t;
    var o = SerieStorage.getWatchedData();
    (e =
      e[
        (t =
          currentSeason === (o.currentSeason || 1)
            ? currentEpisode
            : getLastWatchedEpisodeForSeason(currentSeason)) - 1
      ]) &&
      episodesScroll &&
      ((o = e.offsetWidth),
      (e = e.offsetLeft - episodesScroll.offsetWidth / 2 + o / 2),
      episodesScroll.scrollTo({ left: Math.max(0, e), behavior: "smooth" }));
  }, 100);
}
function scrollToActiveSeason(e) {
  setTimeout(() => {
    var t,
      o,
      n = e.querySelector(".active, .serie-season-option.active");
    n &&
      e &&
      ((t = n.offsetHeight),
      (o = e.offsetHeight),
      e.scrollTo({
        top: Math.max(0, n.offsetTop - o / 2 + t / 2),
        behavior: "smooth",
      }));
  }, 100);
}
function renderSeasons() {
  seasonList &&
    ((seasonList.innerHTML = ""),
    Object.keys(window.SERIE_DATA.seasonsData).forEach((e) => {
      var t = window.SERIE_DATA.seasonsData[e],
        o = document.createElement("div");
      (o.className = "season-option " + (currentSeason == e ? "active" : "")),
        (o.textContent = t.name),
        o.addEventListener("click", () => {
          (currentSeason = parseInt(e)),
            hideSeasonOverlay(),
            updateCurrentSeason(),
            renderEpisodes();
        }),
        seasonList.appendChild(o);
    }),
    scrollToActiveSeason(seasonList));
}
function toggleFullscreen() {
  document.fullscreenElement
    ? document.exitFullscreen().then(() => {
        fullscreenIcon.textContent = "fullscreen";
      })
    : enterFullscreen().then(() => {
        fullscreenIcon.textContent = "fullscreen_exit";
      });
}
function formatTime(e) {
  return (
    (e = Math.floor(e)),
    Math.floor(e / 60) + ":" + (e % 60).toString().padStart(2, "0")
  );
}
video.addEventListener("ended", () => {
  setVideoCompletedState(!0),
    video.pause(),
    (video.loop = !1),
    video.removeAttribute("loop"),
    video.removeAttribute("autoplay"),
    (video.currentTime = video.duration),
    updatePlayPause(),
    showControls(!1),
    setTimeout(() => {
      video.pause(),
        (video.loop = !1),
        (video.currentTime = video.duration),
        updatePlayPause();
    }, 50),
    setTimeout(() => {
      video.paused ||
        (video.pause(),
        (video.currentTime = video.duration),
        updatePlayPause());
    }, 200),
    setTimeout(() => {
      video.paused ||
        (video.pause(),
        (video.currentTime = video.duration),
        updatePlayPause());
    }, 500),
    playingEpisode &&
      playingSeason &&
      video.duration &&
      SerieStorage.updateEpisodeProgress(
        playingSeason,
        playingEpisode,
        video.duration,
        video.duration
      );
}),
  video.addEventListener("play", () => {
    if (isVideoCompleted && video.currentTime >= video.duration - 0.5)
      return (
        console.log("Event interceptor: pausando video completado"),
        video.pause(),
        (video.currentTime = video.duration),
        updatePlayPause(),
        !1
      );
  }),
  video.addEventListener("timeupdate", () => {
    isVideoCompleted &&
      video.currentTime < video.duration &&
      (video.paused ||
        (video.pause(),
        (video.currentTime = video.duration),
        updatePlayPause())),
      0 < video.duration &&
        video.currentTime >= video.duration - 0.1 &&
        (isVideoCompleted || setVideoCompletedState(!0),
        video.paused || (video.pause(), updatePlayPause()));
  }),
  setInterval(() => {
    isVideoCompleted &&
      !video.paused &&
      video.currentTime >= video.duration - 1 &&
      (console.log("Monitor: pausando video completado"),
      video.pause(),
      (video.currentTime = video.duration),
      updatePlayPause());
  }, 2e3),
  video.addEventListener("seeking", () => {
    isVideoCompleted &&
      video.currentTime < video.duration - 2 &&
      setVideoCompletedState(!1);
  }),
  video.addEventListener("seeked", () => {
    video.currentTime >= video.duration - 0.1 &&
      !video.paused &&
      (video.pause(), setVideoCompletedState(!0), updatePlayPause());
  }),
  rewindBtn.addEventListener("click", (e) => {
    e.stopPropagation(),
      controlsVisible
        ? (markUserInteraction(),
          (video.currentTime = Math.max(0, video.currentTime - 10)))
        : markUserInteraction(),
      showControls();
  }),
  forwardBtn.addEventListener("click", (e) => {
    e.stopPropagation(),
      controlsVisible
        ? (markUserInteraction(),
          (video.currentTime = Math.min(
            video.duration,
            video.currentTime + 10
          )))
        : markUserInteraction(),
      showControls();
  }),
  episodesBtn.addEventListener("click", (e) => {
    e.stopPropagation(), markUserInteraction(), showEpisodesOverlay();
  }),
  languageBtn.addEventListener("click", (e) => {
    e.stopPropagation(),
      markUserInteraction(),
      showLanguageOverlay(),
      showControls();
  }),
  languageCancel.addEventListener("click", (e) => {
    e.stopPropagation(), hideLanguageOverlay();
  }),
  languageAccept.addEventListener("click", (e) => {
    e.stopPropagation(),
      changeVideoLanguage(selectedLanguage),
      hideLanguageOverlay();
  }),
  languageOverlay.addEventListener("click", (e) => {
    e.target === languageOverlay && hideLanguageOverlay();
  }),
  episodesBackBtn.addEventListener("click", (e) => {
    e.stopPropagation(), hideEpisodesOverlay();
  }),
  seasonSelector.addEventListener("click", (e) => {
    e.stopPropagation(), showSeasonOverlay();
  }),
  seasonCloseBtn.addEventListener("click", (e) => {
    e.stopPropagation(), hideSeasonOverlay();
  }),
  seasonOverlay.addEventListener("click", (e) => {
    e.target === seasonOverlay && hideSeasonOverlay();
  }),
  nextEpisodeBtn.addEventListener("click", (e) => {
    e.stopPropagation(),
      markUserInteraction(),
      (e = getNextEpisodeInfo()) && playEpisode(e.season, e.episode),
      showControls();
  }),
  fullscreenBtn.addEventListener("click", (e) => {
    e.stopPropagation(),
      markUserInteraction(),
      toggleFullscreen(),
      showControls();
  }),
  castBtn &&
    castBtn.addEventListener("click", (e) => {
      e.stopPropagation(), markUserInteraction(), showControls();
    }),
  document.addEventListener("fullscreenchange", () => {
    document.fullscreenElement
      ? (fullscreenIcon.textContent = "fullscreen_exit")
      : (fullscreenIcon.textContent = "fullscreen");
  }),
  video.addEventListener("timeupdate", () => {
    if (!isDragging || null === dragPercent) {
      if (
        0 < video.duration &&
        0 < video.currentTime &&
        video.duration - video.currentTime <= 0.2 &&
        !video.paused
      )
        return (
          console.log("TimeUpdate: pausando video cerca del final"),
          video.pause(),
          (video.currentTime = video.duration),
          setVideoCompletedState(!0),
          updatePlayPause(),
          showControls(!1),
          void (
            playingEpisode &&
            playingSeason &&
            video.duration &&
            SerieStorage.updateEpisodeProgress(
              playingSeason,
              playingEpisode,
              video.duration,
              video.duration
            )
          )
        );
      var e = video.currentTime / video.duration;
      (progress.style.width = 100 * e + "%"),
        (progressThumb.style.left = 100 * e + "%"),
        (currentTimeEl.textContent = formatTime(video.currentTime)),
        updateEpisodesProgress(),
        video.currentTime % 10 < 0.5 &&
          0 < video.currentTime &&
          video.currentTime < video.duration - 2 &&
          SerieStorage.updateEpisodeProgress(
            playingSeason,
            playingEpisode,
            video.currentTime,
            video.duration
          );
    }
  }),
  video.addEventListener("durationchange", () => {
    durationEl.textContent = formatTime(video.duration);
  }),
  progressBar.addEventListener("click", (e) => {
    e.stopPropagation(), markUserInteraction();
    var t = document.getElementById("videoErrorOverlay");
    (t && "flex" === t.style.display) ||
      !video.duration ||
      isNaN(video.duration) ||
      video.duration <= 0 ||
      ((t = progressBar.getBoundingClientRect()),
      (e = (e.touches ? e.touches[0] : e).clientX),
      (e = Math.max(0, Math.min(1, (e - t.left) / t.width))),
      (progress.style.width = 100 * e + "%"),
      (progressThumb.style.left = 100 * e + "%"),
      (currentTimeEl.textContent = formatTime(e * video.duration)),
      (t = e * video.duration),
      !isNaN(t) && 0 <= t && t <= video.duration && (video.currentTime = t),
      showControls(!0));
  });
const progressThumb = document.getElementById("progressThumb");
let isDragging = !1,
  dragPercent = null;
function updateSliderUI(e, t) {
  (progress.style.width = 100 * e + "%"),
    (progressThumb.style.left = 100 * e + "%"),
    t && !isNaN(t) && 0 < t
      ? ((e *= t),
        !isNaN(e) && 0 <= e && (currentTimeEl.textContent = formatTime(e)))
      : (currentTimeEl.textContent = "0:00");
}
function seekToClientX(e, t = !1) {
  var o = document.getElementById("videoErrorOverlay");
  (o && "flex" === o.style.display) ||
    !video.duration ||
    isNaN(video.duration) ||
    video.duration <= 0 ||
    ((o = progressBar.getBoundingClientRect()),
    (e = Math.max(0, Math.min(1, (e - o.left) / o.width))),
    updateSliderUI((dragPercent = e), video.duration),
    t) ||
    ((o = e * video.duration),
    !isNaN(o) && 0 <= o && o <= video.duration && (video.currentTime = o));
}
progressThumb.addEventListener("mousedown", (e) => {
  e.stopPropagation(),
    markUserInteraction(),
    ((e = document.getElementById("videoErrorOverlay")) &&
      "flex" === e.style.display) ||
      !video.duration ||
      isNaN(video.duration) ||
      video.duration <= 0 ||
      (showControls(!(isDragging = !0)),
      (document.body.style.userSelect = "none"));
}),
  document.addEventListener("mousemove", (e) => {
    isDragging && (seekToClientX(e.clientX, !0), showControls(!1));
  }),
  document.addEventListener("mouseup", (e) => {
    isDragging &&
      (seekToClientX(e.clientX, !1),
      (isDragging = !1),
      (dragPercent = null),
      showControls(!(document.body.style.userSelect = "")));
  }),
  progressThumb.addEventListener("touchstart", (e) => {
    e.stopPropagation(),
      e.preventDefault(),
      markUserInteraction(),
      ((e = document.getElementById("videoErrorOverlay")) &&
        "flex" === e.style.display) ||
        !video.duration ||
        isNaN(video.duration) ||
        video.duration <= 0 ||
        (showControls(!(isDragging = !0)),
        (document.body.style.userSelect = "none"));
  }),
  document.addEventListener("touchmove", (e) => {
    isDragging &&
      e.touches &&
      e.touches.length &&
      (e.preventDefault(),
      seekToClientX(e.touches[0].clientX, !0),
      showControls(!1));
  }),
  document.addEventListener("touchend", (e) => {
    isDragging &&
      (e.changedTouches &&
        e.changedTouches.length &&
        seekToClientX(e.changedTouches[0].clientX, !1),
      (isDragging = !1),
      (dragPercent = null),
      showControls(!(document.body.style.userSelect = "")));
  }),
  video.addEventListener("loadedmetadata", () => {
    (durationEl.textContent = formatTime(video.duration)),
      (currentTimeEl.textContent = formatTime(video.currentTime));
  });
let fullscreenAttempted = !1;
function enterFullscreen() {
  var e = document.getElementById("playerContainer");
  return e.requestFullscreen
    ? e.requestFullscreen().catch(() => {})
    : e.webkitRequestFullscreen
    ? e.webkitRequestFullscreen()
    : e.mozRequestFullScreen
    ? e.mozRequestFullScreen()
    : e.msRequestFullscreen
    ? e.msRequestFullscreen()
    : Promise.resolve();
}
function attemptFullscreen() {
  fullscreenAttempted || ((fullscreenAttempted = !0), enterFullscreen());
}
function cleanupPlayerState() {
  playerModal.classList.remove("active"),
    (playerModal.style.display = "none"),
    document.body.classList.remove("player-active"),
    (document.body.style.overflow = ""),
    (document.body.style.height = ""),
    video.pause(),
    updateMainPageProgress();
}
function updateMainPageProgress() {
  generateEpisodesGrid(),
    setTimeout(() => {
      updatePlayButton();
    }, 100),
    updateSeasonLabel();
}
function forceScrollRestore() {
  document.body.classList.remove("player-active"),
    (document.body.style.overflow = ""),
    (document.body.style.height = ""),
    (document.body.style.position = ""),
    document.body.offsetHeight;
}
function handleBackButtonAction() {
  video.currentTime &&
    video.duration &&
    SerieStorage.updateEpisodeProgress(
      playingSeason,
      playingEpisode,
      video.currentTime,
      video.duration
    ),
    cleanupPlayerState();
}
function initializeSynopsis() {
  const e = document.getElementById("synopsisText"),
    t = document.getElementById("readMoreBtn");
  if (e && t) {
    const o = window.SERIE_DATA.synopsis.short,
      n = window.SERIE_DATA.synopsis.full;
    (e.textContent = o),
      t.addEventListener("click", () => {
        e.classList.contains("expanded")
          ? (e.classList.remove("expanded"),
            (e.textContent = o),
            (t.textContent = "Leer más"))
          : (e.classList.add("expanded"),
            (e.textContent = n),
            (t.textContent = "Leer menos"));
      });
  }
}
function handleEscapeAction() {
  video.currentTime &&
    video.duration &&
    SerieStorage.updateEpisodeProgress(
      playingSeason,
      playingEpisode,
      video.currentTime,
      video.duration
    ),
    cleanupPlayerState();
}
(isVideoReady ? showControls : hideControls)(),
  updatePlayPause(),
  playFirstEpisode.addEventListener("click", () => {
    playEpisode(currentSeason, currentEpisode), updateNextEpisodeButton();
  }),
  seasonSelectorBtn.addEventListener("click", () => {
    showSerieSeasonModal();
  }),
  serieSeasonCloseBtn.addEventListener("click", () => {
    hideSerieSeasonModal();
  }),
  serieSeasonModal.addEventListener("click", (e) => {
    e.target === serieSeasonModal && hideSerieSeasonModal();
  }),
  backBtn.addEventListener("click", () => {
    document.fullscreenElement
      ? document
          .exitFullscreen()
          .then(() => {
            handleBackButtonAction();
          })
          .catch(() => {
            handleBackButtonAction();
          })
      : handleBackButtonAction();
  }),
  setInterval(() => {
    playerModal.classList.contains("active") &&
      video.currentTime &&
      video.duration &&
      (SerieStorage.updateEpisodeProgress(
        playingSeason,
        playingEpisode,
        video.currentTime,
        video.duration
      ),
      playerModal.classList.contains("active") || updatePlayButton());
  }, 3e4),
  initializeSeriePage(),
  initializeSynopsis(),
  updateNextEpisodeButton(),
  window.addEventListener("beforeunload", () => {
    cleanupPlayerState();
  }),
  document.addEventListener("keydown", (e) => {
    "Escape" === e.key &&
      playerModal.classList.contains("active") &&
      (document.fullscreenElement
        ? document
            .exitFullscreen()
            .then(() => {
              handleEscapeAction();
            })
            .catch(() => {
              handleEscapeAction();
            })
        : handleEscapeAction());
  }),
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.remove("player-active"),
      (document.body.style.overflow = ""),
      (document.body.style.height = "");
  }),
  document.addEventListener("visibilitychange", () => {
    document.hidden ||
      playerModal.classList.contains("active") ||
      forceScrollRestore();
  });
class MyListStorage {
  static getMyList() {
    var e = localStorage.getItem("myList");
    return e ? JSON.parse(e) : [];
  }
  static saveMyList(e) {
    try {
      localStorage.setItem("myList", JSON.stringify(e));
    } catch (e) {
      console.error("Error al guardar mi lista:", e);
    }
  }
  static addToList(e) {
    var t = this.getMyList();
    return (
      !t.find((t) => t.id === e.id) &&
      (t.push({
        id: e.id,
        title: e.title,
        poster: e.poster,
        heroImage: e.heroImage,
        addedAt: Date.now(),
      }),
      this.saveMyList(t),
      !0)
    );
  }
  static removeFromList(e) {
    var t = this.getMyList(),
      o = t.filter((t) => t.id !== e);
    return this.saveMyList(o), o.length !== t.length;
  }
  static isInList(e) {
    return this.getMyList().some((t) => t.id === e);
  }
}
function initializeAddToListButton() {
  const e = document.getElementById("addToListBtn");
  if (e) {
    const t = e.dataset.serieId;
    updateAddToListButton(),
      e.addEventListener("click", () => {
        var o;
        MyListStorage.isInList(t)
          ? MyListStorage.removeFromList(t)
          : ((o = {
              id: e.dataset.serieId,
              title: e.dataset.title,
              poster: e.dataset.poster || "",
              heroImage: e.dataset.heroImage,
            }),
            MyListStorage.addToList(o)),
          updateAddToListButton();
      });
  }
}
function updateAddToListButton() {
  var e,
    t = document.getElementById("addToListBtn");
  t &&
    ((e = t.dataset.serieId),
    MyListStorage.isInList(e)
      ? t.classList.add("in-list")
      : t.classList.remove("in-list"));
}
function changeLanguage() {
  showLanguageOverlay();
}
function closePlayer() {
  handleEscapeAction(),
    playerModal.classList.remove("active"),
    (playerModal.style.display = "none"),
    document.body.classList.remove("player-active"),
    (document.body.style.overflow = ""),
    (document.body.style.height = "");
}
initializeAddToListButton();
