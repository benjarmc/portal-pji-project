import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './src/main.server';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, 'dist/portal-pji-project/browser');
const indexHtml = join(browserDistFolder, 'index.html');

const app = express();
const commonEngine = new CommonEngine();

app.set('view engine', 'html');
app.set('views', browserDistFolder);

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html'
  }),
);

/**
 * Handle specific static file requests to avoid 404 errors
 */
app.get(['/favicon.ico', '/assets/favicon.ico'], (req, res) => {
  // Silently ignore favicon requests to avoid console errors
  res.status(204).end();
});

app.get(['/assets/site.webmanifest', '/site.webmanifest'], (req, res) => {
  // Silently ignore web manifest requests
  res.status(204).end();
});

app.get(['/assets/favicon-16x16.png', '/favicon-16x16.png'], (req, res) => {
  // Silently ignore favicon requests
  res.status(204).end();
});

app.get(['/assets/favicon-32x32.png', '/favicon-32x32.png'], (req, res) => {
  // Silently ignore favicon requests
  res.status(204).end();
});

// Handle Chrome DevTools requests
app.get('/es/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.status(204).end();
});

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
