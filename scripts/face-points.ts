/**
 * Builds the hero faces (apps/web/public/faces/<name>.bin) from MakeHuman's CC0 assets. For each
 * avatar in AVATARS: the base mesh with its morph targets applied and a CC0 hairstyle fitted to it
 * (optionally restyled with a mid-part and soft waves), seen from the front on a regular grid (a
 * depth map with smooth normals), with eyeballs at the mesh's eye joints and a dithered fade below
 * the chin. Synthetic, not scans of real people. Rerun after changing them: bun run face:points
 * (the first run downloads MakeHuman's 280 MB asset pack into .cache/). `--only <name>` builds one
 * avatar, and `--out <dir>` writes somewhere else, for trying settings without touching the site.
 *
 * Format: little-endian Int16 records of x, y, z, nx, ny, nz; positions in units of FACE_SCALE
 * (y up, the face roughly within ±1.1), normals in units of 1 / 32767, scaled by the surface's
 * albedo (so hair, a darker surface, has shorter normals).
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { FACE_SCALE, FACE_STEP, FACES } from "../apps/web/src/shared/face";

/** MakeHuman's repository at a fixed commit; its assets are CC0 1.0 (makehuman/license.txt, section C). */
const SOURCE =
  "https://raw.githubusercontent.com/makehumancommunity/makehuman/a8bc2d54ff0ac92e78ff71431b1023eda42bf482";
const MESH = `${SOURCE}/makehuman/data/3dobjs/base.obj`;
/** MakeHuman's system assets, CC0 since September 2020 (each file's header says so). */
const PACK = "https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip";

type Target = readonly [path: string, weight: number];

interface Avatar {
  /** Morph targets and their weights, applied as MakeHuman's sliders would be. */
  readonly targets: readonly Target[];
  /** A hairstyle from the asset pack, fitted to the morphed body. */
  readonly hair: string;
  /** A mid-part down the center of the hair on top. */
  readonly part?: boolean;
  /** Soft waves below the temples. */
  readonly waves?: boolean;
  /** Mesh units below the top of the scalp where the hair in front of the ears ends, trimming the sideburns. */
  readonly sideburns?: number;
  /** A coiled bun on the crown. */
  readonly bun?: boolean;
  /** How much light the skin and hair return, 0–1. */
  readonly skin: number;
  readonly hairAlbedo: number;
  /** Mesh units from the top of the hair to just under the chin that fill the frame (HEAD_HEIGHT by default). */
  readonly frame?: number;
  /** Output units to move the face up within the frame, so every face's eyes sit at the same height. */
  readonly raise?: number;
}

