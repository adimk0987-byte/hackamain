import * as faceapi from "@vladmandic/face-api";

let loading = null;

export function loadModels() {
  if (!loading) {
    loading = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
      faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
    ]).catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

export async function analyzeFace(input) {
  await loadModels();
  const res = await faceapi
    .detectAllFaces(input, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (res.length === 0) return { error: "NO_FACE" };
  if (res.length > 1) return { error: "MULTIPLE_FACES", count: res.length };
  return { descriptor: Array.from(res[0].descriptor), score: res[0].detection.score };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ear = (p) => (dist(p[1], p[5]) + dist(p[2], p[4])) / (2 * dist(p[0], p[3]));

export async function analyzeLive(video) {
  await loadModels();
  const res = await faceapi
    .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptors();
  if (res.length !== 1) return { count: res.length };
  const pts = res[0].landmarks.positions;
  const jawL = pts[0];
  const jawR = pts[16];
  const yaw = (pts[30].x - (jawL.x + jawR.x) / 2) / (jawR.x - jawL.x);
  const eyes = (ear(pts.slice(36, 42)) + ear(pts.slice(42, 48))) / 2;
  return { count: 1, yaw, ear: eyes, descriptor: Array.from(res[0].descriptor) };
}
