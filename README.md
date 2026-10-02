# La Ofi 482 — apps de oficina

Apps simples para cargar datos desde el celular, con la misma idea que la app
de gastos de La Emilia SAS. Cada app vive en su propia carpeta y tiene su
propia dirección:

| Carpeta | App | Dirección |
|---|---|---|
| `stockbares/` | Stock de los bares (conteo a una fecha) | https://ignaberga.github.io/-LA-OFI-482/stockbares/ |
| `molde/` | Molde de ingresos y gastos, base para apps nuevas | — |

## Cómo funcionan

- **Los datos viven en una planilla de Google**, compartida por todos los
  celulares. Cada celular guarda además una copia para abrir al instante.
- **Funcionan sin señal:** lo que se carga queda guardado en el celular y se
  manda solo a la planilla cuando vuelve la conexión. Mientras tanto, en Inicio
  aparece un cartel con lo que falta enviar.
- La conexión con la planilla es la dirección de Apps Script (la que termina en
  `/exec`). **Esa dirección es la llave de los datos y nunca va en este
  repositorio.** Se comparte solo por mensaje directo.

## Stock de bares

- Sirve para **cargar el stock contado a una fecha**. El encargado elige la
  fecha, Barra o Cocina, y el **Top 10** (recuento rápido) o el **Completo**
  (todo, por familia: Vermuts, Vinos…). Anota la cantidad de cada producto
  y la app muestra al lado cuántos litros (o kilos) son.
- Los productos se arman en la hoja **Catálogo** de la planilla (Producto,
  Categoría, Grupo, Unidad, Familia, Contenido); el orden de esa hoja es el
  orden en que aparecen en la app.
- **Una planilla por bar**, cada una con el código de
  [`stockbares/apps-script/Code.gs`](stockbares/apps-script/Code.gs) (los
  pasos están al principio del archivo). En la hoja **Resumen** se ven los
  productos en filas y las fechas en columnas.
- **Un stock por día**, que se completa y corrige hasta que el encargado lo
  **cierra**. Cerrado, nadie lo modifica: solo Noel lo puede reabrir.
- **Un link por persona.** Noel e Ignacio arman la lista de productos,
  reabren y borran días; cargan y cierran el stock los encargados, Noel e
  Ignacio.
- La versión anterior (con compras, ventas y control de faltantes) está en
  [`archivo/`](archivo/).

## Instalar en el celular

1. Ignacio le manda a cada persona su **link de instalación** por WhatsApp.
2. La persona abre el link y, desde esa misma página, agrega la app a la
   pantalla de inicio:
   - **iPhone:** en Safari, Compartir → Agregar a inicio.
   - **Android:** en Chrome, menú de tres puntos → Agregar a pantalla principal.
3. Listo. La app se actualiza sola.
