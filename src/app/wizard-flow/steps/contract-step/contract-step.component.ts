import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { ContractPdfService, ContractData } from '../../../services/contract-pdf.service';
import { WizardStateService } from '../../../services/wizard-state.service';

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
    private wizardStateService: WizardStateService
  ) {
    this.contractForm = this.fb.group({
      clausulas: this.fb.array([]),
      requerimientos: [''],
      aceptarContrato: [false]
    });
  }

  ngOnInit() {
    this.loadContractData();
    
    // Suscribirse a cambios en el estado del wizard para actualizar el contrato
    this.wizardStateService.stateChanges$.subscribe(() => {
      this.loadContractData();
    });
  }

  /**
   * Carga los datos del contrato desde el estado del wizard
   */
  loadContractData() {
    const state = this.wizardStateService.getState();
    if (state) {
      // Cargar datos del paso anterior (data-entry)
      const dataEntryData = state.contractData || {};
      
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
        contractDate: new Date().toLocaleDateString('es-MX'),
        generationDate: new Date().toLocaleDateString('es-MX'),
        
        // Configuración del contrato (valores por defecto)
        tipoPersona: 'fisica',
        tipoPersonaArrendatario: 'fisica',
        tipoInmueble: 'casa',
        giroComercial: '',
        
        // Datos del propietario (usar datos reales capturados)
        propietario: dataEntryData.propietario || {
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
        inquilino: dataEntryData.inquilino || {
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
        fiador: dataEntryData.fiador || {
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
        
        // Datos del inmueble (usar datos reales capturados + datos adicionales del wizard)
        inmueble: {
          ...(dataEntryData.inmueble || {}),
          // Agregar campos adicionales necesarios para el contrato
          renta: state.userData?.rentaMensual || 0,
          mantenimiento: 0, // Por defecto sin mantenimiento adicional
          vigenciaInicio: '01 de enero de 2024', // Fecha por defecto
          vigenciaFin: '31 de diciembre de 2024'  // Fecha por defecto
        },
        
        // Cláusulas adicionales
        clausulasAdicionales: [],
        requerimientosAdicionales: ''
      };
      
      this.generateContractPreview();
    }
  }

  /**
   * Genera la vista previa del contrato
   */
  generateContractPreview() {
    if (this.contractData) {
      this.contractHtml = this.contractPdfService.generateContractHtml(this.contractData);
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