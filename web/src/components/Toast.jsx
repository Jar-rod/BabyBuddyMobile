export default function Toast({ text }) {
  if (!text) return null;
  return <div role="status" className="toast">{text}</div>;
}
