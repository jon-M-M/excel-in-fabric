// Excel-style splash shown while the app signs in, and then while the report's data loads.

import './excel.css';

export function StartupSplash({ message = 'Starting…' }: { message?: string }) {
  return (
    <div className="xl-splash" role="status" aria-label="Starting Excel in Fabric">
      <svg className="xl-splash-logo" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1" y="2" width="14" height="12" rx="1.5" fill="#fff" />
        <path d="M4.5 5l2 3-2 3h1.6L7.3 9l1.2 2h1.6l-2-3 2-3H8.5L7.3 7 6.1 5z" fill="#217346" />
      </svg>
      <div className="xl-splash-name">Excel in Fabric</div>
      <div className="xl-splash-starting">{message}</div>
    </div>
  );
}
