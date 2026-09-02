import zlib from 'zlib';

export const textExtractor = {
  extractTextFromPdfBuffer(pdfBuffer) {
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      throw new Error('Invalid PDF buffer provided for text extraction.');
    }

    let extractedText = '';
    const str = pdfBuffer.toString('binary');

    // Find all stream ... endstream blocks in PDF binary structure
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;

    while ((match = streamRegex.exec(str)) !== null) {
      let streamData = Buffer.from(match[1], 'binary');
      let decodedText = '';

      // Decompress FlateDecode zlib streams
      try {
        const inflated = zlib.inflateSync(streamData);
        decodedText = inflated.toString('latin1');
      } catch (e1) {
        try {
          const unzipped = zlib.unzipSync(streamData);
          decodedText = unzipped.toString('latin1');
        } catch (e2) {
          decodedText = streamData.toString('latin1');
        }
      }

      // Extract text inside BT (Begin Text) ... ET (End Text) operators
      const btRegex = /BT[\s\S]*?ET/g;
      let btMatch;
      while ((btMatch = btRegex.exec(decodedText)) !== null) {
        const block = btMatch[0];

        // Match (string) Tj or (string) ' or (string) "
        const tjRegex = /\((.*?)\)\s*(?:Tj|'|")/g;
        let tjMatch;
        while ((tjMatch = tjRegex.exec(block)) !== null) {
          let textSegment = tjMatch[1]
            .replace(/\\\\/g, '\\')
            .replace(/\\\(/g, '(')
            .replace(/\\\)/g, ')')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t');
          extractedText += textSegment + ' ';
        }

        // Match [(string) offset (string)] TJ
        const arrayTjRegex = /\[(.*?)\]\s*TJ/g;
        let arrayTjMatch;
        while ((arrayTjMatch = arrayTjRegex.exec(block)) !== null) {
          const inner = arrayTjMatch[1];
          const stringInsideRegex = /\((.*?)\)/g;
          let strMatch;
          while ((strMatch = stringInsideRegex.exec(inner)) !== null) {
            let textSegment = strMatch[1]
              .replace(/\\\\/g, '\\')
              .replace(/\\\(/g, '(')
              .replace(/\\\)/g, ')')
              .replace(/\\n/g, '\n')
              .replace(/\\r/g, '\r')
              .replace(/\\t/g, '\t');
            extractedText += textSegment + ' ';
          }
        }
      }
    }

    // Fallback: extract uncompressed Tj strings if BT stream blocks were absent
    if (!extractedText || extractedText.trim().length === 0) {
      const rawTjRegex = /\(([^()]{3,})\)\s*(?:Tj|'|")/g;
      let rawMatch;
      while ((rawMatch = rawTjRegex.exec(str)) !== null) {
        const rawText = rawMatch[1].replace(/[\r\n\t]/g, ' ').trim();
        if (rawText.length > 2 && !rawText.startsWith('/') && !rawText.includes('Font')) {
          extractedText += rawText + ' ';
        }
      }
    }

    // Clean non-printable characters and normalize whitespace
    const cleanedText = extractedText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const characterCount = cleanedText.length;
    const wordCount = cleanedText.split(/\s+/).filter(Boolean).length;

    // Usability threshold: at least 20 characters AND 3 words required for usable text
    const hasUsableText = characterCount >= 20 && wordCount >= 3;

    return {
      text: hasUsableText ? cleanedText : '',
      characterCount: hasUsableText ? characterCount : 0,
      wordCount: hasUsableText ? wordCount : 0,
      hasUsableText,
      fileType: 'pdf'
    };
  }
};
