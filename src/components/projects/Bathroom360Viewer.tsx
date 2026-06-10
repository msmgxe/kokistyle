"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PlayCircle } from "lucide-react";

import type { Cliente01Content } from "@/src/config/cliente01";

type ViewerLabels = Cliente01Content["viewer"];
type LayoutId = "current" | "proposed";
type ViewpointId = "entrance" | "center" | "shower" | "vanity";

/* Room footprint requested by the client: 2.00 m wide × 2.50 m deep, 2.40 m ceiling */
const RW = 2.0;
const RD = 2.5;
const RH = 2.4;
const EYE = 1.6;

interface Viewpoint {
  id: ViewpointId;
  pos: [number, number, number];
  yaw: number;
  pitch: number;
}

const VIEWPOINTS: Record<LayoutId, Viewpoint[]> = {
  current: [
    { id: "entrance", pos: [-0.3, EYE, 1.0], yaw: Math.PI + 0.25, pitch: -0.05 },
    { id: "center", pos: [0.05, EYE, 0.15], yaw: Math.PI - 0.4, pitch: -0.08 },
    { id: "shower", pos: [0.25, EYE, -0.25], yaw: Math.PI + 0.55, pitch: -0.1 },
    { id: "vanity", pos: [-0.05, EYE, 0.4], yaw: -Math.PI / 2, pitch: -0.12 },
  ],
  proposed: [
    { id: "entrance", pos: [-0.3, EYE, 1.0], yaw: Math.PI - 0.2, pitch: -0.05 },
    { id: "center", pos: [0.0, EYE, 0.2], yaw: Math.PI, pitch: -0.08 },
    { id: "shower", pos: [0.15, EYE, -0.15], yaw: Math.PI + 0.45, pitch: -0.08 },
    { id: "vanity", pos: [-0.15, EYE, 0.4], yaw: Math.PI / 2, pitch: -0.12 },
  ],
};

/* Cinematic tour keyframes — yaw values are continuous (can exceed 2π) so the
   camera sweeps instead of snapping the short way around. */
interface TourKey {
  p: [number, number, number];
  yaw: number;
  pitch: number;
  t: number; // seconds at which this keyframe is reached
}

const TOURS: Record<LayoutId, TourKey[]> = {
  current: [
    { p: [-0.3, EYE, 1.0], yaw: Math.PI - 0.5, pitch: -0.05, t: 0 },
    { p: [-0.3, EYE, 1.0], yaw: Math.PI + 0.7, pitch: -0.06, t: 5 },
    { p: [0.05, EYE, 0.15], yaw: Math.PI + 0.9, pitch: -0.1, t: 10 },
    { p: [0.25, EYE, -0.25], yaw: Math.PI + 0.5, pitch: -0.12, t: 14 },
    { p: [0.1, EYE, 0.3], yaw: Math.PI * 1.5, pitch: -0.12, t: 19 },
    { p: [-0.05, EYE, 0.5], yaw: Math.PI * 1.8, pitch: -0.08, t: 24 },
    { p: [-0.3, EYE, 1.0], yaw: Math.PI * 2 + (Math.PI - 0.5), pitch: -0.05, t: 30 },
  ],
  proposed: [
    { p: [-0.3, EYE, 1.0], yaw: Math.PI - 0.6, pitch: -0.05, t: 0 },
    { p: [-0.3, EYE, 1.0], yaw: Math.PI + 0.6, pitch: -0.06, t: 5 },
    { p: [0.0, EYE, 0.2], yaw: Math.PI + 0.8, pitch: -0.1, t: 10 },
    { p: [0.15, EYE, -0.15], yaw: Math.PI + 0.4, pitch: -0.1, t: 14 },
    { p: [-0.1, EYE, 0.35], yaw: Math.PI * 1.5 + 0.2, pitch: -0.12, t: 19 },
    { p: [-0.2, EYE, 0.55], yaw: Math.PI * 1.9, pitch: -0.08, t: 24 },
    { p: [-0.3, EYE, 1.0], yaw: Math.PI * 2 + (Math.PI - 0.6), pitch: -0.05, t: 30 },
  ],
};

interface LabelAnchor {
  key: keyof ViewerLabels["sceneLabels"];
  pos: [number, number, number];
}

const LABEL_ANCHORS: Record<LayoutId, LabelAnchor[]> = {
  current: [
    { key: "showerCurrent", pos: [-0.55, 1.7, -0.82] },
    { key: "vanityCurrent", pos: [-0.85, 1.25, 0.35] },
    { key: "toilet", pos: [0.78, 0.95, 0.45] },
    { key: "door", pos: [-0.35, 1.9, 1.2] },
  ],
  proposed: [
    { key: "shower", pos: [-0.3, 1.75, -1.05] },
    { key: "vanity", pos: [0.85, 1.25, 0.35] },
    { key: "toilet", pos: [-0.78, 0.95, 0.25] },
    { key: "door", pos: [-0.35, 1.9, 1.2] },
  ],
};

/* ── Canvas-generated textures ────────────────────────────── */

