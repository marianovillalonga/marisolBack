const test = require('node:test');
const assert = require('node:assert/strict');

const envModulePath = require.resolve('../config/env');
const dbModulePath = require.resolve('../config/db');
const mailModulePath = require.resolve('../utils/mail.util');
const healthServicePath = require.resolve('./health.service');

function restoreModules() {
  delete require.cache[healthServicePath];
  delete require.cache[envModulePath];
  delete require.cache[dbModulePath];
  delete require.cache[mailModulePath];
}

test('getDependencyHealth devuelve ok=true cuando config y base estan operativas', async () => {
  restoreModules();
  require.cache[envModulePath] = {
    id: envModulePath,
    filename: envModulePath,
    loaded: true,
    exports: {
      validateRuntimeConfig() {},
    },
  };
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: {
      query: async () => ({ rows: [{ '?column?': 1 }] }),
    },
  };
  require.cache[mailModulePath] = {
    id: mailModulePath,
    filename: mailModulePath,
    loaded: true,
    exports: {
      isMailDeliveryAvailable: () => true,
    },
  };

  const { getDependencyHealth } = require('./health.service');
  const result = await getDependencyHealth();

  assert.deepEqual(result, {
    ok: true,
    configOk: true,
    databaseOk: true,
    mailOk: true,
  });

  restoreModules();
});

test('getDependencyHealth marca servicio degradado si falla la base o la configuracion', async () => {
  restoreModules();
  require.cache[envModulePath] = {
    id: envModulePath,
    filename: envModulePath,
    loaded: true,
    exports: {
      validateRuntimeConfig() {
        throw new Error('config-invalida');
      },
    },
  };
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: {
      query: async () => {
        throw new Error('db-down');
      },
    },
  };
  require.cache[mailModulePath] = {
    id: mailModulePath,
    filename: mailModulePath,
    loaded: true,
    exports: {
      isMailDeliveryAvailable: () => false,
    },
  };

  const { getDependencyHealth } = require('./health.service');
  const result = await getDependencyHealth();

  assert.deepEqual(result, {
    ok: false,
    configOk: false,
    databaseOk: false,
    mailOk: false,
  });

  restoreModules();
});
