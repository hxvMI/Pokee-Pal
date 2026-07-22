# Deployment

## Build the frontend

From the repository root:

```powershell
npm run build
```

For a single-server deployment, copy the production client into the Express public directory:

```powershell
npm run build-client --prefix server
```

This writes the bundle to `server/public/app`. Runtime creature images remain in `server/public/images` and are not deleted by the build.

## Configuration

Set `VITE_BACKEND_URL` before building if the API uses a different origin. Configure `CORS_ORIGIN` on the server to allow the deployed frontend origin.

The Express server serves generated images from `/images`, frontend assets from `/`, and returns the frontend entry point for client-side routes.

For production, use managed PostgreSQL and Memcached services, HTTPS, server-side Cloudflare credentials, authentication, request rate limits, and persistent object storage for generated images.
