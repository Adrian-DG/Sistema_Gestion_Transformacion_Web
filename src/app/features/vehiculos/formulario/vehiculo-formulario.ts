import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { DatosVehiculo, VehiculosService } from '../vehiculos.service';

const ANIO_MAXIMO = new Date().getFullYear() + 1;

/** Errores de la API que corresponden a un campo (códigos "Vehiculo.PlacaDuplicado", etc.). */
const CAMPO_POR_CODIGO: [RegExp, string][] = [
  [/Placa/i, 'placa'],
  [/Chasis/i, 'chasis'],
  [/Matricula/i, 'matricula'],
];

/**
 * Alta (sin `id`) y edición (con `id`) de vehículos. Al guardar vuelve al listado. En edición se
 * puede marcar el vehículo fuera de servicio; no se eliminan.
 */
@Component({
  selector: 'app-vehiculo-formulario',
  imports: [ReactiveFormsModule, RouterLink, EncabezadoPagina, Campo, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculo-formulario.html',
})
export class VehiculoFormulario {
  private readonly vehiculos = inject(VehiculosService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro de la ruta; ausente al crear. */
  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());
  protected readonly anioMaximo = ANIO_MAXIMO;

  protected readonly formulario = this.fb.group({
    placa: ['', [Validators.required, Validators.maxLength(10)]],
    matricula: ['', [Validators.required, Validators.maxLength(30)]],
    chasis: ['', [Validators.required, Validators.maxLength(50)]],
    fabricacion: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1900),
      Validators.max(ANIO_MAXIMO),
    ]),
    marcaId: this.fb.control<string | null>(null, Validators.required),
    modeloId: this.fb.control<string | null>(null, Validators.required),
    tipoId: this.fb.control<string | null>(null, Validators.required),
    colorId: this.fb.control<string | null>(null, Validators.required),
    disponible: [true],
  });

  protected readonly marcas = toSignal(this.catalogos.marcas().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  private readonly modelos = toSignal(this.catalogos.modelos().pipe(catchError(() => of([]))), {
    initialValue: [],
  });
  protected readonly tipos = toSignal(
    this.catalogos.tiposVehiculo().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly colores = toSignal(this.catalogos.colores().pipe(catchError(() => of([]))), {
    initialValue: [],
  });

  private readonly marcaId = toSignal(
    this.formulario.controls.marcaId.valueChanges.pipe(
      startWith(this.formulario.controls.marcaId.value),
    ),
  );
  /** Solo los modelos de la marca elegida. */
  protected readonly modelosDeMarca = computed(() =>
    this.modelos().filter((m) => m.marcaId === this.marcaId()),
  );

  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly placaActual = signal('');

  constructor() {
    // Al cambiar de marca, el modelo elegido deja de ser válido.
    this.formulario.controls.marcaId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((marcaId) => {
        const modelo = this.modelos().find((m) => m.id === this.formulario.controls.modeloId.value);
        if (modelo && modelo.marcaId !== marcaId) {
          this.formulario.controls.modeloId.setValue(null);
        }
      });

    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.cargando.set(true);
          return this.vehiculos.obtener(id).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((vehiculo) => {
        this.cargando.set(false);
        if (!vehiculo) {
          void this.router.navigate(['/vehiculos']);
          return;
        }

        this.placaActual.set(vehiculo.placa);
        this.formulario.patchValue({
          placa: vehiculo.placa,
          matricula: vehiculo.matricula,
          chasis: vehiculo.chasis,
          fabricacion: vehiculo.fabricacion,
          marcaId: vehiculo.marcaId,
          modeloId: vehiculo.modeloId,
          tipoId: vehiculo.tipoId,
          colorId: vehiculo.colorId,
          disponible: vehiculo.disponible,
        });
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
    const datos: DatosVehiculo = {
      placa: v.placa.trim().toUpperCase(),
      matricula: v.matricula.trim().toUpperCase(),
      chasis: v.chasis.trim().toUpperCase(),
      fabricacion: v.fabricacion!,
      marcaId: v.marcaId!,
      modeloId: v.modeloId!,
      tipoId: v.tipoId!,
      colorId: v.colorId!,
    };

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.vehiculos.actualizar(id, { ...datos, disponible: v.disponible }));
        this.notificaciones.exito(`Vehículo ${datos.placa} actualizado.`);
      } else {
        await firstValueFrom(this.vehiculos.crear(datos));
        this.notificaciones.exito(`Vehículo ${datos.placa} registrado.`);
      }
      await this.router.navigate(['/vehiculos']);
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
