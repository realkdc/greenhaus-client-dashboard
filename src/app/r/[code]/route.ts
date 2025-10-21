import { NextRequest, NextResponse } from 'next/server';
import { incrementPublicScanCount } from '@/lib/ambassadors';
import { getClientIP } from '@/lib/ip-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code;
    
    if (!code) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Get client IP for anti-cheat
    const clientIP = getClientIP(request);
    
    // Increment scan count with anti-cheat (one per IP per day)
    await incrementPublicScanCount(code, clientIP);
    
    // Redirect to GreenHaus with UTM parameters
    const redirectUrl = new URL('https://greenhauscc.com/');
    redirectUrl.searchParams.set('utm_source', 'ambassador');
    redirectUrl.searchParams.set('utm_medium', 'qr');
    redirectUrl.searchParams.set('utm_campaign', code);
    
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (error) {
    console.error('Error processing ambassador redirect:', error);
    // Fallback redirect to homepage
    return NextResponse.redirect(new URL('/', request.url));
  }
}
