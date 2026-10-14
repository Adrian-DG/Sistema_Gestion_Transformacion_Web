import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { MiembroSipffaa, SipffaaService } from '../../../core/sipffaa/sipffaa.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { BuscadorSipffaa } from '../../../shared/sipffaa/buscador-sipffaa';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { EstadoBadge } from '../../../shared/ui/estado-badge/estado-badge';
import { Icono } from '../../../shared/ui/icono/icono';
import { InventarioService } from '../../inventario/inventario.service';
import { GarantiaVehiculo, LUGARES, TIPOS_SOLICITUD, TallerService } from '../taller.service';

const INTERNO = 1;
const EXTERNO = 2;
const EVALUACION_BAJA = 3;

/**
 * Registro de la solicitud de taller (queda Pendiente; el vehículo no cambia hasta el ingreso).
 * Se atiende en el taller de la institución o en un taller autorizado; si el vehículo está en
 * garantía se propone su concesionario y se advierte al elegir el interno. El kilometraje es
 * obligatorio y no puede ser menor que el último registrado. `?vehiculo=<id>` preselecciona el vehículo.
 */
@Component({
  selector: 'app-solicitud-taller-formulario',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    EstadoBadge,
    Icono,
    BuscadorSipffaa,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-taller-formulario.html',
})
export class SolicitudTallerFormulario {
  private readonly taller = inject(TallerService);
  private readonly inventario = inject(InventarioService);
  private readonly sipffaa = inject(SipffaaService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Vehículo preseleccionado (?vehiculo=). */
  readonly vehiculo = input<string>();

  protected readonly tipos = TIPOS_SOLICITUD;
  protected readonly lugares = LUGARES;
  protected readonly EXTERNO = EXTERNO;
  protected readonly EVALUACION_BAJA = EVALUACION_BAJA;

  protected readonly formulario = this.fb.group({
    vehiculoId: this.fb.control<string | null>(null, Validators.required),
    tipo: this.fb.control<number>(TIPOS_SOLICITUD[0].valor),
    lugar: this.fb.control<number>(INTERNO),
    tallerExternoId: this.fb.control<string | null>(null),
    solicitante: this.fb.control<MiembroSipffaa | null>(null, Validators.required),
    motivo: ['', [Validators.required, Validators.maxLength(1000)]],
    kilometraje: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
  });
  protected readonly c = this.formulario.controls;

  protected readonly vehiculos = toSignal(
    this.catalogos.vehiculos().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly talleres = toSignal(
    this.inventario.catalogoProveedores(true).pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  /** Kilometraje y garantía del vehículo elegido. */
  protected readonly garantia = toSignal(
    this.c.vehiculoId.valueChanges.pipe(
      switchMap((id) =>
        id ? this.taller.garantia(id).pipe(catchError(() => of(null))) : of(null),
      ),
    ),
    { initialValue: null },
  );

  private readonly valores = toSignal(this.formulario.valueChanges.pipe(startWith(null)));
  /**
   * Vehículo en garantía que se atendería en el taller interno: puede perder la garantía. No aplica
   * a la evaluación de baja, que siempre es interna.
   */
  protected readonly riesgoGarantia = computed(() => {
    this.valores();
    return (
      !!this.garantia()?.enGarantia &&
      this.c.lugar.value !== EXTERNO &&
      this.c.tipo.value !== EVALUACION_BAJA
    );
  });

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.vehiculo();
      if (id) this.c.vehiculoId.setValue(id);
    });

    // Con la garantía del vehículo se propone el concesionario y el kilometraje mínimo.
    effect(() => {
      const g = this.garantia();
      if (!g) return;
      this.c.kilometraje.setValidators([Validators.required, Validators.min(g.kilometraje)]);
      if ((this.c.kilometraje.value ?? 0) < g.kilometraje)
        this.c.kilometraje.setValue(g.kilometraje);
      this.c.kilometraje.updateValueAndValidity();
      if (g.enGarantia && g.garantiaTallerId && this.c.tipo.value !== EVALUACION_BAJA) {
        this.c.lugar.setValue(EXTERNO);
        this.c.tallerExternoId.setValue(g.garantiaTallerId);
      }
    });

    // El taller autorizado se exige solo en las externas; la evaluación de baja es siempre interna.
    this.c.lugar.valueChanges.pipe(takeUntilDestroyed()).subscribe((lugar) => {
      const externo = lugar === EXTERNO;
      this.c.tallerExternoId.setValidators(externo ? Validators.required : null);
      if (!externo) this.c.tallerExternoId.setValue(null);
      else if (!this.c.tallerExternoId.value) {
        this.c.tallerExternoId.setValue(this.garantia()?.garantiaTallerId ?? null);
      }
      this.c.tallerExternoId.updateValueAndValidity();
    });
    this.c.tipo.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      if (tipo === EVALUACION_BAJA) this.c.lugar.setValue(INTERNO);
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
    this.guardando.set(true);
    try {
      let solicitantePersonaId: string;
      try {
        solicitantePersonaId = await firstValueFrom(
          this.sipffaa.importarPersona(v.solicitante!.cedula),
        );
      } catch (e) {
        this.errorGeneral.set(
          `No se pudo registrar el solicitante desde SIPFFAA${esApiError(e) ? `: ${e.mensaje}` : '.'}`,
        );
        return;
      }

      try {
        const { id, numero } = await firstValueFrom(
          this.taller.crear({
            vehiculoId: v.vehiculoId!,
            tipo: v.tipo,
            solicitantePersonaId,
            motivo: v.motivo.trim(),
            kilometraje: v.kilometraje!,
            lugar: v.lugar,
            tallerExternoId: v.lugar === EXTERNO ? v.tallerExternoId : null,
          }),
        );
        this.notificaciones.exito(
          `Solicitud ${numero} registrada. Queda pendiente del ingreso al taller.`,
        );
        await this.router.navigate(['/taller', id]);
      } catch (e) {
        this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
      }
    } finally {
      this.guardando.set(false);
    }
  }

  protected garantiaTexto(g: GarantiaVehiculo): string {
    const partes = [
      g.garantiaVence ? `vence el ${g.garantiaVence.split('-').reverse().join('/')}` : null,
    ];
    if (g.garantiaKilometraje)
      partes.push(`o a los ${g.garantiaKilometraje.toLocaleString('es-DO')} km`);
    return partes.filter(Boolean).join(' ');
  }
}
