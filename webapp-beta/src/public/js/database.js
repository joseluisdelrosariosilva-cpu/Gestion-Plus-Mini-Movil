// ============================================
// DATABASE MODULE - SQLite para modo offline
// ============================================
// Versión vanilla para ejecutarse en webview del APK

var db = null;
var storageMode = "none"; // sqlite | local
var fallbacksCount = 0;   // Operaciones que cayeron a localStorage por error SQLite
var ultimoErrorFallback = null; // Último mensaje de error que causó fallback

const LS_KEYS = {
  productos: "posmovil_productos",
  ventas: "posmovil_ventas_pending",
  mermas: "posmovil_mermas_pending",
  entrada_productos: "posmovil_entrada_productos_pending",
  abastecer: "posmovil_abastecer_pending",
  gastos: "posmovil_gastos_pending",
  config: "posmovil_config",
  stock_agotado: "posmovil_stock_agotado",
};

function leerLocal(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function guardarLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Error guardando localStorage:", e);
    return false;
  }
}

// Lee un string de localStorage con retrocompatibilidad:
//   - nuevo formato (guardarLocal → JSON.parse) → JSON.parse
//   - formato legacy (raw string) → devuelve raw
function _leerString(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  } catch (_) {
    return fallback;
  }
}

/**
 * Helper para operaciones SQLite con fallback automático a localStorage.
 * Elimina la duplicación del check (storageMode !== "sqlite" || !db)
 * y el try/catch con mismo fallback en todas las funciones CRUD.
 *
 * @param {function(db): Promise<any>} operacion - Recibe db, ejecuta SQL
 * @param {function(): any} fallback - Se ejecuta si no hay SQLite o si falla
 */
async function conSQLite(operacion, fallback) {
  if (storageMode !== "sqlite" || !db) {
    return typeof fallback === "function" ? await fallback() : fallback;
  }
  try {
    return await operacion(db);
  } catch (error) {
    console.error("❌ Error en operación SQLite:", error);
    fallbacksCount++;
    ultimoErrorFallback = error.message || String(error);
    return typeof fallback === "function" ? await fallback() : fallback;
  }
}

/**
 * Genera timestamp en formato ISO con HORA LOCAL (sin UTC)
 * Ejemplo: "2026-05-31T23:00:00.000" (sin Z ni offset)
 * POLÍTICA: siempre usar hora local del dispositivo en toda la app
 */
function fechaLocalISO() {
  var f = new Date();
  var y = f.getFullYear();
  var m = String(f.getMonth() + 1).padStart(2, "0");
  var d = String(f.getDate()).padStart(2, "0");
  var hh = String(f.getHours()).padStart(2, "0");
  var mm = String(f.getMinutes()).padStart(2, "0");
  var ss = String(f.getSeconds()).padStart(2, "0");
  var ms = String(f.getMilliseconds()).padStart(3, "0");
  return y + "-" + m + "-" + d + "T" + hh + ":" + mm + ":" + ss + "." + ms;
}

function asegurarStoreLocal() {
  if (!localStorage.getItem(LS_KEYS.productos)) guardarLocal(LS_KEYS.productos, []);
  if (!localStorage.getItem(LS_KEYS.ventas)) guardarLocal(LS_KEYS.ventas, []);
  if (!localStorage.getItem(LS_KEYS.mermas)) guardarLocal(LS_KEYS.mermas, []);
  if (!localStorage.getItem(LS_KEYS.entrada_productos)) guardarLocal(LS_KEYS.entrada_productos, []);
  if (!localStorage.getItem(LS_KEYS.abastecer)) guardarLocal(LS_KEYS.abastecer, []);
  if (!localStorage.getItem(LS_KEYS.gastos)) guardarLocal(LS_KEYS.gastos, []);
  if (!localStorage.getItem(LS_KEYS.config)) guardarLocal(LS_KEYS.config, {});
}

function activarModoLocal(motivo) {
  storageMode = "local";
  db = null;
  asegurarStoreLocal();
  console.warn("[DB] Modo localStorage activo:", motivo);
}

function normalizarProducto(p) {
  return {
    codigo: p.codigo,
    nombre: p.producto || p.nombre,
    precio: Number(p.precio || 0),
    disponibilidad: Number(p.disponibilidad || p.stock || 0),
    precio_costo: Number(p.precio_costo || 0),
  };
}

function construirLineasVenta(venta) {
  var facturaId = venta.facturaId;
  var lineas = [];
  for (var i = 0; i < venta.productos.length; i++) {
    var item = venta.productos[i];
    lineas.push({
      id: Date.now() + i + Math.floor(Math.random() * 1000),
      factura_id: facturaId,
      fecha_hora: venta.fechaHora,
      codigo_producto: item.codigo,
      nombre: item.nombre,
      cantidad: Number(item.cantidad || 0),
      precio: Number(item.precio || 0),
      precio_costo: Number(item.precio_costo || 0),
      subtotal: Number(item.cantidad || 0) * Number(item.precio || 0),
      efectivo: Number((venta.pago && venta.pago.efectivo) || 0),
      transferencia: Number((venta.pago && venta.pago.transferencia) || 0),
      synced: 0,
    });
  }
  return lineas;
}

