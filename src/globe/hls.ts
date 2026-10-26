// Live video (HLS, .m3u8) in popups. Safari plays HLS natively; everywhere else hls.js is loaded on
// first use (separate chunk). The player is torn down once the video element leaves the page (popup
// closed), so no stream keeps downloading in the background.

/** Plays `url` in `video`; `onFail` runs when the stream cannot be played (then show the still image). */
export function attachHls(video: HTMLVideoElement, url: string, onFail: () => void) {
  let failed = false;
  const fail = () => {
    if (failed) return;
    failed = true;
    onFail();
  };
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.addEventListener('error', fail, { once: true });
    video.src = url;
    void video.play().catch(() => undefined);
    return;
  }
  import('hls.js')
    .then(({ default: Hls }) => {
      if (!Hls.isSupported() || !video.isConnected) return fail();
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
    .catch(fail);
}
