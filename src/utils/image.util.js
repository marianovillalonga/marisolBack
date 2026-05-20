const sharp = require('sharp');

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_URL_LENGTH = 2048;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const COMPRESSIBLE_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const IMAGE_FORMAT_TO_MIME = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

function estimateBase64Size(base64Value) {
  const normalizedValue = base64Value.replace(/\s/g, '');
  const padding = normalizedValue.endsWith('==') ? 2 : normalizedValue.endsWith('=') ? 1 : 0;

  return Math.floor((normalizedValue.length * 3) / 4) - padding;
}

function parseDataImage(imageUrl) {
  const matches = imageUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

  if (!matches) {
    return null;
  }

  const [, mimeType, base64Value] = matches;

  return {
    mimeType: mimeType.toLowerCase(),
    base64Value,
  };
}

function containsUnsafePathSequence(value) {
  return (
    value.includes('../') ||
    value.includes('..\\') ||
    value.startsWith('/') ||
    value.startsWith('\\') ||
    /^[a-zA-Z]:[\\/]/.test(value)
  );
}

function containsControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function normalizeMimeAlias(mimeType) {
  if (mimeType === 'image/jpg') {
    return 'image/jpeg';
  }

  return mimeType;
}

async function detectImageMimeType(base64Value) {
  const inputBuffer = Buffer.from(base64Value, 'base64');

  if (!inputBuffer.length) {
    return null;
  }

  const metadata = await sharp(inputBuffer, { animated: true }).metadata();

  if (!metadata?.format) {
    return null;
  }

  return IMAGE_FORMAT_TO_MIME[String(metadata.format).toLowerCase()] || null;
}

function validateImageUrl(imageUrl) {
  if (!imageUrl) {
    return null;
  }

  if (containsControlCharacters(imageUrl)) {
    return 'La referencia de imagen contiene caracteres no permitidos';
  }

  if (containsUnsafePathSequence(imageUrl)) {
    return 'La referencia de imagen contiene rutas no permitidas';
  }

  if (imageUrl.startsWith('data:')) {
    const parsedImage = parseDataImage(imageUrl);

    if (!parsedImage) {
      return 'La imagen debe estar en formato base64 valido';
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(parsedImage.mimeType)) {
      return 'La imagen debe ser JPG, PNG, WEBP o GIF';
    }

    return null;
  }

  if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    return 'La URL de la imagen es demasiado larga';
  }

  try {
    const parsedUrl = new URL(imageUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return 'La URL de la imagen debe comenzar con http o https';
    }

    if (parsedUrl.username || parsedUrl.password) {
      return 'La URL de la imagen no puede incluir credenciales';
    }
  } catch (_error) {
    return 'La URL de la imagen no es valida';
  }

  return null;
}

async function compressBase64Image(imageUrl) {
  const parsedImage = parseDataImage(imageUrl);

  if (!parsedImage) {
    return { error: 'La imagen debe estar en formato base64 valido' };
  }

  const { mimeType, base64Value } = parsedImage;

  if (!COMPRESSIBLE_IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      error: 'Solo se pueden comprimir automaticamente imagenes JPG, PNG o WEBP',
    };
  }

  const inputBuffer = Buffer.from(base64Value, 'base64');
  const metadata = await sharp(inputBuffer).metadata();
  const widthCandidates = [metadata.width, 2400, 2000, 1600, 1280, 1024, 800, 640]
    .filter((width) => Number.isFinite(width) && width > 0)
    .filter((width, index, values) => values.indexOf(width) === index)
    .sort((left, right) => right - left);
  const qualityCandidates = [82, 72, 62, 52, 42, 34];

  for (const width of widthCandidates) {
    for (const quality of qualityCandidates) {
      let pipeline = sharp(inputBuffer, { animated: false }).rotate();

      if (metadata.width && width < metadata.width) {
        pipeline = pipeline.resize({
          width,
          withoutEnlargement: true,
        });
      }

      const outputBuffer = await pipeline
        .webp({
          quality,
          effort: 4,
        })
        .toBuffer();

      if (outputBuffer.length <= MAX_IMAGE_BYTES) {
        return {
          imageUrl: `data:image/webp;base64,${outputBuffer.toString('base64')}`,
        };
      }
    }
  }

  return {
    error: 'La imagen no se pudo reducir por debajo de 4 MB',
  };
}

async function normalizeImageUrl(imageUrl) {
  if (!imageUrl) {
    return {
      imageUrl: '',
    };
  }

  const validationError = validateImageUrl(imageUrl);

  if (validationError) {
    return { error: validationError };
  }

  if (!imageUrl.startsWith('data:')) {
    return {
      imageUrl,
    };
  }

  const parsedImage = parseDataImage(imageUrl);
  const detectedMimeType = await detectImageMimeType(parsedImage.base64Value).catch(() => null);

  if (!detectedMimeType) {
    return {
      error: 'La imagen base64 no contiene un archivo valido',
    };
  }

  if (normalizeMimeAlias(parsedImage.mimeType) !== normalizeMimeAlias(detectedMimeType)) {
    return {
      error: 'El tipo real de la imagen no coincide con el MIME declarado',
    };
  }

  const estimatedSize = estimateBase64Size(parsedImage.base64Value);

  if (estimatedSize <= MAX_IMAGE_BYTES) {
    return {
      imageUrl,
    };
  }

  return compressBase64Image(imageUrl);
}

module.exports = {
  MAX_IMAGE_BYTES,
  detectImageMimeType,
  normalizeImageUrl,
  validateImageUrl,
};
