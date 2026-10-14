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
import { DatosProveedor, InventarioService } from '../inventario.service';

/** Alta (sin `id`) y edición (con `id`) de proveedores. */
@Component({
  selector: 'app-proveedor-formulario',
  imports: [ReactiveFormsModule, RouterLink, EncabezadoPagina, Campo, Cargando, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      routerLink="/proveedores"
      class="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-primario"
    >
      <app-icono nombre="izquierda" [tamano]="16" /> Proveedores
    </a>

    <app-encabezado-pagina
      seccion="Taller"
      [titulo]="esEdicion() ? 'Editar proveedor' : 'Nuevo proveedor'"
    />

    <form [formGroup]="formulario" (ngSubmit)="guardar()" novalidate class="space-y-6">
      @if (errorGeneral(); as mensaje) {
        <div
          class="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          <app-icono nombre="error" [tamano]="18" class="mt-0.5" />
          <span>{{ mensaje }}</span>
        </div>
      }

      <section class="tarjeta">
        <div class="grid gap-5 p-5 sm:grid-cols-2">
          <app-campo
            etiqueta="Nombre"
            para="nombre"
            [control]="c.nombre"
            requerido
            class="sm:col-span-2"
          >
            <input id="nombre" class="control" formControlName="nombre" />
          </app-campo>
          <app-campo etiqueta="RNC" para="rnc" [control]="c.rnc">
            <input id="rnc" class="control font-mono" formControlName="rnc" />
          </app-campo>
          <app-campo etiqueta="Persona de contacto" para="contacto" [control]="c.contacto">
            <input id="contacto" class="control" formControlName="contacto" />
          </app-campo>
          <app-campo etiqueta="Teléfono" para="telefono" [control]="c.telefono">
            <input id="telefono" type="tel" class="control" formControlName="telefono" />
          </app-campo>
          <app-campo etiqueta="Correo" para="correo" [control]="c.correo">
            <input id="correo" type="email" class="control" formControlName="correo" />
          </app-campo>
          <app-campo
            etiqueta="Dirección"
            para="direccion"
            [control]="c.direccion"
            class="sm:col-span-2"
          >
            <input id="direccion" class="control" formControlName="direccion" />
          </app-campo>
          <label class="flex cursor-pointer items-start gap-3 sm:col-span-2">
            <input
              type="checkbox"
              class="mt-0.5 size-4 rounded border-slate-300 accent-primario"
              formControlName="esTallerAutorizado"
            />
            <span>
              <span class="block text-sm font-medium text-slate-800">Taller autorizado</span>
              <span class="block text-xs text-slate-500">
                Concesionario o taller donde se pueden hacer mantenimientos externos, por ejemplo
                para conservar la garantía de un vehículo nuevo.
              </span>
            </span>
          </label>
          @if (esEdicion()) {
            <label class="flex cursor-pointer items-start gap-3 sm:col-span-2">
              <input
                type="checkbox"
                class="mt-0.5 size-4 rounded border-slate-300 accent-primario"
                formControlName="activo"
              />
              <span>
                <span class="block text-sm font-medium text-slate-800">Activo</span>
                <span class="block text-xs text-slate-500">
                  Desmárquelo para que no aparezca en entradas ni compras nuevas; conserva su
                  historial.
                </span>
              </span>
            </label>
          }
        </div>
      </section>

      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <a routerLink="/proveedores" class="btn btn-contorno">Cancelar</a>
        <button type="submit" class="btn btn-primario" [disabled]="guardando()">
          @if (guardando()) {
            <app-cargando class="text-current" />
          }
          {{ esEdicion() ? 'Guardar cambios' : 'Registrar proveedor' }}
        </button>
      </div>
    </form>
  `,
})
export class ProveedorFormulario {
  private readonly inventario = inject(InventarioService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    rnc: ['', Validators.maxLength(20)],
    telefono: ['', Validators.maxLength(20)],
    correo: ['', [Validators.email, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(300)],
    contacto: ['', Validators.maxLength(150)],
    esTallerAutorizado: [false],
    activo: [true],
  });
  protected readonly c = this.formulario.controls;

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);

  constructor() {
    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => this.inventario.obtenerProveedor(id).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((p) => {
        if (!p) {
          void this.router.navigate(['/proveedores']);
          return;
        }
        this.formulario.patchValue({
          nombre: p.nombre,
          rnc: p.rnc ?? '',
          telefono: p.telefono ?? '',
          correo: p.correo ?? '',
          direccion: p.direccion ?? '',
          contacto: p.contacto ?? '',
          esTallerAutorizado: p.esTallerAutorizado,
          activo: p.activo,
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
    const opcional = (s: string) => s.trim() || null;
    const datos: DatosProveedor = {
      nombre: v.nombre.trim(),
      rnc: opcional(v.rnc),
      telefono: opcional(v.telefono),
      correo: opcional(v.correo),
      direccion: opcional(v.direccion),
      contacto: opcional(v.contacto),
      esTallerAutorizado: v.esTallerAutorizado,
    };

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(
          this.inventario.actualizarProveedor(id, { ...datos, activo: v.activo }),
        );
        this.notificaciones.exito(`Proveedor ${datos.nombre} actualizado.`);
      } else {
        await firstValueFrom(this.inventario.crearProveedor(datos));
        this.notificaciones.exito(`Proveedor ${datos.nombre} registrado.`);
      }
      await this.router.navigate(['/proveedores']);
    } catch (e) {
      this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
    } finally {
      this.guardando.set(false);
    }
  }
}
