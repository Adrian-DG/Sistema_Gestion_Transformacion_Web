import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, filter, firstValueFrom, of, startWith, switchMap } from 'rxjs';
import { esApiError } from '../../../core/api/api';
import { CatalogosService } from '../../../core/catalogos/catalogos.service';
import { NotificacionesService } from '../../../core/notificaciones/notificaciones.service';
import {
  INSTITUCIONES,
  INSTITUCION_ARMADA,
  SEXOS,
  valorPorCodigo,
} from '../../../shared/catalogos/enumeraciones';
import { Campo } from '../../../shared/formularios/campo';
import { aplicarErroresServidor } from '../../../shared/formularios/errores-servidor';
import { Cargando } from '../../../shared/ui/cargando/cargando';
import { EncabezadoPagina } from '../../../shared/ui/encabezado-pagina/encabezado-pagina';
import { Icono } from '../../../shared/ui/icono/icono';
import { SelectorPermisos } from '../selector-permisos/selector-permisos';
import { DatosUsuario, UsuariosService } from '../usuarios.service';

/** Reglas de contraseña de ASP.NET Identity (configuración por defecto del backend) y mínimo de 8. */
const contrasenaSegura: ValidatorFn = (
  control: AbstractControl<string>,
): ValidationErrors | null => {
  const valor = control.value ?? '';
  if (!valor) return null;

  const faltantes = [
    valor.length < 8 && 'al menos 8 caracteres',
    !/[A-Z]/.test(valor) && 'una mayúscula',
    !/[a-z]/.test(valor) && 'una minúscula',
    !/\d/.test(valor) && 'un número',
    !/[^A-Za-z0-9]/.test(valor) && 'un símbolo',
  ].filter(Boolean);

  return faltantes.length ? { contrasena: `Debe tener ${faltantes.join(', ')}.` } : null;
};

const coincideCon =
  (otro: string): ValidatorFn =>
  (control) => {
    const original = control.parent?.get(otro)?.value;
    return control.value && control.value !== original
      ? { coincide: 'Las contraseñas no coinciden.' }
      : null;
  };

/**
 * Errores de Identity y de la API que corresponden a un campo concreto
 * (códigos "Usuario.DuplicateEmail", "Usuario.PasswordRequiresDigit", etc.).
 */
const CAMPO_POR_CODIGO: [RegExp, string][] = [
  [/UserName/i, 'userName'],
  [/Email/i, 'email'],
  [/Identificacion/i, 'identificacion'],
  [/Password/i, 'password'],
  [/Rango/i, 'rangoId'],
];

/** Alta (sin `id`) y edición (con `id`) de usuarios. */
@Component({
  selector: 'app-usuario-formulario',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EncabezadoPagina,
    Campo,
    Cargando,
    Icono,
    SelectorPermisos,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './usuario-formulario.html',
})
export class UsuarioFormulario {
  private readonly usuarios = inject(UsuariosService);
  private readonly router = inject(Router);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Parámetro de la ruta; ausente al crear. */
  readonly id = input<string>();
  protected readonly esEdicion = computed(() => !!this.id());

  protected readonly sexos = SEXOS;
  protected readonly instituciones = INSTITUCIONES;

  protected readonly formulario = this.fb.group({
    identificacion: ['', [Validators.required, Validators.maxLength(20)]],
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    apellido: ['', [Validators.required, Validators.maxLength(100)]],
    sexo: this.fb.control<number | null>(null, Validators.required),
    institucion: this.fb.control<number | null>(null, Validators.required),
    rangoId: this.fb.control<string | null>(null),
    userName: [
      '',
      [Validators.required, Validators.maxLength(50), Validators.pattern(/^[a-zA-Z0-9._@-]+$/)],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    telefono: ['', [Validators.maxLength(20)]],
    password: ['', [Validators.required, contrasenaSegura]],
    confirmacion: ['', [Validators.required, coincideCon('password')]],
  });

  protected readonly permisos = signal<string[]>([]);
  protected readonly disponibles = toSignal(
    this.usuarios.permisos().pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly nombreActual = signal('');

  /** Los rangos se muestran con la denominación de la Armada cuando la institución es ARD. */
  private readonly rangos = toSignal(
    inject(CatalogosService)
      .rangos()
      .pipe(catchError(() => of([]))),
    {
      initialValue: [],
    },
  );
  private readonly institucion = toSignal(
    this.formulario.controls.institucion.valueChanges.pipe(
      startWith(this.formulario.controls.institucion.value),
    ),
  );
  protected readonly opcionesRango = computed(() => {
    const armada = this.institucion() === INSTITUCION_ARMADA;
    return this.rangos()
      .map((r) => ({ id: r.id, nombre: (armada && r.nombreArmada) || r.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  constructor() {
    // Mantiene la confirmación al día si se cambia la contraseña después.
    this.formulario.controls.password.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() =>
        this.formulario.controls.confirmacion.updateValueAndValidity({ emitEvent: false }),
      );

    toObservable(this.id)
      .pipe(
        filter((id): id is string => !!id),
        switchMap((id) => {
          this.cargando.set(true);
          return this.usuarios.obtener(id).pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((usuario) => {
        this.cargando.set(false);
        if (!usuario) {
          void this.router.navigate(['/usuarios']);
          return;
        }

        // En edición la contraseña no se cambia aquí.
        this.formulario.controls.password.disable();
        this.formulario.controls.confirmacion.disable();
        this.nombreActual.set(`${usuario.nombre} ${usuario.apellido}`);
        this.formulario.patchValue({
          identificacion: usuario.identificacion,
          nombre: usuario.nombre,
          apellido: usuario.apellido,
          sexo: valorPorCodigo(SEXOS, usuario.sexo),
          institucion: valorPorCodigo(INSTITUCIONES, usuario.institucion),
          rangoId: usuario.rangoId,
          userName: usuario.userName,
          email: usuario.email ?? '',
          telefono: usuario.telefono ?? '',
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

    const valores = this.formulario.getRawValue();
    const datos: DatosUsuario = {
      identificacion: valores.identificacion.trim(),
      nombre: valores.nombre.trim(),
      apellido: valores.apellido.trim(),
      sexo: valores.sexo!,
      institucion: valores.institucion!,
      rangoId: valores.rangoId || null,
      userName: valores.userName.trim(),
      email: valores.email.trim(),
      telefono: valores.telefono.trim() || null,
    };

    this.guardando.set(true);
    try {
      const id = this.id();
      if (id) {
        await firstValueFrom(this.usuarios.actualizar(id, datos));
        this.notificaciones.exito('Datos del usuario actualizados.');
        await this.router.navigate(['/usuarios', id]);
      } else {
        const nuevoId = await firstValueFrom(
          this.usuarios.crear({ ...datos, password: valores.password, roles: this.permisos() }),
        );
        this.notificaciones.exito('Usuario creado.');
        await this.router.navigate(['/usuarios', nuevoId]);
      }
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
      if (control?.enabled) {
        control.setErrors({ servidor: error.mensaje });
        control.markAsTouched();
        return;
      }
    }

    this.errorGeneral.set(aplicarErroresServidor(this.formulario, error));
  }
}
