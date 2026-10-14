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
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { APARIENCIA_PREDETERMINADA } from '../../../core/apariencia/apariencia.model';
import { AparienciaService } from '../../../core/apariencia/apariencia.service';
import { normalizarHex } from '../../../core/apariencia/colores';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import {
  ArchivoSeleccionado,
  SelectorArchivo,
} from '../../../shared/formularios/selector-archivo';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { AparienciaDetalle, AparienciasService, DatosApariencia } from '../apariencias.service';
import { VistaPreviaApariencia } from '../vista-previa/vista-previa-apariencia';

const colorHex = (control: AbstractControl<string>): ValidationErrors | null =>
  normalizarHex(control.value) ? null : { hex: true };

type ClaveColor =
  | 'colorPrimario'
  | 'colorSecundario'
  | 'colorBotonPrimario'
  | 'colorBotonSecundario'
  | 'colorBotonPeligro';

const COLORES: { clave: ClaveColor; etiqueta: string; ayuda: string }[] = [
  { clave: 'colorPrimario', etiqueta: 'Primario', ayuda: 'Barra superior, títulos y enlaces.' },
  { clave: 'colorSecundario', etiqueta: 'Secundario', ayuda: 'Detalles y acentos.' },
  { clave: 'colorBotonPrimario', etiqueta: 'Botón primario', ayuda: 'Acción principal (Guardar).' },
  { clave: 'colorBotonSecundario', etiqueta: 'Botón secundario', ayuda: 'Acciones alternativas.' },
  { clave: 'colorBotonPeligro', etiqueta: 'Botón de peligro', ayuda: 'Desactivar, rechazar, etc.' },
];

/**
 * Alta (sin `id`) y edición (con `id`) de una apariencia. Al guardar vuelve al listado; si la
 * apariencia es la activa, el cambio se aplica de inmediato a todos los usuarios.
 */
@Component({
  selector: 'app-apariencia-formulario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorArchivo,
    VistaPreviaApariencia,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './apariencia-formulario.html',
})
export class AparienciaFormulario {
  private readonly apariencias = inject(AparienciasService);
  private readonly aparienciaActiva = inject(AparienciaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro de la ruta; ausente al crear. */
  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());
  protected readonly colores = COLORES;

