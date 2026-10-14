import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, of, startWith } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import {
  CargoSipffaa,
  DepartamentoSipffaa,
  MiembroSipffaa,
  SipffaaService,
} from '../../../core/sipffaa/sipffaa.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import {
  ArchivoSeleccionado,
  SelectorArchivo,
} from '../../../shared/formularios/selector-archivo';
import { BuscadorSipffaa } from '../../../shared/sipffaa/buscador-sipffaa';
import { cargoDe, departamentoDe } from '../../../shared/sipffaa/datos-miembro';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import {
  CombustibleService,
  NOMBRE_COMBUSTIBLE,
  NuevaSolicitudTicket,
  TIPO_BENEFICIARIO,
  TIPO_COMBUSTIBLE,
  TipoCombustible,
} from '../combustible.service';

/** Igual que CreateSolicitudTicketCommandValidator.MaximoTickets. */
const MAXIMO_TICKETS = 100;

type Linea = FormGroup<{
  tipoCombustible: FormControl<TipoCombustible>;
  galones: FormControl<number | null>;
  cantidad: FormControl<number | null>;
}>;

type Adjunto = FormGroup<{
  tipoDocumentoId: FormControl<string | null>;
  archivo: FormControl<ArchivoSeleccionado | null>;
}>;

/** "TC-2026-000124" + 4 → "TC-2026-000128", con el mismo ancho. */
function sumarANumero(numero: string, n: number): string {
  const m = /^(.*?)(\d+)$/.exec(numero);
  if (!m) return numero;
  return m[1] + String(Number(m[2]) + n).padStart(m[2].length, '0');
}

/**
 * Solicitud de tickets de combustible. Solicitante y beneficiario se eligen en SIPFFAA y se
 * registran (o reutilizan) como personas al guardar. Los números de ticket los genera la API en
 * secuencia al registrar; la solicitud queda Pendiente hasta su aprobación.
 */
