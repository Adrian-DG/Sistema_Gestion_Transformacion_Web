import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { Icono } from '../../../shared/ui/icono/icono';
import { InventarioService, PiezaCatalogo, TIPOS_PIEZA, TipoPieza } from '../inventario.service';
import { UNIDADES_MEDIDA } from '../piezas/pieza-formulario';

/** Datos con que se abre el registro: lo buscado o el código escaneado. */
export interface InicioPiezaRapida {
  texto?: string;
  codigoBarras?: string;
}

/** Lo escrito parece un código (sin espacios y con algún dígito o guion) y no un nombre. */
const pareceCodigo = (texto: string) => !/\s/.test(texto) && /[\d-]/.test(texto);

/**
 * Registro de una pieza nueva sin salir de la entrada: código, nombre y unidad (lo mínimo). La pieza
 * entra al catálogo sin existencia y la entrada le suma la cantidad comprada. Los demás datos se
 * completan luego en Piezas.
 */
@Component({
  selector: 'app-pieza-rapida',
  imports: [ReactiveFormsModule, Campo, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Va dentro del formulario de la entrada: no es un <form> y Enter registra la pieza sin enviar la entrada. -->
    <div
      [formGroup]="formulario"
      role="group"
      class="rounded-md border border-primario/30 bg-primario/5 p-4"
      aria-labelledby="titulo-pieza-rapida"
      (keydown.enter)="$event.preventDefault(); guardar()"
      (keydown.escape)="cancelar.emit()"
    >
      <div class="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 id="titulo-pieza-rapida" class="font-semibold text-slate-900">
            Registrar nueva pieza
          </h3>
          <p class="text-xs text-slate-500">
            Se agrega al catálogo y a esta entrada. La descripción y la existencia mínima se pueden
            completar después en Piezas.
          </p>
        </div>
        <button
          type="button"
          class="btn btn-texto btn-sm"
          (click)="cancelar.emit()"
          aria-label="Cancelar el registro"
        >
          <app-icono nombre="cerrar" [tamano]="16" />
        </button>
      </div>

      @if (error(); as mensaje) {
        <p
          class="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800"
          role="alert"
        >
          {{ mensaje }}
        </p>
      }

      <div class="grid gap-4 sm:grid-cols-[10rem_1fr_9rem]">
        <app-campo etiqueta="Código" para="rapida-codigo" [control]="c.codigo" requerido>
          <input
            #primero
            id="rapida-codigo"
            class="control font-mono uppercase"
            formControlName="codigo"
          />
        </app-campo>
        <app-campo etiqueta="Nombre" para="rapida-nombre" [control]="c.nombre" requerido>
          <input id="rapida-nombre" class="control" formControlName="nombre" />
        </app-campo>
        <app-campo etiqueta="Unidad" para="rapida-unidad" [control]="c.unidadMedida" requerido>
          <input
            id="rapida-unidad"
            class="control"
            list="rapida-unidades"
            formControlName="unidadMedida"
          />
          <datalist id="rapida-unidades">
            @for (u of unidades; track u) {
              <option [value]="u"></option>
            }
          </datalist>
        </app-campo>
        <app-campo etiqueta="Tipo" para="rapida-tipo" [control]="c.tipo" requerido>
          <select id="rapida-tipo" class="control" formControlName="tipo">
            @for (t of tiposPieza; track t.valor) {
              <option [ngValue]="t.valor">{{ t.nombre }}</option>
            }
          </select>
        </app-campo>
        <app-campo
          etiqueta="Código de barras"
          para="rapida-barras"
          [control]="c.codigoBarras"
          class="sm:col-span-2"
          ayuda="Opcional; si lo tiene, luego se podrá escanear."
        >
          <input id="rapida-barras" class="control font-mono" formControlName="codigoBarras" />
        </app-campo>
      </div>

      <div class="mt-4 flex justify-end gap-2">
        <button type="button" class="btn btn-contorno btn-sm" (click)="cancelar.emit()">
          Cancelar
        </button>
        <button
          type="button"
          class="btn btn-primario btn-sm"
          [disabled]="guardando()"
          (click)="guardar()"
        >
          @if (guardando()) {
            <app-cargando class="text-current" />
          }
          Registrar y agregar
        </button>
      </div>
    </div>
  `,
})
export class PiezaRapida implements AfterViewInit {
  private readonly inventario = inject(InventarioService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly inicio = input<InicioPiezaRapida>({});
  readonly creada = output<PiezaCatalogo>();
  readonly cancelar = output<void>();

  protected readonly unidades = UNIDADES_MEDIDA;
  protected readonly tiposPieza = TIPOS_PIEZA;
  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    tipo: this.fb.control<TipoPieza>(1),
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    unidadMedida: ['Unidad', [Validators.required, Validators.maxLength(30)]],
    codigoBarras: ['', [Validators.maxLength(64), Validators.pattern(/^\s*[\x21-\x7E]*\s*$/)]],
  });
  protected readonly c = this.formulario.controls;
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly primero = viewChild.required<ElementRef<HTMLInputElement>>('primero');

  ngAfterViewInit(): void {
    // Lo buscado se usa como código o como nombre, según parezca.
    const { texto, codigoBarras } = this.inicio();
    if (texto) {
      if (pareceCodigo(texto)) this.c.codigo.setValue(texto.toUpperCase());
      else this.c.nombre.setValue(texto);
    }
    if (codigoBarras) this.c.codigoBarras.setValue(codigoBarras);

    // El foco va al primer dato que falta.
    if (this.c.codigo.value) document.getElementById('rapida-nombre')?.focus();
    else this.primero().nativeElement.focus();
  }

  protected async guardar(): Promise<void> {
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const v = this.formulario.getRawValue();
    const datos = {
      codigo: v.codigo.trim().toUpperCase(),
      tipo: v.tipo,
      nombre: v.nombre.trim(),
      descripcion: null,
      unidadMedida: v.unidadMedida.trim(),
      existenciaMinima: 0,
      codigoBarras: v.codigoBarras.trim() || null,
    };

    this.guardando.set(true);
    try {
      const id = await firstValueFrom(this.inventario.crearPieza(datos));
      this.creada.emit({
        id,
        codigo: datos.codigo,
        tipo: datos.tipo,
        codigoBarras: datos.codigoBarras,
        nombre: datos.nombre,
        unidadMedida: datos.unidadMedida,
        existencia: 0,
      });
    } catch (e) {
      // Código o código de barras repetidos se marcan en su campo.
      if (esApiError(e) && /CodigoBarrasDuplicado/.test(e.codigo)) {
        this.c.codigoBarras.setErrors({ servidor: e.mensaje });
        this.c.codigoBarras.markAsTouched();
      } else if (esApiError(e) && /CodigoDuplicado/.test(e.codigo)) {
        this.c.codigo.setErrors({ servidor: e.mensaje });
        this.c.codigo.markAsTouched();
      } else {
        this.error.set(aplicarErroresServidor(this.formulario, e));
      }
    } finally {
      this.guardando.set(false);
    }
  }
}
