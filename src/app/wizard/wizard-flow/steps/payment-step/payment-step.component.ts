import { Component, Output, EventEmitter, OnInit, AfterViewInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OpenPayService, OpenPayCardData, OpenPayTokenResponse } from '../../../../services/openpay.service';
import { PaymentsService, PaymentData } from '../../../../services/payments.service';
import { QuotationsService } from '../../../../services/quotations.service';
import { PlansService } from '../../../../services/plans.service';
import { WizardStateService } from '../../../../services/wizard-state.service';
import { WizardSessionService } from '../../../../services/wizard-session.service';
import { CreateQuotationDto } from '../../../../models/quotation.model';
import { environment } from '../../../../../environments/environment';
import { LoggerService } from '../../../../services/logger.service';
@Component({
  selector: 'app-payment-step',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-step.component.html',
  styleUrls: ['./payment-step.component.scss']
})
export class PaymentStepComponent implements OnInit, AfterViewInit {
  @Output() next = new EventEmitter<any>(); // Cambiar a any para incluir datos del pago
  @Output() previous = new EventEmitter<void>();
  @Output() goToFinish = new EventEmitter<string>(); // Para redirigir al paso de finalización
  @Input() quotationId?: string;
  @Input() quotationData?: any;
  @Input() userId?: string; // Agregar userId como Input

  // Datos de la tarjeta
  cardData: OpenPayCardData = {
    card_number: '',
    holder_name: '',
    expiration_year: '',
    expiration_month: '',
    cvv2: ''
  };

  // Estados del componente
  isProcessing = false;
  isCreatingQuotation = false; // Para el estado de creación de cotización
  cardType = '';
  deviceDataId = '';
  paymentError = '';
  paymentSuccess = '';
  showQuotationSummary = true; // Siempre mostrar resumen de cotización

  // Errores de validación
  cardErrors = {
    number: '',
    cvv: '',
    expiry: ''
  };

  // Opciones para los selects
  months = [
    { value: '01', label: '01 - Enero' },
    { value: '02', label: '02 - Febrero' },
    { value: '03', label: '03 - Marzo' },
    { value: '04', label: '04 - Abril' },
    { value: '05', label: '05 - Mayo' },
    { value: '06', label: '06 - Junio' },
    { value: '07', label: '07 - Julio' },
    { value: '08', label: '08 - Agosto' },
    { value: '09', label: '09 - Septiembre' },
    { value: '10', label: '10 - Octubre' },
    { value: '11', label: '11 - Noviembre' },
    { value: '12', label: '12 - Diciembre' }
  ];

  years: string[] = [];

  // Plan seleccionado y precio (viene del wizard)
  selectedPlan = ''; // Ya no se usa nombre hardcodeado
  planPrice = 0;
  quotationNumber = '';
  quotationAmount = 0;
  quotationCurrency = 'MXN';

