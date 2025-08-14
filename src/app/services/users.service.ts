import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, ApiResponse } from './api.service';
import { User, CreateUserDto, UpdateUserDto, UserStats } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly endpoint = '/users';

  constructor(private apiService: ApiService) {}

  /**
   * Crear un nuevo usuario
   */
  createUser(userData: CreateUserDto): Observable<ApiResponse<User>> {
    return this.apiService.post<User>(this.endpoint, userData);
  }

  /**
   * Obtener todos los usuarios
   */
  getUsers(): Observable<ApiResponse<User[]>> {
    return this.apiService.get<User[]>(this.endpoint);
  }

  /**
   * Obtener usuario por ID
   */
  getUserById(id: string): Observable<ApiResponse<User>> {
    return this.apiService.get<User>(`${this.endpoint}/${id}`);
  }

  /**
   * Obtener estadísticas del usuario
   */
  getUserStats(id: string): Observable<ApiResponse<UserStats>> {
    return this.apiService.get<UserStats>(`${this.endpoint}/${id}/stats`);
  }

  /**
   * Actualizar usuario
   */
  updateUser(id: string, userData: UpdateUserDto): Observable<ApiResponse<User>> {
    return this.apiService.patch<User>(`${this.endpoint}/${id}`, userData);
  }

  /**
   * Eliminar usuario
   */
  deleteUser(id: string): Observable<ApiResponse<void>> {
    return this.apiService.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * Verificar usuario
   */
  verifyUser(id: string): Observable<ApiResponse<User>> {
    return this.apiService.patch<User>(`${this.endpoint}/${id}/verify`, {});
  }

  /**
   * Asignar OpenPay Customer ID
   */
  assignOpenPayCustomer(id: string, openpayCustomerId: string): Observable<ApiResponse<User>> {
    return this.apiService.patch<User>(`${this.endpoint}/${id}/openpay-customer`, {
      openpayCustomerId
    });
  }

  /**
   * Buscar usuario por email
   */
  findUserByEmail(email: string): Observable<ApiResponse<User>> {
    // Nota: Este endpoint no existe en el backend actual
    // Se puede implementar como filtro en getUsers o crear endpoint específico
    return this.apiService.get<User>(`${this.endpoint}?email=${email}`);
  }
}
