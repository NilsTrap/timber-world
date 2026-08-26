export interface OcctMesh {
  name?: string;
  color?: [number, number, number];
  attributes: {
    position: { array: number[] };
    normal?: { array: number[] };
  };
  index: { array: number[] };
}

export interface OcctResult {
  success: boolean;
  meshes: OcctMesh[];
}

function finiteArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

export function isValidOcctResult(value: unknown): value is OcctResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<OcctResult>;
  if (result.success !== true || !Array.isArray(result.meshes) || result.meshes.length === 0) return false;
  return result.meshes.every((mesh) => {
    const positions = mesh?.attributes?.position?.array;
    const normals = mesh?.attributes?.normal?.array;
    const indices = mesh?.index?.array;
    if (!finiteArray(positions) || positions.length === 0 || positions.length % 3 !== 0) return false;
    if (normals !== undefined && (!finiteArray(normals) || normals.length !== positions.length)) return false;
    if (!finiteArray(indices) || indices.length === 0 || indices.length % 3 !== 0) return false;
    const vertexCount = positions.length / 3;
    return indices.every((index) => Number.isInteger(index) && index >= 0 && index < vertexCount);
  });
}
