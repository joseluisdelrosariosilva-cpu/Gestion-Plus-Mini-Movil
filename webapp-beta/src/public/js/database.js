// ============================================
// DATABASE MODULE - SQLite para modo offline
// ============================================
// Versión vanilla para ejecutarse en webview del APK

var db = null;
var storageMode = "none"; // sqlite | local

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

// ============================================
// INICIALIZAR BASE DE DATOS
// ============================================
async function initDatabase() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
    activarModoLocal("Entorno no nativo");
    return true;
  }

  var sqliteGlobal = window.SQLite;
  if (!sqliteGlobal || typeof sqliteGlobal.createDatabase !== "function") {
    activarModoLocal("Plugin SQLite no expuesto como window.SQLite.createDatabase");
    return true;
  }

  try {
    db = await sqliteGlobal.createDatabase({
      database: "posmovil.db",
    });

    await db.execute(
      "CREATE TABLE IF NOT EXISTS productos (codigo TEXT PRIMARY KEY, nombre TEXT, precio REAL, disponibilidad INTEGER)"
    );

    await db.execute(
      "CREATE TABLE IF NOT EXISTS ventas_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, factura_id TEXT, fecha_hora TEXT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, precio REAL, subtotal REAL, efectivo REAL, transferencia REAL, synced INTEGER DEFAULT 0)"
    );

    try {
      await db.execute(
        "ALTER TABLE ventas_pending ADD COLUMN efectivo REAL DEFAULT 0"
      );
    } catch (_) {}

    try {
      await db.execute(
        "UPDATE ventas_pending SET efectivo = COALESCE(efectivo, efectividad, 0)"
      );
    } catch (_) {}

    try {
      await db.execute(
        "ALTER TABLE productos ADD COLUMN precio_costo REAL DEFAULT 0"
      );
    } catch (_) {}

    try {
      await db.execute(
        "ALTER TABLE ventas_pending ADD COLUMN precio_costo REAL DEFAULT 0"
      );
    } catch (_) {}

    await db.execute(
      "CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT, timestamp INTEGER)"
    );

    await db.execute(
      "CREATE TABLE IF NOT EXISTS mermas_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, fecha_hora TEXT, synced INTEGER DEFAULT 0)"
    );

    await db.execute(
      "CREATE TABLE IF NOT EXISTS entrada_productos_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, nombre TEXT, cantidad INTEGER, precio_venta REAL, precio_costo REAL, fecha_hora TEXT, synced INTEGER DEFAULT 0)"
    );

    await db.execute(
      "CREATE TABLE IF NOT EXISTS abastecer_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_producto TEXT, nombre TEXT, cantidad INTEGER, fecha_hora TEXT, synced INTEGER DEFAULT 0)"
    );

    await db.execute(
      "CREATE TABLE IF NOT EXISTS gastos_pending (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, descripcion TEXT, monto REAL, synced INTEGER DEFAULT 0)"
    );

    console.log("Base de datos SQLite inicializada");
    storageMode = "sqlite";
    return true;
  } catch (error) {
    console.error("Error inicializando SQLite:", error);
    activarModoLocal("Falló init SQLite");
    return true;
  }
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

  if (storageMode !== "sqlite" || !db) {
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

  try {
    await db.execute(
      "INSERT OR REPLACE INTO productos (codigo, nombre, precio, disponibilidad, precio_costo) VALUES (?, ?, ?, ?, ?)",
      [producto.codigo, producto.nombre, Number(producto.precioVenta || 0), Number(producto.cantidad || 0), Number(producto.precioCosto || 0)]
    );
    console.log("Nuevo producto guardado:", producto.codigo);
    return true;
  } catch (error) {
    console.error("Error guardando nuevo producto:", error);
    return false;
  }
}

// ============================================
// GUARDAR ENTRADA COMPLETA DE PRODUCTO (productos + entrada_productos_pending)
// ============================================
async function guardarEntradaProductoCompleto(producto) {
  if (!producto || !producto.codigo) {
    return false;
  }

  var guardadoEnProductos = await guardarNuevoProducto(producto);
  if (!guardadoEnProductos) {
    console.error("Error guardando en tabla productos");
    return false;
  }

  var fechaHora = new Date().toISOString();

  if (storageMode !== "sqlite" || !db) {
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
    console.log("Guardado en localStorage, total entradas:", entradas.length);
    return guardarLocal(LS_KEYS.entrada_productos, entradas);
  }

  try {
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
    console.log("Entrada de producto guardada:", producto.codigo);
    return true;
  } catch (error) {
    console.error("Error guardando entrada_producto_pending:", error.message);
    return false;
  }
}

