export const getRPName = () => 'Anchor Fashion';

export const getRPID = () => {
  // Use localhost in dev, or domain name in prod
  if (process.env.NODE_ENV === 'development') {
    return 'localhost';
  }
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'attendence.vercel.app';
};

export const getExpectedOrigin = () => {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
};
