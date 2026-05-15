const pool = require('../config/db');
const { hashPassword, isBcryptHash, verifyPassword } = require('../utils/hash.util');
const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD, SEED_DEFAULT_ADMIN } = require('../config/env');

class UserModel {
  constructor() {
    this.schemaReadyPromise = null;
  }

  async ensureAuthSchemaReady() {
    if (!this.schemaReadyPromise) {
      this.schemaReadyPromise = (async () => {
        await this.ensureAuthTables();
        await this.ensureProfileFields();
        await this.ensureBaseRoles();
      })().catch((error) => {
        this.schemaReadyPromise = null;
        throw error;
      });
    }

    return this.schemaReadyPromise;
  }

  async ensureAuthTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        descripcion TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        telefono VARCHAR(50),
        direccion TEXT,
        avatar_url TEXT,
        configuracion_metodos_pago JSONB NOT NULL DEFAULT '{}'::jsonb,
        password TEXT NOT NULL,
        password_actualizada_en TIMESTAMP NOT NULL DEFAULT NOW(),
        activo BOOLEAN NOT NULL DEFAULT true,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usuario_roles (
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        rol_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (usuario_id, rol_id)
      )
    `);
  }

  async ensureProfileFields() {
    await pool.query(`
      ALTER TABLE IF EXISTS usuarios
      ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
      ADD COLUMN IF NOT EXISTS direccion TEXT,
      ADD COLUMN IF NOT EXISTS avatar_url TEXT,
      ADD COLUMN IF NOT EXISTS configuracion_metodos_pago JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS password_actualizada_en TIMESTAMP NOT NULL DEFAULT NOW()
    `);
  }

  async ensureBaseRoles() {
    await pool.query(`
      INSERT INTO roles (nombre, descripcion)
      SELECT 'admin', 'Acceso total al sistema'
      WHERE NOT EXISTS (
        SELECT 1 FROM roles WHERE LOWER(nombre) = 'admin'
      )
    `);

    await pool.query(`
      INSERT INTO roles (nombre, descripcion)
      SELECT 'vendedor', 'Puede visualizar productos y operar ventas'
      WHERE NOT EXISTS (
        SELECT 1 FROM roles WHERE LOWER(nombre) = 'vendedor'
      )
    `);
  }

  async ensureAdminUser() {
    if (!SEED_DEFAULT_ADMIN) {
      return;
    }

    const existingAdmin = await this.findByEmail(ADMIN_EMAIL);

    if (existingAdmin) {
      const adminRole = await this.findRoleByName('admin');

      if (adminRole) {
        await pool.query(
          `
            INSERT INTO usuario_roles (usuario_id, rol_id)
            VALUES ($1, $2)
            ON CONFLICT (usuario_id, rol_id) DO NOTHING
          `,
          [existingAdmin.id, adminRole.id],
        );
      }

      return;
    }

    const adminRole = await this.findRoleByName('admin');

    if (!adminRole) {
      throw new Error('No se pudo inicializar el rol admin');
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const result = await this.createUser({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      roleName: adminRole.nombre,
      phone: '',
      address: '',
      avatarUrl: '',
    });

    if (result.error) {
      throw new Error(`No se pudo inicializar el usuario administrador: ${result.error}`);
    }
  }

  mapPublicUser(user) {
    return {
      id: user.id,
      name: user.nombre,
      email: user.email,
      role: user.rol || null,
      phone: user.telefono || '',
      address: user.direccion || '',
      avatarUrl: user.avatar_url || '',
      paymentMethodSettings: this.normalizePaymentMethodSettings(user.configuracion_metodos_pago),
      active: typeof user.activo === 'boolean' ? user.activo : true,
    };
  }

  normalizePaymentMethodSettings(rawSettings) {
    const source =
      rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? rawSettings : {};

    return ['efectivo', 'transferencia', 'tarjeta', 'cuenta_corriente'].reduce(
      (accumulator, method) => {
        const entry =
          source[method] && typeof source[method] === 'object' && !Array.isArray(source[method])
            ? source[method]
            : {};
        const tipo = entry.tipo === 'aumento' ? 'aumento' : 'descuento';
        const porcentaje = Number(entry.porcentaje || 0);

        accumulator[method] = {
          tipo,
          porcentaje: Number.isFinite(porcentaje) && porcentaje >= 0 ? porcentaje : 0,
        };

        return accumulator;
      },
      {},
    );
  }

  async findByEmail(email) {
    await this.ensureAuthSchemaReady();

    const query = `
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.telefono,
        u.direccion,
        u.avatar_url,
        u.configuracion_metodos_pago,
        u.password,
        u.activo,
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
      LEFT JOIN roles r ON r.id = ur.rol_id
      WHERE LOWER(u.email) = LOWER($1)
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [email]);

    return rows[0] || null;
  }

  async findRoleByName(roleName) {
    await this.ensureAuthSchemaReady();

    const { rows } = await pool.query(
      'SELECT id, nombre FROM roles WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
      [roleName],
    );

    return rows[0] || null;
  }

  async findPublicById(id) {
    await this.ensureAuthSchemaReady();

    const query = `
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.telefono,
        u.direccion,
        u.avatar_url,
        u.configuracion_metodos_pago,
        u.activo,
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
      LEFT JOIN roles r ON r.id = ur.rol_id
      WHERE u.id = $1
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [id]);
    const user = rows[0];

    if (!user || !user.activo) {
      return null;
    }

    return this.mapPublicUser(user);
  }

  async validateCredentials(email, password) {
    await this.ensureAuthSchemaReady();

    const user = await this.findByEmail(email);

    if (!user || !user.activo) {
      return null;
    }

    const isValid = await verifyPassword(password, user.password);

    if (!isValid) {
      return null;
    }

    if (!isBcryptHash(user.password)) {
      const passwordHash = await hashPassword(password);

      await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [passwordHash, user.id]);
    }

    return this.mapPublicUser(user);
  }

  async createUser({
    name,
    email,
    passwordHash,
    roleName,
    phone,
    address,
    avatarUrl,
    paymentMethodSettings = {},
  }) {
    await this.ensureAuthSchemaReady();

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingUser = await client.query(
        'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1',
        [email],
      );

      if (existingUser.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'EMAIL_EXISTS' };
      }

      const roleResult = await client.query(
        'SELECT id, nombre FROM roles WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
        [roleName],
      );

      const role = roleResult.rows[0];

      if (!role) {
        await client.query('ROLLBACK');
        return { error: 'ROLE_NOT_FOUND' };
      }

      const userResult = await client.query(
        `
          INSERT INTO usuarios (
            nombre,
            email,
            telefono,
            direccion,
            avatar_url,
            configuracion_metodos_pago,
            password,
            activo,
            fecha_creacion,
            fecha_actualizacion
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true, NOW(), NOW())
          RETURNING id, nombre, email, telefono, direccion, avatar_url, configuracion_metodos_pago
        `,
        [
          name,
          email.toLowerCase(),
          phone ? phone.trim() : null,
          address ? address.trim() : null,
          avatarUrl ? avatarUrl.trim() : null,
          JSON.stringify(this.normalizePaymentMethodSettings(paymentMethodSettings)),
          passwordHash,
        ],
      );

      const user = userResult.rows[0];

      await client.query(
        'INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)',
        [user.id, role.id],
      );

      await client.query('COMMIT');

      return {
        user: {
          ...this.mapPublicUser({
            ...user,
            rol: role.nombre,
          }),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProfile({ userId, name, email, phone, address, avatarUrl, paymentMethodSettings = {} }) {
    await this.ensureAuthSchemaReady();

    const normalizedEmail = email.trim().toLowerCase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingUser = await client.query(
        `
          SELECT id
          FROM usuarios
          WHERE LOWER(email) = LOWER($1) AND id <> $2
          LIMIT 1
        `,
        [normalizedEmail, userId],
      );

      if (existingUser.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'EMAIL_EXISTS' };
      }

      const result = await client.query(
        `
          UPDATE usuarios
          SET
            nombre = $1,
            email = $2,
            telefono = $3,
            direccion = $4,
            avatar_url = $5,
            configuracion_metodos_pago = $6::jsonb,
            fecha_actualizacion = NOW()
          WHERE id = $7 AND activo = true
          RETURNING id, nombre, email, telefono, direccion, avatar_url, configuracion_metodos_pago
        `,
        [
          name.trim(),
          normalizedEmail,
          phone ? phone.trim() : null,
          address ? address.trim() : null,
          avatarUrl ? avatarUrl.trim() : null,
          JSON.stringify(this.normalizePaymentMethodSettings(paymentMethodSettings)),
          userId,
        ],
      );

      const user = result.rows[0];

      if (!user) {
        await client.query('ROLLBACK');
        return { error: 'USER_NOT_FOUND' };
      }

      const roleResult = await client.query(
        `
          SELECT r.nombre AS rol
          FROM usuario_roles ur
          INNER JOIN roles r ON r.id = ur.rol_id
          WHERE ur.usuario_id = $1
          LIMIT 1
        `,
        [userId],
      );

      await client.query('COMMIT');

      return {
        user: this.mapPublicUser({
          ...user,
          rol: roleResult.rows[0]?.rol || null,
        }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async changePassword({ userId, currentPassword, newPasswordHash }) {
    await this.ensureAuthSchemaReady();

    const user = await this.findByIdWithPassword(userId);

    if (!user || !user.activo) {
      return { error: 'USER_NOT_FOUND' };
    }

    const isValid = await verifyPassword(currentPassword, user.password);

    if (!isValid) {
      return { error: 'CURRENT_PASSWORD_INVALID' };
    }

    await pool.query(
      `
        UPDATE usuarios
        SET password = $1, password_actualizada_en = NOW(), fecha_actualizacion = NOW()
        WHERE id = $2
      `,
      [newPasswordHash, userId],
    );

    return { ok: true };
  }

  async findByIdWithPassword(id) {
    await this.ensureAuthSchemaReady();

    const { rows } = await pool.query(
      `
        SELECT id, password, activo
        FROM usuarios
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    return rows[0] || null;
  }

  async listUsers() {
    await this.ensureAuthSchemaReady();

    const { rows } = await pool.query(`
      SELECT
        u.id,
        u.nombre,
        u.email,
        u.telefono,
        u.direccion,
        u.avatar_url,
        u.configuracion_metodos_pago,
        u.activo,
        r.nombre AS rol
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
      LEFT JOIN roles r ON r.id = ur.rol_id
      ORDER BY u.activo DESC, u.nombre ASC, u.id ASC
    `);

    return rows.map((row) => this.mapPublicUser(row));
  }

  async updateUserByAdmin({ userId, name, email, phone, address, roleName, active }) {
    await this.ensureAuthSchemaReady();

    const normalizedEmail = email.trim().toLowerCase();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingUser = await client.query(
        `
          SELECT id
          FROM usuarios
          WHERE LOWER(email) = LOWER($1) AND id <> $2
          LIMIT 1
        `,
        [normalizedEmail, userId],
      );

      if (existingUser.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'EMAIL_EXISTS' };
      }

      const roleResult = await client.query(
        'SELECT id, nombre FROM roles WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
        [roleName],
      );

      const role = roleResult.rows[0];

      if (!role) {
        await client.query('ROLLBACK');
        return { error: 'ROLE_NOT_FOUND' };
      }

      const updateResult = await client.query(
        `
          UPDATE usuarios
          SET
            nombre = $1,
            email = $2,
            telefono = $3,
            direccion = $4,
            activo = $5,
            fecha_actualizacion = NOW()
          WHERE id = $6
          RETURNING id, nombre, email, telefono, direccion, avatar_url, configuracion_metodos_pago, activo
        `,
        [
          name.trim(),
          normalizedEmail,
          phone ? phone.trim() : null,
          address ? address.trim() : null,
          active,
          userId,
        ],
      );

      const user = updateResult.rows[0];

      if (!user) {
        await client.query('ROLLBACK');
        return { error: 'USER_NOT_FOUND' };
      }

      await client.query('DELETE FROM usuario_roles WHERE usuario_id = $1', [userId]);
      await client.query('INSERT INTO usuario_roles (usuario_id, rol_id) VALUES ($1, $2)', [
        userId,
        role.id,
      ]);

      await client.query('COMMIT');

      return {
        user: this.mapPublicUser({
          ...user,
          rol: role.nombre,
        }),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async setUserActiveStatus({ userId, active }) {
    await this.ensureAuthSchemaReady();

    const { rows } = await pool.query(
      `
        UPDATE usuarios
        SET activo = $1, fecha_actualizacion = NOW()
        WHERE id = $2
        RETURNING id, nombre, email, telefono, direccion, avatar_url, configuracion_metodos_pago, activo
      `,
      [active, userId],
    );

    const user = rows[0];

    if (!user) {
      return { error: 'USER_NOT_FOUND' };
    }

    const roleResult = await pool.query(
      `
        SELECT r.nombre AS rol
        FROM usuario_roles ur
        INNER JOIN roles r ON r.id = ur.rol_id
        WHERE ur.usuario_id = $1
        LIMIT 1
      `,
      [userId],
    );

    return {
      user: this.mapPublicUser({
        ...user,
        rol: roleResult.rows[0]?.rol || null,
      }),
    };
  }

  async findSessionUserById(id) {
    await this.ensureAuthSchemaReady();

    const { rows } = await pool.query(
      `
        SELECT
          u.id,
          u.email,
          u.activo,
          u.password_actualizada_en,
          r.nombre AS rol
        FROM usuarios u
        LEFT JOIN usuario_roles ur ON ur.usuario_id = u.id
        LEFT JOIN roles r ON r.id = ur.rol_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [id],
    );

    const user = rows[0];

    if (!user || !user.activo) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.rol || null,
      passwordUpdatedAt: user.password_actualizada_en,
    };
  }

  async updatePasswordByUserId({ userId, passwordHash }, client = pool) {
    const { rowCount } = await client.query(
      `
        UPDATE usuarios
        SET
          password = $1,
          password_actualizada_en = NOW(),
          fecha_actualizacion = NOW()
        WHERE id = $2 AND activo = true
      `,
      [passwordHash, userId],
    );

    return rowCount > 0;
  }
}

module.exports = new UserModel();
