// ============================================
// POS MÓVIL - Lógica de la aplicación
// ============================================

let dbInicializado = false;
let ultimoToggleCarritoTs = 0;

const DECIMALES = 3;
const FACTOR_DECIMALES = 10 ** DECIMALES;
const PASO_CANTIDAD = 1;

// ============================================
// SISTEMA DE PROTECCIÓN POR CONTRASEÑA
// ============================================
const PASSWORD_KEY = "gplus_protect_password";
const PASSWORD_SESSION_KEY = "gplus_password_session_ok";
const PASSWORD_DEFAULT = "admin";

function obtenerPasswordGuardada() {
  return localStorage.getItem(PASSWORD_KEY) || PASSWORD_DEFAULT;
}

function guardarPassword(nueva) {
  localStorage.setItem(PASSWORD_KEY, nueva);
}

function passwordSesionActiva() {
  return sessionStorage.getItem(PASSWORD_SESSION_KEY) === "true";
}

function marcarPasswordSesion() {
  sessionStorage.setItem(PASSWORD_SESSION_KEY, "true");
}

function limpiarPasswordSesion() {
  sessionStorage.removeItem(PASSWORD_SESSION_KEY);
}

// ============================================
// VERIFICAR CONTRASEÑA (muestra modal, retorna Promise)
// ============================================
function verificarPassword() {
  return new Promise(function(resolve) {
    var modal = document.getElementById("modalPassword");
    var verifyMode = document.getElementById("passwordVerifyMode");
    var changeMode = document.getElementById("passwordChangeMode");
    var input = document.getElementById("passwordInput");
    var errorEl = document.getElementById("passwordError");
    var mensajeEl = document.getElementById("modalPasswordMensaje");
    var tituloEl = document.getElementById("modalPasswordTitulo");
    var btnAceptar = document.getElementById("btnPasswordAceptar");
    var btnCancelar = document.getElementById("btnPasswordCancelar");
    var btnCambiar = document.getElementById("btnPasswordCambiar");
    var btnChangeVolver = document.getElementById("btnPasswordChangeVolver");
    var btnChangeGuardar = document.getElementById("btnPasswordChangeGuardar");
    var oldInput = document.getElementById("passwordOldInput");
    var newInput = document.getElementById("passwordNewInput");
    var confirmInput = document.getElementById("passwordConfirmInput");
    var changeError = document.getElementById("passwordChangeError");
    var changeSuccess = document.getElementById("passwordChangeSuccess");

    if (!modal || !verifyMode || !input) {
      resolve(true);
      return;
    }

    errorEl.classList.add("hidden");
    verifyMode.classList.remove("hidden");
    changeMode.classList.add("hidden");
    changeSuccess.classList.add("hidden");
    changeError.classList.add("hidden");
    input.value = "";
    input.focus();
    mensajeEl.textContent = "Ingresá la contraseña para acceder.";
    tituloEl.textContent = "Contraseña";
    modal.classList.remove("hidden");

    var resuelto = false;

    function resolver(resultado) {
      if (resuelto) return;
      resuelto = true;
      modal.classList.add("hidden");
      resolve(resultado);
    }

    function limpiarListeners() {
      btnAceptar.removeEventListener("click", onAceptar);
      btnCancelar.removeEventListener("click", onCancelar);
      input.removeEventListener("keydown", onInputKeydown);
      btnCambiar.removeEventListener("click", onCambiar);
      btnChangeVolver.removeEventListener("click", onChangeVolver);
      btnChangeGuardar.removeEventListener("click", onChangeGuardar);
    }

    function onAceptar() {
      var clave = input.value.trim();
      if (clave === obtenerPasswordGuardada()) {
        limpiarListeners();
        resolver(true);
      } else {
        errorEl.classList.remove("hidden");
        input.value = "";
        input.focus();
      }
    }

    function onCancelar() {
      limpiarListeners();
      resolver(false);
    }

    function onInputKeydown(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        onAceptar();
      }
      if (e.key === "Escape") {
        onCancelar();
      }
    }

    function onCambiar() {
      verifyMode.classList.add("hidden");
      changeMode.classList.remove("hidden");
      changeError.classList.add("hidden");
      changeSuccess.classList.add("hidden");
      oldInput.value = "";
      newInput.value = "";
      confirmInput.value = "";
      oldInput.focus();
      tituloEl.textContent = "Cambiar contraseña";
      mensajeEl.textContent = "Ingresá la contraseña actual y la nueva.";
    }

    function onChangeVolver() {
      changeMode.classList.add("hidden");
      verifyMode.classList.remove("hidden");
      changeError.classList.add("hidden");
      changeSuccess.classList.add("hidden");
      input.value = "";
      input.focus();
      tituloEl.textContent = "Contraseña";
      mensajeEl.textContent = "Ingresá la contraseña para acceder.";
    }

    function onChangeGuardar() {
      var oldClave = oldInput.value.trim();
      var newClave = newInput.value.trim();
      var confirmClave = confirmInput.value.trim();

      changeError.classList.add("hidden");
      changeSuccess.classList.add("hidden");

      if (oldClave !== obtenerPasswordGuardada()) {
        changeError.textContent = "La contraseña actual no es correcta";
        changeError.classList.remove("hidden");
        oldInput.value = "";
        oldInput.focus();
        return;
      }

      if (!newClave || newClave.length < 3) {
        changeError.textContent = "La nueva contraseña debe tener al menos 3 caracteres";
        changeError.classList.remove("hidden");
        newInput.value = "";
        newInput.focus();
        return;
      }

      if (newClave !== confirmClave) {
        changeError.textContent = "Las contraseñas nuevas no coinciden";
        changeError.classList.remove("hidden");
        confirmInput.value = "";
        confirmInput.focus();
        return;
      }

      guardarPassword(newClave);
      limpiarPasswordSesion();
      changeSuccess.classList.remove("hidden");

      setTimeout(function() {
        onChangeVolver();
      }, 1500);
    }

    function onModalClick(e) {
      if (e.target === modal) {
        limpiarListeners();
        resolver(false);
      }
    }

    btnAceptar.addEventListener("click", onAceptar);
    btnCancelar.addEventListener("click", onCancelar);
    input.addEventListener("keydown", onInputKeydown);
    btnCambiar.addEventListener("click", onCambiar);
    btnChangeVolver.addEventListener("click", onChangeVolver);
    btnChangeGuardar.addEventListener("click", onChangeGuardar);
    modal.addEventListener("click", onModalClick);
  });
}

function redondear3(valor) {
  return Math.round((Number(valor) || 0) * FACTOR_DECIMALES) / FACTOR_DECIMALES;
}

function parsearNumero(valor) {
  if (valor === null || valor === undefined) return 0;
  var normalizado = String(valor).replace(",", ".").trim();
  var num = parseFloat(normalizado);
  return Number.isFinite(num) ? redondear3(num) : 0;
}

function formatearNumero(valor) {
  var n = redondear3(valor);
  var texto = n.toFixed(3).replace(/\.?0+$/, "");
  return texto === "" || texto === "-" ? "0" : texto;
}

function formatearMoneda(valor) {
  return "$" + formatearNumero(valor);
}

// Referencias al database module
const DB = window.Database || {};

// Estado de la aplicación
let productos = [];
let carrito = [];
var _productosMermaPendientes = [];

// Elementos del DOM
const productosContainer = document.getElementById("productosContainer");
const carritoLista = document.getElementById("carritoLista");
const totalItems = document.getElementById("totalItems");
const totalPrecio = document.getElementById("totalPrecio");
const totalPagarSpan = document.getElementById("totalPagar");
const efectivoInput = document.getElementById("efectivo");
const transferenciaInput = document.getElementById("transferencia");
const btnPagar = document.getElementById("btnPagar");
const mensajeDiv = document.getElementById("mensaje");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const modalVuelto = document.getElementById("modalVuelto");
const modalVueltoMensaje = document.getElementById("modalVueltoMensaje");
const modalTotal = document.getElementById("modalTotal");
const modalPagado = document.getElementById("modalPagado");
const modalVueltoMonto = document.getElementById("modalVueltoMonto");
const modalCancelar = document.getElementById("modalCancelar");
const modalConfirmar = document.getElementById("modalConfirmar");

// ============================================
// VARIABLES DEL MODAL
// ============================================
let resolverModal = null;

