import "./styles.css";
import {
  STATUS_FILTERS,
  TOPIC_FILTERS,
  countCatalog,
  filterCatalog,
  formatCountdown,
  formatDuration,
  getConferenceTimingLabel,
  getStatusLabel,
  isPlayableConference,
  sortForDisplay,
} from "./catalog";
import { loadPlayer, requestPlayerFullscreen } from "./player";

const FAVORITES_KEY = "creatix-ai-live:favorites:v3";
const SELECTED_KEY = "creatix-ai-live:selected:v3";
const CATALOG_REQUEST_TIMEOUT_MS = 30_000;
const CATALOG_RECOVERY_DELAY_MS = 8_000;
const validStatuses = new Set(STATUS_FILTERS.map((item) => item.id));
const initialStatus = new URLSearchParams(window.location.search).get("status");
let catalogRecoveryTimer = null;

const state = {
  videos: [],
  selectedId: null,
  favorites: readFavorites(),
  filters: {
    status: validStatuses.has(initialStatus) ? initialStatus : "all",
    topic: "all",
    language: "all",
    date: "all",
    source: "all",
    query: "",
  },
  mode: "verified-fallback",
  generatedAt: null,
  notice: "",
  loading: true,
  refreshing: false,
};

document.querySelector("#app").innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand-lockup" aria-label="CR3@TIX AI LIVE">
        <img class="brand-mark" src="/icons/icon.svg" alt="" width="48" height="48">
        <div>
          <p class="eyebrow">CR3@TIX</p>
          <h1>AI <span>LIVE</span></h1>
        </div>
      </div>
      <p class="brand-line">Toute l’IA en conférences, directement dans votre lecteur.</p>
      <div class="topbar-actions">
        <span id="network-state" class="network-state" role="status">
          <i aria-hidden="true"></i><span>Connexion active</span>
        </span>
        <button id="install-app" class="action-button install-button" type="button" hidden>
          <span aria-hidden="true">＋</span> Installer
        </button>
        <button id="refresh-catalog" class="action-button" type="button">
          <span class="refresh-icon" aria-hidden="true">↻</span>
          <span>Actualiser</span>
        </button>
      </div>
    </header>

    <main>
      <section class="broadcast-stage" aria-labelledby="now-playing-title">
        <div class="player-column">
          <div class="section-kicker">
            <span class="signal-bars" aria-hidden="true"><i></i><i></i><i></i></span>
            Signal principal
          </div>
          <div class="player-frame">
            <div id="video-player" class="video-player" aria-live="polite">
              <div class="player-placeholder">
                <img src="/icons/icon.svg" alt="" width="88" height="88">
                <p>Préparation du lecteur intégré…</p>
              </div>
            </div>
            <div class="player-chrome" aria-hidden="true">
              <span>CR3@TIX // INTERNAL STREAM</span>
              <span>V3.2</span>
            </div>
            <button id="fullscreen-player" class="fullscreen-button" type="button" aria-label="Afficher le lecteur en plein écran" title="Plein écran">
              ⛶
            </button>
          </div>

          <article class="now-playing" aria-live="polite">
            <div class="now-playing-main">
              <div class="now-playing-labels">
                <span id="selected-status" class="status-badge status-replay">Replay</span>
                <span id="selected-source" class="source-label">YouTube intégré</span>
              </div>
              <h2 id="now-playing-title">Sélectionnez une conférence</h2>
              <p id="selected-channel" class="selected-channel">Le catalogue se prépare.</p>
              <div id="selected-facts" class="selected-facts"></div>
            </div>
            <button id="favorite-selected" class="favorite-large" type="button" aria-label="Ajouter la conférence aux favoris" disabled>
              <span aria-hidden="true">☆</span>
            </button>
            <p id="selected-description" class="selected-description"></p>
            <div id="selected-topics" class="selected-topics" aria-label="Thèmes"></div>
          </article>
        </div>

        <aside class="signal-panel" aria-label="État du catalogue">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Radar IA</p>
              <h2>État du signal</h2>
            </div>
            <span id="catalog-mode" class="catalog-mode">Vérification</span>
          </div>
          <div class="stat-grid">
            <div class="stat-card stat-total">
              <strong id="stat-total">—</strong>
              <span>conférences</span>
            </div>
            <div class="stat-card stat-live">
              <strong id="stat-live">—</strong>
              <span>en direct</span>
            </div>
            <div class="stat-card stat-upcoming">
              <strong id="stat-upcoming">—</strong>
              <span>à venir</span>
            </div>
          </div>
          <div class="queue-heading">
            <span>Prochains signaux</span>
            <span id="queue-count">0</span>
          </div>
          <div id="signal-queue" class="signal-queue">
            <div class="queue-skeleton"></div>
            <div class="queue-skeleton"></div>
            <div class="queue-skeleton"></div>
          </div>
          <div class="inside-only-note">
            <span class="shield-mark" aria-hidden="true">◇</span>
            <div>
              <strong>Lecture interne uniquement</strong>
              <p>Les contenus non intégrables sont exclus du catalogue.</p>
            </div>
          </div>
        </aside>
      </section>

      <section id="catalogue" class="catalog-section" aria-labelledby="catalog-title">
        <div class="catalog-heading">
          <div>
            <p class="eyebrow">Bibliothèque dynamique</p>
            <h2 id="catalog-title">Conférences disponibles</h2>
          </div>
          <p id="catalog-updated" class="catalog-updated">Synchronisation en cours…</p>
        </div>

        <nav id="status-tabs" class="status-tabs" aria-label="Catégories de diffusion"></nav>

        <div class="filter-deck">
          <label class="search-field">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <span class="sr-only">Rechercher dans les conférences</span>
            <input id="catalog-search" type="search" placeholder="Titre, chaîne, thème…" autocomplete="off">
            <kbd>⌘ K</kbd>
          </label>
          <label>
            <span class="sr-only">Langue</span>
            <select id="language-filter" aria-label="Filtrer par langue">
              <option value="all">Toutes les langues</option>
              <option value="fr">Français</option>
              <option value="en">Anglais</option>
              <option value="other">Autres langues</option>
            </select>
          </label>
          <label>
            <span class="sr-only">Date</span>
            <select id="date-filter" aria-label="Filtrer par date">
              <option value="all">Toutes les dates</option>
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="90">3 derniers mois</option>
              <option value="365">12 derniers mois</option>
            </select>
          </label>
          <label>
            <span class="sr-only">Source</span>
            <select id="source-filter" aria-label="Filtrer par source">
              <option value="all">Toutes les sources</option>
              <option value="youtube">YouTube intégré</option>
              <option value="vimeo">Vimeo intégré</option>
              <option value="direct">MP4 · WebM · HLS</option>
            </select>
          </label>
        </div>

        <nav id="topic-tabs" class="topic-tabs" aria-label="Thèmes des conférences"></nav>

        <div class="results-line">
          <p><strong id="result-count">0</strong> résultats intégrables</p>
          <button id="clear-filters" class="text-button" type="button" hidden>Effacer les filtres</button>
        </div>

        <div id="catalog-grid" class="catalog-grid" aria-live="polite" aria-busy="true">
          ${Array.from({ length: 8 }, () => '<div class="catalog-skeleton"><i></i><span></span><span></span></div>').join("")}
        </div>
        <div id="empty-state" class="empty-state" hidden>
          <span aria-hidden="true">⌁</span>
          <h3>Aucun signal ne correspond</h3>
          <p>Modifiez la recherche ou retirez un filtre.</p>
          <button class="action-button" type="button">Voir tout le catalogue</button>
        </div>
      </section>
    </main>

    <footer>
      <span>CR3@TIX AI LIVE</span>
      <span>Observer · Inspirer · Évoluer</span>
      <span>V3 — lecteur intégré</span>
    </footer>

    <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
  </div>
