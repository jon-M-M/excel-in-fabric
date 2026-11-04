// Whether the app runs inside the Fabric portal (where sign-in happens on its own).

export function isFabricEmbedded(): boolean {
  if (new URLSearchParams(window.location.search).get('fabricEmbedded') === 'true') return true;
  try {
    return window.self !== window.top;
  } catch {
    // A cross-origin parent throws on access, which also means we're framed.
    return true;
  }
}
