import { createReadStream } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const framesDir = '/private/tmp/nexus-tiktok-review-frames'
const port = Number(process.env.PORT || 43177)

const frameNames = (await readdir(framesDir)).filter((name) => name.endsWith('.png')).sort()

const html = `<!doctype html>
<meta charset="utf-8" />
<title>Nexus TikTok Review Recorder</title>
<style>
  html,body{margin:0;background:#050816;color:white;font-family:Arial,sans-serif}
  canvas{width:100vw;height:100vh;display:block}
  .badge{position:fixed;left:20px;bottom:18px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 12px;font-size:12px;letter-spacing:.12em;text-transform:uppercase}
</style>
<canvas id="c" width="1280" height="720"></canvas>
<div class="badge">Recording NEXUS AI TikTok sandbox demo</div>
<script>
const frames = ${JSON.stringify(frameNames.map((name) => `/frames/${name}`))};
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
window.__done = false;
window.__error = null;
window.__videoData = null;
(async () => {
  try {
    const stream = canvas.captureStream(24);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp8';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 3500000 });
    const chunks = [];
    rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    rec.start();
    for (const src of frames) {
      const img = await load(src);
      ctx.drawImage(img, 0, 0, 1280, 720);
      await wait(250);
    }
    await wait(500);
    rec.stop();
    await new Promise((resolve) => { rec.onstop = resolve; });
    const blob = new Blob(chunks, { type: 'video/webm' });
    const reader = new FileReader();
    reader.onload = () => { window.__videoData = reader.result; window.__done = true; };
    reader.onerror = () => { window.__error = String(reader.error); window.__done = true; };
    reader.readAsDataURL(blob);
  } catch (error) {
    window.__error = error && error.stack ? error.stack : String(error);
    window.__done = true;
  }
})();
</script>`

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  if (url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }
  if (url.pathname.startsWith('/frames/')) {
    const name = path.basename(url.pathname)
    if (!frameNames.includes(name)) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': 'image/jpeg' })
    createReadStream(path.join(framesDir, name)).pipe(res)
    return
  }
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, frames: frameNames.length }))
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`TikTok recorder server running at http://127.0.0.1:${port}`)
})