/** The faces, by the name of their file; FACES (shared with the site) lists the ones it shows. */
const AVATARS: Readonly<Record<(typeof FACES)[number], Avatar>> = {
  "asian-woman": {
    targets: [
      ["macrodetails/asian-female-young", 1],
      // Slightly larger eyes.
      ["eyes/l-eye-scale-incr", 0.4],
      ["eyes/r-eye-scale-incr", 0.4],
      // A little slimmer: lower body weight, and less volume in the cheeks.
      ["macrodetails/universal-female-young-averagemuscle-minweight", 0.35],
      ["cheek/l-cheek-volume-decr", 0.3],
      ["cheek/r-cheek-volume-decr", 0.3],
      // Slightly more pronounced cheekbones.
      ["cheek/l-cheek-bones-incr", 0.35],
      ["cheek/r-cheek-bones-incr", 0.35],
      // Slimmer lower cheeks.
      ["cheek/l-cheek-inner-decr", 0.3],
      ["cheek/r-cheek-inner-decr", 0.3],
      ["head/head-fat-decr", 0.25],
    ],
    hair: "hair/long01/long01",
    part: true,
    waves: true,
    skin: 1,
    hairAlbedo: 0.42,
  },
  "black-man": {
    targets: [
      ["macrodetails/african-male-young", 1],
      // Lips closed and relaxed: the male base mesh's lips sit slightly apart.
      ["expression/units/african/mouth-compression", 0.45],
      // MakeHuman's ideal proportions, for an even, natural face.
      ["macrodetails/proportions/male-young-averagemuscle-averageweight-idealproportions", 1],
      // Open eyes with less under-eye puffiness and a slightly lifted brow, so they don't read as a squint.
      ["expression/units/african/eye-left-opened-up", 0.35],
      ["expression/units/african/eye-right-opened-up", 0.35],
      ["eyes/l-eye-bag-decr", 0.5],
      ["eyes/r-eye-bag-decr", 0.5],
      ["eyebrows/eyebrows-trans-up", 0.15],
      // Softer lines from nose to mouth.
      ["mouth/mouth-laugh-lines-in", 0.4],
      // Slightly larger eyes.
      ["eyes/l-eye-scale-incr", 0.2],
      ["eyes/r-eye-scale-incr", 0.2],
    ],
    hair: "hair/short04/short04",
    // Sideburns trimmed to the top of the ear.
    sideburns: 1.15,
    // Darker skin returns less light, though not so little that the eye sockets read as holes.
    skin: 0.78,
    hairAlbedo: 0.2,
    frame: 2.405,
    raise: 0.043,
  },
  "white-woman": {
    targets: [
      ["macrodetails/caucasian-female-young", 1],
      // A little slimmer, as for the first face.
      ["macrodetails/universal-female-young-averagemuscle-minweight", 0.35],
      ["cheek/l-cheek-volume-decr", 0.3],
      ["cheek/r-cheek-volume-decr", 0.3],
    ],
    // Hair pulled back into a bun on the crown; lighter hair than the others.
    hair: "hair/ponytail01/ponytail01",
    bun: true,
    skin: 1,
    hairAlbedo: 0.5,
    frame: 2.4,
    raise: 0.028,
  },
};

/** Mesh units (decimeters) from the top of the hair to just under the chin; maps to 2.2 output units. */
const HEAD_HEIGHT = 2.3;
/** Waves, in mesh units below the top of the scalp: where they begin and reach full amplitude, their length, and their amplitude. */
const WAVES = { start: 0.8, full: 1.6, length: 0.6, amplitude: 0.08 };
/**
 * The mid-part, in mesh units: where it runs (a hair off center, on a grid column, so it draws as one
 * line), the gap of scalp it leaves, the band of hair squeezed up to it, and how far down it runs.
 */
const PART = { x: FACE_STEP / 2 / (2.2 / HEAD_HEIGHT), gap: 0.012, band: 0.15, depth: 0.9 };
/**
 * The bun, in mesh units: its radius, how much flatter it is than round, where it sits relative to the
 * top of the scalp (up) and the head's axis (back), and the coils of hair wound around it.
 */
const BUN = { radius: 0.33, squash: 0.75, up: -0.05, back: 0.3, coils: 3, ripple: 0.1 };
/** How much light the eyes return: the white, and the iris. */
const EYE_ALBEDO = { white: 0.7, iris: 0.22 };
/** How far behind its neighbors (output units) a cell must be to count as a hole. */
const HOLE_DEPTH = 0.06;
const HOLE_PASSES = 4;
/** The iris radius as a share of the eyeball's. */
const IRIS = 0.5;
/** The eyeball radius in mesh units (a 24 mm eye). */
const EYE_RADIUS = 0.12;
/** The oval, in output units, beyond which points fade out over EDGE. */
const OVAL = { x: 1, y: 1.1, centerY: 0.12 };
const EDGE = 0.16;

type Vec = [number, number, number];

const text = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return response.text();
};