  protected readonly formulario = this.fb.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    descripcion: ['', [Validators.maxLength(300)]],
    nombreSistema: [
      APARIENCIA_PREDETERMINADA.nombreSistema,
      [Validators.required, Validators.maxLength(150)],
    ],
    nombreCorto: [APARIENCIA_PREDETERMINADA.nombreCorto ?? '', [Validators.maxLength(30)]],
    nombreInstitucion: [
      APARIENCIA_PREDETERMINADA.nombreInstitucion ?? '',
      [Validators.maxLength(200)],
    ],
    colorPrimario: [APARIENCIA_PREDETERMINADA.colorPrimario, [Validators.required, colorHex]],
    colorSecundario: [APARIENCIA_PREDETERMINADA.colorSecundario, [Validators.required, colorHex]],
    colorBotonPrimario: [APARIENCIA_PREDETERMINADA.colorBotonPrimario, [Validators.required, colorHex]],
    colorBotonSecundario: [
      APARIENCIA_PREDETERMINADA.colorBotonSecundario,
      [Validators.required, colorHex],
    ],
    colorBotonPeligro: [APARIENCIA_PREDETERMINADA.colorBotonPeligro, [Validators.required, colorHex]],
    logo: this.fb.control<ArchivoSeleccionado | null>(null),
  });

  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly original = signal<AparienciaDetalle | null>(null);

  /** Logo guardado (blob local) y si el usuario pidió quitarlo. */
  private readonly logoGuardadoUrl = signal<string | null>(null);
  protected readonly quitarLogoGuardado = signal(false);
  protected readonly tieneLogoGuardado = computed(
    () => !!this.original()?.tieneLogo && !this.quitarLogoGuardado(),
  );

  /** Valores del formulario para la vista previa en vivo. */
  protected readonly valores = toSignal(
    this.formulario.valueChanges.pipe(startWith(null)),
    { initialValue: null },
  );
  protected readonly vistaPrevia = computed(() => {
    this.valores();
    return this.formulario.getRawValue();
  });
  protected readonly logoVistaPrevia = computed(() => {
    const nuevo = this.vistaPrevia().logo;
    if (nuevo) return `data:${nuevo.contentType};base64,${nuevo.fileBase64}`;
    return this.tieneLogoGuardado() ? this.logoGuardadoUrl() : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      const url = this.logoGuardadoUrl();
      if (url) URL.revokeObjectURL(url);
    });

    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.cargando.set(true);
          return this.apariencias.obtener(id).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((apariencia) => {
        this.cargando.set(false);
        if (!apariencia) {
          void this.router.navigate(['/apariencia']);
          return;
        }

        this.original.set(apariencia);
        this.formulario.patchValue({
          nombre: apariencia.nombre,
          descripcion: apariencia.descripcion ?? '',
          nombreSistema: apariencia.nombreSistema,
          nombreCorto: apariencia.nombreCorto ?? '',
          nombreInstitucion: apariencia.nombreInstitucion ?? '',
          colorPrimario: apariencia.colorPrimario,
          colorSecundario: apariencia.colorSecundario,
          colorBotonPrimario: apariencia.colorBotonPrimario,
          colorBotonSecundario: apariencia.colorBotonSecundario,
          colorBotonPeligro: apariencia.colorBotonPeligro,
        });
        if (apariencia.tieneLogo) void this.cargarLogo(apariencia.id);
      });
  }

  /** Valor para `<input type="color">`, que solo acepta #rrggbb. */
  protected valorSelector(clave: ClaveColor): string {
    this.valores();
    return (normalizarHex(this.formulario.controls[clave].value) ?? '#000000').toLowerCase();
  }

  protected elegirColor(clave: ClaveColor, valor: string): void {
    const control = this.formulario.controls[clave];
    control.setValue(valor.toUpperCase());
    control.markAsTouched();
  }

  /** Vuelve textos y colores a los institucionales; nombre, descripción y logo se conservan. */
  protected usarValoresInstitucionales(): void {
    const p = APARIENCIA_PREDETERMINADA;
    this.formulario.patchValue({
      nombreSistema: p.nombreSistema,
      nombreCorto: p.nombreCorto ?? '',
      nombreInstitucion: p.nombreInstitucion ?? '',
      colorPrimario: p.colorPrimario,
      colorSecundario: p.colorSecundario,
      colorBotonPrimario: p.colorBotonPrimario,
      colorBotonSecundario: p.colorBotonSecundario,
      colorBotonPeligro: p.colorBotonPeligro,
    });
    this.formulario.markAsDirty();
  }

  protected async guardar(): Promise<void> {
    this.errorGeneral.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      document.querySelector<HTMLElement>('.ng-invalid:not(form)')?.focus();
      return;
    }

    const v = this.formulario.getRawValue();
    const datos: DatosApariencia = {
      nombre: v.nombre.trim(),
      descripcion: v.descripcion.trim() || null,
      nombreSistema: v.nombreSistema.trim(),
      nombreCorto: v.nombreCorto.trim() || null,
      nombreInstitucion: v.nombreInstitucion.trim() || null,
      colorPrimario: normalizarHex(v.colorPrimario)!,
      colorSecundario: normalizarHex(v.colorSecundario)!,
      colorBotonPrimario: normalizarHex(v.colorBotonPrimario)!,
      colorBotonSecundario: normalizarHex(v.colorBotonSecundario)!,
      colorBotonPeligro: normalizarHex(v.colorBotonPeligro)!,
    };

    this.guardando.set(true);
    try {
      let id = this.id();
      try {
        if (id) {
          await firstValueFrom(this.apariencias.actualizar(id, datos));
        } else {
          id = await firstValueFrom(this.apariencias.crear(datos));
        }
      } catch (e) {
        this.errorGeneral.set(aplicarErroresServidor(this.formulario, e));
        return;
      }

      // El logo se guarda aparte; si falla, los datos ya quedaron guardados.
      try {
        if (v.logo) {
          await firstValueFrom(
            this.apariencias.subirLogo(id, { nombreArchivo: v.logo.nombreArchivo, fileBase64: v.logo.fileBase64 }),
          );
        } else if (this.quitarLogoGuardado()) {
          await firstValueFrom(this.apariencias.quitarLogo(id));
        }
      } catch (e) {
        this.notificaciones.advertencia(
          `La apariencia se guardó, pero no se pudo actualizar el logo${esApiError(e) ? `: ${e.mensaje}` : '.'}`,
        );
      }

      if (this.original()?.esActiva) {
        await this.aparienciaActiva.refrescar();
      }

      this.notificaciones.exito(
        this.original()?.esActiva
          ? 'Apariencia actualizada. Los cambios ya se aplican en el sistema.'
          : this.esEdicion()
            ? 'Apariencia actualizada.'
            : 'Apariencia creada. Actívela desde el listado cuando quiera usarla.',
      );
      await this.router.navigate(['/apariencia']);
    } finally {
      this.guardando.set(false);
    }
  }

  private async cargarLogo(id: string): Promise<void> {
    try {
      const blob = await firstValueFrom(this.apariencias.logo(id));
      this.logoGuardadoUrl.set(URL.createObjectURL(blob));
    } catch {
      // La vista previa se muestra sin logo.
    }
  }
}
