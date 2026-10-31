/** Saves `content` as a file through the browser's download. */
export function download(fileName: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  URL.revokeObjectURL(url);
}
