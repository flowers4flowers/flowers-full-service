import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Test API route called');
  
  // Check environment variable
  const apiKey = process.env.RESEND_API_KEY;
  console.log('API Key exists:', !!apiKey);
  console.log('API Key length:', apiKey ? apiKey.length : 0);
  
  if (!apiKey) {
    return NextResponse.json({
      error: 'RESEND_API_KEY not found',
      env: process.env.NODE_ENV,
      keys: Object.keys(process.env).filter(key => key.includes('RESEND'))
    });
  }

  try {
    const resend = new Resend(apiKey);
    
    // Test sending a simple email
    const { data, error } = await resend.emails.send({
      from: 'Test <noreply@flowersfullservice.art>',
      to: ['studio@flowersfullservice.art'],
      subject: 'Test Email from API',
      html: '<h1>This is a test email</h1><p>If you receive this, the setup is working!</p>',
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({
        success: false,
        error: error,
        message: 'Failed to send test email'
      });
    }

    console.log('Test email sent successfully:', data);
    return NextResponse.json({
      success: true,
      data: data,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    console.error('Catch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      message: 'Exception occurred'
    });
  }
}