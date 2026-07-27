import { useEffect, useState } from 'react'
import { Preferences } from '@capacitor/preferences'
import { ScreenOrientation } from '@capacitor/screen-orientation'
import Setup from './pages/Setup'
import Kiosk from './pages/Kiosk'

export default function App() {
  const [token, setToken] = useState(null)
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    async function init() {
      // Trava orientação em portrait
      try { await ScreenOrientation.lock({ orientation: 'portrait' }) } catch (_) {}
      // Mantém tela sempre acesa via Wake Lock API (nativa no Android WebView)
      try {
        if ('wakeLock' in navigator) {
          await navigator.wakeLock.request('screen')
        }
      } catch (_) {}
      // Carrega token salvo
      const { value } = await Preferences.get({ key: 'device_token' })
      setToken(value || null)
      setPronto(true)
    }
    init()
  }, [])

  async function configurarToken(novoToken) {
    await Preferences.set({ key: 'device_token', value: novoToken })
    setToken(novoToken)
  }

  async function resetarDispositivo() {
    await Preferences.remove({ key: 'device_token' })
    setToken(null)
  }

  if (!pronto) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!token) {
    return <Setup onConfirmar={configurarToken} />
  }

  return <Kiosk token={token} onResetar={resetarDispositivo} />
}
