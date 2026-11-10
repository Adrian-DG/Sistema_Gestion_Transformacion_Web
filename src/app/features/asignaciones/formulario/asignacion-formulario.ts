import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  catchError,
  debounceTime,
  firstValueFrom,
  forkJoin,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { esApiError } from '../../../core/api/api';
import {
  CatalogosService,
  ElementoCatalogo,
  TIPOS_OPERACION,
} from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import {
  CargoSipffaa,
  DepartamentoSipffaa,
  MiembroSipffaa,
  SipffaaService,
} from '../../../core/sipffaa/sipffaa.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { ArchivoSeleccionado, SelectorArchivo } from '../../../shared/formularios/selector-archivo';
import { BuscadorSipffaa } from '../../../shared/sipffaa/buscador-sipffaa';
import { OcupantesCargo } from '../../../shared/sipffaa/ocupantes-cargo';
import { cargoDe, departamentoDe } from '../../../shared/sipffaa/datos-miembro';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import {
  AdvertenciaAsignacion,
  AsignacionesService,
  NuevaAsignacion,
  REQUIERE_CONFIRMACION,
  TIPO_ASIGNACION,
} from '../asignaciones.service';
import { DialogosService } from '../../../core/dialogos/dialogos.service';

type Adjunto = FormGroup<{
  tipoDocumentoId: FormControl<string | null>;
  archivo: FormControl<ArchivoSeleccionado | null>;
}>;

/** El retorno estimado debe ser posterior a la salida. */
const posteriorASalida: ValidatorFn = (control) => {
  const salida = control.parent?.get('fechaSalida')?.value as string | undefined;
  return control.value && salida && control.value <= salida
    ? { orden: 'Debe ser posterior a la fecha de salida.' }
    : null;
};

/**
 * Solicitud de un vehículo. Solicitante, asignado y chofer se eligen en SIPFFAA; al guardar se
 * registran (o reutilizan) como personas del sistema. La asignación queda Pendiente hasta su
 * aprobación; al guardar se vuelve al listado.
 */
@Component({
  selector: 'app-asignacion-formulario',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorArchivo,
    BuscadorSipffaa,
    OcupantesCargo,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './asignacion-formulario.html',
})
export class AsignacionFormulario {
  private readonly asignaciones = inject(AsignacionesService);
  private readonly sipffaa = inject(SipffaaService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly dialogos = inject(DialogosService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly tipos = TIPO_ASIGNACION;

  protected readonly formulario = this.fb.group({
    // La solicitud se busca por la persona (cédula o nombre) o por el cargo que solicita;
    // en ambos casos queda registrada la persona que firma y el cargo.
    solicitarPor: this.fb.control<'persona' | 'cargo'>('persona'),
    solicitante: this.fb.control<MiembroSipffaa | null>(null, Validators.required),
    cargoSolicitante: this.fb.control<CargoSipffaa | null>(null, Validators.required),
    departamento: this.fb.control<DepartamentoSipffaa | null>(null, Validators.required),

    mismoSolicitante: [true],
    asignado: this.fb.control<MiembroSipffaa | null>(null),
    tipoAsignacion: this.fb.control<number>(TIPO_ASIGNACION.Persona),
    cargoAsignado: this.fb.control<CargoSipffaa | null>(null),

    chofer: this.fb.control<MiembroSipffaa | null>(null, Validators.required),

    fechaSalida: ['', Validators.required],
    fechaRetornoEstimada: ['', [Validators.required, posteriorASalida]],
    vehiculoId: this.fb.control<string | null>(null, Validators.required),

    proposito: ['', [Validators.required, Validators.maxLength(500)]],
    destino: ['', [Validators.maxLength(250)]],

    adjuntos: this.fb.array<Adjunto>([]),
  });

  protected readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento(TIPOS_OPERACION.Asignacion).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly vehiculos = signal<ElementoCatalogo[]>([]);
  /** Mantenimiento pendiente y póliza del vehículo elegido para el período. */
  protected readonly advertencias = signal<AdvertenciaAsignacion[]>([]);
  protected readonly cargandoVehiculos = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly v = computed(() => {
    this.valores();
    return this.formulario.getRawValue();
  });
  protected readonly fechasValidas = computed(
    () =>
      !!this.v().fechaSalida &&
      !!this.v().fechaRetornoEstimada &&
      this.v().fechaRetornoEstimada > this.v().fechaSalida,
  );

  constructor() {
    this.agregarAdjunto();
    const c = this.formulario.controls;

    // El primer adjunto se crea antes de que llegue el catálogo: se completa su tipo sugerido.
    this.catalogos
      .tiposDocumento(TIPOS_OPERACION.Asignacion)
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(),
      )
      .subscribe((tipos) => {
        const sugerido = tipos.find((t) => /solicitud de veh/i.test(t.nombre))?.id;
        if (!sugerido) return;
        for (const adjunto of this.adjuntos.controls) {
          if (!adjunto.controls.tipoDocumentoId.value)
            adjunto.controls.tipoDocumentoId.setValue(sugerido);
        }
      });

    // Al elegir el solicitante se proponen su cargo y departamento de SIPFFAA (se pueden cambiar).
    // Si se solicita por cargo, el cargo ya está elegido y se conserva.
    c.solicitante.valueChanges.pipe(takeUntilDestroyed()).subscribe((miembro) => {
      if (!miembro) return;
      if (c.solicitarPor.value !== 'cargo' || !c.cargoSolicitante.value) {
        c.cargoSolicitante.setValue(cargoDe(miembro));
      }
      c.departamento.setValue(departamentoDe(miembro));
    });

    // Asignado: obligatorio solo si no es el mismo solicitante; cargo: solo en asignaciones al cargo.
    merge(c.mismoSolicitante.valueChanges, c.tipoAsignacion.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        c.asignado.setValidators(c.mismoSolicitante.value ? null : Validators.required);
        c.cargoAsignado.setValidators(
          c.tipoAsignacion.value === TIPO_ASIGNACION.Cargo ? Validators.required : null,
        );
        if (c.mismoSolicitante.value) c.asignado.setValue(null);
        if (c.tipoAsignacion.value !== TIPO_ASIGNACION.Cargo) c.cargoAsignado.setValue(null);
        c.asignado.updateValueAndValidity({ emitEvent: false });
        c.cargoAsignado.updateValueAndValidity({ emitEvent: false });
      });

    c.fechaSalida.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => c.fechaRetornoEstimada.updateValueAndValidity({ emitEvent: false }));

