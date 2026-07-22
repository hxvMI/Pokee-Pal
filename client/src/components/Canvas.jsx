import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#000000",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#78716C",
  "#FFFFFF",
];
const PAL_STYLES = ["Cute", "Fierce", "Realistic", "Anime", "Cartoon", "Watercolor"];

export default function Canvas({ onGenerate, disabled }) {
  const canvasRef = useRef(null);
  const [activeColor, setActiveColor] = useState(COLORS[0]);
  const [palStyle, setPalStyle] = useState("Cute");
  const drawingRef = useRef({ isDrawing: false, lastX: 0, lastY: 0 });

  // Canvas setup with useEffect
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      const parent = canvas.parentElement;
      const size = Math.min(parent.clientWidth, parent.clientHeight);
      canvas.width = size;
      canvas.height = size;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 8;
      ctx.strokeStyle = activeColor;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [activeColor]);

  // Mouse and touch event handlers
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const getCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (e.touches && e.touches.length) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const start = (e) => {
      e.preventDefault();
      drawingRef.current.isDrawing = true;
      const { x, y } = getCoords(e);
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
    };
    const draw = (e) => {
      if (!drawingRef.current.isDrawing) return;
      e.preventDefault();
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(drawingRef.current.lastX, drawingRef.current.lastY);
      ctx.lineTo(x, y);
      ctx.strokeStyle = activeColor;
      ctx.stroke();
      drawingRef.current.lastX = x;
      drawingRef.current.lastY = y;
    };
    const stop = () => (drawingRef.current.isDrawing = false);

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", stop);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", stop);
      canvas.removeEventListener("mouseleave", stop);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", stop);
    };
  }, [activeColor]);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleGenerate = async () => {
    const canvas = canvasRef.current;
    // FLUX.2 Klein reference images must be smaller than 512x512.
    const maxInputSize = 496;
    const scale = Math.min(1, maxInputSize / Math.max(canvas.width, canvas.height));
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = Math.max(1, Math.round(canvas.width * scale));
    exportCanvas.height = Math.max(1, Math.round(canvas.height * scale));
    const exportContext = exportCanvas.getContext("2d");
    exportContext.fillStyle = "white";
    exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
    const dataUrl = exportCanvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    onGenerate?.(base64, palStyle.toLowerCase());
  };

  return (
    <section className="cozy-panel flex flex-col p-4 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="cozy-kicker">Step one</p>
          <h2 className="cozy-heading mt-1 text-2xl font-black">Doodle nook</h2>
          <p className="cozy-muted mt-1 text-sm">Sketch a tiny friend—messy lines are welcome.</p>
        </div>
        <span className="cozy-step-badge" aria-hidden="true">✎</span>
      </div>

      <div className="cozy-toolbar mb-4">
        <span className="cozy-label mb-0 mr-1">Crayons</span>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActiveColor(c)}
              aria-label={`Draw with ${c}`}
              className={`h-8 w-8 rounded-full border-2 transition hover:scale-110 ${
                c === "#FFFFFF" ? "border-gray-400" : "border-gray-200"
              } ${c === activeColor ? "scale-110 ring-2 ring-offset-2" : ""}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <fieldset className="mb-4">
        <legend className="cozy-label">Pal style</legend>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {PAL_STYLES.map((style) => <button key={style} type="button" onClick={() => setPalStyle(style)} aria-pressed={palStyle === style} className={`rounded-xl border px-2 py-2 text-xs font-bold transition ${palStyle === style ? "cozy-tab-active" : "cozy-button-secondary"}`}>{style}</button>)}
        </div>
      </fieldset>

      <div className="doodle-paper relative aspect-square w-full overflow-hidden rounded-2xl touch-none bg-white">
        <canvas ref={canvasRef} className="absolute inset-0" />
        <span className="pointer-events-none absolute bottom-3 right-4 text-xs font-semibold text-stone-300">
          your imagination lives here
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-[0.8fr_1.2fr]">
        <button
          type="button"
          onClick={clearCanvas}
          className="cozy-button cozy-button-secondary"
        >
          Clear page
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleGenerate}
          className="cozy-button cozy-button-primary"
        >
          {disabled ? "Bringing it to life…" : "Bring my pal to life ✦"}
        </button>
      </div>
    </section>
  );
}
