import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

export async function downloadFile(url: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    
    const request = url.startsWith('https:') ? https : http;
    
    request.get(url, (response) => {
      console.log(`[downloadFile] URL: ${url}, STATUS: ${response.statusCode}`);
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303) {
        if (!response.headers.location) {
          reject(new Error(`Redirect without location header for ${url}`));
          return;
        }
        console.log(`[downloadFile] Redirecting to: ${response.headers.location}`);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${url} (${response.statusCode})`));
        return;
      }
      
      console.log(`[downloadFile] Streaming data...`);
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`[downloadFile] Finished writing to ${dest}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest).catch(() => {});
      reject(err);
    });
  });
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}