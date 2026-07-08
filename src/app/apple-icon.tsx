import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const size = {
  width: 180,
  height: 180,
};
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 96,
          background: 'linear-gradient(135deg, #040A15 0%, #0A1628 50%, #1E3A8A 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '40px',
          border: '6px solid rgba(96, 165, 250, 0.4)',
        }}
      >
        🛡️
      </div>
    ),
    {
      ...size,
    }
  );
}