function tileTexture(opts: {
  body: string;
  grout: string;
  tileW: number;
  tileH: number;
}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128 * (opts.tileH / opts.tileW);
  const x = c.getContext("2d")!;
  x.fillStyle = opts.grout;
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = opts.body;
  x.fillRect(4, 4, c.width - 8, c.height - 8);
  const g = x.createLinearGradient(4, 4, c.width - 4, c.height - 4);
  g.addColorStop(0, "rgba(255,255,255,0.12)");
  g.addColorStop(0.35, "rgba(255,255,255,0.03)");
  g.addColorStop(1, "rgba(0,0,0,0.14)");
  x.fillStyle = g;
  x.fillRect(4, 4, c.width - 8, c.height - 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function marbleTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#E8E4D8";
  x.fillRect(0, 0, 512, 512);
  const veins = [
    [0.05, 0, 0.25, 0.3, 0.15, 0.7, 0.3, 1],
    [0.6, 0, 0.55, 0.4, 0.7, 0.6, 0.8, 1],
    [0.35, 0, 0.5, 0.5, 0.4, 0.75, 0.55, 1],
    [0.8, 0, 0.7, 0.35, 0.85, 0.65, 0.75, 1],
  ];
  for (const v of veins) {
    x.beginPath();
    x.moveTo(v[0] * 512, v[1] * 512);
    x.bezierCurveTo(v[2] * 512, v[3] * 512, v[4] * 512, v[5] * 512, v[6] * 512, v[7] * 512);
    x.strokeStyle = "rgba(150,140,125,0.18)";
    x.lineWidth = 1.5;
    x.stroke();
    x.strokeStyle = "rgba(150,140,125,0.08)";
    x.lineWidth = 4;
    x.stroke();
  }
  x.strokeStyle = "rgba(180,170,155,0.55)";
  x.lineWidth = 2;
  for (let i = 0; i <= 512; i += 128) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 512);
    x.stroke();
    x.beginPath();
    x.moveTo(0, i);
    x.lineTo(512, i);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const x = c.getContext("2d")!;
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "#7D5A3C");
  g.addColorStop(0.12, "#8E6A4A");
  g.addColorStop(0.28, "#7D5A3C");
  g.addColorStop(0.45, "#6B4D33");
  g.addColorStop(0.6, "#7D5A3C");
  g.addColorStop(0.78, "#8A6448");
  g.addColorStop(1, "#6B4D33");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(35,18,6,0.1)";
  x.lineWidth = 0.8;
  for (let y = 0; y < 256; y += 5) {
    x.beginPath();
    x.moveTo(0, y + Math.sin(y * 0.09) * 1.8);
    x.lineTo(256, y + Math.sin(y * 0.09 + 3.5) * 1.8);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ── Scene building ───────────────────────────────────────── */

interface Mats {
  floor: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
  matteWhite: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  mirror: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  bulb: THREE.MeshStandardMaterial;
  ceil: THREE.MeshStandardMaterial;
  towel: THREE.MeshStandardMaterial;
  wallTex: THREE.CanvasTexture;
  tileW: number;
  tileH: number;
}

function makeMats(layout: LayoutId): Mats {
  const proposed = layout === "proposed";
  const wallTex = proposed
    ? tileTexture({ body: "#7C9B82", grout: "#AFC4B2", tileW: 0.1, tileH: 0.2 })
    : tileTexture({ body: "#D9C9AF", grout: "#CBBCA0", tileW: 0.25, tileH: 0.2 });
  const floorMap = proposed ? marbleTexture() : tileTexture({ body: "#D6C6A8", grout: "#C2B190", tileW: 0.33, tileH: 0.33 });
  floorMap.repeat.set(RW / (proposed ? 0.6 : 0.33), RD / (proposed ? 0.6 : 0.33));

  return {
    floor: new THREE.MeshStandardMaterial({ map: floorMap, roughness: proposed ? 0.15 : 0.3, metalness: 0.05 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.65, metalness: 0.02 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf5f3ef, roughness: 0.22, metalness: 0.02 }),
    matteWhite: new THREE.MeshStandardMaterial({ color: 0xf6f4f0, roughness: 0.85, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9a840, roughness: 0.14, metalness: 0.88 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xcfd4d6, roughness: 0.12, metalness: 0.9 }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xc8f0eb,
      transparent: true,
      opacity: 0.2,
      roughness: 0.02,
      metalness: 0.1,
      side: THREE.DoubleSide,
    }),
    mirror: new THREE.MeshStandardMaterial({
      color: 0xaec5ca,
      emissive: 0x8fa8ae,
      emissiveIntensity: 0.4,
      roughness: 0.06,
      metalness: 0.35,
    }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.35, metalness: 0.35 }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff8e0, emissive: 0xffe080, emissiveIntensity: 1.4, roughness: 0.4 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0xf7f5f2, roughness: 0.92, metalness: 0 }),
    towel: new THREE.MeshStandardMaterial({ color: 0xe0d8c8, roughness: 0.9, metalness: 0 }),
    wallTex,
    tileW: proposed ? 0.1 : 0.25,
    tileH: 0.2,
  };
}

