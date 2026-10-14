import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, of, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { MiembroSipffaa, SipffaaService } from '../../../core/sipffaa/sipffaa.service';
import { SEXOS } from '../../../shared/catalogos/enumeraciones';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { BuscadorSipffaa } from '../../../shared/sipffaa/buscador-sipffaa';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { Mecanico, TallerService } from '../taller.service';

type Origen = 'sipffaa' | 'civil';

/**
 * Alta y edición de mecánicos. Alta: militares (y civiles registrados) desde SIPFFAA, o civiles
 * que no están en SIPFFAA con sus datos a mano. Edición: especialidad, teléfono y estado.
 */
@Component({
  selector: 'app-mecanico-formulario',
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
  templateUrl: './mecanico-formulario.html',
})
export class MecanicoFormulario {
  private readonly taller = inject(TallerService);
  private readonly sipffaa = inject(SipffaaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());
  protected readonly sexos = SEXOS;

  protected readonly origen = signal<Origen>('sipffaa');
  protected readonly mecanico = signal<Mecanico | null>(null);

  protected readonly formulario = this.fb.group({
    miembro: this.fb.control<MiembroSipffaa | null>(null),
    identificacion: ['', Validators.maxLength(20)],
    nombre: ['', Validators.maxLength(100)],
    apellido: ['', Validators.maxLength(100)],
    sexo: this.fb.control<number>(SEXOS[0].valor),
    telefono: ['', Validators.maxLength(20)],
    especialidad: ['', Validators.maxLength(100)],
    activo: [true],
  });
  protected readonly c = this.formulario.controls;

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  constructor() {
    this.aplicarOrigen('sipffaa');

    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => this.taller.mecanico(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((m) => {
        if (!m) {
          void this.router.navigate(['/mecanicos']);
          return;
        }
        this.mecanico.set(m);
        this.c.miembro.clearValidators();
        this.c.miembro.updateValueAndValidity();
        this.formulario.patchValue({
          telefono: m.telefono ?? '',
          especialidad: m.especialidad ?? '',
          activo: m.activo,
        });
      });
  }

  /** SIPFFAA exige el miembro; civil exige identificación, nombre y apellido. */
  protected aplicarOrigen(origen: Origen): void {
    this.origen.set(origen);
    const civil = origen === 'civil';
    this.c.miembro.setValidators(civil ? null : Validators.required);
    for (const control of [this.c.identificacion, this.c.nombre, this.c.apellido]) {
      if (civil) control.addValidators(Validators.required);
      else control.removeValidators(Validators.required);
      control.updateValueAndValidity();
    }
    this.c.miembro.updateValueAndValidity();
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const especialidad = v.especialidad.trim() || null;
    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(
          this.taller.actualizarMecanico(id, {
            especialidad,
            telefono: v.telefono.trim() || null,
            activo: v.activo,
          }),
        );
        this.notificaciones.exito('Mecánico actualizado.');
        await this.router.navigate(['/mecanicos']);
        return;
      }

      let personaId: string | null = null;
      if (this.origen() === 'sipffaa') {
        try {
          personaId = await firstValueFrom(this.sipffaa.importarPersona(v.miembro!.cedula));
        } catch (e) {
          this.errorGeneral.set(
            `No se pudo registrar la persona desde SIPFFAA${esApiError(e) ? `: ${e.mensaje}` : '.'}`,
          );
          return;
        }
      }

      await firstValueFrom(
        this.taller.crearMecanico({
          personaId,
          civil:
            this.origen() === 'civil'
              ? {
                  identificacion: v.identificacion.trim(),
                  nombre: v.nombre.trim(),
                  apellido: v.apellido.trim(),
                  sexo: v.sexo,
                  telefono: v.telefono.trim() || null,
                }
              : null,
          especialidad,
        }),
      );
      this.notificaciones.exito('Mecánico registrado.');
      await this.router.navigate(['/mecanicos']);
    } catch (e) {
      this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
    } finally {
      this.guardando.set(false);
    }
  }
}
