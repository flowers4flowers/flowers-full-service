import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  console.log('API route called');
  
  // Check if API key is loaded
  if (!process.env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not found in environment variables');
    return NextResponse.json(
      { error: 'Server configuration error: Missing API key' },
      { status: 500 }
    );
  }

  try {
    const formData = await request.json();
    console.log('Received form data:', formData);
    
    const { name, email, company, role, challenge, timeline } = formData;

    // Email content
    const emailContent = `
      <h2>New Creative Challenge Inquiry</h2>
      
      <p><strong>Contact Information:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${name}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Company:</strong> ${company}</li>
        <li><strong>Role:</strong> ${role}</li>
      </ul>
      
      <p><strong>Project Details:</strong></p>
      <ul>
        <li><strong>Timeline:</strong> ${timeline}</li>
      </ul>
      
      <p><strong>Creative Challenge:</strong></p>
      <p style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #333; margin: 10px 0;">
        ${challenge.replace(/\n/g, '<br>')}
      </p>
      
      <hr style="margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">
        This inquiry was submitted through the Flowers Full Service website contact form.
      </p>
    `;

    // Send email using Resend
    console.log('Attempting to send email...');
    const { data, error } = await resend.emails.send({
      from: 'Website Contact Form <noreply@flowersfullservice.art>', // Must be from your verified domain
      to: ['studio@flowersfullservice.art'],
      subject: `New Creative Challenge Inquiry from ${name} at ${company}`,
      html: emailContent,
      replyTo: email, // This allows you to reply directly to the person who submitted the form
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error },
        { status: 500 }
      );
    }

    console.log('Email sent successfully:', data);
    return NextResponse.json(
      { message: 'Email sent successfully', id: data?.id },
      { status: 200 }
    );

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}