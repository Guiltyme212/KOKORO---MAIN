import { pwaApi, usePwa } from '../state/pwa';

export function PwaUpdatePrompt() {
  const pwa = usePwa();
  if (!pwa.updateReady) return null;
  return (
    <aside className="pwa-update" role="status">
      <span>A fresh version of Kokoro is ready.</span>
      <button onClick={() => void pwaApi.update()}>Update</button>
      <button onClick={pwaApi.dismissUpdate} aria-label="Dismiss update">Later</button>
    </aside>
  );
}
