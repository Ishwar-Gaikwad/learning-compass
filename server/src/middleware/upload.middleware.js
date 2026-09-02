import { AppError } from '../utils/AppError.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit

export const determineFileType = (filename, mimetype) => {
  const ext = (filename.includes('.') ? filename.substring(filename.lastIndexOf('.')).toLowerCase() : '');

  if (ext === '.pdf' || mimetype === 'application/pdf') {
    return 'pdf';
  }
  if (ext === '.docx' || mimetype.includes('wordprocessingml') || mimetype === 'application/msword') {
    return 'docx';
  }
  if (ext === '.pptx' || mimetype.includes('presentationml') || mimetype === 'application/vnd.ms-powerpoint') {
    return 'pptx';
  }
  if (['.png', '.jpg', '.jpeg', '.tiff', '.webp'].includes(ext) || (mimetype && mimetype.startsWith('image/'))) {
    return 'image';
  }
  return null;
};

export const parseMultipartFormData = (buffer, contentTypeHeader) => {
  const match = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) return null;
  const boundary = match[1] || match[2];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  
  const fields = {};
  let file = null;

  let start = 0;
  while (start < buffer.length) {
    const boundaryIdx = buffer.indexOf(boundaryBuffer, start);
    if (boundaryIdx === -1) break;

    const nextBoundaryIdx = buffer.indexOf(boundaryBuffer, boundaryIdx + boundaryBuffer.length);
    if (nextBoundaryIdx === -1) break;

    const partBuffer = buffer.slice(boundaryIdx + boundaryBuffer.length, nextBoundaryIdx);
    const headerSepIdx = partBuffer.indexOf('\r\n\r\n');
    
    if (headerSepIdx !== -1) {
      const headerStr = partBuffer.slice(0, headerSepIdx).toString('utf8');
      let bodyBuffer = partBuffer.slice(headerSepIdx + 4);
      
      if (bodyBuffer.length >= 2 && bodyBuffer[bodyBuffer.length - 2] === 13 && bodyBuffer[bodyBuffer.length - 1] === 10) {
        bodyBuffer = bodyBuffer.slice(0, bodyBuffer.length - 2);
      }

      const nameMatch = headerStr.match(/name="([^"]+)"/i);
      const filenameMatch = headerStr.match(/filename="([^"]+)"/i);
      const mimeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch) {
          const originalname = filenameMatch[1];
          const mimetype = mimeMatch ? mimeMatch[1].trim() : 'application/octet-stream';
          file = {
            fieldname: fieldName,
            originalname,
            mimetype,
            buffer: bodyBuffer,
            size: bodyBuffer.length
          };
        } else {
          fields[fieldName] = bodyBuffer.toString('utf8').trim();
        }
      }
    }

    start = nextBoundaryIdx;
  }

  return { fields, file };
};

export const uploadSingleFile = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return next(new AppError('Content-Type must be multipart/form-data', 400, 'INVALID_CONTENT_TYPE'));
  }

  const chunks = [];
  let totalLength = 0;
  let isTooLarge = false;

  req.on('data', (chunk) => {
    totalLength += chunk.length;
    if (totalLength > MAX_FILE_SIZE + 65536) {
      isTooLarge = true;
    } else {
      chunks.push(chunk);
    }
  });

  req.on('end', () => {
    if (isTooLarge || totalLength > MAX_FILE_SIZE) {
      return next(new AppError('File size exceeds the 10MB limit.', 400, 'FILE_TOO_LARGE'));
    }

    try {
      const fullBuffer = Buffer.concat(chunks);
      const parsed = parseMultipartFormData(fullBuffer, contentType);

      if (!parsed || !parsed.file) {
        return next(new AppError('Please select a file to upload.', 400, 'MISSING_FILE'));
      }

      const file = parsed.file;

      if (file.originalname.includes('\0')) {
        return next(new AppError('Filename contains illegal characters.', 400, 'INVALID_FILENAME'));
      }

      const disallowedExts = ['.exe', '.js', '.sh', '.bat', '.cmd', '.vbs', '.php', '.py', '.pl', '.dll', '.bin'];
      const fileExt = file.originalname.includes('.') ? file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase() : '';
      if (disallowedExts.includes(fileExt)) {
        return next(new AppError('Executable and script file types are strictly prohibited.', 400, 'INVALID_FILE_TYPE'));
      }

      if (file.size > MAX_FILE_SIZE) {
        return next(new AppError('File size exceeds the 10MB limit.', 400, 'FILE_TOO_LARGE'));
      }

      const fileType = determineFileType(file.originalname, file.mimetype);
      if (!fileType) {
        return next(new AppError('Invalid file type. Supported formats are PDF, DOCX, PPTX, and Images.', 400, 'INVALID_FILE_TYPE'));
      }

      file.fileType = fileType;
      req.file = file;
      req.body = { ...req.body, ...parsed.fields };

      next();
    } catch (err) {
      return next(new AppError(`Error processing file upload: ${err.message}`, 400, 'UPLOAD_ERROR'));
    }
  });

  req.on('error', (err) => {
    next(new AppError(`File stream upload error: ${err.message}`, 400, 'UPLOAD_ERROR'));
  });
};