function wallMat(M: Mats, w: number, h: number): THREE.MeshStandardMaterial {
  const tex = M.wallTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(w / M.tileW, h / M.tileH);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.04 });
}

function mk(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function buildRoom(s: THREE.Scene, M: Mats) {
  const hw = RW / 2;
  const hd = RD / 2;
  const hh = RH / 2;
  s.add(mk(new THREE.PlaneGeometry(RW, RD), M.floor, 0, 0, 0, -Math.PI / 2));
  s.add(mk(new THREE.PlaneGeometry(RW, RD), M.ceil, 0, RH, 0, Math.PI / 2));
  s.add(mk(new THREE.PlaneGeometry(RW, RH), wallMat(M, RW, RH), 0, hh, -hd));
  s.add(mk(new THREE.PlaneGeometry(RD, RH), wallMat(M, RD, RH), -hw, hh, 0, 0, Math.PI / 2));
  s.add(mk(new THREE.PlaneGeometry(RD, RH), wallMat(M, RD, RH), hw, hh, 0, 0, -Math.PI / 2));
  // Front wall with a 0.80 m door opening at x = -0.35
  s.add(mk(new THREE.PlaneGeometry(0.25, RH), wallMat(M, 0.25, RH), -hw + 0.125, hh, hd, 0, Math.PI));
  s.add(mk(new THREE.PlaneGeometry(1.25, RH), wallMat(M, 1.25, RH), hw - 0.625, hh, hd, 0, Math.PI));
  s.add(mk(new THREE.PlaneGeometry(0.8, RH - 2.1), wallMat(M, 0.8, RH - 2.1), -0.35, 2.1 + (RH - 2.1) / 2, hd, 0, Math.PI));
}

function addPanelDoor(s: THREE.Scene, M: Mats, cx: number, z: number, w: number, open = false) {
  // White paneled door leaf set slightly inside the front wall
  const door = new THREE.Group();
  door.add(mk(new THREE.BoxGeometry(w, 2.1, 0.045), M.matteWhite, 0, 1.05, 0));
  // Panel insets
  for (const [py, ph] of [
    [1.55, 0.75],
    [0.62, 0.85],
  ] as const) {
    door.add(mk(new THREE.BoxGeometry(w - 0.18, ph, 0.012), M.white, 0, py, -0.025));
  }
  // Brass handle
  door.add(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.11, 12), M.brass, -w / 2 + 0.09, 1.02, -0.04, Math.PI / 2, 0, 0));
  if (open) door.rotation.y = -0.55;
  door.position.set(cx, 0, z - 0.03);
  s.add(door);
}

function addClosetDoors(s: THREE.Scene, M: Mats, cx: number, cz: number, totalW: number) {
  // Double bifold closet doors flush against the back wall (as seen in the photo)
  for (const side of [-1, 1]) {
    const leaf = new THREE.Group();
    const w = totalW / 2 - 0.015;
    leaf.add(mk(new THREE.BoxGeometry(w, 2.1, 0.04), M.matteWhite, 0, 1.05, 0));
    for (const [py, ph] of [
      [1.55, 0.75],
      [0.62, 0.85],
    ] as const) {
      leaf.add(mk(new THREE.BoxGeometry(w - 0.14, ph, 0.012), M.white, 0, py, 0.022));
    }
    leaf.add(mk(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 10), M.brass, side * -0.05, 1.02, 0.045));
    leaf.position.set(cx + side * (totalW / 4), 0, cz + 0.025);
    s.add(leaf);
  }
}

function addVanity(
  s: THREE.Scene,
  M: Mats,
  wall: "left" | "right",
  cz: number,
  vanW: number,
  hollywood: boolean,
) {
  const vanD = 0.48;
  const vanH = 0.86;
  const sgn = wall === "left" ? -1 : 1;
  const vx = sgn * (RW / 2 - vanD / 2 - 0.01);
  const wallX = sgn * (RW / 2);

  s.add(mk(new THREE.BoxGeometry(vanD, hollywood ? vanH : 0.5, vanW), M.wood, vx, hollywood ? vanH / 2 : 0.55, cz));
  s.add(mk(new THREE.BoxGeometry(vanD + 0.04, 0.04, vanW + 0.04), new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.15, metalness: 0.05 }), vx, vanH + 0.02, cz));
  s.add(mk(new THREE.CylinderGeometry(0.17, 0.14, 0.13, 28), M.white, vx, vanH + 0.06, cz));
  s.add(mk(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 12), M.brass, vx, vanH + 0.12, cz));

  // Brass faucet
  const fz = cz - 0.065;
  s.add(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 14), M.brass, vx - sgn * 0.12, vanH + 0.12, fz));
  const arm = mk(new THREE.CylinderGeometry(0.012, 0.012, 0.13, 10), M.brass, vx - sgn * 0.06, vanH + 0.2, fz);
  arm.rotation.z = Math.PI / 2;
  s.add(arm);
  s.add(mk(new THREE.CylinderGeometry(0.016, 0.022, 0.035, 14), M.brass, vx, vanH + 0.2, fz, Math.PI, 0, 0));

  const mH = hollywood ? 0.78 : 0.88;
  const mW = vanW * (hollywood ? 0.85 : 0.92);
  const my = vanH + 0.07 + mH / 2;
  const frameMat = hollywood ? M.frame : M.brass;
  s.add(mk(new THREE.BoxGeometry(0.028, mH + 0.07, mW + 0.07), frameMat, wallX - sgn * 0.018, my, cz));
  s.add(mk(new THREE.BoxGeometry(0.012, mH, mW), M.mirror, wallX - sgn * 0.034, my, cz));

  if (hollywood) {
    // Hollywood bulbs around the mirror
    const cols = 4;
    const br = 0.026;
    for (let ci = -cols; ci <= cols; ci++) {
      const bz = cz + ci * (mW / (cols * 2 + 1)) * 0.92;
      for (const side of [-1, 1]) {
        s.add(mk(new THREE.SphereGeometry(br, 10, 10), M.bulb, wallX - sgn * 0.07, my + side * (mH / 2 + 0.05), bz));
      }
    }
  } else {
    // LED strip above brass mirror
    s.add(
      mk(
        new THREE.BoxGeometry(0.018, 0.032, mW + 0.04),
        new THREE.MeshStandardMaterial({ color: 0xfff8f0, emissive: 0xffe8b0, emissiveIntensity: 0.9, roughness: 0.5 }),
        wallX - sgn * 0.03,
        my + mH / 2 + 0.04,
        cz,
      ),
    );
  }

  const ml = new THREE.PointLight(0xffe5a0, 5, 3.0, 1.6);
  ml.position.set(wallX - sgn * 0.45, my, cz);
  s.add(ml);
}