  constructor(
    private openPayService: OpenPayService,
    private paymentsService: PaymentsService,
    private quotationsService: QuotationsService,
    private plansService: PlansService,
    private wizardStateService: WizardStateService,
    private wizardSessionService: WizardSessionService,
    private logger: LoggerService
  ) {
    // Generar años de 2 dígitos (actual + 10 años)
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
      const year = currentYear + i;
      this.years.push(year.toString().slice(-2)); // Solo los últimos 2 dígitos
    }
  }

  ngOnInit() {
    this.logger.log('🔄 PaymentStepComponent ngOnInit');
    this.logger.log('📊 quotationId recibido:', this.quotationId);
    this.logger.log('📊 quotationData recibido:', this.quotationData);
    
    // ✅ IMPORTANTE: Verificar si hay tokens disponibles, si no, intentar obtenerlos
    this.ensureTokensAvailable();
    
    // Configurar OpenPay usando environment
    this.openPayService.configure(
      environment.openpay.merchantId,
      environment.openpay.publicKey,
      environment.openpay.sandboxMode
    );

    // Si no hay quotationId como Input, intentar obtenerlo del estado del wizard
    if (!this.quotationId) {
      const wizardState = this.wizardStateService.getState();
      if (wizardState.quotationId) {
        this.quotationId = wizardState.quotationId;
        this.logger.log('🔑 quotationId obtenido del estado del wizard:', this.quotationId);
      }
    }

    // Cargar datos de cotización si están disponibles
    if (this.quotationData) {
      this.logger.log('✅ Cargando datos de cotización desde quotationData');
      this.loadQuotationData();
    } else {
      this.logger.log('⚠️ No hay quotationData, intentando cargar desde estado del wizard');
      this.loadQuotationFromWizardState();
    }
  }

  /**
   * Asegurar que los tokens estén disponibles, si no, intentar obtenerlos
   */
  private async ensureTokensAvailable(): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const existingToken = localStorage.getItem('wizard_access_token');
    if (existingToken) {
      this.logger.log('✅ Token JWT ya disponible en localStorage');
      return;
    }

    // Si no hay token, intentar obtenerlo de la sesión actual
    const wizardState = this.wizardStateService.getState();
    const sessionId = wizardState.sessionId || wizardState.id;
    
    if (sessionId) {
      this.logger.log('⚠️ No hay token disponible, intentando obtenerlo de la sesión:', sessionId);
      try {
        const sessionData = await this.wizardSessionService.getSession(sessionId, true).toPromise();
        if (sessionData) {
          const actualData = (sessionData as any).data || sessionData;
          if (actualData.accessToken && actualData.refreshToken) {
            localStorage.setItem('wizard_access_token', actualData.accessToken);
            localStorage.setItem('wizard_refresh_token', actualData.refreshToken);
            this.logger.log('✅ Tokens obtenidos y guardados en payment-step');
          } else {
            this.logger.warning('⚠️ No se recibieron tokens al intentar obtenerlos en payment-step');
          }
        }
      } catch (error) {
        this.logger.error('❌ Error obteniendo tokens en payment-step:', error);
      }
    } else {
      this.logger.warning('⚠️ No hay sessionId disponible para obtener tokens');
    }
  }

  ngAfterViewInit() {
    // Configurar device data después de que la vista esté completamente inicializada
    // Esto asegura que el formulario esté en el DOM antes de que OpenPay intente crear iframes
    this.logger.log('🔄 PaymentStepComponent ngAfterViewInit - Configurando device data');
    
    // Esperar un tick para asegurar que Angular haya completado el renderizado
    setTimeout(() => {
      try {
        this.deviceDataId = this.openPayService.setupDeviceData('paymentForm');
        this.logger.log('✅ Device data configurado:', this.deviceDataId);
      } catch (error) {
        this.logger.error('❌ Error configurando device data:', error);
        // Generar un ID alternativo si falla
        this.deviceDataId = 'device-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      }
    }, 0);
  }

  /**
   * Cargar datos de la cotización
   */
  loadQuotationData() {
    if (this.quotationData) {
      this.logger.log('📊 Cargando datos de cotización:', this.quotationData);
      this.selectedPlan = this.quotationData.plan?.name || ''; // Ya no se usa nombre hardcodeado
      this.planPrice = this.quotationData.plan?.price || 0;
      this.quotationNumber = this.quotationData.quotationNumber || '';
      this.quotationAmount = this.quotationData.quotationAmount || 0;
      this.quotationCurrency = this.quotationData.quotationCurrency || 'MXN';
      this.showQuotationSummary = true;
      
      this.logger.log('💰 Datos cargados - Plan:', this.selectedPlan, 'Monto:', this.quotationAmount);
    }
  }

  /**
   * Cargar cotización desde el estado del wizard
   */
  private loadQuotationFromWizardState(): void {
    this.logger.log('🔍 Intentando cargar cotización desde estado del wizard');
    
    try {
      const wizardState = this.wizardStateService.getState();
      this.logger.log('📊 Estado del wizard cargado:', wizardState);
      
      // Obtener datos del estado del wizard
      if (wizardState.quotationId && !this.quotationId) {
        this.quotationId = wizardState.quotationId;
        this.logger.log('🔑 quotationId obtenido del estado:', this.quotationId);
      }
      
      if (wizardState.quotationNumber) {
        this.quotationNumber = wizardState.quotationNumber;
        this.logger.log('📋 quotationNumber obtenido del estado:', this.quotationNumber);
      }
      
      if (wizardState.userId && !this.userId) {
        this.userId = wizardState.userId;
        this.logger.log('👤 userId obtenido del estado:', this.userId);
      }

      // Si tenemos datos de cotización en el estado local, usarlos primero
      // paymentAmount se guarda cuando se completa el paso de pago o cuando se crea la cotización
      if (wizardState.paymentAmount && wizardState.paymentAmount > 0) {
        this.logger.log('✅ Usando datos de cotización del estado local (evita GET redundante)');
        
        this.quotationAmount = wizardState.paymentAmount;
        this.logger.log('💰 Usando paymentAmount del estado:', this.quotationAmount);
        
        // Obtener plan seleccionado
        if (wizardState.selectedPlanName) {
          this.selectedPlan = wizardState.selectedPlanName;
          this.logger.log('📋 Plan obtenido del estado:', this.selectedPlan);
        }
        
        this.quotationCurrency = 'MXN';
        this.showQuotationSummary = true;
        
        this.logger.log('✅ Datos cargados desde estado local:', {
          amount: this.quotationAmount,
          currency: this.quotationCurrency,
          number: this.quotationNumber,
          plan: this.selectedPlan
        });
        
        // No hacer GET si ya tenemos los datos necesarios
        return;
      }
      
      // Si tenemos quotationId pero no paymentAmount, intentar cargar desde API
      // Esto es útil cuando se recarga la página y ya existe la cotización
      if (this.quotationId && (!this.quotationAmount || this.quotationAmount === 0)) {
        this.logger.log('🔍 Hay quotationId pero no paymentAmount, obteniendo datos desde API:', this.quotationId);
        this.loadQuotationFromAPI();
      } else {
        // Usar valores por defecto si no hay datos
        this.logger.log('⚠️ No hay quotationId o datos suficientes, usando valores por defecto');
        this.loadDefaultValues();
      }
    } catch (error) {
      this.logger.error('❌ Error cargando estado del wizard:', error);
      // Usar valores por defecto en caso de error
      this.loadDefaultValues();
    }
  }

  /**
   * Cargar datos de cotización desde la API
   */
  private loadQuotationFromAPI(): void {
    if (!this.quotationId) {
      this.logger.warning('⚠️ No hay quotationId para cargar desde API');
      return;
    }
    
    this.logger.log('🔍 Iniciando llamada a API con quotationId:', this.quotationId);
    
    this.quotationsService.getQuotationById(this.quotationId).subscribe({
      next: (response) => {
        this.logger.log('📡 Respuesta completa de la API:', response);
        
        if (response.success && response.data) {
          this.logger.log('✅ Datos de cotización obtenidos desde API:', response.data);
          this.logger.log('💰 finalPrice en response.data:', response.data.finalPrice);
          this.logger.log('💰 basePrice en response.data:', response.data.basePrice);
          this.logger.log('📋 quotationNumber en response.data:', response.data.quotationNumber);
          this.logger.log('📋 plan en response.data:', response.data.plan);
          
          // Actualizar datos del componente usando la estructura correcta del modelo
          // Usar finalPrice, basePrice, o precio del plan como fallback
          const finalPrice = parseFloat(response.data.finalPrice || '0');
          const basePrice = parseFloat(response.data.basePrice || '0');
          const planPrice = parseFloat(response.data.plan?.price || '0');
          
          this.logger.log('💰 Análisis de precios:');
          this.logger.log('  - finalPrice:', finalPrice);
          this.logger.log('  - basePrice:', basePrice);
          this.logger.log('  - planPrice:', planPrice);
          this.logger.log('  - ¿finalPrice > 0?', finalPrice > 0);
          this.logger.log('  - ¿basePrice > 0?', basePrice > 0);
          this.logger.log('  - ¿planPrice > 0?', planPrice > 0);
          
          // TEMPORAL: Forzar uso del precio de la API si está disponible
          if (finalPrice > 0) {
            this.quotationAmount = finalPrice;
            this.logger.log('✅ Usando finalPrice de la API:', finalPrice);
          } else if (basePrice > 0) {
            this.quotationAmount = basePrice;
            this.logger.log('✅ Usando basePrice de la API:', basePrice);
          } else if (planPrice > 0) {
            this.quotationAmount = planPrice;
            this.logger.log('✅ Usando planPrice de la API:', planPrice);
          } else {
            // Calcular precio basado en renta mensual si está disponible
            const rentaMensual = response.data.userData?.rentaMensual;
            if (rentaMensual && rentaMensual > 0) {
              this.quotationAmount = Math.max(0, rentaMensual * 0.01); // Cálculo dinámico sin precio mínimo hardcodeado
              this.logger.log('✅ Calculando precio basado en renta mensual:', rentaMensual, '->', this.quotationAmount);
            } else {
              this.quotationAmount = 0; // Ya no se usa precio hardcodeado
              this.logger.log('⚠️ Usando precio por defecto (no hay datos de renta)');
            }
          }
          this.quotationCurrency = 'MXN'; // Por defecto MXN
          this.quotationNumber = response.data.quotationNumber || response.data.id || this.quotationId || 'COT-' + Date.now();
          this.selectedPlan = response.data.plan?.name || ''; // Ya no se usa nombre hardcodeado
          
          this.logger.log('💰 Precio final seleccionado:', this.quotationAmount);
          this.logger.log('💰 Precio obtenido desde API:', this.quotationAmount > 0);
          
          this.logger.log('💰 Datos de cotización actualizados:', {
            amount: this.quotationAmount,
            currency: this.quotationCurrency,
            number: this.quotationNumber,
            plan: this.selectedPlan
          });
          
          // Guardar los datos cargados en el estado del wizard para futuras referencias
          this.wizardStateService.saveState({
            quotationId: this.quotationId, // ✅ Guardar quotationId también
            quotationNumber: this.quotationNumber,
            selectedPlanName: this.selectedPlan,
            paymentAmount: this.quotationAmount // Guardar como paymentAmount (propiedad existente en WizardState)
          });
          
          // Mostrar el resumen
          this.showQuotationSummary = true;
        } else {
          this.logger.warning('⚠️ Respuesta de API no exitosa:', response);
          this.loadDefaultValues();
        }
      },
      error: (error) => {
        const errorStatus = (error as any)?.status;
        
        // Si es 429 (Too Many Requests), usar datos del estado local como fallback
        if (errorStatus === 429) {
          this.logger.warning('⚠️ Rate limit alcanzado (429), usando datos del estado local como fallback');
          const wizardState = this.wizardStateService.getState();
          
          // Intentar obtener datos del estado local
          if (wizardState.paymentAmount && wizardState.paymentAmount > 0) {
            this.quotationAmount = wizardState.paymentAmount;
            this.logger.log('✅ Usando paymentAmount del estado local:', this.quotationAmount);
          } else {
            // Si no hay datos locales, usar valores por defecto
            this.loadDefaultValues();
          }
          
          if (wizardState.selectedPlanName) {
            this.selectedPlan = wizardState.selectedPlanName;
          }
          
          this.quotationCurrency = 'MXN';
          this.showQuotationSummary = true;
          
          this.logger.log('✅ Datos cargados desde estado local después de 429:', {
            amount: this.quotationAmount,
            currency: this.quotationCurrency,
            number: this.quotationNumber,
            plan: this.selectedPlan
          });
        } else {
          this.logger.error('❌ Error obteniendo cotización desde API:', error);
          this.logger.error('❌ Error details:', error.error);
          this.loadDefaultValues();
        }
      }
    });
  }

  /**
   * Cargar valores por defecto
   */
  private loadDefaultValues(): void {
    this.logger.log('🔄 Cargando valores por defecto');
    this.quotationAmount = 0; // Ya no se usa precio hardcodeado
    this.quotationCurrency = 'MXN';
    this.quotationNumber = 'COT-' + Date.now();
    this.selectedPlan = ''; // Ya no se usa nombre hardcodeado
    
    this.logger.log('💰 Valores por defecto cargados:', {
      amount: this.quotationAmount,
      currency: this.quotationCurrency,
      number: this.quotationNumber,
      plan: this.selectedPlan
    });
  }

  validateCard() {
    // Limpiar errores anteriores
    this.cardErrors = { number: '', cvv: '', expiry: '' };

    // Limpiar espacios del número de tarjeta para validación
    const cleanCardNumber = this.cardData.card_number.replace(/\s+/g, '');

    // Validar número de tarjeta
    if (cleanCardNumber) {
      // Primero validar formato básico (solo números, longitud válida)
      if (!/^\d{13,19}$/.test(cleanCardNumber)) {
        this.cardErrors.number = 'Número de tarjeta inválido';
        return Object.values(this.cardErrors).every(error => !error);
      }

      // Validar con OpenPay
      if (!this.openPayService.validateCardNumber(cleanCardNumber)) {
        // Si OpenPay rechaza el número, verificar si es un número de prueba conocido
        const testCards = [
          '4111111111111111', // Visa de prueba
          '4242424242424242', // Visa de prueba
          '5555555555554444', // Mastercard de prueba
          '378282246310005',  // American Express de prueba
          '6011111111111117', // Discover de prueba
        ];
        
        // Si es un número de prueba conocido pero OpenPay lo rechaza, puede ser problema de configuración
        if (testCards.includes(cleanCardNumber)) {
          this.logger.warning('⚠️ Número de tarjeta de prueba rechazado por OpenPay. Verifica la configuración.');
        }
        
        this.cardErrors.number = 'Número de tarjeta inválido';
      } else {
        this.cardType = this.openPayService.getCardType(cleanCardNumber);
      }
    }

    // Validar CVV
    if (this.cardData.cvv2) {
      if (!this.openPayService.validateCVC(this.cardData.cvv2)) {
        this.cardErrors.cvv = 'Código de seguridad inválido';
      }
    }

    // Validar fecha de expiración
    if (this.cardData.expiration_month && this.cardData.expiration_year) {
      if (!this.openPayService.validateExpiry(this.cardData.expiration_month, this.cardData.expiration_year)) {
        this.cardErrors.expiry = 'Fecha de expiración inválida';
      }
    }

    // Verificar si hay errores
    return Object.values(this.cardErrors).every(error => !error);
  }

  /**
   * Formatea el número de tarjeta agregando espacios cada 4 dígitos
   */
  formatCardNumber(event: any): void {
    let value = event.target.value.replace(/\s+/g, ''); // Eliminar espacios existentes
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value; // Agregar espacios cada 4 dígitos
    
    // Limitar a 19 caracteres (16 dígitos + 3 espacios)
    if (formattedValue.length > 19) {
      formattedValue = formattedValue.substring(0, 19);
    }
    
    this.cardData.card_number = formattedValue;
    
    // Validar después de formatear
    this.validateCard();
  }

  /**
   * Maneja cambios en los campos de fecha
   */
  onDateChange(): void {
    this.validateCard();
  }

  async processPayment() {
    if (!this.validateCard()) {
      this.paymentError = 'Por favor, corrige los errores en la tarjeta';
      return;
    }

    if (!this.quotationId) {
      this.paymentError = 'No se encontró la cotización. Por favor, regresa al paso anterior.';
      return;
    }

    // Validar que el monto sea válido
    if (!this.quotationAmount || this.quotationAmount <= 0) {
      this.paymentError = 'El monto de la cotización no es válido. Por favor, regresa al paso anterior.';
      return;
    }

    this.isProcessing = true;
    this.paymentError = '';
    this.paymentSuccess = '';

    try {
      // Limpiar espacios del número de tarjeta antes de enviar
      const cleanCardData: OpenPayCardData = {
        ...this.cardData,
        card_number: this.cardData.card_number.replace(/\s+/g, '')
      };

      const paymentData: PaymentData = {
        quotationId: this.quotationId,
        cardData: cleanCardData, // Usar cardData limpio sin espacios
        amount: this.quotationAmount, // Usar quotationAmount en lugar de planPrice
        currency: this.quotationCurrency,
        description: `Pago de póliza: ${this.selectedPlan}`
      };

      // Procesar pago usando el servicio
      this.paymentsService.processPayment(paymentData, this.userId).subscribe({
        next: (response) => {
          this.logger.log('💰 Procesando respuesta del pago...');
          this.logger.log('📡 Respuesta completa del pago:', JSON.stringify(response, null, 2));
          
          // Verificar si la respuesta es exitosa (puede venir en response.success o response.data.success)
          const isSuccess = response.success || (response.data && response.data?.success);
          
          if (isSuccess) {
            // Obtener el mensaje de éxito de la respuesta o usar uno por defecto
            const successMessage = response.data?.message || response.message || '¡Pago procesado exitosamente!';
            this.paymentSuccess = successMessage;
            
            this.logger.log('✅ Pago procesado exitosamente');
            
            // Limpiar formulario
            this.resetForm();
            
            // Guardar información del pago en el estado del wizard
            const responseData = response as any; // Usar any para evitar errores de TypeScript
            const paymentResult = {
              success: true,
              paymentId: responseData.paymentId || responseData.data?.paymentId || responseData.data?.id,
              chargeId: responseData.chargeId || responseData.data?.chargeId || 'N/A',
              policyId: responseData.policyId || responseData.data?.policyId || 'N/A',
              policyNumber: responseData.policyNumber || responseData.data?.policyNumber || 'N/A',
              status: responseData.status || responseData.data?.status || 'COMPLETED',
              message: responseData.message || responseData.data?.message || 'Pago procesado exitosamente'
            };
            
            // ✅ NUEVO: Guardar también paymentData completo para recuperación posterior
            const paymentDataComplete = responseData.data || responseData;
            
            this.logger.log('📋 paymentResult creado:', paymentResult);
            this.logger.log('📋 paymentData completo:', paymentDataComplete);
            this.logger.log('🔍 Campos extraídos:');
            this.logger.log('  - paymentId:', paymentResult.paymentId);
            this.logger.log('  - policyId:', paymentResult.policyId);
            this.logger.log('  - policyNumber:', paymentResult.policyNumber);
            
            // Guardar información del pago en el estado del wizard (incluyendo paymentData completo)
            this.wizardStateService.saveState({
              paymentResult: paymentResult,
              paymentData: paymentDataComplete, // ✅ Guardar objeto completo de pago
              policyId: paymentResult.policyId !== 'N/A' ? paymentResult.policyId : undefined,
              policyNumber: paymentResult.policyNumber !== 'N/A' ? paymentResult.policyNumber : undefined,
              paymentAmount: paymentDataComplete.amount || this.quotationAmount,
              metadata: {
                transactionId: paymentResult.paymentId,
                paymentTimestamp: new Date().toISOString()
              }
            });
            
            this.logger.log('💾 Estado guardado en wizardStateService:', {
              paymentResult: paymentResult,
              policyId: paymentResult.policyId !== 'N/A' ? paymentResult.policyId : undefined,
              policyNumber: paymentResult.policyNumber !== 'N/A' ? paymentResult.policyNumber : undefined,
              paymentAmount: this.quotationAmount
            });
            
            // Sincronizar con el backend para guardar los datos del pago
            this.wizardStateService.syncWithBackendCorrected(this.wizardStateService.getState()).then(() => {
              this.logger.log('✅ Datos del pago sincronizados con el backend');
            }).catch(error => {
              this.logger.error('❌ Error sincronizando datos del pago con backend:', error);
            });
            
            // Esperar 3 segundos para que el usuario vea el mensaje
            setTimeout(() => {
              this.next.emit(paymentResult);
            }, 3000);
          } else {
            const errorMessage = response.message || response.data?.message || 'Error procesando el pago';
            this.paymentError = errorMessage;
            this.logger.log('❌ Error en pago:', errorMessage);
          }
        },
        error: (error) => {
          this.logger.error('Error en pago:', error);
          // Usar mensaje mejorado si está disponible, sino el mensaje original
          const errorMessage = error.message || 
                             error.error?.message || 
                             error.error?.description ||
                             'Error procesando el pago. Por favor, verifica los datos e intenta nuevamente.';
          this.paymentError = errorMessage;
        },
        complete: () => {
          this.isProcessing = false;
        }
      });

    } catch (error: any) {
      this.logger.error('Error procesando pago:', error);
      this.paymentError = error.message || 'Error inesperado procesando el pago';
      this.isProcessing = false;
    }
  }

  /**
   * Enviar cotización por email (igual que en el paso anterior)
   * Usa la cotización existente si ya existe, solo crea una nueva si no hay quotationId
   */
  async sendQuotationEmail(): Promise<void> {
    this.logger.log('📧 Enviando cotización por correo desde paso de pago...');
    
    this.isCreatingQuotation = true;
    this.isProcessing = true;
    this.paymentError = '';
    this.paymentSuccess = '';

    try {
      let quotationId = this.quotationId;
      let quotationNumber = this.quotationNumber || 'N/A';
      
      // Verificar si ya existe una cotización
      if (quotationId) {
        this.logger.log('✅ Cotización existente encontrada, usando ID:', quotationId);
        // Si ya existe quotationId, usar ese directamente sin crear nueva cotización
      } else {
        // Solo crear cotización si no existe
        this.logger.log('🔄 No hay cotización existente, creando nueva...');
        const quotationData = await this.createQuotation();
        this.logger.log('📊 Cotización creada:', quotationData);
        
        // Obtener el ID de la cotización creada
        quotationId = quotationData?.quotationId || quotationData?.id;
        quotationNumber = quotationData?.quotationNumber || 'N/A';
        
        if (!quotationId) {
          this.logger.error('❌ No se pudo obtener ID de cotización:', quotationData);
          this.paymentError = 'Error: No se pudo crear la cotización';
          this.isProcessing = false;
          this.isCreatingQuotation = false;
          return;
        }
        
        // Actualizar quotationId si se creó una nueva
        this.quotationId = quotationId;
        this.quotationNumber = quotationNumber;
        
        // ✅ Guardar quotationId en el estado del wizard inmediatamente después de crearlo
        this.wizardStateService.saveState({
          quotationId: quotationId,
          quotationNumber: quotationNumber,
          paymentAmount: quotationData.quotationAmount || this.quotationAmount || 0,
          selectedPlanName: quotationData.plan?.name || this.selectedPlan || ''
        });
        
        this.logger.log('💾 Nueva cotización guardada en estado del wizard:', quotationId);
      }
      
      // Enviar cotización por correo usando el ID existente o el recién creado
      this.logger.log('📡 Enviando cotización por correo con ID:', quotationId);
      this.quotationsService.sendQuotationEmail(quotationId).subscribe({
        next: (response) => {
          this.logger.log('📥 Respuesta del envío:', response);
          if (response.success) {
            this.logger.log('📧 Cotización enviada por correo exitosamente');
            this.paymentSuccess = 'Cotización enviada por email exitosamente';
            this.paymentError = '';
            
            // ✅ IMPORTANTE: Guardar quotationId y quotationNumber en el estado del wizard
            // para que estén disponibles si el usuario recarga la página
            this.wizardStateService.saveState({
              quotationId: quotationId,
              quotationNumber: quotationNumber,
              paymentAmount: this.quotationAmount,
              selectedPlanName: this.selectedPlan
            });
            
            this.logger.log('💾 quotationId guardado en estado del wizard:', quotationId);
            
            // Emitir evento con el número de cotización para redirigir al paso de finalización
            this.goToFinish.emit(quotationNumber);
          } else {
            this.logger.error('❌ Error enviando cotización por correo:', response.message);
            this.paymentError = response.message || 'Error enviando cotización por correo';
          }
        },
        error: (error) => {
          this.logger.error('❌ Error enviando cotización por correo:', error);
          this.logger.error('❌ Detalles del error:', { error: error.error, status: error.status, message: error.message });
          this.paymentError = 'Error enviando cotización por correo';
        },
        complete: () => {
          this.isProcessing = false;
          this.isCreatingQuotation = false;
        }
      });
    } catch (error: any) {
      this.logger.error('❌ Error en proceso de envío de cotización:', error);
      this.paymentError = error.message || 'Error enviando cotización';
      this.isProcessing = false;
      this.isCreatingQuotation = false;
    }
  }

  /**
   * Crear cotización en el backend (similar al paso anterior)
   */
  private async createQuotation(): Promise<any> {
    // Obtener datos del estado del wizard
    const wizardState = this.wizardStateService.getState();
    const userData = wizardState.userData;
    const selectedPlan = wizardState.selectedPlan;
    
    // Validar que tengamos todos los campos requeridos
    if (!selectedPlan) {
      throw new Error('No se ha seleccionado un plan');
    }

    if (!userData || !userData.name || !userData.email || !userData.phone || !userData.rentaMensual) {
      throw new Error('Todos los campos son obligatorios. Por favor, regresa al paso anterior y completa tus datos.');
    }

    this.logger.log('📋 Creando cotización para plan:', selectedPlan);
    this.logger.log('👤 Datos del usuario:', userData);

    // ✅ OPTIMIZADO: Solo cargar plan si realmente lo necesitamos
    // Por ahora, complementAmount siempre es 0, así que no necesitamos cargar el plan
    let complementAmount = 0;
    
    // Si en el futuro necesitamos calcular complementos, aquí se cargaría el plan
    // Por ahora, omitimos la petición para evitar llamadas innecesarias
    this.logger.log('ℹ️ Usando complementAmount por defecto (0), omitiendo carga de plan');

    // Create simplified DTO with only available fields
    const quotationDto: CreateQuotationDto = {
      planId: selectedPlan,
      sessionId: wizardState.sessionId, // Session ID (pji_session_ format)
      wizardSessionId: wizardState.id, // Session UUID
      monthlyRent: userData.rentaMensual, // Monthly rent amount
      rentPercentage: 0, // Will be calculated in backend
      complementAmount: complementAmount, // Complement amount
      userData: {
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        postalCode: userData.postalCode || '00000'
      }
    };

    this.logger.log('📤 Enviando cotización:', quotationDto);

    return new Promise((resolve, reject) => {
      this.quotationsService.createQuotation(quotationDto).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.logger.log('✅ Cotización creada exitosamente:', response.data);
            // Crear objeto con datos completos
            const quotationData = {
              ...response.data,
              quotationAmount: parseFloat(response.data.finalPrice || response.data.basePrice || '0'),
              quotationCurrency: 'MXN',
              userId: response.data.userId,
              plan: {
                name: response.data.plan?.name || '',
                price: parseFloat(response.data.finalPrice || response.data.basePrice || '0')
              }
            };
            this.logger.log('📊 Datos completos de cotización:', quotationData);
            
            // Actualizar quotationId si se creó una nueva
            if (response.data.id) {
              this.quotationId = response.data.id;
            }
            
            resolve(quotationData);
          } else {
            this.logger.error('❌ Error en respuesta:', response);
            reject(new Error(response.message || 'Error creando cotización'));
          }
        },
        error: (error) => {
          this.logger.error('❌ Error HTTP:', error);
          // Intentar obtener más detalles del error
          let errorMessage = 'Error interno del servidor';
          if (error.error && error.error.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          reject(new Error(errorMessage));
        }
      });
    });
  }

  /**
   * Resetear formulario
   */
  private resetForm(): void {
    this.cardData = {
      card_number: '',
      holder_name: '',
      expiration_year: '',
      expiration_month: '',
      cvv2: ''
    };
    this.cardErrors = { number: '', cvv: '', expiry: '' };
    this.cardType = '';
  }

  onNext() {
    this.logger.log('🔄 onNext() llamado en PaymentStepComponent');
    // Emitir sin datos para navegación manual
    this.next.emit(null);
  }

  onPrevious() {
    this.previous.emit();
  }

  /**
   * Obtener clase CSS para el tipo de tarjeta
   */
  getCardTypeClass(): string {
    if (!this.cardType) return '';
    return `card-${this.cardType.toLowerCase()}`;
  }

  /**
   * Obtener icono para el tipo de tarjeta
   */
  getCardIcon(): string {
    switch (this.cardType.toLowerCase()) {
      case 'visa':
        return 'bi-credit-card';
      case 'mastercard':
        return 'bi-credit-card-fill';
      case 'american express':
        return 'bi-credit-card';
      default:
        return 'bi-credit-card';
    }
  }
} 