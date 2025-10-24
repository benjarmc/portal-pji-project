import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { ContractPdfService, ContractData } from '../../../../services/contract-pdf.service';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { CaptureDataService } from '../../../../services/capture-data.service';
import { LoggerService } from '../../../../services/logger.service';
@Component({
  selector: 'app-contract-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './contract-step.component.html',
  styleUrls: ['./contract-step.component.scss']
})
export class ContractStepComponent implements OnInit {
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  contractForm: FormGroup;
  clausulas = [
    'Cláusula de protección adicional en caso de fraude',
    'Cláusula de cobertura extendida para propiedades comerciales',
    'Cláusula de asesoría jurídica 24/7',
    'Cláusula de protección contra litigios vecinales'
  ];

  // Datos del contrato
  contractData: ContractData | null = null;
  contractHtml: string = '';

  constructor(
    private fb: FormBuilder,
    private contractPdfService: ContractPdfService,
    private wizardStateService: WizardStateService,
    private captureDataService: CaptureDataService,
    private logger: LoggerService
  ) {
    this.contractForm = this.fb.group({
      clausulas: this.fb.array([]),
      requerimientos: [''],
      aceptarContrato: [false]
    });
  }

  ngOnInit() {
    this.logger.log('🚀 ContractStepComponent ngOnInit() ejecutado');
    this.logger.log('🔍 Estado inicial del wizard:', this.wizardStateService.getState());
    this.loadContractData();
    
    // Suscribirse a cambios en el estado del wizard para actualizar el contrato
    this.wizardStateService.stateChanges$.subscribe(() => {
      this.logger.log('🔄 Estado del wizard cambió, recargando datos del contrato');
      this.logger.log('🔍 Nuevo estado del wizard:', this.wizardStateService.getState());
      this.loadContractData();
    });
  }

  /**
   * Carga los datos del contrato desde el estado del wizard
   */
  loadContractData() {
    const state = this.wizardStateService.getState();
    if (state) {
      this.logger.log('📋 Cargando datos para el contrato desde wizardState:', state);
      this.logger.log('📋 state.policyId:', state.policyId);
      
      // Si tenemos policyId, cargar datos desde el backend
      if (state.policyId) {
        this.logger.log('📡 Cargando datos desde backend usando policyId:', state.policyId);
        this.loadDataFromBackendByPolicy(state.policyId);
        return;
      }
      
      // Fallback: crear contrato con datos por defecto
      this.logger.log('⚠️ No hay policyId, creando contrato con datos por defecto');
      this.createContractData(state, {});
    }
  }

  /**
   * Carga datos desde el backend usando policyId
   */
  private loadDataFromBackendByPolicy(policyId: string) {
    this.logger.log('📡 Cargando datos de captura desde el backend por policyId:', policyId);
    
    this.captureDataService.getAllCaptureDataByPolicy(policyId).subscribe({
      next: (response) => {
        this.logger.log('📡 Respuesta completa del backend:', response);
        if (response.success && response.data) {
          const data = response.data;
          this.logger.log('📡 Datos recibidos del backend:', data);
          
          // Crear el contrato con los datos del backend
          const state = this.wizardStateService.getState();
          this.createContractData(state, data);
        } else {
          this.logger.log('⚠️ Respuesta del backend no exitosa o sin datos:', response);
          // Fallback: crear contrato con datos por defecto
          const state = this.wizardStateService.getState();
          this.createContractData(state, {});
        }
      },
      error: (error) => {
        this.logger.log('❌ Error cargando datos desde backend:', error);
        // Fallback: crear contrato con datos por defecto
        const state = this.wizardStateService.getState();
        this.createContractData(state, {});
      }
    });
  }