function addToilet(s: THREE.Scene, M: Mats, x: number, z: number, ry: number) {
  const g = new THREE.Group();
  g.add(mk(new THREE.BoxGeometry(0.4, 0.4, 0.3), M.white, 0, 0.2, 0));
  g.add(mk(new THREE.CylinderGeometry(0.22, 0.18, 0.16, 24), M.white, 0, 0.48, 0.01));
  g.add(
    mk(
      new THREE.CylinderGeometry(0.21, 0.21, 0.025, 24),
      new THREE.MeshStandardMaterial({ color: 0xefedeb, roughness: 0.28 }),
      0,
      0.575,
      0.015,
    ),
  );
  g.add(mk(new THREE.BoxGeometry(0.36, 0.3, 0.2), M.white, 0, 0.72, -0.055));
  g.add(mk(new THREE.BoxGeometry(0.37, 0.026, 0.21), M.white, 0, 0.875, -0.055));
  g.add(mk(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 12), M.brass, 0, 0.89, -0.055));
  g.rotation.y = ry;
  g.position.set(x, 0, z);
  s.add(g);
}

function addTowelBar(s: THREE.Scene, M: Mats, x: number, y: number, z: number, len: number, alongZ: boolean) {
  const bar = mk(new THREE.CylinderGeometry(0.013, 0.013, len, 12), M.brass, x, y, z);
  bar.rotation.z = Math.PI / 2;
  if (alongZ) bar.rotation.y = Math.PI / 2;
  s.add(bar);
  const tw = mk(new THREE.BoxGeometry(alongZ ? 0.022 : len * 0.9, 0.46, alongZ ? len * 0.9 : 0.022), M.towel, x, y - 0.23, z);
  s.add(tw);
}

function addCeilingLight(s: THREE.Scene, M: Mats, ox: number, oz: number) {
  s.add(mk(new THREE.TorusGeometry(0.09, 0.015, 10, 28), M.brass, ox, RH - 0.015, oz, Math.PI / 2));
  s.add(
    mk(
      new THREE.CylinderGeometry(0.075, 0.075, 0.01, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff8f0, emissive: 0xfff0d0, emissiveIntensity: 1.2 }),
      ox,
      RH - 0.022,
      oz,
    ),
  );
}

/* Current layout — mirrors the client's photo: corner shower cabin (back-left),
   Hollywood vanity on the left wall, toilet behind a pony wall on the right,
   double closet doors on the back-right. */
