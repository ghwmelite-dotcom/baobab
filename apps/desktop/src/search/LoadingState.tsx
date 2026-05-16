export function LoadingState() {
  return (
    <div
      aria-label="Loading grove results"
      style={{ margin: '24px 24px 0' }}
    >
      <style>{`
        @keyframes bb-search-pulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        .bb-search-skel { animation: bb-search-pulse 1.4s ease-in-out infinite; background: rgba(60,30,15,0.10); border-radius: 8px; }
      `}</style>
      <div className="bb-search-skel" style={{ height: 92, marginBottom: 18 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '60%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '40%', marginBottom: 22 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '70%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '45%', marginBottom: 22 }} />
      <div className="bb-search-skel" style={{ height: 18, width: '65%', marginBottom: 8 }} />
      <div className="bb-search-skel" style={{ height: 12, width: '42%' }} />
    </div>
  )
}
