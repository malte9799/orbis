import { rawFetch } from './capture';

// Mockup: preview of a .glb / .gltf model with three.js (orbit controls, wireframe switch, model statistics).

const BIG = 40_000_000; // bytes: ask before loading anything larger

export interface GlbView {
  el: HTMLElement;
  destroy(): void;
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} Mio.` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(n));
const size = (n: number) => (n < 1048576 ? `${(n / 1024).toFixed(0)} kB` : `${(n / 1048576).toFixed(1)} MB`);

export function createGlbView(url: string): GlbView {
  const el = document.createElement('div');
  el.className = 'rdi-tm rdi-glb';
  el.innerHTML = `<p class="muted rdi-empty">Modell wird geladen …</p>`;
  let dead = false;
  let dispose = () => {};

  async function load(force: boolean) {
    const res = await rawFetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const len = Number(res.headers.get('content-length')) || 0;
    if (len > BIG && !force) {
      void res.body?.cancel();
      el.innerHTML = `<div class="rdi-empty"><p>Sehr großes Modell (${size(len)}).</p><button type="button" class="rdi-btn">Trotzdem laden</button></div>`;
      el.querySelector('button')!.addEventListener('click', () => {
        el.innerHTML = `<p class="muted rdi-empty">Modell wird geladen …</p>`;
        void start(true);
      });
      return;
    }
    const buf = await res.arrayBuffer();
    if (dead) return;

    const THREE = await import('three');
    const [{ GLTFLoader }, { DRACOLoader }, { OrbitControls }] = await Promise.all([
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('three/examples/jsm/loaders/DRACOLoader.js'),
      import('three/examples/jsm/controls/OrbitControls.js'),
    ]);
    const draco = new DRACOLoader().setDecoderPath('./draco/');
    const gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(buf, url.slice(0, url.lastIndexOf('/') + 1));
    draco.dispose();
    if (dead) return;

    // statistics
    let meshes = 0;
    let tris = 0;
    let verts = 0;
    const mats = new Set<unknown>();
    const texs = new Set<unknown>();
    gltf.scene.traverse((o) => {
      const m = o as import('three').Mesh;
      if (!m.isMesh) return;
      meshes++;
      verts += m.geometry.attributes.position?.count ?? 0;
      tris += (m.geometry.index ? m.geometry.index.count : (m.geometry.attributes.position?.count ?? 0)) / 3;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        mats.add(mat);
        for (const v of Object.values(mat)) if (v && (v as { isTexture?: boolean }).isTexture) texs.add(v);
      }
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const dim = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(dim.x, dim.y, dim.z) / 2 || 1;

    el.innerHTML = `
      <canvas></canvas>
      <div class="rdi-tm-stat"></div>
      <div class="rdi-tm-bar" role="group" aria-label="Modellsteuerung">
        <button type="button" data-a="spin" class="on" aria-pressed="true">Drehen</button>
        <button type="button" data-a="wire" aria-pressed="false">Drahtgitter</button>
        <button type="button" data-a="fit">Einpassen</button>
      </div>
`;
    const canvas = el.querySelector('canvas')!;
    el.querySelector('.rdi-tm-stat')!.textContent = [
      size(buf.byteLength),
      `${meshes} Meshes`,
      `${fmt(tris)} Dreiecke`,
      `${mats.size} Materialien`,
      `${texs.size} Texturen`,
      gltf.animations.length ? `${gltf.animations.length} Animationen` : '',
      `${dim.x.toFixed(1)} × ${dim.y.toFixed(1)} × ${dim.z.toFixed(1)}`,
    ]
      .filter(Boolean)
      .join(' · ');

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(3, 4, 5);
    scene.add(sun);
    scene.add(gltf.scene);
    const camera = new THREE.PerspectiveCamera(40, 1, radius / 100, radius * 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    const fit = () => {
      camera.position.copy(center).add(new THREE.Vector3(1, 0.6, 1.4).normalize().multiplyScalar((radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.1));
      controls.target.copy(center);
      controls.update();
    };
    fit();

    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    let wire = false;
    el.querySelector('.rdi-tm-bar')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]');
      if (!b) return;
      if (b.dataset.a === 'spin') {
        controls.autoRotate = !controls.autoRotate;
        b.classList.toggle('on', controls.autoRotate);
        b.setAttribute('aria-pressed', String(controls.autoRotate));
      } else if (b.dataset.a === 'wire') {
        wire = !wire;
        b.classList.toggle('on', wire);
        b.setAttribute('aria-pressed', String(wire));
        mats.forEach((m) => ((m as { wireframe?: boolean }).wireframe = wire));
      } else fit();
    });

    dispose = () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      gltf.scene.traverse((o) => {
        const m = o as import('three').Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
      mats.forEach((m) => (m as { dispose(): void }).dispose());
      texs.forEach((t) => (t as { dispose(): void }).dispose());
      renderer.dispose();
    };
  }

  const start = (force: boolean) =>
    load(force).catch((e) => {
      if (!dead) el.innerHTML = `<p class="rdi-err">${String(e instanceof Error ? e.message : e).replace(/</g, '&lt;')}</p>`;
    });
  void start(false);

  return {
    el,
    destroy() {
      dead = true;
      dispose();
    },
  };
}
