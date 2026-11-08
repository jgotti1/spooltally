/** Density in g/cm^3 for common filament materials, used to turn an STL's volume into an estimated weight. */
export const MATERIAL_DENSITIES_G_CM3: Record<string, number> = {
  PLA: 1.24,
  "PLA+": 1.24,
  PETG: 1.27,
  ABS: 1.04,
  ASA: 1.05,
  TPU: 1.21,
  Nylon: 1.15,
  PC: 1.2,
  PVA: 1.23,
};
const DEFAULT_DENSITY_G_CM3 = 1.24;

export function densityFor(material: string): number {
  return MATERIAL_DENSITIES_G_CM3[material] ?? DEFAULT_DENSITY_G_CM3;
}

export type ModelParseResult = {
  grams: number | null;
  printHours: number | null;
  /** "estimated" = derived from mesh volume (STL); "exact" = read from a slicer's own output. */
  accuracy: "estimated" | "exact";
  note?: string;
  /** A data URL for a preview image — a rendered snapshot for STL, or the slicer's own embedded thumbnail for 3MF/G-code. */
  thumbnailDataUrl?: string | null;
};

/** Renders a quick preview snapshot of a parsed mesh so an STL upload has something to look at, same as a slicer's thumbnail. */
async function renderMeshThumbnail(geometry: import("three").BufferGeometry): Promise<string | null> {
  try {
    const THREE = await import("three");
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    if (!sphere) return null;

    const width = 320;
    const height = 240;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height, false);
    renderer.setClearColor(0xf1f5f9, 1);

    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.55, metalness: 0.08 }));
    scene.add(mesh);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(1, 1.3, 1);
    scene.add(dirLight);

    const radius = sphere.radius || 1;
    const center = sphere.center;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, radius * 20);
    camera.position.set(center.x + radius * 1.8, center.y + radius * 1.5, center.z + radius * 1.8);
    camera.lookAt(center);

    renderer.render(scene, camera);
    const dataUrl = canvas.toDataURL("image/png");
    renderer.dispose();
    return dataUrl;
  } catch {
    return null;
  }
}

/** Signed volume (mm^3) of a closed, consistently-wound triangle soup via the divergence theorem. */
function signedVolumeMm3(positions: ArrayLike<number>): number {
  let volume = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const x1 = positions[i], y1 = positions[i + 1], z1 = positions[i + 2];
    const x2 = positions[i + 3], y2 = positions[i + 4], z2 = positions[i + 5];
    const x3 = positions[i + 6], y3 = positions[i + 7], z3 = positions[i + 8];
    volume += (x1 * (y2 * z3 - z2 * y3) - y1 * (x2 * z3 - z2 * x3) + z1 * (x2 * y3 - y2 * x3)) / 6;
  }
  return Math.abs(volume);
}

async function parseStl(file: File, material: string): Promise<ModelParseResult> {
  const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
  const buffer = await file.arrayBuffer();
  const geometry = new STLLoader().parse(buffer);
  const positions = geometry.getAttribute("position").array;
  const volumeCm3 = signedVolumeMm3(positions) / 1000;
  const grams = volumeCm3 * densityFor(material);
  const thumbnailDataUrl = await renderMeshThumbnail(geometry);
  return { grams, printHours: null, accuracy: "estimated", thumbnailDataUrl };
}

