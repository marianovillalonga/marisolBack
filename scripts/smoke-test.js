require('dotenv').config();

const crypto = require('crypto');

const baseUrl = String(process.env.SMOKE_BASE_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;

function buildUrl(pathname) {
  return `${baseUrl}${pathname}`;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createEanSeed() {
  return Date.now().toString().slice(-12).padStart(12, '0');
}

function createRunId() {
  return crypto.randomUUID().slice(0, 8);
}

class SmokeApiClient {
  constructor() {
    this.cookieJar = new Map();
  }

  applySetCookie(response) {
    const setCookies =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter(Boolean);

    for (const header of setCookies) {
      const [pair] = String(header).split(';');
      const separatorIndex = pair.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const name = pair.slice(0, separatorIndex).trim();
      const value = pair.slice(separatorIndex + 1).trim();

      if (!value) {
        this.cookieJar.delete(name);
        continue;
      }

      this.cookieJar.set(name, value);
    }
  }

  buildCookieHeader() {
    return Array.from(this.cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async request(pathname, { method = 'GET', body, expectedStatus, headers = {} } = {}) {
    const finalHeaders = {
      Accept: 'application/json',
      'X-Request-Id': `smoke-${createRunId()}`,
      ...headers,
    };

    if (body !== undefined) {
      finalHeaders['Content-Type'] = 'application/json';
    }

    const cookieHeader = this.buildCookieHeader();

    if (cookieHeader) {
      finalHeaders.Cookie = cookieHeader;
    }

    const response = await fetch(buildUrl(pathname), {
      method,
      headers: finalHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    this.applySetCookie(response);

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { ok: response.ok, message: await response.text() };

    if (expectedStatus !== undefined && response.status !== expectedStatus) {
      throw new Error(
        `Respuesta inesperada para ${method} ${pathname}. Esperado ${expectedStatus}, recibido ${response.status}. ${payload?.message || ''}`.trim(),
      );
    }

    return {
      status: response.status,
      ok: response.ok,
      body: payload,
      requestId: response.headers.get('x-request-id'),
    };
  }
}

async function main() {
  if (!adminEmail || !adminPassword) {
    throw new Error('Faltan SMOKE_ADMIN_EMAIL y/o SMOKE_ADMIN_PASSWORD para ejecutar los smoke tests.');
  }

  const api = new SmokeApiClient();
  const runId = createRunId();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const workerEmail = `smoke+${runId}@example.com`;
  const workerPassword = `SmokePass-${runId}!2026`;
  const productName = `Producto Smoke ${runId}`;
  const clientName = `Cliente Smoke ${runId}`;
  const eanSeed = createEanSeed();

  console.log(`[smoke] Health check en ${baseUrl}`);
  const health = await api.request('/api/health', { expectedStatus: 200 });
  assert(health.body?.ok === true, 'El health check no devolvio ok=true');

  console.log('[smoke] Login admin');
  const login = await api.request('/api/auth/login', {
    method: 'POST',
    expectedStatus: 200,
    body: {
      email: adminEmail,
      password: adminPassword,
    },
  });
  assert(login.body?.user?.id, 'Login sin usuario valido');

  const me = await api.request('/api/auth/me', { expectedStatus: 200 });
  assert(me.body?.user?.email?.toLowerCase() === adminEmail.toLowerCase(), 'La sesion no corresponde al admin');

  console.log('[smoke] Gestion de usuarios');
  const createdUser = await api.request('/api/users', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      name: `Operador Smoke ${runId}`,
      email: workerEmail,
      password: workerPassword,
      role: 'vendedor',
      phone: '1133344455',
      address: 'QA Street 123',
    },
  });
  const workerId = createdUser.body?.user?.id;
  assert(workerId, 'No se pudo crear el usuario vendedor de smoke');

  const users = await api.request('/api/users', { expectedStatus: 200 });
  assert(
    Array.isArray(users.body?.users) &&
      users.body.users.some((user) => user.id === workerId && user.email === workerEmail),
    'El usuario creado no aparece en el listado',
  );

  await api.request(`/api/users/${workerId}/block`, {
    method: 'PATCH',
    expectedStatus: 200,
  });
  await api.request(`/api/users/${workerId}/unblock`, {
    method: 'PATCH',
    expectedStatus: 200,
  });

  console.log('[smoke] Crear producto');
  const createdProduct = await api.request('/api/products', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      nombre: productName,
      categoria: 'Smoke QA',
      subcategoria: 'Automation',
      codigoBarras: eanSeed,
      cantidad: 5,
      stockMinimo: 2,
      precio: 1500,
      detalle: 'Producto generado por smoke test automatizado',
      imageUrl: '',
    },
  });
  const productId = createdProduct.body?.product?.id;
  assert(productId, 'No se pudo crear el producto');

  const listedProducts = await api.request('/api/products?page=1&pageSize=5&search=Producto%20Smoke', {
    expectedStatus: 200,
  });
  assert(listedProducts.body?.pagination?.totalItems >= 1, 'La paginacion de productos no devolvio totalItems');

  console.log('[smoke] Crear cliente');
  const createdClient = await api.request('/api/clients', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      nombre: clientName,
      telefono: '1122233344',
      email: `cliente+${runId}@example.com`,
      direccion: 'Cliente Street 456',
      documento: `${Date.now()}`,
      notas: 'Cliente generado por smoke test',
      limiteCredito: 10000,
    },
  });
  const clientId = createdClient.body?.client?.id;
  assert(clientId, 'No se pudo crear el cliente');

  const listedClients = await api.request('/api/clients?page=1&pageSize=5&search=Cliente%20Smoke', {
    expectedStatus: 200,
  });
  assert(listedClients.body?.pagination?.totalItems >= 1, 'La paginacion de clientes no devolvio totalItems');

  console.log('[smoke] Actualizar stock via pedido a proveedor');
  const supplierOrder = await api.request('/api/orders', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      tipo: 'proveedor',
      fechaPedido: today,
      notas: 'Ingreso de stock por smoke test',
      items: [
        {
          productoId: productId,
          productoNombre: productName,
          cantidad: 3,
          costoUnitario: 900,
        },
      ],
    },
  });
  const supplierOrderId = supplierOrder.body?.order?.id;
  assert(supplierOrderId, 'No se pudo crear el pedido de proveedor');

  let productAfterSupplierOrder = await api.request(`/api/products/${productId}`, { expectedStatus: 200 });
  assert(productAfterSupplierOrder.body?.product?.cantidad === 8, 'El stock no aumento despues del pedido de proveedor');

  console.log('[smoke] Crear venta');
  const sale = await api.request('/api/sales', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      clientId,
      descuento: 0,
      montoPagado: 3000,
      notas: 'Venta generada por smoke test',
      fechaVenta: today,
      pagos: [{ metodo: 'efectivo', monto: 3000 }],
      items: [
        {
          productoId: productId,
          productoNombre: productName,
          cantidad: 2,
          precioUnitario: 1500,
        },
      ],
    },
  });
  const saleId = sale.body?.sale?.id;
  assert(saleId, 'No se pudo crear la venta');

  const listedSales = await api.request('/api/sales?page=1&pageSize=5&search=Venta', {
    expectedStatus: 200,
  });
  assert(listedSales.body?.pagination?.page === 1, 'La paginacion de ventas no devolvio la pagina esperada');

  let productAfterSale = await api.request(`/api/products/${productId}`, { expectedStatus: 200 });
  assert(productAfterSale.body?.product?.cantidad === 6, 'El stock no desconto correctamente despues de la venta');

  console.log('[smoke] Crear pedido de cliente');
  const customerOrder = await api.request('/api/orders', {
    method: 'POST',
    expectedStatus: 201,
    body: {
      tipo: 'cliente',
      fechaPedido: today,
      fechaEvento: tomorrow,
      fechaEntrega: today,
      clienteNombre: clientName,
      clienteTelefono: '1122233344',
      agasajadoNombre: `Agasajado ${runId}`,
      edadAgasajado: 10,
      tematica: 'Smoke',
      montoEntregado: 0,
      notas: 'Pedido cliente generado por smoke test',
      items: [
        {
          productoId: productId,
          productoNombre: productName,
          cantidad: 1,
          costoUnitario: 1500,
        },
      ],
    },
  });
  const customerOrderId = customerOrder.body?.order?.id;
  assert(customerOrderId, 'No se pudo crear el pedido de cliente');

  await api.request(`/api/orders/${customerOrderId}/customer`, {
    method: 'PATCH',
    expectedStatus: 200,
    body: {
      estado: 'hecho',
      montoEntregado: 0,
    },
  });

  const deliveredOrder = await api.request(`/api/orders/${customerOrderId}/customer`, {
    method: 'PATCH',
    expectedStatus: 200,
    body: {
      estado: 'entregado',
      montoEntregado: 1500,
      metodoPago: 'efectivo',
    },
  });
  assert(deliveredOrder.body?.order?.ventaId, 'La entrega del pedido no genero la venta asociada');

  const listedOrders = await api.request('/api/orders?page=1&pageSize=5&search=Smoke', {
    expectedStatus: 200,
  });
  assert(listedOrders.body?.pagination?.totalItems >= 1, 'La paginacion de pedidos no devolvio resultados');

  const orderDetail = await api.request(`/api/orders/${customerOrderId}`, { expectedStatus: 200 });
  assert(orderDetail.body?.order?.estado === 'entregado', 'El pedido de cliente no quedo entregado');

  const productAfterCustomerDelivery = await api.request(`/api/products/${productId}`, { expectedStatus: 200 });
  assert(
    productAfterCustomerDelivery.body?.product?.cantidad === 5,
    'El stock no desconto correctamente despues de entregar el pedido de cliente',
  );

  console.log('[smoke] Logout');
  await api.request('/api/auth/logout', {
    method: 'POST',
    expectedStatus: 200,
  });

  const postLogoutMe = await api.request('/api/auth/me', {
    expectedStatus: 401,
  });
  assert(postLogoutMe.body?.ok === false, 'La sesion siguio activa despues del logout');

  console.log('[smoke] OK');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[smoke] FAIL: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