function fechaLocalHoyISO() {
  var ahora = new Date();
  var y = ahora.getFullYear();
  var m = String(ahora.getMonth() + 1).padStart(2, "0");
  var d = String(ahora.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

// ============================================
// LIMPIAR REGISTROS ANTIGUOS (más de 6 meses)
// ============================================
async function limpiarVentasAntiguas() {
  var ULTIMA_LIMPIEZA_KEY = "posmovil_ultima_limpieza";
  var hoy = fechaLocalHoyISO();

  if (localStorage.getItem(ULTIMA_LIMPIEZA_KEY) === hoy) return;

  var fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() - 180);
  var fechaLimiteISO = fechaLimite.getFullYear() + '-' +
                       String(fechaLimite.getMonth()+1).padStart(2,'0') + '-' +
                       String(fechaLimite.getDate()).padStart(2,'0');

  try {
    if (storageMode === "sqlite" && db) {
      await db.execute("DELETE FROM ventas_pending WHERE date(fecha_hora) < ?", [fechaLimiteISO]);
      await db.execute("DELETE FROM mermas_pending WHERE date(fecha_hora) < ?", [fechaLimiteISO]);
      await db.execute("DELETE FROM entrada_productos_pending WHERE date(fecha_hora) < ?", [fechaLimiteISO]);
      await db.execute("DELETE FROM abastecer_pending WHERE date(fecha_hora) < ?", [fechaLimiteISO]);
      await db.execute("DELETE FROM gastos_pending WHERE date(fecha) < ?", [fechaLimiteISO]);

      console.log("Registros antiguos eliminados (antes del " + fechaLimiteISO + ")");
    } else {
      var ventas = leerLocal(LS_KEYS.ventas, []);
      var ventasFiltradas = ventas.filter(function(v) {
        return extraerFechaISO(v.fecha_hora || v.fechaHora) >= fechaLimiteISO;
      });
      guardarLocal(LS_KEYS.ventas, ventasFiltradas);

      var mermas = leerLocal(LS_KEYS.mermas, []);
      var mermasFiltradas = mermas.filter(function(m) {
        return extraerFechaISO(m.fecha_hora) >= fechaLimiteISO;
      });
      guardarLocal(LS_KEYS.mermas, mermasFiltradas);

      var entradas = leerLocal(LS_KEYS.entrada_productos, []);
      var entradasFiltradas = entradas.filter(function(e) {
        return extraerFechaISO(e.fecha_hora) >= fechaLimiteISO;
      });
      guardarLocal(LS_KEYS.entrada_productos, entradasFiltradas);

      var abastecimientos = leerLocal(LS_KEYS.abastecer, []);
      var abastecimientosFiltrados = abastecimientos.filter(function(a) {
        return extraerFechaISO(a.fecha_hora) >= fechaLimiteISO;
      });
      guardarLocal(LS_KEYS.abastecer, abastecimientosFiltrados);

      var gastos = leerLocal(LS_KEYS.gastos, []);
      var gastosFiltrados = gastos.filter(function(g) {
        return extraerFechaISO(g.fecha) >= fechaLimiteISO;
      });
      guardarLocal(LS_KEYS.gastos, gastosFiltrados);
    }

    localStorage.setItem(ULTIMA_LIMPIEZA_KEY, hoy);
  } catch (error) {
    console.error("Error limpiando registros antiguos:", error);
  }
}

function extraerFechaISO(valor) {
  if (!valor) return "";

  if (typeof valor === "string") {
    if (valor.indexOf("T") > -1) return valor.split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  }

  var fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";

  var y = fecha.getFullYear();
  var m = String(fecha.getMonth() + 1).padStart(2, "0");
  var d = String(fecha.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

/**
 * Crea un wrapper que adapta la API de @capacitor-community/sqlite v8
 * (Capacitor.Plugins.CapacitorSQLite) a la interfaz que espera el resto del código:
 *   db.execute(sql, params?)  → rutea a run() / query() / execute() según el caso
 *   db.query(sql, params?)    → rutea a query()
 */
function crearWrapperSQLite(plugin, dbName) {
  return {
    execute: async function (sql, params) {
      var trimmed = sql.trim().toUpperCase();

      // 1) SELECT / WITH → query() (el plugin de Android exige values[])
      if (trimmed.startsWith("SELECT") || trimmed.startsWith("WITH")) {
        var res = await plugin.query({
          database: dbName,
          statement: sql,
          values: Array.isArray(params) ? params : [],
        });
        return { values: res.values || [] };
      }

      // 2) Con parámetros → run()
      if (params !== undefined && params !== null) {
        var res = await plugin.run({
          database: dbName,
          statement: sql,
          values: Array.isArray(params) ? params : [params],
        });
        return { changes: res.changes || { changes: 0 } };
      }

      // 3) DDL / batch → execute()
      var res = await plugin.execute({ database: dbName, statements: sql });
      return { changes: res.changes || { changes: 0 } };
    },

    query: async function (sql, params) {
      var res = await plugin.query({
        database: dbName,
        statement: sql,
        values: params || [],
      });
      return { values: res.values || [] };
    },
  };
}

/**
 * Crea TODAS las tablas del esquema SQLite.
 * Incluye migraciones para columnas que se agregaron después (precio_costo, efectivo).
 */
async function crearTablasSQLite() {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS productos (codigo TEXT PRIMARY KEY, nombre TEXT, precio REAL, disponibilidad INTEGER)"
  );
  await db.execute(
    "CREATE TABLE IF NOT EXISTS ventas_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, factura_id TEXT, fecha_hora TEXT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, precio REAL, subtotal REAL, efectivo REAL, transferencia REAL, synced INTEGER DEFAULT 0)"
  );
  // Migración para instalaciones viejas (columna mal escrita: efectividad)
  try {
    await db.execute("ALTER TABLE ventas_pending ADD COLUMN efectivo REAL DEFAULT 0");
  } catch (_) {}
  try {
    await db.execute("UPDATE ventas_pending SET efectivo = COALESCE(efectivo, efectividad, 0)");
  } catch (_) {}
  // Migración: precio_costo en productos
  try {
    await db.execute("ALTER TABLE productos ADD COLUMN precio_costo REAL DEFAULT 0");
  } catch (_) {}
  // Migración: precio_costo en ventas
  try {
    await db.execute("ALTER TABLE ventas_pending ADD COLUMN precio_costo REAL DEFAULT 0");
  } catch (_) {}
  await db.execute("CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT, timestamp INTEGER)");
  await db.execute("CREATE TABLE IF NOT EXISTS mermas_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, fecha_hora TEXT, synced INTEGER DEFAULT 0)");
  await db.execute("CREATE TABLE IF NOT EXISTS entrada_productos_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, nombre TEXT, cantidad INTEGER, precio_venta REAL, precio_costo REAL, fecha_hora TEXT, synced INTEGER DEFAULT 0)");
  await db.execute("CREATE TABLE IF NOT EXISTS abastecer_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, fecha_hora TEXT, synced INTEGER DEFAULT 0)");
  await db.execute("CREATE TABLE IF NOT EXISTS gastos_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, descripcion TEXT, monto REAL, synced INTEGER DEFAULT 0)");
}

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================
async function initDatabase() {
  // SQLite en APK, fallback localStorage en cualquier entorno
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
    activarModoLocal("Entorno no nativo");
    return true;
  }

  // ============================================
  // 1) Capacitor 8: Capacitor.Plugins.CapacitorSQLite
  // ============================================
  var plugin = null;
  if (window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorSQLite) {
    plugin = window.Capacitor.Plugins.CapacitorSQLite;
  }

  if (plugin) {
    try {
      await plugin.createConnection({
        database: "posmovil",
        version: 1,
        encrypted: false,
        mode: "no-encryption",
      });
      await plugin.open({ database: "posmovil" });
      db = crearWrapperSQLite(plugin, "posmovil");
      await crearTablasSQLite();
      console.log("✅ Base de datos SQLite inicializada (Capacitor 8)");
      storageMode = "sqlite";
      return true;
    } catch (error) {
      console.error("❌ Error inicializando SQLite (Capacitor 8):", error);
      try { await plugin.closeConnection({ database: "posmovil" }); } catch (_) {}
      activarModoLocal("Falló init SQLite Capacitor 8: " + (error.message || error));
      return true;
    }
  }

  // ============================================
  // 2) Fallback: window.SQLite (legacy Capacitor <8 / Cordova)
  // ============================================
  var sqliteGlobal = window.SQLite;
  if (sqliteGlobal && typeof sqliteGlobal.createDatabase === "function") {
    try {
      db = await sqliteGlobal.createDatabase({ database: "posmovil.db" });
      await crearTablasSQLite();
      console.log("✅ Base de datos SQLite inicializada (legacy)");
      storageMode = "sqlite";
      return true;
    } catch (error) {
      console.error("❌ Error inicializando SQLite (legacy):", error);
      activarModoLocal("Falló init SQLite legacy");
      return true;
    }
  }

  // ============================================
  // 3) No hay plugin SQLite → localStorage
  // ============================================
  activarModoLocal("Plugin SQLite no expuesto");
  return true;
}

// ============================================
// OBTENER ÚLTIMO CÓDIGO DE PRODUCTO
// ============================================
async function getUltimoCodigoProducto() {
  if (storageMode !== "sqlite" || !db) {
    var productosLocal = leerLocal(LS_KEYS.productos, []);
    var ultimoCodigo = 0;
    for (var i = 0; i < productosLocal.length; i++) {
      var codigo = productosLocal[i].codigo || "";
      if (codigo.indexOf("Pr_") === 0) {
        var numero = parseInt(codigo.substring(3)) || 0;
        if (numero > ultimoCodigo) ultimoCodigo = numero;
      }
    }
    return "Pr_" + String(ultimoCodigo + 1).padStart(5, "0");
  }

  try {
    var result = await db.execute(
      "SELECT codigo FROM productos WHERE codigo LIKE 'Pr_%' ORDER BY LENGTH(codigo) DESC, codigo DESC LIMIT 1"
    );

    if (result.values && result.values.length > 0) {
      var ultimoCodigo = result.values[0].codigo || "";
      if (ultimoCodigo.indexOf("Pr_") === 0) {
        var numero = parseInt(ultimoCodigo.substring(3)) || 0;
        return "Pr_" + String(numero + 1).padStart(5, "0");
      }
    }
    return "Pr_00001";
  } catch (error) {
    console.error("Error obteniendo último código:", error);
    return "Pr_00001";
  }
}

// ============================================
// GUARDAR NUEVO PRODUCTO EN BD
// ============================================
async function guardarNuevoProducto(producto) {
  if (!producto || !producto.codigo) {
    return false;
  }

  return conSQLite(
    async (db) => {
      await db.execute(
        "INSERT OR REPLACE INTO productos (codigo, nombre, precio, disponibilidad, precio_costo) VALUES (?, ?, ?, ?, ?)",
        [producto.codigo, producto.nombre, Number(producto.precioVenta || 0), Number(producto.cantidad || 0), Number(producto.precioCosto || 0)]
      );
      console.log("✅ Nuevo producto guardado:", producto.codigo);
      return true;
    },
    function() {
      var productosLocal = leerLocal(LS_KEYS.productos, []);
      productosLocal.push({
        codigo: producto.codigo,
        nombre: producto.nombre,
        precio: Number(producto.precioVenta || 0),
        disponibilidad: Number(producto.cantidad || 0),
        precio_costo: Number(producto.precioCosto || 0),
      });
      return guardarLocal(LS_KEYS.productos, productosLocal);
    }
  );
}

// ============================================
// GUARDAR ENTRADA COMPLETA DE PRODUCTO (productos + entrada_productos_pending)
// ============================================
async function guardarEntradaProductoCompleto(producto) {
  if (!producto || !producto.codigo) {
    return false;
  }

  // 1. Guardar en tabla productos (disponible para venta)
  var guardadoEnProductos = await guardarNuevoProducto(producto);
  if (!guardadoEnProductos) {
    console.error("❌ Error guardando en tabla productos");
    return false;
  }

  // 2. Guardar en tabla entrada_productos_pending (para sync al servidor)
  var fechaHora = fechaLocalISO();

  return conSQLite(
    async (db) => {
      await db.execute(
        "INSERT INTO entrada_productos_pending (codigo, nombre, cantidad, precio_venta, precio_costo, fecha_hora, synced) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          producto.codigo,
          producto.nombre,
          Number(producto.cantidad || 0),
          Number(producto.precioVenta || 0),
          Number(producto.precioCosto || 0),
          fechaHora,
          0
        ]
      );
      console.log("✅ Entrada de producto guardada:", producto.codigo);
      return true;
    },
    function() {
      var entradas = leerLocal(LS_KEYS.entrada_productos, []);
      entradas.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        codigo: producto.codigo,
        nombre: producto.nombre,
        cantidad: Number(producto.cantidad || 0),
        precio_venta: Number(producto.precioVenta || 0),
        precio_costo: Number(producto.precioCosto || 0),
        fecha_hora: fechaHora,
        synced: 0,
      });
      return guardarLocal(LS_KEYS.entrada_productos, entradas);
    }
  );
}

