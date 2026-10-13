import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { map, of, startWith, switchMap } from 'rxjs';

/**
 * Etiqueta, control proyectado, ayuda y mensaje de error. El mensaje aparece cuando el control
 * fue tocado; los errores del servidor (clave `servidor`) se muestran siempre.
 *
 * ```html
 * <app-campo etiqueta="Nombre" [control]="form.controls.nombre" requerido>
 *   <input class="control" id="nombre" formControlName="nombre" />
 * </app-campo>
 * ```
 */
@Component({
  selector: 'app-campo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <label class="mb-1 block text-sm font-medium text-slate-700" [attr.for]="para()">
      {{ etiqueta() }}
      @if (requerido()) {
        <span class="text-red-600" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (mensajeError(); as error) {
      <p class="mt-1 text-xs text-red-600" role="alert">{{ error }}</p>
    } @else if (ayuda()) {
      <p class="mt-1 text-xs text-slate-500">{{ ayuda() }}</p>
    }
  `,
})
export class Campo {
  readonly etiqueta = input.required<string>();
  readonly control = input<AbstractControl | null>(null);
  /** Id del control proyectado, para asociar la etiqueta. */
  readonly para = input<string>();
  readonly ayuda = input<string>();
  readonly requerido = input(false, { transform: (v: boolean | string) => v !== false });

  /** Se recalcula con cada cambio de valor, estado o "tocado" del control. */
  private readonly estado = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) =>
        control
          ? control.events.pipe(
              startWith(null),
              map(() => ({ errores: control.errors, tocado: control.touched })),
            )
          : of(null),
      ),
    ),
    { initialValue: null },
  );

  protected readonly mensajeError = computed(() => {
    const estado = this.estado();
    if (!estado?.errores) return null;
    if (estado.errores['servidor']) return String(estado.errores['servidor']);
    return estado.tocado ? mensajePara(estado.errores) : null;
  });
}

export function mensajePara(errores: ValidationErrors): string {
  if (errores['required']) return 'Este campo es obligatorio.';
  if (errores['email']) return 'Ingrese un correo electrónico válido.';
  if (errores['minlength'])
    return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres.`;
  if (errores['maxlength'])
    return `No puede exceder ${errores['maxlength'].requiredLength} caracteres.`;
  if (errores['min']) return `El valor mínimo es ${errores['min'].min}.`;
  if (errores['max']) return `El valor máximo es ${errores['max'].max}.`;
  if (errores['pattern']) return 'El formato no es válido.';
  if (errores['hex']) return 'Use un color en formato HEX (#RRGGBB).';
  if (errores['archivoGrande']) return `El archivo supera ${errores['archivoGrande'].maximoMb} MB.`;
  if (errores['tipoArchivo']) return 'El tipo de archivo no está permitido.';

  const primero = Object.values(errores)[0];
  return typeof primero === 'string' ? primero : 'El valor no es válido.';
}
