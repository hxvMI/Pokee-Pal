# Cloudflare credentials

Pokee-Pal uses Cloudflare Workers AI for creature images and generated metadata. It accepts credentials in either of two ways.

## Server configuration

Set these values in `server/.env`:

```env
CLOUDFLARE_ACCOUNT_ID=your_32_character_account_id
CLOUDFLARE_API_TOKEN=your_workers_ai_token
```

The file is ignored by Git. This is the recommended configuration for a private deployment.

## Browser-session configuration

The API control in the header accepts an Account ID and Workers AI token. Values are kept in `sessionStorage`, sent to the backend only with generation requests, and removed when that browser session ends.

Browser storage is convenient for local use, but any JavaScript running on the page can access it. A public production service should keep provider credentials on the server and add authentication and rate limiting rather than asking visitors for API tokens.

## Required token access

Create a scoped Cloudflare API token that can run Workers AI for the intended account. Avoid broad account permissions and revoke any token that is accidentally committed or shared.

## Request fields

The frontend sends optional per-request credentials using:

```json
{
  "cloudflare_account_id": "...",
  "cloudflare_api_token": "..."
}
```

If those fields are absent, the backend uses its environment variables.
