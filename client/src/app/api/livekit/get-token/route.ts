import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get('room');
  const username = req.nextUrl.searchParams.get('username') || `User-${Math.floor(Math.random() * 1000)}`;

  if (!room) {
    return NextResponse.json(
      { error: 'Missing "room" query parameter' },
      { status: 400 }
    );
  }

  // Define values for LiveKit connection.
  // In a real production deployment, these would be in environment variables (LIVEKIT_API_KEY, LIVEKIT_API_SECRET).
  // For the purpose of testing without a configured backend, we can use placeholder credentials,
  // however, livekit requires valid ones to actually connect to a livekit server instance.
  // We will fallback to dummy credentials if env vars are perfectly empty, but it won't connect unless configured.
  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';

  const at = new AccessToken(apiKey, apiSecret, {
    identity: username,
    // Add custom metadata or other properties here if needed
  });

  at.addGrant({ roomJoin: true, room: room });

  const token = await at.toJwt();

  return NextResponse.json({ token });
}
