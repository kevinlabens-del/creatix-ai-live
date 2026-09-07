import { isPlayableConference } from "./catalog";

let activeHls = null;

function destroyActiveStream() {
  if (activeHls) {
    activeHls.destroy();
    activeHls = null;
  }
}

function createEmbeddedFrame(src, title) {
  const iframe = document.createElement("iframe");
  iframe.src = src;
  iframe.title = title;
  iframe.loading = "eager";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.setAttribute("allowfullscreen", "");
  iframe.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-presentation allow-forms",
  );
  return iframe;
}

function createVideoElement(video, autoplay) {
  const element = document.createElement("video");
  element.controls = true;
  element.autoplay = autoplay;
  element.playsInline = true;
  element.preload = "metadata";
  element.poster = video.thumbnail || "";
  element.setAttribute("controlsList", "nodownload noremoteplayback");
  element.disablePictureInPicture = false;
  return element;
}

export function clearPlayer(container) {
  destroyActiveStream();
  container.replaceChildren();
}

export async function loadPlayer(container, video, autoplay = true) {
  clearPlayer(container);
  if (!isPlayableConference(video)) {
    const message = document.createElement("div");
    message.className = "player-message";
    message.textContent = "Cette conférence n’est plus disponible dans le lecteur.";
    container.append(message);
    return { ok: false };
  }

  if (video.source === "youtube") {
    const origin = encodeURIComponent(window.location.origin);
    const src = `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=${autoplay ? "1" : "0"}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`;
    container.append(createEmbeddedFrame(src, `Lecture : ${video.title}`));
    return { ok: true };
  }

  if (video.source === "vimeo") {
    const src = `https://player.vimeo.com/video/${video.videoId}?autoplay=${autoplay ? "1" : "0"}&title=0&byline=0&portrait=0&dnt=1`;
    container.append(createEmbeddedFrame(src, `Lecture : ${video.title}`));
    return { ok: true };
  }

  const element = createVideoElement(video, autoplay);
  container.append(element);
  if (video.source === "hls") {
    if (element.canPlayType("application/vnd.apple.mpegurl")) {
      element.src = video.playbackUrl;
    } else {
      const { default: Hls } = await import("hls.js/dist/hls.light.mjs");
      if (!Hls.isSupported()) {
        clearPlayer(container);
        const message = document.createElement("div");
        message.className = "player-message";
        message.textContent = "Ce flux HLS n’est pas compatible avec cet appareil.";
        container.append(message);
        return { ok: false };
      }
      activeHls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
      });
      activeHls.loadSource(video.playbackUrl);
      activeHls.attachMedia(element);
    }
  } else {
    element.src = video.playbackUrl;
  }
  if (autoplay) element.play().catch(() => undefined);
  return { ok: true };
}

export function requestPlayerFullscreen(container) {
  const target = container.querySelector("iframe, video") || container;
  if (target.requestFullscreen) return target.requestFullscreen();
  if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
  return Promise.resolve();
}