// ============================================
// OBTENER PRODUCTOS DESDE SQLite
// ============================================
async function getProductosLocal() {
  return conSQLite(
    async (db) => {
      var result = await db.execute(
        "SELECT codigo, nombre, precio, disponibilidad, precio_costo FROM productos ORDER BY nombre"
      );
      return result.values || [];
    },
    () => leerLocal(LS_KEYS.productos, [])
  );
}

// ============================================
// GUARDAR PRODUCTOS EN SQLite (cache offline)
// ============================================
async function syncProductosLocal(productos) {
  var normalizados = (productos || []).map(normalizarProducto);

  return conSQLite(
    async (db) => {
      await db.execute("DELETE FROM productos");

      for (var i = 0; i < normalizados.length; i++) {
        var p = normalizados[i];
        await db.execute(
          "INSERT OR REPLACE INTO productos (codigo, nombre, precio, disponibilidad, precio_costo) VALUES (?, ?, ?, ?, ?)",
          [p.codigo, p.nombre, p.precio || 0, p.disponibilidad || 0, p.precio_costo || 0]
        );
      }

      console.log("✅ " + normalizados.length + " productos guardados en SQLite");
      return true;
    },
    () => guardarLocal(LS_KEYS.productos, normalizados)
  );
}

// ============================================
// GUARDAR VENTA EN SQLite (modo offline)
// ============================================
async function guardarVentaOffline(venta) {
  if (!venta || !Array.isArray(venta.productos) || venta.productos.length === 0) {
    return false;
  }

  return conSQLite(
    async (db) => {
      for (var i = 0; i < venta.productos.length; i++) {
        var item = venta.productos[i];

        try {
          await db.execute(
            "INSERT INTO ventas_pending (factura_id, fecha_hora, codigo_producto, nombre, cantidad, precio, precio_costo, subtotal, efectivo, transferencia, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
            [
              venta.facturaId,
              venta.fechaHora,
              item.codigo,
              item.nombre,
              item.cantidad,
              item.precio,
              Number(item.precio_costo || 0),
              item.cantidad * item.precio,
              venta.pago.efectivo,
              venta.pago.transferencia,
            ]
          );
        } catch (insertError) {
          // Compatibilidad con esquemas viejos que usan 'efectividad'
          if (
            insertError &&
            insertError.message &&
            insertError.message.indexOf("efectivo") !== -1
          ) {
            await db.execute(
              "INSERT INTO ventas_pending (factura_id, fecha_hora, codigo_producto, nombre, cantidad, precio, precio_costo, subtotal, efectividad, transferencia, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)",
              [
                venta.facturaId,
                venta.fechaHora,
                item.codigo,
                item.nombre,
                item.cantidad,
                item.precio,
                Number(item.precio_costo || 0),
                item.cantidad * item.precio,
                venta.pago.efectivo,
                venta.pago.transferencia,
              ]
            );
          } else {
            throw insertError;
          }
        }
      }

      console.log("✅ Venta guardada offline");
      return true;
    },
    function() {
      var actuales = leerLocal(LS_KEYS.ventas, []);
      var lineas = construirLineasVenta(venta);
      return guardarLocal(LS_KEYS.ventas, actuales.concat(lineas));
    }
  );
}

