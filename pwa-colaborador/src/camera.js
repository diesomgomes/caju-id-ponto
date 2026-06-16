let stream = null;

export async function abrirCamera(videoEl) {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
}

export function pararCamera() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}

export function capturarFoto(videoEl, canvasEl) {
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  canvasEl.getContext("2d").drawImage(videoEl, 0, 0);
  return new Promise(resolve =>
    canvasEl.toBlob(resolve, "image/jpeg", 0.85)
  );
}
