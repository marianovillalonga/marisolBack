const pool = require('../config/db');
const { getCurrentMonthRange } = require('../utils/metrics.util');

const SORT_COLUMNS = {
  fecha: 'sale_date',
  producto: 'product_name',
  categoria: 'category_name',
  cantidad: 'quantity',
  precio: 'unit_price',
  precioUnitario: 'unit_price',
  total: 'total_sold',
  ganancia: 'profit',
  metodoPago: 'payment_method',
  vendedor: 'seller_name',
};

function buildFilteredSalesCte(filters = {}) {
  const params = [];
  const conditions = ["v.estado = 'confirmada'"];

  const addParam = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.from) {
    conditions.push(`v.fecha_venta >= ${addParam(filters.from)}::timestamp`);
  }

  if (filters.to) {
    conditions.push(`v.fecha_venta < (${addParam(filters.to)}::timestamp + INTERVAL '1 day')`);
  }

  if (filters.categoryId) {
    conditions.push(`COALESCE(c.id, 0) = ${addParam(filters.categoryId)}`);
  }

  if (filters.subcategoryId) {
    conditions.push(`COALESCE(sc.id, 0) = ${addParam(filters.subcategoryId)}`);
  }

  if (filters.productId) {
    conditions.push(`vd.producto_id = ${addParam(filters.productId)}`);
  }

  if (filters.userId) {
    conditions.push(`v.vendedor_id = ${addParam(filters.userId)}`);
  }

  if (filters.paymentMethod) {
    const placeholder = addParam(filters.paymentMethod.toLowerCase());
    conditions.push(`(
      LOWER(COALESCE(v.metodo_pago, '')) = ${placeholder}
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v.pagos, '[]'::jsonb)) AS payment
        WHERE LOWER(COALESCE(payment->>'metodo', '')) = ${placeholder}
      )
    )`);
  }

  if (filters.search) {
    const placeholder = addParam(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(
      LOWER(COALESCE(vd.producto_nombre, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(p.nombre, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(p.categoria, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(p.subcategoria, '')) LIKE ${placeholder}
      OR LOWER(COALESCE(u.nombre, '')) LIKE ${placeholder}
      OR CAST(v.id AS TEXT) LIKE REPLACE(${placeholder}, '%', '')
    )`);
  }

  const cte = `
    WITH filtered_sales AS (
      SELECT
        v.id AS sale_id,
        v.fecha_venta AS sale_date,
        v.metodo_pago AS payment_method,
        v.vendedor_id AS seller_id,
        u.nombre AS seller_name,
        vd.id AS detail_id,
        vd.producto_id AS product_id,
        COALESCE(p.nombre, vd.producto_nombre, 'Producto eliminado') AS product_name,
        COALESCE(p.categoria, 'Sin categoria') AS category_name,
        c.id AS category_id,
        COALESCE(p.subcategoria, 'Sin subcategoria') AS subcategory_name,
        sc.id AS subcategory_id,
        vd.cantidad::numeric AS quantity,
        vd.precio_unitario::numeric AS unit_price,
        vd.subtotal::numeric AS total_sold,
        NULL::numeric AS unit_cost,
        0::numeric AS total_cost,
        0::numeric AS profit
      FROM ventas v
      INNER JOIN venta_detalles vd ON vd.venta_id = v.id
      LEFT JOIN productos p ON p.id = vd.producto_id
      LEFT JOIN categorias c
        ON LOWER(TRIM(COALESCE(p.categoria, ''))) = LOWER(TRIM(c.nombre))
      LEFT JOIN subcategorias sc
        ON sc.categoria_id = c.id
       AND LOWER(TRIM(COALESCE(p.subcategoria, ''))) = LOWER(TRIM(sc.nombre))
      LEFT JOIN usuarios u ON u.id = v.vendedor_id
      WHERE ${conditions.join('\n        AND ')}
    )
  `;

  return { cte, params };
}

class MetricsModel {
  async getSummary(filters = {}) {
    const base = buildFilteredSalesCte(filters);
    const currentMonthRange = getCurrentMonthRange();
    const currentMonthBase = buildFilteredSalesCte({
      ...filters,
      from: currentMonthRange.from,
      to: currentMonthRange.to,
    });

    const [summaryResult, monthResult] = await Promise.all([
      pool.query(
        `
          ${base.cte}
          SELECT
            COALESCE(SUM(total_sold), 0)::numeric(12, 2) AS total_sold,
            COALESCE(SUM(profit), 0)::numeric(12, 2) AS total_profit,
            COUNT(DISTINCT sale_id)::int AS sales_count,
            COALESCE(SUM(quantity), 0)::int AS products_sold,
            CASE
              WHEN COUNT(DISTINCT sale_id) > 0
              THEN (COALESCE(SUM(total_sold), 0) / COUNT(DISTINCT sale_id))::numeric(12, 2)
              ELSE 0::numeric(12, 2)
            END AS average_ticket,
            (SELECT product_name FROM filtered_sales GROUP BY product_name ORDER BY SUM(quantity) DESC, product_name ASC LIMIT 1) AS top_product,
            (SELECT category_name FROM filtered_sales GROUP BY category_name ORDER BY SUM(quantity) DESC, category_name ASC LIMIT 1) AS top_category
          FROM filtered_sales
        `,
        base.params,
      ),
      pool.query(
        `
          ${currentMonthBase.cte}
          SELECT
            COALESCE(SUM(total_sold), 0)::numeric(12, 2) AS month_sales,
            COALESCE(SUM(profit), 0)::numeric(12, 2) AS month_profit
          FROM filtered_sales
        `,
        currentMonthBase.params,
      ),
    ]);

    const summary = summaryResult.rows[0] || {};
    const monthSummary = monthResult.rows[0] || {};

    return {
      totalSales: Number(summary.total_sold || 0),
      totalProfit: Number(summary.total_profit || 0),
      salesCount: Number(summary.sales_count || 0),
      productsSold: Number(summary.products_sold || 0),
      averageTicket: Number(summary.average_ticket || 0),
      topProduct: summary.top_product || null,
      topCategory: summary.top_category || null,
      currentMonthSales: Number(monthSummary.month_sales || 0),
      currentMonthProfit: Number(monthSummary.month_profit || 0),
      hasCostData: false,
    };
  }

  async getTopProducts(filters = {}, limit = 10) {
    const base = buildFilteredSalesCte(filters);
    const { rows } = await pool.query(
      `
        ${base.cte}
        SELECT
          product_id AS "productId",
          product_name AS "productName",
          MAX(category_name) AS "categoryName",
          COALESCE(SUM(quantity), 0)::int AS quantity,
          COALESCE(SUM(total_sold), 0)::numeric(12, 2) AS "totalSales",
          COALESCE(SUM(profit), 0)::numeric(12, 2) AS profit
        FROM filtered_sales
        GROUP BY product_id, product_name
        ORDER BY quantity DESC, "totalSales" DESC, product_name ASC
        LIMIT $${base.params.length + 1}
      `,
      [...base.params, limit],
    );

    return rows.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      categoryName: row.categoryName,
      quantity: Number(row.quantity || 0),
      totalSales: Number(row.totalSales || 0),
      profit: Number(row.profit || 0),
    }));
  }

  async getMonthlyProfits(filters = {}, months = 12) {
    const safeMonths = Math.min(Math.max(Number(months) || 12, 1), 24);
    const base = buildFilteredSalesCte({
      ...filters,
      from: '',
      to: '',
    });

    const { rows } = await pool.query(
      `
        ${base.cte},
        month_series AS (
          SELECT generate_series(
            date_trunc('month', CURRENT_DATE) - (($${base.params.length + 1}::int - 1) * INTERVAL '1 month'),
            date_trunc('month', CURRENT_DATE),
            INTERVAL '1 month'
          ) AS month_start
        ),
        monthly AS (
          SELECT
            date_trunc('month', sale_date) AS month_start,
            COALESCE(SUM(total_sold), 0)::numeric(12, 2) AS total_sales,
            COALESCE(SUM(profit), 0)::numeric(12, 2) AS profit,
            COUNT(DISTINCT sale_id)::int AS sales_count,
            COALESCE(SUM(quantity), 0)::int AS products_sold
          FROM filtered_sales
          WHERE sale_date >= date_trunc('month', CURRENT_DATE) - (($${base.params.length + 1}::int - 1) * INTERVAL '1 month')
            AND sale_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
          GROUP BY date_trunc('month', sale_date)
        )
        SELECT
          to_char(ms.month_start, 'YYYY-MM') AS month,
          to_char(ms.month_start, 'MM/YYYY') AS "monthLabel",
          COALESCE(m.total_sales, 0)::numeric(12, 2) AS total_sales,
          COALESCE(m.profit, 0)::numeric(12, 2) AS profit,
          COALESCE(m.sales_count, 0)::int AS sales_count,
          COALESCE(m.products_sold, 0)::int AS products_sold
        FROM month_series ms
        LEFT JOIN monthly m ON m.month_start = ms.month_start
        ORDER BY ms.month_start ASC
      `,
      [...base.params, safeMonths],
    );

    return rows.map((row) => ({
      month: row.month,
      monthLabel: row.monthLabel,
      totalSales: Number(row.total_sales || 0),
      profit: Number(row.profit || 0),
      salesCount: Number(row.sales_count || 0),
      productsSold: Number(row.products_sold || 0),
    }));
  }

  async getCategorySales(filters = {}) {
    const base = buildFilteredSalesCte(filters);
    const { rows } = await pool.query(
      `
        ${base.cte}
        SELECT
          category_id AS "categoryId",
          category_name AS "categoryName",
          COALESCE(SUM(quantity), 0)::int AS quantity,
          COALESCE(SUM(total_sold), 0)::numeric(12, 2) AS "totalSales",
          COALESCE(SUM(profit), 0)::numeric(12, 2) AS profit,
          COUNT(DISTINCT product_id)::int AS "productsCount"
        FROM filtered_sales
        GROUP BY category_id, category_name
        ORDER BY "totalSales" DESC, quantity DESC, category_name ASC
      `,
      base.params,
    );

    return rows.map((row) => ({
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      quantity: Number(row.quantity || 0),
      totalSales: Number(row.totalSales || 0),
      profit: Number(row.profit || 0),
      productsCount: Number(row.productsCount || 0),
    }));
  }

  async getSalesDetail(filters = {}, pagination = { limit: 20, offset: 0 }, sortBy = 'fecha', sortOrder = 'desc') {
    const base = buildFilteredSalesCte(filters);
    const sortColumn = SORT_COLUMNS[sortBy] || SORT_COLUMNS.fecha;
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [{ rows }, countResult] = await Promise.all([
      pool.query(
        `
          ${base.cte}
          SELECT
            detail_id AS id,
            sale_id AS "saleId",
            sale_date AS "saleDate",
            product_id AS "productId",
            product_name AS "productName",
            category_name AS "categoryName",
            subcategory_name AS "subcategoryName",
            quantity::int AS quantity,
            unit_price AS "unitPrice",
            total_sold AS "totalSales",
            profit AS profit,
            payment_method AS "paymentMethod",
            seller_id AS "sellerId",
            seller_name AS "sellerName",
            false AS "hasCostData"
          FROM filtered_sales
          ORDER BY ${sortColumn} ${direction}, sale_id DESC, detail_id DESC
          LIMIT $${base.params.length + 1}
          OFFSET $${base.params.length + 2}
        `,
        [...base.params, pagination.limit, pagination.offset],
      ),
      pool.query(
        `
          ${base.cte}
          SELECT COUNT(*)::int AS total
          FROM filtered_sales
        `,
        base.params,
      ),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        saleId: row.saleId,
        saleDate: row.saleDate,
        productId: row.productId,
        productName: row.productName,
        categoryName: row.categoryName,
        subcategoryName: row.subcategoryName,
        quantity: Number(row.quantity || 0),
        unitPrice: Number(row.unitPrice || 0),
        totalSales: Number(row.totalSales || 0),
        profit: Number(row.profit || 0),
        paymentMethod: row.paymentMethod,
        sellerId: row.sellerId,
        sellerName: row.sellerName,
        hasCostData: Boolean(row.hasCostData),
      })),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }
}

module.exports = new MetricsModel();
