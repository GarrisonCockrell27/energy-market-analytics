import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev-mode API proxy: reuses the exact same handlers Vercel runs in
// production (api/*.js), so `npm run dev` and a Vercel deploy behave
// identically. Handlers are Node-style (req, res) functions expecting
// `req.query` and `res.status().json()` — this plugin adapts Vite's dev
// server request/response objects to that shape.
function apiDevPlugin() {
  return {
    name: 'crudeedge-api-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const [pathname, search] = req.url.split('?');
        const routeName = pathname.replace('/api/', '').replace(/\/$/, '');
        const modulePath = `./api/${routeName}.js`;

        try {
          const mod = await server.ssrLoadModule(modulePath);
          req.query = Object.fromEntries(new URLSearchParams(search || ''));
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (body) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(body));
          };
          await mod.default(req, res);
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Dev API proxy failure', detail: String(err?.message || err) }));
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // Vite's own env loading only exposes VITE_-prefixed vars to client code
  // via import.meta.env — it doesn't touch process.env. Our api/*.js
  // handlers read process.env.EIA_API_KEY etc. directly (matching how
  // Vercel injects env vars in production), so in dev we load .env.local
  // ourselves and merge it into process.env before the API proxy plugin
  // ever handles a request.
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiDevPlugin()],
    server: {
      port: 5173
    }
  };
});
