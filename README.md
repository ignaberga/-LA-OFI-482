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
  fecha, Barra o Cocina, Top 10 o Resto, y anota la cantidad de cada
  producto (la unidad aparece sola).
- **Una planilla por bar**, cada una con el código de
  [`stockbares/apps-script/Code.gs`](stockbares/apps-script/Code.gs) (los
  pasos están al principio del archivo). En la hoja **Resumen** se ven los
  productos en filas y las fechas en columnas.
- **Un link por persona.** Noel arma la lista de productos y es el único que
  puede borrar o editar una carga; cargan el stock el encargado y Noel.
- La versión anterior (con compras, ventas y control de faltantes) está en
  [`archivo/`](archivo/).

## Instalar en el celular

1. Ignacio le manda a cada persona su **link de instalación** por WhatsApp.
2. La persona abre el link y, desde esa misma página, agrega la app a la
   pantalla de inicio:
   - **iPhone:** en Safari, Compartir → Agregar a inicio.
   - **Android:** en Chrome, menú de tres puntos → Agregar a pantalla principal.
3. Listo. La app se actualiza sola.
