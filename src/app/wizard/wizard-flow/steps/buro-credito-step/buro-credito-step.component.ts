import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { BuroCreditoService, BuroCreditoRequest, BuroCreditoResponse } from '../../../../services/buro-credito.service';
import { LoggerService } from '../../../../services/logger.service';

@Component({
  selector: 'app-buro-credito-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './buro-credito-step.component.html',
  styleUrls: ['./buro-credito-step.component.scss']
})
export class BuroCreditoStepComponent implements OnInit {
  @Input() currentStep: number = 0;
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  buroCreditoForm!: FormGroup;
  isLoading = false;
  isSubmitting = false;
  showResult = false;
  buroCreditoResult: BuroCreditoResponse | null = null;
  errorMessage = '';
  existingConsultaId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private wizardStateService: WizardStateService,
    private buroCreditoService: BuroCreditoService,
    private logger: LoggerService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadExistingConsulta();
  }

  initializeForm(): void {
    this.buroCreditoForm = this.fb.group({
      // Datos personales
      primerNombre: ['', [Validators.required]],
      segundoNombre: [''],
      apellidoPaterno: ['', [Validators.required]],
      apellidoMaterno: ['', [Validators.required]],
      apellidoAdicional: [''],
      fechaNacimiento: ['', [Validators.required]],
      rfc: ['', [Validators.required]],
      sexo: ['', [Validators.required]],
      estadoCivil: ['', [Validators.required]],
      residencia: ['', [Validators.required]],
      prefijo: [''],
      sufijo: [''],
      nacionalidad: [''],
      numeroDependientes: [''],
      edadesDependientes: [''],
      numeroLicenciaConducir: [''],
      numeroCedulaProfesional: [''],
      numeroRegistroElectoral: [''],
      claveOtroPais: [''],
      claveImpuestosOtroPais: [''],

      // Domicilios
      domicilios: this.fb.array([]),

      // Empleos
      empleos: this.fb.array([]),

      // Cuentas
      cuentaC: this.fb.array([])
    });

    // Agregar un domicilio por defecto
    this.addDomicilio();
    // Agregar un empleo por defecto
    this.addEmpleo();
  }

  get domicilios(): FormArray {
    return this.buroCreditoForm.get('domicilios') as FormArray;
  }

  get empleos(): FormArray {
    return this.buroCreditoForm.get('empleos') as FormArray;
  }

  get cuentaC(): FormArray {
    return this.buroCreditoForm.get('cuentaC') as FormArray;
  }

  addDomicilio(): void {
    const domicilioForm = this.fb.group({
      ciudad: [''],
      codPais: ['MX'],
      coloniaPoblacion: [''],
      cp: [''],
      delegacionMunicipio: [''],
      direccion1: [''],
      direccion2: [''],
      estado: [''],
      extension: [''],
      fax: [''],
      fechaResidencia: [''],
      indicadorEspecialDomicilio: [''],
      numeroTelefono: [''],
      tipoDomicilio: ['B']
    });
    this.domicilios.push(domicilioForm);
  }

  removeDomicilio(index: number): void {
    if (this.domicilios.length > 1) {
      this.domicilios.removeAt(index);
    }
  }

  addEmpleo(): void {
    const empleoForm = this.fb.group({
      baseSalarial: [''],
      cargo: [''],
      ciudad: [''],
      claveMonedaSalario: [''],
      codPais: [''],
      coloniaPoblacion: [''],
      cp: [''],
      delegacionMunicipio: [''],
      direccion1: [''],
      direccion2: [''],
      estado: [''],
      extension: [''],
      fax: [''],
      fechaContratacion: [''],
      fechaUltimoDiaEmpleo: [''],
      nombreEmpresa: [''],
      numeroEmpleado: [''],
      numeroTelefono: [''],
      salario: ['']
    });
    this.empleos.push(empleoForm);
  }

  removeEmpleo(index: number): void {
    if (this.empleos.length > 1) {
      this.empleos.removeAt(index);
    }
  }

  addCuentaC(): void {
    const cuentaForm = this.fb.group({
      claveOtorgante: [''],
      nombreOtorgante: [''],
      numeroCuenta: ['', [Validators.required]]
    });
    this.cuentaC.push(cuentaForm);
  }

  removeCuentaC(index: number): void {
    this.cuentaC.removeAt(index);
  }

  loadExistingConsulta(): void {
    const wizardState = this.wizardStateService.getState();
    const policyId = wizardState.policyId;
    const quotationId = wizardState.quotationId;

    this.isLoading = true;

    // ✅ PRIORIDAD: Buscar siempre por policyId primero si está disponible
    if (policyId) {
      this.logger.log(`🔍 Buscando consulta existente por policyId: ${policyId}`);
      this.buroCreditoService.getLatestByPolicyId(policyId).subscribe({
        next: (response) => {
          if (response && response.success && response.data) {
            this.logger.log('✅ Consulta existente encontrada en BD por policyId:', response.data);
            this.existingConsultaId = response.data.id;
            this.loadFormFromConsultaData(response.data.consultaData);
            
            // Si hay resultado, mostrarlo
            if (response.data.respuestaData || response.data.status === 'COMPLETED') {
              this.buroCreditoResult = response.data;
              this.showResult = true;
            }
            this.isLoading = false;
          } else {
            // Si no hay por policyId, intentar por quotationId como fallback
            this.tryLoadByQuotationId(quotationId);
          }
        },
        error: (error) => {
          this.logger.warning('⚠️ Error cargando consulta por policyId, intentando por quotationId:', error);
          this.tryLoadByQuotationId(quotationId);
        }
      });
    } else if (quotationId) {
      // Si no hay policyId, intentar por quotationId
      this.tryLoadByQuotationId(quotationId);
    } else {
      // Si no hay ni policyId ni quotationId, cargar desde estado local
      this.logger.log('⚠️ No hay policyId ni quotationId, cargando desde estado local');
      this.loadSavedData();
      this.isLoading = false;
    }
  }

  private tryLoadByQuotationId(quotationId: string | undefined): void {
    if (!quotationId) {
      this.loadSavedData();
      this.isLoading = false;
      return;
    }

    this.logger.log(`🔍 Buscando consulta existente por quotationId: ${quotationId}`);
    this.buroCreditoService.getLatestByQuotationId(quotationId).subscribe({
      next: (response) => {
        if (response && response.success && response.data) {
          this.logger.log('✅ Consulta existente encontrada en BD por quotationId:', response.data);
          this.existingConsultaId = response.data.id;
          this.loadFormFromConsultaData(response.data.consultaData);
          
          // Si hay resultado, mostrarlo
          if (response.data.respuestaData || response.data.status === 'COMPLETED') {
            this.buroCreditoResult = response.data;
            this.showResult = true;
          }
        } else {
          // Si no hay en BD, intentar cargar desde el estado local
          this.loadSavedData();
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.logger.warning('⚠️ Error cargando consulta existente, usando datos locales:', error);
        this.loadSavedData();
        this.isLoading = false;
      }
    });
  }

  loadFormFromConsultaData(consultaData: any): void {
    if (!consultaData || !consultaData.persona) return;

    const persona = consultaData.persona;
    const nombre = persona.nombre;

    // Cargar datos personales
    this.buroCreditoForm.patchValue({
      primerNombre: nombre.primerNombre || '',
      segundoNombre: nombre.segundoNombre || '',
      apellidoPaterno: nombre.apellidoPaterno || '',
      apellidoMaterno: nombre.apellidoMaterno || '',
      apellidoAdicional: nombre.apellidoAdicional || '',
      fechaNacimiento: this.formatDateForInput(nombre.fechaNacimiento) || '',
      rfc: nombre.rfc || '',
      sexo: nombre.sexo || '',
      estadoCivil: nombre.estadoCivil || '',
      residencia: nombre.residencia || '',
      prefijo: nombre.prefijo || '',
      sufijo: nombre.sufijo || '',
      nacionalidad: nombre.nacionalidad || '',
      numeroDependientes: nombre.numeroDependientes || '',
      edadesDependientes: nombre.edadesDependientes || '',
      numeroLicenciaConducir: nombre.numeroLicenciaConducir || '',
      numeroCedulaProfesional: nombre.numeroCedulaProfesional || '',
      numeroRegistroElectoral: nombre.numeroRegistroElectoral || '',
      claveOtroPais: nombre.claveOtroPais || '',
      claveImpuestosOtroPais: nombre.claveImpuestosOtroPais || ''
    });

    // Cargar domicilios
    if (persona.domicilios && persona.domicilios.length > 0) {
      this.domicilios.clear();
      persona.domicilios.forEach((domicilio: any) => {
        const domicilioForm = this.fb.group({
          ciudad: [domicilio.ciudad || ''],
          codPais: [domicilio.codPais || 'MX'],
          coloniaPoblacion: [domicilio.coloniaPoblacion || ''],
          cp: [domicilio.cp || ''],
          delegacionMunicipio: [domicilio.delegacionMunicipio || ''],
          direccion1: [domicilio.direccion1 || ''],
          direccion2: [domicilio.direccion2 || ''],
          estado: [domicilio.estado || ''],
          extension: [domicilio.extension || ''],
          fax: [domicilio.fax || ''],
          fechaResidencia: [this.formatDateForInput(domicilio.fechaResidencia) || ''],
          indicadorEspecialDomicilio: [domicilio.indicadorEspecialDomicilio || ''],
          numeroTelefono: [domicilio.numeroTelefono || ''],
          tipoDomicilio: [domicilio.tipoDomicilio || 'B']
        });
        this.domicilios.push(domicilioForm);
      });
    } else {
      // Si no hay domicilios, asegurar que haya al menos uno
      if (this.domicilios.length === 0) {
        this.addDomicilio();
      }
    }

    // Cargar empleos
    if (persona.empleos && persona.empleos.length > 0) {
      this.empleos.clear();
      persona.empleos.forEach((empleo: any) => {
        const empleoForm = this.fb.group({
          baseSalarial: [empleo.baseSalarial || ''],
          cargo: [empleo.cargo || ''],
          ciudad: [empleo.ciudad || ''],
          claveMonedaSalario: [empleo.claveMonedaSalario || ''],
          codPais: [empleo.codPais || ''],
          coloniaPoblacion: [empleo.coloniaPoblacion || ''],
          cp: [empleo.cp || ''],
          delegacionMunicipio: [empleo.delegacionMunicipio || ''],
          direccion1: [empleo.direccion1 || ''],
          direccion2: [empleo.direccion2 || ''],
          estado: [empleo.estado || ''],
          extension: [empleo.extension || ''],
          fax: [empleo.fax || ''],
          fechaContratacion: [this.formatDateForInput(empleo.fechaContratacion) || ''],
          fechaUltimoDiaEmpleo: [this.formatDateForInput(empleo.fechaUltimoDiaEmpleo) || ''],
          nombreEmpresa: [empleo.nombreEmpresa || ''],
          numeroEmpleado: [empleo.numeroEmpleado || ''],
          numeroTelefono: [empleo.numeroTelefono || ''],
          salario: [empleo.salario || '']
        });
        this.empleos.push(empleoForm);
      });
    } else {
      // Si no hay empleos, asegurar que haya al menos uno
      if (this.empleos.length === 0) {
        this.addEmpleo();
      }
    }

    // Cargar cuentas
    if (persona.cuentaC && persona.cuentaC.length > 0) {
      this.cuentaC.clear();
      persona.cuentaC.forEach((cuenta: any) => {
        const cuentaForm = this.fb.group({
          claveOtorgante: [cuenta.claveOtorgante || ''],
          nombreOtorgante: [cuenta.nombreOtorgante || ''],
          numeroCuenta: [cuenta.numeroCuenta || '', [Validators.required]]
        });
        this.cuentaC.push(cuentaForm);
      });
    }
  }

  loadSavedData(): void {
    const wizardState = this.wizardStateService.getState();
    const stepData = wizardState.stepData?.step4;

    if (stepData?.consultaData) {
      this.loadFormFromConsultaData(stepData.consultaData);
      this.existingConsultaId = stepData.buroCreditoId || null;

      // Si hay resultado guardado, mostrarlo
      if (stepData.respuestaData || stepData.status === 'COMPLETED') {
        this.buroCreditoResult = {
          id: stepData.buroCreditoId || '',
          consultaData: stepData.consultaData,
          respuestaData: stepData.respuestaData,
          status: (stepData.status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'ERROR') || 'COMPLETED',
          createdAt: '',
          updatedAt: ''
        };
        this.showResult = true;
      }
    }
  }

  formatDateForInput(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return '';
    // Convertir de DDMMYYYY a YYYY-MM-DD
    const day = dateStr.substring(0, 2);
    const month = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 8);
    return `${year}-${month}-${day}`;
  }

  formatDateForApi(dateStr: string): string {
    if (!dateStr) return '';
    // Convertir de YYYY-MM-DD a DDMMYYYY
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}${month}${year}`;
  }

  onSubmit(): void {
    if (this.buroCreditoForm.invalid) {
      this.markFormGroupTouched(this.buroCreditoForm);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    const formValue = this.buroCreditoForm.value;
    const wizardState = this.wizardStateService.getState();

    // Construir el objeto de consulta
    const consultaRequest: BuroCreditoRequest = {
      consulta: {
        persona: {
          nombre: {
            primerNombre: formValue.primerNombre,
            segundoNombre: formValue.segundoNombre || '',
            apellidoPaterno: formValue.apellidoPaterno,
            apellidoMaterno: formValue.apellidoMaterno,
            apellidoAdicional: formValue.apellidoAdicional || '',
            fechaNacimiento: this.formatDateForApi(formValue.fechaNacimiento),
            rfc: formValue.rfc,
            sexo: formValue.sexo,
            estadoCivil: formValue.estadoCivil,
            residencia: formValue.residencia,
            prefijo: formValue.prefijo || '',
            sufijo: formValue.sufijo || '',
            nacionalidad: formValue.nacionalidad || '',
            numeroDependientes: formValue.numeroDependientes || '',
            edadesDependientes: formValue.edadesDependientes || '',
            numeroLicenciaConducir: formValue.numeroLicenciaConducir || '',
            numeroCedulaProfesional: formValue.numeroCedulaProfesional || '',
            numeroRegistroElectoral: formValue.numeroRegistroElectoral || '',
            claveOtroPais: formValue.claveOtroPais || '',
            claveImpuestosOtroPais: formValue.claveImpuestosOtroPais || ''
          },
          encabezado: {
            clavePais: 'MX',
            claveUnidadMonetaria: 'MX',
            identificadorBuro: '0000',
            idioma: 'SP',
            importeContrato: '000000000',
            numeroReferenciaOperador: '12345678',
            productoRequerido: '001',
            tipoConsulta: 'I',
            tipoContrato: 'CC'
          },
          domicilios: formValue.domicilios.map((dom: any) => ({
            ciudad: dom.ciudad || '',
            codPais: dom.codPais || 'MX',
            coloniaPoblacion: dom.coloniaPoblacion || '',
            cp: dom.cp || '',
            delegacionMunicipio: dom.delegacionMunicipio || '',
            direccion1: dom.direccion1 || '',
            direccion2: dom.direccion2 || '',
            estado: dom.estado || '',
            extension: dom.extension || '',
            fax: dom.fax || '',
            fechaResidencia: this.formatDateForApi(dom.fechaResidencia) || '',
            indicadorEspecialDomicilio: dom.indicadorEspecialDomicilio || '',
            numeroTelefono: dom.numeroTelefono || '',
            tipoDomicilio: dom.tipoDomicilio || 'B'
          })),
          empleos: formValue.empleos.map((emp: any) => ({
            baseSalarial: emp.baseSalarial || '',
            cargo: emp.cargo || '',
            ciudad: emp.ciudad || '',
            claveMonedaSalario: emp.claveMonedaSalario || '',
            codPais: emp.codPais || '',
            coloniaPoblacion: emp.coloniaPoblacion || '',
            cp: emp.cp || '',
            delegacionMunicipio: emp.delegacionMunicipio || '',
            direccion1: emp.direccion1 || '',
            direccion2: emp.direccion2 || '',
            estado: emp.estado || '',
            extension: emp.extension || '',
            fax: emp.fax || '',
            fechaContratacion: this.formatDateForApi(emp.fechaContratacion) || '',
            fechaUltimoDiaEmpleo: this.formatDateForApi(emp.fechaUltimoDiaEmpleo) || '',
            nombreEmpresa: emp.nombreEmpresa || '',
            numeroEmpleado: emp.numeroEmpleado || '',
            numeroTelefono: emp.numeroTelefono || '',
            salario: emp.salario || ''
          })),
          cuentaC: formValue.cuentaC.map((cuenta: any) => ({
            claveOtorgante: cuenta.claveOtorgante || '',
            nombreOtorgante: cuenta.nombreOtorgante || '',
            numeroCuenta: cuenta.numeroCuenta
          }))
        }
      },
      userId: wizardState.userId || undefined,
      quotationId: wizardState.quotationId || undefined,
      policyId: wizardState.policyId || undefined
    };

    this.logger.log('📋 Enviando consulta al Buro de Crédito:', consultaRequest);

    // Si existe un registro previo, actualizarlo; si no, crear uno nuevo
    const request = this.existingConsultaId
      ? this.buroCreditoService.updateConsulta(this.existingConsultaId, consultaRequest)
      : this.buroCreditoService.createConsulta(consultaRequest);

    request.subscribe({
      next: (response) => {
        this.logger.log(`✅ Consulta al Buro de Crédito ${this.existingConsultaId ? 'actualizada' : 'completada'}:`, response);
        
        if (response.success && response.data) {
          this.buroCreditoResult = response.data;
          this.existingConsultaId = response.data.id; // Guardar el ID para futuras actualizaciones
          this.showResult = true;

          // Guardar en el estado del wizard
          this.wizardStateService.updateStepData(4, {
            buroCreditoId: response.data.id,
            consultaData: consultaRequest.consulta,
            respuestaData: response.data.respuestaData,
            status: response.data.status,
            timestamp: new Date()
          });

          this.isSubmitting = false;
        } else {
          this.errorMessage = response.error || 'Error al realizar la consulta';
          this.isSubmitting = false;
        }
      },
      error: (error) => {
        this.logger.error('❌ Error en consulta al Buro de Crédito:', error);
        this.errorMessage = error.error?.message || 'Error al realizar la consulta. Por favor, intenta nuevamente.';
        this.isSubmitting = false;
      }
    });
  }

  onNext(): void {
    if (this.showResult && this.buroCreditoResult?.status === 'COMPLETED') {
      this.next.emit();
    }
  }

  onPrevious(): void {
    this.previous.emit();
  }

  markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      } else if (control instanceof FormArray) {
        control.controls.forEach(arrayControl => {
          if (arrayControl instanceof FormGroup) {
            this.markFormGroupTouched(arrayControl);
          }
        });
      }
    });
  }
}

