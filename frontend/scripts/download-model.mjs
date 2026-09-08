import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const dest = path.resolve('public', 'mediapipe', 'face_landmarker.task');
const controlFile = dest + '.dl-ok';

async function main() {
  let lastErr;
  for (let i = 1; i <= 6; i++) {
    try {
      process.stderr.write(`attempt ${i}\n`);
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, buf);
      // control file so the build script can verify freshness
      await writeFile(controlFile, new Date().toISOString());
      console.log(`OK ${buf.length} bytes -> ${dest}`);
      return;
    } catch (e) {
      lastErr = e;
      process.stderr.write(`attempt ${i} failed: ${e.message}\n`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.error('DOWNLOAD FAILED:', lastErr?.message);
  process.exit(1);
}
main();