  /**
   * Crea los datos del contrato
   */
  private createContractData(state: any, captureData: any) {
    this.logger.log('📋 Creando datos del contrato con:', captureData);
    
    this.contractData = {
        // Datos básicos del usuario
        userData: state.userData || {
          name: '',
          email: '',
          phone: '',
          postalCode: ''
        },
        
        // Datos del contrato
        selectedPlan: state.selectedPlan || '',
        quotationNumber: state.quotationNumber || '',
        policyNumber: state.policyNumber || 'Pendiente',
        contractDate: (() => {
          const now = new Date();
          const fecha = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return fecha.toLocaleDateString('es-MX');
        })(),
        generationDate: (() => {
          const now = new Date();
          const fecha = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return fecha.toLocaleDateString('es-MX');
        })(),
        
        // Configuración del contrato (usar datos reales)
        tipoPersona: captureData.propietario?.tipoPersona || 'fisica',
        tipoPersonaArrendatario: captureData.inquilino?.tipoPersona || 'fisica',
        tipoInmueble: captureData.inmueble?.tipoInmueble || 'casa',
        giroComercial: captureData.inmueble?.giroComercial || '',
        
        // Datos del propietario (usar datos reales capturados)
        propietario: captureData.propietario || {
          fechaAlta: new Date().toISOString().split('T')[0],
          curp: '',
          tipoPersona: 'fisica',
          nombre: '',
          telefono: '',
          celular: '',
          estadoCivil: '',
          canal: '',
          calle: '',
          numeroExterior: '',
          edificio: '',
          cp: '',
          colonia: '',
          alcaldiaMunicipio: '',
          estado: ''
        },
        
        // Datos del inquilino (usar datos reales capturados)
        inquilino: captureData.inquilino || {
          fechaAlta: new Date().toISOString().split('T')[0],
          curp: '',
          tipoPersona: 'fisica',
          nombre: state.userData?.name || '',
          telefono: '',
          celular: '',
          estadoCivil: '',
          canal: '',
          calle: '',
          numeroExterior: '',
          edificio: '',
          cp: '',
          colonia: '',
          alcaldiaMunicipio: '',
          estado: '',
          ine: null,
          pasaporte: null,
          comprobanteDomicilio: null,
          comprobanteIngresos: null,
          comprobanteDomicilioImagen: null,
          comprobanteIngresos2: null,
          comprobanteIngresos3: null,
          comprobanteIngresos4: null
        },
        
        // Datos del fiador (usar datos reales capturados)
        fiador: captureData.fiador || {
          fechaAlta: new Date().toISOString().split('T')[0],
          curp: '',
          tipoPersona: 'fisica',
          nombre: '',
          telefono: '',
          celular: '',
          calle: '',
          numeroExterior: '',
          edificio: '',
          cp: '',
          colonia: '',
          alcaldiaMunicipio: '',
          estado: '',
          ine: null,
          escrituras: null,
          actaMatrimonio: null,
          empresaLabora: '',
          relacionFiador: '',
          estadoCivil: '',
          regimenPatrimonial: '',
          nombreConyuge: '',
          calleGarantia: '',
          numeroExteriorGarantia: '',
          edificioGarantia: '',
          numeroInteriorGarantia: '',
          cpGarantia: '',
          coloniaGarantia: '',
          alcaldiaMunicipioGarantia: '',
          estadoGarantia: '',
          entreCalleGarantia: '',
          yCalleGarantia: '',
          escrituraGarantia: '',
          numeroEscrituraGarantia: '',
          fechaEscrituraGarantia: '',
          notarioNumero: '',
          ciudadNotario: '',
          nombreNotario: '',
          datosRegistrales: '',
          fechaRegistro: ''
        },
        
        // Datos del inmueble (usar datos reales capturados)
        inmueble: {
          ...captureData.inmueble,
          // Asegurar que los campos numéricos sean números
          renta: parseFloat(captureData.inmueble?.renta || '0'),
          mantenimiento: parseFloat(captureData.inmueble?.mantenimiento || '0'),
          // Formatear fechas para el contrato (evitar problemas de zona horaria)
          vigenciaInicio: (() => {
            const fechaInicio = captureData.inmueble?.vigenciaInicio;
            this.logger.log('📅 Fecha de inicio de vigencia original:', fechaInicio);
            if (fechaInicio) {
              // Crear fecha sin problemas de zona horaria
              const [year, month, day] = fechaInicio.split('-');
              const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              const fechaFormateada = fecha.toLocaleDateString('es-MX');
              this.logger.log('📅 Fecha de inicio formateada:', fechaFormateada);
              return fechaFormateada;
            }
            return '01 de enero de 2024';
          })(),
          vigenciaFin: (() => {
            const fechaFin = captureData.inmueble?.vigenciaFin;
            this.logger.log('📅 Fecha de fin de vigencia original:', fechaFin);
            if (fechaFin) {
              // Crear fecha sin problemas de zona horaria
              const [year, month, day] = fechaFin.split('-');
              const fecha = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
              const fechaFormateada = fecha.toLocaleDateString('es-MX');
              this.logger.log('📅 Fecha de fin formateada:', fechaFormateada);
              return fechaFormateada;
            }
            return '31 de diciembre de 2024';
          })()
        },
        
        // Cláusulas adicionales
        clausulasAdicionales: [],
        requerimientosAdicionales: ''
      };
      
      this.logger.log('📋 Datos del contrato preparados:', this.contractData);
      this.generateContractPreview();
  }