// ============================================
// FUNCIÓN PARA MOSTRAR MODAL DE VUELTO
// ============================================
function mostrarModalVuelto(total, pagado, vuelto) {
  if (!modalVuelto) {
    return Promise.resolve(
      confirm(
        `Vuelto a entregar: ${formatearMoneda(vuelto)}. Confirmas que entregaste el vuelto?`,
      ),
    );
  }

  return new Promise((resolve) => {
    resolverModal = resolve;
    modalVueltoMensaje.textContent =
      "Verifica el monto y confirma la entrega del vuelto.";
    modalTotal.textContent = formatearMoneda(total);
    modalPagado.textContent = formatearMoneda(pagado);
    modalVueltoMonto.textContent = formatearMoneda(vuelto);
    modalVuelto.classList.remove("hidden");
    modalConfirmar.focus();
  });
}

function cerrarModalVuelto(confirmado) {
  if (!modalVuelto || resolverModal === null) return;
  const resolver = resolverModal;
  resolverModal = null;
  modalVuelto.classList.add("hidden");
  resolver(confirmado);
}

// ============================================
// CARGAR PRODUCTOS (solo desde base local)
// ============================================
async function cargarProductos() {
  console.log("Cargando productos...");
  mostrarMensaje("Cargando...", "info");

  if (dbInicializado && DB.getProductosLocal) {
    var productosLocales = await DB.getProductosLocal();
    if (productosLocales.length > 0) {
      productos = productosLocales;
      renderizarProductos(productos);
      mostrarMensaje("Cargados " + productosLocales.length + " productos", "info", 3000);
      console.log("Cargados " + productosLocales.length + " productos");
      return;
    }
  }

  mostrarMensaje("No hay productos disponibles", "warning");
  productosContainer.innerHTML = '<p class="info">No hay productos disponibles.</p>';
}

// ============================================
// RENDERIZAR PRODUCTOS
// ============================================
function renderizarProductos(lista) {
  if (!lista || lista.length === 0) {
    productosContainer.innerHTML =
      '<p class="info">No hay productos disponibles</p>';
    return;
  }

  console.log("Renderizando productos:", lista.length);

  let html = "";

  for (let i = 0; i < lista.length; i++) {
    const producto = lista[i];

    const codigo = producto.codigo || "";
    const nombre = producto.producto || producto.nombre || "Producto";
    const precio = parsearNumero(producto.precio || 0);
    const stock = parsearNumero(producto.disponibilidad || producto.stock || 0);
    const sinStock = stock <= 0;

    const itemEnCarrito = carrito.find((item) => item.codigo === codigo);
    const cantidadEnCarrito = itemEnCarrito ? itemEnCarrito.cantidad : 0;

    const codigoEscapado = codigo.replace(/"/g, "&quot;");

    html += '<div class="producto-card' + (sinStock ? ' sin-stock' : '') + '" data-codigo="' + codigo + '">';
    html += '<div class="producto-info">';
    html += "<h3>" + nombre + "</h3>";
    html += '<div class="precio">' + formatearMoneda(precio) + "</div>";
    html +=
      '<div class="stock">Stock: ' +
      formatearNumero(stock) +
      (sinStock ? " (Sin stock)" : "") +
      "</div>";
    html += "</div>";

    html += '<div class="producto-actions">';

    if (cantidadEnCarrito > 0) {
      html +=
        '<button class="btn-cantidad btn-disminuir" onclick="disminuirCantidad(\'' +
        codigoEscapado +
        "')\">−</button>";
    } else {
      html += '<div style="width: 48px; height: 48px;"></div>';
    }

    html +=
      '<span class="cantidad-seleccionada" id="cant-' +
      codigo +
      '" onclick="editarCantidad(\'' +
      codigoEscapado +
      '\', this)" title="Editar cantidad">' +
      formatearNumero(cantidadEnCarrito) +
      "</span>";

    const puedeSumar = !sinStock && redondear3(cantidadEnCarrito + PASO_CANTIDAD) <= redondear3(stock);
    html +=
      '<button class="btn-cantidad" ' +
      (puedeSumar ? "" : "disabled ") +
      'onclick="agregarAlCarrito(\'' +
      codigoEscapado +
      "')\">+</button>";

    if (sinStock) {
      html +=
        '<button class="btn-eliminar-producto" onclick="eliminarProducto(\'' +
        codigoEscapado +
        '\', this)" title="Eliminar producto">✕</button>';
    }

    html += "</div>";
    html += "</div>";
  }

  productosContainer.innerHTML = html;
  console.log("Productos renderizados con botones -");
}

// ============================================
// ELIMINAR PRODUCTO (borrado real de la base local)
// ============================================
window.eliminarProducto = async function(codigo, btnRef) {
  if (!codigo) return;
  if (!confirm("Eliminar este producto de la lista?\n\nSe borrará permanentemente de la base local.")) return;

  if (DB.eliminarProductoLocal) {
    var ok = await DB.eliminarProductoLocal(codigo);
    if (ok) {
      productos = productos.filter(function(p) {
        return String(p.codigo) !== String(codigo);
      });
      mostrarMensaje("Producto eliminado", "exito", 2000);
      renderizarProductos(productos);
      reapplySearchFilter();
    } else {
      mostrarMensaje("Error al eliminar producto", "error");
    }
  } else {
    mostrarMensaje("Función no disponible", "error");
  }
};

// ============================================
// AGREGAR AL CARRITO
// ============================================
window.agregarAlCarrito = (codigo) => {
  console.log("Agregando producto con código:", codigo);

  const producto = productos.find((p) => p.codigo == codigo);

  if (!producto) {
    console.error("Producto no encontrado:", codigo);
    mostrarMensaje("Error: producto no encontrado", "error");
    return;
  }

  const itemExistente = carrito.find((item) => item.codigo === codigo);
  const stock = parsearNumero(producto.disponibilidad || producto.stock || 0);
  if (stock <= 0) {
    mostrarMensaje("Sin stock", "error", 2000);
    return;
  }

  if (itemExistente) {
    const nuevaCantidad = redondear3(itemExistente.cantidad + PASO_CANTIDAD);
    if (nuevaCantidad <= stock) {
      itemExistente.cantidad = nuevaCantidad;
    } else {
      mostrarMensaje("Stock insuficiente", "error", 2000);
      return;
    }
  } else {
    carrito.push({
      codigo: codigo,
      nombre: producto.producto || producto.nombre,
      precio: parsearNumero(producto.precio || 0),
      precio_costo: parsearNumero(producto.precio_costo || 0),
      cantidad: redondear3(PASO_CANTIDAD),
      maxStock: stock,
    });
  }

  actualizarVistaCarrito();
  renderizarProductos(productos);
  actualizarContadorProducto(codigo);
  reapplySearchFilter();
};

window.editarCantidad = (codigo, spanRef) => {
  const producto = productos.find((p) => String(p.codigo) === String(codigo));
  if (!producto || !spanRef) return;

  if (spanRef.querySelector("input")) return;

  const stock = parsearNumero(producto.disponibilidad || producto.stock || 0);
  const itemExistente = carrito.find((item) => String(item.codigo) === String(codigo));
  const actual = itemExistente ? itemExistente.cantidad : PASO_CANTIDAD;
  const valorOriginal = itemExistente ? itemExistente.cantidad : 0;

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "decimal";
  input.min = "0";
  input.max = String(stock);
  input.step = "0.001";
  input.value = redondear3(actual).toFixed(3);
  input.className = "cantidad-input-inline";

  spanRef.dataset.valorPrevio = spanRef.textContent;
  spanRef.textContent = "";
  spanRef.appendChild(input);
  input.focus();
  input.select();

  const aplicarCantidad = () => {
    const cantidad = redondear3(parsearNumero(input.value));

    if (cantidad > stock) {
      mostrarMensaje("Cantidad supera el stock", "error", 2200);
      spanRef.textContent = formatearNumero(valorOriginal);
      return;
    }

    if (cantidad <= 0) {
      carrito = carrito.filter((item) => String(item.codigo) !== String(codigo));
    } else if (itemExistente) {
      itemExistente.cantidad = cantidad;
    } else {
      carrito.push({
        codigo: codigo,
        nombre: producto.producto || producto.nombre,
        precio: parsearNumero(producto.precio || 0),
        precio_costo: parsearNumero(producto.precio_costo || 0),
        cantidad: cantidad,
        maxStock: stock,
      });
    }

    actualizarVistaCarrito();
    renderizarProductos(productos);
    reapplySearchFilter();
  };

  const cancelar = () => {
    spanRef.textContent = formatearNumero(valorOriginal);
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelar();
    }
  });

  input.addEventListener("blur", aplicarCantidad, { once: true });
};

