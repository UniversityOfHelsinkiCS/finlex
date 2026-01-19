import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { initSentry } from './util/sentry.tsx'


initSentry()
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />,
)
