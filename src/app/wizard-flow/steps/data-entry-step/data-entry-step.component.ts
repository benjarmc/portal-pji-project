import { Component, Output, EventEmitter, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { WizardStateService } from '../../../services/wizard-state.service';
import { CaptureDataService } from '../../../services/capture-data.service';

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
  
  propietarioForm!: FormGroup;
  inquilinoForm!: FormGroup;
  fiadorForm!: FormGroup;
  inmuebleForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private wizardStateService: WizardStateService,
    private captureDataService: CaptureDataService
  ) {
    this.initializeForms();
  }

  ngOnInit() {
    this.loadExistingData();
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
    
    // Primero cargar desde el estado local del wizard
    if (state && state.contractData) {
      const contractData = state.contractData;
      
      if (contractData.propietario) {
        this.propietarioForm.patchValue(contractData.propietario);
      }
      if (contractData.inquilino) {
        this.inquilinoForm.patchValue(contractData.inquilino);
      }
      if (contractData.fiador) {
        this.fiadorForm.patchValue(contractData.fiador);
      }
      if (contractData.inmueble) {
        this.inmuebleForm.patchValue(contractData.inmueble);
      }
    }

    // También intentar cargar desde el backend si tenemos userId
    if (state && state.userId) {
      this.loadDataFromBackend(state.userId);
    }
  }

  private loadDataFromBackend(userId: string) {
    console.log('📡 Cargando datos de captura desde el backend...');
    
    this.captureDataService.getAllCaptureData(userId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const data = response.data;
          
          // Solo actualizar formularios si no tienen datos locales
          if (data.propietario && !this.propietarioForm.get('nombre')?.value) {
            this.propietarioForm.patchValue(data.propietario);
            console.log('✅ Datos de propietario cargados desde backend');
          }
          
          if (data.inquilino && !this.inquilinoForm.get('nombre')?.value) {
            this.inquilinoForm.patchValue(data.inquilino);
            console.log('✅ Datos de inquilino cargados desde backend');
          }
          
          if (data.fiador && !this.fiadorForm.get('nombre')?.value) {
            this.fiadorForm.patchValue(data.fiador);
            console.log('✅ Datos de fiador cargados desde backend');
          }
          
          if (data.inmueble && !this.inmuebleForm.get('calle')?.value) {
            this.inmuebleForm.patchValue(data.inmueble);
            console.log('✅ Datos de inmueble cargados desde backend');
          }
        }
      },
      error: (error) => {
        console.log('ℹ️ No hay datos guardados en el backend aún:', error.message);
        // No es un error crítico, simplemente no hay datos guardados
      }
    });
  }

  setActiveTab(tab: 'propietario' | 'inquilino' | 'fiador' | 'inmueble') {
    this.activeTab = tab;
  }

  onNext() {
    if (this.validateCurrentTab()) {
      this.saveData();
      this.next.emit();
    }
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
    console.log('💾 Guardando datos de captura en el backend...');
    this.isSaving = true;
    this.saveStatus = 'saving';
    
    this.captureDataService.saveAllCaptureData(userId, {
      propietario: data.propietario,
      inquilino: data.inquilino,
      fiador: data.fiador,
      inmueble: data.inmueble
    }).subscribe({
      next: (response) => {
        console.log('✅ Datos de captura guardados en el backend:', response);
        this.isSaving = false;
        this.saveStatus = 'saved';
        
        // Resetear el estado después de 2 segundos
        setTimeout(() => {
          this.saveStatus = 'idle';
        }, 2000);
      },
      error: (error) => {
        console.error('❌ Error guardando datos de captura:', error);
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
      
      console.log(`📁 Archivo seleccionado para ${fieldName}:`, file.name);
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
    console.log(`🗑️ Archivo limpiado para ${fieldName}`);
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
}
