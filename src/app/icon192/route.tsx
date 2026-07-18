import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 96,
          background: 'linear-gradient(135deg, #1dbf73 0%, #16965a 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          borderRadius: '44px',
          border: '4px solid rgba(96, 165, 250, 0.4)',
        }}
      >
        🛡️
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
