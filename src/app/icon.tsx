import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

// Generated at build time (see AppLogo.tsx for the in-app inline-SVG
// version of the same mark) -- ImageResponse renders a constrained
// CSS/HTML subset, not arbitrary SVG.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)',
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 38, fontWeight: 700, color: 'white', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1 }}>S</div>
        <div style={{ marginTop: 6, width: 24, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,0.55)' }} />
      </div>
    ),
    { ...size }
  );
}
