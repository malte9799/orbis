// Live video (HLS, .m3u8) in popups. hls.js (loaded on first use, separate chunk) is preferred
// wherever Media Source Extensions exist: it plays from a same-origin blob: URL, so the 3D camera
// board can use the video as a WebGL texture. Browsers with built-in HLS play cross-origin and
// refuse `crossorigin` on HLS sources, so a natively playing video cannot become a texture – only
// used where hls.js does not run (older iPhones). The player is torn down once the video element
// leaves the page (popup closed), so no stream keeps downloading in the background.

/** Plays `url` in `video`; `onFail` runs when the stream cannot be played (then show the still image). */
export function attachHls(video: HTMLVideoElement, url: string, onFail: () => void) {
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    onFail();
  };
  const native = () => {
    if (!video.canPlayType('application/vnd.apple.mpegurl')) return fail();
    video.addEventListener('error', fail, { once: true });
    video.src = url;
    void video.play().catch(() => undefined);
  };
  import('hls.js')
    .then(({ default: Hls }) => {
      if (!video.isConnected) return;
      if (!Hls.isSupported()) return native();
      const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        hls.destroy();
        fail();
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      void video.play().catch(() => undefined);
      const watch = window.setInterval(() => {
        if (video.isConnected) return;
        clearInterval(watch);
        hls.destroy();
      }, 2000);
    })
    .catch(native);
}

/** a video whose frames WebGL may read: same-origin (hls.js blob:) or loaded with CORS */
export const textureSafe = (video: HTMLVideoElement) => video.currentSrc.startsWith('blob:') || video.crossOrigin === 'anonymous';