function buildCurrent(s: THREE.Scene, M: Mats) {
  buildRoom(s, M);

  // Corner shower cabin, back-left
  const SW = 0.85;
  const cx = -RW / 2 + SW / 2;
  const cz = -RD / 2 + SW / 2;
  s.add(mk(new THREE.BoxGeometry(SW, 0.07, SW), M.white, cx, 0.035, cz));
  const SH = 1.95;
  s.add(mk(new THREE.PlaneGeometry(SW, SH), M.glass, cx, SH / 2 + 0.07, cz + SW / 2));
  const gSide = mk(new THREE.PlaneGeometry(SW, SH), M.glass, cx + SW / 2, SH / 2 + 0.07, cz);
  gSide.rotation.y = Math.PI / 2;
  s.add(gSide);
  // Chrome frame (existing bathroom has silver frame)
  const FR = 0.022;
  s.add(mk(new THREE.BoxGeometry(SW + 0.02, FR, FR), M.chrome, cx, SH + 0.07, cz + SW / 2));
  s.add(mk(new THREE.BoxGeometry(FR, FR, SW + 0.02), M.chrome, cx + SW / 2, SH + 0.07, cz));
  s.add(mk(new THREE.BoxGeometry(FR, SH, FR), M.chrome, cx + SW / 2, SH / 2 + 0.07, cz + SW / 2));
  s.add(mk(new THREE.BoxGeometry(FR, SH, FR), M.chrome, cx + SW / 2, SH / 2 + 0.07, cz - SW / 2 + 0.01));
  s.add(mk(new THREE.BoxGeometry(FR, SH, FR), M.chrome, cx - SW / 2 + 0.01, SH / 2 + 0.07, cz + SW / 2));
  // Shower head + valve
  s.add(mk(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 12), M.chrome, cx - 0.15, 1.95, cz - SW / 2 + 0.12, -0.3));
  s.add(mk(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 18), M.chrome, cx - 0.15, 1.78, cz - SW / 2 + 0.17, Math.PI / 2));
  s.add(mk(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 14), M.chrome, cx - 0.15, 1.1, cz - SW / 2 + 0.05, Math.PI / 2));

  // Hollywood vanity, left wall
  addVanity(s, M, "left", 0.35, 0.88, true);

  // Toilet + pony wall, right side
  addToilet(s, M, RW / 2 - 0.26, 0.45, -Math.PI / 2);
  s.add(mk(new THREE.BoxGeometry(0.55, 1.1, 0.09), M.matteWhite, RW / 2 - 0.275, 0.55, -0.02));
  s.add(mk(new THREE.BoxGeometry(0.57, 0.04, 0.11), M.white, RW / 2 - 0.275, 1.12, -0.02));
  // Paper holder on pony wall
  const tp = mk(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12), M.chrome, RW / 2 - 0.5, 0.78, 0.05);
  tp.rotation.x = Math.PI / 2;
  s.add(tp);

  // Closet, back-right
  addClosetDoors(s, M, RW / 2 - 0.52, -RD / 2 + 0.01, 0.95);

  // Entry door, front wall
  addPanelDoor(s, M, -0.35, RD / 2, 0.8, true);

  addTowelBar(s, M, RW / 2 - 0.06, 1.2, 0.95, 0.52, true);
  addCeilingLight(s, M, 0, -0.1);
}

/* Proposed layout — the sage spa concept: curbless walk-in shower across the
   back-left, oak vanity with brass mirror on the right wall, toilet on the left. */
function buildProposed(s: THREE.Scene, M: Mats) {
  buildRoom(s, M);

  const SAW = 1.4;
  const SAD = 0.8;
  const SAX = -RW / 2 + SAW / 2;
  const SAZ = -RD / 2 + SAD / 2;

  // Raised tray + curb
  s.add(mk(new THREE.BoxGeometry(SAW, 0.06, SAD), new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.12, metalness: 0.05 }), SAX, 0.03, SAZ));
  s.add(mk(new THREE.BoxGeometry(SAW, 0.07, 0.05), M.brass, SAX, 0.035, -RD / 2 + SAD));
  // Glass partition on the open side
  const gp = mk(new THREE.PlaneGeometry(SAD, RH - 0.45), M.glass, SAX + SAW / 2, (RH - 0.45) / 2 + 0.06, SAZ);
  gp.rotation.y = Math.PI / 2;
  s.add(gp);
  s.add(mk(new THREE.BoxGeometry(0.02, RH - 0.45, 0.02), M.brass, SAX + SAW / 2, (RH - 0.45) / 2 + 0.06, SAZ + SAD / 2));

  // Ceiling rain head Ø 25 cm
  s.add(mk(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 12), M.brass, SAX, RH - 0.13, SAZ + 0.05));
  s.add(mk(new THREE.CylinderGeometry(0.125, 0.125, 0.022, 28), M.brass, SAX, RH - 0.27, SAZ + 0.05));
  s.add(
    mk(
      new THREE.CylinderGeometry(0.118, 0.118, 0.01, 28),
      new THREE.MeshStandardMaterial({ color: 0x7a6030, roughness: 0.3, metalness: 0.8 }),
      SAX,
      RH - 0.285,
      SAZ + 0.05,
    ),
  );

  // Hand shower + controls (brass)
  s.add(mk(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 12), M.brass, SAX - SAW / 2 + 0.2, 1.85, -RD / 2 + 0.12, -0.3));
  s.add(mk(new THREE.CylinderGeometry(0.048, 0.048, 0.018, 18), M.brass, SAX - SAW / 2 + 0.2, 1.64, -RD / 2 + 0.17, Math.PI / 2));
  s.add(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 14), M.brass, -RW / 2 + 0.12, 1.02, -RD / 2 + 0.3, 0, 0, Math.PI / 2));
  s.add(mk(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 14), M.brass, -RW / 2 + 0.12, 1.18, -RD / 2 + 0.3, 0, 0, Math.PI / 2));

  // Tiled niche 32 × 14 cm
  s.add(mk(new THREE.BoxGeometry(0.32, 0.14, 0.09), new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.2 }), SAX - 0.1, 1.28, -RD / 2 + 0.05));

  // Oak vanity with brass mirror, right wall
  addVanity(s, M, "right", 0.35, 1.0, false);

  // Toilet, left wall
  addToilet(s, M, -RW / 2 + 0.26, 0.25, Math.PI / 2);
  const tp = mk(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12), M.brass, -RW / 2 + 0.07, 0.84, 0.62);
  tp.rotation.z = Math.PI / 2;
  tp.rotation.y = Math.PI / 2;
  s.add(tp);

  // Closet, back-right (kept from existing room)
  addClosetDoors(s, M, RW / 2 - 0.45, -RD / 2 + 0.01, 0.8);

  // Entry door, front wall
  addPanelDoor(s, M, -0.35, RD / 2, 0.8, true);

  addTowelBar(s, M, RW / 2 - 0.06, 1.2, 0.95, 0.6, true);
  addCeilingLight(s, M, 0.05, -0.05);
  addCeilingLight(s, M, SAX, SAZ + 0.45);
}

