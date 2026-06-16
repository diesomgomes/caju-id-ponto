export function obterLocalizacao() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocalização não suportada neste dispositivo"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const msgs = {
          1: "Permissão de localização negada. Habilite o GPS nas configurações.",
          2: "Localização indisponível. Verifique o GPS.",
          3: "Tempo esgotado ao obter localização.",
        };
        reject(new Error(msgs[err.code] || "Erro de geolocalização"));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
