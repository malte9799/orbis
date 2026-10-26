import * as THREE from 'three';
import { createHiPSLayer, HiPSLayer } from '../space/hips';

// Sterne-Ansicht: Kamera steht im Mittelpunkt einer Himmelskugel und blickt „in den Himmel“.
// Basistextur: NASA/GSFC SVS „Deep Star Maps 2020“ (Hipparcos-2, Tycho-2, Gaia DR2),
// plattkartiert in äquatorialen Koordinaten (Äquator midline, RA nimmt nach links zu,
// Norden oben) – von innen auf die Sphäre gemappt.
// Kamera: freie Quaternion-Rotation (kein festes „oben“) – Ziehen dreht um die lokalen
// Kamera-Achsen, Zoom richtet sich auf den Cursor aus (der Punkt unter dem Cursor bleibt stehen).

export interface StarsView {
  el: HTMLElement;
  activate(opts?: { ra?: number; dec?: number; fov?: number }): void;
  deactivate(): void;
}

const TEX_URL = `${import.meta.env.BASE_URL}textures/starmap_2020_4k.jpg`;
const FOV_MIN = 2;
const FOV_MAX = 100;

export function createStarsView(): StarsView {
  const el = document.createElement('div');
  el.className = 'stars-view';
  el.hidden = true;
  el.innerHTML = `
    <canvas class="stars-canvas"></canvas>
    <div class="stars-hint" role="status">Ziehen zum Umschauen · Zoomen auf den Cursor · „D“ schaltet die Drift</div>
    <div class="stars-credit">Deep Star Maps 2020 · NASA/GSFC SVS (Hipparcos, Tycho-2, Gaia DR2)</div>
  `;
  const canvas = el.querySelector<HTMLCanvasElement>('.stars-canvas')!;
  const hint = el.querySelector<HTMLElement>('.stars-hint')!;
  const creditEl = el.querySelector<HTMLElement>('.stars-credit')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  const quat = new THREE.Quaternion(); // freie Orientation der Kamera
  const RADIUS = 100;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 96, 64),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
  );
  scene.add(sky);

  // HiPS-Ebene (DSS2 color, CDS/alasky): hohe Auflösung beim Hineinzoomen.
  // Lazy beim ersten Aktivieren; Fehler nur degradieren (Basis-Karte bleibt).
  let hips: HiPSLayer | null = null;
  let hipsLoading: Promise<void> | null = null;
  const DSS_URL = 'https://alasky.cds.unistra.fr/DSS/DSSColor';
  function loadHips() {
    hipsLoading ??= createHiPSLayer(DSS_URL, 7)
      .then((l) => {
        hips = l;
        scene.add(l.group);
        creditEl.title = `DSS2: The Digitized Sky Surveys were produced at the Space Telescope Science Institute … (CDS/Aladin HiPS)`;
        creditEl.textContent += ' · DSS2 © STScI/AAO/Caltech (CDS HiPS)';
        l.setActive(true);
      })
      .catch(() => {
        hips = null; // ohne HiPS weitermachen (nur Deep Star Map)
      });
    return hipsLoading;
  }

  let fov = 70;
  let targetFov = fov;
  let dragging = false;
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  let drift = false; // sanfte Nachtdrift standardmäßig aus (/D schaltet sie ein)
  let raf = 0;
  let hintTimer = 0;
  let lastT = 0;

  // Rektaszension/Deklination (Grad) -> Blickrichtung auf der Himmelskugel
  // (Earth-fixed North +Y, RA 0 bei … – Kreditkartierung passt zur NASA-Karte)
  function lookAtRADec(ra: number, dec: number) {
    const r = THREE.MathUtils.degToRad(ra);
    const d = THREE.MathUtils.degToRad(dec);
    const dir = new THREE.Vector3(Math.cos(d) * Math.cos(r), Math.sin(d), Math.cos(d) * Math.sin(r));
    const up = Math.abs(dir.y) > 0.999 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    // Kamera-LookAt: +Z-Achse zeigt von „dir“ weg; die Kamera schaut entlang −Z = dir
    const m = new THREE.Matrix4();
    m.lookAt(new THREE.Vector3(0, 0, 0), dir, up);
    quat.setFromRotationMatrix(m);
    camera.quaternion.copy(quat);
  }

  function resize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function loop(t: number) {
    if (!active) return;
    const dt = Math.min(50, t - lastT);
    lastT = t;
    if (drift && !dragging) {
      // sanfte Drift: langsame Welt-Rotation um die Himmelsachse
      const qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.0004);
      quat.premultiply(qd);
      camera.quaternion.copy(quat);
    }
    fov += (targetFov - fov) * Math.min(1, dt / 100);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    hips?.update(camera, Math.min(canvas.clientWidth || 800, canvas.clientHeight || 800));
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  function showHint() {
    hint.classList.remove('away');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hint.classList.add('away'), 3500);
  }
  // Zoom: FOV-Wechsel auf die Bildmitte (kein cursor-bezogener Zoom mehr)


  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    const k = (fov * Math.PI / 180) / canvas.clientHeight; // rad pro Pixel
    // frei drehen um lokale Kamera-Achsen (kein festes „oben“):
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
    quat.multiply(pitch).multiply(yaw); // lokale Rotationen hinten anwenden
    camera.quaternion.copy(quat);
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetFov = Math.max(FOV_MIN, Math.min(FOV_MAX, targetFov * Math.exp(e.deltaY * 0.0012)));
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchDist) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      targetFov = Math.max(FOV_MIN, Math.min(FOV_MAX, targetFov * pinchDist / d));
      pinchDist = d;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinchDist = 0; });

  window.addEventListener('keydown', onKey);  function onKey(e: KeyboardEvent) {
    if (!active || el.hidden || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const dv = (fov * Math.PI / 180) / canvas.clientHeight * 40; // ~40 px Schritt
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const yaw = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const pitch = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
      const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yaw * dv);
      const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), pitch * dv);
      quat.multiply(qx).multiply(qy);
      camera.quaternion.copy(quat);
      showHint();
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') {
      targetFov = Math.max(FOV_MIN, targetFov * 0.85);
    } else if (e.key === '-') {
      targetFov = Math.min(FOV_MAX, targetFov * 1.18);
    } else if (e.key.toLowerCase() === 'd') {
      drift = !drift;
      showHint();
    }
  }

  let texLoaded = false;
  function loadTexture() {
    new THREE.TextureLoader().load(
      TEX_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        sky.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
      },
      undefined,
      () => {
        // Rückfall: dunkler Himmel, wenn die Textur nicht lädt
        sky.material = new THREE.MeshBasicMaterial({ color: 0x010208, side: THREE.BackSide });
      },
    );
  }

  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return {
    el,
    activate(opts) {
      active = true;
      el.hidden = false;
      fov = 70;
      targetFov = Number.isFinite(opts?.fov) ? opts!.fov! : 70;
      camera.fov = fov;
      const ra = Number.isFinite(opts?.ra) ? opts!.ra! : 0;
      const dec = Number.isFinite(opts?.dec) ? opts!.dec! : 30;
      if (Number.isFinite(opts?.ra) || Number.isFinite(opts?.dec)) lookAtRADec(ra, dec);
      else {
        // Standard: gemütlicher Blick in die südliche Milchstraße (Richtung galaktisches Zentrum)
        lookAtRADec(266, -25);
      }
      camera.updateProjectionMatrix();
      resize();
      if (!texLoaded) {
        texLoaded = true;
        loadTexture();
        loadHips();
      }
      renderer.render(scene, camera);
      lastT = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
      showHint();
    },
    deactivate() {
      active = false;
      cancelAnimationFrame(raf);
      el.hidden = true;
      clearTimeout(hintTimer);
    },
  };
}
