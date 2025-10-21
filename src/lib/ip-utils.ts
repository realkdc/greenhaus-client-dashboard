import { NextRequest } from 'next/server';

/**
 * Extract client IP from request headers
 * Handles x-forwarded-for header and picks the first IP
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  // Fallback to other headers
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Last resort - use connection remote address
  return request.ip || '127.0.0.1';
}

/**
 * Check if an IP matches any allowlisted IP or CIDR block
 */
export function isIPAllowed(clientIP: string, allowlistCSV?: string): boolean {
  if (!allowlistCSV || allowlistCSV.trim() === '') {
    return true; // No allowlist means all IPs are allowed
  }
  
  const allowedIPs = allowlistCSV.split(',').map(ip => ip.trim()).filter(ip => ip);
  
  for (const allowedIP of allowedIPs) {
    if (isIPInRange(clientIP, allowedIP)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if an IP is within a CIDR range or exact match
 */
function isIPInRange(ip: string, range: string): boolean {
  // Exact match
  if (ip === range) {
    return true;
  }
  
  // CIDR notation (e.g., 192.168.1.0/24)
  if (range.includes('/')) {
    return isIPInCIDR(ip, range);
  }
  
  return false;
}

/**
 * Check if an IP is within a CIDR range
 * Simplified implementation for common cases
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    if (prefix < 0 || prefix > 128) {
      return false;
    }
    
    // Convert IPs to binary for comparison
    const ipBinary = ipToBinary(ip);
    const networkBinary = ipToBinary(network);
    
    if (!ipBinary || !networkBinary) {
      return false;
    }
    
    // Compare the network portion
    const networkBits = networkBinary.substring(0, prefix);
    const ipBits = ipBinary.substring(0, prefix);
    
    return networkBits === ipBits;
  } catch {
    return false;
  }
}

/**
 * Convert IP address to binary string
 */
function ipToBinary(ip: string): string | null {
  try {
    // Handle IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.').map(Number);
      if (parts.length !== 4 || parts.some(p => p < 0 || p > 255)) {
        return null;
      }
      return parts.map(p => p.toString(2).padStart(8, '0')).join('');
    }
    
    // Handle IPv6 (simplified)
    if (ip.includes(':')) {
      // This is a simplified implementation
      // For production, consider using a proper IPv6 library
      return null;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Get environment variables for staff PIN and IP allowlist
 */
export function getStaffConfig() {
  return {
    staffPin: process.env.STAFF_PIN || '',
    ipAllowlist: process.env.STORE_IP_ALLOWLIST_CSV || '',
    siteBase: process.env.NEXT_PUBLIC_SITE_BASE || 'https://greenhaus-site.vercel.app',
  };
}