// ============================================
// OBTENER RESUMEN OFFLINE DESDE SQLite
// ============================================
async function getResumenOffline(fechaInicio, fechaFin) {
  try {
    var ventas = [];

    if (storageMode === "sqlite" && db) {
      var result = await db.execute(
        "SELECT * FROM ventas_pending ORDER BY id"
      );
      ventas = result.values || [];
    } else {
      ventas = leerLocal(LS_KEYS.ventas, []);
    }

    var inicio = fechaInicio || fechaLocalHoyISO();
    var fin = fechaFin || inicio;

    ventas = ventas.filter(function(v) {
      var fechaVenta = extraerFechaISO(v.fecha_hora || v.fechaHora);
      return fechaVenta >= inicio && fechaVenta <= fin;
    });

    // ---- GASTOS DEL RANGO ----
    var todosGastos = [];
    if (storageMode === "sqlite" && db) {
      try {
        var resultG = await db.execute("SELECT * FROM gastos_pending ORDER BY id");
        todosGastos = resultG.values || [];
      } catch (e) {
        todosGastos = [];
      }
    } else {
      todosGastos = leerLocal(LS_KEYS.gastos, []);
    }
    var gastosRango = todosGastos.filter(function(g) {
      var fechaGasto = (g.fecha || "").substring(0, 10);
      return fechaGasto >= inicio && fechaGasto <= fin;
    });
    var totalGastos = gastosRango.reduce(function(acc, g) { return acc + Number(g.monto || 0); }, 0);
    var gastosMapeados = gastosRango.map(function(g) {
      return {
        descripcion: g.descripcion || "",
        monto: Number(g.monto || 0),
      };
    });

    // ---- MERMAS DEL RANGO ----
    var mermas = [];
    if (storageMode === "sqlite" && db) {
      try {
        var resultM = await db.execute("SELECT * FROM mermas_pending ORDER BY id");
        mermas = resultM.values || [];
      } catch (e) {
        mermas = [];
      }
    } else {
      mermas = leerLocal(LS_KEYS.mermas, []);
    }

    var mermasRango = mermas.filter(function(m) {
      var fechaMerma = extraerFechaISO(m.fecha_hora || "");
      return fechaMerma >= inicio && fechaMerma <= fin;
    });

    if (mermasRango.length > 0) {
      var productosMerma = await getProductosLocal();
      var mapProductos = {};
      for (var pm = 0; pm < productosMerma.length; pm++) {
        var prod = productosMerma[pm];
        mapProductos[String(prod.codigo)] = prod;
      }

      var mermasAgrupadas = {};
      for (var mm = 0; mm < mermasRango.length; mm++) {
        var m = mermasRango[mm];
        var key = String(m.codigo_producto);
        var productoM = mapProductos[key];
        var precioCostoMerma = productoM ? Number(productoM.precio_costo || 0) : 0;
        var cantidadMerma = Number(m.cantidad || 0);

        if (!mermasAgrupadas[key]) {
          mermasAgrupadas[key] = {
            nombre: m.nombre || "Producto",
            cantidadTotal: 0,
            costeTotal: 0,
          };
        }
        mermasAgrupadas[key].cantidadTotal += cantidadMerma;
        mermasAgrupadas[key].costeTotal += cantidadMerma * precioCostoMerma;
      }

      var mermasList = [];
      var totalMermas = 0;
      var mermasKeys = Object.keys(mermasAgrupadas);
      for (var mk = 0; mk < mermasKeys.length; mk++) {
        var grupo = mermasAgrupadas[mermasKeys[mk]];
        if (grupo.costeTotal > 0) {
          mermasList.push({
            descripcion: grupo.nombre + " x " + grupo.cantidadTotal,
            monto: grupo.costeTotal,
          });
          totalMermas += grupo.costeTotal;
        }
      }
    } else {
      var mermasList = [];
      var totalMermas = 0;
    }

    var stockAgotados = await getStockAgotadosEnRango(inicio, fin);

    if (ventas.length === 0) {
      return {
        totalIngresado: 0,
        efectivo: 0,
        transferencia: 0,
        totalInversion: 0,
        totalGanancia: 0,
        productosVendidos: [],
        totalGastos: Math.round(totalGastos * 1000) / 1000,
        gastos: gastosMapeados,
        totalMermas: Math.round(totalMermas * 1000) / 1000,
        mermas: mermasList,
        stockAgotados: stockAgotados,
        fechaInicio: inicio,
        fechaFin: fin
      };
    }

    var totalIngresado = 0;
    var totalInversion = 0;
    var totalEfectivo = 0;
    var totalTransferencia = 0;
    var productosAgrupados = {};
    var facturasVistas = {};

    for (var i = 0; i < ventas.length; i++) {
      var v = ventas[i];
      var subtotal = Number(v.subtotal || 0);
      var efectivo = Number(v.efectivo || v.efectividad || 0);
      var transferencia = Number(v.transferencia || 0);
      var facturaKey = v.factura_id || ("row_" + i);
      var cantidad = Number(v.cantidad || 0);
      var precioCosto = Number(v.precio_costo || 0);

      totalIngresado += subtotal;
      totalInversion += cantidad * precioCosto;

      if (!facturasVistas[facturaKey]) {
        totalEfectivo += efectivo;
        totalTransferencia += transferencia;
        facturasVistas[facturaKey] = true;
      }

      var key = v.codigo_producto;
      if (!productosAgrupados[key]) {
        productosAgrupados[key] = {
          codigo: v.codigo_producto,
          nombre: v.nombre,
          cantidad: 0,
          total: 0
        };
      }
      productosAgrupados[key].cantidad += cantidad;
      productosAgrupados[key].total += subtotal;
    }

    var totalGanancia = totalIngresado - totalInversion - totalGastos - totalMermas;

    var productosVendidos = [];
    var keys = Object.keys(productosAgrupados);
    for (var j = 0; j < keys.length; j++) {
      var productoKey = keys[j];
      productosVendidos.push(productosAgrupados[productoKey]);
    }

    productosVendidos.sort(function(a, b) { return b.cantidad - a.cantidad; });

    return {
      totalIngresado: Math.round(totalIngresado * 1000) / 1000,
      totalInversion: Math.round(totalInversion * 1000) / 1000,
      totalGanancia: Math.round(totalGanancia * 1000) / 1000,
      efectivo: Math.round(totalEfectivo * 1000) / 1000,
      transferencia: Math.round(totalTransferencia * 1000) / 1000,
      productosVendidos: productosVendidos,
      totalGastos: Math.round(totalGastos * 1000) / 1000,
      gastos: gastosMapeados,
      totalMermas: Math.round(totalMermas * 1000) / 1000,
      mermas: mermasList,
      stockAgotados: stockAgotados,
      fechaInicio: inicio,
      fechaFin: fin
    };
  } catch (error) {
    console.error("Error en getResumenOffline:", error);
    return {
      totalIngresado: 0,
      efectivo: 0,
      transferencia: 0,
      totalInversion: 0,
      totalGanancia: 0,
      productosVendidos: [],
      totalGastos: 0,
      gastos: [],
      totalMermas: 0,
      mermas: [],
      stockAgotados: []
    };
  }
}

