import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { ApiError } from '../../core/api/api';
import { aplicarErroresServidor } from './errores-servidor';

const error = (errores: Record<string, string[]>, mensaje = 'General'): ApiError => ({
  status: 400,
  codigo: 'Validation.General',
  mensaje,
  errores,
});

describe('aplicarErroresServidor', () => {
  it('ubica los errores en los controles, incluidos los anidados', () => {
    const form = new FormGroup({
      nombreSistema: new FormControl(''),
      adjuntos: new FormArray([new FormGroup({ fileBase64: new FormControl('') })]),
    });

    const general = aplicarErroresServidor(
      form,
      error({ nombreSistema: ['Obligatorio.'], 'adjuntos[0].FileBase64': ['Base64 inválido.'] }),
    );

    expect(general).toBeNull();
    expect(form.controls.nombreSistema.errors).toEqual({ servidor: 'Obligatorio.' });
    expect(form.get('adjuntos.0.fileBase64')?.errors).toEqual({ servidor: 'Base64 inválido.' });
  });

  it('devuelve los mensajes que no corresponden a ningún control', () => {
    const form = new FormGroup({ nombre: new FormControl('') });
    expect(aplicarErroresServidor(form, error({ otro: ['No ubicado.'] }))).toBe('No ubicado.');
    expect(aplicarErroresServidor(form, error({}, 'Vehículo ocupado.'))).toBe('Vehículo ocupado.');
  });

  it('el error del servidor desaparece cuando el usuario cambia el valor', () => {
    const form = new FormGroup({ nombre: new FormControl('') });
    aplicarErroresServidor(form, error({ nombre: ['Duplicado.'] }));
    form.controls.nombre.setValue('otro');
    expect(form.controls.nombre.errors).toBeNull();
  });
});
