# La Ofi 482 — apps de oficina

Apps simples para cargar datos desde el celular, con la misma idea que la app
de gastos de La Emilia SAS. Cada app vive en su propia carpeta y tiene su
propia dirección:

| Carpeta | App | Dirección |
|---|---|---|
| `stockbares/` | Stock de los bares (compras, conteos, ventas, control de faltantes) | https://ignaberga.github.io/-LA-OFI-482/stockbares/ |
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

- **Una planilla por bar**, cada una con el código de
  [`stockbares/apps-script/Code.gs`](stockbares/apps-script/Code.gs) (los
  pasos están al principio del archivo).
- **Un link por persona.** El link lleva la planilla del bar (o de varios
  bares, para quien los controla a todos) y el nombre de quien lo usa. Cada
  carga queda anotada con esa persona.
- **Qué puede hacer cada uno** (bloque `PERMISOS` en `stockbares/index.html`):
  - Noel: todo, incluido borrar cargas y ver el control.
  - Josefina: compras, ventas, pases, bajas, productos y tragos; ve el control.
  - Encargado: conteos, pases y bajas. No ve lo que "debería haber" (cuenta a
    ciegas) ni las cargas de los demás.
- **Control del conteo:** por cada producto, conteo anterior + compras ± pases −
  bajas − lo vendido (tragos vendidos × medida de cada trago) = lo que debería
  haber. Se compara con el conteo nuevo y se muestra lo que falta o sobra.
  El conteo se toma como hecho al cierre del día: todo lo cargado con esa
  fecha entra en la cuenta.

## Instalar en el celular

1. Ignacio le manda a cada persona su **link de instalación** por WhatsApp.
2. La persona abre el link y, desde esa misma página, agrega la app a la
   pantalla de inicio:
   - **iPhone:** en Safari, Compartir → Agregar a inicio.
   - **Android:** en Chrome, menú de tres puntos → Agregar a pantalla principal.
3. Listo. La app se actualiza sola.