  /**
   * Genera la vista previa del contrato
   */
  generateContractPreview() {
    this.logger.log('🔄 generateContractPreview() ejecutado');
    if (this.contractData) {
      this.logger.log('📋 Generando HTML del contrato con datos:', this.contractData);
      this.contractHtml = this.contractPdfService.generateContractHtml(this.contractData);
      this.logger.log('📋 HTML del contrato generado:', this.contractHtml.substring(0, 200) + '...');
    } else {
      this.logger.log('❌ No hay datos del contrato para generar');
    }
  }

  /**
   * Actualiza las cláusulas adicionales en el contrato
   */
  onClausulaChange(event: any, clausula: string) {
    const clausulasArray = this.contractForm.get('clausulas') as FormArray;
    if (event.target.checked) {
      clausulasArray.push(this.fb.control(clausula));
    } else {
      const index = clausulasArray.controls.findIndex(control => control.value === clausula);
      if (index >= 0) {
        clausulasArray.removeAt(index);
      }
    }
    
    // Actualizar el contrato con las nuevas cláusulas
    this.updateContractWithClausulas();
  }

  /**
   * Actualiza el contrato con las cláusulas seleccionadas
   */
  updateContractWithClausulas() {
    if (this.contractData) {
      const clausulasArray = this.contractForm.get('clausulas') as FormArray;
      this.contractData.clausulasAdicionales = clausulasArray.controls.map(control => control.value);
      this.contractData.requerimientosAdicionales = this.contractForm.get('requerimientos')?.value || '';
      
      this.generateContractPreview();
    }
  }

  /**
   * Bloquea el clic derecho en el contrato
   */
  onContractRightClick(event: Event): void {
    event.preventDefault();
  }

  /**
   * Finaliza el proceso y avanza al siguiente paso
   */
  onFirmarYFinalizar() {
    if (this.contractForm.get('aceptarContrato')?.value) {
      // Guardar el estado del contrato
      this.wizardStateService.saveState({
        currentStep: 4, // Siguiente paso
        contractData: {
          clausulas: this.contractForm.get('clausulas')?.value || [],
          requerimientos: this.contractForm.get('requerimientos')?.value || '',
          aceptado: true
        }
      });
      
      this.next.emit();
    }
  }

  /**
   * Regresa al paso anterior
   */
  onPrevious() {
    this.previous.emit();
  }

  /**
   * Maneja el cambio de tipo de persona (arrendador)
   */
  onTipoPersonaChange(value: string) {
    if (this.contractData) {
      this.contractData.tipoPersona = value as 'fisica' | 'moral';
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de tipo de persona (arrendatario)
   */
  onTipoPersonaArrendatarioChange(value: string) {
    if (this.contractData) {
      this.contractData.tipoPersonaArrendatario = value as 'fisica' | 'moral';
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de tipo de inmueble
   */
  onTipoInmuebleChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.tipoInmueble = value as 'casa' | 'oficina' | 'bodega' | 'comercial';
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de giro comercial
   */
  onGiroComercialChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.giroComercial = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de monto de renta
   */
  onRentaMontoChange(value: number) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.renta = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de mantenimiento
   */
  onRentaMantenimientoChange(value: number) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.mantenimiento = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de calle del inmueble
   */
  onInmuebleCalleChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.calle = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de número del inmueble
   */
  onInmuebleNumeroChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.numeroExterior = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de colonia del inmueble
   */
  onInmuebleColoniaChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.colonia = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de delegación del inmueble
   */
  onInmuebleDelegacionChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.alcaldiaMunicipio = value;
      this.generateContractPreview();
    }
  }

  /**
   * Maneja el cambio de código postal del inmueble
   */
  onInmuebleCpChange(value: string) {
    if (this.contractData && this.contractData.inmueble) {
      this.contractData.inmueble.cp = value;
      this.generateContractPreview();
    }
  }
} 