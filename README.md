
# Gestión + Mini Móvil

<p align="center">
  <img src="Logo.png" alt="Gestión + Logo" width="120">
</p>

**Gestión +** es una aplicación móvil de punto de venta (POS) offline diseñada para pequeños comercios. Funciona 100% sin conexión a internet, con almacenamiento local en SQLite y respaldo automático en localStorage.

## ✨ Funcionalidades

- **POS (Punto de Venta)** — Agregá productos al carrito, dividí el pago entre efectivo y transferencia, y recibí el vuelto calculado automáticamente.
- **Gestión de Productos** — Alta, edición y eliminación de productos con control de stock.
- **Gestión de Inventario** — Visualizá inversión, ganancia esperada y precio de venta por producto. Podés editar el precio de venta directamente desde la tabla.
- **Merma** — Registrá productos dañados o vencidos. Se descuentan automáticamente del stock.
- **Abastecimiento** — Aumentá el stock de productos existentes.
- **Gastos** — Registrá gastos del negocio (insumos, servicios, etc.).
- **Historial de Ventas** — Consultá ventas por fecha con detalle de productos y podés deshacer ventas.
- **Resumen Contable** — Resumen por rango de fechas con:
  - Total ingresado (efectivo + transferencia)
  - Inversión en productos vendidos
  - Gastos registrados
  - Mermas (valorizadas al precio de costo)
  - Ganancia neta
  - Productos con stock agotado
- **Protección por Activación** — Sistema de bloqueo por ID de dispositivo con clave de activación.
- **Contraseña de Acceso** — Protegé el resumen, el historial y la gestión de inventario con contraseña configurable (compartida entre los tres).
- **Offline First** — No necesita internet. Todo se almacena localmente.

## 🛠 Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML5, CSS3, JavaScript (vanilla) |
| Mobile Runtime | [Capacitor 8](https://capacitorjs.com/) |
| Base de datos | [@capacitor-community/sqlite](https://github.com/capacitor-community/sqlite) v8 |
| Fallback | localStorage |
| Targeting | Android (APK) |

## 📁 Estructura del Proyecto

```
GP-movil/
├── webapp-beta/              # Aplicación web + Capacitor
│   ├── src/public/           # Frontend
│   │   ├── index.html        # Interfaz principal
│   │   ├── css/style.css     # Estilos (tema oscuro)
│   │   └── js/
│   │       ├── app.js        # Lógica del POS
│   │       └── database.js   # Módulo de base de datos (SQLite + fallback localStorage)
│   ├── android/              # Proyecto Android generado por Capacitor
│   ├── capacitor.config.json # Configuración de Capacitor
│   └── package.json
├── Logo.png                  # Logo de la aplicación
└── IconKitchen-Output.zip    # Assets para íconos
```

## 🚀 Cómo compilar el APK

```bash
cd webapp-beta

# Instalar dependencias
npm install

# Sincronizar con Android y compilar
npm run build:android

# O solo abrir Android Studio para compilar manualmente
npm run open:android
```

El APK se genera en `webapp-beta/android/app/build/outputs/apk/`.

## ⚙️ Configuración

### Identificador de la app
`com.gestionplus.movil.mini` — definido en `capacitor.config.json`.

### Plugin SQLite
La app usa `@capacitor-community/sqlite` para almacenamiento persistente. Si el plugin no está disponible (entorno no nativo), fallback automático a `localStorage`.

### Sistema de Activación
Cada dispositivo genera un ID único ofuscado. El administrador genera una clave de activación usando ese ID y un salt maestro. Sin activación, la app muestra una pantalla de bloqueo.

## 📄 Licencia

Uso interno — todos los derechos reservados.
