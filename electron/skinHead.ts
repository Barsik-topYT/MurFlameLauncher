import { PNG } from "pngjs";

/** Из PNG скина Minecraft — data URL только головы (лицо + шапка) */
export function skinBufferToHeadDataUrl(buffer: Buffer, outSize = 96): string {
  const src = PNG.sync.read(buffer);
  const w = src.width;
  const h = src.height;
  if (w < 64 || h < 32) {
    throw new Error("Неверный размер скина. Нужен PNG 64×64 или 64×32.");
  }

  const out = new PNG({ width: outSize, height: outSize });

  const layers: { x: number; y: number }[] = [
    { x: 8, y: 8 },
    { x: 40, y: 8 },
  ];

  for (let y = 0; y < outSize; y++) {
    for (let x = 0; x < outSize; x++) {
      const u = x / outSize;
      const v = y / outSize;
      const sx = 8 + Math.min(7, Math.floor(u * 8));
      const sy = 8 + Math.min(7, Math.floor(v * 8));
      const oidx = (outSize * y + x) << 2;

      let r = 0,
        g = 0,
        b = 0,
        a = 0;

      for (const layer of layers) {
        const px = layer.x + (sx - 8);
        const py = layer.y + (sy - 8);
        if (px < 0 || px >= w || py < 0 || py >= h) continue;
        const idx = (w * py + px) << 2;
        const sa = src.data[idx + 3] / 255;
        if (sa <= 0) continue;
        const sr = src.data[idx];
        const sg = src.data[idx + 1];
        const sb = src.data[idx + 2];
        r = Math.round(sr * sa + r * (1 - sa));
        g = Math.round(sg * sa + g * (1 - sa));
        b = Math.round(sb * sa + b * (1 - sa));
        a = Math.round((sa + a * (1 - sa)) * 255);
      }

      out.data[oidx] = r;
      out.data[oidx + 1] = g;
      out.data[oidx + 2] = b;
      out.data[oidx + 3] = a || 255;
    }
  }

  return `data:image/png;base64,${PNG.sync.write(out).toString("base64")}`;
}