const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length = (a: Vec): number => Math.hypot(...a);
const smoothstep = (from: number, to: number, value: number): number => {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/** A small deterministic generator, so an asset only changes when its inputs do. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The pack is large, so it's fetched once and read with unzip. */
async function packFile(path: string): Promise<string> {
  const zip = resolve(import.meta.dir, "../.cache/makehuman_system_assets_cc0.zip");
  if (!existsSync(zip)) {
    console.log(`Downloading ${PACK}…`);
    await Bun.write(zip, await fetch(PACK));
  }
  return Bun.$`unzip -p ${zip} ${path}`.text();
}

interface BaseMesh {
  readonly vertices: readonly Vec[];
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly eyes: ReadonlyMap<string, ReadonlySet<number>>;
}

function parseBaseMesh(obj: string): BaseMesh {
  const vertices: Vec[] = [];
  const triangles: [number, number, number][] = [];
  const eyes = new Map<string, Set<number>>([
    ["joint-l-eye", new Set()],
    ["joint-r-eye", new Set()],
  ]);
  let group = "";
  for (const line of obj.split("\n")) {
    const [kind, ...rest] = line.trim().split(/\s+/);
    if (kind === "v") {
      vertices.push(rest.slice(0, 3).map(Number) as Vec);
    } else if (kind === "g") {
      group = rest[0] ?? "";
    } else if (kind === "f" && group === "body") {
      const corners = rest.map((corner) => Number(corner.split("/")[0]) - 1);
      for (let index = 1; index + 1 < corners.length; index++) {
        triangles.push([corners[0]!, corners[index]!, corners[index + 1]!]);
      }
    } else if (kind === "f" && eyes.has(group)) {
      for (const corner of rest) {
        eyes.get(group)!.add(Number(corner.split("/")[0]) - 1);
      }
    }
  }
  return { vertices, triangles, eyes };
}

async function buildFace(base: BaseMesh, avatar: Avatar): Promise<Int16Array> {
  const [hairObj, hairFit, ...targets] = await Promise.all([
    packFile(`${avatar.hair}.obj`),
    packFile(`${avatar.hair}.mhclo`),
    ...avatar.targets.map(([path]) => text(`${SOURCE}/makehuman/data/targets/${path}.target`)),
  ]);
  const vertices: Vec[] = base.vertices.map((vertex) => [...vertex]);
  const triangles: [number, number, number][] = base.triangles.map((triangle) => [...triangle]);

  for (const [position, target] of targets.entries()) {
    const weight = avatar.targets[position]![1];
    for (const line of target.split("\n")) {
      if (!line || line.startsWith("#")) {
        continue;
      }
      const [index, dx, dy, dz] = line.trim().split(/\s+/).map(Number);
      const vertex = vertices[index!]!;
      vertex[0] += dx! * weight;
      vertex[1] += dy! * weight;
      vertex[2] += dz! * weight;
    }
  }

  // Fit the hair as MakeHuman does: each vertex is a weighted sum of three body vertices plus an
  // offset scaled by the body's own measurements (x_scale etc. name two vertices and a reference).
  const scales: Record<string, number> = {};
  const hairVertices: Vec[] = [];
  let fitting = false;
  for (const line of hairFit.split("\n")) {
    const fields = line.trim().split(/\s+/);
    if (/^[xyz]_scale$/.test(fields[0]!)) {
      const axis = "xyz".indexOf(fields[0]![0]!);
      const [a, b, reference] = fields.slice(1).map(Number);
      scales[axis] = Math.abs(vertices[a!]![axis]! - vertices[b!]![axis]!) / reference!;
    } else if (fields[0] === "verts") {
      fitting = true;
    } else if (fitting && fields.length === 9 && fields.every((field) => Number.isFinite(Number(field)))) {
      const [a, b, c, wa, wb, wc, dx, dy, dz] = fields.map(Number);
      const offset = [dx!, dy!, dz!];
      hairVertices.push(
        [0, 1, 2].map(
          (axis) =>
            wa! * vertices[a!]![axis]! +
            wb! * vertices[b!]![axis]! +
            wc! * vertices[c!]![axis]! +
            offset[axis]! * scales[axis]!,
        ) as Vec,
      );
    }
  }
  // Style the hair: a mid-part, where the hair on top is cut along the part and the hair on each side
  // is squeezed up to it, leaving a thin line of scalp, and soft waves below the temples, rippling the
  // hair outward from the head's axis.
  const scalpTop = Math.max(...triangles.flat().map((index) => vertices[index]![1]));
  const scalpZs = triangles
    .flat()
    .filter((index) => vertices[index]![1] > scalpTop - HEAD_HEIGHT)
    .map((index) => vertices[index]![2]);
  const axisZ = (Math.min(...scalpZs) + Math.max(...scalpZs)) / 2;
  const inPart = ([, y, z]: Vec): boolean => Boolean(avatar.part) && scalpTop - y < PART.depth && z > axisZ;
  /** Which side of the part each hair vertex lies on (0 outside it), before styling moves it. */
  const partSide = hairVertices.map((vertex) => (inPart(vertex) ? Math.sign(vertex[0] - PART.x) : 0));
  for (const vertex of hairVertices) {
    const [x, y, z] = vertex;
    const below = scalpTop - y;
    const fromPart = Math.abs(x - PART.x);
    if (inPart(vertex) && fromPart < PART.band) {
      // Within the band, distances from the part map from [0, band] onto [gap / 2, band].
      vertex[0] = PART.x + Math.sign(x - PART.x) * (PART.gap / 2 + fromPart * (1 - PART.gap / 2 / PART.band));
    }
    const ramp = avatar.waves ? smoothstep(WAVES.start, WAVES.full, below) : 0;
    if (ramp > 0) {
      const [dx, dz] = [x, z - axisZ];
      const radius = Math.hypot(dx, dz) || 1;
      const offset = WAVES.amplitude * ramp * Math.sin((2 * Math.PI * below) / WAVES.length);
      vertex[0] += (dx / radius) * offset;
      vertex[2] += (dz / radius) * offset;
    }
  }

  const hairTriangles: [number, number, number][] = [];
  for (const line of hairObj.split("\n")) {
    const [kind, ...rest] = line.trim().split(/\s+/);
    if (kind === "f") {
      const corners = rest.map((corner) => Number(corner.split("/")[0]) - 1 + vertices.length);
      for (let index = 1; index + 1 < corners.length; index++) {
        const triangle: [number, number, number] = [corners[0]!, corners[index]!, corners[index + 1]!];
        const sides = triangle.map((corner) => partSide[corner - vertices.length]!);
        const trimmed = triangle.some((corner) => {
          const [, y, z] = hairVertices[corner - vertices.length]!;
          return scalpTop - y > (avatar.sideburns ?? Infinity) && z > axisZ;
        });
        // Hair doesn't bridge the part.
        if (!trimmed && !(sides.includes(1) && sides.includes(-1))) {
          hairTriangles.push(triangle);
        }
      }
    }
  }

  // The bun: a flattened sphere whose radius ripples along a spiral, like hair wound around itself.
  // It's left out of the framing, so the face sits where it would without it.
  const styledHair = hairTriangles.length;
  if (avatar.bun) {
    const [rings, segments] = [24, 48];
    const first = vertices.length + hairVertices.length;
    for (let ring = 0; ring <= rings; ring++) {
      const phi = (Math.PI * ring) / rings;
      for (let segment = 0; segment < segments; segment++) {
        const theta = (2 * Math.PI * segment) / segments;
        const radius = BUN.radius * (1 + BUN.ripple * Math.sin(2 * BUN.coils * phi + theta));
        hairVertices.push([
          radius * Math.sin(phi) * Math.cos(theta),
          scalpTop + BUN.up + radius * BUN.squash * Math.cos(phi),
          axisZ - BUN.back + radius * Math.sin(phi) * Math.sin(theta),
        ]);
      }
    }
    for (let ring = 0; ring < rings; ring++) {
      for (let segment = 0; segment < segments; segment++) {
        const [a, b] = [ring * segments + segment, ring * segments + ((segment + 1) % segments)].map(
          (index) => first + index,
        );
        hairTriangles.push([a!, a! + segments, b!], [b!, a! + segments, b! + segments]);
      }
    }
  }

  const bodyTriangles = triangles.length;
  vertices.push(...hairVertices);
  triangles.push(...hairTriangles);

  // Area-weighted vertex normals over the whole body, so edges between faces stay smooth.
  const normals: Vec[] = vertices.map(() => [0, 0, 0]);
  for (const [a, b, c] of triangles) {
    const n = cross(sub(vertices[b]!, vertices[a]!), sub(vertices[c]!, vertices[a]!));
    for (const corner of [a, b, c]) {
      for (let axis = 0; axis < 3; axis++) {
        normals[corner]![axis]! += n[axis]!;
      }
    }
  }

  const body = triangles.slice(0, bodyTriangles);
  const top = Math.max(
    ...triangles
      .slice(0, bodyTriangles + styledHair)
      .flat()
      .map((index) => vertices[index]![1]),
  );
  const frame = avatar.frame ?? HEAD_HEIGHT;
  const head = body.flat().filter((index) => vertices[index]![1] > top - frame);
  const zs = head.map((index) => vertices[index]![2]);
  const scale = 2.2 / frame;
  const center: Vec = [0, top - frame / 2 - (avatar.raise ?? 0) / scale, (Math.min(...zs) + Math.max(...zs)) / 2];
  const toOutput = (p: Vec): Vec => [
    (p[0] - center[0]) * scale,
    (p[1] - center[1]) * scale,
    (p[2] - center[2]) * scale,
  ];

  // The front-most surface at each grid point: a depth buffer with an interpolated normal.
  const columns = Math.ceil(2 / FACE_STEP);
  // Rows run up past the top of the hair (1.1) to leave room for a bun.
  const rows = Math.ceil(2.6 / FACE_STEP);
  const depth = new Float64Array(columns * rows).fill(-Infinity);
  const normal: Vec[] = Array.from({ length: columns * rows }, () => [0, 0, 1]);
  const albedo = new Float64Array(columns * rows).fill(avatar.skin);
  /** Cells whose front surface is skin (not hair or eye), the only surface holes are filled from. */
  const skin = new Uint8Array(columns * rows);
  /** Cells whose front surface is the bun, which stands above the oval and so doesn't fade with it. */
  const crown = new Uint8Array(columns * rows);
  const gridX = (column: number): number => -1 + (column + 0.5) * FACE_STEP;
  const gridY = (row: number): number => -1.2 + (row + 0.5) * FACE_STEP;

  for (const [triangle, [a, b, c]] of triangles.entries()) {
    const [pa, pb, pc] = [a, b, c].map((index) => toOutput(vertices[index]!));
    if (Math.max(pa![1], pb![1], pc![1]) < -1.2) {
      continue;
    }
    const area = (pb![0] - pa![0]) * (pc![1] - pa![1]) - (pc![0] - pa![0]) * (pb![1] - pa![1]);
    if (Math.abs(area) < 1e-12) {
      continue;
    }
    const [minX, maxX] = [Math.min(pa![0], pb![0], pc![0]), Math.max(pa![0], pb![0], pc![0])];
    const [minY, maxY] = [Math.min(pa![1], pb![1], pc![1]), Math.max(pa![1], pb![1], pc![1])];
    for (
      let column = Math.max(0, Math.ceil((minX + 1) / FACE_STEP - 0.5));
      column < columns && gridX(column) <= maxX;
      column++
    ) {
      for (let row = Math.max(0, Math.ceil((minY + 1.2) / FACE_STEP - 0.5)); row < rows && gridY(row) <= maxY; row++) {
        const [x, y] = [gridX(column), gridY(row)];
        const u = ((pc![0] - x) * (pa![1] - y) - (pa![0] - x) * (pc![1] - y)) / area;
        const v = ((pa![0] - x) * (pb![1] - y) - (pb![0] - x) * (pa![1] - y)) / area;
        const w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) {
          continue;
        }
        // u weighs b, v weighs c, w weighs a.
        const z = w * pa![2] + u * pb![2] + v * pc![2];
        const cell = row * columns + column;
        if (z > depth[cell]!) {
          depth[cell] = z;
          const n = [0, 1, 2].map(
            (axis) => w * normals[a]![axis]! + u * normals[b]![axis]! + v * normals[c]![axis]!,
          ) as Vec;
          // Hair cards are wound either way; light them from the side facing the screen.
          normal[cell] = triangle >= bodyTriangles && n[2] < 0 ? (n.map((value) => -value) as Vec) : n;
          albedo[cell] = triangle >= bodyTriangles ? avatar.hairAlbedo : avatar.skin;
          skin[cell] = triangle >= bodyTriangles ? 0 : 1;
          crown[cell] = triangle >= bodyTriangles + styledHair ? 1 : 0;
        }
      }
    }
  }

  // Eyeballs fill the mesh's eye openings.
  for (const indices of base.eyes.values()) {
    const joint = [...indices].map((index) => vertices[index]!);
    const eye = toOutput([0, 1, 2].map((axis) => joint.reduce((sum, p) => sum + p[axis]!, 0) / joint.length) as Vec);
    const radius = EYE_RADIUS * scale;
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const [dx, dy] = [gridX(column) - eye[0], gridY(row) - eye[1]];
        const inside = radius ** 2 - dx ** 2 - dy ** 2;
        const cell = row * columns + column;
        if (inside > 0 && eye[2] + Math.sqrt(inside) > depth[cell]!) {
          depth[cell] = eye[2] + Math.sqrt(inside);
          normal[cell] = [dx, dy, Math.sqrt(inside)];
          skin[cell] = 0;
          albedo[cell] = Math.hypot(dx, dy) < IRIS * radius ? EYE_ALBEDO.iris : EYE_ALBEDO.white;
        }
      }
    }
  }

  // Fill small holes (parted lips) from their neighbors: a cell well behind the cells around it
  // takes their average depth and normal. Later passes fill only from skin, closing a lip gap a few
  // cells tall from its edges without eating into gaps in the hair.
  for (let pass = 0; pass < HOLE_PASSES; pass++) {
    const filled = Float64Array.from(depth);
    let changed = false;
    for (let row = 1; row < rows - 1; row++) {
      for (let column = 1; column < columns - 1; column++) {
        const cell = row * columns + column;
        const around = [cell - 1, cell + 1, cell - columns, cell + columns, cell - columns - 1, cell + columns + 1];
        const near = around.filter(
          (other) =>
            (pass === 0 || skin[other] === 1) &&
            Number.isFinite(depth[other]!) &&
            depth[other]! - depth[cell]! > HOLE_DEPTH,
        );
        if (near.length >= 4) {
          filled[cell] = near.reduce((sum, other) => sum + depth[other]!, 0) / near.length;
          normal[cell] = [0, 1, 2].map((axis) => near.reduce((sum, other) => sum + normal[other]![axis]!, 0)) as Vec;
          albedo[cell] = avatar.skin;
          skin[cell] = 1;
          changed = true;
        }
      }
    }
    depth.set(filled);
    if (!changed) {
      break;
    }
  }

  const next = random(7);
  const records: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const cell = row * columns + column;
      const [x, y, z] = [gridX(column), gridY(row), depth[cell]!];
      const oval = Math.hypot(x / OVAL.x, (y - OVAL.centerY) / OVAL.y);
      // A dithered edge: points thin out across EDGE past the oval instead of stopping on a line.
      if (!Number.isFinite(z) || (!crown[cell] && oval > 1 + EDGE * next())) {
        continue;
      }
      const n = normal[cell]!;
      const size = length(n) || 1;
      records.push(
        Math.round(x / FACE_SCALE),
        Math.round(y / FACE_SCALE),
        Math.round(z / FACE_SCALE),
        ...n.map((value) => Math.round((value / size) * albedo[cell]! * 32_767)),
      );
    }
  }
  return Int16Array.from(records);
}

const { values: options } = parseArgs({
  options: { only: { type: "string" }, out: { type: "string" } },
});
const directory = resolve(options.out ?? resolve(import.meta.dir, "../apps/web/public/faces"));
await mkdir(directory, { recursive: true });
const base = parseBaseMesh(await text(MESH));
for (const name of FACES) {
  if (options.only && options.only !== name) {
    continue;
  }
  const out = await buildFace(base, AVATARS[name]);
  const file = resolve(directory, `${name}.bin`);
  await Bun.write(file, out.buffer);
  console.log(`Wrote ${out.length / 6} points (${out.byteLength} bytes) to ${file}`);
}