`;

const elements = {
  player: document.querySelector("#video-player"),
  title: document.querySelector("#now-playing-title"),
  channel: document.querySelector("#selected-channel"),
  facts: document.querySelector("#selected-facts"),
  description: document.querySelector("#selected-description"),
  topics: document.querySelector("#selected-topics"),
  status: document.querySelector("#selected-status"),
  source: document.querySelector("#selected-source"),
  favoriteSelected: document.querySelector("#favorite-selected"),
  grid: document.querySelector("#catalog-grid"),
  queue: document.querySelector("#signal-queue"),
  statusTabs: document.querySelector("#status-tabs"),
  topicTabs: document.querySelector("#topic-tabs"),
  resultCount: document.querySelector("#result-count"),
  empty: document.querySelector("#empty-state"),
  clearFilters: document.querySelector("#clear-filters"),
  refresh: document.querySelector("#refresh-catalog"),
  install: document.querySelector("#install-app"),
  network: document.querySelector("#network-state"),
  updated: document.querySelector("#catalog-updated"),
  mode: document.querySelector("#catalog-mode"),
  toast: document.querySelector("#toast"),
};

function readFavorites() {
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function persistFavorites() {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 3200);
}

function createTextElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function getSelected() {
  return state.videos.find((video) => video.id === state.selectedId) || null;
}

function getSourceLabel(video) {
  const labels = {
    youtube: "YouTube intégré",
    vimeo: "Vimeo intégré",
    mp4: "Vidéo MP4",
    webm: "Vidéo WebM",
    hls: "Flux HLS",
  };
  return labels[video?.source] || "Lecteur intégré";
}

function renderStatusTabs() {
  elements.statusTabs.replaceChildren();
  STATUS_FILTERS.forEach((filter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `status-tab status-tab-${filter.id}`;
    button.dataset.status = filter.id;
    button.setAttribute("aria-pressed", String(state.filters.status === filter.id));
    const icon = createTextElement("span", "tab-icon", filter.icon);
    icon.setAttribute("aria-hidden", "true");
    button.append(icon, document.createTextNode(filter.label));

    const count =
      filter.id === "favorites"
        ? state.favorites.size
        : filter.id === "latest"
          ? filterCatalog(state.videos, { ...state.filters, status: "latest", query: "", topic: "all", language: "all", date: "all", source: "all" }, state.favorites).length
          : filter.id === "all"
            ? state.videos.length
            : state.videos.filter((video) => video.status === filter.id).length;
    button.append(createTextElement("span", "tab-count", String(count)));
    elements.statusTabs.append(button);
  });
}

function renderTopicTabs() {
  elements.topicTabs.replaceChildren();
  const topics = ["all", ...TOPIC_FILTERS];
  topics.forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.topic = topic;
    button.className = "topic-tab";
    button.setAttribute("aria-pressed", String(state.filters.topic === topic));
    button.textContent = topic === "all" ? "Tous les thèmes" : topic;
    elements.topicTabs.append(button);
  });
}

function makeFact(text, className = "") {
  const span = createTextElement("span", className, text);
  return span;
}

function renderSelected() {
  const video = getSelected();
  if (!video) return;

  const isFavorite = state.favorites.has(video.id);
  elements.title.textContent = video.title;
  elements.channel.textContent = video.channel;
  elements.description.textContent = video.description || "Conférence disponible dans le lecteur intégré.";
  elements.status.textContent = getStatusLabel(video);
  elements.status.className = `status-badge status-${video.status}`;
  elements.source.textContent = getSourceLabel(video);
  elements.favoriteSelected.disabled = false;
  elements.favoriteSelected.classList.toggle("is-favorite", isFavorite);
  elements.favoriteSelected.querySelector("span").textContent = isFavorite ? "★" : "☆";
  elements.favoriteSelected.setAttribute(
    "aria-label",
    isFavorite ? "Retirer la conférence des favoris" : "Ajouter la conférence aux favoris",
  );

  elements.facts.replaceChildren();
  if (video.status === "upcoming" && video.scheduledStart) {
    const countdown = makeFact(formatCountdown(video.scheduledStart), "countdown");
    countdown.dataset.time = video.scheduledStart;
    elements.facts.append(countdown, makeFact(getConferenceTimingLabel(video)));
  } else {
    elements.facts.append(makeFact(getConferenceTimingLabel(video)));
  }
  elements.facts.append(makeFact(formatDuration(video.durationSeconds)));
  elements.facts.append(makeFact(video.language === "fr" ? "FR" : video.language === "en" ? "EN" : "MULTI"));

  elements.topics.replaceChildren();
  (video.topics || []).slice(0, 5).forEach((topic) => {
    elements.topics.append(createTextElement("span", "selected-topic", topic));
  });
}

function createCard(video) {
  const article = document.createElement("article");
  article.className = "video-card";
  article.dataset.videoId = video.id;
  if (video.id === state.selectedId) article.classList.add("is-selected");

  const selectButton = document.createElement("button");
  selectButton.type = "button";
  selectButton.className = "video-card-select";
  selectButton.dataset.selectVideo = video.id;
  selectButton.setAttribute("aria-label", `Lire ${video.title} dans l’application`);
  if (video.id === state.selectedId) selectButton.setAttribute("aria-current", "true");

  const visual = document.createElement("span");
  visual.className = "card-visual";
  const image = document.createElement("img");
  image.src = video.thumbnail;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.src = "/icons/icon.svg";
    visual.classList.add("image-fallback");
  }, { once: true });
  const play = createTextElement("span", "card-play", "▶");
  play.setAttribute("aria-hidden", "true");
  const status = createTextElement("span", `card-status status-${video.status}`, getStatusLabel(video));
  visual.append(image, play, status);
  if (video.status === "upcoming" && video.scheduledStart) {
    const countdown = createTextElement("span", "card-countdown countdown", formatCountdown(video.scheduledStart));
    countdown.dataset.time = video.scheduledStart;
    visual.append(countdown);
  }

  const content = document.createElement("span");
  content.className = "card-content";
  const metadata = document.createElement("span");
  metadata.className = "card-metadata";
  metadata.append(
    createTextElement("span", "", video.channel),
    createTextElement("span", "", formatDuration(video.durationSeconds)),
  );
  const title = createTextElement("strong", "card-title", video.title);
  const footer = document.createElement("span");
  footer.className = "card-footer";
  footer.append(
    createTextElement(
      "span",
      "",
      getConferenceTimingLabel(video),
    ),
    createTextElement("span", "card-source", getSourceLabel(video)),
  );
  content.append(metadata, title, footer);
  selectButton.append(visual, content);

  const favorite = document.createElement("button");
  favorite.type = "button";
  favorite.className = "card-favorite";
  favorite.dataset.favoriteVideo = video.id;
  const isFavorite = state.favorites.has(video.id);
  favorite.classList.toggle("is-favorite", isFavorite);
  favorite.textContent = isFavorite ? "★" : "☆";
  favorite.setAttribute(
    "aria-label",
    isFavorite ? `Retirer ${video.title} des favoris` : `Ajouter ${video.title} aux favoris`,
  );

  article.append(selectButton, favorite);
  return article;
}

function renderCatalog() {
  const filtered = sortForDisplay(
    filterCatalog(state.videos, state.filters, state.favorites),
  );
  elements.grid.replaceChildren(...filtered.map(createCard));
  elements.grid.setAttribute("aria-busy", "false");
  elements.grid.hidden = filtered.length === 0;
  elements.empty.hidden = filtered.length !== 0;
  elements.resultCount.textContent = String(filtered.length);
  elements.clearFilters.hidden = !hasActiveFilters();
  renderStatusTabs();
  renderTopicTabs();
}

function createQueueItem(video, index) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "queue-item";
  button.dataset.selectVideo = video.id;
  button.setAttribute("aria-label", `Lire ${video.title}`);
  button.append(createTextElement("span", "queue-index", String(index + 1).padStart(2, "0")));
  const body = document.createElement("span");
  body.className = "queue-body";
  body.append(
    createTextElement("strong", "", video.title),
    createTextElement(
      "small",
      video.status === "live" ? "live-copy" : "",
      video.status === "upcoming" && video.scheduledStart
        ? formatCountdown(video.scheduledStart)
        : `${video.channel} · ${formatDuration(video.durationSeconds)}`,
    ),
  );
  button.append(body, createTextElement("span", "queue-arrow", "›"));
  return button;
}

function renderQueue() {
  const queue = sortForDisplay(state.videos)
    .filter((video) => video.id !== state.selectedId)
    .slice(0, 4);
  elements.queue.replaceChildren(...queue.map(createQueueItem));
  document.querySelector("#queue-count").textContent = String(queue.length);
}

function renderStats() {
  const counts = countCatalog(state.videos);
  document.querySelector("#stat-total").textContent = String(counts.total).padStart(2, "0");
  document.querySelector("#stat-live").textContent = String(counts.live).padStart(2, "0");
  document.querySelector("#stat-upcoming").textContent = String(counts.upcoming).padStart(2, "0");
  elements.mode.textContent = state.mode === "youtube-api" ? "Collecte automatique" : "Catalogue vérifié";
  const updatedDate = state.generatedAt ? new Date(state.generatedAt) : null;
  elements.updated.textContent = updatedDate && !Number.isNaN(updatedDate.getTime())
    ? `Vérifié le ${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(updatedDate)}`
    : "Catalogue vérifié";
}

function renderAll() {
  renderStats();
  renderSelected();
  renderQueue();
  renderCatalog();
}

function selectVideo(id, { autoplay = true, scroll = true } = {}) {
  const video = state.videos.find((item) => item.id === id && isPlayableConference(item));
  if (!video) {
    showToast("Cette conférence n’est plus intégrable.");
    return;
  }
  state.selectedId = video.id;
  localStorage.setItem(SELECTED_KEY, video.id);
  loadPlayer(elements.player, video, autoplay).catch(() => {
    showToast("Le lecteur n’a pas pu démarrer cette source.");
  });
  renderSelected();
  renderQueue();
  renderCatalog();
  if (scroll && window.matchMedia("(max-width: 780px)").matches) {
    document.querySelector(".player-frame").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function toggleFavorite(id) {
  if (!state.videos.some((video) => video.id === id)) return;
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  persistFavorites();
  renderCatalog();
  renderSelected();
}

function hasActiveFilters() {
  return (
    state.filters.status !== "all" ||
    state.filters.topic !== "all" ||
    state.filters.language !== "all" ||
    state.filters.date !== "all" ||
    state.filters.source !== "all" ||
    Boolean(state.filters.query)
  );
}

function resetFilters() {
  state.filters = {
    status: "all",
    topic: "all",
    language: "all",
    date: "all",
    source: "all",
    query: "",
  };
  document.querySelector("#catalog-search").value = "";
  document.querySelector("#language-filter").value = "all";
  document.querySelector("#date-filter").value = "all";
  document.querySelector("#source-filter").value = "all";
  renderCatalog();
}

async function requestCatalog(forceRefresh = false) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CATALOG_REQUEST_TIMEOUT_MS);
  try {
    const query = forceRefresh ? `?refresh=1&t=${Date.now()}` : "";
    const response = await fetch(`/api/conferences${query}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Catalogue indisponible (${response.status})`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function scheduleCatalogRecovery() {
  if (!navigator.onLine || catalogRecoveryTimer !== null) return;
  catalogRecoveryTimer = window.setTimeout(() => {
    catalogRecoveryTimer = null;
    loadCatalog(false, { allowFallback: false, silent: true });
  }, CATALOG_RECOVERY_DELAY_MS);
}

async function loadCatalog(
  forceRefresh = false,
  { allowFallback = true, silent = false } = {},
) {
  if (state.refreshing) return false;
  state.refreshing = true;
  elements.refresh.classList.add("is-loading");
  elements.refresh.disabled = true;
  try {
    let payload;
    let usedFallback = false;
    try {
      payload = await requestCatalog(forceRefresh);
    } catch (error) {
      if (!allowFallback) throw error;
      const fallback = await fetch("/data/seed-catalog.json", { cache: "no-store" });
      if (!fallback.ok) throw new Error("Catalogue local indisponible");
      payload = await fallback.json();
      usedFallback = true;
      payload.notice = navigator.onLine
        ? "Le catalogue local a pris le relais. Nouvelle tentative automatique en cours."
        : "Mode hors connexion : dernier catalogue vérifié.";
    }

    const playable = Array.isArray(payload.videos)
      ? payload.videos.filter(isPlayableConference)
      : [];
    state.videos = [...new Map(playable.map((video) => [video.id, video])).values()];
    state.favorites = new Set(
      [...state.favorites].filter((id) => state.videos.some((video) => video.id === id)),
    );
    persistFavorites();
    state.mode = payload.mode === "youtube-api" ? "youtube-api" : "verified-fallback";
    state.generatedAt = payload.generatedAt || new Date().toISOString();
    state.notice = payload.notice || "";
    state.loading = false;

    if (!state.videos.length) throw new Error("Aucune conférence intégrable");
    const persisted = localStorage.getItem(SELECTED_KEY);
    const preferred = state.videos.find((video) => video.id === persisted)?.id;
    const live = state.videos.find((video) => video.status === "live")?.id;
    const nextSelection = preferred || live || sortForDisplay(state.videos)[0].id;
    const playerIsAlreadyLoaded =
      state.selectedId === nextSelection &&
      Boolean(elements.player.querySelector("iframe, video"));
    if (!playerIsAlreadyLoaded) {
      selectVideo(nextSelection, { autoplay: false, scroll: false });
    }
    renderAll();
    if (usedFallback) scheduleCatalogRecovery();
    else if (catalogRecoveryTimer !== null) {
      window.clearTimeout(catalogRecoveryTimer);
      catalogRecoveryTimer = null;
    }
    if (forceRefresh) showToast("Catalogue vérifié et actualisé.");
    else if (state.notice) showToast(state.notice);
    return !usedFallback;
  } catch (error) {
    if (silent && state.videos.length) return false;
    elements.grid.setAttribute("aria-busy", "false");
    elements.grid.replaceChildren();
    elements.grid.hidden = true;
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "Catalogue momentanément indisponible";
    elements.empty.querySelector("p").textContent = "Une nouvelle tentative sera possible dans un instant.";
    showToast(error instanceof Error ? error.message : "Impossible de charger le catalogue.");
    return false;
  } finally {
    state.refreshing = false;
    elements.refresh.classList.remove("is-loading");
    elements.refresh.disabled = false;
  }
}

function updateCountdowns() {
  document.querySelectorAll(".countdown[data-time]").forEach((element) => {
    element.textContent = formatCountdown(element.dataset.time);
  });
}

function updateNetworkState() {
  const online = navigator.onLine;
  elements.network.classList.toggle("is-offline", !online);
  elements.network.querySelector("span").textContent = online ? "Connexion active" : "Mode hors connexion";
  if (online && !state.loading && state.mode !== "youtube-api") scheduleCatalogRecovery();
}

elements.statusTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-status]");
  if (!button) return;
  state.filters.status = button.dataset.status;
  renderCatalog();
});

elements.topicTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-topic]");
  if (!button) return;
  state.filters.topic = button.dataset.topic;
  renderCatalog();
});

document.addEventListener("click", (event) => {
  const select = event.target.closest("[data-select-video]");
  if (select) selectVideo(select.dataset.selectVideo);
  const favorite = event.target.closest("[data-favorite-video]");
  if (favorite) toggleFavorite(favorite.dataset.favoriteVideo);
});

elements.favoriteSelected.addEventListener("click", () => {
  if (state.selectedId) toggleFavorite(state.selectedId);
});

elements.refresh.addEventListener("click", () => loadCatalog(true));
document.querySelector("#fullscreen-player").addEventListener("click", () => {
  requestPlayerFullscreen(elements.player).catch(() => showToast("Plein écran non disponible sur cet appareil."));
});
elements.clearFilters.addEventListener("click", resetFilters);
elements.empty.querySelector("button").addEventListener("click", resetFilters);

document.querySelector("#catalog-search").addEventListener("input", (event) => {
  state.filters.query = event.target.value;
  renderCatalog();
});
document.querySelector("#language-filter").addEventListener("change", (event) => {
  state.filters.language = event.target.value;
  renderCatalog();
});
document.querySelector("#date-filter").addEventListener("change", (event) => {
  state.filters.date = event.target.value;
  renderCatalog();
});
document.querySelector("#source-filter").addEventListener("change", (event) => {
  state.filters.source = event.target.value;
  renderCatalog();
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#catalog-search").focus();
  }
});

window.addEventListener("online", updateNetworkState);
window.addEventListener("offline", updateNetworkState);
updateNetworkState();

let installPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  elements.install.hidden = false;
});
elements.install.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  elements.install.hidden = true;
});
window.addEventListener("appinstalled", () => showToast("CR3@TIX AI LIVE est installée."));

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
      registration.update();
    } catch {
      showToast("Installation PWA temporairement indisponible.");
    }
  });
}

setInterval(updateCountdowns, 30_000);
renderStatusTabs();
renderTopicTabs();
loadCatalog();
