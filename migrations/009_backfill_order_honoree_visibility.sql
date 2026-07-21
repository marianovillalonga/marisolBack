UPDATE pedidos
SET mostrar_datos_agasajado = TRUE
WHERE tipo = 'cliente'
  AND mostrar_datos_agasajado = FALSE
  AND (
    NULLIF(TRIM(COALESCE(agasajado_nombre, '')), '') IS NOT NULL
    OR edad_agasajado IS NOT NULL
    OR NULLIF(TRIM(COALESCE(tematica, '')), '') IS NOT NULL
    OR fecha_evento IS NOT NULL
  );
