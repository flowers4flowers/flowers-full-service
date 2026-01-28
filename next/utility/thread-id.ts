import crypto from 'crypto';

export function generateThreadId(subject: string, headers?: any): string {
  // Clean the subject line by removing Re:, Fwd:, etc.
  let cleanSubject = subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
  
  // If there's an In-Reply-To or References header, use that for threading
  // Postmark provides these in the Headers array
  if (headers) {
    const inReplyTo = headers.find((h: any) => 
      h.Name.toLowerCase() === 'in-reply-to'
    );
    const references = headers.find((h: any) => 
      h.Name.toLowerCase() === 'references'
    );
    
    if (inReplyTo?.Value) {
      // Use the first message ID from the thread
      return crypto
        .createHash('sha256')
        .update(inReplyTo.Value)
        .digest('hex')
        .substring(0, 16);
    }
    
    if (references?.Value) {
      // Use the first reference
      const firstRef = references.Value.split(' ')[0];
      return crypto
        .createHash('sha256')
        .update(firstRef)
        .digest('hex')
        .substring(0, 16);
    }
  }
  
  // Fallback to subject-based threading
  return crypto
    .createHash('sha256')
    .update(cleanSubject)
    .digest('hex')
    .substring(0, 16);
}