// ============================================
// FUNCIONES PARA MERMAS OFFLINE
// ============================================

// Guardar merma en SQLite/localStorage
async function guardarMermaOffline(merma) {
  if (!merma || !Array.isArray(merma.productos) || merma.productos.length === 0) {
    return false;
  }

  function construirLineasMerma() {
    return (merma.productos || []).map(function(item, idx) {
      return {
        id: Date.now() + idx + Math.floor(Math.random() * 1000),
        codigo_producto: item.codigo,
        nombre: item.nombre,
        cantidad: Number(item.cantidad || 0),
        fecha_hora: merma.fechaHora,
        synced: 0,
      };
    });
  }

  return conSQLite(
    async (db) => {
      for (var j = 0; j < merma.productos.length; j++) {
        var prod = merma.productos[j];
        await db.execute(
          "INSERT INTO mermas_pending (codigo_producto, nombre, cantidad, fecha_hora, synced) VALUES (?, ?, ?, ?, 0)",
          [prod.codigo, prod.nombre, prod.cantidad, merma.fechaHora]
        );
      }
      console.log("✅ Merma guardada offline (" + merma.productos.length + " productos)");
      return true;
    },
    function() {
      var actuales = leerLocal(LS_KEYS.mermas, []);
      return guardarLocal(LS_KEYS.mermas, actuales.concat(construirLineasMerma()));
    }
  );
}

// ============================================
// FUNCIONES PARA ABASTECER (reabastecer productos existentes)
// ============================================

// Actualizar stock de un producto (sumar cantidad)
async function actualizarStockProducto(codigo, cantidadSumar) {
  return conSQLite(
    async (db) => {
      await db.execute(
        "UPDATE productos SET disponibilidad = disponibilidad + ? WHERE codigo = ?",
        [Number(cantidadSumar), codigo]
      );
      console.log("✅ Stock actualizado para " + codigo + " (+" + cantidadSumar + ")");
      return true;
    },
    function() {
      var productosLocal = leerLocal(LS_KEYS.productos, []);
      var encontrado = false;
      for (var i = 0; i < productosLocal.length; i++) {
        if (productosLocal[i].codigo === codigo) {
          productosLocal[i].disponibilidad = Number(productosLocal[i].disponibilidad || 0) + Number(cantidadSumar);
          encontrado = true;
          break;
        }
      }
      if (encontrado) {
        guardarLocal(LS_KEYS.productos, productosLocal);
        return true;
      }
      return false;
    }
  );
}

// Guardar abastecimiento en SQLite/localStorage
async function guardarAbastecerOffline(abastecer) {
  if (!abastecer || !abastecer.codigo || !abastecer.cantidad) {
    return false;
  }

  // 1. Sumar cantidad al stock en tabla productos
  var stockActualizado = await actualizarStockProducto(abastecer.codigo, abastecer.cantidad);
  if (!stockActualizado) {
    console.error("❌ Error actualizando stock del producto");
    return false;
  }

  // 2. Guardar registro en abastecer_pending
  var fechaHora = fechaLocalISO();

  return conSQLite(
    async (db) => {
      await db.execute(
        "INSERT INTO abastecer_pending (codigo_producto, nombre, cantidad, fecha_hora, synced) VALUES (?, ?, ?, ?, ?)",
        [abastecer.codigo, abastecer.nombre, Number(abastecer.cantidad), fechaHora, 0]
      );
      console.log("✅ Abastecimiento guardado:", abastecer.codigo, "+" + abastecer.cantidad);
      return true;
    },
    function() {
      var abastecimientos = leerLocal(LS_KEYS.abastecer, []);
      abastecimientos.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        codigo_producto: abastecer.codigo,
        nombre: abastecer.nombre,
        cantidad: Number(abastecer.cantidad),
        fecha_hora: fechaHora,
        synced: 0,
      });
      return guardarLocal(LS_KEYS.abastecer, abastecimientos);
    }
  );
}

// ============================================
// FUNCIONES PARA GASTOS OFFLINE
// ============================================

