import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { Icono } from '../ui/icono/icono';

/** Archivo listo para enviarse a la API (formato de AdjuntoRequest). */
export interface ArchivoSeleccionado {
  nombreArchivo: string;
  contentType: string;
  /** Contenido en Base64, sin el prefijo "data:...;base64,". */
  fileBase64: string;
  tamano: number;
}

export function leerArchivo(archivo: File): Promise<ArchivoSeleccionado> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const dataUrl = String(lector.result);
      resolve({
        nombreArchivo: archivo.name,
        contentType: archivo.type || 'application/octet-stream',
        fileBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
        tamano: archivo.size,
      });
    };
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

/**
 * Selector de archivo con arrastrar y soltar. Funciona como control de formulario
 * (valor: {@link ArchivoSeleccionado} o null) y valida tipo y tamaño.
 */
@Component({
  selector: 'app-selector-archivo',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: SelectorArchivo, multi: true },
    { provide: NG_VALIDATORS, useExisting: SelectorArchivo, multi: true },
  ],
  template: `
    @if (archivo(); as a) {
      <div class="flex items-center gap-3 rounded-md border border-slate-300 bg-white p-3">
        <span class="flex size-9 items-center justify-center rounded bg-primario/10 text-primario">
          <app-icono nombre="archivo" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-800">{{ a.nombreArchivo }}</p>
          <p class="text-xs text-slate-500">{{ tamanoLegible() }}</p>
        </div>
        <button
          type="button"
          class="btn btn-texto btn-sm"
          [disabled]="deshabilitado()"
          (click)="quitar()"
          [attr.aria-label]="'Quitar ' + a.nombreArchivo"
        >
          <app-icono nombre="cerrar" [tamano]="16" />
        </button>
      </div>
    } @else {
      <label
        class="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors"
        [class]="
          arrastrando()
            ? 'border-primario bg-primario/5'
            : 'border-slate-300 bg-white hover:border-slate-400'
        "
        (dragover)="$event.preventDefault(); arrastrando.set(true)"
        (dragleave)="arrastrando.set(false)"
        (drop)="soltar($event)"
      >
        <app-icono nombre="subir" class="text-slate-400" [tamano]="28" />
        <span class="text-sm text-slate-700">
          <span class="font-semibold text-primario">Seleccione un archivo</span> o arrástrelo aquí
        </span>
        <span class="text-xs text-slate-500">{{ descripcion() }}</span>
        <input
          type="file"
          class="sr-only"
          [attr.id]="idControl()"
          [accept]="aceptar()"
          [disabled]="deshabilitado()"
          (change)="seleccionar($event)"
        />
      </label>
    }
  `,
})
export class SelectorArchivo implements ControlValueAccessor, Validator {
  /** Tipos permitidos, ej. "application/pdf,image/png,image/jpeg". */
  readonly aceptar = input('application/pdf,image/png,image/jpeg');
  readonly maximoMb = input(5);
  readonly idControl = input<string>();
  readonly descripcion = input('PDF, PNG o JPG');

  protected readonly archivo = signal<ArchivoSeleccionado | null>(null);
  protected readonly arrastrando = signal(false);
  protected readonly deshabilitado = signal(false);
  protected readonly tamanoLegible = computed(() => {
    const bytes = this.archivo()?.tamano ?? 0;
    return bytes >= 1024 * 1024
      ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
      : `${Math.ceil(bytes / 1024)} KB`;
  });

  private alCambiar: (valor: ArchivoSeleccionado | null) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(valor: ArchivoSeleccionado | null): void {
    this.archivo.set(valor ?? null);
  }

  registerOnChange(fn: (valor: ArchivoSeleccionado | null) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitado.set(deshabilitado);
  }

  validate(control: AbstractControl<ArchivoSeleccionado | null>): ValidationErrors | null {
    const valor = control.value;
    if (!valor) return null;

    if (valor.tamano > this.maximoMb() * 1024 * 1024) {
      return { archivoGrande: { maximoMb: this.maximoMb() } };
    }

    const permitidos = this.aceptar()
      .split(',')
      .map((t) => t.trim().toLowerCase());
    const extension = '.' + (valor.nombreArchivo.split('.').pop() ?? '').toLowerCase();
    const tipo = valor.contentType.toLowerCase();
    const valido = permitidos.some(
      (p) => p === tipo || p === extension || (p.endsWith('/*') && tipo.startsWith(p.slice(0, -1))),
    );

    return valido ? null : { tipoArchivo: true };
  }

  protected async seleccionar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo) await this.cargar(archivo);
  }

  protected async soltar(evento: DragEvent): Promise<void> {
    evento.preventDefault();
    this.arrastrando.set(false);
    const archivo = evento.dataTransfer?.files?.[0];
    if (archivo && !this.deshabilitado()) await this.cargar(archivo);
  }

  protected quitar(): void {
    this.archivo.set(null);
    this.alCambiar(null);
    this.alTocar();
  }

  private async cargar(archivo: File): Promise<void> {
    const leido = await leerArchivo(archivo);
    this.archivo.set(leido);
    this.alCambiar(leido);
    this.alTocar();
  }
}
