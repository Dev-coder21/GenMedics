// In-browser port of the Prescription-Scanner microservice pipeline:
//   OpenCV preprocessing  -> canvas grayscale + contrast stretch + Otsu threshold
//   multi-pass Tesseract  -> tesseract.js on the cleaned and the original image, best confidence wins
const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";

let loader: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if ((window as any).Tesseract) return Promise.resolve((window as any).Tesseract);
  if (!loader) loader = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = TESSERACT_URL; s.async = true; s.crossOrigin = "anonymous";
    s.onload = () => ((window as any).Tesseract ? res((window as any).Tesseract) : rej(new Error("Tesseract failed to initialise")));
    s.onerror = () => { loader = null; rej(new Error("Couldn't download the OCR engine")); };
    document.head.appendChild(s);
  });
  return loader;
}

export function fileToImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); };
    img.onerror = () => rej(new Error("That file isn't an image we can read"));
    img.src = url;
  });
}

function drawScaled(img: HTMLImageElement, maxSide: number, minWidth = 0) {
  let w = img.naturalWidth, h = img.naturalHeight;
  let k = Math.min(1, maxSide / Math.max(w, h));
  if (w * k < minWidth) k = minWidth / w;
  const c = document.createElement("canvas");
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/** Grayscale, 1–99 percentile contrast stretch, then Otsu binarisation. */
export function preprocess(img: HTMLImageElement) {
  const c = drawScaled(img, 2200, 1100);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const px = d.data, n = px.length / 4;
  const gray = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) { const g = (px[i * 4] * 299 + px[i * 4 + 1] * 587 + px[i * 4 + 2] * 114) / 1000; gray[i] = g; hist[gray[i]]++; }
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > n * 0.01) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > n * 0.01) { hi = v; break; } }
  const span = Math.max(1, hi - lo);
  hist.fill(0);
  for (let i = 0; i < n; i++) { const v = Math.max(0, Math.min(255, ((gray[i] - lo) * 255) / span)) | 0; gray[i] = v; hist[v]++; }
  // Otsu
  let sum = 0; for (let v = 0; v < 256; v++) sum += v * hist[v];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let v = 0; v < 256; v++) {
    wB += hist[v]; if (!wB) continue;
    const wF = n - wB; if (!wF) break;
    sumB += v * hist[v];
    const mB = sumB / wB, mF = (sum - sumB) / wF, between = wB * wF * (mB - mF) ** 2;
    if (between > best) { best = between; thr = v; }
  }
  for (let i = 0; i < n; i++) { const v = gray[i] > thr ? 255 : 0; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Small JPEG kept with the saved prescription so the pharmacist can see it. */
export function thumbnail(img: HTMLImageElement) {
  return drawScaled(img, 900).toDataURL("image/jpeg", 0.7);
}

export type OcrResult = { text: string; confidence: number; pass: string };

export async function recognise(img: HTMLImageElement, onProgress: (stage: number, pct: number) => void): Promise<OcrResult[]> {
  onProgress(0, 0);
  const cleaned = preprocess(img);
  const original = drawScaled(img, 2200, 1100);
  onProgress(1, 0);
  const T = await loadTesseract();
  let pass = 0;
  const worker = await T.createWorker("eng", 1, {
    logger: (m: any) => { if (m.status === "recognizing text") onProgress(1, Math.round(((pass + m.progress) / 2) * 100)); },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
    const results: OcrResult[] = [];
    for (const [name, canvas] of [["preprocessed", cleaned], ["original", original]] as const) {
      const { data } = await worker.recognize(canvas);
      results.push({ text: data.text || "", confidence: (data.confidence || 0) / 100, pass: name });
      pass++;
    }
    return results;
  } finally {
    await worker.terminate();
  }
}
