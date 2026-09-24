# La Ofi 482 — proyectos de oficina

Apps simples para cargar datos desde el celular, con la misma idea que la app
de gastos de La Emilia SAS.

Por ahora hay un **molde** (`index.html`): una app de ingresos y gastos sin
datos de nadie, lista para adaptar a lo que se necesite en la oficina.

## Cómo funciona

- **Los datos viven en una planilla de Google**, compartida por todos los
  celulares. Cada celular guarda además una copia para abrir al instante.
- **Funciona sin señal:** lo que se carga queda guardado en el celular y se
  manda solo a la planilla cuando vuelve la conexión. Mientras tanto, en Inicio
  aparece un cartel con los cambios que faltan enviar.
- La conexión con la planilla es la dirección de Apps Script (la que termina en
  `/exec`). **Esa dirección es la llave de los datos y nunca va en este
  repositorio.** Se comparte solo por mensaje directo.

## Instalar en el celular (cuando la app esté lista)

1. Ignacio le manda a cada persona su **link de instalación** por WhatsApp
   (lleva adentro la llave de la planilla y el nombre de la persona).
2. La persona abre el link y, desde esa misma página, agrega la app a la
   pantalla de inicio:
   - **iPhone:** en Safari, Compartir → Agregar a inicio.
   - **Android:** en Chrome, menú de tres puntos → Agregar a pantalla principal.
3. Listo. La app se actualiza sola.

## Apps Script

El código que va dentro de la planilla está en
[`apps-script/Code.gs`](apps-script/Code.gs), con los pasos al principio.
