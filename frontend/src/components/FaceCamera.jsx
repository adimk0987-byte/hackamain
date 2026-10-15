import { useEffect, useRef, useState } from "react";
import { Camera, Upload, Loader2, ScanFace, VideoOff } from "lucide-react";
import { analyzeFace, loadModels } from "@/lib/face";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function Overlay({ cam, onStart }) {
  if (cam === "ready") return null;
  const text = {
    idle: "Camera is off. Start it when you are ready — nothing is captured until you press capture.",
    starting: "Requesting camera permission…",
    denied: "Camera permission was denied. Allow camera access in your browser settings, or upload a photo instead.",
    unavailable: "No camera available on this device or browser. You can upload a photo instead.",
  }[cam];
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-slate-950/90 p-6 text-center">
      {cam === "denied" || cam === "unavailable" ? <VideoOff className="h-10 w-10 text-rose-300" /> : <ScanFace className="h-10 w-10 text-emerald-300" />}
      <p className="max-w-xs text-sm text-slate-300" data-testid="camera-status-text">{text}</p>
      {cam !== "starting" && (
        <button type="button" onClick={onStart} className="tid-btn bg-emerald-500 text-slate-950 hover:bg-emerald-400" data-testid="camera-start-btn">
          <Camera className="h-4 w-4" /> {cam === "idle" ? "Start camera" : "Try again"}
        </button>
      )}
    </div>
  );
}

export function FaceCamera({ onDescriptor, actionLabel = "Capture face", disabled = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [cam, setCam] = useState("idle");
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [working, setWorking] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    loadModels().catch(() => {});
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = async () => {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("unavailable");
      return;
    }
    setCam("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      await videoRef.current.play();
      setCam("ready");
    } catch (e) {
      setCam(e?.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  const process = async (source) => {
    setWorking(true);
    setMsg({ type: "info", text: "Analysing face locally…" });
    try {
      const r = await analyzeFace(source);
      if (r.error === "NO_FACE") setMsg({ type: "error", text: "No face detected. Face the camera in good light and try again." });
      else if (r.error === "MULTIPLE_FACES") setMsg({ type: "error", text: `${r.count} faces detected. Make sure only you are in the frame.` });
      else {
        const problem = await onDescriptor(r.descriptor);
        setMsg(problem ? { type: "error", text: problem } : null);
      }
    } catch {
      setMsg({ type: "error", text: "The face engine could not process this image. Please try again." });
    } finally {
      setWorking(false);
    }
  };

  const capture = async () => {
    if (working) return;
    setWorking(true);
    for (let i = 3; i > 0; i -= 1) {
      setCount(i);
      await sleep(650);
    }
    setCount(0);
    setFlash(true);
    setTimeout(() => setFlash(false), 280);
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0);
    await process(c);
    ctx.clearRect(0, 0, c.width, c.height);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024) {
      setMsg({ type: "error", text: "Use a JPG, PNG or WEBP image under 5 MB." });
      return;
    }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = async () => {
      await process(img);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => setMsg({ type: "error", text: "This image could not be read. Try another file." });
    img.src = url;
  };

  return (
    <div data-testid="face-camera">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
        <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" data-testid="camera-video" />
        <canvas ref={canvasRef} className="hidden" />
        <div className="pointer-events-none absolute inset-0 reticle-grid" />
        <div className="pointer-events-none absolute inset-[14%] rounded-[40%] border-2 border-dashed border-emerald-400/60" />
        {cam === "ready" && <div className="scan-beam" />}
        {count > 0 && <div className="absolute inset-0 z-10 grid place-items-center font-display text-7xl font-extrabold text-white drop-shadow-lg" data-testid="capture-countdown">{count}</div>}
        {flash && <div className="absolute inset-0 z-30 bg-white/90" />}
        <Overlay cam={cam} onStart={start} />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={capture} disabled={cam !== "ready" || working || disabled} className="tid-btn-primary flex-1" data-testid="face-capture-btn">
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />} {working ? "Processing…" : actionLabel}
        </button>
        <label className={`tid-btn-ghost cursor-pointer ${working || disabled ? "pointer-events-none opacity-50" : ""}`} data-testid="face-upload-label">
          <Upload className="h-4 w-4" /> Use a photo
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} data-testid="face-upload-input" />
        </label>
      </div>
      {msg && (
        <p data-testid="face-message" className={`mt-3 rounded-xl px-3 py-2 text-sm ${msg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
          {msg.text}
        </p>
      )}
      <p className="mt-3 text-xs text-slate-500">Your image is processed in this browser and immediately discarded. Only a numeric face template is sent to the server. Face matching is not liveness detection.</p>
    </div>
  );
}
