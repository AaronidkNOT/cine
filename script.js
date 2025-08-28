// Variable global para guardar el ID de la película que se está mostrando
let peliculaActualId = null;

// Objeto de precios para los combos
const PRECIOS = {
    entradas: 0,
};

// --- Lógica que se ejecuta cuando la página carga ---
document.addEventListener('DOMContentLoaded', () => {
    cargarPeliculaActual();
    cargarProximosEstrenos();
    
    // Nuevo: Lógica para el menú de hamburguesa
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links-container');
    
    if (menuToggle && navLinksContainer) {
        menuToggle.addEventListener('click', () => {
            navLinksContainer.classList.toggle('active');
            menuToggle.classList.toggle('active'); // Esto maneja la transformación del icono a "X"
        });
    }
});


    //  Lógica para el botón de compra
    const botonComprar = document.querySelector('.boton-comprar');
    if (pelicula.stock <= 0) {
        botonComprar.disabled = true;
        botonComprar.textContent = 'Entradas Agotadas';
        botonComprar.classList.add('agotado');
    } else {
        botonComprar.disabled = false;
        botonComprar.textContent = 'Comprar Entradas';
        botonComprar.classList.remove('agotado');
    }

// --- Lógica de compra segura y con descuento de stock ---
async function finalizarCompra() {
    const botonConfirmar = document.querySelector('.boton-finalizar');
    botonConfirmar.disabled = true;
    botonConfirmar.textContent = 'Procesando...';

    const cantidadComprar = parseInt(document.getElementById('entradas').value);

    if (cantidadComprar <= 0) {
        alert("Debes seleccionar al menos una entrada para continuar.");
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = 'Confirmar y Generar QR';
        return;
    }
    
    try {
        // 1. Intentamos "comprar" en el backend para descontar el stock
        const response = await fetch('http://localhost:3000/api/comprar-entradas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                peliculaId: peliculaActualId,
                cantidad: cantidadComprar
            })
        });

        const resultado = await response.json();

        if (!response.ok) {
            // Si el backend dice que no hay stock, mostramos el error
            throw new Error(`${resultado.mensaje} Solo quedan ${resultado.stockRestante}.`);
        }

        // 2. Si la compra fue exitosa, generamos el QR
        const precioTotal = cantidadComprar * PRECIOS.entradas;
        const precioTotalTexto = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(precioTotal);
        
        // Generar un ID único de compra
        const compraId = `C${Date.now()}${Math.floor(Math.random() * 1000)}`;

        // Generar el QR solo con el ID
        generarQR(compraId);

        // Mostrar un resumen más legible en pantalla
        const resumenQR = document.getElementById('resumen-qr');
        resumenQR.innerHTML = `<strong>¡Compra Exitosa!</strong><br>
        Código: ${compraId}<br>
        ${cantidadComprar} Entradas - Total ${precioTotalTexto}`;

        
        document.getElementById('modal-compra').style.display = 'none';
        document.getElementById('modal-qr').style.display = 'block';

        // 3. Actualizamos la vista con el nuevo stock
        document.getElementById('pelicula-stock').textContent = resultado.stockRestante;

    } catch (error) {
        console.error('Error en la compra:', error);
        alert(`Error: ${error.message}`);
    } finally {
        // Reactivamos el botón al final
        botonConfirmar.disabled = false;
        botonConfirmar.textContent = 'Confirmar y Generar QR';
    }
}

// --- Funciones del Modal y Carrito ---
function abrirModalCompra() {
    const modal = document.getElementById('modal-compra');
    if (modal) {
        modal.style.display = 'block';
        actualizarCarrito();
    }
}

function cerrarModalCompra() {
    const modal = document.getElementById('modal-compra');
    if (modal) modal.style.display = 'none';
}

