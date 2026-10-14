import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, of, switchMap } from 'rxjs';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { DatosPieza, InventarioService } from '../inventario.service';

/** Unidades de medida habituales; se puede escribir otra. */
export const UNIDADES_MEDIDA = [
  'Unidad',
  'Juego',
  'Par',
  'Galón',
  'Litro',
  'Cuarto',
  'Metro',
  'Kit',
];

/**
 * Alta (sin `id`) y edición (con `id`) de piezas. Una pieza nueva no tiene existencia: entra al
 * inventario con una entrada o con una compra directa en una orden de taller.
 */
@Component({
  selector: 'app-pieza-formulario',
  imports: [ReactiveFormsModule, RouterLink, EncabezadoPagina, Campo, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pieza-formulario.html',
})
export class PiezaFormulario {
  private readonly inventario = inject(InventarioService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());
  protected readonly unidades = UNIDADES_MEDIDA;

  protected readonly formulario = this.fb.group({
    codigo: ['', [Validators.required, Validators.maxLength(30)]],
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    descripcion: ['', Validators.maxLength(500)],
    unidadMedida: ['Unidad', [Validators.required, Validators.maxLength(30)]],
    existenciaMinima: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    activo: [true],
  });

  protected readonly existencia = signal<number | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  constructor() {
    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => this.inventario.obtenerPieza(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((pieza) => {
        if (!pieza) {
          void this.router.navigate(['/inventario-piezas']);
          return;
        }
        this.existencia.set(pieza.existencia);
        this.formulario.patchValue({ ...pieza, descripcion: pieza.descripcion ?? '' });
      });
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const datos: DatosPieza = {
      codigo: v.codigo.trim().toUpperCase(),
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      unidadMedida: v.unidadMedida.trim(),
      existenciaMinima: v.existenciaMinima!,
    };

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.inventario.actualizarPieza(id, { ...datos, activo: v.activo }));
        this.notificaciones.exito(`Pieza ${datos.nombre} actualizada.`);
      } else {
        await firstValueFrom(this.inventario.crearPieza(datos));
        this.notificaciones.exito(`Pieza ${datos.nombre} registrada.`);
      }
      await this.router.navigate(['/inventario-piezas']);
    } catch (e) {
      this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
    } finally {
      this.guardando.set(false);
    }
  }
}
