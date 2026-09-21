import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyTheme, getSavedTheme } from './theme.ts'
import { applyBackground } from './background.ts'
import { applyTabCloak } from './tabcloak.ts'
import { launchBlobCloak } from './cloak.ts'

applyTheme(getSavedTheme())
applyBackground()
applyTabCloak()
if (window.self === window.top && (window.location.pathname === '/' || window.location.pathname === '/index.html') && window.location.protocol !== 'blob:') {
  launchBlobCloak()
}

window.addEventListener('unhandledrejection', (e) => {
  const msg = e.reason && (e.reason.message || String(e.reason)) || ''
  if (/domain fetch failed|wss:\/\/.*\/wisp|WebSocket.*wisp|luminsdk|lumin\.worker|BareMux|bare-mux|MessagePort|SharedWorker|invalid MessagePort|getItem|setItem|isYouTubeAudioEnabled|youtube-playables|ytgame|Linewize|Content Blocked|UserResource|unauth_user|Grammarly|grm ERROR|createAgentDirectory|SDUI|RegistryCompositionWarning|sdui-core|AngularJS|ApolloClient|PurchaseDialog|RealTime|SignalR|Sentry|cdn-cgi|OTS|Failed to decode|Failed to load resource|interp|metrics\.roblox|discord\.com\/api/i.test(msg)) {
    e.preventDefault()
  }
})
window.addEventListener('error', (e) => {
  if (e.message && /domain fetch failed|wss:\/\/.*\/wisp|WebSocket connection.*wisp|WebSocket.*failed|luminsdk|lumin\.worker|BareMux|bare-mux|MessagePort|SharedWorker|unload is not allowed|Permissions policy|getItem|setItem|isYouTubeAudioEnabled|already been declared|Linewize|Grammarly|grm ERROR|createAgentDirectory|SDUI|RegistryCompositionWarning|sdui-core|AngularJS|ApolloClient|PurchaseDialog|RealTime|SignalR|Sentry|cdn-cgi|OTS|Failed to decode|pointer-lock|allowfullscreen|Unrecognized feature/i.test(e.message)) {
    e.preventDefault()
  }
}, true)

const filterLuminNoise = (original: (...args: any[]) => void) => {
  return (...args: any[]) => {
    const first = args.length > 0 ? (args[0] instanceof Error ? args[0].message : String(args[0])) : ''
    if (/domain fetch failed|wss:\/\/.*\/wisp|WebSocket.*wisp|luminsdk|lumin\.worker|LuminSDK|Game library|bare-mux|MessagePort|SharedWorker|invalid MessagePort|unload is not allowed|Permissions policy|passkey|StartAuthentication|GSI_LOGGER|FedCM|fedcm|getItem|setItem|isYouTubeAudioEnabled|already been declared|youtube-playables|ytgame|UserResource|unauth_user|cdn-blocked|Linewize|Content Blocked|pointer-lock|allowfullscreen|Unrecognized feature|Grammarly|grm ERROR|createAgentDirectory|SDUI|RegistryCompositionWarning|sdui-core|AngularJS|ApolloClient|PurchaseDialog|RealTime|SignalR|Sentry|cdn-cgi|OTS|Failed to decode|Failed to load resource|interp|metrics\.roblox|discord\.com\/api|apis\.stealthybat/i.test(first)) return
    original(...args)
  }
}
console.warn = filterLuminNoise(console.warn.bind(console))
console.error = filterLuminNoise(console.error.bind(console))
const _log = console.log.bind(console)
console.log = (...args:any[]) => {
  const first = args.length>0 ? String(args[0]) : ''
  if (/wisp|bare-mux|MessagePort|SharedWorker|Grammarly|SDUI|RegistryCompositionWarning|AngularJS/i.test(first)) return
  return _log(...args)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
