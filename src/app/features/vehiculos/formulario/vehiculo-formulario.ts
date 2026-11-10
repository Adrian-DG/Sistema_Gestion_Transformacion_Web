import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, LowerCasePipe } from '@angular/common';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { ArchivoSeleccionado } from '../../../shared/formularios/selector-archivo';
import { CapturaFoto } from './captura-foto';
import { esApiError } from '../../../core/api/api';
import { InventarioService, TIPO_PROVEEDOR } from '../../inventario/inventario.service';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import {
  CONDICION_VEHICULO,
  ClaveVista,
  CondicionVehiculo,
  DatosVehiculo,
  EstatusVehiculo,
  FotoNueva,
  NOMBRES_ESTATUS_VEHICULO,
  VISTAS_VEHICULO,
  VehiculosService,
} from '../vehiculos.service';

const ANIO_MAXIMO = new Date().getFullYear() + 1;

/** Errores de la API que corresponden a un campo (códigos "Vehiculo.PlacaDuplicado", etc.). */
const CAMPO_POR_CODIGO: [RegExp, string][] = [
  [/Placa/i, 'placa'],
  [/Ficha/i, 'ficha'],
  [/Chasis/i, 'chasis'],
  [/Matricula/i, 'matricula'],
  [/Kilometraje/i, 'kilometraje'],
];

/** Fecha local yyyy-MM-dd. */
function hoyLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Al ingresar, la garantía debe estar vigente (fecha y kilometraje). */
const garantiaVigente: ValidatorFn = (grupo: AbstractControl) => {
  const v = grupo.getRawValue();
  if (v.tieneGarantia !== true) return null;
  const errores: Record<string, string> = {};
  if (v.garantiaVence && v.garantiaVence < hoyLocal()) {
    errores['vence'] = 'La garantía ya venció: indique que el vehículo no tiene garantía.';
  }
  if (
    v.garantiaKilometraje != null &&
    v.kilometraje != null &&
    v.garantiaKilometraje <= v.kilometraje
  ) {
    errores['km'] = 'El vehículo ya superó el kilometraje de la garantía.';
  }
  return Object.keys(errores).length ? errores : null;
};

/**
 * Ingreso (sin `id`) y edición (con `id`) de vehículos. Al guardar vuelve al listado; no se eliminan.
 * El ingreso exige la condición (nuevo o usado), el kilometraje inicial (0 si es nuevo), indicar si
 * tiene garantía (y sus datos) y las cuatro fotos: frente, lados y trasera. En edición, condición y
 * kilometraje de ingreso son de solo lectura, el kilometraje no puede bajar y cada foto se puede
 * reemplazar (la anterior queda en el historial).
 */
