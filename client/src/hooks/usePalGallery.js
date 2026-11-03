// Own the gallery request lifecycle: data, loading state, errors, and refresh.
// Each caller gets its own hook state; this is shared logic, not a global cache.

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "../utils/api.js";

export function usePalGallery() {
  // A stable refetch callback lets route components refresh the shared gallery
  // contract after battle progression or customization mutations.
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(apiUrl("/api/gallery"));
      if (!response.ok) throw new Error("Failed to load gallery");
      setData(await response.json());
    } catch (failure) {
      setError(failure);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  return { data, loading, error, refetch: fetchGallery, setData };
}