// Guardar gasto en SQLite/localStorage
async function guardarGastoOffline(gasto) {
  if (!gasto || !gasto.descripcion || !gasto.monto) {
    return false;
  }

  var fecha = gasto.fecha || fechaLocalISO().split("T")[0];
  var monto = Number(gasto.monto) || 0;

  function construirGasto() {
    return {
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: fecha,
      descripcion: gasto.descripcion,
      monto: monto,
      synced: 0,
    };
  }

  return conSQLite(
    async (db) => {
      await db.execute(
        "INSERT INTO gastos_pending (fecha, descripcion, monto, synced) VALUES (?, ?, ?, 0)",
        [fecha, gasto.descripcion, monto]
      );
      console.log("✅ Gasto guardado offline:", gasto.descripcion, "$" + monto);
      return true;
    },
    function() {
      var actuales = leerLocal(LS_KEYS.gastos, []);
      actuales.push(construirGasto());
      return guardarLocal(LS_KEYS.gastos, actuales);
    }
  );
}

// ============================================
// LEER GASTOS DEL DÍA DESDE BD LOCAL
// ============================================
async function leerGastosDelDia(fecha) {
  var gastos = await conSQLite(
    async (db) => {
      var result = await db.execute("SELECT * FROM gastos_pending ORDER BY id");
      return result.values || [];
    },
    () => leerLocal(LS_KEYS.gastos, [])
  );
  gastos = gastos.filter(function(g) {
    return (g.fecha || "").substring(0, 10) === fecha;
  });
  return gastos.map(function(g) {
    return {
      descripcion: g.descripcion || "",
      monto: Number(g.monto || 0),
    };
  });
}

// ============================================
// STOCK AGOTADO - Guardar evento de producto sin stock
// ============================================
async function guardarStockAgotado(codigo, nombre, fechaHora) {
  var eventos = leerLocal(LS_KEYS.stock_agotado, []);
  var fecha = (fechaHora || "").substring(0, 10);
  var existe = eventos.some(function(e) {
    return e.codigo === codigo && (e.fecha || "").substring(0, 10) === fecha;
  });
  if (existe) return true;

  eventos.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    codigo: codigo,
    nombre: nombre || "Producto",
    fecha: fecha,
    fechaHora: fechaHora || new Date().toISOString(),
  });
  return guardarLocal(LS_KEYS.stock_agotado, eventos);
}

// ============================================
// STOCK AGOTADO - Obtener eventos en rango de fechas
// ============================================
async function getStockAgotadosEnRango(fechaInicio, fechaFin) {
  var eventos = leerLocal(LS_KEYS.stock_agotado, []);
  if (!fechaInicio) return [];
  var fin = fechaFin || fechaInicio;
  return eventos.filter(function(e) {
    var f = (e.fecha || "").substring(0, 10);
    return f >= fechaInicio && f <= fin;
  });
}

// ============================================
// ELIMINAR PRODUCTO - Lo borra de la base local
// ============================================
async function eliminarProductoLocal(codigo) {
  if (!codigo) return false;

  return conSQLite(
    async (db) => {
      await db.execute("DELETE FROM productos WHERE codigo = ?", [codigo]);
      console.log("✅ Producto eliminado de SQLite:", codigo);
      return true;
    },
    function() {
      var productosLocal = leerLocal(LS_KEYS.productos, []);
      var filtrados = productosLocal.filter(function(p) {
        return String(p.codigo) !== String(codigo);
      });
      if (filtrados.length === productosLocal.length) return false;
      return guardarLocal(LS_KEYS.productos, filtrados);
    }
  );
}

// ============================================
// FUNCIONES PARA HISTORIAL DE VENTAS
// ============================================

// Obtener ventas agrupadas por factura_id para una fecha específica
async function getVentasAgrupadasPorFactura(fechaISO) {
  try {
    var ventas = [];
    var fechaFiltro = fechaISO || fechaLocalHoyISO();

    if (storageMode === "sqlite" && db) {
      var result = await db.execute(
        "SELECT * FROM ventas_pending WHERE date(fecha_hora) = ? ORDER BY factura_id, id",
        [fechaFiltro]
      );
      ventas = result.values || [];
    } else {
      ventas = leerLocal(LS_KEYS.ventas, []).filter(function(v) {
        return extraerFechaISO(v.fecha_hora || v.fechaHora) === fechaFiltro;
      });
    }

    if (ventas.length === 0) {
      return [];
    }

    var facturasMap = {};

    for (var i = 0; i < ventas.length; i++) {
      var v = ventas[i];
      var facturaId = v.factura_id || ("sin_factura_" + i);

      if (!facturasMap[facturaId]) {
        facturasMap[facturaId] = {
          facturaId: facturaId,
          fechaHora: v.fecha_hora,
          productos: [],
          total: 0,
          efectivo: v.efectivo || v.efectividad || 0,
          transferencia: v.transferencia || 0,
          synced: Number(v.synced || 0),
          ids: []
        };
      }

      var factura = facturasMap[facturaId];
      factura.productos.push({
        codigo: v.codigo_producto,
        nombre: v.nombre,
        cantidad: Number(v.cantidad || 0),
        precio: Number(v.precio || 0),
        subtotal: Number(v.subtotal || 0)
      });
      factura.total += Number(v.subtotal || 0);

      if (Number(v.synced || 0) === 0) {
        factura.synced = 0;
      }

      factura.ids.push(v.id);
    }

    var facturas = [];
    var keys = Object.keys(facturasMap);
    for (var j = 0; j < keys.length; j++) {
      facturas.push(facturasMap[keys[j]]);
    }

    facturas.sort(function(a, b) {
      return String(b.facturaId).localeCompare(String(a.facturaId));
    });

    return facturas;
  } catch (error) {
    console.error("Error en getVentasAgrupadasPorFactura:", error);
    return [];
  }
}

