import * as faceapi from "@vladmandic/face-api";

let loading = null;

export function loadModels() {
  if (!loading) {
    loading = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
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
