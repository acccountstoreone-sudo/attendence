import type { NextRequest } from 'next/server';

export const getRPName = () => 'Anchor Fashion';

export const getRPID = (req?: Request | NextRequest | any) => {
  if (req) {
    const host = req.headers.get('host');
    if (host) {
      return host.split(':')[0]; // Remove port if present
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return 'localhost';
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '').split(':')[0] || 'attendence.vercel.app';
};

export const getExpectedOrigin = (req?: Request | NextRequest | any) => {
  if (req) {
    const origin = req.headers.get('origin');
    if (origin) return origin;

    const host = req.headers.get('host');
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    if (host) {
      return process.env.NODE_ENV === 'production' && !host.includes('localhost') && !host.match(/^\d+\.\d+\.\d+\.\d+/) 
        ? `https://${host}` 
        : `${proto}://${host}`;
    }
  }

  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};