@Component({
  selector: 'app-solicitud-ticket-formulario',
  imports: [
    DecimalPipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorArchivo,
    BuscadorSipffaa,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-ticket-formulario.html',
})
export class SolicitudTicketFormulario {
  private readonly combustible = inject(CombustibleService);
  private readonly sipffaa = inject(SipffaaService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly beneficiarios = TIPO_BENEFICIARIO;
  protected readonly combustibles = Object.values(TIPO_COMBUSTIBLE);
  protected readonly nombreCombustible = NOMBRE_COMBUSTIBLE;

  protected readonly formulario = this.fb.group({
    solicitante: this.fb.control<MiembroSipffaa | null>(null, Validators.required),
    cargoSolicitante: this.fb.control<CargoSipffaa | null>(null, Validators.required),
    departamento: this.fb.control<DepartamentoSipffaa | null>(null, Validators.required),

    tipoBeneficiario: this.fb.control<number>(TIPO_BENEFICIARIO.Persona),
    mismoSolicitante: [true],
    beneficiario: this.fb.control<MiembroSipffaa | null>(null),
    cargoBeneficiario: this.fb.control<CargoSipffaa | null>(null),

    lineas: this.fb.array<Linea>([]),
    proposito: ['', [Validators.required, Validators.maxLength(500)]],
    adjuntos: this.fb.array<Adjunto>([]),
  });

  protected readonly tiposDocumento = toSignal(
    this.catalogos.tiposDocumento().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly existencias = toSignal(
    this.combustible.existencia().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly siguienteNumero = toSignal(
    this.combustible.siguienteNumero().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  protected readonly v = computed(() => {
    this.valores();
    return this.formulario.getRawValue();
  });

  protected readonly cantidadTickets = computed(() =>
    this.v().lineas.reduce((total, l) => total + (l.cantidad ?? 0), 0),
  );

  /** Galones pedidos por tipo, comparados con lo disponible para comprometer en tickets. */
  protected readonly resumenCombustible = computed(() =>
    this.combustibles
      .map((tipo) => {
        const galones = this.v()
          .lineas.filter((l) => l.tipoCombustible === tipo)
          .reduce((total, l) => total + (l.galones ?? 0) * (l.cantidad ?? 0), 0);
        const disponible =
          this.existencias().find((e) => e.tipoCombustible === tipo)?.disponibleParaDespacho ?? null;
        return { tipo, galones, disponible, excede: disponible !== null && galones > disponible };
      })
      .filter((r) => r.galones > 0),
  );

  /** Números que recibirían los tickets si nadie registra otra solicitud antes. */
  protected readonly numerosPrevistos = computed(() => {
    const primero = this.siguienteNumero();
    const n = this.cantidadTickets();
    if (!primero || n === 0) return null;
    return n === 1 ? primero : `${primero} a ${sumarANumero(primero, n - 1)}`;
  });

  constructor() {
    this.agregarLinea();
    this.agregarAdjunto();
    const c = this.formulario.controls;

    // El primer adjunto se crea antes de que llegue el catálogo: se completa su tipo sugerido.
    this.catalogos
      .tiposDocumento()
      .pipe(catchError(() => of([])), takeUntilDestroyed())
      .subscribe((tipos) => {
        const sugerido = tipos.find((t) => /solicitud de tickets/i.test(t.nombre))?.id;
        if (!sugerido) return;
        for (const adjunto of this.adjuntos.controls) {
          if (!adjunto.controls.tipoDocumentoId.value) adjunto.controls.tipoDocumentoId.setValue(sugerido);
        }
      });

    // Al elegir el solicitante se proponen su cargo y departamento de SIPFFAA (se pueden cambiar).
    c.solicitante.valueChanges.pipe(takeUntilDestroyed()).subscribe((miembro) => {
      if (!miembro) return;
      c.cargoSolicitante.setValue(cargoDe(miembro));
      c.departamento.setValue(departamentoDe(miembro));
    });

    // Beneficiario: una persona (el solicitante u otra) o un cargo, nunca ambos.
    const actualizarBeneficiario = () => {
      const esCargo = c.tipoBeneficiario.value === TIPO_BENEFICIARIO.Cargo;
      c.beneficiario.setValidators(!esCargo && !c.mismoSolicitante.value ? Validators.required : null);
      c.cargoBeneficiario.setValidators(esCargo ? Validators.required : null);
      if (esCargo || c.mismoSolicitante.value) c.beneficiario.setValue(null, { emitEvent: false });
      if (!esCargo) c.cargoBeneficiario.setValue(null, { emitEvent: false });
      c.beneficiario.updateValueAndValidity({ emitEvent: false });
      c.cargoBeneficiario.updateValueAndValidity({ emitEvent: false });
    };
    c.tipoBeneficiario.valueChanges.pipe(takeUntilDestroyed()).subscribe(actualizarBeneficiario);
    c.mismoSolicitante.valueChanges.pipe(takeUntilDestroyed()).subscribe(actualizarBeneficiario);
  }

  protected get lineas(): FormArray<Linea> {
    return this.formulario.controls.lineas;
  }

  protected get adjuntos(): FormArray<Adjunto> {
    return this.formulario.controls.adjuntos;
  }

  protected agregarLinea(): void {
    this.lineas.push(
      this.fb.group({
        tipoCombustible: this.fb.control<TipoCombustible>(TIPO_COMBUSTIBLE.Gasolina),
        galones: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
        cantidad: this.fb.control<number | null>(1, [
          Validators.required,
          Validators.min(1),
          Validators.max(MAXIMO_TICKETS),
        ]),
      }),
    );
  }

  protected quitarLinea(indice: number): void {
    this.lineas.removeAt(indice);
  }

  protected agregarAdjunto(): void {
    const sugerido =
      this.tiposDocumento().find((t) => /solicitud de tickets/i.test(t.nombre))?.id ?? null;
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
    if (this.lineas.length === 0) {
      this.errorGeneral.set('Debe solicitar al menos un ticket.');
      return;
    }
    if (this.cantidadTickets() > MAXIMO_TICKETS) {
      this.errorGeneral.set(`Una solicitud no puede tener más de ${MAXIMO_TICKETS} tickets.`);
      return;
    }
    if (this.adjuntos.length === 0) {
      this.errorGeneral.set('Debe adjuntar el documento de solicitud de los tickets.');
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const solicitante = v.solicitante!;
    const esCargo = v.tipoBeneficiario === TIPO_BENEFICIARIO.Cargo;
    const beneficiario = esCargo ? null : v.mismoSolicitante ? solicitante : v.beneficiario!;

    this.guardando.set(true);
    try {
      // Personas del sistema para cada cédula (se crean desde SIPFFAA si no existen).
      let personas: Record<string, string>;
      try {
        const cedulas = [...new Set([solicitante.cedula, ...(beneficiario ? [beneficiario.cedula] : [])])];
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

      const solicitud: NuevaSolicitudTicket = {
        tipoBeneficiario: v.tipoBeneficiario,
        codCargo: esCargo ? v.cargoBeneficiario!.codCargo : null,
        cargo: esCargo ? v.cargoBeneficiario!.nombre : null,
        personaId: beneficiario ? personas[beneficiario.cedula] : null,
        solicitantePersonaId: personas[solicitante.cedula],
        codCargoSolicitante: v.cargoSolicitante!.codCargo || null,
        cargoSolicitante: v.cargoSolicitante!.nombre,
        codDependenciaSolicitante: v.departamento!.codDepartamento || null,
        dependenciaSolicitante: v.departamento!.nombre,
        proposito: v.proposito.trim(),
        tickets: v.lineas.map((l) => ({
          tipoCombustible: l.tipoCombustible,
          galones: l.galones!,
          cantidad: l.cantidad!,
        })),
        adjuntos: v.adjuntos.map((a) => ({
          tipoDocumentoId: a.tipoDocumentoId!,
          nombreArchivo: a.archivo!.nombreArchivo,
          contentType: a.archivo!.contentType,
          fileBase64: a.archivo!.fileBase64,
        })),
      };

      let numeros: string[];
      try {
        ({ numeros } = await firstValueFrom(this.combustible.crearSolicitud(solicitud)));
      } catch (e) {
        this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
        return;
      }

      const rango = numeros.length === 1 ? numeros[0] : `${numeros[0]} a ${numeros[numeros.length - 1]}`;
      this.notificaciones.exito(`Solicitud registrada con los tickets ${rango}. Queda pendiente de aprobación.`);
      await this.router.navigate(['/combustible']);
    } finally {
      this.guardando.set(false);
    }
  }
}
