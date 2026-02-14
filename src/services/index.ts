/**
 * Services Index
 *
 * Export all services for easy importing throughout the app.
 */

// Supabase client
export { supabase, getAuthToken, invokeEdgeFunction } from './supabase';

// API Services
export * from './api/verificationApi';
export { fetchCompanions } from './companionsApi';
