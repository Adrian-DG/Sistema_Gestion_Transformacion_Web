import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, firstValueFrom, of, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { DatosPoliza, PolizaDetalle, PolizasService } from '../polizas.service';

/** Fecha local en formato yyyy-MM-dd (el de `<input type="date">` y de DateOnly en la API). */
function fechaIso(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function sumarAnios(iso: string, anios: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return fechaIso(new Date(a + anios, m - 1, d));
}

/** La fecha del control debe ser posterior a la del control hermano indicado. */
const posteriorA =
  (otro: string, mensaje: string): ValidatorFn =>
  (control) => {
    const referencia = control.parent?.get(otro)?.value as string | undefined;
    return control.value && referencia && control.value <= referencia ? { orden: mensaje } : null;
  };

/** Errores de la API que corresponden a un campo. */
const CAMPO_POR_CODIGO: [RegExp, string][] = [
  [/Poliza\.NumeroDuplicado/i, 'numero'],
  [/Aseguradora/i, 'aseguradoraId'],
  [/Vehiculo/i, 'vehiculoId'],
];

/**
 * Alta (sin `id`), edición (con `id`) y renovación (alta con `?renovar={id}`, que propone el mismo
 * vehículo y aseguradora a partir del vencimiento anterior). Al guardar vuelve al listado.
 */
@Component({
  selector: 'app-poliza-formulario',
  imports: [ReactiveFormsModule, RouterLink, EncabezadoPagina, Campo, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './poliza-formulario.html',
})
export class PolizaFormulario {
  private readonly polizas = inject(PolizasService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro de la ruta; ausente al crear. */
  readonly id = input<string>();
  /** Query param: póliza a renovar. */
  readonly renovar = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());

  protected readonly formulario = this.fb.group({
    vehiculoId: this.fb.control<string | null>(null, Validators.required),
    aseguradoraId: this.fb.control<string | null>(null, Validators.required),
    numero: ['', [Validators.required, Validators.maxLength(50)]],
    fechaExpedicion: [fechaIso(new Date()), Validators.required],
    fechaEfectividad: [fechaIso(new Date()), Validators.required],
    fechaVencimiento: [
      sumarAnios(fechaIso(new Date()), 1),
      [
        Validators.required,
        posteriorA('fechaEfectividad', 'Debe ser posterior a la fecha de efectividad.'),
        posteriorA('fechaExpedicion', 'Debe ser posterior a la fecha de expedición.'),
      ],
    ],
  });

  protected readonly vehiculos = toSignal(
    this.catalogos.vehiculos().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly aseguradoras = toSignal(
    this.catalogos.aseguradoras().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  /** Póliza en edición o la que se renueva. */
  protected readonly referencia = signal<PolizaDetalle | null>(null);

  constructor() {
    // El vencimiento se revalida cuando cambian las fechas de las que depende.
    for (const control of [
      this.formulario.controls.fechaEfectividad,
      this.formulario.controls.fechaExpedicion,
    ]) {
      control.valueChanges
        .pipe(takeUntilDestroyed())
        .subscribe(() =>
          this.formulario.controls.fechaVencimiento.updateValueAndValidity({ emitEvent: false }),
        );
    }

    combineLatest([toObservable(this.id), toObservable(this.renovar)])
      .pipe(
        switchMap(([id, renovar]) => {
          const origen = id ?? renovar;
          if (!origen) return of(null);
          this.cargando.set(true);
          return this.polizas.obtener(origen).pipe(catchError(() => of(undefined)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((poliza) => {
        this.cargando.set(false);
        if (poliza === null) return;
        if (!poliza) {
          void this.router.navigate(['/polizas']);
          return;
        }

        this.referencia.set(poliza);
        if (this.id()) {
          this.formulario.patchValue({
            vehiculoId: poliza.vehiculoId,
            aseguradoraId: poliza.aseguradoraId,
            numero: poliza.numero,
            fechaExpedicion: poliza.fechaExpedicion,
            fechaEfectividad: poliza.fechaEfectividad,
            fechaVencimiento: poliza.fechaVencimiento,
          });
        } else {
          // Renovación: la nueva cobertura empieza donde termina la anterior.
          this.formulario.patchValue({
            vehiculoId: poliza.vehiculoId,
            aseguradoraId: poliza.aseguradoraId,
            fechaEfectividad: poliza.fechaVencimiento,
            fechaVencimiento: sumarAnios(poliza.fechaVencimiento, 1),
          });
        }
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
    const datos: DatosPoliza = {
      vehiculoId: v.vehiculoId!,
      aseguradoraId: v.aseguradoraId!,
      numero: v.numero.trim(),
      fechaExpedicion: v.fechaExpedicion,
      fechaEfectividad: v.fechaEfectividad,
      fechaVencimiento: v.fechaVencimiento,
    };

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.polizas.actualizar(id, datos));
        this.notificaciones.exito(`Póliza ${datos.numero} actualizada.`);
      } else {
        await firstValueFrom(this.polizas.crear(datos));
        this.notificaciones.exito(
          this.renovar() ? `Póliza renovada con el número ${datos.numero}.` : `Póliza ${datos.numero} registrada.`,
        );
      }
      await this.router.navigate(['/polizas']);
    } catch (e) {
      this.mostrarError(e);
    } finally {
      this.guardando.set(false);
    }
  }

  private mostrarError(error: unknown): void {
    if (esApiError(error) && Object.keys(error.errores).length === 0) {
      const campo = CAMPO_POR_CODIGO.find(([patron]) => patron.test(error.codigo))?.[1];
      const control = campo ? this.formulario.get(campo) : null;
      if (control) {
        control.setErrors({ servidor: error.mensaje });
        control.markAsTouched();
        return;
      }
    }

    this.errorGeneral.set(aplicarErroresServidor(this.formulario, error));
  }
}