// ============================================
// DISMINUIR CANTIDAD DEL CARRITO
// ============================================
window.disminuirCantidad = (codigo) => {
  console.log("Disminuyendo producto con código:", codigo);

  const index = carrito.findIndex((item) => item.codigo === codigo);

  if (index !== -1) {
    if (carrito[index].cantidad > PASO_CANTIDAD) {
      const nuevaCantidad = redondear3(carrito[index].cantidad - PASO_CANTIDAD);
      if (nuevaCantidad > 0) {
        carrito[index].cantidad = nuevaCantidad;
        console.log("Nueva cantidad:", carrito[index].cantidad);
      } else {
        carrito.splice(index, 1);
      }
    } else {
      console.log("Eliminando producto (cantidad llegó a 0)");
      carrito.splice(index, 1);
    }
  }

  actualizarVistaCarrito();
  renderizarProductos(productos);
  actualizarContadorProducto(codigo);
  reapplySearchFilter();
};

// ============================================
// ELIMINAR DEL CARRITO
// ============================================
window.eliminarItemCarrito = (codigo) => {
  console.log("Eliminando producto con código:", codigo);

  carrito = carrito.filter((item) => item.codigo !== codigo);

  actualizarVistaCarrito();
  actualizarContadorProducto(codigo);
};

// ============================================
// ACTUALIZAR CONTADOR DE PRODUCTO
// ============================================
function actualizarContadorProducto(codigo) {
  const item = carrito.find((i) => i.codigo === codigo);
  const span = document.getElementById(`cant-${codigo}`);
  if (span) {
    span.textContent = formatearNumero(item ? item.cantidad : 0);
  }
}

// ============================================
// ACTUALIZAR VISTA DEL CARRITO
// ============================================
function actualizarVistaCarrito() {
  const totalProductos = redondear3(carrito.reduce((sum, item) => sum + item.cantidad, 0));
  const totalPagar = carrito.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0,
  );

  totalItems.textContent = `${formatearNumero(totalProductos)} ${totalProductos === 1 ? "producto" : "productos"}`;
  totalPrecio.textContent = formatearMoneda(totalPagar);
  totalPagarSpan.textContent = formatearMoneda(totalPagar);

  if (carrito.length === 0) {
    carritoLista.innerHTML =
      '<li style="text-align: center; padding: 24px; color: var(--text-secondary);">Carrito vacío</li>';
    btnPagar.disabled = true;
    cerrarCarrito();
    return;
  }

  let html = "";

  for (let i = 0; i < carrito.length; i++) {
    const item = carrito[i];

    const codigoEscapado = item.codigo.replace(/"/g, "&quot;");
    const subtotal = redondear3(item.cantidad * item.precio);

    html += '<li class="carrito-item">';

    html += '<div class="carrito-item-info">';
    html += '<div class="carrito-item-nombre">' + item.nombre + "</div>";
    html +=
      '<div class="carrito-item-detalle">' +
      formatearMoneda(item.precio) +
      " c/u</div>";
    html += "</div>";

    html += '<div style="display: flex; align-items: center; gap: 8px;">';

    html += '<span class="carrito-item-subtotal">' + formatearMoneda(subtotal) + "</span>";

    html +=
      '<button class="btn-cantidad-carrito" onclick="disminuirCantidad(\'' +
      codigoEscapado +
      "')\">−</button>";

    html +=
      '<span class="cantidad-seleccionada" style="min-width: 36px;" onclick="editarCantidad(\'' +
      codigoEscapado +
      '\', this)" title="Editar cantidad">' +
      formatearNumero(item.cantidad) +
      "</span>";

    html +=
      '<button class="btn-cantidad-carrito" onclick="agregarAlCarrito(\'' +
      codigoEscapado +
      "')\">+</button>";

    html +=
      '<button class="btn-eliminar-item" onclick="eliminarItemCarrito(\'' +
      codigoEscapado +
      "')\">✕</button>";

    html += "</div>";
    html += "</li>";
  }

  carritoLista.innerHTML = html;

  btnPagar.disabled = false;

  calcularPago();
}

// ============================================
// CALCULO DE PAGO
// ============================================
function calcularPago() {
  const total = redondear3(carrito.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0,
  ));
  const efectivo = parsearNumero(efectivoInput.value);
  const transferencia = parsearNumero(transferenciaInput.value);

  const pagado = redondear3(efectivo + transferencia);
  const diferencia = redondear3(pagado - total);

  btnPagar.classList.remove("exacto", "falta", "vuelto");

  if (Math.abs(diferencia) < 1 / FACTOR_DECIMALES) {
    btnPagar.textContent = "Pagar ✓";
    btnPagar.classList.add("exacto");
    btnPagar.disabled = false;
  } else if (diferencia > 0) {
    btnPagar.textContent = `Vuelto ${formatearMoneda(diferencia)}`;
    btnPagar.classList.add("vuelto");
    btnPagar.disabled = false;
  } else {
    btnPagar.textContent = `Faltan ${formatearMoneda(Math.abs(diferencia))}`;
    btnPagar.classList.add("falta");
    btnPagar.disabled = true;
  }
}

// ============================================
// REFLEJAR VENTA EN STOCK LOCAL (UI + SQLite)
// ============================================
async function reflejarVentaEnStockLocal(productosVendidos) {
  if (!Array.isArray(productosVendidos) || productosVendidos.length === 0) return;

  var ahora = new Date().toISOString();

  for (var i = 0; i < productosVendidos.length; i++) {
    var vendido = productosVendidos[i];
    var prod = productos.find(function(p) {
      return String(p.codigo) === String(vendido.codigo);
    });

    if (!prod) continue;

    var stockActual = parsearNumero(prod.disponibilidad || prod.stock || 0);
    var cantidadVendida = parsearNumero(vendido.cantidad || 0);
    var nuevoStock = redondear3(Math.max(0, stockActual - cantidadVendida));

    if (Object.prototype.hasOwnProperty.call(prod, "disponibilidad")) {
      prod.disponibilidad = nuevoStock;
    } else {
      prod.stock = nuevoStock;
    }

    if (nuevoStock <= 0 && stockActual > 0) {
      var nombre = vendido.nombre || prod.producto || prod.nombre || "";
      if (DB.guardarStockAgotado) {
        DB.guardarStockAgotado(vendido.codigo, nombre, ahora).catch(function(e) {
          console.warn("Error guardando stock agotado:", e);
        });
      }
    }
  }

  renderizarProductos(productos);

  if (dbInicializado && DB.syncProductosLocal) {
    try {
      await DB.syncProductosLocal(productos);
    } catch (e) {
      console.log("No se pudo persistir stock local:", e.message);
    }
  }
}

// ============================================
// FINALIZAR VENTA (siempre offline)
// ============================================
async function finalizarVenta() {
  if (carrito.length === 0) {
    mostrarMensaje("Agrega productos al carrito", "error");
    return;
  }

  let efectivo = parsearNumero(efectivoInput.value);
  let transferencia = parsearNumero(transferenciaInput.value);
  const total = redondear3(carrito.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0,
  ));

  const pagado = redondear3(efectivo + transferencia);
  let vuelto = redondear3(pagado - total);

  if (vuelto < 0) {
    mostrarMensaje("Faltan " + formatearMoneda(Math.abs(vuelto)), "error");
    return;
  }

  if (vuelto > 0) {
    const confirmar = await mostrarModalVuelto(total, pagado, vuelto);

    if (!confirmar) {
      mostrarMensaje("Venta cancelada", "info", 2000);
      return;
    }

    if (efectivo >= vuelto) {
      efectivo = redondear3(efectivo - vuelto);
    } else {
      const restante = redondear3(vuelto - efectivo);
      efectivo = 0;
      transferencia = redondear3(Math.max(0, transferencia - restante));
    }

    efectivoInput.value = formatearNumero(efectivo);
    transferenciaInput.value = formatearNumero(transferencia);

    console.log("Vuelto entregado. Nuevo efectivo: " + formatearMoneda(efectivo));
  }

  const ventaData = {
    facturaId: DB.generarFacturaId ? DB.generarFacturaId() : Date.now().toString(),
    fechaHora: (function() {
      const f = new Date();
      return f.getFullYear() + '-' +
             String(f.getMonth()+1).padStart(2,'0') + '-' +
             String(f.getDate()).padStart(2,'0') + 'T' +
             String(f.getHours()).padStart(2,'0') + ':' +
             String(f.getMinutes()).padStart(2,'0') + ':' +
             String(f.getSeconds()).padStart(2,'0') + '.' +
             String(f.getMilliseconds()).padStart(3,'0');
    })(),
    pago: { efectivo, transferencia },
    productos: carrito.map((item) => ({
      codigo: item.codigo,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
      precio_costo: item.precio_costo || 0,
    })),
  };

  try {
    btnPagar.disabled = true;
    btnPagar.textContent = "Procesando...";

    var guardado = await DB.guardarVentaOffline(ventaData);

    if (guardado) {
      await reflejarVentaEnStockLocal(ventaData.productos);

      mostrarMensaje(
        "Venta guardada",
        "exito",
        3000,
      );
    } else {
      throw new Error("No se pudo guardar la venta");
    }

    carrito = [];
    efectivoInput.value = "0";
    transferenciaInput.value = "0";
    actualizarVistaCarrito();
    renderizarProductos(productos);
    reapplySearchFilter();
    cerrarCarrito();
  } catch (error) {
    console.error("Error:", error);
    mostrarMensaje(error.message, "error");
  } finally {
    btnPagar.disabled = false;
    calcularPago();
  }
}

