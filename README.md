# Manino Coffee · Dashboard para Analistas

Dashboard público construido con **React + Vite** para visualizar primero:

1. Demanda
2. Compras
3. Inventario
4. Cartera de clientes

Luego incorpora análisis de ticket promedio, recurrencia, actividad/inactividad y concentración de ventas.

## Reglas de negocio incluidas

- Todas las ventas válidas se tratan como **pagadas**.
- No se muestra ni calcula cuentas por cobrar.
- Se excluyen por completo **Milena** y **Felipe Angulo** del CSV entregado.
- Nombres unificados en el CSV:
  - Alavaro Castillo → Alvaro Castillo
  - Xinia Chacon → Xinia Jimenez
  - Doña Johana → Johana Andrade
  - Paula Delgado → Paula Nutri
  - Juan Ugalde → Guisselle Castillo
- **Sabor y Pan** se clasifica como **B2B** y también forma parte de los totales generales.
- El resto de clientes se clasifica como **B2C**.
- Cliente inactivo: más de **45 días** sin comprar respecto de `fecha_corte`.
- La cartera se calcula desde registros `DEMANDA / PEDIDO`.
- Las unidades demandadas por SKU se calculan desde `DEMANDA / ITEM`.

## CSV maestro

El dashboard está diseñado para el archivo `public/manino_master.csv`. También permite cargar un CSV con la misma estructura desde el navegador mediante **Cargar CSV**.

Tipos de registro utilizados:

- `DEMANDA` + `PEDIDO`: una fila por pedido; contiene el monto de venta.
- `DEMANDA` + `ITEM`: una fila por producto dentro de la demanda; contiene unidades y SKU.
- `COMPRA` + `FACTURA`: monto y fecha de cada compra conciliada.
- `COMPRA` + `SKU`: unidades compradas conciliadas por SKU.
- `INVENTARIO` + `STOCK`: inventario al corte.

> La carga de CSV es local en el navegador: no modifica GitHub ni el archivo publicado en Vercel. Para que un nuevo CSV quede como fuente predeterminada pública, reemplace `public/manino_master.csv` en el repositorio y vuelva a desplegar.

## Ejecutar localmente

```bash
npm install
npm run dev
```

## Publicar en GitHub

```bash
git init
git add .
git commit -m "Dashboard Manino Coffee"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

## Publicar en Vercel

1. Entre a Vercel.
2. Importe el repositorio de GitHub.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

No requiere variables de entorno ni backend.
