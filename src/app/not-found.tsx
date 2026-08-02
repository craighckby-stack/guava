export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div style={{ backgroundColor: '#000000', color: '#ffffff', fontFamily: 'monospace', padding: '4rem 2rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ border: '1px solid #ff3333', padding: '2rem', maxWidth: '500px', borderRadius: '4px' }}>
        <h2 style={{ color: '#ff3333', marginTop: 0, fontSize: '1.5rem', letterSpacing: '0.1em' }}>404 - COGNITIVE INTERCEPT</h2>
        <p style={{ color: '#888888', margin: '1rem 0' }}>The requested matrix coordinates could not be found within the containment grid.</p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#ff3333',
            color: '#ffffff',
            textDecoration: 'none',
            fontWeight: 'bold',
            borderRadius: '2px'
          }}
        >
          RETURN TO OMEGA DOCK
        </a>
      </div>
    </div>
  );
}
