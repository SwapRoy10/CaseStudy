import { useEffect, useState } from 'react';
import { api } from '../services/api';

type Status = 'checking' | 'up' | 'down';

// Small indicator that the frontend can actually reach the backend.
export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = () =>
      api
        .health()
        .then(() => !cancelled && setStatus('up'))
        .catch(() => !cancelled && setStatus('down'));

    check();
    const timer = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const label = { checking: 'Connecting…', up: 'API connected', down: 'API offline' }[status];
  return (
    <span className={`status status-${status}`} role="status">
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}