// ============================================
// OBTENER PRODUCTOS DESDE SQLite
// ============================================
async function getProductosLocal() {
  if (storageMode !== "sqlite" || !db) {
    return leerLocal(LS_KEYS.productos, []);
  }

  try {
    var result = await db.execute(
      "SELECT codigo, nombre, precio, disponibilidad, precio_costo FROM productos ORDER BY nombre"
    );
    return result.values || [];
  } catch (error) {
    console.error("Error obteniendo productos:", error);
    activarModoLocal("Error consultando productos SQLite");
    return leerLocal(LS_KEYS.productos, []);
  }
}

// ============================================
// GUARDAR PRODUCTOS EN SQLite (cache offline)
// ============================================
async function syncProductosLocal(productos) {
  var normalizados = (productos || []).map(normalizarProducto);

  if (storageMode !== "sqlite" || !db) {
    return guardarLocal(LS_KEYS.productos, normalizados);
  }

  try {
    await db.execute("DELETE FROM productos");

    for (var i = 0; i < normalizados.length; i++) {
      var p = normalizados[i];
      await db.execute(
        "INSERT OR REPLACE INTO productos (codigo, nombre, precio, disponibilidad, precio_costo) VALUES (?, ?, ?, ?, ?)",
        [p.codigo, p.nombre, p.precio || 0, p.disponibilidad || 0, p.precio_costo || 0]
      );
    }

    console.log(normalizados.length + " productos guardados");
    return true;
  } catch (error) {
    console.error("Error guardando productos:", error);
    activarModoLocal("Error guardando productos en SQLite");
    return guardarLocal(LS_KEYS.productos, normalizados);
  }
}

// ============================================
// GUARDAR VENTA EN SQLite (modo offline)
// ============================================
async function guardarVentaOffline(venta) {
  if (!venta || !Array.isArray(venta.productos) || venta.productos.length === 0) {
    return false;
  }

  if (storageMode !== "sqlite" || !db) {
    var actuales = leerLocal(LS_KEYS.ventas, []);
    var lineas = construirLineasVenta(venta);
    return guardarLocal(LS_KEYS.ventas, actuales.concat(lineas));
  }

  try {
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

    console.log("Venta guardada");
    return true;
  } catch (error) {
    console.error("Error guardando venta:", error);
    activarModoLocal("Error guardando ventas en SQLite");
    var actuales2 = leerLocal(LS_KEYS.ventas, []);
    var lineas2 = construirLineasVenta(venta);
    return guardarLocal(LS_KEYS.ventas, actuales2.concat(lineas2));
  }
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

  if (storageMode !== "sqlite" || !db) {
    var actuales = leerLocal(LS_KEYS.mermas, []);
    var lineas = [];
    for (var i = 0; i < merma.productos.length; i++) {
      var item = merma.productos[i];
      lineas.push({
        id: Date.now() + i + Math.floor(Math.random() * 1000),
        codigo_producto: item.codigo,
        nombre: item.nombre,
        cantidad: Number(item.cantidad || 0),
        fecha_hora: merma.fechaHora,
        synced: 0,
      });
    }
    return guardarLocal(LS_KEYS.mermas, actuales.concat(lineas));
  }

  try {
    for (var j = 0; j < merma.productos.length; j++) {
      var prod = merma.productos[j];
      await db.execute(
        "INSERT INTO mermas_pending (codigo_producto, nombre, cantidad, fecha_hora, synced) VALUES (?, ?, ?, ?, 0)",
        [prod.codigo, prod.nombre, prod.cantidad, merma.fechaHora]
      );
    }
    console.log("Merma guardada (" + merma.productos.length + " productos)");
    return true;
  } catch (error) {
    console.error("Error guardando merma:", error);
    var actuales2 = leerLocal(LS_KEYS.mermas, []);
    var lineas2 = [];
    for (var k = 0; k < merma.productos.length; k++) {
      var p = merma.productos[k];
      lineas2.push({
        id: Date.now() + k + Math.floor(Math.random() * 1000),
        codigo_producto: p.codigo,
        nombre: p.nombre,
        cantidad: Number(p.cantidad || 0),
        fecha_hora: merma.fechaHora,
        synced: 0,
      });
    }
    return guardarLocal(LS_KEYS.mermas, actuales2.concat(lineas2));
  }
}

