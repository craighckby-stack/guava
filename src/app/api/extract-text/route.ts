import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided', success: false }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = '';
    const mimeType = file.type;
    const fileName = file.name.toLowerCase();

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        // Import pdf-parse internal lib to avoid index.js trying to open ./test/data/05-versions-space.pdf
        const pdfParse = require('pdf-parse/lib/pdf-parse.js');
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
      } catch (pdfErr: any) {
        console.warn('pdf-parse failed, using fallback text extraction:', pdfErr?.message);
        const rawString = buffer.toString('binary');
        const textMatches = rawString.match(/[\x20-\x7E\t\r\n]{4,}/g);
        if (textMatches) {
          text = textMatches
            .filter(line => !line.startsWith('%PDF') && !line.includes('/Type') && !line.includes('/Filter') && !line.includes('endobj') && !line.includes('stream'))
            .join('\n');
        } else {
          text = '[PDF Text Extraction Unavailable]';
        }
      }
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      fileName.endsWith('.docx')
    ) {
      try {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } catch (mammothErr: any) {
        text = buffer.toString('utf-8');
      }
    } else {
      text = buffer.toString('utf-8');
    }

    return NextResponse.json({ text: text || '', success: true });
  } catch (error: any) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: error.message || 'Extraction failed', success: false }, { status: 200 });
  }
}