/** Looks for the weight/time comments slicers (PrusaSlicer/SuperSlicer, Cura, Bambu/OrcaSlicer) write into G-code. */
function parseSlicerText(text: string): { grams: number | null; printHours: number | null } {
  let grams: number | null = null;
  let printHours: number | null = null;

  const gramsPatterns = [
    /;\s*total filament weight \[g\]\s*:\s*([\d.]+)/i,
    /;\s*filament used \[g\]\s*=\s*([\d.]+)/i,
    /;\s*filament_used_g\s*[:=]\s*([\d.]+)/i,
  ];
  for (const pattern of gramsPatterns) {
    const match = text.match(pattern);
    if (match) {
      grams = parseFloat(match[1]);
      break;
    }
  }

  const hmsMatch = text.match(/;\s*estimated printing time[^=]*=\s*(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/i);
  if (hmsMatch) {
    const [, d, h, m, s] = hmsMatch;
    printHours = (Number(d || 0) * 24) + Number(h || 0) + Number(m || 0) / 60 + Number(s || 0) / 3600;
  } else {
    const secondsMatch = text.match(/;TIME:(\d+(?:\.\d+)?)/);
    if (secondsMatch) printHours = parseFloat(secondsMatch[1]) / 3600;
  }

  if (grams === null) {
    const metersMatch = text.match(/;Filament used:\s*([\d.]+)m/i);
    if (metersMatch) grams = null; // length without diameter isn't enough to convert reliably — leave for manual entry.
  }

  return { grams, printHours };
}

/** PrusaSlicer/SuperSlicer/Bambu/OrcaSlicer embed one or more base64 PNG/JPG thumbnails as G-code comments, for the printer's own screen. Picks the widest one. */
function extractGcodeThumbnail(text: string): string | null {
  const blocks = [...text.matchAll(/;\s*thumbnail(?:_JPG)?\s*begin\s+(\d+)x(\d+)\s+\d+\n([\s\S]*?);\s*thumbnail(?:_JPG)?\s*end/gi)];
  if (blocks.length === 0) return null;

  let best: { width: number; base64: string; isJpg: boolean } | null = null;
  for (const block of blocks) {
    const width = parseInt(block[1], 10);
    const base64 = block[3]
      .split("\n")
      .map((line) => line.replace(/^;\s*/, "").trim())
      .filter(Boolean)
      .join("");
    const isJpg = /thumbnail_jpg/i.test(block[0]);
    if (!best || width > best.width) best = { width, base64, isJpg };
  }
  if (!best || !best.base64) return null;
  return `data:image/${best.isJpg ? "jpeg" : "png"};base64,${best.base64}`;
}

async function parseGcode(file: File): Promise<ModelParseResult> {
  const text = await file.text();
  const { grams, printHours } = parseSlicerText(text);
  return {
    grams,
    printHours,
    accuracy: "exact",
    note: grams === null ? "Couldn't find a filament weight in this file — enter grams manually." : undefined,
    thumbnailDataUrl: extractGcodeThumbnail(text),
  };
}

async function parse3mf(file: File): Promise<ModelParseResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let grams: number | null = null;
  let printHours: number | null = null;
  let thumbnailDataUrl: string | null = null;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (/\.(config|xml|gcode)$/i.test(entry.name)) {
      const text = await entry.async("text");

      const usedGMatch = text.match(/used_g="([\d.]+)"/) ?? text.match(/total filament weight \[g\]\s*:\s*([\d.]+)/i);
      if (usedGMatch && grams === null) grams = parseFloat(usedGMatch[1]);

      const timeMatch = text.match(/prediction="(\d+)"/) ?? text.match(/;TIME:(\d+)/);
      if (timeMatch && printHours === null) printHours = parseFloat(timeMatch[1]) / 3600;
    } else if (
      thumbnailDataUrl === null &&
      /\.(png|jpe?g)$/i.test(entry.name) &&
      /thumbnail|plate|preview|top_\d|metadata|snapshot/i.test(entry.name)
    ) {
      const base64 = await entry.async("base64");
      const isJpg = /\.jpe?g$/i.test(entry.name);
      thumbnailDataUrl = `data:image/${isJpg ? "jpeg" : "png"};base64,${base64}`;
    }
  }

  return {
    grams,
    printHours,
    accuracy: "exact",
    note: grams === null ? "Couldn't find a filament weight in this file — enter grams manually." : undefined,
    thumbnailDataUrl,
  };
}

export async function parseModelFile(file: File, material: string): Promise<ModelParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".stl")) return parseStl(file, material);
  if (name.endsWith(".3mf")) return parse3mf(file);
  if (name.endsWith(".gcode") || name.endsWith(".gco")) return parseGcode(file);
  throw new Error("Unsupported file type. Upload an STL, 3MF, or G-code file.");
}
