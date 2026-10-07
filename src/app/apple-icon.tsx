import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// No border-radius here -- iOS applies its own squircle mask to
// apple-touch-icons, so a flat square avoids double-rounded corners.
export default function AppleIcon() {
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
        }}
      >
        <div style={{ fontSize: 104, fontWeight: 700, color: 'white', fontFamily: 'Arial, Helvetica, sans-serif', lineHeight: 1 }}>S</div>
        <div style={{ marginTop: 16, width: 66, height: 9, borderRadius: 5, background: 'rgba(255,255,255,0.55)' }} />
      </div>
    ),
    { ...size }
  );
}