// ============================================
// MERMA — MODAL Y PROCESAMIENTO
// ============================================

window.procesarMerma = function() {
  var menu = document.getElementById("menuDesplegable");
  if (menu) menu.classList.add("hidden");

  const productosConCantidad = carrito.filter(item => item.cantidad > 0);

  if (productosConCantidad.length === 0) {
    mostrarMensaje("No hay productos con cantidad > 0 en el carrito", "warning");
    return;
  }

  _productosMermaPendientes = productosConCantidad;

  var listaContainer = document.getElementById("modalMermaLista");
  if (listaContainer) {
    listaContainer.innerHTML = productosConCantidad.map(function(p) {
      var nombre = (p.nombre || "").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return '<div class="merma-item">' +
        '<span class="merma-item-nombre">' + nombre + '</span>' +
        '<span class="merma-item-cantidad">' + formatearNumero(p.cantidad) + ' uds</span>' +
        '</div>';
    }).join('');
  }

  var modal = document.getElementById("modalMerma");
  if (modal) modal.classList.remove("hidden");
};

function cerrarModalMerma() {
  var modal = document.getElementById("modalMerma");
  if (modal) modal.classList.add("hidden");
  _productosMermaPendientes = [];
}

window.confirmarMerma = async function() {
  var prodsMerma = _productosMermaPendientes;
  if (!Array.isArray(prodsMerma) || prodsMerma.length === 0) {
    cerrarModalMerma();
    mostrarMensaje("No hay productos para mermar", "warning");
    return;
  }

  const mermaData = {
    fechaHora: (function() {
      const f = new Date();
      return f.getFullYear() + '-' +
             String(f.getMonth()+1).padStart(2,'0') + '-' +
             String(f.getDate()).padStart(2,'0') + 'T' +
             String(f.getHours()).padStart(2,'0') + ':' +
             String(f.getMinutes()).padStart(2,'0') + ':' +
             String(f.getSeconds()).padStart(2,'0') + '.' +
             String(f.getMilliseconds()).padStart(3,'0');
    })(),
    productos: prodsMerma.map(function(item) {
      return {
        codigo: item.codigo,
        nombre: item.nombre,
        cantidad: item.cantidad,
      };
    })
  };

  try {
    cerrarModalMerma();
    mostrarMensaje("Guardando merma...", "info");

    var guardado = await DB.guardarMermaOffline(mermaData);

    if (!guardado) {
      throw new Error("No se pudo guardar la merma");
    }

    await reflejarMermaEnStockLocal(mermaData.productos);

    carrito = [];
    efectivoInput.value = "0";
    transferenciaInput.value = "0";
    actualizarVistaCarrito();
    renderizarProductos(productos);
    reapplySearchFilter();
    cerrarCarrito();

    mostrarMensaje(
      "✅ Merma guardada (" + prodsMerma.length + " productos)",
      "exito",
      3000
    );

  } catch (error) {
    console.error("Error en confirmarMerma:", error);
    mostrarMensaje(error.message, "error");
  }
}

// ============================================
// REFLEJAR MERMA EN STOCK LOCAL (UI + SQLite)
// ============================================
async function reflejarMermaEnStockLocal(productosMerma) {
  if (!Array.isArray(productosMerma) || productosMerma.length === 0) return;

  var ahora = new Date().toISOString();

  for (var i = 0; i < productosMerma.length; i++) {
    var merma = productosMerma[i];
    var prod = productos.find(function(p) {
      return String(p.codigo) === String(merma.codigo);
    });

    if (!prod) continue;

    var stockActual = parsearNumero(prod.disponibilidad || prod.stock || 0);
    var cantidadMerma = parsearNumero(merma.cantidad || 0);
    var nuevoStock = redondear3(Math.max(0, stockActual - cantidadMerma));

    if (Object.prototype.hasOwnProperty.call(prod, "disponibilidad")) {
      prod.disponibilidad = nuevoStock;
    } else {
      prod.stock = nuevoStock;
    }

    if (nuevoStock <= 0 && stockActual > 0) {
      var nombre = merma.nombre || prod.producto || prod.nombre || "";
      if (DB.guardarStockAgotado) {
        DB.guardarStockAgotado(merma.codigo, nombre, ahora).catch(function(e) {
          console.warn("Error guardando stock agotado:", e);
        });
      }
    }
  }

  renderizarProductos(productos);

  if (dbInicializado && DB.syncProductosLocal) {
    try {
      await DB.syncProductosLocal(productos);
    } catch (e) {
      console.log("No se pudo persistir stock local:", e.message);
    }
  }
}

// ============================================
// ABASTECER (reabastecer productos existentes - offline)
// ============================================

window.mostrarAbastecer = function() {
  var modal = document.getElementById("modalAbastecer");
  if (!modal) return;

  var searchInput = document.getElementById("abProductoSearch");
  var dropdown = document.getElementById("abProductoDropdown");
  var codigoInput = document.getElementById("abProductoCodigo");
  var infoDiv = document.getElementById("abProductoInfo");

  if (searchInput) searchInput.value = "";
  if (dropdown) {
    dropdown.innerHTML = "";
    dropdown.classList.add("hidden");
  }
  if (codigoInput) codigoInput.value = "";
  if (infoDiv) infoDiv.innerHTML = "";

  var cantidadInput = document.getElementById("abCantidad");
  if (cantidadInput) {
    cantidadInput.value = "1";
  }

  modal.classList.remove("hidden");
  if (searchInput) searchInput.focus();
};

