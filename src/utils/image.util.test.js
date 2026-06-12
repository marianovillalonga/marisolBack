const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');

const { MAX_IMAGE_BYTES, normalizeImageUrl, validateImageUrl } = require('./image.util');

const VALID_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2pH8sAAAAASUVORK5CYII=';

async function buildImageDataUrl(format, mimeType = `image/${format}`) {
  const buffer = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 220, g: 80, b: 40, alpha: 1 },
    },
  })
    .toFormat(format)
    .toBuffer();

  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

test('validateImageUrl permite imagen base64 valida', () => {
  assert.equal(validateImageUrl(VALID_PNG_BASE64), null);
});

test('normalizeImageUrl permite PNG valido', async () => {
  const imageUrl = await buildImageDataUrl('png');
  const result = await normalizeImageUrl(imageUrl);

  assert.equal(result.error, undefined);
  assert.equal(result.imageUrl, imageUrl);
});

test('normalizeImageUrl permite WEBP valido', async () => {
  const imageUrl = await buildImageDataUrl('webp');
  const result = await normalizeImageUrl(imageUrl);

  assert.equal(result.error, undefined);
  assert.equal(result.imageUrl, imageUrl);
});

test('normalizeImageUrl permite JPG/JPEG valido', async () => {
  const jpegImageUrl = await buildImageDataUrl('jpeg', 'image/jpeg');
  const jpgImageUrl = jpegImageUrl.replace('data:image/jpeg', 'data:image/jpg');

  const jpegResult = await normalizeImageUrl(jpegImageUrl);
  const jpgResult = await normalizeImageUrl(jpgImageUrl);

  assert.equal(jpegResult.error, undefined);
  assert.equal(jpegResult.imageUrl, jpegImageUrl);
  assert.equal(jpgResult.error, undefined);
  assert.equal(jpgResult.imageUrl, jpgImageUrl);
});

test('validateImageUrl rechaza rutas con path traversal', () => {
  assert.equal(
    validateImageUrl('..\\..\\malicious.png'),
    'La referencia de imagen contiene rutas no permitidas',
  );
});

test('validateImageUrl rechaza MIME invalido', () => {
  assert.equal(
    validateImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='),
    'La imagen debe ser JPG, JPEG, PNG o WEBP',
  );
});

test('validateImageUrl rechaza PDF como formato no permitido', () => {
  const pdfDataUrl = `data:application/pdf;base64,${Buffer.from('%PDF-1.4').toString('base64')}`;

  assert.equal(validateImageUrl(pdfDataUrl), 'La imagen debe ser JPG, JPEG, PNG o WEBP');
});

test('validateImageUrl rechaza credenciales embebidas en URL', () => {
  assert.equal(
    validateImageUrl('https://user:secret@example.com/image.png'),
    'La URL de la imagen no puede incluir credenciales',
  );
});

test('normalizeImageUrl rechaza desajuste entre MIME declarado y contenido real', async () => {
  const result = await normalizeImageUrl(
    VALID_PNG_BASE64.replace('data:image/png', 'data:image/jpeg'),
  );

  assert.equal(result.error, 'El tipo real de la imagen no coincide con el MIME declarado');
});

test('normalizeImageUrl rechaza base64 que no representa una imagen real', async () => {
  const result = await normalizeImageUrl('data:image/png;base64,ZmFrZS1pbWFnZQ==');

  assert.equal(result.error, 'La imagen base64 no contiene un archivo valido');
});

test('normalizeImageUrl conserva imagen valida por debajo del maximo', async () => {
  const result = await normalizeImageUrl(VALID_PNG_BASE64);

  assert.equal(result.error, undefined);
  assert.equal(result.imageUrl, VALID_PNG_BASE64);
});

test('validateImageUrl rechaza URLs demasiado largas', () => {
  const oversizedUrl = `https://example.com/${'a'.repeat(2050)}`;

  assert.equal(validateImageUrl(oversizedUrl), 'La URL de la imagen es demasiado larga');
});

test('MAX_IMAGE_BYTES mantiene el limite esperado', () => {
  assert.equal(MAX_IMAGE_BYTES, 4 * 1024 * 1024);
});
