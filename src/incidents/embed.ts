// Einbettung von Videos der Hoster (Instagram, Facebook, Reddit, YouTube, X): nichts davon wird gespeichert, der Hoster
// liefert das Video im eingebetteten Player. Rein, getestet in incidents.test.ts. null = nicht einbettbar, dann nur der Link.

export interface Embed {
  src: string;
  /** Höhe des Players in px (Breite: volle Panelbreite) */
  height: number;
}

export function embedOf(rawUrl: string): Embed | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  // Instagram: Die Einbettung liefert für diese Reels „Beitrag nicht verfügbar“ (getestet) – nur als Link, bis es klappt.
  if (host === 'instagram.com') return null;
  if (host === 'facebook.com' || host === 'fb.watch') {
    const portrait = parts[0] === 'reel';
    return { src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(rawUrl)}&show_text=false&width=400`, height: portrait ? 560 : 260 };
  }
  if (host === 'reddit.com') {
    const i = parts.indexOf('comments');
    if (parts[0] !== 'r' || i < 0 || !parts[i + 1]) return null;
    return { src: `https://embed.reddit.com/${parts.slice(0, i + 3).join('/')}/?embed=true&theme=dark&showmedia=true`, height: 460 };
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id = host === 'youtu.be' ? parts[0] : u.searchParams.get('v') ?? (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : undefined);
    return id ? { src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`, height: 225 } : null;
  }
  if (host === 'x.com' || host === 'twitter.com') {
    const i = parts.indexOf('status');
    return i >= 0 && parts[i + 1] ? { src: `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(parts[i + 1])}&theme=dark`, height: 480 } : null;
  }
  return null;
}
