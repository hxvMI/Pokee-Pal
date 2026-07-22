import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export function usePalGallery() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API}/api/gallery`);
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
