import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { comprimirImagen } from '../../../shared/formularios/comprimir-imagen';
import { ArchivoSeleccionado } from '../../../shared/formularios/selector-archivo';
import { Icono } from '../../../shared/ui/icono/icono';

/**
 * Foto de una vista del vehículo. En teléfonos y tabletas abre la cámara trasera; en computadoras
 * permite elegir una imagen. La foto se reduce y se guarda como JPEG. Su valor es la foto nueva
 * (ArchivoSeleccionado) o null; `actual` muestra la foto ya guardada mientras no se reemplace.
 */
@Component({
  selector: 'app-captura-foto',
  imports: [Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: CapturaFoto, multi: true }],
  template: `
    <figure class="overflow-hidden rounded-md border border-slate-300 bg-white">
      <div class="relative aspect-[4/3] bg-slate-100">
        @if (vistaPrevia(); as src) {
          <img [src]="src" [alt]="'Foto: ' + etiqueta()" class="size-full object-cover" />
          @if (nueva()) {
            <span
              class="absolute top-2 left-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white"
            >
              {{ actual() ? 'Nueva' : 'Lista' }}
            </span>
          }
        } @else {
          <div class="flex size-full flex-col items-center justify-center gap-1 text-slate-400">
            <app-icono nombre="vehiculo" [tamano]="32" />
            <span class="text-xs">Sin foto</span>
          </div>
        }
        @if (procesando()) {
          <div
            class="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-slate-600"
          >
            Procesando…
          </div>
        }
      </div>
      <figcaption
        class="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2"
      >
        <span class="text-sm font-medium text-slate-800">{{ etiqueta() }}</span>
        <span class="flex gap-1">
          @if (nueva() && !deshabilitado()) {
            <button
              type="button"
              class="btn btn-texto btn-sm"
              (click)="quitar()"
              [attr.aria-label]="'Descartar la foto nueva: ' + etiqueta()"
            >
              <app-icono nombre="cerrar" [tamano]="14" />
            </button>
          }
          <label
            class="btn btn-contorno btn-sm cursor-pointer"
            [class.opacity-50]="deshabilitado()"
          >
            {{ vistaPrevia() ? 'Cambiar' : 'Tomar foto' }}
            <input
              type="file"
              class="sr-only"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              [attr.id]="idControl()"
              [disabled]="deshabilitado() || procesando()"
              (change)="seleccionar($event)"
            />
          </label>
        </span>
      </figcaption>
    </figure>
    @if (error(); as e) {
      <p class="mt-1 text-xs text-red-700">{{ e }}</p>
    }
  `,
})
export class CapturaFoto implements ControlValueAccessor {
  readonly etiqueta = input.required<string>();
  readonly idControl = input<string>();
  /** URL de la foto ya guardada (edición). */
  readonly actual = input<string | null>(null);

  protected readonly nueva = signal<ArchivoSeleccionado | null>(null);
  protected readonly procesando = signal(false);
  protected readonly deshabilitado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly vistaPrevia = computed(() => {
    const n = this.nueva();
    return n ? `data:${n.contentType};base64,${n.fileBase64}` : this.actual();
  });

  private alCambiar: (valor: ArchivoSeleccionado | null) => void = () => {};
  private alTocar: () => void = () => {};

  writeValue(valor: ArchivoSeleccionado | null): void {
    this.nueva.set(valor ?? null);
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

  protected async seleccionar(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (!archivo) return;

    this.error.set(null);
    if (!archivo.type.startsWith('image/')) {
      this.error.set('Seleccione una imagen.');
      return;
    }

    this.procesando.set(true);
    try {
      const foto = await comprimirImagen(archivo);
      if (foto.tamano > 5 * 1024 * 1024) {
        this.error.set('La foto pesa más de 5 MB.');
        return;
      }
      this.nueva.set(foto);
      this.alCambiar(foto);
    } catch {
      this.error.set('No se pudo leer la imagen. Intente con otra.');
    } finally {
      this.procesando.set(false);
      this.alTocar();
    }
  }

  protected quitar(): void {
    this.nueva.set(null);
    this.alCambiar(null);
    this.alTocar();
  }
}