function cerrarModalAbastecer() {
  var modal = document.getElementById("modalAbastecer");
  if (modal) {
    modal.classList.add("hidden");
  }
  var dropdown = document.getElementById("abProductoDropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filtrarProductosAbastecer(termino) {
  var dropdown = document.getElementById("abProductoDropdown");
  if (!dropdown) return;

  termino = termino.toLowerCase().trim();

  var resultados = [];
  for (var i = 0; i < productos.length; i++) {
    var p = productos[i];
    var nombre = (p.producto || p.nombre || "").toLowerCase();
    var codigo = (p.codigo || "").toLowerCase();
    if (nombre.includes(termino) || codigo.includes(termino)) {
      resultados.push(p);
    }
  }

  dropdown.innerHTML = "";
  if (resultados.length === 0) {
    dropdown.innerHTML = '<div class="dropdown-item" style="color: var(--text-secondary);">No se encontraron productos</div>';
  } else {
    for (let j = 0; j < resultados.length; j++) {
      const p = resultados[j];
      const codigo = p.codigo || "";
      const nombre = p.producto || p.nombre || "Producto";
      const stock = parsearNumero(p.disponibilidad || p.stock || 0);

      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.innerHTML = nombre + ' <span style="color: var(--text-secondary); font-size: 12px;">(Stock: ' + formatearNumero(stock) + ')</span>';
      item.dataset.codigo = codigo;
      item.addEventListener("click", function() {
        seleccionarProductoAbastecer(this.dataset.codigo, nombre, stock);
      });
      dropdown.appendChild(item);
    }
  }

  dropdown.classList.remove("hidden");
}

function seleccionarProductoAbastecer(codigo, nombre, stock) {
  var codigoInput = document.getElementById("abProductoCodigo");
  var searchInput = document.getElementById("abProductoSearch");
  var infoDiv = document.getElementById("abProductoInfo");
  var dropdown = document.getElementById("abProductoDropdown");

  if (codigoInput) codigoInput.value = codigo;
  if (searchInput) searchInput.value = nombre;
  if (infoDiv) {
    infoDiv.innerHTML = '<strong>' + nombre + '</strong><div class="stock-info">Stock actual: ' + formatearNumero(stock) + '</div>';
  }
  if (dropdown) dropdown.classList.add("hidden");
}

window.confirmarAbastecer = async function() {
  var codigoInput = document.getElementById("abProductoCodigo");
  var cantidadInput = document.getElementById("abCantidad");

  if (!codigoInput || !cantidadInput) return;

  var codigo = codigoInput.value;
  var cantidad = parsearNumero(cantidadInput.value);

  if (!codigo) {
    mostrarMensaje("Selecciona un producto", "error");
    return;
  }

  if (cantidad <= 0) {
    mostrarMensaje("La cantidad debe ser mayor a 0", "error");
    return;
  }

  var producto = productos.find(function(p) {
    return String(p.codigo) === String(codigo);
  });

  if (!producto) {
    mostrarMensaje("Producto no encontrado", "error");
    return;
  }

  var nombre = producto.producto || producto.nombre || "";

  try {
    mostrarMensaje("Procesando abastecimiento...", "info");

    var guardado = await DB.guardarAbastecerOffline({
      codigo: codigo,
      nombre: nombre,
      cantidad: cantidad
    });

    if (!guardado) {
      throw new Error("No se pudo guardar el abastecimiento");
    }

    productos = await DB.getProductosLocal();
    renderizarProductos(productos);

    cerrarModalAbastecer();

    mostrarMensaje(
      "Abastecido: " + nombre + " (+" + formatearNumero(cantidad) + ")",
      "exito",
      3000
    );

  } catch (error) {
    console.error("Error en abastecer:", error);
    mostrarMensaje("Error: " + error.message, "error");
  }
};

// Event listeners para abastecer
document.addEventListener("DOMContentLoaded", function() {
  var cancelarBtn = document.getElementById("btnCancelarAbastecer");
  if (cancelarBtn) {
    cancelarBtn.addEventListener("click", cerrarModalAbastecer);
  }

  var confirmarBtn = document.getElementById("btnConfirmarAbastecer");
  if (confirmarBtn) {
    confirmarBtn.addEventListener("click", function() {
      window.confirmarAbastecer();
    });
  }

  var modalAbastecer = document.getElementById("modalAbastecer");
  if (modalAbastecer) {
    modalAbastecer.addEventListener("click", function(e) {
      if (e.target === modalAbastecer) cerrarModalAbastecer();
    });
  }

  var searchInput = document.getElementById("abProductoSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function() {
      filtrarProductosAbastecer(this.value);
    });

    searchInput.addEventListener("focus", function() {
      filtrarProductosAbastecer(this.value);
    });

    searchInput.addEventListener("blur", function() {
      setTimeout(function() {
        var dropdown = document.getElementById("abProductoDropdown");
        if (dropdown) dropdown.classList.add("hidden");
      }, 200);
    });
  }
});

// ============================================
// GASTOS - Mostrar formulario
// ============================================
window.mostrarGasto = function() {
  var menu = document.getElementById("menuDesplegable");
  if (menu) menu.classList.add("hidden");

  var modal = document.getElementById("modalGasto");
  if (!modal) return;

  var hoy = new Date();
  var fechaISO = hoy.getFullYear() + '-' +
               String(hoy.getMonth()+1).padStart(2,'0') + '-' +
               String(hoy.getDate()).padStart(2,'0');
  document.getElementById("gastoFecha").value = fechaISO;

  document.getElementById("gastoDescripcion").value = "";
  document.getElementById("gastoMonto").value = "";

  modal.classList.remove("hidden");
  document.getElementById("gastoDescripcion").focus();
};

function cerrarModalGasto() {
  var modal = document.getElementById("modalGasto");
  if (modal) modal.classList.add("hidden");
}

window.confirmarGasto = async function() {
  var descripcion = document.getElementById("gastoDescripcion").value.trim();
  var monto = parsearNumero(document.getElementById("gastoMonto").value);
  var fecha = document.getElementById("gastoFecha").value;

  if (!descripcion) {
    mostrarMensaje("Ingresá una descripción del gasto", "error");
    document.getElementById("gastoDescripcion").focus();
    return;
  }

  if (monto <= 0) {
    mostrarMensaje("El monto debe ser mayor a 0", "error");
    document.getElementById("gastoMonto").focus();
    return;
  }

  try {
    mostrarMensaje("Guardando gasto...", "info");

    var guardado = await DB.guardarGastoOffline({
      fecha: fecha,
      descripcion: descripcion,
      monto: monto
    });

    if (!guardado) {
      throw new Error("No se pudo guardar el gasto");
    }

    cerrarModalGasto();

    mostrarMensaje(
      "Gasto registrado: $" + formatearNumero(monto) + " - " + descripcion,
      "exito",
      3000
    );

  } catch (error) {
    console.error("Error guardando gasto:", error);
    mostrarMensaje("Error: " + error.message, "error");
  }
};

// Event listeners para gastos
document.addEventListener("DOMContentLoaded", function() {
  var cancelarBtn = document.getElementById("btnCancelarGasto");
  if (cancelarBtn) {
    cancelarBtn.addEventListener("click", cerrarModalGasto);
  }

  var confirmarBtn = document.getElementById("btnConfirmarGasto");
  if (confirmarBtn) {
    confirmarBtn.addEventListener("click", function() {
      window.confirmarGasto();
    });
  }

  var modalGasto = document.getElementById("modalGasto");
  if (modalGasto) {
    modalGasto.addEventListener("click", function(e) {
      if (e.target === modalGasto) cerrarModalGasto();
    });
  }

  var montoInput = document.getElementById("gastoMonto");
  if (montoInput) {
    montoInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        window.confirmarGasto();
      }
    });
  }
});

// Event listeners para merma
document.addEventListener("DOMContentLoaded", function() {
  var cancelarBtn = document.getElementById("btnCancelarMerma");
  if (cancelarBtn) {
    cancelarBtn.addEventListener("click", cerrarModalMerma);
  }

  var confirmarBtn = document.getElementById("btnConfirmarMerma");
  if (confirmarBtn) {
    confirmarBtn.addEventListener("click", function() {
      window.confirmarMerma();
    });
  }

  var modalMerma = document.getElementById("modalMerma");
  if (modalMerma) {
    modalMerma.addEventListener("click", function(e) {
      if (e.target === modalMerma) cerrarModalMerma();
    });
  }
});

// ============================================
// GENERAR FACTURA ID
// ============================================
// ============================================
// UTILIDADES
// ============================================
var mensajeTimeoutId = null;

function mostrarMensaje(texto, tipo, duracion = 3000) {
  if (mensajeTimeoutId) {
    clearTimeout(mensajeTimeoutId);
    mensajeTimeoutId = null;
  }

  mensajeDiv.textContent = texto;
  mensajeDiv.className = `mensaje ${tipo}`;
  mensajeDiv.classList.remove("hidden");

  if (duracion > 0) {
    mensajeTimeoutId = setTimeout(() => {
      mensajeDiv.classList.add("hidden");
      mensajeTimeoutId = null;
    }, duracion);
  }
}

window.toggleCarrito = () => {
  const ahora = Date.now();
  if (ahora - ultimoToggleCarritoTs < 220) return;
  ultimoToggleCarritoTs = ahora;

  const contenido = document.getElementById("carritoContenido");
  const icono = document.getElementById("carritoIcono");
  contenido.classList.toggle("abierto");
  icono.classList.toggle("abierto");
};

window.cerrarCarrito = () => {
  const contenido = document.getElementById("carritoContenido");
  const icono = document.getElementById("carritoIcono");
  contenido.classList.remove("abierto");
  icono.classList.remove("abierto");
};

if (modalCancelar) {
  modalCancelar.addEventListener("click", () => cerrarModalVuelto(false));
}

if (modalConfirmar) {
  modalConfirmar.addEventListener("click", () => cerrarModalVuelto(true));
}

if (modalVuelto) {
  modalVuelto.addEventListener("click", (e) => {
    if (e.target === modalVuelto) cerrarModalVuelto(false);
  });
}

document.addEventListener("keydown", (e) => {
  if (!modalVuelto || modalVuelto.classList.contains("hidden")) return;
  if (e.key === "Escape") cerrarModalVuelto(false);
  if (e.key === "Enter") cerrarModalVuelto(true);
});

// ============================================
// FILTRO DE BÚSQUEDA
// ============================================
function reapplySearchFilter() {
  const termino = searchInput.value.toLowerCase().trim();
  if (termino) {
    ultimoTermino = "";
    aplicarFiltro(termino);
  }
}

