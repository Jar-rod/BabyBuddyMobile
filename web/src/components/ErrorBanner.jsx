import { C } from '../theme.js';

export default function ErrorBanner({ text, onRetry }) {
  if (!text) return null;
  return (
    <div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: C.errBg, color: C.errFg, fontSize: 14, fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
      <span>{text}</span>
      {onRetry && (
        <button onClick={onRetry} style={{ border: 0, background: 'transparent', color: C.errFg, fontWeight: 600, fontSize: 14, textDecoration: 'underline' }}>Retry</button>
      )}
    </div>
  );
}
