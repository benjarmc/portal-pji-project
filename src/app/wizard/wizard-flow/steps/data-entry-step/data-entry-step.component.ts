import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { CaptureDataService } from '../../../../services/capture-data.service';
import { LoggerService } from '../../../../services/logger.service';
export interface PropietarioData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  estadoCivil: string;
  canal: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
}

export interface InquilinoData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  estadoCivil: string;
  canal: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  ine: File | null;
  pasaporte: File | null;
  comprobanteDomicilio: File | null;
  comprobanteIngresos: File | null;
  comprobanteDomicilioImagen: File | null;
  comprobanteIngresos2: File | null;
  comprobanteIngresos3: File | null;
  comprobanteIngresos4: File | null;
}

export interface FiadorData {
  fechaAlta: string;
  curp: string;
  tipoPersona: 'fisica' | 'moral';
  nombre: string;
  telefono: string;
  celular: string;
  calle: string;
  numeroExterior: string;
  edificio: string;
  cp: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  ine: File | null;
  escrituras: File | null;
  actaMatrimonio: File | null;
  empresaLabora: string;
  relacionFiador: string;
  estadoCivil: string;
  regimenPatrimonial: string;
  nombreConyuge: string;
  // Datos del inmueble garantía
  calleGarantia: string;
  numeroExteriorGarantia: string;
  edificioGarantia: string;
  numeroInteriorGarantia: string;
  cpGarantia: string;
  coloniaGarantia: string;
  alcaldiaMunicipioGarantia: string;
  estadoGarantia: string;
  entreCalleGarantia: string;
  yCalleGarantia: string;
  escrituraGarantia: string;
  numeroEscrituraGarantia: string;
  fechaEscrituraGarantia: string;
  notarioNumero: string;
  ciudadNotario: string;
  nombreNotario: string;
  datosRegistrales: string;
  fechaRegistro: string;
}

export interface InmuebleData {
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  alcaldiaMunicipio: string;
  estado: string;
  cp: string;
  tipoInmueble: 'casa' | 'oficina' | 'bodega' | 'comercial';
  giroComercial?: string;
  renta: number;
  mantenimiento: number;
  vigenciaInicio: string;
  vigenciaFin: string;
}

@Component({
  selector: 'app-data-entry-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './data-entry-step.component.html',
  styleUrls: ['./data-entry-step.component.scss']
})
export class DataEntryStepComponent implements OnInit {
  @Input() currentStep: number = 0;
  @Output() next = new EventEmitter<void>();
  @Output() previous = new EventEmitter<void>();

  activeTab: 'propietario' | 'inquilino' | 'fiador' | 'inmueble' = 'propietario';
  
  // Estados de carga
  isLoading = false;
  isSaving = false;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' = 'idle';
  
  // Progreso de completado
  completionProgress: {
    propietario: number;
    inquilino: number;
    fiador: number;
    inmueble: number;
    total: number;
  } = {
    propietario: 0,
    inquilino: 0,
    fiador: 0,
    inmueble: 0,
    total: 0
  };

  // Array para el ngFor con tipos específicos
  tabs: ('propietario' | 'inquilino' | 'fiador' | 'inmueble')[] = ['propietario', 'inquilino', 'fiador', 'inmueble'];
  
