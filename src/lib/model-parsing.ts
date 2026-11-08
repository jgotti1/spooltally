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
};

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
  return { grams, printHours: null, accuracy: "estimated" };
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

async function parseGcode(file: File): Promise<ModelParseResult> {
  const text = await file.text();
  const { grams, printHours } = parseSlicerText(text);
  return {
    grams,
    printHours,
    accuracy: "exact",
    note: grams === null ? "Couldn't find a filament weight in this file — enter grams manually." : undefined,
  };
}

async function parse3mf(file: File): Promise<ModelParseResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let grams: number | null = null;
  let printHours: number | null = null;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (!/\.(config|xml|gcode)$/i.test(entry.name)) continue;
    const text = await entry.async("text");

    const usedGMatch = text.match(/used_g="([\d.]+)"/) ?? text.match(/total filament weight \[g\]\s*:\s*([\d.]+)/i);
    if (usedGMatch && grams === null) grams = parseFloat(usedGMatch[1]);

    const timeMatch = text.match(/prediction="(\d+)"/) ?? text.match(/;TIME:(\d+)/);
    if (timeMatch && printHours === null) printHours = parseFloat(timeMatch[1]) / 3600;

    if (grams !== null && printHours !== null) break;
  }

  return {
    grams,
    printHours,
    accuracy: "exact",
    note: grams === null ? "Couldn't find a filament weight in this file — enter grams manually." : undefined,
  };
}

export async function parseModelFile(file: File, material: string): Promise<ModelParseResult> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".stl")) return parseStl(file, material);
  if (name.endsWith(".3mf")) return parse3mf(file);
  if (name.endsWith(".gcode") || name.endsWith(".gco")) return parseGcode(file);
  throw new Error("Unsupported file type. Upload an STL, 3MF, or G-code file.");
}
