type FilterableProjectFile = {
  fileName: string;
  relativePath: string;
};

export const ALL_FILE_TYPES = "mode:all";
export const NO_FILE_EXTENSION = "mode:no-extension";

export function projectFileTypeValue(extension: string): string {
  return `extension:${encodeURIComponent(extension)}`;
}

export function projectFileTypeLabel(value: string): string {
  if (value === NO_FILE_EXTENSION) return "No extension";
  return `.${decodeURIComponent(value.slice("extension:".length)).toUpperCase()}`;
}

export function projectFileExtension(fileName: string): string | null {
  const dot = fileName.lastIndexOf(".");
  return dot > 0 && dot < fileName.length - 1 ? fileName.slice(dot + 1).toLowerCase() : null;
}

export function projectFileExtensions(files: FilterableProjectFile[]): string[] {
  return [...new Set(files.map((file) => {
    const extension = projectFileExtension(file.fileName);
    return extension ? projectFileTypeValue(extension) : NO_FILE_EXTENSION;
  }))]
    .sort((left, right) => left === NO_FILE_EXTENSION ? 1 : right === NO_FILE_EXTENSION ? -1 : left.localeCompare(right));
}

export function filterProjectFiles<T extends FilterableProjectFile>(files: T[], folder: string | null, extension: string, search: string): T[] {
  const query = search.trim().toLocaleLowerCase();
  return files.filter((file) => {
    if (folder !== null) {
      const parent = file.relativePath.includes("/") ? file.relativePath.slice(0, file.relativePath.lastIndexOf("/")) : "";
      if (parent !== folder) return false;
    }
    const actualExtension = projectFileExtension(file.fileName);
    const actualType = actualExtension ? projectFileTypeValue(actualExtension) : NO_FILE_EXTENSION;
    if (extension !== ALL_FILE_TYPES && actualType !== extension) return false;
    return !query || file.fileName.toLocaleLowerCase().includes(query);
  });
}