// ============================================
// FUNCIONES PARA ABASTECER (reabastecer productos existentes)
// ============================================

// Actualizar stock de un producto (sumar cantidad)
async function actualizarStockProducto(codigo, cantidadSumar) {
  if (storageMode !== "sqlite" || !db) {
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

  try {
    await db.execute(
      "UPDATE productos SET disponibilidad = disponibilidad + ? WHERE codigo = ?",
      [Number(cantidadSumar), codigo]
    );
    console.log("Stock actualizado para " + codigo + " (+" + cantidadSumar + ")");
    return true;
  } catch (error) {
    console.error("Error actualizando stock:", error);
    return false;
  }
}

// Guardar abastecimiento en SQLite/localStorage
async function guardarAbastecerOffline(abastecer) {
  if (!abastecer || !abastecer.codigo || !abastecer.cantidad) {
    return false;
  }

  var stockActualizado = await actualizarStockProducto(abastecer.codigo, abastecer.cantidad);
  if (!stockActualizado) {
    console.error("Error actualizando stock del producto");
    return false;
  }

  var fechaHora = new Date().toISOString();

  if (storageMode !== "sqlite" || !db) {
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

  try {
    await db.execute(
      "INSERT INTO abastecer_pending (codigo_producto, nombre, cantidad, fecha_hora, synced) VALUES (?, ?, ?, ?, ?)",
      [abastecer.codigo, abastecer.nombre, Number(abastecer.cantidad), fechaHora, 0]
    );
    console.log("Abastecimiento guardado:", abastecer.codigo, "+" + abastecer.cantidad);
    return true;
  } catch (error) {
    console.error("Error guardando abastecimiento:", error);
    return false;
  }
}

// ============================================
// FUNCIONES PARA GASTOS OFFLINE
// ============================================

// Guardar gasto en SQLite/localStorage
async function guardarGastoOffline(gasto) {
  if (!gasto || !gasto.descripcion || !gasto.monto) {
    return false;
  }

  var fecha = gasto.fecha || new Date().toISOString().split("T")[0];
  var monto = Number(gasto.monto) || 0;

  if (storageMode !== "sqlite" || !db) {
    var actuales = leerLocal(LS_KEYS.gastos, []);
    actuales.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: fecha,
      descripcion: gasto.descripcion,
      monto: monto,
      synced: 0,
    });
    return guardarLocal(LS_KEYS.gastos, actuales);
  }

  try {
    await db.execute(
      "INSERT INTO gastos_pending (fecha, descripcion, monto, synced) VALUES (?, ?, ?, 0)",
      [fecha, gasto.descripcion, monto]
    );
    console.log("Gasto guardado:", gasto.descripcion, "$" + monto);
    return true;
  } catch (error) {
    console.error("Error guardando gasto:", error);
    var actuales2 = leerLocal(LS_KEYS.gastos, []);
    actuales2.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      fecha: fecha,
      descripcion: gasto.descripcion,
      monto: monto,
      synced: 0,
    });
    return guardarLocal(LS_KEYS.gastos, actuales2);
  }
}

// ============================================
// LEER GASTOS DEL DÍA DESDE BD LOCAL
// ============================================
async function leerGastosDelDia(fecha) {
  var gastos = [];
  if (storageMode === "sqlite" && db) {
    try {
      var result = await db.execute("SELECT * FROM gastos_pending ORDER BY id");
      gastos = result.values || [];
    } catch (e) {
      gastos = leerLocal(LS_KEYS.gastos, []);
    }
  } else {
    gastos = leerLocal(LS_KEYS.gastos, []);
  }
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

  if (storageMode !== "sqlite" || !db) {
    var productosLocal = leerLocal(LS_KEYS.productos, []);
    var filtrados = productosLocal.filter(function(p) {
      return String(p.codigo) !== String(codigo);
    });
    if (filtrados.length === productosLocal.length) return false;
    return guardarLocal(LS_KEYS.productos, filtrados);
  }

  try {
    await db.execute("DELETE FROM productos WHERE codigo = ?", [codigo]);
    console.log("Producto eliminado de SQLite:", codigo);
    return true;
  } catch (error) {
    console.error("Error eliminando producto de SQLite:", error);
    return false;
  }
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
  // Funciones de activación
  generateDeviceId: generateDeviceId,
  computeActivationKey: computeActivationKey,
  verificarClave: verificarClave,
  guardarActivacion: guardarActivacion,
  isActivated: isActivated,
  limpiarActivacion: limpiarActivacion,
};

console.log("Database module loaded");