function actualizarCarrito() {
    const listaCarrito = document.getElementById('lista-carrito');
    const precioTotalEl = document.getElementById('precio-total');
    let total = 0;
    listaCarrito.innerHTML = ''; 

    const cantidadEntradas = parseInt(document.getElementById('entradas').value);

    if (cantidadEntradas > 0) {
        const costo = cantidadEntradas * PRECIOS.entradas;
        total += costo;
        listaCarrito.innerHTML += `<li>${cantidadEntradas} x Entradas - $${costo}</li>`;
    }

    if (listaCarrito.innerHTML === '') {
        listaCarrito.innerHTML = '<li>Tu carrito está vacío.</li>';
    }
    precioTotalEl.textContent = `$${total}`;
}

document.querySelectorAll('#modal-compra input[type="number"]').forEach(input => {
    if(input) input.addEventListener('change', actualizarCarrito);
});
// Funciones del modal de detalles


function verTrailerPrincipal() {
    // Si la película principal tiene un ID, reutiliza la función para mostrar los detalles
peliculaActualId = mostrarDetallesPelicula(peliculaActualId);
}

function cerrarModalDetalles() {
    const modal = document.getElementById('modal-detalles');
    if (modal) {
        modal.style.display = 'none';
        document.getElementById('modal-iframe-trailer').src = ''; // Detener la reproducción
    }
}

// --- Funciones del Carrusel y QR ---
function iniciarCarrusel(pelicula) {
    const carouselContainer = document.querySelector('.poster-carousel');
    const imagesContainer = document.querySelector('.carousel-images');
    const dotsContainer = document.querySelector('.carousel-dots');
    const prevBtn = document.querySelector('.carousel-btn.prev');
    const nextBtn = document.querySelector('.carousel-btn.next');
    
    imagesContainer.innerHTML = '';
    dotsContainer.innerHTML = '';

    if (!pelicula.imagenes || pelicula.imagenes.length === 0) {
        imagesContainer.innerHTML = `<img src="https://via.placeholder.com/350x520.png?text=Póster+No+Disponible" alt="Póster no disponible">`;
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        dotsContainer.style.display = 'none';
        return;
    }

    const dots = document.querySelectorAll('.carousel-dot');
    let currentIndex = 0;
    const totalImages = dots.length;
    let autoPlayInterval;

    if (totalImages <= 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
        dotsContainer.style.display = 'none';
        return;
    }
    
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
    dotsContainer.style.display = 'flex';

    function showImage(index) {
        imagesContainer.style.transform = `translateX(-${index * 100}%)`;
        dots.forEach(dot => dot.classList.remove('active'));
        dots[index].classList.add('active');
        currentIndex = index;
    }

    const nextImage = () => showImage((currentIndex + 1) % totalImages);
    const prevImage = () => showImage((currentIndex - 1 + totalImages) % totalImages);
    
    const startAutoPlay = () => { stopAutoPlay(); autoPlayInterval = setInterval(nextImage, 4000); };
    const stopAutoPlay = () => clearInterval(autoPlayInterval);

    prevBtn.addEventListener('click', prevImage);
    nextBtn.addEventListener('click', nextImage);
    dots.forEach(dot => dot.addEventListener('click', () => showImage(parseInt(dot.dataset.index))));
    
    carouselContainer.addEventListener('mouseenter', stopAutoPlay);
    carouselContainer.addEventListener('mouseleave', startAutoPlay);
    startAutoPlay();
}

function generarQR(texto) {
    const qrContainer = document.getElementById('codigo-qr');
    qrContainer.innerHTML = '';

    new QRCode(qrContainer, { 
        text: texto, 
        width: 300,          // un poco más grande (más capacidad y legibilidad)
        height: 300, 
        correctLevel: QRCode.CorrectLevel.L  // menor nivel de corrección => más espacio disponible
    });
}


function cerrarModalQR() {
    const modal = document.getElementById('modal-qr');
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == document.getElementById('modal-compra')) cerrarModalCompra();
    if (event.target == document.getElementById('modal-qr')) cerrarModalQR();
};