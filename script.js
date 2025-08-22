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

async function cargarPeliculaActual() {
    try {
        const response = await fetch('http://localhost:3000/api/pelicula-actual');
        if (!response.ok) {
            throw new Error('No se pudo cargar la película.');
        }
        
        const pelicula = await response.json();
        peliculaActualId = pelicula._id; // Guardamos el ID de la película actual
        
        actualizarInfoPelicula(pelicula);
        iniciarCarrusel(pelicula);

    } catch (error) {
        console.error('Error al cargar la película:', error);
        document.querySelector('.pelicula-info').innerHTML = '<h1>No hay película en cartelera</h1><p>Vuelve a intentar más tarde.</p>';
        document.querySelector('.poster-carousel').innerHTML = '<div class="product-image-container no-image"><p>Sin imagen</p></div>';
    }
}

// script.js
// script.js
async function cargarProximosEstrenos() {
    const proximosEstrenosContainer = document.querySelector('.proximos-estrenos-container');
    if (!proximosEstrenosContainer) return; // Evita errores si el contenedor no existe

    try {
        const response = await fetch('http://localhost:3000/api/proximos-estrenos');
        if (!response.ok) {
            throw new Error('No se pudo cargar los próximos estrenos.');
        }

        const estrenos = await response.json();
        
        if (estrenos.length === 0) {
            proximosEstrenosContainer.innerHTML = '<p class="no-estrenos-mensaje">No hay estrenos próximos en este momento.</p>';
            return;
        }

        proximosEstrenosContainer.innerHTML = ''; // Limpiar el contenedor antes de agregar los nuevos elementos

        estrenos.forEach(estreno => {
            const peliculaFutura = document.createElement('div');
            peliculaFutura.classList.add('pelicula-futura');
            
            // Asigna el ID de la película para poder usarlo en la función de clic
            peliculaFutura.dataset.id = estreno._id; 
            
            // Añade el evento de clic que llama a la nueva función
            peliculaFutura.addEventListener('click', () => mostrarDetallesPelicula(estreno._id));

            const fecha = new Date(estreno.fechaFuncion);
            const opciones = { day: 'numeric', month: 'long' };
            const fechaFormateada = fecha.toLocaleDateString('es-AR', opciones);
            
            peliculaFutura.innerHTML = `
                <img src="http://localhost:3000/uploads/${estreno.imagenes[0]}" 
                alt="Poster de ${estreno.titulo}">
                <h3>${estreno.titulo}</h3>
                <p>Estreno: ${fechaFormateada}</p>
            `;
            
            proximosEstrenosContainer.appendChild(peliculaFutura);
        });

    } catch (error) {
        console.error('Error al cargar próximos estrenos:', error);
        proximosEstrenosContainer.innerHTML = '<p class="no-estrenos-mensaje">Error al cargar los estrenos. Intenta de nuevo más tarde.</p>';
    }
}

function actualizarInfoPelicula(pelicula) {
    document.querySelector('.titulo-pelicula').textContent = pelicula.titulo;
    document.querySelector('.sinopsis').textContent = pelicula.descripcion;
    document.getElementById('pelicula-genero').textContent = pelicula.genero || 'No especificado';
    document.getElementById('pelicula-duracion').textContent = `${pelicula.duracion || 'N/A'}`;
    document.getElementById('pelicula-clasificacion').textContent = `Clasificación: ${pelicula.clasificacionEdad || 'N/A'}`;
    document.getElementById('pelicula-stock').textContent = pelicula.stock;
    
    // Formatear la fecha para que sea legible y amigable
    if (pelicula.fechaFuncion) {
        const fecha = new Date(pelicula.fechaFuncion);
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
        document.getElementById('pelicula-fecha').textContent = fecha.toLocaleDateString('es-AR', opciones) + ' hs';
    } else {
        document.getElementById('pelicula-fecha').textContent = 'Fecha no definida';
    }

    const entradaLabel = document.querySelector('label[for="entradas"]');
    if (entradaLabel) {
        entradaLabel.textContent = `Entradas ($${pelicula.precio} c/u):`;
        PRECIOS.entradas = pelicula.precio;
    }

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

async function mostrarDetallesPelicula(peliculaId) {
    try {
        const response = await fetch(`http://localhost:3000/api/pelicula/${peliculaId}`);
        if (!response.ok) throw new Error('Película no encontrada.');
        const pelicula = await response.json();

        // Obtener la URL del tráiler y formatearla para incrustar
        let trailerUrl = pelicula.trailer || '';
        if (trailerUrl.includes("youtube.com/watch")) {
            const videoId = trailerUrl.split('v=')[1];
            trailerUrl = `https://www.youtube.com/embed/${videoId}`;
        } else if (trailerUrl.includes("youtu.be/")) {
            const videoId = trailerUrl.split('youtu.be/')[1].split('?')[0];
            trailerUrl = `https://www.youtube.com/embed/${videoId}`;
        }
        
        document.getElementById('modal-titulo').textContent = pelicula.titulo;
        document.getElementById('modal-sinopsis').textContent = pelicula.descripcion;
        document.getElementById('modal-genero').textContent = pelicula.genero;
        document.getElementById('modal-duracion').textContent = pelicula.duracion;
        document.getElementById('modal-clasificacion').textContent = pelicula.clasificacionEdad;
        document.getElementById('modal-iframe-trailer').src = trailerUrl;

        document.getElementById('modal-detalles').style.display = 'block';
    } catch (error) {
        console.error('Error al cargar detalles:', error);
        alert('No se pudo cargar la información de la película.');
    }
}

function verTrailerPrincipal() {
    // Si la película principal tiene un ID, reutiliza la función para mostrar los detalles
    if (peliculaActualId) {
        mostrarDetallesPelicula(peliculaActualId);
    } else {
        alert('No hay película en cartelera para ver el tráiler.');
    }
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

    pelicula.imagenes.forEach((imgName, index) => {
        const img = document.createElement('img');
        img.src = `http://localhost:3000/uploads/${imgName}`;
        img.alt = `Imagen ${index + 1} de ${pelicula.titulo}`;
        imagesContainer.appendChild(img);

        const dot = document.createElement('div');
        dot.classList.add('carousel-dot');
        dot.dataset.index = index;
        if (index === 0) dot.classList.add('active');
        dotsContainer.appendChild(dot);
    });

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