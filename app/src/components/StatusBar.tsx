import './StatusBar.css';

const STATUS_TIME = '9:41';

export function StatusBar() {
  return (
    <>
      <div className="notch" />
      <div className="status-time">{STATUS_TIME}</div>
      <div className="status-icons">
        <svg width="18" height="11" viewBox="0 0 18 11">
          <rect x="0" y="7" width="3" height="4" rx="0.6" fill="#fff" />
          <rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="#fff" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="0.6" fill="#fff" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#fff" />
        </svg>
        <svg width="16" height="11" viewBox="0 0 16 11">
          <path d="M8 3C10.2 3 12.2 3.9 13.6 5.3L14.6 4.3C12.9 2.5 10.5 1.4 8 1.4C5.5 1.4 3.1 2.5 1.4 4.3L2.4 5.3C3.8 3.9 5.8 3 8 3Z" fill="#fff" />
          <path d="M8 6.4C9.3 6.4 10.4 6.9 11.3 7.7L12.3 6.7C11 5.6 9.6 4.8 8 4.8C6.4 4.8 5 5.6 3.7 6.7L4.7 7.7C5.6 6.9 6.7 6.4 8 6.4Z" fill="#fff" />
          <circle cx="8" cy="9.6" r="1.4" fill="#fff" />
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3" stroke="#fff" strokeOpacity="0.45" fill="none" />
          <rect x="2" y="2" width="19" height="8" rx="1.5" fill="#fff" />
          <path d="M24 4V8C24.7 7.7 25.3 6.9 25.3 6C25.3 5.1 24.7 4.3 24 4Z" fill="#fff" fillOpacity="0.45" />
        </svg>
      </div>
    </>
  );
}