// Deshacer una venta (suma las cantidades de vuelta al stock)
async function deshacerVenta(facturaId) {
  try {
    console.log("Deshaciendo venta:", facturaId);

    var lineas = [];

    if (storageMode === "sqlite" && db) {
      var result = await db.execute(
        "SELECT * FROM ventas_pending WHERE factura_id = ? AND synced = 0",
        [facturaId]
      );
      lineas = result.values || [];

      if (lineas.length === 0) {
        console.warn("No se encontró la venta o ya está sincronizada");
        return { success: false, error: "La venta no existe o ya fue sincronizada" };
      }

      for (var i = 0; i < lineas.length; i++) {
        var linea = lineas[i];
        var codigo = linea.codigo_producto;
        var cantidad = Number(linea.cantidad || 0);

        var resultStock = await db.execute(
          "SELECT disponibilidad FROM productos WHERE codigo = ?",
          [codigo]
        );

        if (resultStock.values && resultStock.values.length > 0) {
          var stockActual = Number(resultStock.values[0].disponibilidad || 0);
          var nuevoStock = stockActual + cantidad;

          await db.execute(
            "UPDATE productos SET disponibilidad = ? WHERE codigo = ?",
            [nuevoStock, codigo]
          );

          console.log("Stock restaurado:", codigo, "+" + cantidad, "→", nuevoStock);
        }
      }

      await db.execute(
        "DELETE FROM ventas_pending WHERE factura_id = ? AND synced = 0",
        [facturaId]
      );

      console.log("Venta deshecha:", facturaId);
      return { success: true, message: "Venta deshecha correctamente" };

    } else {
      var ventas = leerLocal(LS_KEYS.ventas, []);
      var ventasFiltradas = [];
      var lineasDeshechas = [];

      for (var j = 0; j < ventas.length; j++) {
        var v = ventas[j];
        if (String(v.factura_id) === String(facturaId) && Number(v.synced || 0) === 0) {
          lineasDeshechas.push(v);
        } else {
          ventasFiltradas.push(v);
        }
      }

      if (lineasDeshechas.length === 0) {
        return { success: false, error: "La venta no existe o ya fue sincronizada" };
      }

      var productosLocal = leerLocal(LS_KEYS.productos, []);
      for (var k = 0; k < lineasDeshechas.length; k++) {
        var ld = lineasDeshechas[k];
        for (var p = 0; p < productosLocal.length; p++) {
          if (String(productosLocal[p].codigo) === String(ld.codigo_producto)) {
            productosLocal[p].disponibilidad = Number(productosLocal[p].disponibilidad || 0) + Number(ld.cantidad || 0);
            break;
          }
        }
      }

      guardarLocal(LS_KEYS.productos, productosLocal);
      guardarLocal(LS_KEYS.ventas, ventasFiltradas);

      console.log("Venta deshecha (localStorage):", facturaId);
      return { success: true, message: "Venta deshecha correctamente" };
    }
  } catch (error) {
    console.error("Error deshaciendo venta:", error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SISTEMA DE ACTIVACIÓN DE DISPOSITIVOS
// ============================================

const MASTER_SALT = "GestionPlus2024!";

const ACTIVATION_KEY = "gplus_device_activated";
const DEVICE_ID_KEY = "gplus_device_id_cache";

// ============================================
// GENERAR ID DE DISPOSITIVO (ofuscado)
// ============================================
async function generateDeviceId() {
  var cached = localStorage.getItem(DEVICE_ID_KEY);
  if (cached) return cached;

  var model = "unknown";
  var osVersion = "unknown";
  var platform = "unknown";
  var uuid = "unknown";

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    var devicePlugin = null;
    if (window.Capacitor.Plugins && window.Capacitor.Plugins.Device) {
      devicePlugin = window.Capacitor.Plugins.Device;
    }

    if (devicePlugin && typeof devicePlugin.getInfo === 'function') {
      try {
        var info = await devicePlugin.getInfo();
        model = info.model || model;
        osVersion = info.osVersion || osVersion;
        platform = info.platform || platform;
      } catch (e) {
        console.warn("[DeviceID] Error leyendo Device.getInfo:", e.message);
      }
    }

    if (devicePlugin && typeof devicePlugin.getId === 'function') {
      try {
        var idResult = await devicePlugin.getId();
        uuid = idResult.uuid || uuid;
      } catch (e) {
        console.warn("[DeviceID] Error leyendo Device.getId:", e.message);
      }
    }
  }

  var salt = localStorage.getItem("gplus_device_salt");
  if (!salt) {
    var arr = [];
    for (var si = 0; si < 8; si++) {
      arr.push(Math.floor(Math.random() * 36).toString(36));
    }
    salt = arr.join("") + Date.now().toString(36);
    try {
      localStorage.setItem("gplus_device_salt", salt);
    } catch (e) {
      salt = "fallback_" + Date.now();
    }
  }

  var raw = model + "|" + osVersion + "|" + platform + "|" + uuid + "|" + salt;

  var obfuscated = "";
  for (var i = 0; i < raw.length; i++) {
    var code = raw.charCodeAt(i);
    code = ((code * 7) ^ 0x3B) & 0xFF;
    var hex = code.toString(16);
    if (hex.length < 2) hex = "0" + hex;
    obfuscated += hex;
  }

  var deviceId = obfuscated.toUpperCase();

  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch (e) {}

  console.log("DeviceID Generado:", deviceId);
  return deviceId;
}

// ============================================
// COMPUTAR CLAVE DE ACTIVACIÓN
// ============================================
function computeActivationKey(deviceId) {
  var combined = deviceId + MASTER_SALT;

  var buf = [0, 0, 0, 0, 0, 0, 0, 0];

  for (var i = 0; i < combined.length; i++) {
    var code = combined.charCodeAt(i);
    code = (code ^ (0x2A + i)) & 0xFF;
    code = ((code >> 2) | ((code & 3) << 6)) & 0xFF;

    buf[i % 8] = (buf[i % 8] ^ code) & 0xFF;
    buf[(i + 3) % 8] = (buf[(i + 3) % 8] + code) & 0xFF;
    buf[(i + 7) % 8] = (buf[(i + 7) % 8] ^ ((code << 1) & 0xFF)) & 0xFF;
  }

  for (var i = 0; i < 8; i++) {
    buf[i] = (buf[i] ^ buf[(i + 1) % 8]) & 0xFF;
  }

  var hexResult = "";
  for (var i = 0; i < buf.length; i++) {
    var h = buf[i].toString(16);
    if (h.length < 2) h = "0" + h;
    hexResult += h;
  }

  var formatted = hexResult.toUpperCase();
  var result = "";
  for (var i = 0; i < formatted.length; i += 4) {
    if (result.length > 0) result += "-";
    result += formatted.substring(i, i + 4);
  }

  return result;
}

// ============================================
// VERIFICAR CLAVE DE ACTIVACIÓN
// ============================================
async function verificarClave(claveIngresada) {
  var deviceId = await generateDeviceId();
  var claveEsperada = computeActivationKey(deviceId);

  console.log("Clave esperada:", claveEsperada);
  console.log("Clave ingresada:", claveIngresada);

  return claveIngresada.trim().toUpperCase() === claveEsperada;
}

// ============================================
// GUARDAR ACTIVACIÓN PERMANENTE
// ============================================
async function guardarActivacion() {
  try {
    localStorage.setItem(ACTIVATION_KEY, "true");
  } catch (e) {
    console.error("Error guardando en localStorage:", e);
  }

  if (storageMode === "sqlite" && db) {
    try {
      await db.execute(
        "INSERT OR REPLACE INTO config (clave, valor, timestamp) VALUES (?, ?, ?)",
        [ACTIVATION_KEY, "true", Date.now()]
      );
    } catch (e) {
      console.warn("No se pudo guardar en SQLite:", e.message);
    }
  }
}

// ============================================
// VERIFICAR SI EL DISPOSITIVO ESTÁ ACTIVADO
// ============================================
async function isActivated() {
  var localState = localStorage.getItem(ACTIVATION_KEY);
  if (localState === "true") return true;

  if (storageMode === "sqlite" && db) {
    try {
      var result = await db.execute(
        "SELECT valor FROM config WHERE clave = ?",
        [ACTIVATION_KEY]
      );
      if (result.values && result.values.length > 0 && result.values[0].valor === "true") {
        try { localStorage.setItem(ACTIVATION_KEY, "true"); } catch (e) {}
        return true;
      }
    } catch (e) {
      console.warn("Error leyendo SQLite:", e.message);
    }
  }

  return false;
}

// ============================================
// LIMPIAR ACTIVACIÓN (para pruebas)
// ============================================
async function limpiarActivacion() {
  try {
    localStorage.removeItem(ACTIVATION_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
    localStorage.removeItem("gplus_device_salt");
  } catch (e) {}

  if (storageMode === "sqlite" && db) {
    try {
      await db.execute("DELETE FROM config WHERE clave = ?", [ACTIVATION_KEY]);
    } catch (e) {}
  }
}

// ============================================
// GENERAR ID DE FACTURA (secuencial, estilo Excel)
// ============================================
/**
 * Genera un ID único de factura basado en fecha como "4567800001" (prefijo + sufijo)
 * El prefijo son días desde 1900-01-01, el sufijo es secuencial por día.
 * Persiste en localStorage con guardarLocal() para detectar fallos de cuota.
 */
function generarFacturaId() {
  var now = new Date();
  var hoyISO = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');

  // Leer referencia guardada del servidor Y su fecha (retrocompatible con datos legacy)
  var ultimaReferencia = _leerString('posmovil_ultima_factura_referencia');
  var fechaReferencia = _leerString('posmovil_fecha_referencia');

  // Si tenemos referencia Y fecha, usarlas
  if (ultimaReferencia && ultimaReferencia.length >= 10 && fechaReferencia) {
    var prefijoRef = ultimaReferencia.substring(0, 5);
    var sufijoRef = parseInt(ultimaReferencia.substring(5, 10)) || 0;
    var refDate = new Date(fechaReferencia);
    var todayDate = new Date(hoyISO);
    var msPerDay = 1000 * 60 * 60 * 24;
    var diasDiff = Math.floor((todayDate - refDate) / msPerDay);
    var prefijoHoy = String(Number(prefijoRef) + diasDiff).padStart(5, '0');

    if (diasDiff === 0) {
      // Mismo día que la referencia, incrementar sufijo
      var nuevoSufijo = sufijoRef + 1;
      var sufijo = String(nuevoSufijo).padStart(5, '0');
      var nuevoId = prefijoHoy + sufijo;

      if (!guardarLocal('posmovil_ultima_factura_referencia', nuevoId)) {
        console.error("🚨 [generarFacturaId] No se pudo guardar referencia — riesgo de ID duplicado");
      }
      guardarLocal('posmovil_ultimo_prefijo', prefijoHoy);
      guardarLocal('posmovil_ultimo_sufijo', String(nuevoSufijo));

      console.log('📋 FacturaID generado: ' + nuevoId + ' (mismo día que referencia)');
      return nuevoId;
    } else {
      // Nuevo día (o días), empezar sufijo en 1
      var nuevoId = prefijoHoy + "00001";

      if (!guardarLocal('posmovil_ultima_factura_referencia', nuevoId)) {
        console.error("🚨 [generarFacturaId] No se pudo guardar referencia — riesgo de ID duplicado");
      }
      guardarLocal('posmovil_ultimo_prefijo', prefijoHoy);
      guardarLocal('posmovil_ultimo_sufijo', '1');
      guardarLocal('posmovil_fecha_referencia', hoyISO);

      console.log('📋 FacturaID generado: ' + nuevoId + ' (nuevo día, díasDiff=' + diasDiff + ')');
      return nuevoId;
    }
  }

  // Fallback: sin referencia, usar la fecha actual (primera vez)
  var fechaBase = new Date(1900, 0, 1);
  var diffMs = now - fechaBase;
  var diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  var fechaSerial = diffDias + 2;
  var prefijoHoy = String(Math.floor(fechaSerial)).padStart(5, '0');
  var nuevoId = prefijoHoy + "00001";

  if (!guardarLocal('posmovil_ultima_factura_referencia', nuevoId)) {
    console.error("🚨 [generarFacturaId] No se pudo guardar referencia — riesgo de ID duplicado");
  }
  guardarLocal('posmovil_ultimo_prefijo', prefijoHoy);
  guardarLocal('posmovil_ultimo_sufijo', '1');
  guardarLocal('posmovil_fecha_referencia', hoyISO);

  console.log('📋 FacturaID generado (sin referencia): ' + nuevoId);
  return nuevoId;
}

// ============================================
// EXPORTAR COMO MÓDULO GLOBAL
// ============================================
window.Database = {
  initDatabase: initDatabase,
  getStorageMode: function() { return storageMode; },
  getProductosLocal: getProductosLocal,
  syncProductosLocal: syncProductosLocal,
  guardarVentaOffline: guardarVentaOffline,
  getResumenOffline: getResumenOffline,
  limpiarVentasAntiguas: limpiarVentasAntiguas,
  // Funciones para mermas
  guardarMermaOffline: guardarMermaOffline,
  // Funciones para nuevo producto
  getUltimoCodigoProducto: getUltimoCodigoProducto,
  guardarNuevoProducto: guardarNuevoProducto,
  guardarEntradaProductoCompleto: guardarEntradaProductoCompleto,
  // Funciones para abastecer
  actualizarStockProducto: actualizarStockProducto,
  guardarAbastecerOffline: guardarAbastecerOffline,
  // Funciones para gastos
  guardarGastoOffline: guardarGastoOffline,
  // Funciones para historial de ventas
  getVentasAgrupadasPorFactura: getVentasAgrupadasPorFactura,
  deshacerVenta: deshacerVenta,
  // Funciones para stock agotado
  guardarStockAgotado: guardarStockAgotado,
  getStockAgotadosEnRango: getStockAgotadosEnRango,
  // Eliminar producto
  eliminarProductoLocal: eliminarProductoLocal,
  // Generar ID de factura
  generarFacturaId: generarFacturaId,
  // Funciones de activación
  generateDeviceId: generateDeviceId,
  computeActivationKey: computeActivationKey,
  verificarClave: verificarClave,
  guardarActivacion: guardarActivacion,
  isActivated: isActivated,
  limpiarActivacion: limpiarActivacion,
};

console.log("Database module loaded");