@Component({
  selector: 'app-vehiculo-formulario',
  imports: [
    DatePipe,
    DecimalPipe,
    LowerCasePipe,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    EstadoBadge,
    CapturaFoto,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './vehiculo-formulario.html',
})
export class VehiculoFormulario {
  private readonly vehiculos = inject(VehiculosService);
  private readonly catalogos = inject(CatalogosService);
  private readonly inventario = inject(InventarioService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  /** Parámetro de la ruta; ausente al crear. */
  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());
  protected readonly anioMaximo = ANIO_MAXIMO;

  protected readonly condiciones = CONDICION_VEHICULO;
  protected readonly vistas = VISTAS_VEHICULO;
  protected readonly hoy = hoyLocal();

  protected readonly formulario = this.fb.group(
    {
      placa: ['', [Validators.required, Validators.maxLength(10)]],
      ficha: ['', Validators.maxLength(20)],
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
      condicion: this.fb.control<CondicionVehiculo | null>(null, Validators.required),
      kilometraje: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
      tieneGarantia: this.fb.control<boolean | null>(null, Validators.required),
      garantiaVence: [''],
      garantiaKilometraje: this.fb.control<number | null>(null, Validators.min(1)),
      garantiaTallerId: this.fb.control<string | null>(null),
      fotos: this.fb.group({
        frente: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
        ladoIzquierdo: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
        ladoDerecho: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
        trasera: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
      }),
    },
    { validators: garantiaVigente },
  );
  protected readonly c = this.formulario.controls;

  /** Talleres autorizados (concesionarios) para la garantía. */
  protected readonly talleres = toSignal(
    this.inventario.catalogoProveedores(TIPO_PROVEEDOR.Taller).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  /** Estado de la garantía guardada (null si no tiene). */
  protected readonly enGarantia = signal<boolean | null>(null);

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
  protected readonly estatus = signal<EstatusVehiculo | null>(null);
  /** Datos del ingreso, de solo lectura en edición. */
  protected readonly ingreso = signal<{
    condicion: CondicionVehiculo;
    kilometraje: number;
    fecha: string;
  } | null>(null);
  /** Último kilometraje guardado: en edición no puede bajar. */
  protected readonly kilometrajeGuardado = signal(0);
  /** URLs locales de las fotos guardadas, por vista. */
  protected readonly fotosGuardadas = signal<Partial<Record<ClaveVista, string>>>({});

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly v = computed(() => {
    this.valores();
    return this.formulario.getRawValue();
  });
  /** Errores de la regla de garantía vigente (solo en el ingreso). */
  protected readonly erroresGarantia = computed(() => {
    this.valores();
    return (this.formulario.errors ?? {}) as Record<string, string>;
  });
  protected readonly nombresEstatus = NOMBRES_ESTATUS_VEHICULO;

  constructor() {
    // La fecha de vencimiento es obligatoria solo si tiene garantía.
    this.c.tieneGarantia.valueChanges.pipe(takeUntilDestroyed()).subscribe((con) => {
      this.c.garantiaVence.setValidators(con ? Validators.required : null);
      this.c.garantiaVence.updateValueAndValidity();
    });

    // Un vehículo nuevo ingresa con 0 km (se puede ajustar); uno usado obliga a leer el odómetro.
    this.c.condicion.valueChanges.pipe(takeUntilDestroyed()).subscribe((condicion) => {
      if (this.esEdicion()) return;
      this.c.kilometraje.setValue(condicion === CONDICION_VEHICULO.Nuevo ? 0 : null);
    });

    this.destroyRef.onDestroy(() => this.liberarFotos());

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
        this.estatus.set(vehiculo.estatus);
        this.ingreso.set({
          condicion: vehiculo.condicion,
          kilometraje: vehiculo.kilometrajeIngreso,
          fecha: vehiculo.fechaIngreso,
        });
        this.kilometrajeGuardado.set(vehiculo.kilometraje);
        this.prepararEdicion(vehiculo.kilometraje);
        this.cargarFotos(
          vehiculo.id,
          vehiculo.fotos.map((f) => f.vista),
        );
        this.enGarantia.set(vehiculo.garantiaVence ? vehiculo.enGarantia : null);
        this.formulario.patchValue({
          placa: vehiculo.placa,
          ficha: vehiculo.ficha ?? '',
          matricula: vehiculo.matricula,
          chasis: vehiculo.chasis,
          fabricacion: vehiculo.fabricacion,
          marcaId: vehiculo.marcaId,
          modeloId: vehiculo.modeloId,
          tipoId: vehiculo.tipoId,
          colorId: vehiculo.colorId,
          condicion: vehiculo.condicion,
          kilometraje: vehiculo.kilometraje,
          tieneGarantia: !!vehiculo.garantiaVence,
          garantiaVence: vehiculo.garantiaVence ?? '',
          garantiaKilometraje: vehiculo.garantiaKilometraje,
          garantiaTallerId: vehiculo.garantiaTallerId,
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
      ficha: v.ficha.trim().toUpperCase() || null,
      matricula: v.matricula.trim().toUpperCase(),
      chasis: v.chasis.trim().toUpperCase(),
      fabricacion: v.fabricacion!,
      marcaId: v.marcaId!,
      modeloId: v.modeloId!,
      tipoId: v.tipoId!,
      colorId: v.colorId!,
      kilometraje: v.kilometraje!,
      tieneGarantia: v.tieneGarantia!,
      garantiaVence: v.tieneGarantia ? v.garantiaVence : null,
      garantiaKilometraje: v.tieneGarantia ? v.garantiaKilometraje : null,
      garantiaTallerId: v.tieneGarantia ? v.garantiaTallerId : null,
    };
    const fotos: FotoNueva[] = VISTAS_VEHICULO.flatMap((vista) => {
      const foto = v.fotos[vista.clave];
      return foto
        ? [
            {
              vista: vista.valor,
              nombreArchivo: foto.nombreArchivo,
              contentType: foto.contentType,
              fileBase64: foto.fileBase64,
            },
          ]
        : [];
    });

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.vehiculos.actualizar(id, datos));
        // Solo las vistas con foto nueva; si alguna falla, los datos ya quedaron guardados.
        try {
          for (const foto of fotos) await firstValueFrom(this.vehiculos.reemplazarFoto(id, foto));
        } catch {
          this.errorGeneral.set(
            'Los datos se guardaron, pero no se pudieron reemplazar todas las fotos. Intente de nuevo.',
          );
          this.cargarFotos(
            id,
            VISTAS_VEHICULO.map((x) => x.valor),
          );
          return;
        }
        this.notificaciones.exito(`Vehículo ${datos.placa} actualizado.`);
      } else {
        await firstValueFrom(this.vehiculos.crear({ ...datos, condicion: v.condicion!, fotos }));
        this.notificaciones.exito(`Vehículo ${datos.placa} ingresado a la flota.`);
      }
      await this.router.navigate(['/vehiculos']);
    } catch (e) {
      this.mostrarError(e);
    } finally {
      this.guardando.set(false);
    }
  }

  /** En edición: fotos opcionales (se reemplazan solo las nuevas), kilometraje mínimo el guardado y sin la regla de garantía del ingreso. */
  private prepararEdicion(kilometraje: number): void {
    for (const control of Object.values(this.c.fotos.controls)) {
      control.clearValidators();
      control.updateValueAndValidity({ emitEvent: false });
    }
    this.c.condicion.disable({ emitEvent: false });
    this.c.kilometraje.setValidators([Validators.required, Validators.min(kilometraje)]);
    this.c.kilometraje.updateValueAndValidity({ emitEvent: false });
    this.formulario.clearValidators();
  }

  /** Descarga las fotos guardadas (con el token) y las muestra con URLs locales. */
  private cargarFotos(id: string, vistas: number[]): void {
    const pedidas = VISTAS_VEHICULO.filter((x) => vistas.includes(x.valor));
    if (pedidas.length === 0) return;
    forkJoin(
      pedidas.map((x) =>
        this.vehiculos.foto(id, x.valor).pipe(
          map((blob) => [x.clave, URL.createObjectURL(blob)] as const),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe((resultado) => {
      this.liberarFotos();
      this.fotosGuardadas.set(
        Object.fromEntries(resultado.filter((r) => r !== null)) as Partial<
          Record<ClaveVista, string>
        >,
      );
      for (const control of Object.values(this.c.fotos.controls)) control.setValue(null);
    });
  }

  private liberarFotos(): void {
    for (const url of Object.values(this.fotosGuardadas())) if (url) URL.revokeObjectURL(url);
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