function toggleClearButton() {
  if (searchInput.value.length > 0) {
    searchClear.classList.remove("hidden");
  } else {
    searchClear.classList.add("hidden");
  }
}

function limpiarBusqueda() {
  searchInput.value = "";
  toggleClearButton();
  renderizarProductos(productos);
}

if (searchClear) {
  searchClear.addEventListener("click", limpiarBusqueda);
}

const FILTRO_DEBOUNCE_MS = 140;
let filtroTimer = null;
let filtroRaf = 0;
let ultimoTermino = "";

function aplicarFiltro(termino) {
  if (termino === ultimoTermino) return;
  ultimoTermino = termino;

  const filtrados = productos.filter(
    (p) =>
      (p.producto || p.nombre || "").toLowerCase().includes(termino) ||
      (p.codigo || "").toString().includes(termino),
  );

  renderizarProductos(filtrados);
}

searchInput.addEventListener("input", (e) => {
  const termino = e.target.value.toLowerCase().trim();
  toggleClearButton();

  if (filtroTimer) {
    clearTimeout(filtroTimer);
  }

  if (!productosContainer.classList.contains("filtrando")) {
    productosContainer.classList.add("filtrando");
  }

  filtroTimer = setTimeout(() => {
    if (filtroRaf) {
      cancelAnimationFrame(filtroRaf);
    }

    filtroRaf = requestAnimationFrame(() => {
      aplicarFiltro(termino);
      setTimeout(() => {
        productosContainer.classList.remove("filtrando");
      }, 160);
    });
  }, FILTRO_DEBOUNCE_MS);
});

// ============================================
// EVENT LISTENERS
// ============================================
efectivoInput.addEventListener("input", calcularPago);
transferenciaInput.addEventListener("input", calcularPago);

efectivoInput.addEventListener("focus", function() {
  if (parsearNumero(this.value) === 0) {
    this.value = "";
  }
});
transferenciaInput.addEventListener("focus", function() {
  if (parsearNumero(this.value) === 0) {
    this.value = "";
  }
});

efectivoInput.addEventListener("blur", function() {
  if (this.value === "") {
    this.value = "0";
  } else {
    this.value = formatearNumero(parsearNumero(this.value));
  }
});
transferenciaInput.addEventListener("blur", function() {
  if (this.value === "") {
    this.value = "0";
  } else {
    this.value = formatearNumero(parsearNumero(this.value));
  }
});

btnPagar.addEventListener("click", finalizarVenta);

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener("DOMContentLoaded", async function() {
  console.log("App iniciada");

  // ===== SISTEMA DE ACTIVACIÓN =====
  var activado = false;
  if (DB.isActivated) {
    activado = await DB.isActivated();
  }
  console.log("[Activacion] Dispositivo activado:", activado);

  var proteccionBloqueo = document.getElementById("proteccionBloqueo");

  if (!activado) {
    if (proteccionBloqueo) {
      proteccionBloqueo.classList.remove("hidden");
    }

    if (DB.generateDeviceId) {
      var deviceId = await DB.generateDeviceId();
      var idEl = document.getElementById("proteccionDeviceId");
      if (idEl) idEl.textContent = deviceId;
    }

    return;
  } else {
    if (proteccionBloqueo) {
      proteccionBloqueo.classList.add("hidden");
    }
  }

  // Inicializar SQLite solo en APK
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    dbInicializado = await DB.initDatabase();
    console.log("SQLite inicializado:", dbInicializado);
    

    // Limpieza de ventas antiguas (fire-and-forget, no bloquea UI)
    if (dbInicializado && DB.limpiarVentasAntiguas) {
      DB.limpiarVentasAntiguas().catch(function(e) {
        console.warn("Error en limpieza automática:", e);
      });
    }
  }

  await cargarProductos();
  actualizarVistaCarrito();
});

// ============================================
// MOSTRAR RESUMEN DEL DÍA (offline desde SQLite)
// ============================================
window.mostrarResumen = async function() {
  var acceso = await verificarPassword();
  if (!acceso) return;

  var modalResumen = document.getElementById("modalResumen");
  if (!modalResumen) return;

  modalResumen.classList.remove("hidden");

  var inputInicio = document.getElementById("inputFechaResumenInicio");
  var inputFin = document.getElementById("inputFechaResumenFin");
  var hoy = new Date();
  var hoyISO = hoy.getFullYear() + '-' +
               String(hoy.getMonth()+1).padStart(2,'0') + '-' +
               String(hoy.getDate()).padStart(2,'0');
  if (inputInicio && !inputInicio.value) inputInicio.value = hoyISO;
  if (inputFin && !inputFin.value) inputFin.value = hoyISO;

  cargarResumen();
};

// ============================================
// CARGAR DATOS DEL RESUMEN (solo desde base local)
// ============================================
window.cargarResumen = async function() {
  var inputInicio = document.getElementById("inputFechaResumenInicio");
  var inputFin = document.getElementById("inputFechaResumenFin");
  var fechaInicio = inputInicio ? inputInicio.value : "";
  var fechaFin = inputFin ? inputFin.value : "";

  if (!fechaInicio || !fechaFin) return;

  var tituloEl = document.getElementById("modalResumenTitulo");
  if (tituloEl) {
    if (fechaInicio === fechaFin) {
      tituloEl.textContent = "Resumen - " + fechaInicio;
    } else {
      tituloEl.textContent = "Resumen " + fechaInicio + " → " + fechaFin;
    }
  }

  var totalEl = document.getElementById("resumenTotal");
  var efectivoEl = document.getElementById("resumenEfectivo");
  var transferenciaEl = document.getElementById("resumenTransferencia");
  var inversionEl = document.getElementById("resumenInversion");
  var gananciaEl = document.getElementById("resumenGanancia");
  var listaEl = document.getElementById("listaProductosResumen");

  if (totalEl) totalEl.textContent = "...";
  if (efectivoEl) efectivoEl.textContent = "...";
  if (transferenciaEl) transferenciaEl.textContent = "...";
  if (inversionEl) inversionEl.textContent = "...";
  if (gananciaEl) gananciaEl.textContent = "...";
  if (listaEl) listaEl.innerHTML = '<li class="info">Cargando resumen...</li>';

  if (dbInicializado && DB.getResumenOffline) {
    console.log("Cargando resumen");

    try {
      var data = await DB.getResumenOffline(fechaInicio, fechaFin);

      actualizarResumenUI(data);
      return;
    } catch (error) {
      console.error("Error:", error);
    }
  }

  if (listaEl) listaEl.innerHTML = '<li class="error">Error al cargar resumen</li>';
};