function addLights(s: THREE.Scene) {
  s.add(new THREE.AmbientLight(0xfff5e8, 0.35));
  const sun = new THREE.DirectionalLight(0xfff8f0, 1.1);
  sun.position.set(0.5, 5, 1.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  s.add(sun);
  const top = new THREE.PointLight(0xffe8d0, 9, 7, 1.6);
  top.position.set(0, RH - 0.08, 0);
  s.add(top);
  const front = new THREE.PointLight(0xd8ecf2, 5, 6, 1.8);
  front.position.set(0, 1.7, RD / 2 + 0.4);
  s.add(front);
  const back = new THREE.PointLight(0xffeed0, 4, 5, 1.8);
  back.position.set(0, 1.9, -RD / 2 + 0.3);
  s.add(back);
}

/* ── Minimap geometry (room coords → SVG coords) ──────────── */

const MAP_W = 120;
const MAP_H = 150;
const mx = (x: number) => ((x + RW / 2) / RW) * MAP_W;
const mz = (z: number) => ((z + RD / 2) / RD) * MAP_H;

interface MapRect {
  x: number;
  z: number;
  w: number;
  d: number;
  fill: string;
}

const MAP_RECTS: Record<LayoutId, MapRect[]> = {
  current: [
    { x: -1.0, z: -1.25, w: 0.85, d: 0.85, fill: "#9bb3c4" }, // shower cabin
    { x: -1.0, z: -0.09, w: 0.48, d: 0.88, fill: "#7D5A3C" }, // vanity
    { x: 0.55, z: 0.25, w: 0.45, d: 0.45, fill: "#e8e6e1" }, // toilet
    { x: 0.05, z: -1.25, w: 0.95, d: 0.08, fill: "#d8d4cc" }, // closet
  ],
  proposed: [
    { x: -1.0, z: -1.25, w: 1.4, d: 0.8, fill: "#8BA890" }, // walk-in shower
    { x: 0.52, z: -0.15, w: 0.48, d: 1.0, fill: "#7D5A3C" }, // vanity
    { x: -1.0, z: 0.0, w: 0.45, d: 0.5, fill: "#e8e6e1" }, // toilet
    { x: 0.05, z: -1.25, w: 0.8, d: 0.08, fill: "#d8d4cc" }, // closet
  ],
};

/* ── Component ────────────────────────────────────────────── */

export default function Bathroom360Viewer({ labels }: { labels: ViewerLabels }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [layout, setLayout] = useState<LayoutId>("current");
  const [viewpoint, setViewpoint] = useState<ViewpointId>("entrance");
  const [touring, setTouring] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [hintVisible, setHintVisible] = useState(true);

  // Mutable view state shared with the render loop
  const view = useRef({
    yaw: VIEWPOINTS.current[0].yaw,
    pitch: VIEWPOINTS.current[0].pitch,
    pos: new THREE.Vector3(...VIEWPOINTS.current[0].pos),
    posTarget: null as THREE.Vector3 | null,
    yawTarget: null as number | null,
    pitchTarget: null as number | null,
    fov: 72,
    tour: null as { keys: TourKey[]; start: number } | null,
    showLabels: true,
  });

  useEffect(() => {
    view.current.showLabels = showLabels;
  }, [showLabels]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const v = view.current;
    const start = VIEWPOINTS[layout][0];
    v.pos.set(...start.pos);
    v.yaw = start.yaw;
    v.pitch = start.pitch;
    v.posTarget = null;
    v.yawTarget = null;
    v.pitchTarget = null;
    v.tour = null;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.92;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Environment map so brass, mirror and glass pick up realistic reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.28;

    const camera = new THREE.PerspectiveCamera(v.fov, canvas.clientWidth / canvas.clientHeight, 0.04, 20);
    camera.position.copy(v.pos);

    const M = makeMats(layout);
    addLights(scene);
    if (layout === "current") buildCurrent(scene, M);
    else buildProposed(scene, M);

    const anchors = LABEL_ANCHORS[layout];
    const anchorVecs = anchors.map((a) => new THREE.Vector3(...a.pos));
    const projected = new THREE.Vector3();

    const clampPos = (p: THREE.Vector3) => {
      p.x = Math.max(-RW / 2 + 0.3, Math.min(RW / 2 - 0.3, p.x));
      p.z = Math.max(-RD / 2 + 0.3, Math.min(RD / 2 - 0.3, p.z));
    };

    const updateCam = () => {
      const pl = Math.PI / 2.15;
      v.pitch = Math.max(-pl, Math.min(pl, v.pitch));
      camera.position.copy(v.pos);
      camera.lookAt(
        v.pos.x + Math.sin(v.yaw) * Math.cos(v.pitch),
        v.pos.y + Math.sin(v.pitch),
        v.pos.z + Math.cos(v.yaw) * Math.cos(v.pitch),
      );
    };

    const smoothstep = (t: number) => t * t * (3 - 2 * t);

    let animId = 0;
    const loop = () => {
      animId = requestAnimationFrame(loop);

      // Cinematic tour interpolation
      if (v.tour) {
        const keys = v.tour.keys;
        const total = keys[keys.length - 1].t;
        const t = ((performance.now() - v.tour.start) / 1000) % total;
        let i = 0;
        while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
        const a = keys[i];
        const b = keys[i + 1];
        const f = smoothstep((t - a.t) / (b.t - a.t));
        v.pos.set(
          a.p[0] + (b.p[0] - a.p[0]) * f,
          a.p[1] + (b.p[1] - a.p[1]) * f,
          a.p[2] + (b.p[2] - a.p[2]) * f,
        );
        v.yaw = a.yaw + (b.yaw - a.yaw) * f;
        v.pitch = a.pitch + (b.pitch - a.pitch) * f;
      } else {
        // Smooth approach to viewpoint targets
        if (v.posTarget) {
          v.pos.lerp(v.posTarget, 0.06);
          if (v.pos.distanceTo(v.posTarget) < 0.01) v.posTarget = null;
        }
        if (v.yawTarget !== null) {
          let d = v.yawTarget - v.yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          v.yaw += d * 0.07;
          if (Math.abs(d) < 0.005) v.yawTarget = null;
        }
        if (v.pitchTarget !== null) {
          v.pitch += (v.pitchTarget - v.pitch) * 0.07;
          if (Math.abs(v.pitchTarget - v.pitch) < 0.005) v.pitchTarget = null;
        }
      }

      const targetFov = v.fov;
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * 0.2;
        camera.updateProjectionMatrix();
      }

      updateCam();

      // Project scene labels to screen space
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      anchors.forEach((a, idx) => {
        const el = labelRefs.current.get(a.key);
        if (!el) return;
        if (!v.showLabels) {
          el.style.opacity = "0";
          return;
        }
        projected.copy(anchorVecs[idx]).project(camera);
        const behind = projected.z > 1;
        const sx = (projected.x * 0.5 + 0.5) * w;
        const sy = (-projected.y * 0.5 + 0.5) * h;
        const visible = !behind && sx > 0 && sx < w && sy > 0 && sy < h;
        el.style.opacity = visible ? "1" : "0";
        if (visible) el.style.transform = `translate(-50%, -100%) translate(${sx}px, ${sy}px)`;
      });

      renderer.render(scene, camera);
    };
    loop();

    // ── Pointer controls ──
    let dragging = false;
    let prev: { x: number; y: number } | null = null;

    const stopAuto = () => {
      v.tour = null;
      v.posTarget = null;
      v.yawTarget = null;
      v.pitchTarget = null;
      setTouring(false);
      setHintVisible(false);
    };

    const onDown = (e: PointerEvent) => {
      dragging = true;
      prev = { x: e.clientX, y: e.clientY };
      stopAuto();
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || !prev) return;
      v.yaw += (e.clientX - prev.x) * 0.004;
      v.pitch -= (e.clientY - prev.y) * 0.003;
      prev = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      dragging = false;
      prev = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      v.fov = Math.max(34, Math.min(95, v.fov + e.deltaY * 0.04));
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(canvas);

    // Clamp any externally-set position targets
    const clampInterval = window.setInterval(() => {
      if (v.posTarget) clampPos(v.posTarget);
    }, 500);

    return () => {
      cancelAnimationFrame(animId);
      window.clearInterval(clampInterval);
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as THREE.Mesh).material;
        if (mat) {
          for (const m of Array.isArray(mat) ? mat : [mat]) {
            const std = m as THREE.MeshStandardMaterial;
            if (std.map) std.map.dispose();
            m.dispose();
          }
        }
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [layout]);

  const goToViewpoint = (id: ViewpointId) => {
    const vp = VIEWPOINTS[layout].find((p) => p.id === id);
    if (!vp) return;
    const v = view.current;
    v.tour = null;
    setTouring(false);
    setHintVisible(false);
    v.posTarget = new THREE.Vector3(...vp.pos);
    v.yawTarget = vp.yaw;
    v.pitchTarget = vp.pitch;
    setViewpoint(id);
  };

  const toggleTour = () => {
    const v = view.current;
    if (touring) {
      v.tour = null;
      setTouring(false);
    } else {
      setHintVisible(false);
      v.tour = { keys: TOURS[layout], start: performance.now() };
      setTouring(true);
    }
  };

  const switchLayout = (next: LayoutId) => {
    if (next === layout) return;
    setTouring(false);
    setViewpoint("entrance");
    setLayout(next);
  };

  const viewpointName: Record<ViewpointId, string> = {
    entrance: labels.viewpoints.entrance,
    center: labels.viewpoints.center,
    shower: labels.viewpoints.shower,
    vanity: labels.viewpoints.vanity,
  };

  return (
    <div>
      {/* Layout tabs */}
      <div className="flex justify-center">
        <div className="inline-flex overflow-hidden rounded-lg border border-white/15">
          {(["current", "proposed"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => switchLayout(id)}
              className={`min-h-11 px-6 text-sm font-semibold tracking-wide transition ${
                layout === id
                  ? "bg-[#8BA890] text-white"
                  : "bg-transparent text-white/55 hover:text-white"
              }`}
            >
              {id === "current" ? labels.tabCurrent : labels.tabProposed}
            </button>
          ))}
        </div>
      </div>

      {/* Viewer */}
      <div ref={wrapRef} className="relative mt-5 overflow-hidden rounded-xl shadow-[0_32px_100px_rgba(0,0,0,0.55)]">
        <canvas
          ref={canvasRef}
          className="block h-[420px] w-full cursor-grab touch-none active:cursor-grabbing sm:h-[560px]"
        />

        {/* Badge */}
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-black/55 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/90 backdrop-blur">
          {layout === "current" ? labels.badgeCurrent : labels.badgeProposed}
          {touring ? " · ▶" : ""}
        </div>

        {/* Hint */}
        <div
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/50 px-4 py-1.5 text-xs text-white/75 backdrop-blur transition-opacity duration-700 ${
            hintVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          {labels.hint}
        </div>

        {/* Scene labels (projected from 3D) */}
        {LABEL_ANCHORS[layout].map((a) => (
          <div
            key={`${layout}-${a.key}`}
            ref={(el) => {
              if (el) labelRefs.current.set(a.key, el);
              else labelRefs.current.delete(a.key);
            }}
            className="pointer-events-none absolute left-0 top-0 rounded-md bg-[#0F3D56]/85 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300"
          >
            {labels.sceneLabels[a.key]}
          </div>
        ))}

        {/* Minimap with viewing points */}
        <div className="absolute bottom-4 right-4 hidden rounded-xl bg-black/55 p-3 backdrop-blur sm:block">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            {labels.minimapTitle}
          </p>
          <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true">
            <rect x="1" y="1" width={MAP_W - 2} height={MAP_H - 2} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.35)" strokeWidth="2" rx="4" />
            {MAP_RECTS[layout].map((r, i) => (
              <rect
                key={i}
                x={mx(r.x)}
                y={mz(r.z)}
                width={(r.w / RW) * MAP_W}
                height={(r.d / RD) * MAP_H}
                fill={r.fill}
                opacity="0.85"
                rx="2"
              />
            ))}
            {/* door gap on the front edge */}
            <line x1={mx(-0.75)} y1={MAP_H - 1} x2={mx(0.05)} y2={MAP_H - 1} stroke="#111" strokeWidth="4" />
            {VIEWPOINTS[layout].map((vp) => (
              <g key={vp.id} className="cursor-pointer" onClick={() => goToViewpoint(vp.id)}>
                <circle
                  cx={mx(vp.pos[0])}
                  cy={mz(vp.pos[2])}
                  r="9"
                  fill={viewpoint === vp.id ? "#C9A840" : "rgba(255,255,255,0.25)"}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <circle cx={mx(vp.pos[0])} cy={mz(vp.pos[2])} r="3" fill="#fff" />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Controls under the canvas */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {VIEWPOINTS[layout].map((vp) => (
          <button
            key={vp.id}
            type="button"
            onClick={() => goToViewpoint(vp.id)}
            className={`min-h-10 rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.12em] transition ${
              viewpoint === vp.id && !touring
                ? "border-[#C9A840] bg-[#C9A840]/15 text-[#C9A840]"
                : "border-white/15 text-white/60 hover:border-white/35 hover:text-white"
            }`}
          >
            {viewpointName[vp.id]}
          </button>
        ))}

        <span className="mx-1 hidden h-5 w-px bg-white/15 sm:block" />

        <button
          type="button"
          onClick={toggleTour}
          className={`flex min-h-10 items-center gap-2 rounded-full px-5 text-xs font-bold uppercase tracking-[0.12em] transition ${
            touring
              ? "bg-[#C9A840] text-[#0F3D56]"
              : "bg-[#8BA890] text-white hover:brightness-110"
          }`}
        >
          <PlayCircle size={16} />
          {touring ? labels.tourStop : labels.tourPlay}
        </button>

        <button
          type="button"
          onClick={() => setShowLabels((s) => !s)}
          className="min-h-10 rounded-full border border-white/15 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white/60 transition hover:border-white/35 hover:text-white"
        >
          {showLabels ? labels.labelsHide : labels.labelsShow}
        </button>
      </div>
    </div>
  );
}
