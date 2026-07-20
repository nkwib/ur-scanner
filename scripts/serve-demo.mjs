// Zero-dependency static file server for the demo, used by Playwright's
// webServer and handy for manual two-device testing: `node scripts/serve-demo.mjs`.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'demo');
const port = Number(process.env.PORT) || 4173;
const types = {
	'.html': 'text/html',
	'.js': 'text/javascript',
	'.map': 'application/json',
	'.css': 'text/css'
};

createServer((req, res) => {
	const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
	let file = join(dir, rel === '/' ? 'index.html' : rel);
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
	if (!existsSync(file)) {
		res.writeHead(404);
		return res.end('not found');
	}
	res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`demo on http://localhost:${port}`));
