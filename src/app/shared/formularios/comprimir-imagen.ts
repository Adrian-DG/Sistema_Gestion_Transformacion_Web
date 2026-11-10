import { ArchivoSeleccionado, leerArchivo } from './selector-archivo';

/**
 * Reduce una foto (por ejemplo, de la cámara de un teléfono) a un lado máximo de `ladoMaximo` px y la
 * guarda como JPEG. Si el navegador no puede decodificarla, devuelve el archivo tal cual.
 */
export async function comprimirImagen(
  archivo: File,
  ladoMaximo = 1600,
  calidad = 0.82,
): Promise<ArchivoSeleccionado> {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    return leerArchivo(archivo);
  }

  const escala = Math.min(1, ladoMaximo / Math.max(imagen.width, imagen.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(imagen.width * escala);
  lienzo.height = Math.round(imagen.height * escala);
  lienzo.getContext('2d')!.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
  imagen.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    lienzo.toBlob(resolve, 'image/jpeg', calidad),
  );
  if (!blob) return leerArchivo(archivo);

  const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'foto';
  return leerArchivo(new File([blob], `${nombre}.jpg`, { type: 'image/jpeg' }));
}