    // Los vehículos se consultan para el período elegido: solo los libres en esas fechas.
    merge(c.fechaSalida.valueChanges, c.fechaRetornoEstimada.valueChanges)
      .pipe(
        debounceTime(400),
        map(() => [c.fechaSalida.value, c.fechaRetornoEstimada.value] as const),
        tap(() => this.cargandoVehiculos.set(true)),
        switchMap(([salida, retorno]) =>
          salida && retorno && retorno > salida
            ? this.asignaciones.vehiculosDisponibles(salida, retorno).pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((vehiculos) => {
        this.vehiculos.set(vehiculos);
        this.cargandoVehiculos.set(false);
        if (!vehiculos.some((v) => v.id === c.vehiculoId.value)) c.vehiculoId.setValue(null);
      });

    // Al elegir el vehículo (o cambiar el período) se consultan sus advertencias.
    merge(
      c.vehiculoId.valueChanges,
      c.fechaSalida.valueChanges,
      c.fechaRetornoEstimada.valueChanges,
    )
      .pipe(
        debounceTime(300),
        map(() => [c.vehiculoId.value, c.fechaSalida.value, c.fechaRetornoEstimada.value] as const),
        switchMap(([vehiculoId, salida, retorno]) =>
          vehiculoId && salida && retorno && retorno > salida
            ? this.asignaciones
                .advertencias(vehiculoId, salida, retorno)
                .pipe(catchError(() => of([])))
            : of([]),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((advertencias) => this.advertencias.set(advertencias));
  }

  private confirmarAdvertencias(detalles: string[]): Promise<boolean> {
    return this.dialogos.confirmar({
      titulo: 'Revise antes de registrar',
      mensaje:
        'El vehículo elegido tiene las siguientes advertencias. ¿Desea registrar la asignación de todos modos?',
      detalles,
      textoConfirmar: 'Registrar de todos modos',
      textoCancelar: 'Revisar',
    });
  }

  protected get adjuntos(): FormArray<Adjunto> {
    return this.formulario.controls.adjuntos;
  }

  protected agregarAdjunto(): void {
    // Propone "Solicitud de vehículo" si existe en el catálogo.
    const sugerido =
      this.tiposDocumento().find((t) => /solicitud de veh/i.test(t.nombre))?.id ?? null;
    this.adjuntos.push(
      this.fb.group({
        tipoDocumentoId: this.fb.control<string | null>(sugerido, Validators.required),
        archivo: this.fb.control<ArchivoSeleccionado | null>(null, Validators.required),
      }),
    );
  }

  protected quitarAdjunto(indice: number): void {
    this.adjuntos.removeAt(indice);
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.adjuntos.length === 0) {
      this.errorGeneral.set('Debe adjuntar al menos un documento para registrar la asignación.');
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const solicitante = v.solicitante!;
    const asignado = v.mismoSolicitante ? solicitante : v.asignado!;
    const chofer = v.chofer!;

    this.guardando.set(true);
    try {
      // Personas del sistema para cada cédula (se crean desde SIPFFAA si no existen).
      let personas: Record<string, string>;
      try {
        const cedulas = [...new Set([solicitante.cedula, asignado.cedula, chofer.cedula])];
        const ids = await firstValueFrom(
          forkJoin(cedulas.map((cedula) => this.sipffaa.importarPersona(cedula))),
        );
        personas = Object.fromEntries(cedulas.map((cedula, i) => [cedula, ids[i]]));
      } catch (e) {
        this.errorGeneral.set(
          `No se pudieron registrar las personas desde SIPFFAA${esApiError(e) ? `: ${e.mensaje}` : '.'}`,
        );
        return;
      }

      const esCargo = v.tipoAsignacion === TIPO_ASIGNACION.Cargo;
      const asignacion: NuevaAsignacion = {
        solicitantePersonaId: personas[solicitante.cedula],
        codCargoSolicitante: v.cargoSolicitante!.codCargo || null,
        cargoSolicitante: v.cargoSolicitante!.nombre,
        codDependenciaSolicitante: v.departamento!.codDepartamento || null,
        dependenciaSolicitante: v.departamento!.nombre,
        tipoAsignacion: v.tipoAsignacion,
        personaId: personas[asignado.cedula],
        codCargo: esCargo ? v.cargoAsignado!.codCargo : null,
        cargo: esCargo ? v.cargoAsignado!.nombre : null,
        choferPersonaId: personas[chofer.cedula],
        vehiculoId: v.vehiculoId!,
        proposito: v.proposito.trim(),
        destino: v.destino.trim() || null,
        fechaSalida: v.fechaSalida,
        fechaRetornoEstimada: v.fechaRetornoEstimada,
        adjuntos: v.adjuntos.map((a) => ({
          tipoDocumentoId: a.tipoDocumentoId!,
          nombreArchivo: a.archivo!.nombreArchivo,
          contentType: a.archivo!.contentType,
          fileBase64: a.archivo!.fileBase64,
        })),
      };

      // Las advertencias del vehículo se confirman antes de enviar.
      const advertencias = this.advertencias();
      if (
        advertencias.length > 0 &&
        !(await this.confirmarAdvertencias(advertencias.map((x) => x.mensaje)))
      ) {
        return;
      }
      asignacion.confirmarAdvertencias = advertencias.length > 0;

      try {
        await firstValueFrom(this.asignaciones.crear(asignacion));
      } catch (e) {
        // Pudo surgir una advertencia nueva entre la consulta y el registro: se pide confirmarla.
        if (
          esApiError(e) &&
          e.codigo === REQUIERE_CONFIRMACION &&
          !asignacion.confirmarAdvertencias
        ) {
          if (
            !(await this.confirmarAdvertencias([
              e.mensaje.replace(/^Confirme para continuar:\s*/, ''),
            ]))
          )
            return;
          try {
            await firstValueFrom(
              this.asignaciones.crear({ ...asignacion, confirmarAdvertencias: true }),
            );
          } catch (e2) {
            this.errorGeneral.set(aplicarErroresServidor(this.formulario, e2));
            return;
          }
        } else {
          this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
          return;
        }
      }

      this.notificaciones.exito('Asignación registrada. Queda pendiente de aprobación.');
      await this.router.navigate(['/asignaciones']);
    } finally {
      this.guardando.set(false);
    }
  }
}
