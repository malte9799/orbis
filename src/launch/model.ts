// Small procedural 3D rocket (Falcon 9 class) for the launch tracker panel: white first stage,
// black interstage, grid fins and an engine plume with thrust ramp. Built from primitives –
// no model download needed – and only loaded when the panel is opened.

/* eslint-disable @typescript-eslint/no-explicit-any */

export class RocketView {
  private renderer!: any;
  private scene: any;
  private camera: any;
  private rotor!: any; // rocket group that slowly turns
  private plume!: any; // engine plume cone
  private light!: any; // point light above the engines
  private pitchBody!: any; // group tilted according to the flight-path angle
  private raf = 0;
  private obs?: ResizeObserver;
  private pitch = 90;
  private engine = false;
  private phase = -1;
  private running = false;

  private constructor(private canvas: HTMLCanvasElement) {}

  static async create(canvas: HTMLCanvasElement): Promise<RocketView> {
    const v = new RocketView(canvas);
    await v.build();
    v.resize();
    v.start();
    return v;
  }

  private async build() {
    const THREE = await import('three');
    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 200);
    camera.position.set(14, 5, 17);
    camera.lookAt(0, 0, 0);
    this.camera = camera;
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer = renderer;

    scene.add(new THREE.HemisphereLight(0x9db4ff, 0x0a0e1c, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(8, 12, 10);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x6688ff, 1.1);
    rim.position.set(-10, -2, -6);
    scene.add(rim);

    const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.35, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x22262e, roughness: 0.6, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9aa4b2, roughness: 0.35, metalness: 0.85 });

    const pitch = new THREE.Group(); // tilts with the flight-path angle
    const rotor = new THREE.Group(); // slow turn inside it
    pitch.add(rotor);
    scene.add(pitch);

    const cyl = (r: number, h: number, mat: any, y: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
      m.position.y = y;
      rotor.add(m);
      return m;
    };
    cyl(0.55, 9, white, -2.2); // first stage
    cyl(0.553, 1.3, dark, 3.1); // black interstage band
    cyl(0.55, 2.6, white, 5.05); // second stage
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.1, 32), white);
    tip.position.y = 7.9;
    rotor.add(tip); // nose cone
    for (let i = 0; i < 4; i++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.15, 0.85), metal);
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.62, 3.2, Math.sin(a) * 0.62);
      fin.rotation.y = -a;
      rotor.add(fin); // grid fins
    }
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 1.1, 32), dark);
    skirt.position.y = -7.25;
    rotor.add(skirt); // engine skirt
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 24, 1, true), metal);
    nozzle.position.y = -8.1;
    nozzle.rotation.x = Math.PI;
    rotor.add(nozzle);

    const plume = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 6, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    plume.position.y = -9.6; // below the nozzle, apex pointing down
    plume.rotation.x = Math.PI;
    plume.visible = false;
    rotor.add(plume);

    const light = new THREE.PointLight(0xff8040, 0, 60);
    light.position.y = -8;
    rotor.add(light);

    this.pitchBody = pitch;
    this.rotor = rotor;
    this.plume = plume;
    this.light = light;

    this.obs = new ResizeObserver(() => this.resize());
    this.obs.observe(this.canvas);
  }

  /** `tSec` since T-0 (negative = countdown), `pitchDeg` flight-path angle, engine true while accelerating */
  setPhase(tSec: number, pitchDeg: number, engine: boolean) {
    this.phase = tSec;
    this.pitch = pitchDeg;
    this.engine = engine;
  }

  resize() {
    if (!this.renderer) return;
    const w = this.canvas.clientWidth || 300;
    const h = this.canvas.clientHeight || 170;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start() {
    if (this.running || !this.renderer) return;
    this.running = true;
    const loop = (ms: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const t = ms / 1000;
      this.rotor.rotation.y += 0.004; // slow turn
      const tilt = Math.min(1.25, ((90 - this.pitch) / 90) * 1.15); // up to ~70°, capped
      this.pitchBody.rotation.z += (tilt - this.pitchBody.rotation.z) * 0.05;
      const on = this.engine && this.phase >= 0;
      const thrust = on ? Math.max(0.15, Math.min(1, this.phase / 6)) : 0;
      this.plume.visible = on;
      if (on) {
        this.plume.scale.set(1, thrust * (0.85 + 0.12 * Math.sin(t * 23)), 1);
        this.light.intensity = 7 * thrust * (0.85 + 0.3 * Math.sin(t * 41));
      } else {
        this.light.intensity = 0;
      }
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.obs?.disconnect();
    try {
      this.renderer?.dispose();
    } catch {
      /* ignore */
    }
  }
}