// ============================================
// ACTUALIZAR UI DEL RESUMEN
// ============================================
function actualizarResumenUI(data) {
  var totalEl = document.getElementById("resumenTotal");
  var efectivoEl = document.getElementById("resumenEfectivo");
  var transferenciaEl = document.getElementById("resumenTransferencia");
  var inversionEl = document.getElementById("resumenInversion");
  var gananciaEl = document.getElementById("resumenGanancia");
  var listaEl = document.getElementById("listaProductosResumen");
  var totalGastosEl = document.getElementById("resumenTotalGastos");
  var listaGastosEl = document.getElementById("listaGastosResumen");
  var gastosTitulo = document.getElementById("gastosTitulo");
  var totalMermasEl = document.getElementById("resumenTotalMermas");
  var listaMermasEl = document.getElementById("listaMermasResumen");
  var mermasTitulo = document.getElementById("mermasTitulo");

  if (totalEl) totalEl.textContent = formatearMoneda(data.totalIngresado || 0);
  if (efectivoEl) efectivoEl.textContent = formatearMoneda(data.efectivo || 0);
  if (transferenciaEl) transferenciaEl.textContent = formatearMoneda(data.transferencia || 0);

  if (inversionEl) inversionEl.textContent = formatearMoneda(data.totalInversion || 0);
  if (gananciaEl) gananciaEl.textContent = formatearMoneda(data.totalGanancia || 0);

  if (gananciaEl) {
    var ganancia = data.totalGanancia || 0;
    if (ganancia > 0) {
      gananciaEl.style.color = "#81c995";
    } else if (ganancia < 0) {
      gananciaEl.style.color = "#f28b82";
    } else {
      gananciaEl.style.color = "var(--text-primary)";
    }
  }

  var totalGastos = data.totalGastos || 0;
  if (totalGastosEl) totalGastosEl.textContent = formatearMoneda(totalGastos);
  if (listaGastosEl && gastosTitulo) {
    var gastos = data.gastos || [];
    if (gastos.length === 0) {
      listaGastosEl.innerHTML = "";
      gastosTitulo.classList.add("hidden");
    } else {
      gastosTitulo.classList.remove("hidden");
      var html = "";
      for (var j = 0; j < gastos.length; j++) {
        var g = gastos[j];
        html += '<li class="resumen-gasto-item">';
        html += '<span class="gasto-descripcion">' + (g.descripcion || "Gasto") + '</span>';
        html += '<span class="gasto-monto">' + formatearMoneda(g.monto || 0) + '</span>';
        html += '</li>';
      }
      listaGastosEl.innerHTML = html;
    }
  }

  var totalMermas = data.totalMermas || 0;
  if (totalMermasEl) totalMermasEl.textContent = formatearMoneda(totalMermas);
  if (listaMermasEl && mermasTitulo) {
    var mermas = data.mermas || [];
    if (mermas.length === 0) {
      listaMermasEl.innerHTML = "";
      mermasTitulo.classList.add("hidden");
    } else {
      mermasTitulo.classList.remove("hidden");
      var mHtml = "";
      for (var mi = 0; mi < mermas.length; mi++) {
        var m = mermas[mi];
        mHtml += '<li class="resumen-merma-item">';
        mHtml += '<span class="gasto-descripcion">' + (m.descripcion || "Producto") + '</span>';
        mHtml += '<span class="gasto-monto">' + formatearMoneda(m.monto || 0) + '</span>';
        mHtml += '</li>';
      }
      listaMermasEl.innerHTML = mHtml;
    }
  }

  if (listaEl) {
    if (!data.productosVendidos || data.productosVendidos.length === 0) {
      listaEl.innerHTML = '<li class="info">No hay ventas en el período</li>';
    } else {
      var html = "";
      for (var i = 0; i < data.productosVendidos.length; i++) {
        var p = data.productosVendidos[i];
        html += '<li>';
        html += '<span class="producto-nombre">' + p.nombre + '</span>';
        html += '<span class="producto-cantidad">' + formatearNumero(p.cantidad || 0) + 'u</span>';
        html += '<span class="producto-total">' + formatearMoneda(p.total || 0) + '</span>';
        html += '</li>';
      }
      listaEl.innerHTML = html;
    }
  }

  var stockAgotadosEl = document.getElementById("listaStockAgotados");
  var stockAgotadosTitulo = document.getElementById("stockAgotadosTitulo");
  if (stockAgotadosEl && stockAgotadosTitulo) {
    var stockAgotados = data.stockAgotados || [];
    if (stockAgotados.length === 0) {
      stockAgotadosEl.innerHTML = "";
      stockAgotadosTitulo.classList.add("hidden");
    } else {
      stockAgotadosTitulo.classList.remove("hidden");
      var saHtml = "";
      for (var k = 0; k < stockAgotados.length; k++) {
        var sa = stockAgotados[k];
        saHtml += '<li class="resumen-stock-agotado-item">';
        saHtml += '<span class="producto-nombre">' + (sa.nombre || "Producto") + '</span>';
        saHtml += '<span class="stock-agotado-fecha">' + (sa.fecha || "") + '</span>';
        saHtml += '</li>';
      }
      stockAgotadosEl.innerHTML = saHtml;
    }
  }
}

// ============================================
// CERRAR MODAL RESUMEN
// ============================================
function cerrarModalResumen() {
  var modalResumen = document.getElementById("modalResumen");
  if (modalResumen) {
    modalResumen.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var cerrarBtn = document.getElementById("modalCerrarResumen");
  if (cerrarBtn) {
    cerrarBtn.addEventListener("click", cerrarModalResumen);
  }

  var modalR = document.getElementById("modalResumen");
  if (modalR) {
    modalR.addEventListener("click", function(e) {
      if (e.target === modalR) cerrarModalResumen();
    });
  }

  var inputFechaInicio = document.getElementById("inputFechaResumenInicio");
  var inputFechaFin = document.getElementById("inputFechaResumenFin");

  function onFechaResumenChange() {
    window.cargarResumen();
  }

  if (inputFechaInicio) {
    inputFechaInicio.addEventListener("change", onFechaResumenChange);
  }
  if (inputFechaFin) {
    inputFechaFin.addEventListener("change", onFechaResumenChange);
  }
});

// ============================================
// HISTORIAL DE VENTAS
// ============================================

window.mostrarHistorialVentas = async function(fechaISO) {
  var acceso = await verificarPassword();
  if (!acceso) return;

  var modalHistorial = document.getElementById("modalHistorial");
  if (!modalHistorial) return;

  modalHistorial.classList.remove("hidden");

  var inputFecha = document.getElementById("inputFechaHistorial");
  if (inputFecha && !inputFecha.value) {
    var hoy = new Date();
    var hoyISO = hoy.getFullYear() + '-' +
               String(hoy.getMonth()+1).padStart(2,'0') + '-' +
               String(hoy.getDate()).padStart(2,'0');
    inputFecha.value = hoyISO;
  }

  await cargarHistorial(inputFecha ? inputFecha.value : fechaISO);
};

