import { NextRequest, NextResponse } from 'next/server';
import { incrementStaffScanCount } from '@/lib/ambassadors';
import { getClientIP, isIPAllowed, getStaffConfig } from '@/lib/ip-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  try {
    const code = params.code;
    
    if (!code) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    
    // Get client IP and check if allowed
    const clientIP = getClientIP(request);
    const { ipAllowlist } = getStaffConfig();
    const isAllowed = isIPAllowed(clientIP, ipAllowlist);
    
    if (isAllowed) {
      // IP is allowlisted, increment and redirect immediately
      await incrementStaffScanCount(code);
      
      // Redirect to GreenHaus with UTM parameters
      const redirectUrl = new URL('https://greenhauscc.com/');
      redirectUrl.searchParams.set('utm_source', 'ambassador');
      redirectUrl.searchParams.set('utm_medium', 'qr');
      redirectUrl.searchParams.set('utm_campaign', code);
      
      return NextResponse.redirect(redirectUrl, { status: 302 });
    } else {
      // IP not allowlisted, show PIN entry page
      return new NextResponse(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Staff Access Required</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              margin: 0;
              padding: 20px;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
              max-width: 400px;
              width: 100%;
            }
            .title {
              text-align: center;
              color: #333;
              margin-bottom: 8px;
              font-size: 24px;
              font-weight: 600;
            }
            .subtitle {
              text-align: center;
              color: #666;
              margin-bottom: 32px;
              font-size: 16px;
            }
            .form-group {
              margin-bottom: 24px;
            }
            .label {
              display: block;
              margin-bottom: 8px;
              color: #333;
              font-weight: 500;
            }
            .input {
              width: 100%;
              padding: 12px 16px;
              border: 2px solid #e1e5e9;
              border-radius: 8px;
              font-size: 16px;
              transition: border-color 0.2s;
              box-sizing: border-box;
            }
            .input:focus {
              outline: none;
              border-color: #667eea;
            }
            .button {
              width: 100%;
              background: #667eea;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 8px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: background-color 0.2s;
            }
            .button:hover {
              background: #5a6fd8;
            }
            .button:disabled {
              background: #ccc;
              cursor: not-allowed;
            }
            .error {
              color: #e74c3c;
              text-align: center;
              margin-top: 16px;
              font-size: 14px;
            }
            .success {
              color: #27ae60;
              text-align: center;
              margin-top: 16px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="title">Staff Access Required</h1>
            <p class="subtitle">Enter the 4-digit PIN to access this QR code</p>
            
            <form id="pinForm">
              <div class="form-group">
                <label for="pin" class="label">Staff PIN</label>
                <input 
                  type="password" 
                  id="pin" 
                  name="pin" 
                  class="input" 
                  placeholder="Enter 4-digit PIN"
                  maxlength="4"
                  pattern="[0-9]{4}"
                  required
                />
              </div>
              <button type="submit" class="button" id="submitBtn">
                Verify & Access
              </button>
            </form>
            
            <div id="message"></div>
          </div>
          
          <script>
            document.getElementById('pinForm').addEventListener('submit', async (e) => {
              e.preventDefault();
              
              const pin = document.getElementById('pin').value;
              const submitBtn = document.getElementById('submitBtn');
              const message = document.getElementById('message');
              
              if (pin.length !== 4) {
                message.innerHTML = '<div class="error">Please enter a 4-digit PIN</div>';
                return;
              }
              
              submitBtn.disabled = true;
              submitBtn.textContent = 'Verifying...';
              message.innerHTML = '';
              
              try {
                const response = await fetch('/api/staff/verify', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    code: '${code}',
                    pin: pin
                  })
                });
                
                const data = await response.json();
                
                if (data.success) {
                  message.innerHTML = '<div class="success">✓ Access granted! Redirecting...</div>';
                  // Redirect to the same destination as public QR
                  setTimeout(() => {
                    window.location.href = 'https://greenhauscc.com/?utm_source=ambassador&utm_medium=qr&utm_campaign=${code}';
                  }, 1000);
                } else {
                  message.innerHTML = '<div class="error">' + (data.error || 'Invalid PIN') + '</div>';
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Verify & Access';
                }
              } catch (error) {
                message.innerHTML = '<div class="error">Verification failed. Please try again.</div>';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Verify & Access';
              }
            });
            
            // Auto-focus PIN input
            document.getElementById('pin').focus();
          </script>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
  } catch (error) {
    console.error('Error processing staff ambassador redirect:', error);
    // Fallback redirect to homepage
    return NextResponse.redirect(new URL('/', request.url));
  }
}
