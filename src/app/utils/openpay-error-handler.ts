// Utilidades para manejo de errores de OpenPay según documentación oficial
export class OpenPayErrorHandler {
  /**
   * Mapea códigos de error de OpenPay a mensajes amigables en español
   * Basado en: https://documents.openpay.mx/docs/errors.html
   */
  static getErrorMessage(error: any): string {
    if (!error) {
      return 'Error desconocido al procesar el pago';
    }

    // Si viene de la respuesta HTTP de OpenPay
    const errorCode = error.error_code || error.code;
    const httpCode = error.http_code || error.status;
    const description = error.description || error.message || 'Error desconocido';

    // Errores generales (1000-1010)
    switch (errorCode) {
      case 1000:
        return 'Error interno del servidor de OpenPay. Por favor, intenta más tarde.';
      case 1001:
        return 'Los datos proporcionados no son válidos. Por favor, verifica la información.';
      case 1002:
        return 'Error de autenticación. Por favor, contacta al soporte.';
      case 1003:
        return 'Los parámetros proporcionados no son correctos. Verifica los datos ingresados.';
      case 1004:
        return 'El servicio de pagos no está disponible temporalmente. Intenta más tarde.';
      case 1005:
        return 'El recurso solicitado no existe. Verifica la información.';
      case 1006:
        return 'Ya existe una transacción con este ID de orden.';
      case 1007:
        return 'La transferencia de fondos no fue aceptada. Verifica tu tarjeta o cuenta bancaria.';
      case 1008:
        return 'La cuenta se encuentra desactivada. Contacta al soporte.';
      case 1009:
        return 'La solicitud es demasiado grande. Contacta al soporte.';
      case 1010:
        return 'Error de permisos. Contacta al soporte.';
    }

    // Errores de almacenamiento (2001-2009)
    switch (errorCode) {
      case 2001:
        return 'Esta cuenta bancaria ya está registrada.';
      case 2002:
        return 'Esta tarjeta ya está registrada.';
      case 2003:
        return 'Ya existe un cliente con este identificador.';
      case 2004:
        return 'El número de tarjeta no es válido. Verifica el número ingresado.';
      case 2005:
        return 'La fecha de expiración de la tarjeta es anterior a la fecha actual.';
      case 2006:
        return 'El código de seguridad (CVV) es requerido.';
      case 2007:
        return 'Esta tarjeta es de prueba y solo puede usarse en modo sandbox.';
      case 2008:
        return 'La tarjeta consultada no es válida para puntos.';
      case 2009:
        return 'El código de seguridad (CVV) no es válido.';
    }

    // Errores de tarjetas (3001-3012)
    switch (errorCode) {
      case 3001:
        return 'La tarjeta fue declinada. Verifica los fondos o contacta a tu banco.';
      case 3002:
        return 'La tarjeta ha expirado. Verifica la fecha de expiración.';
      case 3003:
        return 'La tarjeta no tiene fondos suficientes.';
      case 3004:
        return 'La tarjeta ha sido identificada como robada. Contacta a tu banco.';
      case 3005:
        return 'La tarjeta ha sido identificada como fraudulenta. Contacta a tu banco.';
      case 3006:
        return 'La operación no está permitida para este cliente o transacción.';
      case 3008:
        return 'La tarjeta no es soportada en transacciones en línea.';
      case 3009:
        return 'La tarjeta fue reportada como perdida. Contacta a tu banco.';
      case 3010:
        return 'El banco ha restringido la tarjeta. Contacta a tu banco.';
      case 3011:
        return 'El banco ha solicitado que la tarjeta sea retenida. Contacta a tu banco.';
      case 3012:
        return 'Se requiere autorización del banco para realizar este pago.';
    }

    // Errores de cuentas (4001)
    switch (errorCode) {
      case 4001:
        return 'La cuenta de OpenPay no tiene fondos suficientes.';
    }

    // Si hay fraud_rules, agregar información adicional
    if (error.fraud_rules && Array.isArray(error.fraud_rules) && error.fraud_rules.length > 0) {
      const fraudMessage = this.getFraudRuleMessage(error.fraud_rules[0]);
      if (fraudMessage) {
        return `${description}. ${fraudMessage}`;
      }
    }

    // Fallback a descripción o mensaje genérico
    return description || 'Error al procesar el pago. Por favor, intenta nuevamente.';
  }

  /**
   * Traduce reglas de fraude a mensajes amigables
   */
  static getFraudRuleMessage(rule: string): string {
    const fraudMessages: { [key: string]: string } = {
      'Billing <> BIN Country for VISA/MC': 'El país de facturación no coincide con el país de la tarjeta.',
      'Card Velocity': 'Se detectaron múltiples transacciones en poco tiempo.',
      'IP Velocity': 'Se detectaron múltiples transacciones desde la misma IP.',
      'Email Velocity': 'Se detectaron múltiples transacciones con el mismo email.',
    };

    return fraudMessages[rule] || '';
  }

  /**
   * Obtiene el código HTTP del error
   */
  static getHttpCode(error: any): number {
    return error.http_code || error.status || 500;
  }

  /**
   * Obtiene el código de error de OpenPay
   */
  static getErrorCode(error: any): number | null {
    return error.error_code || error.code || null;
  }

  /**
   * Verifica si el error es recuperable
   */
  static isRecoverable(error: any): boolean {
    const errorCode = this.getErrorCode(error);
    
    // Si no hay código de error, no es recuperable
    if (errorCode === null) {
      return false;
    }
    
    // Errores recuperables (el usuario puede intentar de nuevo)
    const recoverableCodes = [
      1000, // Error interno del servidor
      1004, // Servicio no disponible
      3001, // Tarjeta declinada (puede ser temporal)
      3003, // Fondos insuficientes (puede depositar)
    ];

    return recoverableCodes.includes(errorCode);
  }
}