  propietarioForm!: FormGroup;
  inquilinoForm!: FormGroup;
  fiadorForm!: FormGroup;
  inmuebleForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private wizardStateService: WizardStateService,
    private captureDataService: CaptureDataService,
    private logger: LoggerService
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.loadExistingData();
    this.initializeProgressTracking();
  }

  private initializeProgressTracking() {
    // Calcular progreso inicial
    setTimeout(() => {
      this.calculateProgress();
    }, 100);

    // Agregar listeners para recalcular progreso cuando cambien los formularios
    if (this.propietarioForm) {
      this.propietarioForm.valueChanges.subscribe(() => {
        this.calculateProgress();
      });
    }
    if (this.inquilinoForm) {
      this.inquilinoForm.valueChanges.subscribe(() => {
        this.calculateProgress();
      });
    }
    if (this.fiadorForm) {
      this.fiadorForm.valueChanges.subscribe(() => {
        this.calculateProgress();
      });
    }
    if (this.inmuebleForm) {
      this.inmuebleForm.valueChanges.subscribe(() => {
        this.calculateProgress();
      });
    }
  }

  private initializeForms() {
    // Formulario Propietario
    this.propietarioForm = this.fb.group({
      fechaAlta: [new Date().toISOString().split('T')[0], Validators.required],
      curp: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{3}$/)]],
      tipoPersona: ['fisica', Validators.required],
      nombre: ['', Validators.required],
      telefono: [''],
      celular: [''],
      estadoCivil: [''],
      canal: [''],
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      edificio: [''],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required]
    });

    // Formulario Inquilino
    this.inquilinoForm = this.fb.group({
      fechaAlta: [new Date().toISOString().split('T')[0], Validators.required],
      curp: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{3}$/)]],
      tipoPersona: ['fisica', Validators.required],
      nombre: ['', Validators.required],
      telefono: [''],
      celular: [''],
      estadoCivil: [''],
      canal: [''],
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      edificio: [''],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required],
      ine: [''],
      pasaporte: [''],
      comprobanteDomicilio: [''],
      comprobanteIngresos: [''],
      comprobanteDomicilioImagen: [''],
      comprobanteIngresos2: [''],
      comprobanteIngresos3: [''],
      comprobanteIngresos4: ['']
    });

    // Formulario Fiador
    this.fiadorForm = this.fb.group({
      fechaAlta: [new Date().toISOString().split('T')[0], Validators.required],
      curp: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}[0-9]{6}[HM][A-Z]{5}[A-Z0-9]{3}$/)]],
      tipoPersona: ['fisica', Validators.required],
      nombre: ['', Validators.required],
      telefono: [''],
      celular: [''],
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      edificio: [''],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required],
      ine: [''],
      escrituras: [''],
      actaMatrimonio: [''],
      empresaLabora: [''],
      relacionFiador: [''],
      estadoCivil: [''],
      regimenPatrimonial: [''],
      nombreConyuge: [''],
      // Datos del inmueble garantía
      calleGarantia: ['', Validators.required],
      numeroExteriorGarantia: ['', Validators.required],
      edificioGarantia: [''],
      numeroInteriorGarantia: [''],
      cpGarantia: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      coloniaGarantia: ['', Validators.required],
      alcaldiaMunicipioGarantia: ['', Validators.required],
      estadoGarantia: ['', Validators.required],
      entreCalleGarantia: [''],
      yCalleGarantia: [''],
      escrituraGarantia: [''],
      numeroEscrituraGarantia: [''],
      fechaEscrituraGarantia: [''],
      notarioNumero: [''],
      ciudadNotario: [''],
      nombreNotario: [''],
      datosRegistrales: [''],
      fechaRegistro: ['']
    });

    // Formulario Inmueble
    this.inmuebleForm = this.fb.group({
      calle: ['', Validators.required],
      numeroExterior: ['', Validators.required],
      numeroInterior: [''],
      colonia: ['', Validators.required],
      alcaldiaMunicipio: ['', Validators.required],
      estado: ['', Validators.required],
      cp: ['', [Validators.required, Validators.pattern(/^[0-9]{5}$/)]],
      tipoInmueble: ['casa', Validators.required],
      giroComercial: [''],
      renta: [0, [Validators.required, Validators.min(1)]],
      mantenimiento: [0, [Validators.min(0)]],
      vigenciaInicio: ['', Validators.required],
      vigenciaFin: ['', Validators.required]
    });
  }

  private loadExistingData() {
    const state = this.wizardStateService.getState();
    
    this.logger.log('🔍 [DEBUG] Estado completo del wizard:', state);
    this.logger.log('🔍 [DEBUG] policyId disponible:', state?.policyId);
    this.logger.log('🔍 [DEBUG] contractData disponible:', state?.contractData);
    
    // Primero cargar desde el estado local del wizard
    if (state && state.contractData) {
      const contractData = state.contractData;
      
      if (contractData.propietario) {
        this.propietarioForm.patchValue(contractData.propietario);
        this.logger.log('✅ Datos de propietario cargados desde estado local');
      }
      if (contractData.inquilino) {
        this.inquilinoForm.patchValue(contractData.inquilino);
        this.logger.log('✅ Datos de inquilino cargados desde estado local');
      }
      if (contractData.fiador) {
        this.fiadorForm.patchValue(contractData.fiador);
        this.logger.log('✅ Datos de fiador cargados desde estado local');
      }
      if (contractData.inmueble) {
        this.inmuebleForm.patchValue(contractData.inmueble);
        this.logger.log('✅ Datos de inmueble cargados desde estado local');
      }
    }

    // ✅ OPTIMIZADO: Solo cargar desde backend si no hay datos locales completos
    if (state && state.policyId) {
      // Verificar si ya tenemos datos locales completos
      const hasCompleteLocalData = 
        (state.contractData?.propietario?.nombre || state.captureData?.propietario?.nombre) &&
        (state.contractData?.inquilino?.nombre || state.captureData?.inquilino?.nombre) &&
        (state.contractData?.inmueble?.calle || state.captureData?.inmueble?.calle);
      
      if (hasCompleteLocalData) {
        this.logger.log('✅ Ya hay datos locales completos, omitiendo carga desde backend');
      } else {
        this.logger.log('🚀 Iniciando carga desde backend con policyId:', state.policyId);
        this.loadDataFromBackendByPolicy(state.policyId);
      }
    } else {
      this.logger.log('⚠️ No hay policyId disponible para cargar desde backend');
    }
  }

  private loadDataFromBackendByPolicy(policyId: string) {
    this.logger.log('📡 Cargando datos de captura desde el backend por policyId:', policyId);
    
    this.captureDataService.getAllCaptureDataByPolicy(policyId).subscribe({
      next: (response) => {
        this.logger.log('📡 Respuesta completa del backend:', response);
        if (response.success && response.data) {
          const data = response.data;
          this.logger.log('📡 Datos recibidos del backend:', data);
          
          // Solo actualizar formularios si no tienen datos locales
          if (data.propietario && !this.propietarioForm.get('nombre')?.value) {
            this.logger.log('📝 Llenando formulario de propietario con:', data.propietario);
            this.propietarioForm.patchValue(data.propietario);
            this.logger.log('✅ Datos de propietario cargados desde backend por policyId');
          } else if (data.propietario) {
            this.logger.log('⚠️ Formulario de propietario ya tiene datos, no se sobrescribe');
          }
          
          if (data.inquilino && !this.inquilinoForm.get('nombre')?.value) {
            this.logger.log('📝 Llenando formulario de inquilino con:', data.inquilino);
            this.inquilinoForm.patchValue(data.inquilino);
            this.logger.log('✅ Datos de inquilino cargados desde backend por policyId');
          } else if (data.inquilino) {
            this.logger.log('⚠️ Formulario de inquilino ya tiene datos, no se sobrescribe');
          }
          
          if (data.fiador && !this.fiadorForm.get('nombre')?.value) {
            this.logger.log('📝 Llenando formulario de fiador con:', data.fiador);
            this.fiadorForm.patchValue(data.fiador);
            this.logger.log('✅ Datos de fiador cargados desde backend por policyId');
          } else if (data.fiador) {
            this.logger.log('⚠️ Formulario de fiador ya tiene datos, no se sobrescribe');
          }
          
          if (data.inmueble && !this.inmuebleForm.get('calle')?.value) {
            this.logger.log('📝 Llenando formulario de inmueble con:', data.inmueble);
            this.inmuebleForm.patchValue(data.inmueble);
            this.logger.log('✅ Datos de inmueble cargados desde backend por policyId');
          } else if (data.inmueble) {
            this.logger.log('⚠️ Formulario de inmueble ya tiene datos, no se sobrescribe');
          }
          
          // IMPORTANTE: Guardar los datos cargados en wizardState.captureData
          // para que hasSavedData() funcione correctamente
          this.logger.log('💾 Guardando datos cargados en wizardState.captureData');
          const currentState = this.wizardStateService.getState();
          this.wizardStateService.saveState({
            captureData: {
              ...currentState.captureData,
              propietario: data.propietario || currentState.captureData?.propietario,
              inquilino: data.inquilino || currentState.captureData?.inquilino,
              fiador: data.fiador || currentState.captureData?.fiador,
              inmueble: data.inmueble || currentState.captureData?.inmueble
            }
          });
          this.logger.log('✅ Datos guardados en wizardState.captureData para verificación de hasSavedData()');
        } else {
          this.logger.log('⚠️ Respuesta del backend no exitosa o sin datos:', response);
        }
      },
      error: (error) => {
        this.logger.log('❌ Error cargando datos desde backend:', error);
        this.logger.log('❌ Error details:', error.error);
        this.logger.log('❌ Error message:', error.message);
        this.logger.log('❌ Error status:', error.status);
      }
    });
  }

  private loadDataFromBackend(userId: string) {
    this.logger.log('📡 Cargando datos de captura desde el backend...');
    
    this.captureDataService.getAllCaptureData(userId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          
          // Solo actualizar formularios si no tienen datos locales
          if (data.propietario && !this.propietarioForm.get('nombre')?.value) {
            this.propietarioForm.patchValue(data.propietario);
            this.logger.log('✅ Datos de propietario cargados desde backend');
          }
          
          if (data.inquilino && !this.inquilinoForm.get('nombre')?.value) {
            this.inquilinoForm.patchValue(data.inquilino);
            this.logger.log('✅ Datos de inquilino cargados desde backend');
          }
          
          if (data.fiador && !this.fiadorForm.get('nombre')?.value) {
            this.fiadorForm.patchValue(data.fiador);
            this.logger.log('✅ Datos de fiador cargados desde backend');
          }
          
          if (data.inmueble && !this.inmuebleForm.get('calle')?.value) {
            this.inmuebleForm.patchValue(data.inmueble);
            this.logger.log('✅ Datos de inmueble cargados desde backend');
          }
        }
      },
      error: (error) => {
        this.logger.log('ℹ️ No hay datos guardados en el backend aún:', error.message);
        // No es un error crítico, simplemente no hay datos guardados
      }
    });
  }

  setActiveTab(tab: 'propietario' | 'inquilino' | 'fiador' | 'inmueble') {
    this.activeTab = tab;
  }

  onNext() {
    this.logger.log('🚀 onNext() ejecutado - avanzando al siguiente paso');
    
    // Guardar explícitamente los datos capturados en el wizardState
    const currentState = this.wizardStateService.getState();
    this.logger.log('💾 Guardando datos de captura en wizardState antes de navegar al contrato');
    this.logger.log('📊 Datos actuales de captureData:', currentState.captureData);
    
    // Asegurar que los datos estén guardados
    this.wizardStateService.saveState({
      ...currentState,
      captureData: {
        propietario: currentState.captureData?.propietario,
        inquilino: currentState.captureData?.inquilino,
        fiador: currentState.captureData?.fiador,
        inmueble: currentState.captureData?.inmueble
      }
    });
    
    this.logger.log('✅ Datos guardados, emitiendo evento next');
    this.next.emit();
  }

  onPrevious() {
    this.previous.emit();
  }

  validateCurrentTab(): boolean {
    switch (this.activeTab) {
      case 'propietario':
        return this.propietarioForm.valid;
      case 'inquilino':
        return this.inquilinoForm.valid;
      case 'fiador':
        return this.fiadorForm.valid;
      case 'inmueble':
        return this.inmuebleForm.valid;
      default:
        return false;
    }
  }

  private saveData() {
    const contractData = {
      propietario: this.propietarioForm.value as PropietarioData,
      inquilino: this.inquilinoForm.value as InquilinoData,
      fiador: this.fiadorForm.value as FiadorData,
      inmueble: this.inmuebleForm.value as InmuebleData
    };

    // Guardar en el estado local del wizard
    this.wizardStateService.saveState({
      contractData: contractData
    });

    // También guardar en el backend si tenemos userId
    const wizardState = this.wizardStateService.getState();
    if (wizardState.userId) {
      this.saveToBackend(wizardState.userId, contractData);
    }
  }

  private saveToBackend(userId: string, data: any) {
    this.logger.log('💾 Guardando datos de captura en el backend...');
    this.isSaving = true;
    this.saveStatus = 'saving';
    
    this.captureDataService.saveAllCaptureData(userId, {
      propietario: data.propietario,
      inquilino: data.inquilino,
      fiador: data.fiador,
      inmueble: data.inmueble
    }).subscribe({
      next: (response) => {
        this.logger.log('✅ Datos de captura guardados en el backend:', response);
        this.isSaving = false;
        this.saveStatus = 'saved';
        
        // Resetear el estado después de 2 segundos
        setTimeout(() => {
          this.saveStatus = 'idle';
        }, 2000);
      },
      error: (error) => {
        this.logger.error('❌ Error guardando datos de captura:', error);
        this.isSaving = false;
        this.saveStatus = 'error';
        
        // Resetear el estado después de 3 segundos
        setTimeout(() => {
          this.saveStatus = 'idle';
        }, 3000);
      }
    });
  }

  // Métodos para manejar archivos
  onFileSelected(event: Event, fieldName: string, formType: 'inquilino' | 'fiador') {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validar tamaño del archivo (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 5MB permitido.');
        return;
      }
      
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de archivo no permitido. Solo se permiten imágenes (JPG, PNG) y PDF.');
        return;
      }
      
      // Actualizar el formulario correspondiente
      if (formType === 'inquilino') {
        this.inquilinoForm.patchValue({ [fieldName]: file });
      } else if (formType === 'fiador') {
        this.fiadorForm.patchValue({ [fieldName]: file });
      }
      
      this.logger.log(`📁 Archivo seleccionado para ${fieldName}:`, file.name);
    }
  }

  // Método para obtener el nombre del archivo seleccionado
  getFileName(fieldName: string, formType: 'inquilino' | 'fiador'): string {
    const form = formType === 'inquilino' ? this.inquilinoForm : this.fiadorForm;
    const file = form.get(fieldName)?.value;
    return file ? file.name : 'Ningún archivo seleccionado';
  }

  // Método para limpiar un archivo seleccionado
  clearFile(fieldName: string, formType: 'inquilino' | 'fiador') {
    if (formType === 'inquilino') {
      this.inquilinoForm.patchValue({ [fieldName]: null });
    } else if (formType === 'fiador') {
      this.fiadorForm.patchValue({ [fieldName]: null });
    }
    this.logger.log(`🗑️ Archivo limpiado para ${fieldName}`);
  }

  // Métodos para guardar datos de cada tab
  async savePropietarioData(): Promise<void> {
    this.logger.log('🚀 savePropietarioData() ejecutado');
    
    if (!this.isPropietarioFormValid()) {
      this.logger.warning('⚠️ Formulario de propietario no válido - campos obligatorios faltantes');
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';

    try {
      const wizardState = this.wizardStateService.getState();
      const propietarioData = this.propietarioForm.value;
      
      this.logger.log('💾 Guardando datos de propietario:', propietarioData);
      this.logger.log('📋 policyId disponible:', wizardState.policyId);

      const response = await this.captureDataService.createPropietario(
        wizardState.userId || this.generateTempUserId(),
        {
          ...propietarioData,
          policyId: wizardState.policyId || undefined
        }
      ).toPromise();

      if (response?.success) {
        this.logger.log('✅ Propietario guardado exitosamente:', response.data);
        this.saveStatus = 'saved';
        
        // Actualizar el estado del wizard
        this.wizardStateService.saveState({
          captureData: {
            ...wizardState.captureData,
            propietario: response.data
          }
        });
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      this.logger.error('❌ Error guardando propietario:', error);
      this.saveStatus = 'error';
    } finally {
      this.isSaving = false;
      // Resetear el estado después de 3 segundos
      setTimeout(() => {
        this.saveStatus = 'idle';
      }, 3000);
    }
  }

  async saveInquilinoData(): Promise<void> {
    if (!this.isInquilinoFormValid()) {
      this.logger.warning('⚠️ Formulario de inquilino no válido - campos obligatorios faltantes');
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';

    try {
      const wizardState = this.wizardStateService.getState();
      const inquilinoData = this.inquilinoForm.value;
      
      this.logger.log('💾 Guardando datos de inquilino:', inquilinoData);
      this.logger.log('📋 policyId disponible:', wizardState.policyId);

      // Filtrar campos que no existen en el backend y convertir archivos a strings
      const { comprobanteIngresos3, comprobanteIngresos4, ...filteredData } = inquilinoData;
      
      // Convertir archivos a strings (nombres de archivo o vacío)
      const processedData = {
        ...filteredData,
        ine: filteredData.ine ? (filteredData.ine as File).name : '',
        pasaporte: filteredData.pasaporte ? (filteredData.pasaporte as File).name : '',
        comprobanteDomicilio: filteredData.comprobanteDomicilio ? (filteredData.comprobanteDomicilio as File).name : '',
        comprobanteIngresos: filteredData.comprobanteIngresos ? (filteredData.comprobanteIngresos as File).name : '',
        comprobanteDomicilioImagen: filteredData.comprobanteDomicilioImagen ? (filteredData.comprobanteDomicilioImagen as File).name : '',
        comprobanteIngresos2: filteredData.comprobanteIngresos2 ? (filteredData.comprobanteIngresos2 as File).name : ''
      };
      
      this.logger.log('🔍 Datos procesados para enviar:', processedData);

      const response = await this.captureDataService.createInquilino(
        wizardState.userId || this.generateTempUserId(),
        {
          ...processedData,
          policyId: wizardState.policyId || undefined
        }
      ).toPromise();

      if (response?.success) {
        this.logger.log('✅ Inquilino guardado exitosamente:', response.data);
        this.saveStatus = 'saved';
        
        // Actualizar el estado del wizard
        this.wizardStateService.saveState({
          captureData: {
            ...wizardState.captureData,
            inquilino: response.data
          }
        });
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      this.logger.error('❌ Error guardando inquilino:', error);
      this.saveStatus = 'error';
    } finally {
      this.isSaving = false;
      // Resetear el estado después de 3 segundos
      setTimeout(() => {
        this.saveStatus = 'idle';
      }, 3000);
    }
  }

  async saveFiadorData(): Promise<void> {
    if (!this.isFiadorFormValid()) {
      this.logger.warning('⚠️ Formulario de fiador no válido - campos obligatorios faltantes');
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';

    try {
      const wizardState = this.wizardStateService.getState();
      const fiadorData = this.fiadorForm.value;
      
      this.logger.log('💾 Guardando datos de fiador:', fiadorData);
      this.logger.log('📋 policyId disponible:', wizardState.policyId);

      // Convertir archivos a strings (nombres de archivo o vacío) y manejar fechas
      const processedData = {
        ...fiadorData,
        ine: fiadorData.ine ? (fiadorData.ine as File).name : '',
        escrituras: fiadorData.escrituras ? (fiadorData.escrituras as File).name : '',
        actaMatrimonio: fiadorData.actaMatrimonio ? (fiadorData.actaMatrimonio as File).name : '',
        // Manejar fechas: enviar null si están vacías, de lo contrario mantener el valor
        fechaEscrituraGarantia: fiadorData.fechaEscrituraGarantia && fiadorData.fechaEscrituraGarantia.trim() !== '' 
          ? fiadorData.fechaEscrituraGarantia 
          : null,
        fechaRegistro: fiadorData.fechaRegistro && fiadorData.fechaRegistro.trim() !== '' 
          ? fiadorData.fechaRegistro 
          : null
      };
      
      this.logger.log('🔍 Datos procesados para enviar:', processedData);

      const response = await this.captureDataService.createFiador(
        wizardState.userId || this.generateTempUserId(),
        {
          ...processedData,
          policyId: wizardState.policyId || undefined
        }
      ).toPromise();

      if (response?.success) {
        this.logger.log('✅ Fiador guardado exitosamente:', response.data);
        this.saveStatus = 'saved';
        
        // Actualizar el estado del wizard
        this.wizardStateService.saveState({
          captureData: {
            ...wizardState.captureData,
            fiador: response.data
          }
        });
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      this.logger.error('❌ Error guardando fiador:', error);
      this.saveStatus = 'error';
    } finally {
      this.isSaving = false;
      // Resetear el estado después de 3 segundos
      setTimeout(() => {
        this.saveStatus = 'idle';
      }, 3000);
    }
  }

  async saveInmuebleData(): Promise<void> {
    if (!this.isInmuebleFormValid()) {
      this.logger.warning('⚠️ Formulario de inmueble no válido - campos obligatorios faltantes');
      return;
    }

    this.isSaving = true;
    this.saveStatus = 'saving';

    try {
      const wizardState = this.wizardStateService.getState();
      const inmuebleData = this.inmuebleForm.value;
      
      this.logger.log('💾 Guardando datos de inmueble:', inmuebleData);
      this.logger.log('📋 policyId disponible:', wizardState.policyId);

      // Manejar fechas: enviar null si están vacías
      const processedData = {
        ...inmuebleData,
        fechaEscritura: inmuebleData.fechaEscritura && inmuebleData.fechaEscritura.trim() !== '' 
          ? inmuebleData.fechaEscritura 
          : null,
        fechaRegistro: inmuebleData.fechaRegistro && inmuebleData.fechaRegistro.trim() !== '' 
          ? inmuebleData.fechaRegistro 
          : null,
        vigenciaInicio: inmuebleData.vigenciaInicio && inmuebleData.vigenciaInicio.trim() !== '' 
          ? inmuebleData.vigenciaInicio 
          : null,
        vigenciaFin: inmuebleData.vigenciaFin && inmuebleData.vigenciaFin.trim() !== '' 
          ? inmuebleData.vigenciaFin 
          : null
      };
      
      this.logger.log('🔍 Datos procesados para enviar:', processedData);

      const response = await this.captureDataService.createInmueble(
        wizardState.userId || this.generateTempUserId(),
        {
          ...processedData,
          policyId: wizardState.policyId || undefined
        }
      ).toPromise();

      if (response?.success) {
        this.logger.log('✅ Inmueble guardado exitosamente:', response.data);
        this.saveStatus = 'saved';
        
        // Actualizar el estado del wizard
        this.wizardStateService.saveState({
          captureData: {
            ...wizardState.captureData,
            inmueble: response.data
          }
        });
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (error) {
      this.logger.error('❌ Error guardando inmueble:', error);
      this.saveStatus = 'error';
    } finally {
      this.isSaving = false;
      // Resetear el estado después de 3 segundos
      setTimeout(() => {
        this.saveStatus = 'idle';
      }, 3000);
    }
  }

  getCurrentTabForm(): FormGroup {
    switch (this.activeTab) {
      case 'propietario':
        return this.propietarioForm;
      case 'inquilino':
        return this.inquilinoForm;
      case 'fiador':
        return this.fiadorForm;
      case 'inmueble':
        return this.inmuebleForm;
      default:
        return this.propietarioForm;
    }
  }

  isTabValid(tab: 'propietario' | 'inquilino' | 'fiador' | 'inmueble'): boolean {
    switch (tab) {
      case 'propietario':
        return this.propietarioForm.valid;
      case 'inquilino':
        return this.inquilinoForm.valid;
      case 'fiador':
        return this.fiadorForm.valid;
      case 'inmueble':
        return this.inmuebleForm.valid;
      default:
        return false;
    }
  }

  // Método para generar un UUID temporal válido
  private generateTempUserId(): string {
    // Generar un UUID v4 válido
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Métodos de validación para botones de guardar (solo campos obligatorios)
  isPropietarioFormValid(): boolean {
    const form = this.propietarioForm;
    const isValid = !!(
      form.get('fechaAlta')?.value &&
      form.get('curp')?.value &&
      form.get('tipoPersona')?.value &&
      form.get('nombre')?.value &&
      form.get('telefono')?.value &&  // Agregado: telefono es obligatorio en el backend
      form.get('calle')?.value &&
      form.get('numeroExterior')?.value &&
      form.get('cp')?.value &&
      form.get('colonia')?.value &&
      form.get('alcaldiaMunicipio')?.value &&
      form.get('estado')?.value
    );
    
    
    return isValid;
  }

  isInquilinoFormValid(): boolean {
    const form = this.inquilinoForm;
    return !!(
      form.get('fechaAlta')?.value &&
      form.get('curp')?.value &&
      form.get('tipoPersona')?.value &&
      form.get('nombre')?.value &&
      form.get('telefono')?.value &&  // Agregado: telefono es obligatorio en el backend
      form.get('calle')?.value &&
      form.get('numeroExterior')?.value &&
      form.get('cp')?.value &&
      form.get('colonia')?.value &&
      form.get('alcaldiaMunicipio')?.value &&
      form.get('estado')?.value
    );
  }

  isFiadorFormValid(): boolean {
    const form = this.fiadorForm;
    return !!(
      form.get('fechaAlta')?.value &&
      form.get('curp')?.value &&
      form.get('tipoPersona')?.value &&
      form.get('nombre')?.value &&
      form.get('telefono')?.value &&  // Agregado: telefono es obligatorio en el backend
      form.get('calle')?.value &&
      form.get('numeroExterior')?.value &&
      form.get('cp')?.value &&
      form.get('colonia')?.value &&
      form.get('alcaldiaMunicipio')?.value &&
      form.get('estado')?.value &&
      form.get('calleGarantia')?.value &&
      form.get('numeroExteriorGarantia')?.value &&
      form.get('cpGarantia')?.value &&
      form.get('coloniaGarantia')?.value &&
      form.get('alcaldiaMunicipioGarantia')?.value &&
      form.get('estadoGarantia')?.value
    );
  }

  isInmuebleFormValid(): boolean {
    const form = this.inmuebleForm;
    return !!(
      form.get('calle')?.value &&
      form.get('numeroExterior')?.value &&
      form.get('cp')?.value &&
      form.get('colonia')?.value &&
      form.get('alcaldiaMunicipio')?.value &&
      form.get('estado')?.value &&
      form.get('tipoInmueble')?.value &&
      form.get('renta')?.value &&
      form.get('vigenciaInicio')?.value &&
      form.get('vigenciaFin')?.value
    );
  }

  // Métodos para calcular progreso
  calculateProgress(): void {
    this.completionProgress.propietario = this.calculateFormProgress(this.propietarioForm, this.getPropietarioRequiredFields());
    this.completionProgress.inquilino = this.calculateFormProgress(this.inquilinoForm, this.getInquilinoRequiredFields());
    this.completionProgress.fiador = this.calculateFormProgress(this.fiadorForm, this.getFiadorRequiredFields());
    this.completionProgress.inmueble = this.calculateFormProgress(this.inmuebleForm, this.getInmuebleRequiredFields());
    
    // Calcular progreso total
    const totalProgress = this.completionProgress.propietario + 
                         this.completionProgress.inquilino + 
                         this.completionProgress.fiador + 
                         this.completionProgress.inmueble;
    this.completionProgress.total = Math.round(totalProgress / 4);
  }

  calculateFormProgress(form: FormGroup, requiredFields: string[]): number {
    if (!form) return 0;
    
    let completedFields = 0;
    requiredFields.forEach(field => {
      const control = form.get(field);
      if (control && control.value && control.value.toString().trim() !== '') {
        completedFields++;
      }
    });
    
    return Math.round((completedFields / requiredFields.length) * 100);
  }

  getPropietarioRequiredFields(): string[] {
    return ['fechaAlta', 'curp', 'tipoPersona', 'nombre', 'telefono', 'calle', 'numeroExterior', 'cp', 'colonia', 'alcaldiaMunicipio', 'estado'];
  }

  getInquilinoRequiredFields(): string[] {
    return ['fechaAlta', 'curp', 'tipoPersona', 'nombre', 'telefono', 'calle', 'numeroExterior', 'cp', 'colonia', 'alcaldiaMunicipio', 'estado'];
  }

  getFiadorRequiredFields(): string[] {
    return ['fechaAlta', 'curp', 'tipoPersona', 'nombre', 'telefono', 'calle', 'numeroExterior', 'cp', 'colonia', 'alcaldiaMunicipio', 'estado', 'calleGarantia', 'numeroExteriorGarantia', 'cpGarantia', 'coloniaGarantia', 'alcaldiaMunicipioGarantia', 'estadoGarantia'];
  }

  getInmuebleRequiredFields(): string[] {
    return ['calle', 'numeroExterior', 'cp', 'colonia', 'alcaldiaMunicipio', 'estado', 'renta', 'vigenciaInicio', 'vigenciaFin'];
  }

  getProgressColor(progress: number): string {
    if (progress === 100) return '#28a745'; // Verde para completado
    if (progress >= 75) return '#17a2b8'; // Azul para casi completado
    if (progress >= 50) return '#ffc107'; // Amarillo para parcialmente completado
    return '#dc3545'; // Rojo para poco completado
  }

  getProgressIcon(progress: number): string {
    if (progress === 100) return '✓';
    if (progress >= 75) return '○';
    if (progress >= 50) return '◐';
    return '○';
  }

  /**
   * Verifica si ya se han guardado datos para un tipo específico
   */
  hasSavedData(type: string): boolean {
    const wizardState = this.wizardStateService.getState();
    
    switch (type) {
      case 'propietario':
        return !!(wizardState.captureData?.propietario);
      case 'inquilino':
        return !!(wizardState.captureData?.inquilino);
      case 'fiador':
        return !!(wizardState.captureData?.fiador);
      case 'inmueble':
        return !!(wizardState.captureData?.inmueble);
      default:
        return false;
    }
  }

  /**
   * Verifica si todos los tabs están completos (100%)
   */
  areAllTabsComplete(): boolean {
    return this.completionProgress.propietario === 100 &&
           this.completionProgress.inquilino === 100 &&
           this.completionProgress.fiador === 100 &&
           this.completionProgress.inmueble === 100;
  }

}