async function cargarHistorial(fechaISO) {
  var contenedor = document.getElementById("contenidoHistorial");
  if (!contenedor) return;

  contenedor.innerHTML = '<div class="loading">Cargando historial...</div>';

  try {
    if (!DB.getVentasAgrupadasPorFactura) {
      contenedor.innerHTML = '<div class="error">Función no disponible</div>';
      return;
    }

    var facturas = await DB.getVentasAgrupadasPorFactura(fechaISO);

    if (facturas.length === 0) {
      contenedor.innerHTML = '<div class="info">No hay ventas para esta fecha</div>';
      return;
    }

    var html = "";

    for (var i = 0; i < facturas.length; i++) {
      var f = facturas[i];
      var estadoClass = "synced";

      html += '<div class="historial-factura ' + estadoClass + '">';
      html += '<div class="historial-factura-header">';
      html += '<div class="historial-factura-info">';
      html += '<span class="historial-factura-id">Factura: ' + f.facturaId + '</span>';
      html += '<span class="historial-factura-fecha">' + (f.fechaHora ? new Date(f.fechaHora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: true }) : "") + '</span>';
      html += '</div>';
      html += '<div class="historial-factura-estado">';

      html += '<button class="btn-deshacer" onclick="deshacerVentaConfirmar(\'' + f.facturaId.replace(/'/g, "\\'") + '\')" title="Deshacer venta">Deshacer</button>';

      html += '</div>';
      html += '</div>';

      html += '<div class="historial-productos">';
      html += '<table class="historial-tabla">';
      html += '<thead><tr><th>Producto</th><th>Cant</th><th>P. Unit</th><th>Subtotal</th></tr></thead>';
      html += '<tbody>';

      for (var j = 0; j < f.productos.length; j++) {
        var p = f.productos[j];
        html += '<tr>';
        html += '<td>' + (p.nombre || "") + '</td>';
        html += '<td class="text-center">' + formatearNumero(p.cantidad) + '</td>';
        html += '<td class="text-right">' + formatearMoneda(p.precio) + '</td>';
        html += '<td class="text-right">' + formatearMoneda(p.subtotal) + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table>';
      html += '</div>';

      html += '<div class="historial-factura-total">';
      html += '<span>Total: ' + formatearMoneda(f.total) + '</span>';
      html += '<span>';
      if (f.efectivo > 0) html += 'Ef: ' + formatearMoneda(f.efectivo) + ' ';
      if (f.transferencia > 0) html += 'Trans: ' + formatearMoneda(f.transferencia);
      html += '</span>';
      html += '</div>';

      html += '</div>';
    }

    contenedor.innerHTML = html;

  } catch (error) {
    console.error("Error cargando historial:", error);
    contenedor.innerHTML = '<div class="error">Error al cargar historial</div>';
  }
}

window.deshacerVentaConfirmar = async function(facturaId) {
  if (!confirm("Estás seguro de deshacer esta venta?\n\nSe revertirán los cambios en el stock.")) {
    return;
  }

  try {
    mostrarMensaje("Deshaciendo venta...", "info");

    if (!DB.deshacerVenta) {
      mostrarMensaje("Función no disponible", "error");
      return;
    }

    var resultado = await DB.deshacerVenta(facturaId);

    if (resultado.success) {
      mostrarMensaje("Venta deshecha correctamente", "exito", 3000);

      await cargarProductos();

      var inputFecha = document.getElementById("inputFechaHistorial");
      if (inputFecha) {
        await cargarHistorial(inputFecha.value);
      }

    } else {
      mostrarMensaje(resultado.error || "Error deshaciendo venta", "error");
    }

  } catch (error) {
    console.error("Error deshaciendo venta:", error);
    mostrarMensaje("Error: " + error.message, "error");
  }
};

function cerrarModalHistorial() {
  var modalHistorial = document.getElementById("modalHistorial");
  if (modalHistorial) {
    modalHistorial.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", function() {
  var cerrarBtn = document.getElementById("modalCerrarHistorial");
  if (cerrarBtn) {
    cerrarBtn.addEventListener("click", cerrarModalHistorial);
  }

  var modalH = document.getElementById("modalHistorial");
  if (modalH) {
    modalH.addEventListener("click", function(e) {
      if (e.target === modalH) cerrarModalHistorial();
    });
  }

  var inputFechaHistorial = document.getElementById("inputFechaHistorial");
  if (inputFechaHistorial) {
    inputFechaHistorial.addEventListener("change", function(e) {
      var fechaSeleccionada = e.target.value;
      if (fechaSeleccionada) {
        cargarHistorial(fechaSeleccionada);
      }
    });
  }
});

// ============================================
// MENÚ DESPLEGABLE
// ============================================
function toggleMenu() {
  const menu = document.getElementById("menuDesplegable");
  if (menu) menu.classList.toggle("hidden");
}

document.addEventListener("click", function (e) {
  const menu = document.getElementById("menuDesplegable");
  const btn = document.getElementById("btnMenu");
  if (menu && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.classList.add("hidden");
  }
});

// ============================================
// NUEVO PRODUCTO - MOSTRAR FORMULARIO
// ============================================
window.mostrarFormularioProducto = async function() {
  const modal = document.getElementById("modalNuevoProducto");
  const menu = document.getElementById("menuDesplegable");

  if (!modal) return;

  if (menu) menu.classList.add("hidden");

  try {
    if (DB.getUltimoCodigoProducto) {
      var codigo = await DB.getUltimoCodigoProducto();
      document.getElementById("npCodigo").value = codigo;
    }
  } catch (e) {
    console.error("Error generando código:", e);
    document.getElementById("npCodigo").value = "Pr_00001";
  }

  var hoy = new Date();
  var fechaISO = hoy.getFullYear() + '-' +
               String(hoy.getMonth()+1).padStart(2,'0') + '-' +
               String(hoy.getDate()).padStart(2,'0');
  document.getElementById("npFecha").value = fechaISO;

  document.getElementById("npNombre").value = "";
  document.getElementById("npCantidad").value = "0";
  document.getElementById("npPrecioVenta").value = "0";
  document.getElementById("npPrecioCosto").value = "0";

  modal.classList.remove("hidden");
  document.getElementById("npNombre").focus();
};

function cerrarFormularioProducto() {
  const modal = document.getElementById("modalNuevoProducto");
  if (modal) modal.classList.add("hidden");
}

// ============================================
// EVENT LISTENERS PARA FORMULARIO DE NUEVO PRODUCTO
// ============================================
document.addEventListener("DOMContentLoaded", function() {
  var btnCancelar = document.getElementById("btnCancelarProducto");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", cerrarFormularioProducto);
  }

  var btnGuardar = document.getElementById("btnGuardarProducto");
  if (btnGuardar) {
    btnGuardar.addEventListener("click", async function() {
      var codigo = document.getElementById("npCodigo").value.trim();
      var nombre = document.getElementById("npNombre").value.trim();
      var cantidad = parsearNumero(document.getElementById("npCantidad").value);
      var precioVenta = parsearNumero(document.getElementById("npPrecioVenta").value);

      if (!nombre) {
        mostrarMensaje("El nombre es requerido", "error");
        return;
      }

      if (precioVenta <= 0) {
        mostrarMensaje("El precio debe ser mayor a 0", "error");
        return;
      }

      try {
        var guardado = await DB.guardarEntradaProductoCompleto({
          codigo: codigo,
          nombre: nombre,
          precioVenta: precioVenta,
          precioCosto: parsearNumero(document.getElementById("npPrecioCosto").value),
          cantidad: cantidad
        });

        if (guardado) {
          var precioCosto = parsearNumero(document.getElementById("npPrecioCosto").value);
          productos.push({
            codigo: codigo,
            producto: nombre,
            precio: precioVenta,
            disponibilidad: cantidad,
            precio_costo: precioCosto
          });
          renderizarProductos(productos);
          cerrarFormularioProducto();
          mostrarMensaje(nombre + " agregado", "exito", 3000);
        } else {
          mostrarMensaje("Error guardando", "error");
        }
      } catch (e) {
        mostrarMensaje("Error: " + e.message, "error");
      }
    });
  }

  var modalNuevo = document.getElementById("modalNuevoProducto");
  if (modalNuevo) {
    modalNuevo.addEventListener("click", function(e) {
      if (e.target === modalNuevo) cerrarFormularioProducto();
    });
  }

  document.addEventListener("keydown", function(e) {
    if (!modalNuevo) return;
    if (!modalNuevo.classList.contains("hidden") && e.key === "Escape") {
      cerrarFormularioProducto();
    }
  });

  var npCantidad = document.getElementById("npCantidad");
  var npPrecioVenta = document.getElementById("npPrecioVenta");
  var npPrecioCosto = document.getElementById("npPrecioCosto");

  [npCantidad, npPrecioVenta, npPrecioCosto].forEach(function(input) {
    if (!input) return;

    input.addEventListener("focus", function() {
      if (parsearNumero(this.value) === 0) {
        this.value = "";
      }
    });

    input.addEventListener("blur", function() {
      if (this.value === "") {
        this.value = "0";
      } else {
        this.value = formatearNumero(parsearNumero(this.value));
      }
    });
  });
});

// ============================================
// SISTEMA DE ACTIVACIÓN DE DISPOSITIVOS
// ============================================

window.copiarDeviceId = async function() {
  var idEl = document.getElementById("proteccionDeviceId");
  if (!idEl) return;

  try {
    await navigator.clipboard.writeText(idEl.textContent);
    mostrarMensaje("ID copiado al portapapeles", "exito", 2000);
  } catch (e) {
    var range = document.createRange();
    range.selectNodeContents(idEl);
    var selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    mostrarMensaje("Seleccioná el ID y copialo", "info", 2000);
  }
};

window.ejecutarActivacion = async function() {
  var claveInput = document.getElementById("proteccionClaveInput");
  var btnActivar = document.getElementById("btnActivar");
  var errorEl = document.getElementById("proteccionError");
  var cargandoEl = document.getElementById("proteccionCargando");
  var exitoEl = document.getElementById("proteccionExito");
  var idEl = document.getElementById("proteccionDeviceId");

  if (!claveInput || !btnActivar || !errorEl || !cargandoEl || !exitoEl) return;

  var clave = claveInput.value.trim();
  if (!clave) {
    errorEl.textContent = "Ingresá la clave de activación";
    errorEl.classList.remove("hidden");
    return;
  }

  errorEl.classList.add("hidden");

  btnActivar.disabled = true;
  cargandoEl.classList.remove("hidden");

  try {
    var valida = await DB.verificarClave(clave);

    if (valida) {
      await DB.guardarActivacion();

      cargandoEl.classList.add("hidden");
      exitoEl.classList.remove("hidden");

      setTimeout(function() {
        location.reload();
      }, 1500);
    } else {
      cargandoEl.classList.add("hidden");
      btnActivar.disabled = false;
      errorEl.textContent = "Clave incorrecta. Verificá con el administrador.";
      errorEl.classList.remove("hidden");
      claveInput.value = "";
      claveInput.focus();
    }
  } catch (e) {
    console.error("[Activacion] Error:", e);
    cargandoEl.classList.add("hidden");
    btnActivar.disabled = false;
    errorEl.textContent = "Error al verificar: " + e.message;
    errorEl.classList.remove("hidden");
  }
};

document.addEventListener("DOMContentLoaded", function() {
  var inputs = document.querySelectorAll(".proteccion-input");
  inputs.forEach(function(input) {
    input.addEventListener("input", function(e) {
      var val = this.value.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
      var formatted = "";
      for (var i = 0; i < val.length && i < 16; i++) {
        if (i > 0 && i % 4 === 0) formatted += "-";
        formatted += val[i];
      }
      this.value = formatted;
    });
  });
});

document.addEventListener("DOMContentLoaded", function() {
  var bloqueoInput = document.getElementById("proteccionClaveInput");
  if (bloqueoInput) {
    bloqueoInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        ejecutarActivacion();
      }
    });
  }
});
