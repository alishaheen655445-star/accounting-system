// Download Stitch screens (screenshots + HTML code) -> stitch/ folder
// Run: node scripts/download-stitch.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const out = join(process.cwd(), 'stitch');
const imgDir = join(out, 'images');
const htmlDir = join(out, 'html');
await mkdir(imgDir, { recursive: true });
await mkdir(htmlDir, { recursive: true });

const screens = [
  {
    key: '01-journal',
    img: 'https://lh3.googleusercontent.com/aida/AEtjO1XRY_PrZWNdvVce967RnFtrHFZd_0tpyAoogGcyjTp9lOvC-18i92cUTW3vNvaDkTxCsOpKsWHccUxBO6nq3EZ07wnuG6TRVH4_D1Fo0t1BW1rtMcd01-D2_xtxRU60mCoETkrvSaMT6uG7b2pwecLGDXoR1jI99ClSX_Innnec-L_4gns2SRdTqFlnhwuPDjdmXKmxRosSDQi2yqDQ7adAPnAtFniHRdEOmGtS9JM5pfnBBl6uj53cG1c',
    html: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZGNmOTEyNWJkMzIwMzc0OTkyOGM1MjFmNzM0EgsSBxDZjZDuuwEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzAyOTM4NTYxMDc1NjIyMDExNw&filename=&opi=89354086',
  },
  {
    key: '02-invoices',
    img: 'https://lh3.googleusercontent.com/aida/AEtjO1VtKcAKDLCQkRV66lJCPaqlD6E0JUPe-UPq1BMbt0HO5bxZZvVODi96x6bYYf1u9bxCDQR0HKsau75NwmMQvNRFii0YmaScJYnsk5jP3CXEKQLAIW9GAU9xHccJ0oSh5oJtyUJBzVW7jWcDjptdxFJU2cqa9MAAej0K9h2HN007TyCZb8-B-BSY8IlXDfNlr7NAqK65P7zKg12IBStTn9KvCiM65is0adG4M7mwzzuQPy61t57QptsFycQ2',
    html: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZGNmOTBkYTRlMDMwMjJkNjhjMDZiMDlkNDdiEgsSBxDZjZDuuwEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzAyOTM4NTYxMDc1NjIyMDExNw&filename=&opi=89354086',
  },
  {
    key: '03-dashboard',
    img: 'https://lh3.googleusercontent.com/aida/AEtjO1WdftC5QkRg3nSYwgt7Hb7zZxbVL65lcVgAa0nL6X0Fo6JRGh4LmoKGw48QFGrV2ZxQRv2-qwMOlpFcKjqbZQ6yo8mM9BHnaQtkxTOGaCwaHOG93yZyvku28h2WrOtn-wZ78I8LIGLOzW4OkZCkVtNtL5YwsTDn2jBwOU69O10E4ZTXIf1aGe9SuEiTCs40t51uqBrAuu4JIdILjN7vw7i56RVX0wR7hO2jZEnwiQEizoa4WAbbIf5S_Ak',
    html: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZGNmOTA3NjIxOGMwMzRhNGVhYzAzMjM4MTg2EgsSBxDZjZDuuwEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzAyOTM4NTYxMDc1NjIyMDExNw&filename=&opi=89354086',
  },
  {
    key: '04-customers-suppliers',
    img: 'https://lh3.googleusercontent.com/aida/AEtjO1WVjBqukJSq84lr9DruoSqEHBsWJXJ9zPl7eLIPyyLZQDN0atDStmleCyvduJ6oFMH6NAFzoFqZ9IjexsMm9B5M0Mk3P69L5poY6_9pl6JMlj9Uwz0pxawA8Vp29dEoi_ORZpqK5Zm7MVznAyUMNkvlfqq3um5ALuh6fXHMwtUGnjGoUojE9O2l-CsjboOZFPVsZQrnKNnuBXzeuVhw9z1KoVtesBePGABN4KQ7JLbKwaIZEOP0vGTogF0',
    html: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZGNmOTQ3NTYwOTgwMzc0OTk3MDA2MjhlNWY1EgsSBxDZjZDuuwEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzAyOTM4NTYxMDc1NjIyMDExNw&filename=&opi=89354086',
  },
  {
    key: '05-chart-of-accounts',
    img: 'https://lh3.googleusercontent.com/aida/AEtjO1URa1llI8aE3dCRXsZoJRxEPfazsfwECcHqqXYmfUunh6GQjggsJL69IsY2nbofuOyB31zx-0rMxiNxiowmijul0nbt5v1NP8t1-LQpVcBzaergmVyK6mXPHzt_GbBAtdCsDV5gswpjBLIXnvEjwM8qoSs-xYq5fyBaa76K3Bj0M2UsviblY_OD4nILirtmh4wJoi4xxukM3uS6hGH8lisbgfZfjfi9GvCN57J5nuAaT_Cxv0GPalrfjBdR',
    html: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1ZGNmOTBjYzM1YzYwMWE2MTQ0MjA2MmVjYzY1EgsSBxDZjZDuuwEYAZIBJAoKcHJvamVjdF9pZBIWQhQxNzAyOTM4NTYxMDc1NjIyMDExNw&filename=&opi=89354086',
  },
];

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

for (const s of screens) {
  console.log(`--- ${s.key}`);
  try {
    const i = await download(s.img, join(imgDir, `${s.key}.png`));
    const h = await download(s.html, join(htmlDir, `${s.key}.html`));
    console.log(`    OK  image=${i} bytes  html=${h} bytes`);
  } catch (e) {
    console.error(`    FAILED: ${e.message}`);
  }
}
console.log('Done.');
