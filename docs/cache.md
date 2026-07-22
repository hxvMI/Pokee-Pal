# Cache configuration

The API uses Memcached to reduce repeated Gallery database queries. Docker Compose exposes a local instance on port `11211`.

```env
CACHE_ENABLED=true
MEMCACHED_SERVERS=localhost:11211
```

Set `CACHE_ENABLED=false` to run without caching. Cache failures degrade to direct database access so they do not make the Gallery unavailable.

Mutating Gallery operations refresh or invalidate their related keys. The default Gallery cache lifetime is five minutes.
