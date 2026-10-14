import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { MiembroSipffaa, SipffaaService } from '../../../core/sipffaa/sipffaa.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { BuscadorSipffaa } from '../../../shared/sipffaa/buscador-sipffaa';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { TIPOS_SOLICITUD, TallerService } from '../taller.service';

/**
 * Registro de la solicitud de taller (queda Pendiente; el vehículo no cambia hasta el ingreso).
 * El solicitante se elige en SIPFFAA. `?vehiculo=<id>` preselecciona el vehículo.
 */
@Component({
  selector: 'app-solicitud-taller-formulario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    BuscadorSipffaa,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './solicitud-taller-formulario.html',
})
export class SolicitudTallerFormulario {
  private readonly taller = inject(TallerService);
  private readonly sipffaa = inject(SipffaaService);
  private readonly catalogos = inject(CatalogosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Vehículo preseleccionado (?vehiculo=). */
  readonly vehiculo = input<string>();

  protected readonly tipos = TIPOS_SOLICITUD;

  protected readonly formulario = this.fb.group({
    vehiculoId: this.fb.control<string | null>(null, Validators.required),
    tipo: this.fb.control<number>(TIPOS_SOLICITUD[0].valor),
    solicitante: this.fb.control<MiembroSipffaa | null>(null, Validators.required),
    motivo: ['', [Validators.required, Validators.maxLength(1000)]],
    kilometraje: this.fb.control<number | null>(null, Validators.min(0)),
  });
  protected readonly c = this.formulario.controls;

  protected readonly vehiculos = toSignal(
    this.catalogos.vehiculos().pipe(catchError(() => of([]))),
    {
      initialValue: [],
    },
  );

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.vehiculo();
      if (id) this.c.vehiculoId.setValue(id);
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
            kilometraje: v.kilometraje,
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
}
