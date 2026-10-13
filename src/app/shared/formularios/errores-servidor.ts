import { AbstractControl, FormGroup } from '@angular/forms';
import { esApiError } from '../../core/api/api';

/**
 * Coloca los errores por campo de la API en los controles del formulario (error `servidor`,
 * que se limpia solo cuando el usuario cambia el valor). Devuelve el mensaje general a mostrar
 * cuando el error no corresponde a ningún control, o null si todos se ubicaron.
 */
export function aplicarErroresServidor(formulario: FormGroup, error: unknown): string | null {
  if (!esApiError(error)) return 'No se pudo completar la operación.';

  const sinUbicar: string[] = [];
  for (const [campo, mensajes] of Object.entries(error.errores)) {
    const control = buscarControl(formulario, campo);
    if (control) {
      control.setErrors({ ...control.errors, servidor: mensajes[0] });
      control.markAsTouched();
    } else {
      sinUbicar.push(...mensajes);
    }
  }

  if (Object.keys(error.errores).length === 0) return error.mensaje;
  return sinUbicar.length > 0 ? sinUbicar.join(' ') : null;
}

/** Acepta rutas de la API como "adjuntos[0].fileBase64" y las busca sin distinguir mayúsculas. */
function buscarControl(formulario: FormGroup, ruta: string): AbstractControl | null {
  const partes = ruta.replace(/\[(\d+)\]/g, '.$1').split('.');
  let actual: AbstractControl | null = formulario;

  for (const parte of partes) {
    if (!actual) return null;
    const hijos = (actual as FormGroup).controls as Record<string, AbstractControl> | undefined;
    if (!hijos) return null;
    const clave = Object.keys(hijos).find((k) => k.toLowerCase() === parte.toLowerCase());
    actual = clave ? hijos[clave] : null;
  }

  return actual === formulario ? null : actual;
}
