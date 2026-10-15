import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, ScanFace, ArrowLeft, ArrowRight, Eye, VideoOff, RotateCcw } from "lucide-react";
import { analyzeLive, loadModels } from "@/lib/face";

const STEPS = [
  { key: "front", label: "Face front", hint: "Look straight at the camera", icon: ScanFace },
  { key: "left", label: "Turn left", hint: "Slowly turn your head to your left", icon: ArrowLeft },
  { key: "right", label: "Turn right", hint: "Now turn your head to your right", icon: ArrowRight },
  { key: "blink", label: "Eye scan", hint: "Look at the camera and blink once", icon: Eye },
];

function Ring({ progress }) {
  const r = 48;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1.6" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#34D399" strokeWidth="1.8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} style={{ transition: "stroke-dashoffset .5s ease" }} />
    </svg>
  );
}

export function BiometricScanner({ onComplete, busy = false, disabled = false, title = "Biometric scan" }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const st = useRef({ step: 0, hold: 0, front: null, left: null, right: null, opened: false, closed: false });
  const [cam, setCam] = useState("idle");
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState(null);

  const stop = () => streamRef.current?.getTracks().forEach((t) => t.stop());
  useEffect(() => {
    loadModels().catch(() => {});
    return stop;
  }, []);

  const reset = () => {
    st.current = { step: 0, hold: 0, front: null, left: null, right: null, opened: false, closed: false };
    setStep(0);
    setError(null);
  };

  const finish = async () => {
    const s = st.current;
    setMsg("Verifying with server…");
    const problem = await onComplete({ descriptor: s.front, pose_descriptors: [s.left, s.right], blink: true });
    if (problem) {
      setError(problem);
      reset();
    }
  };

  const tick = async () => {
    const v = videoRef.current;
    const s = st.current;
    if (!v || !streamRef.current || s.step >= 4) return;
    try {
      const r = await analyzeLive(v);
      if (r.count === 0) setMsg("No face detected — move into the circle");
      else if (r.count > 1) setMsg("Only one person should be in frame");
      else {
        setMsg(STEPS[s.step].hint);
        const ok = s.step === 0 ? Math.abs(r.yaw) < 0.08 : s.step === 1 ? r.yaw > 0.16 : s.step === 2 ? r.yaw < -0.16 : false;
        if (s.step === 3) {
          if (r.ear > 0.26) {
            if (s.closed) s.step = 4;
            s.opened = true;
          } else if (r.ear < 0.21 && s.opened) s.closed = true;
        } else if (ok) {
          s.hold += 1;
          if (s.hold >= 2) {
            s[STEPS[s.step].key] = r.descriptor;
            s.step += 1;
            s.hold = 0;
          }
        } else s.hold = 0;
        setStep(s.step);
        if (s.step === 4) {
          await finish();
          if (st.current.step === 4) return;
        }
      }
    } catch {
      setMsg("Face engine is loading…");
    }
    setTimeout(tick, 180);
  };

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) return setCam("unavailable");
    setCam("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" }, audio: false });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      await videoRef.current.play();
      await loadModels();
      setCam("ready");
      reset();
      tick();
    } catch (e) {
      setCam(e?.name === "NotAllowedError" ? "denied" : "unavailable");
    }
  };

  const restart = () => {
    reset();
    tick();
  };

  const done = step >= 4;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_220px]" data-testid="biometric-scanner">
      <div className="relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden rounded-full bg-[#0B1626] shadow-[0_30px_60px_-20px_rgba(11,22,38,.5)]">
        <video ref={videoRef} muted playsInline className="h-full w-full scale-x-[-1] object-cover" data-testid="scanner-video" />
        <div className="pointer-events-none absolute inset-0 reticle-grid opacity-60" />
        {cam === "ready" && !done && <div className="scan-beam" />}
        <Ring progress={step / 4} />
        {cam !== "ready" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B1626]/95 p-8 text-center">
            {cam === "denied" || cam === "unavailable" ? <VideoOff className="h-9 w-9 text-rose-300" /> : <ScanFace className="h-10 w-10 text-emerald-300" />}
            <p className="text-sm text-slate-300" data-testid="scanner-status">{{ idle: "Camera stays off until you start.", starting: "Requesting camera…", denied: "Camera blocked. Allow camera access in your browser settings.", unavailable: "No camera found on this device." }[cam]}</p>
            {cam !== "starting" && <button type="button" onClick={start} disabled={disabled} className="tid-btn bg-emerald-400 text-slate-950 hover:bg-emerald-300" data-testid="scanner-start-btn"><Camera className="h-4 w-4" />{cam === "idle" ? "Start scan" : "Retry"}</button>}
          </div>
        )}
        {done && <div className="absolute inset-0 grid place-items-center bg-emerald-500/20 backdrop-blur-[2px]">{busy ? <Loader2 className="h-12 w-12 animate-spin text-white" /> : <Check className="h-14 w-14 text-white" />}</div>}
      </div>
      <div>
        <p className="tid-label">{title}</p>
        <ol className="mt-3 space-y-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < step ? "done" : i === step && cam === "ready" ? "now" : "todo";
            return (
              <li key={s.key} data-testid={`scan-step-${s.key}`} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : state === "now" ? "border-slate-900 bg-white font-semibold" : "border-slate-200 text-slate-400"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full ${state === "done" ? "bg-emerald-500 text-white" : "bg-slate-100"}`}>{state === "done" ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}</span>{s.label}
              </li>
            );
          })}
        </ol>
        {cam === "ready" && <p className="mt-4 min-h-[40px] text-sm font-medium text-slate-700" data-testid="scanner-instruction">{done ? "Scan complete" : msg}</p>}
        {error && <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" data-testid="scanner-error">{error}</p>}
        {cam === "ready" && !busy && <button type="button" onClick={restart} className="mt-3 inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800" data-testid="scanner-restart-btn"><RotateCcw className="h-3.5 w-3.5" />Restart scan</button>}
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">Head-turn + blink is an active liveness check. Retina scanning needs dedicated IR hardware and is not performed by webcams. No images leave your device.</p>
      </div>
    </div>
  );
}
